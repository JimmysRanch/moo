/**
 * Discount Impact Report
 * Analyze discount usage and impact on revenue
 */

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Info, ArrowsClockwise } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { ChartCard, SimplePieChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData } from '../hooks/useReportData'
import { calculateTotalDiscounts, calculateKPIWithDelta, measurePerformance } from '../engine/analyticsEngine'

export function DiscountImpact() {
  const { filters, setFilters } = useReportFilters()
  const { 
    appointments, 
    previousAppointments,
    isLoading, 
    error 
  } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate discount metrics
  const discountData = useMemo(() => {
    return measurePerformance('aggregateDiscountData', () => {
      const byType: Record<string, { count: number; amount: number; grossBefore: number }> = {}
      let totalAppointments = 0
      let appointmentsWithDiscount = 0
      let totalDiscounts = 0
      let totalGross = 0

      appointments.filter(a => a.status === 'picked_up').forEach(appt => {
        totalAppointments++
        totalGross += appt.subtotalCents
        
        if (appt.discountCents > 0) {
          appointmentsWithDiscount++
          totalDiscounts += appt.discountCents
          
          // Group by discount reason if available, otherwise "General"
          const discountType = 'General Discount'
          if (!byType[discountType]) {
            byType[discountType] = { count: 0, amount: 0, grossBefore: 0 }
          }
          byType[discountType].count += 1
          byType[discountType].amount += appt.discountCents
          byType[discountType].grossBefore += appt.subtotalCents
        }
      })

      return {
        totalDiscounts,
        totalGross,
        appointmentsWithDiscount,
        totalAppointments,
        discountRate: totalAppointments > 0 ? (appointmentsWithDiscount / totalAppointments) * 100 : 0,
        avgDiscount: appointmentsWithDiscount > 0 ? Math.round(totalDiscounts / appointmentsWithDiscount) : 0,
        byType: Object.entries(byType).map(([type, data]) => ({
          type,
          count: data.count,
          amount: data.amount,
          avgDiscount: data.count > 0 ? Math.round(data.amount / data.count) : 0,
          share: totalDiscounts > 0 ? (data.amount / totalDiscounts) * 100 : 0,
        })),
      }
    })
  }, [appointments])

  // KPIs with period comparison
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateDiscountKPIs', () => {
      const currentDiscounts = calculateTotalDiscounts(appointments)
      const previousDiscounts = calculateTotalDiscounts(previousAppointments)
      
      const currentCompleted = appointments.filter(a => a.status === 'picked_up')
      const previousCompleted = previousAppointments.filter(a => a.status === 'picked_up')
      
      const currentWithDiscount = currentCompleted.filter(a => a.discountCents > 0).length
      const previousWithDiscount = previousCompleted.filter(a => a.discountCents > 0).length
      
      const currentDiscountRate = currentCompleted.length > 0 ? (currentWithDiscount / currentCompleted.length) * 100 : 0
      const previousDiscountRate = previousCompleted.length > 0 ? (previousWithDiscount / previousCompleted.length) * 100 : 0
      
      const currentAvgDiscount = currentWithDiscount > 0 ? Math.round(currentDiscounts / currentWithDiscount) : 0
      const previousAvgDiscount = previousWithDiscount > 0 ? Math.round(previousDiscounts / previousWithDiscount) : 0

      return [
        { metricId: 'totalDiscounts', value: calculateKPIWithDelta(currentDiscounts, previousDiscounts, 'money') },
        { metricId: 'discountRate', value: calculateKPIWithDelta(currentDiscountRate, previousDiscountRate, 'percent') },
        { metricId: 'avgDiscount', value: calculateKPIWithDelta(currentAvgDiscount, previousAvgDiscount, 'money') },
        { metricId: 'appointmentsWithDiscount', value: calculateKPIWithDelta(currentWithDiscount, previousWithDiscount, 'number') },
      ]
    })
  }, [appointments, previousAppointments])

  // Table data
  const tableData = useMemo(() => {
    return discountData.byType
      .sort((a, b) => b.amount - a.amount)
      .map(d => ({
        dimensionValue: d.type,
        drillKey: `discount:${d.type}`,
        metrics: {
          amount: d.amount,
          count: d.count,
          avgDiscount: d.avgDiscount,
          share: d.share,
        },
      }))
  }, [discountData])

  // Chart data
  const pieData = useMemo(() => {
    return discountData.byType.map(d => ({
      label: d.type,
      value: d.amount,
    }))
  }, [discountData])

  if (isLoading) {
    return (
      <ReportShell title="Discount Impact" description="Discount analysis" defaultTimeBasis="checkout">
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
      <ReportShell title="Discount Impact" description="Discount analysis" defaultTimeBasis="checkout">
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
      <ReportShell title="Discount Impact" description="Discount analysis" defaultTimeBasis="checkout">
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data</h2>
          <p className="text-muted-foreground mb-4">No completed appointments found.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
      </ReportShell>
    )
  }

  const formatMoney = (v: number) => `$${(v / 100).toLocaleString()}`

  return (
    <>
      <ReportShell
        title="Discount Impact"
        description="Analyze discount usage and impact on revenue"
        defaultTimeBasis="checkout"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        {discountData.byType.length > 0 && (
          <ChartCard title="Discounts by Type" description="Distribution of discounts" ariaLabel="Pie chart of discount types">
            <SimplePieChart data={pieData} height={280} formatValue={formatMoney} />
          </ChartCard>
        )}

        <DataTable
          title="Discount Breakdown"
          data={tableData}
          columns={[
            { id: 'amount', label: 'Total Amount', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'count', label: 'Times Used', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgDiscount', label: 'Avg Discount', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'share', label: 'Share %', format: 'percent', align: 'right', sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
