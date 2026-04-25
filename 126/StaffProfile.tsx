import { ArrowLeft, PencilSimple, Phone, Envelope, PawPrint, MapPin, User } from "@phosphor-icons/react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { StatWidget } from "@/components/StatWidget"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useCallback, useMemo, useState } from "react"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import { StaffScheduleView } from "@/components/StaffScheduleView"
import { StaffPayrollDetail } from "@/components/StaffPayrollDetail"
import { StaffPerformanceView } from "@/components/StaffPerformanceView"
import { AppointmentDetailsDialog } from "@/components/appointments/AppointmentDetailsDialog"
import { PageLoadingState } from "@/components/PageLoadingState"
import { useIsMobile } from "@/hooks/use-mobile"
import { buildPerformanceData } from "@/lib/performance-utils"
import { Appointment } from "@/lib/types"
import { useStaff } from "@/hooks/data/useStaff"
import { useAppointments } from "@/hooks/data/useAppointments"
import { useClients } from "@/hooks/data/useClients"
import { useAppointmentCheckoutMap } from "@/hooks/useAppointmentCheckout"
import { staffListFromDb } from "@/lib/mappers/staffMapper"
import { appointmentFromDb } from "@/lib/mappers/appointmentMapper"
import { clientFromDb } from "@/lib/mappers/clientMapper"
import { useCreateStaffInvite } from "@/hooks/data/useStaffExtensions"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getActivityDescription, getActorLabel, humanizeTableName, titleCaseWords, type AuditLogEntry, useRecentActivity } from "@/hooks/data/useRecentActivity"

type StaffAppointmentSummary = {
  id: string
  client: string
  pet: string
  service: string
  date: string
  time: string
  duration?: string
  status?: string
  cost?: string
  tip?: string
  rating?: number
  notes?: string
}

type StaffProfileDetail = {
  name: string
  role: string
  email: string
  phone: string
  address: string
  emergencyContact: {
    name: string
    relation: string
    phone: string
  }
  hireDate: string
  status: "Active" | "On Leave" | "Inactive"
  hourlyRate: number
  specialties: string[]
  stats: {
    totalAppointments: number
    revenue: string
    avgTip: string
    noShows: number
    lateArrivals: number
  }
  upcomingAppointments: StaffAppointmentSummary[]
  recentAppointments: StaffAppointmentSummary[]
}

const AUDIT_FIELDS_TO_HIDE = new Set(['created_at', 'updated_at'])
type HistoryFilter = 'all' | 'appointments' | 'staff' | 'other'

function humanizeAuditField(field: string) {
  const specialCases: Record<string, string> = {
    client_id: 'Client',
    groomer_id: 'Groomer',
    pet_id: 'Pet',
    staff_id: 'Staff member',
    total_price: 'Total price',
    tip_amount: 'Tip amount',
    start_time: 'Start time',
    end_time: 'End time',
    checked_in_at: 'Checked in at',
    in_progress_at: 'In progress at',
    ready_at: 'Ready at',
    picked_up_at: 'Picked up at',
    client_notified_at: 'Client notified at',
    notification_type: 'Notification type',
    first_name: 'First name',
    last_name: 'Last name',
    hourly_rate: 'Hourly rate',
    hire_date: 'Hire date',
    is_late: 'Marked late',
    is_groomer: 'Groomer access',
    can_take_appointments: 'Can take appointments',
    emergency_contact_name: 'Emergency contact name',
    emergency_contact_relation: 'Emergency contact relation',
    emergency_contact_phone: 'Emergency contact phone',
  }

  return specialCases[field] ?? titleCaseWords(field)
}

