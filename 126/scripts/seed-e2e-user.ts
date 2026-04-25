import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const E2E_EMAIL = process.env.E2E_EMAIL || 'e2e@example.local'
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'ChangeMe123!'
const E2E_STORE_NAME = process.env.E2E_STORE_NAME || 'E2E Test Store'
const E2E_USER_NAME = process.env.E2E_USER_NAME || 'E2E User'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserByEmail(email: string) {
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (found) return found

    if (data.users.length < perPage) return null
    page += 1
  }
}

async function main() {
  const normalizedEmail = E2E_EMAIL.trim().toLowerCase()

  let user = await findUserByEmail(normalizedEmail)
  if (!user) {
    const created = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: E2E_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: E2E_USER_NAME },
    })

    if (created.error || !created.data.user) {
      throw created.error || new Error('Failed to create E2E auth user')
    }
    user = created.data.user
  }

  const { data: existingMembership } = await supabase
    .from('store_memberships')
    .select('store_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .maybeSingle()

  let storeId = existingMembership?.store_id

  if (!storeId) {
    const createdStore = await supabase
      .from('stores')
      .insert({
        name: E2E_STORE_NAME,
      })
      .select('id')
      .single()

    if (createdStore.error || !createdStore.data) {
      throw createdStore.error || new Error('Failed to create E2E store')
    }

    storeId = createdStore.data.id
  }

  const membershipUpsert = await supabase
    .from('store_memberships')
    .upsert(
      { store_id: storeId, user_id: user.id, role: 'owner' },
      { onConflict: 'store_id,user_id', ignoreDuplicates: false }
    )

  if (membershipUpsert.error) throw membershipUpsert.error

  const [firstName, ...rest] = E2E_USER_NAME.split(' ')
  const lastName = rest.join(' ') || 'User'

  const staffUpsert = await supabase
    .from('staff')
    .upsert(
      {
        store_id: storeId,
        user_id: user.id,
        first_name: firstName || 'E2E',
        last_name: lastName,
        email: normalizedEmail,
        role: 'Owner',
        is_owner: true,
        is_active: true,
      },
      { onConflict: 'store_id,user_id', ignoreDuplicates: false }
    )

  if (staffUpsert.error) throw staffUpsert.error

  console.log(`E2E user ready: ${normalizedEmail}`)
  console.log(`Store ID: ${storeId}`)
}

main().catch((error) => {
  console.error('Failed to seed E2E user:', error)
  process.exit(1)
})
