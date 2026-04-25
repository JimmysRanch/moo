import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, isToday, isYesterday } from 'date-fns'
import { ArrowLeft, CheckCircle, Clock, MagnifyingGlass, PaperPlaneTilt, Phone, Sparkle, WarningCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { useClients, useAllPets } from '@/hooks/data/useClients'
import { useAppointments } from '@/hooks/data/useAppointments'
import { useStaff } from '@/hooks/data/useStaff'
import { useAuth } from '@/contexts/AuthContext'
import { useConversationMessageFlags, useConversationMessages, useMarkConversationRead, useMessageConversations, useMessageStats, useMessageTemplates, useSendMessage } from '@/hooks/data/useMessages'
import { getPhoneDigits } from '@/utils/phone'
import { matchesMessagesFilter } from '@/lib/messages'

const FILTERS = ['All', 'Unread', 'Assigned to Me', 'Automated', 'Failed', 'Archived'] as const
const QUICK_ACTIONS = [
  { label: 'Confirm', templateHint: 'confirmation' },
  { label: 'Running Late', templateHint: 'running_late' },
  { label: 'Ready for Pickup', templateHint: 'pickup' },
  { label: 'Reschedule', templateHint: 'rebooking' },
]

export function Messages() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const { data: conversations = [], isPending: isConversationsLoading, isError } = useMessageConversations()
  const { data: clients = [] } = useClients()
  const { data: pets = [] } = useAllPets()
  const { data: appointments = [] } = useAppointments()
  const { data: staff = [] } = useStaff()
  const { data: templates = [] } = useMessageTemplates()
  const { data: conversationFlags = new Map() } = useConversationMessageFlags()
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('All')
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '')
  const [composerValue, setComposerValue] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const clientId = searchParams.get('clientId') ?? undefined
  const appointmentId = searchParams.get('appointmentId') ?? undefined
  const notificationType = (searchParams.get('notificationType') as 'manual_heads_up' | 'ready_pickup' | null) ?? undefined
  const selectedConversationId = searchParams.get('conversationId') ?? undefined
  const selectedServerConversationId = selectedConversationId?.startsWith('draft-') ? undefined : selectedConversationId
  const { data: threadMessages = [], isPending: isThreadLoading } = useConversationMessages(selectedServerConversationId)
  const sendMessage = useSendMessage()
  const markRead = useMarkConversationRead()
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients])
  const petMap = useMemo(() => new Map(pets.map((pet) => [pet.id, pet])), [pets])
  const appointmentMap = useMemo(() => new Map(appointments.map((appointment) => [appointment.id, appointment])), [appointments])
  const staffMap = useMemo(() => new Map(staff.map((member) => [member.id, `${member.first_name} ${member.last_name}`.trim()])), [staff])

  const allThreadMessages = useMemo(() => threadMessages, [threadMessages])
  const showThreadLoading = isThreadLoading && !!selectedServerConversationId
  const currentStaffId = useMemo(() => (staff.find((member) => member.user_id === user?.id)?.id ?? null), [staff, user?.id])
  const stats = useMessageStats(conversations, conversationFlags, currentStaffId)

  const enrichedConversations = useMemo(() => conversations.map((conversation) => {
    const client = clientMap.get(conversation.client_id)
    const appointment = conversation.appointment_id ? appointmentMap.get(conversation.appointment_id) : undefined
    const pet = appointment?.pet_id ? petMap.get(appointment.pet_id) : undefined
    return {
      ...conversation,
      clientName: `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim() || 'Unknown client',
      clientPhone: client?.phone ?? '',
      petName: pet?.name ?? '',
      appointment,
      assignedStaffName: conversation.assigned_staff_id ? staffMap.get(conversation.assigned_staff_id) : undefined,
    }
  }), [appointmentMap, clientMap, conversations, petMap, staffMap])

  const fallbackConversation = useMemo(() => {
    if (!clientId || selectedConversationId?.startsWith('draft-') || enrichedConversations.some((conversation) => conversation.client_id === clientId)) return null
    const client = clientMap.get(clientId)
    if (!client) return null
    const appointment = appointmentId ? appointmentMap.get(appointmentId) : undefined
    const pet = appointment?.pet_id ? petMap.get(appointment.pet_id) : undefined
    return {
      id: 'draft',
      client_id: clientId,
      appointment_id: appointment?.id ?? null,
      unread_count: 0,
      status: 'active' as const,
      last_message_preview: null,
      last_message_at: null,
      clientName: `${client.first_name} ${client.last_name}`.trim(),
      clientPhone: client.phone ?? '',
      petName: pet?.name ?? '',
      appointment,
      assignedStaffName: undefined,
    }
  }, [appointmentId, appointmentMap, clientId, clientMap, enrichedConversations, petMap, selectedConversationId])

  const searchableConversations = fallbackConversation ? [fallbackConversation, ...enrichedConversations] : enrichedConversations
  const searchQueryParam = searchParams.get('q') ?? ''
  useEffect(() => {
    setSearchQuery(searchQueryParam)
  }, [searchQueryParam])

  const search = searchQuery.trim()
  const normalizedSearch = search.toLowerCase()
  const phoneSearch = getPhoneDigits(search)
  const existingConversationClientIds = useMemo(() => new Set(enrichedConversations.map((conversation) => conversation.client_id)), [enrichedConversations])

  const draftClientConversations = useMemo(() => {
    if (!search) return []
    return clients
      .filter((client) => !existingConversationClientIds.has(client.id))
      .map((client) => ({
        id: `draft-${client.id}`,
        client_id: client.id,
        appointment_id: null,
        unread_count: 0,
        status: 'active' as const,
        last_message_preview: null,
        last_message_at: null,
        clientName: `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Unknown client',
        clientPhone: client.phone ?? '',
        petName: '',
        appointment: undefined,
        assignedStaffName: undefined,
      }))
      .filter((conversation) => {
        return conversation.clientName.toLowerCase().includes(normalizedSearch)
          || (phoneSearch && getPhoneDigits(conversation.clientPhone ?? '').includes(phoneSearch))
      })
  }, [clients, existingConversationClientIds, normalizedSearch, phoneSearch, search])

  const searchableItems = [...searchableConversations, ...draftClientConversations]

  const filteredConversations = searchableItems.filter((conversation) => {
    const matchesSearch = !search || conversation.clientName.toLowerCase().includes(normalizedSearch) || conversation.petName.toLowerCase().includes(normalizedSearch) || conversation.last_message_preview?.toLowerCase().includes(normalizedSearch) || (phoneSearch && getPhoneDigits(conversation.clientPhone ?? '').includes(phoneSearch))
    if (!matchesSearch) return false
    switch (activeFilter) {
      case 'Unread': return conversation.unread_count > 0
      default: return matchesMessagesFilter(activeFilter, conversation, conversationFlags, currentStaffId)
    }
  })

  const activeConversation = filteredConversations.find((conversation) => conversation.id === selectedConversationId)
    ?? enrichedConversations.find((conversation) => conversation.id === selectedConversationId)
    ?? draftClientConversations.find((conversation) => conversation.id === selectedConversationId)
    ?? fallbackConversation
    ?? filteredConversations[0]
    ?? null

  useEffect(() => {
    if (activeConversation && !activeConversation.id.startsWith('draft') && activeConversation.id !== selectedConversationId) {
      const next = new URLSearchParams(searchParams)
      next.set('conversationId', activeConversation.id)
      setSearchParams(next, { replace: true })
    }
  }, [activeConversation, searchParams, selectedConversationId, setSearchParams])

  useEffect(() => {
    if (activeConversation?.id && activeConversation.id !== 'draft' && activeConversation.unread_count > 0) {
      markRead.mutate(activeConversation.id)
    }
  }, [activeConversation?.id, activeConversation?.unread_count, markRead])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [allThreadMessages.length, activeConversation?.id])

  const appointmentContext = activeConversation?.appointment_id ? appointmentMap.get(activeConversation.appointment_id) : appointmentId ? appointmentMap.get(appointmentId) : undefined

  const insertTemplate = (templateIdOrCategory: string) => {
    const template = templates.find((entry) => entry.id === templateIdOrCategory || entry.category === templateIdOrCategory)
    if (!template) return
    const client = activeConversation ? clientMap.get(activeConversation.client_id) : clientId ? clientMap.get(clientId) : undefined
    const pet = appointmentContext?.pet_id ? petMap.get(appointmentContext.pet_id) : undefined
    const body = template.body
      .replaceAll('{client_name}', `${client?.first_name ?? ''}`.trim() || 'there')
      .replaceAll('{pet_name}', pet?.name ?? 'your pup')
      .replaceAll('{appointment_date}', appointmentContext?.date ?? 'your appointment')
      .replaceAll('{appointment_time}', appointmentContext?.start_time ?? '')
      .replaceAll('{business_name}', 'Scruffy Butts')
    setComposerValue(body)
    setTemplateOpen(false)
  }

  const handleSend = () => {
    const resolvedClientId = activeConversation?.client_id ?? clientId
    if (!resolvedClientId || !composerValue.trim()) return
    const isDraftConversation = activeConversation?.id.startsWith('draft')
    sendMessage.mutate({ clientId: resolvedClientId, conversationId: isDraftConversation ? undefined : activeConversation?.id, appointmentId: activeConversation?.appointment_id ?? appointmentId, body: composerValue.trim(), notificationType }, {
      onSuccess: ({ conversation }) => {
        setComposerValue('')
        const next = new URLSearchParams(searchParams)
        next.set('conversationId', conversation.id)
        next.set('clientId', conversation.client_id)
        if (conversation.appointment_id) next.set('appointmentId', conversation.appointment_id)
        next.delete('notificationType')
        setSearchParams(next)
      },
    })
  }

  const templatePicker = isMobile ? (
    <Drawer open={templateOpen} onOpenChange={setTemplateOpen}>
      <DrawerTrigger asChild><Button variant="outline" size="sm"><Sparkle size={16} className="mr-2" />Templates</Button></DrawerTrigger>
      <DrawerContent><DrawerHeader><DrawerTitle>Quick replies</DrawerTitle></DrawerHeader><TemplateList templates={templates} onChoose={insertTemplate} /></DrawerContent>
    </Drawer>
  ) : (
    <Sheet open={templateOpen} onOpenChange={setTemplateOpen}>
      <SheetTrigger asChild><Button variant="outline" size="sm"><Sparkle size={16} className="mr-2" />Templates</Button></SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md"><SheetHeader><SheetTitle>Quick replies</SheetTitle></SheetHeader><TemplateList templates={templates} onChoose={insertTemplate} /></SheetContent>
    </Sheet>
  )

  const listPane = (
    <Card className="flex h-full min-h-[70vh] flex-col overflow-hidden rounded-[28px] border-border/70 bg-card/95 shadow-sm">
      <div className="border-b border-border/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          </div>
          <Badge variant="secondary">{stats.unread} unread</Badge>
        </div>
        <div className="relative mt-4">
          <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => {
              const value = event.target.value
              const trimmedValue = value.trim()
              setSearchQuery(value)
              const next = new URLSearchParams(searchParams)
              if (trimmedValue) next.set('q', trimmedValue)
              else next.delete('q')
              setSearchParams(next, { replace: true })
            }}
            className="rounded-2xl pl-10"
            placeholder="Search client, pet, phone, or message"
          />
        </div>
        <div className="mt-4 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {FILTERS.map((filter) => (
              <Button key={filter} variant={filter === activeFilter ? 'default' : 'outline'} size="sm" className="rounded-full" onClick={() => setActiveFilter(filter)}>
                {filter}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {isConversationsLoading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="rounded-2xl p-3"><Skeleton className="h-20 rounded-2xl" /></div>) : filteredConversations.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No conversations match this filter yet.</div> : filteredConversations.map((conversation) => (
            <button key={conversation.id} className={`w-full rounded-2xl p-3 text-left transition ${activeConversation?.id === conversation.id ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-muted/70'}`} onClick={() => { const next = new URLSearchParams(searchParams); next.set('conversationId', conversation.id); next.set('clientId', conversation.client_id); if (conversation.appointment_id) next.set('appointmentId', conversation.appointment_id); else next.delete('appointmentId'); if (isMobile) navigate(`/messages?${next.toString()}`); else setSearchParams(next) }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><p className="truncate font-medium">{conversation.clientName}</p>{conversation.unread_count > 0 ? <span className="size-2 rounded-full bg-primary" /> : null}</div>
                  <p className="truncate text-sm text-muted-foreground">{conversation.petName ? `${conversation.petName} · ` : ''}{conversation.last_message_preview ?? 'Start the conversation'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{conversation.assignedStaffName ? `Assigned to ${conversation.assignedStaffName}` : conversation.clientPhone || 'No phone on file'}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{formatThreadTimestamp(conversation.last_message_at)}</p>
                  {conversation.unread_count > 0 ? <Badge className="mt-2 rounded-full">{conversation.unread_count}</Badge> : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  )

  const threadPane = (
    <Card className="flex h-full min-h-[70vh] flex-col overflow-hidden rounded-[28px] border-border/70 bg-card/95 shadow-sm">
      {activeConversation ? <>
        <div className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-3">
            {isMobile ? <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/messages')}><ArrowLeft size={20} /></Button> : null}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold">{activeConversation.clientName}</h2>
              <p className="truncate text-sm text-muted-foreground">{activeConversation.petName ? `${activeConversation.petName} · ` : ''}{activeConversation.clientPhone || 'No phone on file'}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${activeConversation.client_id}`)}>Client</Button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_280px]">
          <div className="flex min-h-0 flex-col">
            <ScrollArea className="flex-1 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.06),transparent_36%)] px-3 py-4 sm:px-5">
              {showThreadLoading ? <div className="space-y-4">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-3/4 rounded-[22px]" />)}</div> : allThreadMessages.length === 0 ? <EmptyThread /> : <div className="space-y-2">{allThreadMessages.map((message, index) => <MessageBubble key={message.id} message={message} previousDirection={allThreadMessages[index - 1]?.direction} />)}<div ref={bottomRef} /></div>}
            </ScrollArea>
            <div className="border-t border-border/60 bg-card px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 sm:px-5">
              {notificationType ? (
                <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  This send will mark the appointment as {notificationType === 'ready_pickup' ? 'ready for pickup' : 'manually notified'} only after the message is actually sent.
                </div>
              ) : null}
              <div className="mb-2 flex flex-wrap gap-2">{QUICK_ACTIONS.map((action) => <Button key={action.label} variant="secondary" size="sm" className="rounded-full" onClick={() => insertTemplate(action.templateHint)}>{action.label}</Button>)}{templatePicker}</div>
              <div className="rounded-[26px] border border-border bg-background p-2 shadow-sm">
                <Textarea value={composerValue} onChange={(event) => setComposerValue(event.target.value)} rows={1} placeholder="iMessage-style quick note to the client…" className="max-h-40 min-h-[44px] resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0" />
                <div className="mt-2 flex items-center justify-between">
                  <p className="px-2 text-xs text-muted-foreground">SMS first. Media-ready scaffolding can be added without changing this thread model.</p>
                  <Button className="rounded-full" onClick={handleSend} disabled={sendMessage.isPending || !composerValue.trim()}><PaperPlaneTilt size={16} className="mr-2" />{notificationType ? 'Send Notification' : 'Send'}</Button>
                </div>
              </div>
            </div>
          </div>
          {!isMobile ? <aside className="hidden border-l border-border/60 bg-muted/20 p-4 lg:block"><ContextPanel conversation={activeConversation} appointment={appointmentContext} /></aside> : null}
        </div>
      </> : <div className="flex flex-1 items-center justify-center p-8"><div className="max-w-sm text-center"><h2 className="text-xl font-semibold">No conversation selected</h2><p className="mt-2 text-sm text-muted-foreground">Open a client thread from the left, or jump in from a client or appointment screen.</p></div></div>}
    </Card>
  )

  if (isError) {
    return <div className="min-h-full p-6"><Card className="mx-auto max-w-xl p-8 text-center"><WarningCircle size={32} className="mx-auto text-destructive" /><h1 className="mt-4 text-xl font-semibold">Messages couldn’t load</h1><p className="mt-2 text-sm text-muted-foreground">Please refresh or check your connection to the backend and Supabase tables.</p></Card></div>
  }

  return <div className="min-h-full bg-background p-3 sm:p-6"><div className="mx-auto max-w-[1600px]">{isMobile && selectedConversationId ? threadPane : <div className="grid gap-4 lg:grid-cols-[360px_1fr]">{listPane}{threadPane}</div>}</div></div>
}

function TemplateList({ templates, onChoose }: { templates: Array<{ id: string; name: string; body: string; category: string }>; onChoose: (id: string) => void }) {
  return (
    <ScrollArea className="mt-4 h-[70vh] pr-2">
      <div className="space-y-3 pb-4">
        {templates.map((template) => <button key={template.id} className="w-full rounded-2xl border border-border p-3 text-left hover:border-primary/40" onClick={() => onChoose(template.id)}><div className="flex items-center justify-between gap-3"><p className="font-medium">{template.name}</p><Badge variant="outline">{template.category}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{template.body}</p></button>)}
      </div>
    </ScrollArea>
  )
}

function ContextPanel({ conversation, appointment }: { conversation: { clientName: string; clientPhone?: string; petName?: string; assignedStaffName?: string }; appointment?: { date: string; start_time: string; status: string } }) {
  return <div className="space-y-4"><section><h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Client</h3><div className="mt-2 rounded-2xl border border-border bg-background p-3"><p className="font-medium">{conversation.clientName}</p><p className="mt-1 text-sm text-muted-foreground flex items-center gap-2"><Phone size={14} />{conversation.clientPhone || 'No phone on file'}</p></div></section><section><h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Appointment</h3><div className="mt-2 rounded-2xl border border-border bg-background p-3 text-sm">{appointment ? <><p className="font-medium">{appointment.date} at {appointment.start_time}</p><p className="mt-1 text-muted-foreground">Status: {appointment.status.replace('_', ' ')}</p></> : <p className="text-muted-foreground">No appointment linked yet.</p>}</div></section><section><h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Workflow</h3><div className="mt-2 rounded-2xl border border-border bg-background p-3 text-sm text-muted-foreground">{conversation.petName ? `${conversation.petName} is attached to this conversation.` : 'Pet context will appear once an appointment is linked.'}<br />{conversation.assignedStaffName ? `Assigned to ${conversation.assignedStaffName}.` : 'Conversation is unassigned.'}</div></section></div>
}

function EmptyThread() { return <div className="flex min-h-[40vh] items-center justify-center"><div className="max-w-sm text-center"><CheckCircle size={32} className="mx-auto text-primary/80" /><h3 className="mt-4 text-lg font-semibold">Start the conversation</h3><p className="mt-2 text-sm text-muted-foreground">Use a quick reply for confirmations, running late updates, pickup notices, or rescheduling.</p></div></div> }

function MessageBubble({ message, previousDirection }: { message: { direction: string; body: string; created_at: string; delivery_status: string }; previousDirection?: string }) {
  if (message.direction === 'system') {
    return <div className="py-2 text-center text-xs text-muted-foreground">{message.body}</div>
  }
  const incoming = message.direction === 'inbound'
  return <div className={`flex ${incoming ? 'justify-start' : 'justify-end'} ${previousDirection === message.direction ? 'pt-1' : 'pt-3'}`}><div className={`max-w-[80%] rounded-[24px] px-4 py-2 text-sm shadow-sm ${incoming ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'}`}><p className="whitespace-pre-wrap">{message.body}</p><div className={`mt-1 flex items-center gap-1 text-[11px] ${incoming ? 'text-muted-foreground' : 'text-primary-foreground/80'}`}>{message.direction === 'outbound' && message.delivery_status !== 'received' ? <Clock size={10} /> : null}<span>{format(new Date(message.created_at), 'p')}</span>{message.direction === 'outbound' ? <span>· {message.delivery_status}</span> : null}</div></div></div>
}

function formatThreadTimestamp(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (isToday(date)) return format(date, 'p')
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d')
}
