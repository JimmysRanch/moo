import { useEffect, useMemo, useState } from 'react'
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MagnifyingGlass, PawPrint, User, CaretLeft, CaretRight } from "@phosphor-icons/react"
import { AppointmentDetailsDialog } from "./AppointmentDetailsDialog"
import { AppointmentStatusBadge } from "./AppointmentStatusBadge"
import { format, addDays, subDays, startOfWeek, endOfWeek, addWeeks, addMonths, subWeeks, subMonths } from "date-fns"
import { formatDateString, getBusinessDateRangeStrings, getTodayDateInBusinessTimezone, isAppointmentInBusinessDateRange } from "@/lib/date-utils"
import { formatTimeLabel } from "@/lib/business-hours"
import { useAppointments } from '@/hooks/data/useAppointments'
import { useClients, useAllPets } from '@/hooks/data/useClients'
import { useStaff } from '@/hooks/data/useStaff'
import { useBusinessSettings } from '@/hooks/data/useBusinessSettings'
import { useAppointmentCheckoutMap } from '@/hooks/useAppointmentCheckout'
import { appointmentFromDb } from '@/lib/mappers/appointmentMapper'
import { formatGroomerName } from '@/lib/utils'
import { type AppointmentStatus } from '@/lib/appointmentStatus'
import { getPhoneDigits } from '@/utils/phone'

type ViewMode = 'day' | 'week' | 'month'

interface ListViewProps {
  statusFilter?: string
  clientIdFilter?: string
  requestedAppointmentId?: string
  currentDate?: Date
  onCurrentDateChange?: (date: Date) => void
  viewMode?: ViewMode
  onViewModeChange?: (viewMode: ViewMode) => void
}

