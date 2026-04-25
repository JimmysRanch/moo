/**
 * Referral Sources Report
 * Track client acquisition sources
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

export function ReferralSources() {
  const { filters, setFilters: _setFilters } = useReportFilters()
  const { clients, appointments, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate referral source metrics
  const sourceData = useMemo(() => {
    const bySource: Record<string, { clients: Set<string>; revenue: number; appointments: number }> = {}

    clients.forEach(client => {
      const source = client.referralSource || 'Not Specified'
      if (!bySource[source]) {
        bySource[source] = { clients: new Set(), revenue: 0, appointments: 0 }
      }
      bySource[source].clients.add(client.id)
    })

    // Add revenue from appointments
    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      const client = clients.find(c => c.id === appt.clientId)
      const source = client?.referralSource || 'Not Specified'
      if (bySource[source]) {
        bySource[source].revenue += appt.netCents || 0
        bySource[source].appointments += 1
      }
    })

    const totalClients = Object.values(bySource).reduce((sum, s) => sum + s.clients.size, 0)

    return Object.entries(bySource).map(([source, data]) => ({
      source,
      clientCount: data.clients.size,
      revenue: data.revenue,
      appointments: data.appointments,
      share: totalClients > 0 ? (data.clients.size / totalClients) * 100 : 0,
      avgRevenue: data.clients.size > 0 ? Math.round(data.revenue / data.clients.size) : 0,
    }))
  }, [clients, appointments])

  // KPIs
  const kpis = useMemo(() => {
    const totalClients = sourceData.reduce((sum, s) => sum + s.clientCount, 0)
    const totalRevenue = sourceData.reduce((sum, s) => sum + s.revenue, 0)
    const topSource = sourceData.sort((a, b) => b.clientCount - a.clientCount)[0]

    return [
      { metricId: 'totalClients', value: { current: totalClients, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'totalRevenue', value: { current: totalRevenue, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'referralSources', value: { current: sourceData.length, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'topSourceCount', value: { current: topSource?.clientCount || 0, delta: 0, deltaPercent: 0, format: 'number' as const } },
    ]
  }, [sourceData])

  // Chart data
  const pieData = useMemo(() => {
    return sourceData
      .sort((a, b) => b.clientCount - a.clientCount)
      .slice(0, 8)
      .map(s => ({
        label: s.source,
        value: s.clientCount,
      }))
  }, [sourceData])

  // Table data
  const tableData = useMemo(() => {
    return sourceData
      .sort((a, b) => b.clientCount - a.clientCount)
      .map(s => ({
        dimensionValue: s.source,
        drillKey: `source:${s.source}`,
        metrics: {
          clientCount: s.clientCount,
          revenue: s.revenue,
          appointments: s.appointments,
          share: s.share,
          avgRevenue: s.avgRevenue,
        },
      }))
  }, [sourceData])

  if (isLoading) {
    return (
      <ReportShell title="Referral Sources" description="Client acquisition sources" defaultTimeBasis="service">
        <Skeleton className="h-[400px]" />
      </ReportShell>
    )
  }

  if (error) {
    return (
      <ReportShell title="Referral Sources" description="Client acquisition sources" defaultTimeBasis="service">
        <Alert variant="destructive"><AlertDescription>Failed to load data.</AlertDescription></Alert>
        <Button onClick={() => window.location.reload()} className="mt-4"><ArrowsClockwise className="mr-2 h-4 w-4" /> Retry</Button>
      </ReportShell>
    )
  }

  if (clients.length === 0) {
    return (
      <ReportShell title="Referral Sources" description="Client acquisition sources" defaultTimeBasis="service">
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data</h2>
          <p className="text-muted-foreground mb-4">No client data available.</p>
        </Card>
      </ReportShell>
    )
  }

  return (
    <>
      <ReportShell title="Referral Sources" description="Track client acquisition sources" defaultTimeBasis="service" onShowDefinitions={() => setShowDefinitions(true)}>
        <KPIDeck metrics={kpis} />

        <ChartCard title="Clients by Referral Source" description="Distribution of client sources" ariaLabel="Pie chart of referral sources">
          <SimplePieChart data={pieData} height={280} formatValue={(v) => v.toString()} />
        </ChartCard>

        <DataTable
          title="Referral Source Details"
          data={tableData}
          columns={[
            { id: 'clientCount', label: 'Clients', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'share', label: 'Share %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgRevenue', label: 'Avg/Client', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>
      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
