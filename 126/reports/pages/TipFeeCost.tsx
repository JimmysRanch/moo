/**
 * Tip Fee Cost Report
 * Track tip processing fees and net amounts to staff
 */

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Info, ArrowsClockwise } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { DataTable } from '../components/DataTable'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData } from '../hooks/useReportData'
import { calculateTotalTips, calculateKPIWithDelta, measurePerformance } from '../engine/analyticsEngine'

const TIP_FEE_RATE = 0.029 // 2.9% typical processing fee

export function TipFeeCost() {
  const { filters, setFilters } = useReportFilters()
  const { 
    appointments, 
    previousAppointments,
    isLoading, 
    error 
  } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate KPIs with period comparison
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateTipFeeCostKPIs', () => {
      const currentTotalTips = calculateTotalTips(appointments)
      const previousTotalTips = calculateTotalTips(previousAppointments)
      
      const currentTipFees = Math.round(currentTotalTips * TIP_FEE_RATE)
      const previousTipFees = Math.round(previousTotalTips * TIP_FEE_RATE)
      
      const currentNetToStaff = currentTotalTips - currentTipFees
      const previousNetToStaff = previousTotalTips - previousTipFees
      
      const completedAppts = appointments.filter(a => a.status === 'picked_up').length
      const previousCompletedAppts = previousAppointments.filter(a => a.status === 'picked_up').length
      const currentAvgTip = completedAppts > 0 ? Math.round(currentTotalTips / completedAppts) : 0
      const previousAvgTip = previousCompletedAppts > 0 ? Math.round(previousTotalTips / previousCompletedAppts) : 0

      return [
        { metricId: 'totalTips', value: calculateKPIWithDelta(currentTotalTips, previousTotalTips, 'money') },
        { metricId: 'tipFees', value: calculateKPIWithDelta(currentTipFees, previousTipFees, 'money') },
        { metricId: 'netToStaff', value: calculateKPIWithDelta(currentNetToStaff, previousNetToStaff, 'money') },
        { metricId: 'avgTipPerAppt', value: calculateKPIWithDelta(currentAvgTip, previousAvgTip, 'money') },
      ]
    })
  }, [appointments, previousAppointments])

  // Table data by staff
  const tableData = useMemo(() => {
    return measurePerformance('aggregateTipsByStaff', () => {
      const staffTips: Record<string, { tips: number; appointments: number }> = {}
      
      // Only count completed appointments
      const completedAppointments = appointments.filter(a => a.status === 'picked_up')

      completedAppointments.forEach(appt => {
        const staffName = appt.groomerName || 'Unassigned'
        if (!staffTips[staffName]) {
          staffTips[staffName] = { tips: 0, appointments: 0 }
        }
        staffTips[staffName].tips += appt.tipCents
        staffTips[staffName].appointments += 1
      })

      return Object.entries(staffTips)
        .map(([name, data]) => {
          const tipFee = Math.round(data.tips * TIP_FEE_RATE)
          return {
            dimensionValue: name,
            drillKey: `staff:${name}`,
            metrics: {
              tips: data.tips,
              tipFee,
              netToStaff: data.tips - tipFee,
              appointments: data.appointments,
              avgTip: data.appointments > 0 ? Math.round(data.tips / data.appointments) : 0,
            },
          }
        })
        .sort((a, b) => b.metrics.tips - a.metrics.tips)
    })
  }, [appointments])

  if (isLoading) {
    return (
      <ReportShell title="Tip Fee Cost" description="Tip processing fees and net amounts" defaultTimeBasis="checkout">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-3"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-24" /></Card>
            ))}
          </div>
          <Skeleton className="h-[300px]" />
        </div>
      </ReportShell>
    )
  }

  if (error) {
    return (
      <ReportShell title="Tip Fee Cost" description="Tip processing fees and net amounts" defaultTimeBasis="checkout">
        <Alert variant="destructive">
          <AlertDescription>Failed to load data.</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} className="mt-4">
          <ArrowsClockwise className="mr-2 h-4 w-4" /> Retry
        </Button>
      </ReportShell>
    )
  }

  if (appointments.length === 0) {
    return (
      <ReportShell title="Tip Fee Cost" description="Tip processing fees and net amounts" defaultTimeBasis="checkout">
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data</h2>
          <p className="text-muted-foreground mb-4">No appointments with tips found.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
      </ReportShell>
    )
  }

  return (
    <>
      <ReportShell
        title="Tip Fee Cost"
        description="Track tip processing fees and net amounts to staff"
        defaultTimeBasis="checkout"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <DataTable
          title="Tip Fees by Staff"
          data={tableData}
          columns={[
            { id: 'tips', label: 'Total Tips', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'tipFee', label: 'Tip Fees', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'netToStaff', label: 'Net to Staff', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'appointments', label: 'Appointments', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgTip', label: 'Avg Tip', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
