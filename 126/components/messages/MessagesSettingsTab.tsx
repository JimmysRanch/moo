import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useBusinessSettings, useCreateBusinessSettings, useUpdateBusinessSettings } from '@/hooks/data/useBusinessSettings'
import { useMessageAutomations, useMessageProviderStatus, useMessageTemplates, useMessageUsageCycle, useRefreshMessageProvider, useSetupMessageProvider, useUpsertMessageAutomation, useUpsertMessageTemplate } from '@/hooks/data/useMessages'
import { resolveTemplateCategoryForSave } from '@/lib/messages'

type MessageSettings = {
  enabled: boolean
  business_number: string
  number_status: 'unconfigured' | 'pending' | 'active'
  usage: {
    monthly_included: number
    monthly_used: number
    billing_cycle_anchor: string | null
  }
  templates_enabled: boolean
  automations: Record<string, boolean>
  notifications: {
    play_sound: boolean
    desktop_alerts: boolean
    mark_unread_after_hours: number
  }
  compliance: {
    registration_status: 'pending' | 'in_review' | 'approved'
    opt_in_copy: string
    help_keyword_enabled: boolean
    stop_keyword_enabled: boolean
  }
  staff_permissions: {
    allow_all_staff: boolean
    require_assignment_for_reply: boolean
  }
}

type ProviderSetupForm = {
  businessName: string
  contactName: string
  email: string
  website: string
  areaCode: string
  optInWorkflow: string
  addressStreet: string
  addressCity: string
  addressState: string
  addressPostalCode: string
  addressCountry: string
}

const DEFAULT_SETTINGS: MessageSettings = {
  enabled: false,
  business_number: '',
  number_status: 'unconfigured',
  usage: { monthly_included: 500, monthly_used: 0, billing_cycle_anchor: null },
  templates_enabled: true,
  automations: {
    appointment_confirmation: true,
    appointment_reminder: true,
    ready_for_pickup: true,
    review_request: false,
    missed_call_auto_text: false,
  },
  notifications: { play_sound: true, desktop_alerts: true, mark_unread_after_hours: 12 },
  compliance: {
    registration_status: 'pending',
    opt_in_copy: 'By providing your number, you agree to receive appointment-related texts from our salon.',
    help_keyword_enabled: true,
    stop_keyword_enabled: true,
  },
  staff_permissions: { allow_all_staff: true, require_assignment_for_reply: false },
}

const DEFAULT_PROVIDER_FORM: ProviderSetupForm = {
  businessName: '',
  contactName: '',
  email: '',
  website: '',
  areaCode: '',
  optInWorkflow: '',
  addressStreet: '',
  addressCity: '',
  addressState: '',
  addressPostalCode: '',
  addressCountry: 'US',
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  provisioning: 'Provisioning',
  action_needed: 'Action needed',
  in_review: 'In review',
  active: 'Active',
  failed: 'Failed',
}

