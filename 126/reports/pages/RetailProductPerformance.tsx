/**
 * Retail Product Performance Report
 * Track retail product sales performance
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

export function RetailProductPerformance() {
  const { filters, setFilters } = useReportFilters()
  const { transactions, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate retail metrics
  const retailData = useMemo(() => {
    const products: Record<string, { revenue: number; quantity: number; cost: number }> = {}
    
    transactions.forEach(tx => {
      if (tx.type === 'retail' || tx.isRetail) {
        const productName = tx.productName || 'Unknown Product'
        if (!products[productName]) {
          products[productName] = { revenue: 0, quantity: 0, cost: 0 }
        }
        products[productName].revenue += tx.amountCents || 0
        products[productName].quantity += tx.quantity || 1
        products[productName].cost += tx.costCents || 0
      }
    })

    return Object.entries(products).map(([name, data]) => ({
      name,
      revenue: data.revenue,
      quantity: data.quantity,
      cost: data.cost,
      margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
    }))
  }, [transactions])

  // KPIs
  const kpis = useMemo(() => {
    const totalRevenue = retailData.reduce((sum, p) => sum + p.revenue, 0)
    const totalQuantity = retailData.reduce((sum, p) => sum + p.quantity, 0)
    const totalCost = retailData.reduce((sum, p) => sum + p.cost, 0)
    const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0

    return [
      { metricId: 'retailRevenue', value: { current: totalRevenue, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'unitsSold', value: { current: totalQuantity, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'avgMargin', value: { current: avgMargin, delta: 0, deltaPercent: 0, format: 'percent' as const } },
      { metricId: 'uniqueProducts', value: { current: retailData.length, delta: 0, deltaPercent: 0, format: 'number' as const } },
    ]
  }, [retailData])

  // Table data
  const tableData = useMemo(() => {
    return retailData
      .sort((a, b) => b.revenue - a.revenue)
      .map(product => ({
        dimensionValue: product.name,
        drillKey: `product:${product.name}`,
        metrics: {
          revenue: product.revenue,
          quantity: product.quantity,
          margin: product.margin,
          avgPrice: product.quantity > 0 ? Math.round(product.revenue / product.quantity) : 0,
        },
      }))
  }, [retailData])

  // Chart data
  const chartData = useMemo(() => {
    return retailData
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(product => ({
        label: product.name,
        value: product.revenue,
      }))
  }, [retailData])

  if (isLoading) {
    return (
      <ReportShell title="Retail Product Performance" description="Product sales tracking" defaultTimeBasis="checkout">
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
      <ReportShell title="Retail Product Performance" description="Product sales tracking" defaultTimeBasis="checkout">
        <Alert variant="destructive">
          <AlertDescription>Failed to load data.</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} className="mt-4">
          <ArrowsClockwise className="mr-2 h-4 w-4" /> Retry
        </Button>
      </ReportShell>
    )
  }

  if (retailData.length === 0) {
    return (
      <ReportShell title="Retail Product Performance" description="Product sales tracking" defaultTimeBasis="checkout">
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Retail Data</h2>
          <p className="text-muted-foreground mb-4">No retail product sales found.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
      </ReportShell>
    )
  }

  const formatMoney = (v: number) => `$${(v / 100).toLocaleString()}`

  return (
    <>
      <ReportShell
        title="Retail Product Performance"
        description="Track retail product sales and margins"
        defaultTimeBasis="checkout"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Top Products by Revenue" description="Best selling retail products" ariaLabel="Bar chart of product revenue">
          <SimpleBarChart data={chartData} height={280} formatValue={formatMoney} />
        </ChartCard>

        <DataTable
          title="Product Details"
          data={tableData}
          columns={[
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'quantity', label: 'Units Sold', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'margin', label: 'Margin %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgPrice', label: 'Avg Price', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
