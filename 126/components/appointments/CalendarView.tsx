import { useEffect, useMemo, useState } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CaretLeft, CaretRight, PawPrint } from "@phosphor-icons/react"
import { AppointmentDetailsDialog } from "./AppointmentDetailsDialog"
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, eachDayOfInterval } from "date-fns"
import { getTodayDateInBusinessTimezone, isSameDayInBusinessTimezone } from "@/lib/date-utils"
import { DEFAULT_HOURS_OF_OPERATION, formatTimeLabel, getTimeSlotsForDate } from "@/lib/business-hours"
import { useAppointments } from '@/hooks/data/useAppointments'
import { useClients, useAllPets } from '@/hooks/data/useClients'
import { useStaff } from '@/hooks/data/useStaff'
import { useBusinessSettings } from '@/hooks/data/useBusinessSettings'
import { appointmentFromDb } from '@/lib/mappers/appointmentMapper'
import { formatGroomerName } from '@/lib/utils'
import { parseTimeToMinutes } from '@/lib/time'

type ViewMode = 'day' | 'week' | 'month'

interface CalendarViewProps {
  statusFilter?: string
  clientIdFilter?: string
  requestedAppointmentId?: string
  currentDate?: Date
  onCurrentDateChange?: (date: Date) => void
  viewMode?: ViewMode
  onViewModeChange?: (viewMode: ViewMode) => void
}

