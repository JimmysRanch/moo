// Supabase Edge Function: reconcile-payments
// Compares Stripe payment intents against local payment_intents table,
// logs discrepancies, and tracks run metadata for safe retries.
//
// Intended to be scheduled daily via Supabase cron (configure scheduling separately).
// Can also be invoked manually.
// Requires env vars: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ───────────────────────────────────────────────────────────────────

interface StripePaymentIntent {
  id: string
  amount: number
  currency: string
  status: string
  created: number
}

interface StripeListResponse {
  data: StripePaymentIntent[]
  has_more: boolean
}

interface LocalPaymentIntent {
  id: string
  stripe_payment_intent_id: string
  store_id: string
  amount: number
  currency: string
  status: string
  created_at?: string | null
}

interface Discrepancy {
  store_id: string
  stripe_payment_intent_id: string
  local_payment_intent_id: string | null
  discrepancy_type: string
  stripe_amount: number | null
  local_amount: number | null
  stripe_status: string | null
  local_status: string | null
}

// ── Config ──────────────────────────────────────────────────────────────────

const STRIPE_API = 'https://api.stripe.com/v1'
const SAFETY_WINDOW_DAYS = 7
const PAGE_SIZE = 100
// Avoid flagging just-created local rows as missing_in_stripe before Stripe has
// had a chance to surface them in the list endpoint. The list is indexed on
// `created` and can lag a few seconds behind paymentIntents.create.
const STRIPE_LIST_LAG_MS = 2 * 60 * 1000

interface StripeConnection {
  salon_id: string
  stripe_account_id: string
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Create a reconciliation run record
  const { data: run, error: runError } = await supabase
    .from('reconciliation_runs')
    .insert({ status: 'running' })
    .select('id')
    .single()

  if (runError || !run) {
    return jsonResponse({ error: 'Failed to create reconciliation run', details: runError }, 500)
  }

  const runId = run.id

  try {
    // 2. Determine the incremental window
    const lookbackFrom = await getIncrementalStart(supabase)

    const discrepancies: Discrepancy[] = []
    const connections = await fetchStripeConnections(supabase)
    let totalStripeCount = 0
    let totalLocalCount = 0

    for (const connection of connections) {
      const stripeIntents = await fetchStripePaymentIntents(stripeKey, lookbackFrom, connection.stripe_account_id)
      const stripeIds = stripeIntents.map((pi) => pi.id)
      const localIntents = await fetchLocalPaymentIntents(supabase, connection.salon_id, stripeIds, lookbackFrom)

      totalStripeCount += stripeIntents.length
      totalLocalCount += localIntents.length

      const localByStripeId = new Map<string, LocalPaymentIntent>()
      for (const local of localIntents) {
        localByStripeId.set(local.stripe_payment_intent_id, local)
      }

      const stripeById = new Map<string, StripePaymentIntent>()
      for (const stripeIntent of stripeIntents) {
        stripeById.set(stripeIntent.id, stripeIntent)
      }

      for (const stripeIntent of stripeIntents) {
        const local = localByStripeId.get(stripeIntent.id)
        if (!local) {
          discrepancies.push({
            store_id: connection.salon_id,
            stripe_payment_intent_id: stripeIntent.id,
            local_payment_intent_id: null,
            discrepancy_type: 'missing_locally',
            stripe_amount: stripeIntent.amount,
            local_amount: null,
            stripe_status: stripeIntent.status,
            local_status: null,
          })
          continue
        }

        const amountMismatch = stripeIntent.amount !== local.amount
        const statusMismatch = stripeIntent.status !== local.status

        if (amountMismatch || statusMismatch) {
          discrepancies.push({
            store_id: connection.salon_id,
            stripe_payment_intent_id: stripeIntent.id,
            local_payment_intent_id: local.id,
            discrepancy_type: amountMismatch && statusMismatch
              ? 'amount_and_status_mismatch'
              : amountMismatch
                ? 'amount_mismatch'
                : 'status_mismatch',
            stripe_amount: stripeIntent.amount,
            local_amount: local.amount,
            stripe_status: stripeIntent.status,
            local_status: local.status,
          })
        }
      }

      for (const local of localIntents) {
        if (stripeById.has(local.stripe_payment_intent_id)) continue
        // Avoid false positives: only flag as missing_in_stripe when the local row
        // is old enough that Stripe's list API should have surfaced it, and when
        // its Stripe PI id is in the connected-account namespace we just scanned.
        const createdAtMs = local.created_at ? new Date(local.created_at).getTime() : null
        if (createdAtMs && Date.now() - createdAtMs < STRIPE_LIST_LAG_MS) continue
        discrepancies.push({
          store_id: connection.salon_id,
          stripe_payment_intent_id: local.stripe_payment_intent_id,
          local_payment_intent_id: local.id,
          discrepancy_type: 'missing_in_stripe',
          stripe_amount: null,
          local_amount: local.amount,
          stripe_status: null,
          local_status: local.status,
        })
      }
    }

    // 7. Upsert discrepancies (idempotent — no duplicate rows per run)
    if (discrepancies.length > 0) {
      const discrepancyMap = new Map<string, string[]>()
      for (const discrepancy of discrepancies) {
        const existing = discrepancyMap.get(discrepancy.store_id) ?? []
        if (!existing.includes(discrepancy.stripe_payment_intent_id)) {
          existing.push(discrepancy.stripe_payment_intent_id)
        }
        discrepancyMap.set(discrepancy.store_id, existing)
      }

      for (const [storeId, affectedIds] of discrepancyMap.entries()) {
        await supabase
          .from('payment_reconciliation_log')
          .update({ resolved: true })
          .eq('store_id', storeId)
          .in('stripe_payment_intent_id', affectedIds)
          .eq('resolved', false)
      }

      // Insert fresh discrepancy rows
      const { error: insertError } = await supabase
        .from('payment_reconciliation_log')
        .insert(discrepancies)

      if (insertError) {
        throw new Error(`Failed to insert discrepancies: ${insertError.message}`)
      }
    }

    // 8. Mark run as successful and update last_run_at
    await supabase
      .from('reconciliation_runs')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
      })
      .eq('id', runId)

    return jsonResponse({
      success: true,
      stripe_count: totalStripeCount,
      local_count: totalLocalCount,
      discrepancies_found: discrepancies.length,
    })
  } catch (err) {
    // Mark run as failed — do NOT update last_run_at so re-run is safe
    await supabase
      .from('reconciliation_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)

    const message = err instanceof Error ? err.message : 'Unknown error'
    return jsonResponse({ error: 'Reconciliation failed', details: message }, 500)
  }
})

