import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-expect-error Deno edge runtime resolves npm: specifiers.
import twilio from 'npm:twilio@5.13.0'
import {
  buildTwilioWebhookUrl,
  formatPhoneNumberE164,
  getProviderReadinessStatus,
  normalizePhoneDigits,
  normalizeProviderDeliveryStatus,
  resolveSendTargets,
} from './shared.ts'

type MembershipRole = 'owner' | 'manager' | 'front_desk' | 'staff'

type ProviderProfileRow = {
  id: string
  store_id: string
  provider: 'twilio'
  account_sid: string | null
  messaging_service_sid: string | null
  messaging_service_name: string | null
  provisioning_status: string
  compliance_status: string
  sender_status: string
  onboarding_data: Record<string, unknown>
  provider_metadata: Record<string, unknown>
  last_error: string | null
  last_synced_at: string | null
}

type SenderRow = {
  id: string
  store_id: string
  provider_profile_id: string
  phone_number_sid: string
  phone_number: string
  sender_type: 'twilio_number'
  status: 'active' | 'inactive' | 'failed'
  capabilities: Record<string, unknown>
  country_code: string | null
  is_primary: boolean
}

type AuthedContext = {
  userClient: ReturnType<typeof createClient>
  adminClient: ReturnType<typeof createClient>
  userId: string
  storeId: string
  role: MembershipRole
}

type ProviderSetupInput = {
  businessName: string
  contactName: string
  email: string
  website?: string
  areaCode?: string | null
  optInWorkflow: string
  address: { street: string; city: string; state: string; postalCode: string; country: string }
}

const CORS_ALLOWED_ORIGIN = (Deno.env.get('APP_BASE_URL') ?? 'http://localhost:5173').replace(/\/$/, '')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': CORS_ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-store-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function getTwilioClient() {
  return twilio(getEnv('TWILIO_ACCOUNT_SID'), getEnv('TWILIO_AUTH_TOKEN'))
}

function validateTwilioWebhookRequest(input: {
  authToken: string
  signature: string | undefined
  url: string
  params: Record<string, string>
}) {
  if (!input.signature) return false
  return twilio.validateRequest(input.authToken, input.signature, input.url, input.params)
}

function getWebhookBaseUrl(req: Request) {
  const configured = Deno.env.get('TWILIO_WEBHOOK_BASE_URL') ?? Deno.env.get('SUPABASE_FUNCTIONS_BASE_URL')
  if (configured) return configured.replace(/\/$/, '')
  const url = new URL(req.url)
  return `${url.protocol}//${url.host}/functions/v1`
}

function getWebhookUrls(req: Request) {
  const baseUrl = getWebhookBaseUrl(req)
  return {
    inbound: `${baseUrl}/twilio-messages/webhooks/inbound`,
    status: `${baseUrl}/twilio-messages/webhooks/status`,
  }
}

function parseFormParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {}
  formData.forEach((value, key) => {
    params[key] = String(value)
  })
  return params
}

async function getAuthedContext(req: Request): Promise<AuthedContext | Response> {
  const supabaseUrl = getEnv('SUPABASE_URL')
  const anon = getEnv('SUPABASE_ANON_KEY')
  const serviceRole = getEnv('SUPABASE_SERVICE_ROLE_KEY')

  const authHeader = req.headers.get('authorization')
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined
  const storeId = req.headers.get('x-store-id') ?? ''
  if (!accessToken || !storeId) return json({ error: 'NOT_AUTHENTICATED', message: 'Missing auth or store context.' }, 401)

  const userClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
  const adminClient = createClient(supabaseUrl, serviceRole)

  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'NOT_AUTHENTICATED', message: 'Invalid session.' }, 401)

  const { data: membership, error: membershipError } = await userClient
    .from('store_memberships')
    .select('store_id, role')
    .eq('user_id', authData.user.id)
    .eq('store_id', storeId)
    .maybeSingle()

  if (membershipError) return json({ error: 'AUTHORIZATION_FAILED', message: 'Unable to verify store membership.' }, 500)
  if (!membership) return json({ error: 'FORBIDDEN', message: 'Store access denied.' }, 403)

  return {
    userClient,
    adminClient,
    userId: authData.user.id,
    storeId,
    role: (membership.role as MembershipRole) ?? 'front_desk',
  }
}

