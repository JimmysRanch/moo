import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookedGauge } from './dashboard/components/BookedGauge'
import { RecentActivity } from './dashboard/components/RecentActivity'
import { GroomersWorkloadCard } from './dashboard/components/GroomersWorkloadCard'
import { GroomerAvgCard } from './dashboard/components/GroomerAvgCard'
import { ExpensesCard } from './dashboard/components/ExpensesCard'
import { DogsGroomedCard } from './dashboard/components/DogsGroomedCard'
import { BookedPercentageCard } from './dashboard/components/BookedPercentageCard'
import { ClientsCard } from './dashboard/components/ClientsCard'
import { calculateAppointmentProgress } from './dashboard/utils/dashboardCalculations'
import { CheckCircle, XCircle, Clock, Warning } from '@phosphor-icons/react'
import { useAppearance } from '@/hooks/useAppearance'
import { cn } from '@/lib/utils'
import { useDashboardData } from './dashboard/hooks/useDashboardData'

function AnimatedNumber({ value, delay = 0, prefix = '', suffix = '' }: { value: number; delay?: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      let current = 0
      const increment = value / 60
      const interval = setInterval(() => {
        current += increment
        if (current >= value) {
          setCount(value)
          clearInterval(interval)
        } else {
          setCount(Math.floor(current))
        }
      }, 16)
      return () => clearInterval(interval)
    }, delay * 1000)
    return () => clearTimeout(timer)
  }, [value, delay])

  return (
    <span>
      {prefix}{count}{suffix}
    </span>
  )
}