// ── Helper: determine incremental start timestamp ───────────────────────────

async function getIncrementalStart(
  supabase: ReturnType<typeof createClient>,
): Promise<number> {
  const { data } = await supabase
    .from('reconciliation_runs')
    .select('last_run_at')
    .eq('status', 'success')
    .order('last_run_at', { ascending: false })
    .limit(1)
    .single()

  if (data?.last_run_at) {
    return Math.floor(new Date(data.last_run_at).getTime() / 1000)
  }

  // Fallback: last 7 days
  return Math.floor((Date.now() - SAFETY_WINDOW_DAYS * 24 * 60 * 60 * 1000) / 1000)
}

// ── Helper: fetch Stripe payment intents with pagination ────────────────────

async function fetchStripePaymentIntents(
  apiKey: string,
  createdGte: number,
  stripeAccountId: string,
): Promise<StripePaymentIntent[]> {
  const results: StripePaymentIntent[] = []
  let startingAfter: string | undefined

  while (true) {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      'created[gte]': String(createdGte),
    })
    if (startingAfter) {
      params.set('starting_after', startingAfter)
    }

    const res = await fetch(`${STRIPE_API}/payment_intents?${params}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Stripe-Account': stripeAccountId,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Stripe API error ${res.status}: ${body}`)
    }

    const json: StripeListResponse = await res.json()
    results.push(...json.data)

    if (!json.has_more || json.data.length === 0) break
    startingAfter = json.data[json.data.length - 1].id
  }

  return results
}

// ── Helper: fetch local payment intents matching stripe IDs ─────────────────

async function fetchLocalPaymentIntents(
  supabase: ReturnType<typeof createClient>,
  storeId: string,
  stripeIds: string[],
  createdGte: number,
): Promise<LocalPaymentIntent[]> {
  const windowStartIso = new Date(createdGte * 1000).toISOString()
  const results: LocalPaymentIntent[] = []

  if (stripeIds.length > 0) {
    const CHUNK = 500

    for (let i = 0; i < stripeIds.length; i += CHUNK) {
      const chunk = stripeIds.slice(i, i + CHUNK)
      const { data, error } = await supabase
        .from('payment_intents')
        .select('id, store_id, stripe_payment_intent_id, amount, currency, status, created_at')
        .eq('store_id', storeId)
        .in('stripe_payment_intent_id', chunk)

      if (error) throw new Error(`Supabase query error: ${error.message}`)
      if (data) results.push(...(data as LocalPaymentIntent[]))
    }
  }

  const { data: localInWindow, error: localWindowError } = await supabase
    .from('payment_intents')
    .select('id, store_id, stripe_payment_intent_id, amount, currency, status, created_at')
    .eq('store_id', storeId)
    .gte('created_at', windowStartIso)

  if (localWindowError) throw new Error(`Supabase query error: ${localWindowError.message}`)

  for (const row of (localInWindow as LocalPaymentIntent[] | null) ?? []) {
    if (!results.some((existing) => existing.id === row.id)) {
      results.push(row)
    }
  }

  return results
}

async function fetchStripeConnections(
  supabase: ReturnType<typeof createClient>,
): Promise<StripeConnection[]> {
  const { data, error } = await supabase
    .from('stripe_connections')
    .select('salon_id, stripe_account_id')
    .not('stripe_account_id', 'is', null)

  if (error) throw new Error(`Failed to fetch Stripe connections: ${error.message}`)
  return (data as StripeConnection[] | null) ?? []
}

// ── Helper: JSON response builder ───────────────────────────────────────────

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