export function CalendarView({
  statusFilter,
  clientIdFilter,
  requestedAppointmentId,
  currentDate: currentDateProp,
  onCurrentDateChange,
  viewMode: viewModeProp,
  onViewModeChange,
}: CalendarViewProps) {
  const { data: dbAppointments } = useAppointments()
  const { data: dbClients } = useClients()
  const { data: dbStaff } = useStaff()
  const { data: dbPets } = useAllPets()
  const { data: businessSettings } = useBusinessSettings()

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
  const [internalCurrentDate, setInternalCurrentDate] = useState(() => getTodayDateInBusinessTimezone())
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('week')
  const currentDate = currentDateProp ?? internalCurrentDate
  const setCurrentDate = onCurrentDateChange ?? setInternalCurrentDate
  const viewMode = viewModeProp ?? internalViewMode
  const setViewMode = onViewModeChange ?? setInternalViewMode

  const selectedAppointment = appointments.find(a => a.id === selectedAppointmentId) ?? null
  const appointmentTimeLabels = new Map(
    appointments.map((appointment) => [appointment.id, formatTimeLabel(appointment.startTime)])
  )
  const allowedStatuses = useMemo(
    () => (statusFilter && statusFilter !== 'all' ? statusFilter.split(',').map((value) => value.trim()).filter(Boolean) : []),
    [statusFilter],
  )

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate])
  const weekDays = useMemo(
    () => (viewMode === 'week'
      ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      : [currentDate]),
    [currentDate, viewMode, weekStart],
  )
  const hoursOfOperation = businessSettings?.hours_of_operation ?? DEFAULT_HOURS_OF_OPERATION
  const businessTimezone = businessSettings?.timezone

  const timeSlots = useMemo(() => {
    if (viewMode === 'month') {
      return []
    }

    const dates = viewMode === 'week' ? weekDays : [currentDate]
    const uniqueSlots = new Set(
      dates.flatMap((date) => getTimeSlotsForDate(format(date, 'yyyy-MM-dd'), hoursOfOperation))
    )

    return Array.from(uniqueSlots).sort((left, right) => {
      const leftMinutes = parseTimeToMinutes(left)
      const rightMinutes = parseTimeToMinutes(right)

      if (leftMinutes === null || rightMinutes === null) {
        return left.localeCompare(right)
      }

      return leftMinutes - rightMinutes
    })
  }, [currentDate, hoursOfOperation, viewMode, weekDays])

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
      case 'week':
        return `${format(weekStart, 'MMM d')} - ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`
      case 'month':
        return format(currentDate, 'MMMM yyyy')
      default:
        return format(currentDate, 'MMMM d, yyyy')
    }
  }

  const getAppointmentsForSlot = (day: Date, timeSlot: string) => {
    const dayDateStr = format(day, 'yyyy-MM-dd')
    return (appointments || []).filter(apt => {
      if (clientIdFilter && apt.clientId !== clientIdFilter) {
        return false
      }
      const matchesDate = apt.date === dayDateStr && appointmentTimeLabels.get(apt.id) === timeSlot
      const matchesStatus = allowedStatuses.length === 0 || allowedStatuses.includes(apt.status)
      return matchesDate && matchesStatus
    })
  }

  const getAppointmentsForDay = (day: Date) => {
    const dayDateStr = format(day, 'yyyy-MM-dd')
    return (appointments || []).filter(apt => {
      if (clientIdFilter && apt.clientId !== clientIdFilter) {
        return false
      }
      const matchesDate = apt.date === dayDateStr
      const matchesStatus = allowedStatuses.length === 0 || allowedStatuses.includes(apt.status)
      return matchesDate && matchesStatus
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

  const getMonthDays = () => {
    const monthStart = startOfMonth(currentDate)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
    const endDate = addDays(startDate, 41)
    return eachDayOfInterval({ start: startDate, end: endDate })
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

      <Card className="p-4">
        {viewMode === 'month' ? (
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground p-2">
                {day}
              </div>
            ))}
            {getMonthDays().map((day, idx) => {
              const dayAppointments = getAppointmentsForDay(day)
              const isCurrentMonth = day.getMonth() === currentDate.getMonth()
              const todayDate = getTodayDateInBusinessTimezone(businessTimezone)
              const isToday = isSameDayInBusinessTimezone(day, todayDate, businessTimezone)
              
              return (
                <div
                  key={idx}
                  className={`min-h-[100px] p-2 border border-border rounded-lg ${
                    isToday ? 'bg-primary/5 border-primary' : ''
                  } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayAppointments.slice(0, 3).map(apt => (
                      <button
                        key={apt.id}
                        onClick={() => {
                          setSelectedAppointmentId(apt.id)
                          setDetailsOpen(true)
                        }}
                        className={`w-full text-left p-1 rounded text-xs hover:opacity-80 transition-opacity ${getStatusColor(apt.status)}`}
                      >
                        <div className="font-medium truncate flex items-center gap-1">
                          <PawPrint size={10} weight="fill" className="text-primary shrink-0" />
                          {apt.petName}
                        </div>
                        <div className="truncate text-[10px] opacity-80">{appointmentTimeLabels.get(apt.id)}</div>
                      </button>
                    ))}
                    {dayAppointments.length > 3 && (
                      <div className="text-[10px] text-muted-foreground text-center">
                        +{dayAppointments.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className={viewMode === 'week' ? 'min-w-[800px]' : ''}>
              <div className={`grid gap-2 mb-2 ${viewMode === 'week' ? 'grid-cols-[auto_repeat(7,1fr)]' : 'grid-cols-[auto_1fr]'}`}>
                <div className="text-xs font-medium text-muted-foreground p-2">Time</div>
                {(() => {
                  const businessTodayRef = getTodayDateInBusinessTimezone(businessTimezone)
                  return weekDays.map((day, i) => {
                    const dayIsToday = isSameDayInBusinessTimezone(day, businessTodayRef, businessTimezone)
                    return (
                      <div key={i} className="text-center p-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          {format(day, 'EEE')}
                        </div>
                        <div className={`text-lg font-bold ${dayIsToday ? 'text-primary' : ''}`}>
                          {format(day, 'd')}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                {(() => {
                  const businessTodayForGrid = getTodayDateInBusinessTimezone(businessTimezone)
                  return timeSlots.map((slot, slotIdx) => (
                    <div key={slot} className={`grid ${viewMode === 'week' ? 'grid-cols-[auto_repeat(7,1fr)]' : 'grid-cols-[auto_1fr]'} ${slotIdx !== timeSlots.length - 1 ? 'border-b border-border' : ''}`}>
                      <div className="text-xs text-muted-foreground p-2 border-r border-border w-[70px]">
                        {slot}
                      </div>
                      {weekDays.map((day, dayIdx) => {
                        const slotAppointments = getAppointmentsForSlot(day, slot)
                        const slotDayIsToday = isSameDayInBusinessTimezone(day, businessTodayForGrid, businessTimezone)
                        return (
                          <div
                            key={dayIdx}
                            className={`p-1 min-h-[60px] ${viewMode === 'week' && dayIdx !== 6 ? 'border-r border-border' : ''} ${
                              slotDayIsToday ? 'bg-primary/5' : ''
                            }`}
                          >
                            {slotAppointments.map(apt => (
                              <button
                                key={apt.id}
                                onClick={() => {
                                  setSelectedAppointmentId(apt.id)
                                  setDetailsOpen(true)
                                }}
                                className={`w-full text-left p-2 rounded text-xs mb-1 hover:opacity-80 transition-opacity ${getStatusColor(apt.status)}`}
                              >
                                <div className="font-medium truncate flex items-center gap-1">
                                  <PawPrint size={12} weight="fill" className="text-primary shrink-0" />
                                  {apt.petName}
                                </div>
                                <div className="truncate opacity-80">{formatGroomerName(apt.groomerName)}</div>
                              </button>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  ))
                })()}
              </div>
            </div>
          </div>
        )}
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