function formatAuditValue(
  field: string,
  value: unknown,
  relatedNames: {
    staffById: Map<string, string>
    staffByUserId: Map<string, string>
    clientsById: Map<string, string>
  }
) {
  if (value == null || value === '') return '—'

  if (typeof value === 'string') {
    if (field === 'status' || field === 'notification_type') return titleCaseWords(value)
    if (field === 'groomer_id' || field === 'staff_id') return relatedNames.staffById.get(value) ?? value
    if (field === 'client_id') return relatedNames.clientsById.get(value) ?? value
    if (field === 'actor_id' || field === 'user_id' || field === 'created_by' || field === 'updated_by') {
      return relatedNames.staffByUserId.get(value) ?? value
    }

    return value
  }

  if (typeof value === 'number') {
    return field.includes('price') || field.includes('amount') || field.includes('rate')
      ? `$${value.toFixed(2)}`
      : String(value)
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No'

  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((item) => formatAuditValue(field, item, relatedNames)).join(', ') : '—'
  }

  return JSON.stringify(value)
}

function rowReferencesStaff(
  row: Record<string, unknown> | null | undefined,
  staffId: string | undefined,
  staffUserId: string | undefined,
) {
  if (!row || !staffId) return false

  return (
    row.id === staffId ||
    row.staff_id === staffId ||
    row.groomer_id === staffId ||
    (!!staffUserId && (
      row.user_id === staffUserId ||
      row.created_by === staffUserId ||
      row.updated_by === staffUserId
    ))
  )
}

function auditEntryMatchesStaff(
  entry: AuditLogEntry,
  staffId: string | undefined,
  staffUserId: string | undefined,
) {
  if (!staffId) return false

  return (
    (entry.table_name === 'staff' && entry.record_id === staffId) ||
    (!!staffUserId && entry.actor_id === staffUserId) ||
    rowReferencesStaff(entry.old_row, staffId, staffUserId) ||
    rowReferencesStaff(entry.new_row, staffId, staffUserId)
  )
}

