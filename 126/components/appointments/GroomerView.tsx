import { useEffect, useMemo, useState } from 'react'
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, PawPrint, CaretLeft, CaretRight } from "@phosphor-icons/react"
import { AppointmentDetailsDialog } from "./AppointmentDetailsDialog"
import { format, addDays, subDays, startOfWeek, endOfWeek, addWeeks, addMonths, subWeeks, subMonths } from "date-fns"
import { formatDateString, getBusinessDateRangeStrings, getTodayDateInBusinessTimezone, isAppointmentInBusinessDateRange } from "@/lib/date-utils"
import { formatTimeLabel } from "@/lib/business-hours"
import { useAppointments } from '@/hooks/data/useAppointments'
import { useClients, useAllPets } from '@/hooks/data/useClients'
import { useStaff } from '@/hooks/data/useStaff'
import { useBusinessSettings } from '@/hooks/data/useBusinessSettings'
import { useAppointmentCheckoutMap } from '@/hooks/useAppointmentCheckout'
import { appointmentFromDb } from '@/lib/mappers/appointmentMapper'
import { staffListFromDb } from '@/lib/mappers/staffMapper'
import { STATUS_LABELS, type AppointmentStatus } from '@/lib/appointmentStatus'
import { formatGroomerName } from '@/lib/utils'

type ViewMode = 'day' | 'week' | 'month'

interface GroomerViewProps {
  statusFilter?: string
  clientIdFilter?: string
  requestedAppointmentId?: string
  currentDate?: Date
  onCurrentDateChange?: (date: Date) => void
  viewMode?: ViewMode
  onViewModeChange?: (viewMode: ViewMode) => void
}

export function GroomerView({
  statusFilter,
  clientIdFilter,
  requestedAppointmentId,
  currentDate: currentDateProp,
  onCurrentDateChange,
  viewMode: viewModeProp,
  onViewModeChange,
}: GroomerViewProps) {
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

  const staffMembers = useMemo(() => staffListFromDb(dbStaff ?? []), [dbStaff])
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [internalCurrentDate, setInternalCurrentDate] = useState(() => getTodayDateInBusinessTimezone())
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('day')
  const currentDate = currentDateProp ?? internalCurrentDate
  const setCurrentDate = onCurrentDateChange ?? setInternalCurrentDate
  const viewMode = viewModeProp ?? internalViewMode
  const setViewMode = onViewModeChange ?? setInternalViewMode

  const selectedAppointment = appointments.find(a => a.id === selectedAppointmentId) ?? null
  const allowedStatuses = useMemo(
    () => (statusFilter && statusFilter !== 'all' ? statusFilter.split(',').map((value) => value.trim()).filter(Boolean) : []),
    [statusFilter],
  )

  const groomersFromStaff = (staffMembers || [])
    .filter((member) => member.canTakeAppointments)
    .map((member) => ({ id: member.id, name: member.name }))
  const groomersFromAppointments = Array.from(
    new Set((appointments || []).map((apt) => apt.groomerId))
  ).map((id) => {
    const apt = (appointments || []).find((a) => a.groomerId === id)
    return {
      id,
      name: apt?.groomerName || "Unknown"
    }
  })
  const groomers = groomersFromStaff.length > 0 ? groomersFromStaff : groomersFromAppointments

  const dateRangeStrings = getBusinessDateRangeStrings(currentDate, viewMode)

  const getGroomerAppointments = (groomerId: string) => {
    return (appointments || [])
      .filter(apt => {
        if (apt.groomerId !== groomerId) return false
        if (clientIdFilter && apt.clientId !== clientIdFilter) return false
        
        const matchesStatus = allowedStatuses.length === 0 || allowedStatuses.includes(apt.status)
        if (!matchesStatus) return false
        
        if (apt.status === 'cancelled' && allowedStatuses.length === 0) return false
        
        if (viewMode === 'day') {
          return apt.date === format(currentDate, 'yyyy-MM-dd')
        }
        return isAppointmentInBusinessDateRange(apt.date, dateRangeStrings.start, dateRangeStrings.end)
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.startTime}`)
        const dateB = new Date(`${b.date}T${b.startTime}`)
        return dateA.getTime() - dateB.getTime()
      })
  }

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':   return 'bg-slate-500/20 text-slate-300'
      case 'checked_in':  return 'bg-blue-500/20 text-blue-400'
      case 'in_progress': return 'bg-purple-500/20 text-purple-400'
      case 'ready':       return 'bg-orange-500/20 text-orange-400'
      case 'picked_up':   return 'bg-green-500/20 text-green-400'
      case 'cancelled':   return 'bg-red-500/20 text-red-400'
      case 'no_show':     return 'bg-rose-900/30 text-rose-400'
      default:            return 'bg-gray-500/20 text-gray-400'
    }
  }
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groomers.map(groomer => {
          const groomerApts = getGroomerAppointments(groomer.id)
        
          return (
            <Card key={groomer.id} className="p-4">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <User size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{formatGroomerName(groomer.name)}</h3>
                <p className="text-xs text-muted-foreground">
                  {groomerApts.length} appointment{groomerApts.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
              {groomerApts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <PawPrint size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No appointments for this {viewMode}</p>
                </div>
              ) : (
                groomerApts.map(apt => (
                  <button
                    key={apt.id}
                    onClick={() => {
                      setSelectedAppointmentId(apt.id)
                      setDetailsOpen(true)
                    }}
                    className="w-full text-left p-3 border border-border rounded-lg hover:border-primary transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate flex items-center gap-1">
                          <PawPrint size={14} weight="fill" className="text-primary shrink-0" />
                          {apt.petName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{apt.clientName}</div>
                      </div>
                      <Badge variant="secondary" className={`${getStatusColor(apt.status)} text-xs`}>
                        {STATUS_LABELS[apt.status as AppointmentStatus] ?? apt.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateString(apt.date, 'MMM d')} • {formatTimeLabel(apt.startTime)}
                    </div>
                    <div className="text-sm font-semibold text-primary mt-1">
                      ${(checkoutByAppointmentId.get(apt.id)?.totalBeforeTip ?? apt.totalPrice).toFixed(2)}
                    </div>
                    {apt.groomerRequested && (
                      <Badge variant="outline" className="text-xs mt-2">
                        Client Requested
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </Card>
          )
        })}

        {groomers.length === 0 && (
          <Card className="col-span-full p-12">
            <div className="text-center text-muted-foreground">
              <User size={48} className="mx-auto mb-3 opacity-50" />
              <p>No groomers found</p>
              <p className="text-sm mt-1">Appointments will appear here once created</p>
            </div>
          </Card>
        )}
      </div>

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