async function getProviderState(adminClient: ReturnType<typeof createClient>, storeId: string) {
  const { data: profile, error: profileError } = await adminClient
    .from('message_provider_profiles')
    .select('*')
    .eq('store_id', storeId)
    .eq('provider', 'twilio')
    .maybeSingle()
  if (profileError) throw profileError

  const { data: sender, error: senderError } = await adminClient
    .from('message_sender_inventory')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_primary', true)
    .maybeSingle()
  if (senderError) throw senderError

  return { profile: (profile as ProviderProfileRow | null) ?? null, sender: (sender as SenderRow | null) ?? null }
}

async function syncBusinessMessageSettings(adminClient: ReturnType<typeof createClient>, storeId: string, input: {
  businessNumber?: string | null
  readinessStatus: string
  complianceStatus: string
}) {
  const { data: settings, error } = await adminClient
    .from('business_settings')
    .select('id, message_settings')
    .eq('store_id', storeId)
    .maybeSingle()
  if (error) throw error
  if (!settings) return

  const current = (settings.message_settings ?? {}) as Record<string, unknown>
  const compliance = (current.compliance ?? {}) as Record<string, unknown>
  const next = {
    ...current,
    business_number: input.businessNumber ?? current.business_number ?? '',
    number_status: input.readinessStatus === 'active' ? 'active' : input.readinessStatus === 'not_started' ? 'unconfigured' : 'pending',
    compliance: {
      ...compliance,
      registration_status: input.complianceStatus === 'active' ? 'approved' : input.complianceStatus === 'in_review' ? 'in_review' : 'pending',
    },
  }

  const { error: updateError } = await adminClient
    .from('business_settings')
    .update({ message_settings: next })
    .eq('id', settings.id)
  if (updateError) throw updateError
}

async function ensureWebhookTargets(input: {
  twilioClient: ReturnType<typeof twilio>
  profile: ProviderProfileRow
  sender: SenderRow | null
  webhookUrls: { inbound: string; status: string }
}) {
  const metadata = (input.profile.provider_metadata ?? {}) as Record<string, unknown>
  if (input.profile.messaging_service_sid) {
    const service = await input.twilioClient.messaging.v1.services(input.profile.messaging_service_sid).update({
      inboundRequestUrl: input.webhookUrls.inbound,
      statusCallback: input.webhookUrls.status,
      useInboundWebhookOnNumber: true,
    })
    metadata.messagingService = service
  }

  if (input.sender?.phone_number_sid) {
    const refreshedNumber = await input.twilioClient.incomingPhoneNumbers(input.sender.phone_number_sid).update({
      smsUrl: input.webhookUrls.inbound,
      smsMethod: 'POST',
      statusCallback: input.webhookUrls.status,
      statusCallbackMethod: 'POST',
    })
    metadata.phoneNumber = refreshedNumber
  }

  metadata.webhooks = {
    inbound: input.webhookUrls.inbound,
    status: input.webhookUrls.status,
    refreshedAt: new Date().toISOString(),
  }

  return metadata
}

