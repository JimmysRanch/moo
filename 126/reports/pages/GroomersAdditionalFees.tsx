/**
 * Groomers Additional Fees Report
 * Track additional fees charged by each groomer
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

export function GroomersAdditionalFees() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, staff, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate additional fees by groomer
  const groomerData = useMemo(() => {
    const byGroomer: Record<string, { fees: number; appointments: number; revenue: number; feeCount: number }> = {}

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      const groomerId = appt.groomerId || 'unassigned'
      const groomer = staff.find(s => s.id === groomerId)
      const groomerName = groomer?.name || 'Unassigned'
      
      if (!byGroomer[groomerName]) {
        byGroomer[groomerName] = { fees: 0, appointments: 0, revenue: 0, feeCount: 0 }
      }
      
      const additionalFees = appt.additionalFeesCents || 0
      byGroomer[groomerName].fees += additionalFees
      byGroomer[groomerName].appointments += 1
      byGroomer[groomerName].revenue += appt.netCents || 0
      if (additionalFees > 0) byGroomer[groomerName].feeCount += 1
    })

    return Object.entries(byGroomer).map(([name, data]) => ({
      name,
      fees: data.fees,
      appointments: data.appointments,
      revenue: data.revenue,
      feeCount: data.feeCount,
      avgFee: data.feeCount > 0 ? Math.round(data.fees / data.feeCount) : 0,
      feeRate: data.appointments > 0 ? (data.feeCount / data.appointments) * 100 : 0,
    }))
  }, [appointments, staff])

  // KPIs
  const kpis = useMemo(() => {
    const totalFees = groomerData.reduce((sum, g) => sum + g.fees, 0)
    const totalFeeCount = groomerData.reduce((sum, g) => sum + g.feeCount, 0)
    const avgFee = totalFeeCount > 0 ? Math.round(totalFees / totalFeeCount) : 0
    const topFeeCollector = groomerData.sort((a, b) => b.fees - a.fees)[0]

    return [
      { metricId: 'totalFees', value: { current: totalFees, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'avgFee', value: { current: avgFee, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'appointmentsWithFees', value: { current: totalFeeCount, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'topFeeCollector', value: { current: topFeeCollector?.fees || 0, delta: 0, deltaPercent: 0, format: 'money' as const } },
    ]
  }, [groomerData])

  // Table data
  const tableData = useMemo(() => {
    return groomerData
      .sort((a, b) => b.fees - a.fees)
      .map(g => ({
        dimensionValue: g.name,
        drillKey: `groomer:${g.name}`,
        metrics: {
          fees: g.fees,
          feeCount: g.feeCount,
          avgFee: g.avgFee,
          feeRate: g.feeRate,
          appointments: g.appointments,
          revenue: g.revenue,
        },
      }))
  }, [groomerData])

  // Chart data
  const chartData = useMemo(() => {
    return groomerData
      .sort((a, b) => b.fees - a.fees)
      .map(g => ({
        label: g.name,
        value: g.fees,
      }))
  }, [groomerData])

  if (isLoading) {
    return (
      <ReportShell title="Groomers Additional Fees" description="Additional fees by groomer" defaultTimeBasis="checkout">
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
      <ReportShell title="Groomers Additional Fees" description="Additional fees by groomer" defaultTimeBasis="checkout">
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
      <ReportShell title="Groomers Additional Fees" description="Additional fees by groomer" defaultTimeBasis="checkout">
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
        title="Groomers Additional Fees"
        description="Track additional fees charged by each groomer"
        defaultTimeBasis="checkout"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Additional Fees by Groomer" description="Total additional fees collected" ariaLabel="Bar chart of fees by groomer">
          <SimpleBarChart data={chartData} height={280} formatValue={formatMoney} />
        </ChartCard>

        <DataTable
          title="Groomer Fee Details"
          data={tableData}
          columns={[
            { id: 'fees', label: 'Total Fees', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'feeCount', label: 'Appts w/ Fees', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgFee', label: 'Avg Fee', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'feeRate', label: 'Fee Rate', format: 'percent', align: 'right', sortable: true },
            { id: 'appointments', label: 'Total Appts', format: 'number', align: 'right', sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