export function Dashboard() {
  const { selectedTheme } = useAppearance()
  const {
    appointmentsSummary,
    capacitySummary,
    revenueSummary,
    issuesSummary,
    dogsGroomedSummary,
    bookedPercentageSummary,
    clientsSummary,
    groomerData,
    groomerLifetimeData,
    recentActivity,
    expensesData,
  } = useDashboardData()
  
  const appointmentStats = appointmentsSummary
  const capacityStats = capacitySummary
  const revenueStats = revenueSummary
  const issuesStats = issuesSummary
  const dogsGroomedStats = dogsGroomedSummary
  const bookedStats = bookedPercentageSummary
  const clientsStats = clientsSummary
  const progress = calculateAppointmentProgress(appointmentStats)
  const isSweetBlueTheme =
    selectedTheme === 'sweet-blue' || selectedTheme === 'steel-noir' || selectedTheme === 'blue-steel'
  const dashboardPanelClassName = cn(
    'bg-card rounded-xl p-3 border border-border flex flex-col overflow-hidden',
    isSweetBlueTheme && 'dashboard-panel'
  )
  const dashboardInteractivePanelClassName = cn(
    dashboardPanelClassName,
    'transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  )
  const dashboardMetricRowClassName = cn(
    'flex items-center justify-between p-1.5 rounded-lg flex-shrink-0',
    isSweetBlueTheme && 'dashboard-metric-row'
  )
  const dashboardProgressTrackClassName = cn(
    'h-1.5 bg-secondary rounded-full overflow-hidden',
    isSweetBlueTheme && 'dashboard-progress-track'
  )
  const dashboardInsetClassName = cn(
    'rounded-lg border border-border/60 bg-secondary/20',
    isSweetBlueTheme && 'dashboard-inset'
  )
  return (
    <div data-testid="page-dashboard" className="h-full overflow-hidden bg-background p-3">
      <div className="h-full grid grid-rows-3 gap-3">
        <div className="grid grid-cols-4 gap-3">
          <div className={dashboardPanelClassName}>
            <h2 className="text-sm font-semibold mb-1.5 flex-shrink-0">Appointments Today</h2>
            <div className="flex-1 min-h-0 flex flex-col justify-between">
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs flex-shrink-0">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-muted-foreground truncate">Scheduled</span>
                </div>
                <div className="font-semibold text-right">
                  <AnimatedNumber value={appointmentStats.today.scheduled} delay={0.1} />
                </div>
                
                <div className="flex items-center gap-1">
                  <CheckCircle size={10} className="text-green-500 flex-shrink-0" weight="fill" />
                  <span className="text-muted-foreground truncate">Completed</span>
                </div>
                <div className="font-semibold text-right">
                  <AnimatedNumber value={appointmentStats.today.completed} delay={0.15} />
                </div>
                
                <div className="flex items-center gap-1">
                  <XCircle size={10} className="text-red-500 flex-shrink-0" weight="fill" />
                  <span className="text-muted-foreground truncate">Canceled</span>
                </div>
                <div className="font-semibold text-right">
                  <AnimatedNumber value={appointmentStats.today.canceled} delay={0.2} />
                </div>
                
                <div className="flex items-center gap-1">
                  <Warning size={10} className="text-orange-500 flex-shrink-0" weight="fill" />
                  <span className="text-muted-foreground truncate">No-Shows</span>
                </div>
                <div className="font-semibold text-right">
                  <AnimatedNumber value={appointmentStats.today.noShows} delay={0.25} />
                </div>
                
                <div className="flex items-center gap-1">
                  <Clock size={10} className="text-yellow-500 flex-shrink-0" weight="fill" />
                  <span className="text-muted-foreground truncate">Late</span>
                </div>
                <div className="font-semibold text-right">
                  <AnimatedNumber value={appointmentStats.today.late} delay={0.3} />
                </div>
              </div>

              <div className="space-y-0.5 mt-1.5 flex-shrink-0">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Day Progress</span>
                  <span>
                    <AnimatedNumber value={progress.completed} delay={0.35} /> / <AnimatedNumber value={progress.total} delay={0.35} />
                  </span>
                </div>
                <div
                  className={isSweetBlueTheme
                    ? `${dashboardProgressTrackClassName} ${dashboardInsetClassName}`
                    : dashboardProgressTrackClassName}
                >
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progress.percentageComplete}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={dashboardPanelClassName}>
            <h2 className="text-sm font-semibold mb-2 flex-shrink-0">Booked</h2>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <BookedGauge 
                percentage={capacityStats.bookedPercentage} 
                target={capacityStats.target}
                delay={0.2}
                isSweetBlueTheme={isSweetBlueTheme}
              />
            </div>
          </div>

          <div className={dashboardPanelClassName}>
            <h2 className="text-sm font-semibold mb-1.5 flex-shrink-0">Expected Revenue</h2>
            <div className="flex-1 min-h-0 flex flex-col justify-between">
              {isSweetBlueTheme ? (
                <>
                  <div className={`${dashboardInsetClassName} p-2.5 flex-shrink-0`}>
                    <div className="text-2xl font-bold">
                      <AnimatedNumber value={revenueStats.today.total} delay={0.3} prefix="$" />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Total Revenue Today</div>
                  </div>

                  <div className={`${dashboardInsetClassName} pt-1.5 px-2.5 pb-2 space-y-1 flex-shrink-0`}>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Profit After Commissions</span>
                      <span className="font-semibold text-green-500">
                        <AnimatedNumber value={revenueStats.today.profit} delay={0.35} prefix="$" />
                      </span>
                    </div>

                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Tips (excluded)</span>
                      <span className="font-medium">
                        <AnimatedNumber value={revenueStats.today.tips} delay={0.4} prefix="$" />
                      </span>
                    </div>

                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Commission estimate</span>
                      <span className="font-medium">
                        <AnimatedNumber value={revenueStats.today.commission} delay={0.45} prefix="$" />
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-shrink-0">
                    <div className="text-2xl font-bold">
                      <AnimatedNumber value={revenueStats.today.total} delay={0.3} prefix="$" />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Total Revenue Today</div>
                  </div>

                  <div className="pt-1.5 border-t border-border space-y-0.5 flex-shrink-0">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Profit After Commissions</span>
                      <span className="font-semibold text-green-500">
                        <AnimatedNumber value={revenueStats.today.profit} delay={0.35} prefix="$" />
                      </span>
                    </div>

                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Tips (excluded)</span>
                      <span className="font-medium">
                        <AnimatedNumber value={revenueStats.today.tips} delay={0.4} prefix="$" />
                      </span>
                    </div>

                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Commission estimate</span>
                      <span className="font-medium">
                        <AnimatedNumber value={revenueStats.today.commission} delay={0.45} prefix="$" />
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={dashboardPanelClassName}>
            <h2 className="text-sm font-semibold mb-1.5 flex-shrink-0">Issues</h2>
            <div className="flex-1 min-h-0 flex flex-col justify-between gap-1">
              <div className={`${dashboardMetricRowClassName} bg-destructive/10`}>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-yellow-500 flex-shrink-0" weight="duotone" />
                  <span className="text-xs truncate">Late arrivals</span>
                </div>
                <div className="text-lg font-bold">
                  <AnimatedNumber value={issuesStats.lateArrivals} delay={0.35} />
                </div>
              </div>
              
              <div className={`${dashboardMetricRowClassName} bg-destructive/10`}>
                <div className="flex items-center gap-1.5">
                  <Warning size={14} className="text-orange-500 flex-shrink-0" weight="duotone" />
                  <span className="text-xs truncate">No-shows</span>
                </div>
                <div className="text-lg font-bold">
                  <AnimatedNumber value={issuesStats.noShows} delay={0.4} />
                </div>
              </div>
              
              <div className={`${dashboardMetricRowClassName} bg-destructive/10`}>
                <div className="flex items-center gap-1.5">
                  <XCircle size={14} className="text-red-500 flex-shrink-0" weight="duotone" />
                  <span className="text-xs truncate">Canceled</span>
                </div>
                <div className="text-lg font-bold">
                  <AnimatedNumber value={issuesStats.canceled} delay={0.45} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Link
            to="/recent-activity"
            className={`col-span-2 ${dashboardInteractivePanelClassName}`}
          >
            <h2 className="text-sm font-semibold mb-1.5 flex-shrink-0">Recent Activity</h2>
            <div className="overflow-y-auto scrollbar-thin flex-1 min-h-0">
              <RecentActivity data={recentActivity} isSweetBlueTheme={isSweetBlueTheme} />
            </div>
          </Link>

          <div className={dashboardPanelClassName}>
            <h2 className="text-sm font-semibold mb-1.5 flex-shrink-0">Groomers Workload</h2>
            <div className="flex-1 min-h-0 overflow-hidden">
              <GroomersWorkloadCard data={groomerData} isSweetBlueTheme={isSweetBlueTheme} />
            </div>
          </div>

          <div className={dashboardPanelClassName}>
            <h2 className="text-sm font-semibold mb-1.5 flex-shrink-0">Groomer Lifetime Average</h2>
            <div className="flex-1 min-h-0 overflow-hidden">
              <GroomerAvgCard data={groomerLifetimeData} isSweetBlueTheme={isSweetBlueTheme} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className={dashboardPanelClassName}>
            <div className="mb-1.5 flex-shrink-0">
              <h2 className="text-sm font-semibold">Expenses</h2>
              <p className="text-[10px] text-muted-foreground">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <ExpensesCard data={expensesData} isSweetBlueTheme={isSweetBlueTheme} />
            </div>
          </div>

          <div className={dashboardPanelClassName}>
            <div className="mb-1.5 flex-shrink-0">
              <h2 className="text-sm font-semibold">Completed Appointments</h2>
              <p className="text-[10px] text-muted-foreground">Appointment History</p>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <DogsGroomedCard data={dogsGroomedStats} isSweetBlueTheme={isSweetBlueTheme} />
            </div>
          </div>

          <div className={dashboardPanelClassName}>
            <div className="mb-1.5 flex-shrink-0">
              <h2 className="text-sm font-semibold">Booked %</h2>
              <p className="text-[10px] text-muted-foreground">Store Capacity</p>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <BookedPercentageCard data={bookedStats} isSweetBlueTheme={isSweetBlueTheme} />
            </div>
          </div>

          <div className={dashboardPanelClassName}>
            <div className="mb-1.5 flex-shrink-0">
              <h2 className="text-sm font-semibold">Clients</h2>
              <p className="text-[10px] text-muted-foreground">Client Metrics</p>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <ClientsCard data={clientsStats} isSweetBlueTheme={isSweetBlueTheme} />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