async function upsertProviderProfileForSetup(ctx: AuthedContext, existingProfile: ProviderProfileRow | null, setup: ProviderSetupInput) {
  if (!existingProfile) {
    const { data, error } = await ctx.adminClient
      .from('message_provider_profiles')
      .insert({
        store_id: ctx.storeId,
        provider: 'twilio',
        account_sid: getEnv('TWILIO_ACCOUNT_SID'),
        provisioning_status: 'provisioning',
        compliance_status: 'in_review',
        sender_status: 'provisioning',
        onboarding_data: {
          businessName: setup.businessName,
          contactName: setup.contactName,
          email: setup.email,
          website: setup.website ?? '',
          address: setup.address,
          optInWorkflow: setup.optInWorkflow,
          requestedAreaCode: setup.areaCode ?? null,
        },
        created_by: ctx.userId,
        updated_by: ctx.userId,
      })
      .select('*')
      .single()
    if (error || !data) throw error
    return data as ProviderProfileRow
  }

  const nextSenderStatus = existingProfile.sender_status === 'active' ? 'active' : 'provisioning'
  const nextComplianceStatus = existingProfile.compliance_status === 'active' ? 'active' : 'in_review'

  const { data, error } = await ctx.adminClient
    .from('message_provider_profiles')
    .update({
      account_sid: getEnv('TWILIO_ACCOUNT_SID'),
      provisioning_status: 'provisioning',
      compliance_status: nextComplianceStatus,
      sender_status: nextSenderStatus,
      onboarding_data: {
        ...(existingProfile.onboarding_data ?? {}),
        businessName: setup.businessName,
        contactName: setup.contactName,
        email: setup.email,
        website: setup.website ?? '',
        address: setup.address,
        optInWorkflow: setup.optInWorkflow,
        requestedAreaCode: setup.areaCode ?? null,
      },
      updated_by: ctx.userId,
      last_error: null,
    })
    .eq('id', existingProfile.id)
    .select('*')
    .single()
  if (error || !data) throw error
  return data as ProviderProfileRow
}

async function provisionMessagingResources(ctx: AuthedContext, input: {
  existingProfile: ProviderProfileRow | null
  existingSender: SenderRow | null
  setup: ProviderSetupInput
  req: Request
}) {
  const twilioClient = getTwilioClient()
  const webhookUrls = getWebhookUrls(input.req)
  let profile = await upsertProviderProfileForSetup(ctx, input.existingProfile, input.setup)
  let sender = input.existingSender

  let messagingServiceSid = profile.messaging_service_sid
  if (!messagingServiceSid) {
    const service = await twilioClient.messaging.v1.services.create({
      friendlyName: `${input.setup.businessName} Texting`,
      inboundRequestUrl: webhookUrls.inbound,
      statusCallback: webhookUrls.status,
      useInboundWebhookOnNumber: true,
    })
    messagingServiceSid = service.sid
    const { data, error } = await ctx.adminClient
      .from('message_provider_profiles')
      .update({
        messaging_service_sid: service.sid,
        messaging_service_name: service.friendlyName,
        provider_metadata: {
          ...(profile.provider_metadata ?? {}),
          messagingService: service,
        },
        updated_by: ctx.userId,
      })
      .eq('id', profile.id)
      .select('*')
      .single()
    if (error || !data) throw error
    profile = data as ProviderProfileRow
  }

  if (!sender) {
    const normalizedAreaCode = normalizePhoneDigits(input.setup.areaCode ?? '').slice(0, 3)
    const localNumbers = normalizedAreaCode.length === 3
      ? await twilioClient.availablePhoneNumbers('US').local.list({ areaCode: Number(normalizedAreaCode), smsEnabled: true, mmsEnabled: true, limit: 1 })
      : []
    const fallbackNumbers = localNumbers.length > 0
      ? localNumbers
      : await twilioClient.availablePhoneNumbers('US').tollFree.list({ smsEnabled: true, limit: 1 })
    const selectedNumber = fallbackNumbers[0]

    if (!selectedNumber?.phoneNumber) {
      await ctx.adminClient
        .from('message_provider_profiles')
        .update({
          provisioning_status: 'action_needed',
          sender_status: 'action_needed',
          last_error: 'No SMS-capable number was available for provisioning.',
          updated_by: ctx.userId,
        })
        .eq('id', profile.id)
      throw new Error('No SMS-capable number is currently available. Please retry setup later.')
    }

    const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber: selectedNumber.phoneNumber,
      friendlyName: `${input.setup.businessName} Texting`,
      smsUrl: webhookUrls.inbound,
      smsMethod: 'POST',
      statusCallback: webhookUrls.status,
      statusCallbackMethod: 'POST',
    })

    await twilioClient.messaging.v1.services(messagingServiceSid).phoneNumbers.create({ phoneNumberSid: purchasedNumber.sid })

    const { data, error } = await ctx.adminClient
      .from('message_sender_inventory')
      .insert({
        store_id: ctx.storeId,
        provider_profile_id: profile.id,
        phone_number_sid: purchasedNumber.sid,
        phone_number: purchasedNumber.phoneNumber,
        sender_type: 'twilio_number',
        status: 'active',
        capabilities: purchasedNumber.capabilities ?? {},
        country_code: purchasedNumber.isoCountry ?? 'US',
        is_primary: true,
      })
      .select('*')
      .single()
    if (error || !data) throw error
    sender = data as SenderRow
  }

  const refreshedMetadata = await ensureWebhookTargets({
    twilioClient,
    profile,
    sender,
    webhookUrls,
  })

  const readinessStatus = getProviderReadinessStatus({
    provisioning_status: 'active',
    compliance_status: profile.compliance_status === 'failed' ? 'failed' : 'active',
    messaging_service_sid: messagingServiceSid,
    sender_status: sender?.status,
    phone_number: sender?.phone_number,
  })

  const { data: updatedProfile, error: profileError } = await ctx.adminClient
    .from('message_provider_profiles')
    .update({
      provisioning_status: readinessStatus,
      compliance_status: profile.compliance_status === 'failed' ? 'failed' : 'active',
      sender_status: sender?.status === 'failed' ? 'failed' : 'active',
      provider_metadata: refreshedMetadata,
      last_error: null,
      last_synced_at: new Date().toISOString(),
      updated_by: ctx.userId,
    })
    .eq('id', profile.id)
    .select('*')
    .single()
  if (profileError || !updatedProfile) throw profileError

  await syncBusinessMessageSettings(ctx.adminClient, ctx.storeId, {
    businessNumber: sender?.phone_number,
    readinessStatus,
    complianceStatus: (updatedProfile as ProviderProfileRow).compliance_status,
  })

  return {
    profile: updatedProfile as ProviderProfileRow,
    sender,
    readinessStatus,
  }
}

