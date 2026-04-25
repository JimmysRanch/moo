/**
 * Top Clients Report
 * Lifetime spend and visit history
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
import { 
  calculateNetSales,
  calculateKPIWithDelta, 
  measurePerformance 
} from '../engine/analyticsEngine'

export function TopClients() {
  const { filters, setFilters } = useReportFilters()
  const { 
    appointments, 
    previousAppointments,
    isLoading, 
    error 
  } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate client metrics
  const clientData = useMemo(() => {
    return measurePerformance('aggregateTopClients', () => {
      const byClient: Record<string, { spend: number; visits: number; tips: number; firstVisit: string; lastVisit: string; clientName: string }> = {}

      appointments.filter(a => a.status === 'picked_up').forEach(appt => {
        if (!byClient[appt.clientId]) {
          byClient[appt.clientId] = { 
            spend: 0, 
            visits: 0, 
            tips: 0, 
            firstVisit: appt.serviceDate, 
            lastVisit: appt.serviceDate,
            clientName: appt.clientName,
          }
        }
        byClient[appt.clientId].spend += appt.netCents
        byClient[appt.clientId].visits += 1
        byClient[appt.clientId].tips += appt.tipCents
        
        if (appt.serviceDate < byClient[appt.clientId].firstVisit) {
          byClient[appt.clientId].firstVisit = appt.serviceDate
        }
        if (appt.serviceDate > byClient[appt.clientId].lastVisit) {
          byClient[appt.clientId].lastVisit = appt.serviceDate
        }
      })

      return Object.entries(byClient).map(([clientId, data]) => ({
        clientId,
        clientName: data.clientName || 'Unknown',
        lifetimeSpend: data.spend,
        visits: data.visits,
        tips: data.tips,
        avgTicket: data.visits > 0 ? Math.round(data.spend / data.visits) : 0,
        firstVisit: data.firstVisit,
        lastVisit: data.lastVisit,
      }))
    })
  }, [appointments])

  // KPIs with period comparison
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateTopClientsKPIs', () => {
      const currentTotalSpend = calculateNetSales(appointments)
      const previousTotalSpend = calculateNetSales(previousAppointments)
      
      const currentClientCount = new Set(appointments.filter(a => a.status === 'picked_up').map(a => a.clientId)).size
      const previousClientCount = new Set(previousAppointments.filter(a => a.status === 'picked_up').map(a => a.clientId)).size
      
      const currentAvgSpend = currentClientCount > 0 ? Math.round(currentTotalSpend / currentClientCount) : 0
      const previousAvgSpend = previousClientCount > 0 ? Math.round(previousTotalSpend / previousClientCount) : 0
      
      const topClient = [...clientData].sort((a, b) => b.lifetimeSpend - a.lifetimeSpend)[0]

      return [
        { metricId: 'totalClients', value: calculateKPIWithDelta(currentClientCount, previousClientCount, 'number') },
        { metricId: 'totalSpend', value: calculateKPIWithDelta(currentTotalSpend, previousTotalSpend, 'money') },
        { metricId: 'avgSpend', value: calculateKPIWithDelta(currentAvgSpend, previousAvgSpend, 'money') },
        { metricId: 'topClientSpend', value: calculateKPIWithDelta(topClient?.lifetimeSpend || 0, 0, 'money') },
      ]
    })
  }, [appointments, previousAppointments, clientData])

  // Table data - top clients
  const tableData = useMemo(() => {
    return clientData
      .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend)
      .map(c => ({
        dimensionValue: c.clientName,
        drillKey: `client:${c.clientId}`,
        metrics: {
          lifetimeSpend: c.lifetimeSpend,
          visits: c.visits,
          avgTicket: c.avgTicket,
          tips: c.tips,
          lastVisit: c.lastVisit,
        },
      }))
  }, [clientData])

  if (isLoading) {
    return (
      <ReportShell title="Top Clients" description="Lifetime spend" defaultTimeBasis="service">
        <Skeleton className="h-[400px]" />
      </ReportShell>
    )
  }

  if (error) {
    return (
      <ReportShell title="Top Clients" description="Lifetime spend" defaultTimeBasis="service">
        <Alert variant="destructive"><AlertDescription>Failed to load data.</AlertDescription></Alert>
        <Button onClick={() => window.location.reload()} className="mt-4"><ArrowsClockwise className="mr-2 h-4 w-4" /> Retry</Button>
      </ReportShell>
    )
  }

  if (appointments.length === 0) {
    return (
      <ReportShell title="Top Clients" description="Lifetime spend" defaultTimeBasis="service">
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
      <ReportShell title="Top Clients" description="Lifetime spend and visit history" defaultTimeBasis="service" onShowDefinitions={() => setShowDefinitions(true)}>
        <KPIDeck metrics={kpis} />
        <DataTable
          title="Client Rankings"
          data={tableData}
          columns={[
            { id: 'lifetimeSpend', label: 'Lifetime Spend', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'visits', label: 'Total Visits', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'tips', label: 'Total Tips', format: 'money', align: 'right', sortable: true },
            { id: 'lastVisit', label: 'Last Visit', format: 'text', align: 'left', sortable: true },
          ]}
          maxPreviewRows={20}
          showViewAll
        />
      </ReportShell>
      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