export function MessagesSettingsTab() {
  const { data: businessSettings } = useBusinessSettings()
  const createBusinessSettings = useCreateBusinessSettings()
  const updateBusinessSettings = useUpdateBusinessSettings()
  const { data: templates = [] } = useMessageTemplates()
  const { data: automations = [] } = useMessageAutomations()
  const { data: usageCycle } = useMessageUsageCycle()
  const { data: providerStatus } = useMessageProviderStatus()
  const setupProvider = useSetupMessageProvider()
  const refreshProvider = useRefreshMessageProvider()
  const upsertTemplate = useUpsertMessageTemplate()
  const upsertAutomation = useUpsertMessageAutomation()
  const [draftTemplateId, setDraftTemplateId] = useState<string | null>(null)
  const [draftTemplateName, setDraftTemplateName] = useState('')
  const [draftTemplateBody, setDraftTemplateBody] = useState('')
  const [draftTemplateCategory, setDraftTemplateCategory] = useState('custom')
  const [settings, setSettings] = useState<MessageSettings>(DEFAULT_SETTINGS)
  const [providerForm, setProviderForm] = useState<ProviderSetupForm>(DEFAULT_PROVIDER_FORM)

  useEffect(() => {
    const stored = businessSettings?.message_settings as MessageSettings | undefined
    const automationState = (automations.length > 0
      ? automations.reduce<Record<string, boolean>>((acc, automation) => {
          acc[automation.automation_key] = automation.is_enabled
          return acc
        }, {})
      : stored?.automations) ?? {}
    setSettings({
      ...DEFAULT_SETTINGS,
      ...stored,
      business_number: providerStatus?.sender?.phone_number ?? stored?.business_number ?? '',
      number_status: providerStatus?.readinessStatus === 'active' ? 'active' : providerStatus?.readinessStatus && providerStatus.readinessStatus !== 'not_started' ? 'pending' : (stored?.number_status ?? 'unconfigured'),
      usage: { ...DEFAULT_SETTINGS.usage, ...(stored?.usage ?? {}) },
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(stored?.notifications ?? {}) },
      compliance: {
        ...DEFAULT_SETTINGS.compliance,
        ...(stored?.compliance ?? {}),
        registration_status: providerStatus?.provider?.compliance_status === 'active'
          ? 'approved'
          : providerStatus?.provider?.compliance_status === 'in_review' || providerStatus?.readinessStatus === 'provisioning'
            ? 'in_review'
            : (stored?.compliance?.registration_status ?? 'pending'),
      },
      staff_permissions: { ...DEFAULT_SETTINGS.staff_permissions, ...(stored?.staff_permissions ?? {}) },
      automations: { ...DEFAULT_SETTINGS.automations, ...automationState },
    })
  }, [automations, businessSettings, providerStatus])

  useEffect(() => {
    const onboardingData = providerStatus?.provider?.onboarding_data as Partial<ProviderSetupForm & { address?: { street?: string; city?: string; state?: string; postalCode?: string; country?: string } }> | undefined
    setProviderForm({
      businessName: String(onboardingData?.businessName ?? businessSettings?.company_name ?? ''),
      contactName: String(onboardingData?.contactName ?? businessSettings?.company_name ?? ''),
      email: String(onboardingData?.email ?? businessSettings?.email ?? ''),
      website: String(onboardingData?.website ?? businessSettings?.address?.website ?? ''),
      areaCode: String(onboardingData?.areaCode ?? onboardingData?.requestedAreaCode ?? ''),
      optInWorkflow: String(onboardingData?.optInWorkflow ?? settings.compliance.opt_in_copy ?? ''),
      addressStreet: String(onboardingData?.address?.street ?? businessSettings?.address?.street ?? ''),
      addressCity: String(onboardingData?.address?.city ?? businessSettings?.address?.city ?? ''),
      addressState: String(onboardingData?.address?.state ?? businessSettings?.address?.state ?? ''),
      addressPostalCode: String(onboardingData?.address?.postalCode ?? businessSettings?.address?.zip ?? ''),
      addressCountry: String(onboardingData?.address?.country ?? businessSettings?.address?.country ?? 'US'),
    })
  }, [businessSettings, providerStatus?.provider?.onboarding_data, settings.compliance.opt_in_copy])

  const usage = useMemo(() => ({
    included: usageCycle?.included_credits ?? settings.usage.monthly_included,
    used: usageCycle?.used_credits ?? settings.usage.monthly_used,
    remaining: Math.max(0, (usageCycle?.included_credits ?? settings.usage.monthly_included) - (usageCycle?.used_credits ?? settings.usage.monthly_used)),
    cycle: usageCycle?.cycle_end ?? settings.usage.billing_cycle_anchor,
  }), [settings.usage, usageCycle])

  const providerReadiness = providerStatus?.readinessStatus ?? 'not_started'
  const providerNumber = providerStatus?.sender?.phone_number ?? settings.business_number
  const providerError = providerStatus?.provider?.last_error

  const persistSettings = () => {
    const payload = { message_settings: settings }
    if (businessSettings) {
      updateBusinessSettings.mutate({ updated_at: businessSettings.updated_at, ...payload }, {
        onSuccess: () => toast.success('Messages settings saved'),
        onError: () => toast.error('Failed to save Messages settings'),
      })
      return
    }
    createBusinessSettings.mutate({ timezone: 'America/New_York', tax_rate: 0, currency: 'USD', ...payload }, {
      onSuccess: () => toast.success('Messages settings saved'),
      onError: () => toast.error('Failed to save Messages settings'),
    })
  }

  const openTemplateEditor = (template?: { id: string; name: string; body: string; category: string }) => {
    setDraftTemplateId(template?.id ?? null)
    setDraftTemplateName(template?.name ?? '')
    setDraftTemplateBody(template?.body ?? '')
    setDraftTemplateCategory(template?.category ?? 'custom')
  }

  const saveTemplate = () => {
    if (!draftTemplateName.trim() || !draftTemplateBody.trim()) {
      toast.error('Template name and body are required')
      return
    }
    upsertTemplate.mutate({ id: draftTemplateId ?? undefined, name: draftTemplateName.trim(), category: resolveTemplateCategoryForSave(draftTemplateCategory), body: draftTemplateBody.trim() }, {
      onSuccess: () => {
        toast.success(draftTemplateId ? 'Template updated' : 'Template created')
        openTemplateEditor()
      },
      onError: () => toast.error('Failed to save template'),
    })
  }

  const syncAutomationSettings = (nextAutomations: Record<string, boolean>) => {
    const nextSettings = { ...settings, automations: nextAutomations }
    setSettings(nextSettings)
    if (!businessSettings) {
      createBusinessSettings.mutate({ timezone: 'America/New_York', tax_rate: 0, currency: 'USD', message_settings: nextSettings }, { onError: () => toast.error('Failed to sync Messages settings') })
      return
    }
    updateBusinessSettings.mutate({ updated_at: businessSettings.updated_at, message_settings: nextSettings }, { onError: () => toast.error('Failed to sync Messages settings') })
  }

  const toggleAutomation = (automationKey: string, isEnabled: boolean) => {
    const nextAutomations = { ...settings.automations, [automationKey]: isEnabled }
    syncAutomationSettings(nextAutomations)
    upsertAutomation.mutate({ automation_key: automationKey, is_enabled: isEnabled }, { onError: () => toast.error('Failed to update automation') })
  }

  const handleActivateTexting = () => {
    if (!providerForm.businessName.trim() || !providerForm.contactName.trim() || !providerForm.email.trim() || !providerForm.optInWorkflow.trim() || !providerForm.addressStreet.trim() || !providerForm.addressCity.trim() || !providerForm.addressState.trim() || !providerForm.addressPostalCode.trim() || !providerForm.addressCountry.trim()) {
      toast.error('Complete the business identity, opt-in, and mailing address fields before activating texting')
      return
    }
    setupProvider.mutate(providerForm, {
      onSuccess: () => toast.success(providerReadiness === 'active' ? 'Texting configuration refreshed' : 'Texting is being activated'),
      onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to activate texting'),
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="font-semibold">Messaging Status</h3>
          <p className="text-sm text-muted-foreground mt-1">Turn on two-way texting for your salon and keep message routing inside Scruffy Butts.</p>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Messaging enabled</p>
              <p className="text-xs text-muted-foreground">Staff can reply from the Messages tab once the salon number is active.</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(checked) => setSettings((current) => ({ ...current, enabled: checked }))} />
          </div>
          <div className="mt-4 rounded-xl border border-border px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">Salon texting readiness</span>
              <Badge variant={providerReadiness === 'active' ? 'default' : 'secondary'}>{STATUS_LABELS[providerReadiness] ?? providerReadiness}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{providerReadiness === 'active' ? 'This salon can send and receive live customer texts.' : 'Finish activation below before staff can send live customer texts.'}</p>
          </div>
          <Button className="mt-4 w-full" onClick={persistSettings}>Save Messages Settings</Button>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Business Number</h3>
              <p className="text-sm text-muted-foreground mt-1">This is the live number clients see once texting is activated.</p>
            </div>
            <Badge variant="secondary">{STATUS_LABELS[providerReadiness] ?? providerReadiness}</Badge>
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="messages-business-number">Salon texting number</Label>
            <Input id="messages-business-number" value={providerNumber} readOnly placeholder="Provisioned automatically during setup" />
            <p className="text-xs text-muted-foreground">The owner does not need a separate carrier dashboard. This number is provisioned and managed for the salon in-app.</p>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold">Usage & Credits</h3>
          <p className="text-sm text-muted-foreground mt-1">Keep an eye on included text volume for the current cycle.</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Stat label="Used" value={usage.used.toString()} />
            <Stat label="Remaining" value={usage.remaining.toString()} />
            <Stat label="Included" value={usage.included.toString()} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Billing cycle reference: {usage.cycle ?? 'Not set yet'}.</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Templates</h3>
              <p className="text-sm text-muted-foreground">Quick replies that feel like iPhone shortcuts, not campaigns.</p>
            </div>
            <Button variant="outline" onClick={() => openTemplateEditor()}>New Template</Button>
          </div>
          <div className="space-y-3">
            {templates.map((template) => (
              <button key={template.id} className="w-full rounded-xl border border-border p-3 text-left hover:border-primary/40" onClick={() => openTemplateEditor(template)}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{template.name}</span>
                  <Badge variant={template.is_system ? 'secondary' : 'outline'}>{template.category}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{template.body}</p>
              </button>
            ))}
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="message-template-name">Template name</Label>
            <Input id="message-template-name" value={draftTemplateName} onChange={(event) => setDraftTemplateName(event.target.value)} placeholder="Ready for pickup" />
            <Label htmlFor="message-template-body">Template body</Label>
            <Textarea id="message-template-body" rows={4} value={draftTemplateBody} onChange={(event) => setDraftTemplateBody(event.target.value)} placeholder="Hi {client_name}! {pet_name} is ready for pickup..." />
            <Button onClick={saveTemplate}>{draftTemplateId ? 'Update Template' : 'Save Template'}</Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Activate Texting</h3>
                <p className="text-sm text-muted-foreground">Collect the real business details needed to provision and keep the salon texting number ready.</p>
              </div>
              <Badge variant={providerReadiness === 'active' ? 'default' : 'secondary'}>{STATUS_LABELS[providerReadiness] ?? providerReadiness}</Badge>
            </div>
            {providerError ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{providerError}</p> : null}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Business name"><Input value={providerForm.businessName} onChange={(event) => setProviderForm((current) => ({ ...current, businessName: event.target.value }))} /></Field>
              <Field label="Contact name"><Input value={providerForm.contactName} onChange={(event) => setProviderForm((current) => ({ ...current, contactName: event.target.value }))} /></Field>
              <Field label="Contact email"><Input type="email" value={providerForm.email} onChange={(event) => setProviderForm((current) => ({ ...current, email: event.target.value }))} /></Field>
              <Field label="Business website"><Input value={providerForm.website} onChange={(event) => setProviderForm((current) => ({ ...current, website: event.target.value }))} placeholder="https://" /></Field>
              <Field label="Preferred area code"><Input value={providerForm.areaCode} onChange={(event) => setProviderForm((current) => ({ ...current, areaCode: event.target.value }))} placeholder="212" /></Field>
              <Field label="Country"><Input value={providerForm.addressCountry} onChange={(event) => setProviderForm((current) => ({ ...current, addressCountry: event.target.value }))} /></Field>
            </div>
            <Field label="Opt-in language shown to customers"><Textarea rows={3} value={providerForm.optInWorkflow} onChange={(event) => setProviderForm((current) => ({ ...current, optInWorkflow: event.target.value }))} /></Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Street address"><Input value={providerForm.addressStreet} onChange={(event) => setProviderForm((current) => ({ ...current, addressStreet: event.target.value }))} /></Field>
              <Field label="City"><Input value={providerForm.addressCity} onChange={(event) => setProviderForm((current) => ({ ...current, addressCity: event.target.value }))} /></Field>
              <Field label="State"><Input value={providerForm.addressState} onChange={(event) => setProviderForm((current) => ({ ...current, addressState: event.target.value }))} /></Field>
              <Field label="Postal code"><Input value={providerForm.addressPostalCode} onChange={(event) => setProviderForm((current) => ({ ...current, addressPostalCode: event.target.value }))} /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleActivateTexting} disabled={setupProvider.isPending}>{providerReadiness === 'active' ? 'Refresh Configuration' : providerReadiness === 'failed' || providerReadiness === 'action_needed' ? 'Retry Activation' : 'Activate Texting'}</Button>
              <Button variant="outline" onClick={() => refreshProvider.mutate(undefined, { onError: () => toast.error('Unable to refresh texting status') })} disabled={refreshProvider.isPending}>Refresh Status</Button>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Automations</h3>
              <p className="text-sm text-muted-foreground">Keep the common grooming touchpoints on autopilot.</p>
            </div>
            {[
              ['appointment_confirmation', 'Appointment confirmation'],
              ['appointment_reminder', 'Appointment reminder'],
              ['ready_for_pickup', 'Ready for pickup'],
              ['review_request', 'Review request'],
              ['missed_call_auto_text', 'Missed-call auto-text'],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{automations.find((entry) => entry.automation_key === key)?.send_offset_minutes ?? 0} minute offset.</p>
                </div>
                <Switch checked={settings.automations[key] ?? false} onCheckedChange={(checked) => toggleAutomation(key, checked)} />
              </div>
            ))}
          </Card>

          <Card className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-sm text-muted-foreground">Choose how staff hears about new client texts.</p>
            </div>
            <ToggleRow label="Play sound for new inbound texts" checked={settings.notifications.play_sound} onCheckedChange={(checked) => setSettings((current) => ({ ...current, notifications: { ...current.notifications, play_sound: checked } }))} />
            <ToggleRow label="Desktop alerts" checked={settings.notifications.desktop_alerts} onCheckedChange={(checked) => setSettings((current) => ({ ...current, notifications: { ...current.notifications, desktop_alerts: checked } }))} />
          </Card>

          <Card className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Compliance / Registration</h3>
              <p className="text-sm text-muted-foreground">Show the owner the live texting readiness state without exposing provider tooling.</p>
            </div>
            <div className="flex items-center justify-between"><span className="text-sm font-medium">Registration</span><Badge variant="secondary">{STATUS_LABELS[providerStatus?.provider?.compliance_status ?? providerReadiness] ?? providerReadiness}</Badge></div>
            <Textarea rows={3} value={settings.compliance.opt_in_copy} onChange={(event) => setSettings((current) => ({ ...current, compliance: { ...current.compliance, opt_in_copy: event.target.value } }))} />
          </Card>

          <Card className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Staff Access / Permissions</h3>
              <p className="text-sm text-muted-foreground">Simple controls for who can reply and how assignment should work.</p>
            </div>
            <ToggleRow label="All staff can reply" checked={settings.staff_permissions.allow_all_staff} onCheckedChange={(checked) => setSettings((current) => ({ ...current, staff_permissions: { ...current.staff_permissions, allow_all_staff: checked } }))} />
            <ToggleRow label="Require assignment before reply" checked={settings.staff_permissions.require_assignment_for_reply} onCheckedChange={(checked) => setSettings((current) => ({ ...current, staff_permissions: { ...current.staff_permissions, require_assignment_for_reply: checked } }))} />
          </Card>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

function ToggleRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}