async function handleAuthenticatedAction(req: Request) {
  const ctxOrResponse = await getAuthedContext(req)
  if (ctxOrResponse instanceof Response) return ctxOrResponse
  const ctx = ctxOrResponse

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(body.action ?? '')

  if (action === 'provider_status') {
    const { profile, sender } = await getProviderState(ctx.adminClient, ctx.storeId)
    const readinessStatus = getProviderReadinessStatus({
      provisioning_status: profile?.provisioning_status,
      compliance_status: profile?.compliance_status,
      messaging_service_sid: profile?.messaging_service_sid,
      sender_status: sender?.status ?? profile?.sender_status,
      phone_number: sender?.phone_number,
    })

    return json({
      provider: profile,
      sender,
      readinessStatus,
      canSend: readinessStatus === 'active',
    })
  }

  if (action === 'provider_setup') {
    if (ctx.role !== 'owner') {
      return json({ error: 'OWNER_ONLY', message: 'Only the store owner can manage texting setup.' }, 403)
    }

    const required = ['businessName', 'contactName', 'email', 'optInWorkflow', 'addressStreet', 'addressCity', 'addressState', 'addressPostalCode', 'addressCountry']
    const missing = required.some((field) => !String(body[field] ?? '').trim())
    if (missing) {
      return json({ error: 'VALIDATION_ERROR', message: 'Business, contact, opt-in, and mailing address fields are required.' }, 400)
    }

    const existing = await getProviderState(ctx.adminClient, ctx.storeId)
    const provisioned = await provisionMessagingResources(ctx, {
      existingProfile: existing.profile,
      existingSender: existing.sender,
      setup: {
        businessName: String(body.businessName).trim(),
        contactName: String(body.contactName).trim(),
        email: String(body.email).trim(),
        website: body.website ? String(body.website).trim() : undefined,
        areaCode: body.areaCode ? String(body.areaCode).trim() : null,
        optInWorkflow: String(body.optInWorkflow).trim(),
        address: {
          street: String(body.addressStreet).trim(),
          city: String(body.addressCity).trim(),
          state: String(body.addressState).trim(),
          postalCode: String(body.addressPostalCode).trim(),
          country: String(body.addressCountry).trim(),
        },
      },
      req,
    })

    return json({
      provider: provisioned.profile,
      sender: provisioned.sender,
      readinessStatus: provisioned.readinessStatus,
      canSend: provisioned.readinessStatus === 'active',
    })
  }

  if (action === 'provider_refresh') {
    if (ctx.role !== 'owner') {
      return json({ error: 'OWNER_ONLY', message: 'Only the store owner can manage texting setup.' }, 403)
    }

    const { profile, sender } = await getProviderState(ctx.adminClient, ctx.storeId)
    if (!profile) return json({ provider: null, sender: null, readinessStatus: 'not_started', canSend: false })

    const twilioClient = getTwilioClient()
    const webhookUrls = getWebhookUrls(req)

    let nextSenderStatus = sender?.status ?? profile.sender_status
    let nextProvisioningStatus = profile.provisioning_status

    if (profile.messaging_service_sid) {
      await twilioClient.messaging.v1.services(profile.messaging_service_sid).fetch()
      nextProvisioningStatus = 'active'
    }
    if (sender?.phone_number_sid) {
      await twilioClient.incomingPhoneNumbers(sender.phone_number_sid).fetch()
      nextSenderStatus = 'active'
    }

    const refreshedMetadata = await ensureWebhookTargets({
      twilioClient,
      profile,
      sender,
      webhookUrls,
    })

    const readinessStatus = getProviderReadinessStatus({
      provisioning_status: nextProvisioningStatus,
      compliance_status: profile.compliance_status,
      messaging_service_sid: profile.messaging_service_sid,
      sender_status: nextSenderStatus,
      phone_number: sender?.phone_number,
    })

    const { data: updatedProfile, error } = await ctx.adminClient
      .from('message_provider_profiles')
      .update({
        provisioning_status: readinessStatus,
        sender_status: nextSenderStatus,
        provider_metadata: refreshedMetadata,
        last_synced_at: new Date().toISOString(),
        last_error: null,
        updated_by: ctx.userId,
      })
      .eq('id', profile.id)
      .select('*')
      .single()
    if (error || !updatedProfile) throw error

    await syncBusinessMessageSettings(ctx.adminClient, ctx.storeId, {
      businessNumber: sender?.phone_number ?? null,
      readinessStatus,
      complianceStatus: (updatedProfile as ProviderProfileRow).compliance_status,
    })

    return json({ provider: updatedProfile, sender, readinessStatus, canSend: readinessStatus === 'active' })
  }

  if (action === 'send_message') {
    const clientId = String(body.clientId ?? '')
    const textBody = String(body.body ?? '').trim()
    if (!clientId || !textBody) {
      return json({ error: 'VALIDATION_ERROR', message: 'clientId and message body are required.' }, 400)
    }

    const { profile, sender } = await getProviderState(ctx.adminClient, ctx.storeId)
    const readinessStatus = getProviderReadinessStatus({
      provisioning_status: profile?.provisioning_status,
      compliance_status: profile?.compliance_status,
      messaging_service_sid: profile?.messaging_service_sid,
      sender_status: sender?.status ?? profile?.sender_status,
      phone_number: sender?.phone_number,
    })

    if (!profile?.messaging_service_sid || !sender?.phone_number || readinessStatus !== 'active') {
      return json({ error: 'MESSAGING_NOT_READY', message: 'Texting is not active for this salon yet.' }, 409)
    }

    const { data: businessSettings, error: businessError } = await ctx.userClient
      .from('business_settings')
      .select('message_settings')
      .eq('store_id', ctx.storeId)
      .maybeSingle()
    if (businessError) throw businessError

    const messagingEnabled = Boolean((businessSettings?.message_settings as { enabled?: boolean } | null)?.enabled)
    if (!messagingEnabled) {
      return json({ error: 'MESSAGING_DISABLED', message: 'Messaging is turned off in Messages settings for this salon.' }, 409)
    }

    const { data: clientRecord, error: clientError } = await ctx.userClient
      .from('clients')
      .select('id, phone')
      .eq('id', clientId)
      .eq('store_id', ctx.storeId)
      .maybeSingle()
    if (clientError) throw clientError
    if (!clientRecord) return json({ error: 'CLIENT_NOT_FOUND', message: 'Client could not be found.' }, 404)

    const recipientPhone = formatPhoneNumberE164(clientRecord.phone)
    if (!recipientPhone) {
      return json({ error: 'CLIENT_PHONE_INVALID', message: 'This client does not have a valid mobile number yet.' }, 400)
    }

    let conversation: { id: string; client_id: string; appointment_id?: string | null } | null = null
    if (body.conversationId) {
      const { data, error } = await ctx.userClient
        .from('message_conversations')
        .select('id, client_id, appointment_id')
        .eq('id', String(body.conversationId))
        .eq('store_id', ctx.storeId)
        .maybeSingle()
      if (error) throw error
      if (!data) return json({ error: 'CONVERSATION_NOT_FOUND', message: 'Conversation could not be found.' }, 404)
      conversation = data
    }

    let resolvedTargets: { clientId: string; appointmentId: string | null }
    try {
      resolvedTargets = resolveSendTargets({
        requestedClientId: clientId,
        conversation,
        requestedAppointmentId: body.appointmentId ? String(body.appointmentId) : null,
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'CONVERSATION_CLIENT_MISMATCH') {
        return json({ error: 'CONVERSATION_CLIENT_MISMATCH', message: 'Conversation and client do not match.' }, 409)
      }
      throw error
    }

    if (resolvedTargets.appointmentId) {
      const { data: appointment, error: appointmentError } = await ctx.userClient
        .from('appointments')
        .select('id, client_id')
        .eq('id', resolvedTargets.appointmentId)
        .eq('store_id', ctx.storeId)
        .maybeSingle()
      if (appointmentError) throw appointmentError
      if (!appointment) return json({ error: 'APPOINTMENT_NOT_FOUND', message: 'Appointment could not be found.' }, 404)
      if (appointment.client_id !== resolvedTargets.clientId) {
        return json({ error: 'APPOINTMENT_CLIENT_MISMATCH', message: 'Appointment and client do not match.' }, 409)
      }
    }

    const providerMessage = await getTwilioClient().messages.create({
      to: recipientPhone,
      body: textBody,
      messagingServiceSid: profile.messaging_service_sid,
      statusCallback: getWebhookUrls(req).status,
      smartEncoded: true,
    })

    const initialStatus = normalizeProviderDeliveryStatus(providerMessage.status ?? 'queued') ?? 'queued'

    if (!conversation) {
      const { data, error } = await ctx.userClient
        .from('message_conversations')
        .upsert({
          store_id: ctx.storeId,
          client_id: resolvedTargets.clientId,
          appointment_id: resolvedTargets.appointmentId,
          channel: 'sms',
          status: 'active',
          unread_count: 0,
          last_message_preview: textBody.slice(0, 160),
          last_message_at: new Date().toISOString(),
          last_message_direction: 'outbound',
          last_message_status: initialStatus,
          created_by: ctx.userId,
          updated_by: ctx.userId,
        }, { onConflict: 'store_id,client_id,channel' })
        .select('id, client_id, appointment_id')
        .single()
      if (error || !data) throw error
      conversation = data
    }


    if (!conversation) {
      throw new Error('Failed to resolve conversation for outbound message.')
    }

    const { data: insertedMessage, error: messageError } = await ctx.userClient
      .from('messages')
      .insert({
        store_id: ctx.storeId,
        conversation_id: conversation.id,
        client_id: conversation.client_id,
        appointment_id: resolvedTargets.appointmentId,
        direction: 'outbound',
        message_type: body.templateId ? 'template_generated' : 'sms',
        body: textBody,
        delivery_status: initialStatus,
        is_read: true,
        is_automated: body.automated === true,
        template_id: body.templateId ?? null,
        provider_message_id: providerMessage.sid,
        provider_status_raw: providerMessage,
        sent_at: providerMessage.dateCreated ? new Date(providerMessage.dateCreated).toISOString() : new Date().toISOString(),
        error_message: providerMessage.errorMessage ?? null,
        created_by: ctx.userId,
        updated_by: ctx.userId,
      })
      .select('*')
      .single()
    if (messageError || !insertedMessage) throw messageError

    const { data: updatedConversation, error: updateError } = await ctx.userClient
      .from('message_conversations')
      .update({
        appointment_id: resolvedTargets.appointmentId,
        last_message_preview: textBody.slice(0, 160),
        last_message_at: insertedMessage.created_at,
        last_message_direction: 'outbound',
        last_message_status: insertedMessage.delivery_status,
        updated_by: ctx.userId,
      })
      .eq('id', conversation.id)
      .eq('store_id', ctx.storeId)
      .select('*')
      .single()
    if (updateError || !updatedConversation) throw updateError

    if (resolvedTargets.appointmentId && (body.notificationType === 'manual_heads_up' || body.notificationType === 'ready_pickup')) {
      const { error: appointmentUpdateError } = await ctx.userClient
        .from('appointments')
        .update({
          client_notified_at: insertedMessage.sent_at,
          notification_type: body.notificationType,
        })
        .eq('id', resolvedTargets.appointmentId)
        .eq('store_id', ctx.storeId)
        .eq('client_id', conversation.client_id)
      if (appointmentUpdateError) throw appointmentUpdateError
    }

    const { data: updatedUsage, error: usageError } = await ctx.adminClient.rpc('increment_message_usage_cycle', {
      p_store_id: ctx.storeId,
    })
    if (usageError) throw usageError
    if (updatedUsage == null) console.warn('messages/send: no active usage cycle to increment', { storeId: ctx.storeId })

    return json({ conversation: updatedConversation, message: insertedMessage })
  }

  return json({ error: 'UNKNOWN_ACTION' }, 400)
}

async function handleInboundWebhook(req: Request) {
  const authToken = getEnv('TWILIO_AUTH_TOKEN')
  const signature = req.headers.get('x-twilio-signature') ?? undefined
  const url = new URL(req.url)
  const params = parseFormParams(await req.formData())
  const fullUrl = buildTwilioWebhookUrl(getWebhookBaseUrl(req), url.pathname.replace('/functions/v1', ''))
  if (!validateTwilioWebhookRequest({ authToken, signature, url: fullUrl, params })) {
    return json({ error: 'UNAUTHORIZED_WEBHOOK', message: 'Webhook authorization failed.' }, 401)
  }

  const toPhone = formatPhoneNumberE164(params.To)
  const fromPhone = String(params.From ?? '')
  if (!toPhone || !fromPhone) {
    return json({ error: 'VALIDATION_ERROR', message: 'Inbound payload is missing phone routing data.' }, 400)
  }

  const adminClient = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))
  const { data: sender, error: senderError } = await adminClient
    .from('message_sender_inventory')
    .select('store_id, phone_number')
    .eq('phone_number', toPhone)
    .eq('is_primary', true)
    .maybeSingle()
  if (senderError) throw senderError
  if (!sender) return json({ error: 'STORE_NOT_FOUND', message: 'Inbound number is not mapped to a salon.' }, 404)

  const { data: clientLookup, error: clientLookupError } = await adminClient.rpc('find_client_by_normalized_phone', {
    p_store_id: sender.store_id,
    p_phone: fromPhone,
  })
  if (clientLookupError) throw clientLookupError
  const matchedClientId = Array.isArray(clientLookup) && clientLookup[0]?.client_id ? String(clientLookup[0].client_id) : null
  if (!matchedClientId) {
    return json({ ok: true, ignored: true, reason: 'UNKNOWN_CLIENT_PHONE' }, 202)
  }

  const { data: existingMessages, error: existingError } = await adminClient
    .from('messages')
    .select('id')
    .eq('provider_message_id', params.MessageSid)
    .limit(1)
  if (existingError) throw existingError
  if ((existingMessages ?? []).length > 0) return json({ ok: true, duplicate: true })

  const { data: conversation, error: conversationError } = await adminClient
    .from('message_conversations')
    .select('appointment_id')
    .eq('store_id', sender.store_id)
    .eq('client_id', matchedClientId)
    .eq('channel', 'sms')
    .maybeSingle()
  if (conversationError) throw conversationError

  const { data, error } = await adminClient.rpc('record_inbound_message', {
    p_store_id: sender.store_id,
    p_client_id: matchedClientId,
    p_appointment_id: conversation?.appointment_id ?? null,
    p_body: String(params.Body ?? ''),
    p_provider_message_id: params.MessageSid ?? null,
    p_payload: params,
    p_sent_at: new Date().toISOString(),
  })
  if (error) throw error

  return json({ ok: true, result: data })
}

