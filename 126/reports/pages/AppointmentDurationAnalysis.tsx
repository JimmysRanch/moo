/**
 * Appointment Duration Analysis Report
 * Efficiency by breed and service pairing
 */

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Info, ArrowsClockwise } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { ChartCard, SimpleBarChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData } from '../hooks/useReportData'

export function AppointmentDurationAnalysis() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate duration by breed + service
  const durationData = useMemo(() => {
    const byCombo: Record<string, { totalDuration: number; count: number; revenue: number }> = {}

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      const breed = appt.petBreed || 'Unknown'
      
      appt.services?.forEach((svc) => {
        const serviceName = svc.name || 'Unknown'
        const key = `${breed} - ${serviceName}`
        
        if (!byCombo[key]) {
          byCombo[key] = { totalDuration: 0, count: 0, revenue: 0 }
        }
        byCombo[key].totalDuration += appt.durationMinutes || 60
        byCombo[key].count += 1
        byCombo[key].revenue += svc.priceCents || 0
      })
    })

    return Object.entries(byCombo).map(([combo, data]) => ({
      combo,
      avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
      count: data.count,
      revenue: data.revenue,
      revenuePerMin: data.totalDuration > 0 ? Math.round(data.revenue / data.totalDuration) : 0,
    }))
  }, [appointments])

  // KPIs
  const kpis = useMemo(() => {
    const totalDuration = durationData.reduce((sum, d) => sum + d.avgDuration * d.count, 0)
    const totalCount = durationData.reduce((sum, d) => sum + d.count, 0)
    const avgDuration = totalCount > 0 ? Math.round(totalDuration / totalCount) : 0
    
    const fastest = durationData.filter(d => d.count >= 3).sort((a, b) => a.avgDuration - b.avgDuration)[0]
    const slowest = durationData.filter(d => d.count >= 3).sort((a, b) => b.avgDuration - a.avgDuration)[0]

    return [
      { metricId: 'avgDuration', value: { current: avgDuration, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'uniqueCombos', value: { current: durationData.length, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'fastestAvg', value: { current: fastest?.avgDuration || 0, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'slowestAvg', value: { current: slowest?.avgDuration || 0, delta: 0, deltaPercent: 0, format: 'number' as const } },
    ]
  }, [durationData])

  // Chart data - top 10 by count
  const chartData = useMemo(() => {
    return durationData
      .filter(d => d.count >= 3)
      .sort((a, b) => a.avgDuration - b.avgDuration)
      .slice(0, 10)
      .map(d => ({
        label: d.combo.length > 20 ? d.combo.substring(0, 18) + '...' : d.combo,
        value: d.avgDuration,
      }))
  }, [durationData])

  // Table data
  const tableData = useMemo(() => {
    return durationData
      .sort((a, b) => b.count - a.count)
      .map(d => ({
        dimensionValue: d.combo,
        drillKey: `combo:${d.combo}`,
        metrics: {
          avgDuration: d.avgDuration,
          count: d.count,
          revenue: d.revenue,
          revenuePerMin: d.revenuePerMin,
        },
      }))
  }, [durationData])

  if (isLoading) {
    return (
      <ReportShell title="Appointment Duration Analysis" description="Duration analysis" defaultTimeBasis="service">
        <Skeleton className="h-[400px]" />
      </ReportShell>
    )
  }

  if (error) {
    return (
      <ReportShell title="Appointment Duration Analysis" description="Duration analysis" defaultTimeBasis="service">
        <Alert variant="destructive"><AlertDescription>Failed to load data.</AlertDescription></Alert>
        <Button onClick={() => window.location.reload()} className="mt-4"><ArrowsClockwise className="mr-2 h-4 w-4" /> Retry</Button>
      </ReportShell>
    )
  }

  if (appointments.length === 0) {
    return (
      <ReportShell title="Appointment Duration Analysis" description="Duration analysis" defaultTimeBasis="service">
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data</h2>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
      </ReportShell>
    )
  }

  return (
    <>
      <ReportShell title="Appointment Duration Analysis" description="Efficiency by breed and service pairing" defaultTimeBasis="service" onShowDefinitions={() => setShowDefinitions(true)}>
        <KPIDeck metrics={kpis} />

        <ChartCard title="Fastest Breed/Service Combos" description="Average duration in minutes (min 3 occurrences)" ariaLabel="Bar chart of appointment durations">
          <SimpleBarChart data={chartData} height={280} formatValue={(v) => `${v} min`} />
        </ChartCard>

        <DataTable
          title="Duration by Breed/Service"
          data={tableData}
          columns={[
            { id: 'avgDuration', label: 'Avg Duration (min)', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'count', label: 'Occurrences', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'revenuePerMin', label: '$/Min', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={20}
          showViewAll
        />
      </ReportShell>
      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
