import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus } from "@phosphor-icons/react"
import { CalendarView } from "@/components/appointments/CalendarView"
import { ListView } from "@/components/appointments/ListView"
import { GroomerView } from "@/components/appointments/GroomerView"
import { useIsMobile } from "@/hooks/use-mobile"
import { useAppointments } from '@/hooks/data/useAppointments'
import { useClients, useAllPets } from '@/hooks/data/useClients'
import { useStaff } from '@/hooks/data/useStaff'
import { useBusinessSettings } from '@/hooks/data/useBusinessSettings'
import { useAppointmentCheckoutMap } from '@/hooks/useAppointmentCheckout'
import { getBusinessDateRangeStrings, getTodayDateInBusinessTimezone, isAppointmentInBusinessDateRange } from '@/lib/date-utils'
import { appointmentFromDb } from '@/lib/mappers/appointmentMapper'

type AppointmentsActiveView = 'calendar' | 'list' | 'groomer'
type AppointmentsViewMode = 'day' | 'week' | 'month'

interface AppointmentsDateContext {
  currentDate: Date
  viewMode: AppointmentsViewMode
}

function createDateContext(viewMode: AppointmentsViewMode): AppointmentsDateContext {
  return {
    currentDate: getTodayDateInBusinessTimezone(),
    viewMode,
  }
}