async function handleStatusWebhook(req: Request) {
  const authToken = getEnv('TWILIO_AUTH_TOKEN')
  const signature = req.headers.get('x-twilio-signature') ?? undefined
  const url = new URL(req.url)
  const params = parseFormParams(await req.formData())
  const fullUrl = buildTwilioWebhookUrl(getWebhookBaseUrl(req), url.pathname.replace('/functions/v1', ''))
  if (!validateTwilioWebhookRequest({ authToken, signature, url: fullUrl, params })) {
    return json({ error: 'UNAUTHORIZED_WEBHOOK', message: 'Webhook authorization failed.' }, 401)
  }

  const providerMessageId = params.MessageSid ?? params.SmsSid
  const rawStatus = params.MessageStatus ?? params.SmsStatus
  if (!providerMessageId || !rawStatus) {
    return json({ error: 'VALIDATION_ERROR', message: 'Twilio status payload is missing MessageSid or MessageStatus.' }, 400)
  }

  const normalizedStatus = normalizeProviderDeliveryStatus(String(rawStatus))
  if (!normalizedStatus) return json({ ok: true, ignored: true })

  const adminClient = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))
  const update: Record<string, unknown> = {
    delivery_status: normalizedStatus,
    provider_status_raw: params,
    error_message: params.ErrorMessage ?? null,
  }
  if (normalizedStatus === 'delivered') update.delivered_at = new Date().toISOString()
  if (normalizedStatus === 'sent') update.sent_at = new Date().toISOString()

  const { data: matchingRows, error: fetchError } = await adminClient
    .from('messages')
    .select('id, conversation_id')
    .eq('provider_message_id', providerMessageId)
  if (fetchError) throw fetchError

  if ((matchingRows ?? []).length === 0) return json({ ok: true, ignored: true, reason: 'MESSAGE_NOT_FOUND' })

  const rowIds = matchingRows.map((row) => row.id)
  const conversationIds = [...new Set(matchingRows.map((row) => row.conversation_id).filter(Boolean))]

  const { error: updateError } = await adminClient
    .from('messages')
    .update(update)
    .in('id', rowIds)
  if (updateError) throw updateError

  if (conversationIds.length > 0) {
    const { error: conversationUpdateError } = await adminClient
      .from('message_conversations')
      .update({ last_message_status: normalizedStatus })
      .in('id', conversationIds)
    if (conversationUpdateError) throw conversationUpdateError
  }

  return json({ ok: true, updatedCount: rowIds.length })
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
    const url = new URL(req.url)
    if (req.method === 'POST' && url.pathname.endsWith('/webhooks/inbound')) return await handleInboundWebhook(req)
    if (req.method === 'POST' && url.pathname.endsWith('/webhooks/status')) return await handleStatusWebhook(req)
    if (req.method === 'POST') return await handleAuthenticatedAction(req)
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  } catch (error) {
    console.error('twilio-messages edge function failed', error)
    const message = error instanceof Error ? error.message : 'Unhandled function error.'
    return json({ error: 'FUNCTION_FAILED', message }, 500)
  }
})