export function StaffProfile() {
  const navigate = useNavigate()
  const { staffId } = useParams()

  const { data: dbStaff, isPending: isStaffLoading } = useStaff()
  const staffMembers = useMemo(() => staffListFromDb(dbStaff ?? []), [dbStaff])

  const { data: dbAppointments } = useAppointments()
  const appointments = useMemo(
    () => (dbAppointments ?? []).map(a => appointmentFromDb(a)),
    [dbAppointments]
  )

  const checkoutByAppointmentId = useAppointmentCheckoutMap()

  const { data: dbClients } = useClients()
  const clients = useMemo(
    () => (dbClients ?? []).map(c => clientFromDb(c)),
    [dbClients]
  )
  const { data: auditLog, isPending: isHistoryLoading } = useRecentActivity()
  const staffFromList = (staffMembers || []).find((member) => member.id === staffId)
  const dbStaffRecord = (dbStaff ?? []).find((s) => s.id === staffId)
  const isNoLoginStaff = !dbStaffRecord?.user_id
  const [enableLoginDialogOpen, setEnableLoginDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [historySearch, setHistorySearch] = useState('')
  const createInvite = useCreateStaffInvite()

  const handleSendLoginInvite = () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    setSendingInvite(true)
    const staffRole = dbStaffRecord?.role?.toLowerCase() ?? 'front_desk'
    const mappedRole = (['manager', 'groomer', 'front_desk', 'bather'].includes(staffRole) ? staffRole : 'front_desk') as 'manager' | 'groomer' | 'front_desk' | 'bather'
    createInvite.mutate(
      {
        email: inviteEmail,
        role: mappedRole,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          toast.success(`Invitation sent to ${inviteEmail}`, {
            description: 'The staff member will receive an email to enable login.'
          })
          setEnableLoginDialogOpen(false)
          setSendingInvite(false)
          setInviteEmail('')
        },
        onError: () => {
          toast.error('Failed to send invitation')
          setSendingInvite(false)
        }
      }
    )
  }

  const staff = useMemo<StaffProfileDetail | null>(() => {
    if (!staffFromList) return null

    const formattedAddress = [
      staffFromList.address?.street,
      staffFromList.address?.city,
      staffFromList.address?.state,
      staffFromList.address?.zip,
    ]
      .filter(Boolean)
      .join(', ')

    return {
      name: staffFromList.name,
      role: staffFromList.role,
      email: staffFromList.email,
      phone: staffFromList.phone,
      address: formattedAddress || "—",
      emergencyContact: {
        name: staffFromList.emergencyContact?.name || "—",
        relation: staffFromList.emergencyContact?.relation || "—",
        phone: staffFromList.emergencyContact?.phone || "—"
      },
      hireDate: staffFromList.hireDate ?? "—",
      status: staffFromList.status ?? "Active",
      hourlyRate: Number(staffFromList.hourlyRate) || 0,
      specialties: staffFromList.specialties ?? [],
      stats: {
        totalAppointments: staffFromList.totalAppointments ?? 0,
        revenue: "$0",
        avgTip: "$0",
        noShows: 0,
        lateArrivals: 0
      },
      upcomingAppointments: [],
      recentAppointments: []
    }
  }, [staffFromList])
  const [activeTab, setActiveTab] = useState("overview")
  const isMobile = useIsMobile()
  const [selectedFullAppointmentId, setSelectedFullAppointmentId] = useState<string | null>(null)
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false)
  const groomerPerformanceData = useMemo(
    () =>
      buildPerformanceData({
        appointments: appointments || [],
        clients: clients || [],
        staffId,
      }),
    [appointments, clients, staffId]
  )
  const staffAppointments = useMemo(
    () => (appointments || []).filter((appointment) => appointment.groomerId === staffId),
    [appointments, staffId]
  )
  const selectedFullAppointment = staffAppointments.find(a => a.id === selectedFullAppointmentId) ?? null
  const requestedAppointments = staffAppointments.filter((appointment) => appointment.groomerRequested).length
  const completedRevenue = staffAppointments
    .filter((appointment) => appointment.status === "picked_up")
    .reduce((sum, appointment) => {
      const checkout = checkoutByAppointmentId.get(appointment.id)
      return sum + (checkout ? checkout.totalBeforeTip : appointment.totalPrice)
    }, 0)
  const computedStats = {
    totalAppointments: staffAppointments.length,
    revenue: `$${completedRevenue.toFixed(2)}`,
    avgTip: "$0",
    noShows: staffAppointments.filter((appointment) => appointment.status === "no_show").length,
    lateArrivals: staffAppointments.filter((appointment) => appointment.isLate).length
  }
  const mapAppointment = useCallback((appointment: Appointment): StaffAppointmentSummary => {
    const checkout = checkoutByAppointmentId.get(appointment.id)
    const finalAmount = checkout ? checkout.totalBeforeTip : appointment.totalPrice
    return {
      id: appointment.id,
      client: appointment.clientName,
      pet: appointment.petName,
      service: appointment.services.length > 0
        ? appointment.services.map((service) => service.serviceName).join(", ")
        : "Service",
      date: appointment.date,
      time: appointment.startTime,
      status: appointment.status,
      cost: `$${finalAmount.toFixed(2)}`,
      notes: appointment.notes
    }
  }, [checkoutByAppointmentId])
  
  // Store full appointments for upcoming and recent
  const upcomingFullAppointments = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0)
    return staffAppointments
      .filter((appointment) => {
        const appointmentDate = new Date(`${appointment.date}T00:00:00`).setHours(0, 0, 0, 0)
        return appointmentDate >= today && appointment.status !== "cancelled"
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)
  }, [staffAppointments])
  
  const recentFullAppointments = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0)
    return staffAppointments
      .filter((appointment) => {
        const appointmentDate = new Date(`${appointment.date}T00:00:00`).setHours(0, 0, 0, 0)
        return appointmentDate < today && appointment.status !== "cancelled"
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
  }, [staffAppointments])
  
  const upcomingAppointments = useMemo(() => 
    upcomingFullAppointments.map(mapAppointment)
  , [upcomingFullAppointments, mapAppointment])
  
  const recentAppointments = useMemo(() => 
    recentFullAppointments.map(mapAppointment)
  , [recentFullAppointments, mapAppointment])
  const actorNamesByUserId = useMemo(
    () => new Map(
      (dbStaff ?? [])
        .filter((member) => member.user_id)
        .map((member) => [
          member.user_id as string,
          `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || member.email || 'Staff Member'
        ])
    ),
    [dbStaff]
  )
  const staffNamesById = useMemo(
    () => new Map(
      (dbStaff ?? []).map((member) => [
        member.id,
        `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || member.email || 'Staff Member'
      ])
    ),
    [dbStaff]
  )
  const clientNamesById = useMemo(
    () => new Map((clients || []).map((client) => [client.id, client.name])),
    [clients]
  )
  const appointmentLookup = useMemo(
    () => new Map((appointments || []).map((appointment) => [
      appointment.id,
      { petName: appointment.petName, clientName: appointment.clientName }
    ])),
    [appointments]
  )
  const historyEntries = useMemo(() => {
    return (auditLog ?? [])
      .filter((entry) => auditEntryMatchesStaff(entry, staffId, dbStaffRecord?.user_id))
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .map((entry) => {
        const changedFields = (entry.changed_keys ?? [])
          .filter((field) => !AUDIT_FIELDS_TO_HIDE.has(field))
          .map((field) => {
            const before = formatAuditValue(field, entry.old_row?.[field], {
              staffById: staffNamesById,
              staffByUserId: actorNamesByUserId,
              clientsById: clientNamesById,
            })
            const after = formatAuditValue(field, entry.new_row?.[field], {
              staffById: staffNamesById,
              staffByUserId: actorNamesByUserId,
              clientsById: clientNamesById,
            })

            if (entry.action === 'INSERT') return `${humanizeAuditField(field)}: ${after}`
            if (entry.action === 'DELETE') return `${humanizeAuditField(field)}: ${before}`
            if (before === after) return humanizeAuditField(field)
            return `${humanizeAuditField(field)}: ${before} → ${after}`
          })

        return {
          id: entry.id,
          tableName: entry.table_name,
          actionLabel: titleCaseWords(entry.action),
          recordLabel: humanizeTableName(entry.table_name),
          description: getActivityDescription(entry, {
            actorsById: actorNamesByUserId,
            appointmentsById: appointmentLookup,
            clientsById: clientNamesById,
          }),
          actorLabel: getActorLabel(entry, {
            actorsById: actorNamesByUserId,
            appointmentsById: appointmentLookup,
            clientsById: clientNamesById,
          }),
          changedFields,
          createdAtLabel: format(parseISO(entry.created_at), 'MMM d, yyyy h:mm a'),
          relativeTimeLabel: formatDistanceToNow(parseISO(entry.created_at), { addSuffix: true }),
        }
      })
  }, [actorNamesByUserId, appointmentLookup, auditLog, clientNamesById, dbStaffRecord?.user_id, staffId, staffNamesById])
  const filteredHistoryEntries = useMemo(() => {
    const query = historySearch.trim().toLowerCase()

    return historyEntries.filter((entry) => {
      const matchesFilter =
        historyFilter === 'all' ||
        (historyFilter === 'appointments' && entry.tableName === 'appointments') ||
        (historyFilter === 'staff' && entry.tableName === 'staff') ||
        (historyFilter === 'other' && !['appointments', 'staff'].includes(entry.tableName))

      if (!matchesFilter) return false
      if (!query) return true

      return [
        entry.actionLabel,
        entry.recordLabel,
        entry.description,
        entry.actorLabel,
        ...entry.changedFields,
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [historyEntries, historyFilter, historySearch])
  const hasActiveHistoryFilters = historyFilter !== 'all' || historySearch.trim().length > 0

  const formatStatusLabel = (status?: string) => {
    if (!status) return "Scheduled"
    return status
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }
  const getStatusBadgeClasses = (status?: string) => {
    switch (status) {
      case "picked_up":
        return "bg-emerald-500 text-white"
      case "checked_in":
        return "bg-blue-500 text-white"
      case "in_progress":
        return "bg-purple-500 text-white"
      case "ready":
        return "bg-orange-500 text-white"
      case "cancelled":
        return "bg-muted text-muted-foreground"
      case "no_show":
        return "bg-rose-700 text-white"
      default:
        return "bg-primary text-primary-foreground"
    }
  }

  if (isStaffLoading) {
    return <PageLoadingState label="Loading staff profile…" />
  }

  if (!staff) {
    return (
      <div data-testid="page-staff-profile" className="staff-profile-theme min-h-full bg-background text-foreground p-3 sm:p-6">
        <div className="max-w-[1200px] mx-auto">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-secondary transition-all duration-200"
            onClick={() => navigate('/staff')}
          >
            <ArrowLeft size={24} />
          </Button>
          <Card className="mt-4 p-6 text-center text-muted-foreground">
            Staff member not found.
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="page-staff-profile" className="staff-profile-theme min-h-full bg-background text-foreground p-3 sm:p-6">
      <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <header className="grid gap-3 sm:gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start">
            <div className="flex items-start gap-3 sm:gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="mt-0.5 sm:mt-1 hover:bg-secondary transition-all duration-200 shrink-0"
                onClick={() => navigate('/staff')}
              >
                <ArrowLeft size={isMobile ? 20 : 24} />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className={`${isMobile ? 'text-xl' : 'text-[32px]'} font-bold tracking-tight leading-none`}>
                  {staff.name}
                </h1>
                <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">
                    {staff.role} • SINCE {staff.hireDate.toUpperCase()}
                  </p>
                  {staff.status !== "Active" && (
                    <Badge 
                      variant="secondary"
                      className="text-xs"
                    >
                      {staff.status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <TabsList className="flex flex-wrap justify-center">
                <TabsTrigger 
                  value="overview"
                  className={`data-[state=active]:bg-primary data-[state=active]:text-primary-foreground ${isMobile ? 'text-xs' : ''}`}
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="groomer-performance"
                  className={`data-[state=active]:bg-primary data-[state=active]:text-primary-foreground ${isMobile ? 'text-xs' : ''}`}
                >
                  G Performance
                </TabsTrigger>
                <TabsTrigger 
                  value="payroll"
                  className={`data-[state=active]:bg-primary data-[state=active]:text-primary-foreground ${isMobile ? 'text-xs' : ''}`}
                >
                  Payroll
                </TabsTrigger>
                <TabsTrigger 
                  value="schedule"
                  className={`data-[state=active]:bg-primary data-[state=active]:text-primary-foreground ${isMobile ? 'text-xs' : ''}`}
                >
                  Schedule
                </TabsTrigger>
                <TabsTrigger 
                  value="history"
                  className={`data-[state=active]:bg-primary data-[state=active]:text-primary-foreground ${isMobile ? 'text-xs' : ''}`}
                >
                  History
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 justify-start sm:justify-end">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className={`font-semibold transition-colors duration-200 border-primary/35 bg-primary/10 text-foreground hover:bg-primary/15 hover:border-primary/45 ${isMobile ? 'flex-1' : ''}`}
                  >
                    Contact
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-w-md">
                  <DialogHeader>
                    <DialogTitle>Contact Information</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer">
                      <Phone size={20} className="text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Phone</div>
                        <div className="font-medium">{staff.phone}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer">
                      <Envelope size={20} className="text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Email</div>
                        <div className="font-medium break-words">{staff.email}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                      <MapPin size={20} className="text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Address</div>
                        <div className="font-medium">{staff.address}</div>
                      </div>
                    </div>
                    
                    <div className="border-t border-border pt-4 mt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Emergency Contact
                      </h4>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                        <User size={20} className="text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{staff.emergencyContact.name}</div>
                          <div className="text-xs text-muted-foreground">{staff.emergencyContact.relation}</div>
                          <div className="text-sm font-medium mt-1">{staff.emergencyContact.phone}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              {isNoLoginStaff && (
                <Dialog open={enableLoginDialogOpen} onOpenChange={setEnableLoginDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className={`font-semibold transition-colors duration-200 text-xs border-primary/35 bg-primary/10 text-foreground hover:bg-primary/15 hover:border-primary/45 ${isMobile ? 'flex-1' : ''}`}
                    >
                      Enable Login
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border max-w-md">
                    <DialogHeader>
                      <DialogTitle>Enable Login / Send Invite</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <p className="text-sm text-muted-foreground">
                        Send an invitation email so this staff member can create login credentials and access the app.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="invite-email">Email Address</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          placeholder="staff@example.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          disabled={sendingInvite}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendLoginInvite()
                          }}
                        />
                      </div>
                      <Button
                        onClick={handleSendLoginInvite}
                        disabled={sendingInvite || !inviteEmail}
                        className="w-full"
                      >
                        {sendingInvite ? 'Sending...' : 'Send Invite'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-secondary transition-colors duration-200 shrink-0"
                onClick={() => navigate(`/staff/${staffId}/edit`)}
              >
                <PencilSimple size={isMobile ? 18 : 20} />
              </Button>
            </div>
          </header>

          <TabsContent value="overview" className="mt-0 space-y-4 sm:space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
              <StatWidget
                stats={[
                  { label: "TOTAL APPTS", value: computedStats.totalAppointments.toString() },
                  { label: "REQUESTED APPTS", value: requestedAppointments.toString() }
                ]}
                onClick={() => console.log('Total Appointments clicked')}
              />

              <StatWidget
                stats={[
                  { label: "REVENUE", value: computedStats.revenue },
                  { label: "AVG TIP", value: computedStats.avgTip }
                ]}
                onClick={() => console.log('Revenue clicked')}
              />

              <StatWidget
                stats={[
                  { label: "NO-SHOWS", value: computedStats.noShows.toString() },
                  { label: "LATE", value: computedStats.lateArrivals.toString() }
                ]}
                onClick={() => console.log('No-shows clicked')}
              />
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 sm:mb-4">
                  Upcoming Appointments
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {upcomingAppointments.length > 0 ? (
                    upcomingAppointments.map((apt, index) => (
                      <Card
                        key={apt.id}
                        className="p-3 sm:p-4 bg-card border-border cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedFullAppointmentId(upcomingFullAppointments[index].id)
                          setAppointmentDialogOpen(true)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSelectedFullAppointmentId(upcomingFullAppointments[index].id)
                            setAppointmentDialogOpen(true)
                          }
                        }}
                      >
                        {isMobile ? (
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm mb-1.5">{apt.client}</h4>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                    <PawPrint size={12} weight="fill" />
                                    {apt.pet}
                                  </Badge>
                                  <Badge 
                                    variant="secondary"
                                    className={`text-xs ${getStatusBadgeClasses(apt.status)}`}
                                  >
                                    {formatStatusLabel(apt.status)}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-semibold text-sm">{apt.date}</div>
                                <div className="text-xs text-muted-foreground">{apt.time}</div>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {apt.service} • {apt.duration}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold">{apt.client}</h4>
                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                  <PawPrint size={12} weight="fill" />
                                  {apt.pet}
                                </Badge>
                                <Badge 
                                  variant="secondary"
                                  className={`text-xs ${getStatusBadgeClasses(apt.status)}`}
                                >
                                  {formatStatusLabel(apt.status)}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {apt.service}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{apt.date}</div>
                              <div className="text-sm text-muted-foreground">{apt.time} • {apt.duration}</div>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))
                  ) : (
                    <Card className="p-8 sm:p-12 bg-card border-border text-center">
                      <p className="text-sm sm:text-base text-muted-foreground">
                        No upcoming appointments scheduled.
                      </p>
                    </Card>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 sm:mb-4">
                  Recent Appointments
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {recentAppointments.length > 0 ? (
                    recentAppointments.map((apt, index) => (
                      <Card
                        key={apt.id}
                        className="p-3 sm:p-4 bg-card border-border cursor-pointer hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedFullAppointmentId(recentFullAppointments[index].id)
                          setAppointmentDialogOpen(true)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSelectedFullAppointmentId(recentFullAppointments[index].id)
                            setAppointmentDialogOpen(true)
                          }
                        }}
                      >
                        {isMobile ? (
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <h4 className="font-semibold text-sm">{apt.client}</h4>
                                  <div className="text-xs text-primary">
                                    {apt.rating} ⭐
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                    <PawPrint size={12} weight="fill" />
                                    {apt.pet}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mb-1">
                                  {apt.service}
                                </div>
                                {apt.notes && (
                                  <div className="text-xs text-muted-foreground italic">
                                    "{apt.notes}"
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-semibold text-sm">{apt.date}</div>
                                <div className="text-xs text-muted-foreground">{apt.time}</div>
                                <div className="text-xs font-semibold text-primary mt-1">
                                  {apt.cost} + {apt.tip}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold">{apt.client}</h4>
                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                  <PawPrint size={12} weight="fill" />
                                  {apt.pet}
                                </Badge>
                                <div className="text-xs text-primary">
                                  {apt.rating} ⭐
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground mb-1">
                                {apt.service}
                              </div>
                              {apt.notes && (
                                <div className="text-xs text-muted-foreground italic">
                                  "{apt.notes}"
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{apt.date}</div>
                              <div className="text-sm text-muted-foreground">{apt.time}</div>
                              <div className="text-sm font-semibold text-primary mt-1">
                                {apt.cost} + {apt.tip} tip
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))
                  ) : (
                    <Card className="p-8 sm:p-12 bg-card border-border text-center">
                      <p className="text-sm sm:text-base text-muted-foreground">
                        No appointment history available.
                      </p>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="groomer-performance" className="mt-0">
            <StaffPerformanceView
              data={groomerPerformanceData}
              scopeLabel="this groomer"
              headerBackground="hsl(var(--secondary))"
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <div className="space-y-3 sm:space-y-4">
              <Card className="p-4 sm:p-5 bg-card border-border">
                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold">Detailed activity log</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Full saved history for {staff.name}, including profile changes, actions taken while logged in, and records tied to their appointments.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Input
                      value={historySearch}
                      onChange={(event) => setHistorySearch(event.target.value)}
                      placeholder="Search history details"
                      className="sm:max-w-xs"
                      aria-label="Search history details"
                    />
                    <Badge variant="secondary" className="w-fit">
                      {filteredHistoryEntries.length} of {historyEntries.length} {historyEntries.length === 1 ? 'entry' : 'entries'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ['all', 'All'],
                      ['appointments', 'Appointments'],
                      ['staff', 'Staff'],
                      ['other', 'Other'],
                    ] as const).map(([value, label]) => (
                      <Button
                        key={value}
                        type="button"
                        variant={historyFilter === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setHistoryFilter(value)}
                        className="h-8"
                      >
                        {label}
                      </Button>
                    ))}
                    {hasActiveHistoryFilters && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setHistoryFilter('all')
                          setHistorySearch('')
                        }}
                        className="h-8"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {isHistoryLoading ? (
                <Card className="p-8 sm:p-12 bg-card border-border text-center">
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Loading detailed history…
                  </p>
                </Card>
              ) : filteredHistoryEntries.length > 0 ? (
                filteredHistoryEntries.map((entry) => (
                  <Card key={entry.id} className="p-4 sm:p-5 bg-card border-border">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{entry.actionLabel}</Badge>
                          <Badge variant="outline">{entry.recordLabel}</Badge>
                        </div>
                        <div className="font-semibold leading-tight">{entry.description}</div>
                        <div className="text-sm text-muted-foreground">{entry.actorLabel}</div>
                        {entry.changedFields.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Changed fields
                            </div>
                            <ul className="space-y-1 text-sm text-muted-foreground">
                              {entry.changedFields.map((detail) => (
                                <li key={detail}>• {detail}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground sm:text-right shrink-0">
                        <div className="font-medium text-foreground">{entry.relativeTimeLabel}</div>
                        <div>{entry.createdAtLabel}</div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="p-8 sm:p-12 bg-card border-border text-center">
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {historyEntries.length > 0
                      ? 'No history entries match the current filters.'
                      : 'No saved history is available for this staff member yet.'}
                  </p>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="payroll" className="mt-0">
            <StaffPayrollDetail 
              staffId={staffId}
              staffName={staff.name}
              hourlyRate={staff.hourlyRate}
            />
          </TabsContent>

          <TabsContent value="schedule" className="mt-0">
            <StaffScheduleView staffId={staffId} isOwner={true} />
          </TabsContent>

        </Tabs>
      </div>

      {selectedFullAppointment && (
        <AppointmentDetailsDialog
          appointment={selectedFullAppointment}
          open={appointmentDialogOpen}
          onOpenChange={(open) => {
            setAppointmentDialogOpen(open)
            if (!open) {
              setSelectedFullAppointmentId(null)
            }
          }}
        />
      )}
    </div>
  )
}