export function Appointments() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isMobile = useIsMobile()
  const { data: dbAppointments } = useAppointments()
  const { data: dbClients } = useClients()
  const { data: dbStaff } = useStaff()
  const { data: dbPets } = useAllPets()
  const { data: dbBusinessSettings } = useBusinessSettings()
  const checkoutByAppointmentId = useAppointmentCheckoutMap()
  const businessTimezone = dbBusinessSettings?.timezone
  const requestedView = searchParams.get('view')
  const requestedStatusFilter = searchParams.get('statuses') ?? searchParams.get('status') ?? 'all'
  const requestedClientId = searchParams.get('clientId') ?? undefined
  const requestedAppointmentId = searchParams.get('appointmentId') ?? undefined
  const [activeView, setActiveView] = useState<AppointmentsActiveView>(() =>
    requestedView === 'calendar' || requestedView === 'list' || requestedView === 'groomer'
      ? requestedView
      : 'groomer',
  )
  const [statusFilter, setStatusFilter] = useState(requestedStatusFilter)
  const [dateContexts, setDateContexts] = useState<Record<AppointmentsActiveView, AppointmentsDateContext>>(() => ({
    groomer: createDateContext('day'),
    list: createDateContext('day'),
    calendar: createDateContext('week'),
  }))

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

  useEffect(() => {
    if (requestedView === 'calendar' || requestedView === 'list' || requestedView === 'groomer') {
      setActiveView(requestedView)
    }
  }, [requestedView])

  useEffect(() => {
    setStatusFilter(requestedStatusFilter)
  }, [requestedStatusFilter])

  // Re-anchor all view currentDates to the business timezone "today" once the
  // configured timezone is known. The useState initializer above runs before
  // useBusinessSettings resolves, so it starts with browser-local "today".
  // This effect corrects that as soon as the timezone is available, but only if
  // the user has not already navigated away from the default initial date.
  useEffect(() => {
    if (!businessTimezone) return
    const businessToday = getTodayDateInBusinessTimezone(businessTimezone)
    const browserTodayStr = format(getTodayDateInBusinessTimezone(), 'yyyy-MM-dd')
    setDateContexts((current) => {
      const corrected = { ...current }
      let changed = false
      for (const view of ['groomer', 'list', 'calendar'] as AppointmentsActiveView[]) {
        // Only reset views that are still showing browser-local today (i.e. user hasn't navigated)
        if (format(current[view].currentDate, 'yyyy-MM-dd') === browserTodayStr) {
          corrected[view] = { ...current[view], currentDate: businessToday }
          changed = true
        }
      }
      return changed ? corrected : current
    })
  }, [businessTimezone])

  const scopedAppointments = useMemo(
    () => appointments.filter((appointment) => !requestedClientId || appointment.clientId === requestedClientId),
    [appointments, requestedClientId],
  )

  const activeClientName = useMemo(() => {
    if (!requestedClientId) return ''
    const client = (dbClients ?? []).find((entry) => entry.id === requestedClientId)
    return client ? `${client.first_name} ${client.last_name}`.trim() : ''
  }, [dbClients, requestedClientId])

  const activeDateContext = dateContexts[activeView]
  const activeDateRangeStrings = useMemo(
    () => getBusinessDateRangeStrings(activeDateContext.currentDate, activeDateContext.viewMode),
    [activeDateContext],
  )
  const visibleAppointments = useMemo(
    () =>
      scopedAppointments.filter((appointment) =>
        isAppointmentInBusinessDateRange(appointment.date, activeDateRangeStrings.start, activeDateRangeStrings.end),
      ),
    [activeDateRangeStrings, scopedAppointments],
  )

  const { scheduled, checkedIn, inProgress, ready, pickedUp, cancelled, noShow, projectedRevenue } = useMemo(() => {
    return visibleAppointments.reduce(
      (acc, appointment) => {
        const status = appointment.status
        if (status === "scheduled") acc.scheduled += 1
        if (status === "checked_in") acc.checkedIn += 1
        if (status === "in_progress") acc.inProgress += 1
        if (status === "ready") acc.ready += 1
        if (status === "picked_up") acc.pickedUp += 1
        if (status === "cancelled") acc.cancelled += 1
        if (status === "no_show") acc.noShow += 1

        if (status !== "cancelled") {
          const checkout = checkoutByAppointmentId.get(appointment.id)
          acc.projectedRevenue += checkout ? checkout.totalBeforeTip : appointment.totalPrice
        }
        return acc
      },
      {
        scheduled: 0,
        checkedIn: 0,
        inProgress: 0,
        ready: 0,
        pickedUp: 0,
        cancelled: 0,
        noShow: 0,
        projectedRevenue: 0
      }
    )
  }, [visibleAppointments, checkoutByAppointmentId])

  const updateDateContext = useCallback(
    (view: AppointmentsActiveView, updates: Partial<AppointmentsDateContext>) => {
      setDateContexts((current) => ({
        ...current,
        [view]: {
          ...current[view],
          ...updates,
        },
      }))
    },
    [],
  )
  const viewToggleBaseClassName = `appointment-view-toggle rounded-full border font-medium transition-all duration-200 ${
    isMobile ? 'flex-1' : 'px-6'
  }`
  const viewToggleActiveClassName = 'border-primary/45 bg-primary/12 text-foreground shadow-md shadow-primary/10'
  const viewToggleInactiveClassName = 'border-border/60 bg-secondary/45 text-foreground hover:bg-secondary/75 hover:border-primary/25'

  return (
    <div data-testid="page-appointments" className="min-h-full bg-background px-3 sm:px-6 pt-2 sm:pt-3 pb-3 sm:pb-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3 mb-4 sm:mb-6">
          <Card 
            className={`p-2 md:p-2.5 border-border cursor-pointer transition-all duration-200 ${
              statusFilter === "scheduled" 
                ? "border-primary shadow-lg shadow-primary/20 bg-primary/5" 
                : "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            }`}
            onClick={() => setStatusFilter(statusFilter === "scheduled" ? "all" : "scheduled")}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Scheduled</p>
                <p className="text-lg md:text-xl font-bold mt-0.5">{scheduled}</p>
              </div>
            </div>
          </Card>
          
          <Card 
            className={`p-2 md:p-2.5 border-border cursor-pointer transition-all duration-200 ${
              statusFilter === "checked_in" 
                ? "border-primary shadow-lg shadow-primary/20 bg-primary/5" 
                : "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            }`}
            onClick={() => setStatusFilter(statusFilter === "checked_in" ? "all" : "checked_in")}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Checked In</p>
                <p className="text-lg md:text-xl font-bold mt-0.5">{checkedIn}</p>
              </div>
            </div>
          </Card>
          
          <Card 
            className={`p-2 md:p-2.5 border-border cursor-pointer transition-all duration-200 ${
              statusFilter === "in_progress" 
                ? "border-primary shadow-lg shadow-primary/20 bg-primary/5" 
                : "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            }`}
            onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">In Progress</p>
                <p className="text-lg md:text-xl font-bold mt-0.5">{inProgress}</p>
              </div>
            </div>
          </Card>
          
          <Card 
            className={`p-2 md:p-2.5 border-border cursor-pointer transition-all duration-200 ${
              statusFilter === "ready" 
                ? "border-primary shadow-lg shadow-primary/20 bg-primary/5" 
                : "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            }`}
            onClick={() => setStatusFilter(statusFilter === "ready" ? "all" : "ready")}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Ready</p>
                <p className="text-lg md:text-xl font-bold mt-0.5">{ready}</p>
              </div>
            </div>
          </Card>
          
          <Card 
            className={`p-2 md:p-2.5 border-border cursor-pointer transition-all duration-200 ${
              statusFilter === "picked_up" 
                ? "border-primary shadow-lg shadow-primary/20 bg-primary/5" 
                : "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            }`}
            onClick={() => setStatusFilter(statusFilter === "picked_up" ? "all" : "picked_up")}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Picked Up</p>
                <p className="text-lg md:text-xl font-bold mt-0.5">{pickedUp}</p>
              </div>
            </div>
          </Card>
          
          <Card 
            className={`p-2 md:p-2.5 border-border cursor-pointer transition-all duration-200 ${
              statusFilter === "no_show" 
                ? "border-primary shadow-lg shadow-primary/20 bg-primary/5" 
                : "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            }`}
            onClick={() => setStatusFilter(statusFilter === "no_show" ? "all" : "no_show")}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">No Show</p>
                <p className="text-lg md:text-xl font-bold mt-0.5">{noShow}</p>
              </div>
            </div>
          </Card>
          
          <Card 
            className={`p-2 md:p-2.5 border-border cursor-pointer transition-all duration-200 ${
              statusFilter === "cancelled" 
                ? "border-primary shadow-lg shadow-primary/20 bg-primary/5" 
                : "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            }`}
            onClick={() => setStatusFilter(statusFilter === "cancelled" ? "all" : "cancelled")}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Canceled</p>
                <p className="text-lg md:text-xl font-bold mt-0.5">{cancelled}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-2 md:p-2.5 border-border">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Proj. Revenue</p>
                <p className="text-lg md:text-xl font-bold mt-0.5 text-primary">
                  ${projectedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3">
            {requestedClientId && (
              <div className="text-sm text-muted-foreground">
                Showing appointments for{' '}
                <span className="font-semibold text-foreground">
                  {activeClientName || 'selected client'}
                </span>
              </div>
            )}
            <div className={`flex ${isMobile ? 'flex-row' : 'items-center'} gap-2 sm:gap-3 ${isMobile ? 'order-2' : ''}`}>
              <Button
                onClick={() => setActiveView("groomer")}
                aria-pressed={activeView === "groomer"}
                variant="outline"
                className={`${viewToggleBaseClassName} ${
                  activeView === "groomer" 
                    ? viewToggleActiveClassName
                    : viewToggleInactiveClassName
                }`}
              >
                Groomers
              </Button>
              <Button
                onClick={() => setActiveView("list")}
                aria-pressed={activeView === "list"}
                variant="outline"
                className={`${viewToggleBaseClassName} ${
                  activeView === "list" 
                    ? viewToggleActiveClassName
                    : viewToggleInactiveClassName
                }`}
              >
                List
              </Button>
              <Button
                onClick={() => setActiveView("calendar")}
                aria-pressed={activeView === "calendar"}
                variant="outline"
                className={`${viewToggleBaseClassName} ${
                  activeView === "calendar" 
                    ? viewToggleActiveClassName
                    : viewToggleInactiveClassName
                }`}
              >
                Calendar
              </Button>
            </div>
          </div>

          <div className={`${isMobile ? 'w-full order-1' : ''}`}>
            <Button 
              data-testid="appointments-new"
              onClick={() => navigate(requestedClientId ? `/appointments/new?clientId=${requestedClientId}` : '/appointments/new')}
              className={`bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-all duration-200 hover:scale-[1.02] ${isMobile ? 'w-full' : ''}`}
            >
              <Plus size={18} className="mr-2" />
              New Appointment
            </Button>
          </div>
        </div>

        <div className="mt-6">
          {activeView === "calendar" && (
            <CalendarView
              statusFilter={statusFilter}
              clientIdFilter={requestedClientId}
              requestedAppointmentId={requestedAppointmentId}
              currentDate={dateContexts.calendar.currentDate}
              viewMode={dateContexts.calendar.viewMode}
              onCurrentDateChange={(currentDate) => updateDateContext('calendar', { currentDate })}
              onViewModeChange={(viewMode) => updateDateContext('calendar', { viewMode })}
            />
          )}
          {activeView === "list" && (
            <ListView
              statusFilter={statusFilter}
              clientIdFilter={requestedClientId}
              requestedAppointmentId={requestedAppointmentId}
              currentDate={dateContexts.list.currentDate}
              viewMode={dateContexts.list.viewMode}
              onCurrentDateChange={(currentDate) => updateDateContext('list', { currentDate })}
              onViewModeChange={(viewMode) => updateDateContext('list', { viewMode })}
            />
          )}
          {activeView === "groomer" && (
            <GroomerView
              statusFilter={statusFilter}
              clientIdFilter={requestedClientId}
              requestedAppointmentId={requestedAppointmentId}
              currentDate={dateContexts.groomer.currentDate}
              viewMode={dateContexts.groomer.viewMode}
              onCurrentDateChange={(currentDate) => updateDateContext('groomer', { currentDate })}
              onViewModeChange={(viewMode) => updateDateContext('groomer', { viewMode })}
            />
          )}
        </div>
      </div>
    </div>
  )
}
