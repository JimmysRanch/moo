/**
 * Payment Type Revenue Report
 * Revenue distribution across accepted payment methods
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

export function PaymentTypeRevenue() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate payment type metrics
  const paymentData = useMemo(() => {
    const byType: Record<string, { revenue: number; count: number; tips: number }> = {}

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      const paymentMethod = appt.paymentMethod || 'Unknown'
      
      if (!byType[paymentMethod]) {
        byType[paymentMethod] = { revenue: 0, count: 0, tips: 0 }
      }
      byType[paymentMethod].revenue += appt.netCents || 0
      byType[paymentMethod].count += 1
      byType[paymentMethod].tips += appt.tipCents || 0
    })

    const total = Object.values(byType).reduce((sum, t) => sum + t.revenue, 0)

    return Object.entries(byType).map(([type, data]) => ({
      type,
      revenue: data.revenue,
      count: data.count,
      tips: data.tips,
      share: total > 0 ? (data.revenue / total) * 100 : 0,
    }))
  }, [appointments])

  // KPIs
  const kpis = useMemo(() => {
    const totalRevenue = paymentData.reduce((sum, p) => sum + p.revenue, 0)
    const cardRevenue = paymentData.filter(p => 
      p.type.toLowerCase().includes('card') || p.type.toLowerCase().includes('credit')
    ).reduce((sum, p) => sum + p.revenue, 0)
    const cashRevenue = paymentData.filter(p => 
      p.type.toLowerCase().includes('cash')
    ).reduce((sum, p) => sum + p.revenue, 0)

    return [
      { metricId: 'totalRevenue', value: { current: totalRevenue, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'cardRevenue', value: { current: cardRevenue, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'cashRevenue', value: { current: cashRevenue, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'paymentMethods', value: { current: paymentData.length, delta: 0, deltaPercent: 0, format: 'number' as const } },
    ]
  }, [paymentData])

  // Table data
  const tableData = useMemo(() => {
    return paymentData
      .sort((a, b) => b.revenue - a.revenue)
      .map(payment => ({
        dimensionValue: payment.type,
        drillKey: `payment:${payment.type}`,
        metrics: {
          revenue: payment.revenue,
          transactions: payment.count,
          tips: payment.tips,
          share: payment.share,
          avgTicket: payment.count > 0 ? Math.round(payment.revenue / payment.count) : 0,
        },
      }))
  }, [paymentData])

  // Chart data
  const pieData = useMemo(() => {
    return paymentData
      .sort((a, b) => b.revenue - a.revenue)
      .map(payment => ({
        label: payment.type,
        value: payment.revenue,
      }))
  }, [paymentData])

  if (isLoading) {
    return (
      <ReportShell title="Payment Type Revenue" description="Revenue by payment method" defaultTimeBasis="checkout">
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
      <ReportShell title="Payment Type Revenue" description="Revenue by payment method" defaultTimeBasis="checkout">
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
      <ReportShell title="Payment Type Revenue" description="Revenue by payment method" defaultTimeBasis="checkout">
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
        title="Payment Type Revenue"
        description="Revenue distribution across accepted payment methods"
        defaultTimeBasis="checkout"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Revenue by Payment Method" description="Distribution of revenue across tenders" ariaLabel="Pie chart of payment methods">
          <SimplePieChart data={pieData} height={280} formatValue={formatMoney} />
        </ChartCard>

        <DataTable
          title="Payment Method Details"
          data={tableData}
          columns={[
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'transactions', label: 'Transactions', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'share', label: 'Share %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'tips', label: 'Tips', format: 'money', align: 'right', sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