export function ListView({
  statusFilter: externalStatusFilter,
  clientIdFilter,
  requestedAppointmentId,
  currentDate: currentDateProp,
  onCurrentDateChange,
  viewMode: viewModeProp,
  onViewModeChange,
}: ListViewProps) {
  const { data: dbAppointments } = useAppointments()
  const { data: dbClients } = useClients()
  const { data: dbStaff } = useStaff()
  const { data: dbPets } = useAllPets()
  const { data: dbBusinessSettings } = useBusinessSettings()
  const checkoutByAppointmentId = useAppointmentCheckoutMap()
  const businessTimezone = dbBusinessSettings?.timezone

  const appointments = useMemo(() => {
    if (!dbAppointments) return []
    const clientMap = new Map((dbClients ?? []).map(c => [c.id, c]))
    const staffMap = new Map((dbStaff ?? []).map(s => [s.id, s]))
    const petMap = new Map((dbPets ?? []).map(p => [p.id, p]))
    return dbAppointments.map(a => {
      const client = clientMap.get(a.client_id)
      const staff = a.groomer_id ? staffMap.get(a.groomer_id) : undefined
      const pet = a.pet_id ? petMap.get(a.pet_id) : undefined
      return appointmentFromDb(
        a,
        undefined,
        client ? `${client.first_name} ${client.last_name}`.trim() : '',
        pet?.name ?? '',
        pet?.breed ?? undefined,
        pet?.weight ?? undefined,
        pet?.weight_category ?? undefined,
        staff ? `${staff.first_name} ${staff.last_name}`.trim() : ''
      )
    })
  }, [dbAppointments, dbClients, dbStaff, dbPets])
  const [searchQuery, setSearchQuery] = useState("")
  const [localStatusFilter, setLocalStatusFilter] = useState("all")
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [internalCurrentDate, setInternalCurrentDate] = useState(() => getTodayDateInBusinessTimezone())
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('day')
  const normalizedSearchQuery = searchQuery.toLowerCase()
  const phoneSearchQuery = getPhoneDigits(searchQuery)
  const clientPhoneById = useMemo(
    () => new Map((dbClients ?? []).map((client) => [client.id, getPhoneDigits(client.phone ?? '')])),
    [dbClients]
  )
  const currentDate = currentDateProp ?? internalCurrentDate
  const setCurrentDate = onCurrentDateChange ?? setInternalCurrentDate
  const viewMode = viewModeProp ?? internalViewMode
  const setViewMode = onViewModeChange ?? setInternalViewMode

  const selectedAppointment = appointments.find(a => a.id === selectedAppointmentId) ?? null
  
  const statusFilter = externalStatusFilter || localStatusFilter
  const allowedStatuses = useMemo(
    () => (statusFilter && statusFilter !== 'all' ? statusFilter.split(',').map((value) => value.trim()).filter(Boolean) : []),
    [statusFilter],
  )

  const dateRangeStrings = getBusinessDateRangeStrings(currentDate, viewMode)

  const navigateDate = (direction: 'prev' | 'next') => {
    switch (viewMode) {
      case 'week':
        setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1))
        break
      case 'month':
        setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
        break
      default:
        setCurrentDate(direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1))
    }
  }

  const getHeaderText = () => {
    switch (viewMode) {
      case 'week': {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
      }
      case 'month':
        return format(currentDate, 'MMMM yyyy')
      default:
        return format(currentDate, 'MMMM d, yyyy')
    }
  }

  const filteredAppointments = (appointments || [])
    .filter(apt => {
      if (clientIdFilter && apt.clientId !== clientIdFilter) {
        return false
      }

      const matchesSearch =
        apt.clientName.toLowerCase().includes(normalizedSearchQuery) ||
        apt.petName.toLowerCase().includes(normalizedSearchQuery) ||
        apt.groomerName.toLowerCase().includes(normalizedSearchQuery) ||
        (phoneSearchQuery.length > 0 && (clientPhoneById.get(apt.clientId) ?? '').includes(phoneSearchQuery))
      
      const matchesStatus = allowedStatuses.length === 0 || allowedStatuses.includes(apt.status)

      const matchesDate = viewMode === 'day'
        ? apt.date === format(currentDate, 'yyyy-MM-dd')
        : isAppointmentInBusinessDateRange(apt.date, dateRangeStrings.start, dateRangeStrings.end)

      return matchesSearch && matchesStatus && matchesDate
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.startTime}`)
      const dateB = new Date(`${b.date} ${b.startTime}`)
      return dateB.getTime() - dateA.getTime()
    })

  useEffect(() => {
    if (!requestedAppointmentId) return

    const requestedAppointment = appointments.find((appointment) => appointment.id === requestedAppointmentId)
    if (!requestedAppointment) return

    if (clientIdFilter && requestedAppointment.clientId !== clientIdFilter) {
      return
    }

    setSelectedAppointmentId(requestedAppointmentId)
    setDetailsOpen(true)
  }, [appointments, clientIdFilter, requestedAppointmentId])
  const viewModeTriggerClassName =
    'appointment-view-mode-toggle data-[state=active]:border-primary/45 data-[state=active]:bg-primary/12 data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:shadow-primary/10'

  return (
    <div className="space-y-4">
      <Card className="p-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{getHeaderText()}</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger 
                  value="day"
                  className={viewModeTriggerClassName}
                >
                  Day
                </TabsTrigger>
                <TabsTrigger 
                  value="week"
                  className={viewModeTriggerClassName}
                >
                  Week
                </TabsTrigger>
                <TabsTrigger 
                  value="month"
                  className={viewModeTriggerClassName}
                >
                  Month
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
                <CaretLeft />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(getTodayDateInBusinessTimezone(businessTimezone))}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateDate('next')}>
                <CaretRight />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search by client, pet, groomer, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setLocalStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="checked_in">Checked In</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="picked_up">Picked Up</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PawPrint size={48} className="mx-auto mb-3 opacity-50" />
              <p>No appointments found</p>
            </div>
          ) : (
            filteredAppointments.map(apt => (
              <button
                key={apt.id}
                onClick={() => {
                  setSelectedAppointmentId(apt.id)
                  setDetailsOpen(true)
                }}
                className="w-full text-left p-4 border border-border rounded-lg hover:border-primary transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <PawPrint size={16} weight="fill" className="text-primary shrink-0" />
                      <h3 className="font-semibold">{apt.petName}</h3>
                      <AppointmentStatusBadge
                        status={apt.status as AppointmentStatus}
                        isLate={apt.isLate}
                      />
                      {apt.groomerRequested && (
                        <Badge variant="outline" className="text-xs">
                          Requested
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <User size={14} />
                        <span>{apt.clientName}</span>
                      </div>
                      <div>Groomer: {formatGroomerName(apt.groomerName)}</div>
                      <div>{formatDateString(apt.date, 'MMM d, yyyy')} at {formatTimeLabel(apt.startTime)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-primary">
                      ${(checkoutByAppointmentId.get(apt.id)?.totalBeforeTip ?? apt.totalPrice).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {apt.services.length} service{apt.services.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </Card>

      {selectedAppointment && (
        <AppointmentDetailsDialog
          appointment={selectedAppointment}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}
    </div>
  )
}
