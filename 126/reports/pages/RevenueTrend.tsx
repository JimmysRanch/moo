/**
 * Revenue Trend Report
 * Month-over-month performance with retail contribution
 */

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Info, ArrowsClockwise } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { ChartCard, SimpleLineChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData } from '../hooks/useReportData'

export function RevenueTrend() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, transactions, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate monthly trend data
  const trendData = useMemo(() => {
    const byMonth: Record<string, { service: number; retail: number; tips: number; count: number }> = {}

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      const date = new Date(appt.serviceDate)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { service: 0, retail: 0, tips: 0, count: 0 }
      }
      byMonth[monthKey].service += appt.netCents || 0
      byMonth[monthKey].tips += appt.tipCents || 0
      byMonth[monthKey].count += 1
    })

    // Add retail from transactions
    transactions.forEach(tx => {
      if (tx.type === 'retail' || tx.isRetail) {
        const date = new Date(tx.date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (!byMonth[monthKey]) {
          byMonth[monthKey] = { service: 0, retail: 0, tips: 0, count: 0 }
        }
        byMonth[monthKey].retail += tx.amountCents || 0
      }
    })

    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        total: data.service + data.retail,
        service: data.service,
        retail: data.retail,
        tips: data.tips,
        appointments: data.count,
      }))
  }, [appointments, transactions])

  // KPIs
  const kpis = useMemo(() => {
    const current = trendData[trendData.length - 1]
    const previous = trendData[trendData.length - 2]
    
    const currentTotal = current?.total || 0
    const previousTotal = previous?.total || 0
    const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0
    const avgMonthly = trendData.length > 0 
      ? Math.round(trendData.reduce((sum, m) => sum + m.total, 0) / trendData.length)
      : 0

    return [
      { metricId: 'currentMonth', value: { current: currentTotal, delta: currentTotal - previousTotal, deltaPercent: growth, format: 'money' as const } },
      { metricId: 'avgMonthly', value: { current: avgMonthly, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'totalService', value: { current: current?.service || 0, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'totalRetail', value: { current: current?.retail || 0, delta: 0, deltaPercent: 0, format: 'money' as const } },
    ]
  }, [trendData])

  // Table data
  const tableData = useMemo(() => {
    return trendData.map(m => ({
      dimensionValue: m.month,
      drillKey: `month:${m.month}`,
      metrics: {
        total: m.total,
        service: m.service,
        retail: m.retail,
        tips: m.tips,
        appointments: m.appointments,
        retailShare: m.total > 0 ? (m.retail / m.total) * 100 : 0,
      },
    }))
  }, [trendData])

  // Chart data
  const chartData = useMemo(() => {
    return trendData.map(m => ({
      label: m.month,
      value: m.total,
    }))
  }, [trendData])

  if (isLoading) {
    return (
      <ReportShell title="Revenue Trend" description="Month-over-month performance" defaultTimeBasis="service">
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
      <ReportShell title="Revenue Trend" description="Month-over-month performance" defaultTimeBasis="service">
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
      <ReportShell title="Revenue Trend" description="Month-over-month performance" defaultTimeBasis="service">
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
        title="Revenue Trend"
        description="Month-over-month performance with retail contribution"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Monthly Revenue" description="Total revenue trend over time" ariaLabel="Line chart of monthly revenue">
          <SimpleLineChart data={chartData} height={280} formatValue={formatMoney} showArea />
        </ChartCard>

        <DataTable
          title="Monthly Breakdown"
          data={tableData}
          columns={[
            { id: 'total', label: 'Total Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'service', label: 'Service', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'retail', label: 'Retail', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'tips', label: 'Tips', format: 'money', align: 'right', sortable: true },
            { id: 'appointments', label: 'Appointments', format: 'number', align: 'right', sortable: true },
            { id: 'retailShare', label: 'Retail %', format: 'percent', align: 'right', sortable: true },
          ]}
          maxPreviewRows={12}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
