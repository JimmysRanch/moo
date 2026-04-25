/**
 * Definitions Modal Component
 * Shows the metric dictionary with search and filtering
 */

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { MagnifyingGlass, Clock, Calculator } from '@phosphor-icons/react'
import { metricRegistry, MetricDefinition } from '../engine/metricRegistry'

interface DefinitionsModalProps {
  open: boolean
  onClose: () => void
}

export function DefinitionsModal({ open, onClose }: DefinitionsModalProps) {
  const [search, setSearch] = useState('')
  
  // Get all metrics
  const allMetrics = useMemo(() => Object.values(metricRegistry), [])
  
  // Filter by search
  const filteredMetrics = useMemo(() => {
    if (!search.trim()) return allMetrics
    const searchLower = search.toLowerCase()
    return allMetrics.filter(m => 
      m.label.toLowerCase().includes(searchLower) ||
      m.definition.toLowerCase().includes(searchLower) ||
      m.id.toLowerCase().includes(searchLower)
    )
  }, [allMetrics, search])
  
  // Group by category
  const groupedMetrics = useMemo(() => {
    const groups: Record<string, MetricDefinition[]> = {
      'Revenue': [],
      'Profit & Margin': [],
      'Appointments': [],
      'Retention': [],
      'Clients': [],
      'Staff': [],
      'Payroll': [],
      'Tips': [],
      'Taxes': [],
      'Inventory': [],
      'Marketing': [],
      'Finance': [],
    }
    
    filteredMetrics.forEach(m => {
      if (['grossSales', 'netSales', 'totalCollected', 'avgTicket', 'discounts', 'refunds'].includes(m.id)) {
        groups['Revenue'].push(m)
      } else if (['contributionMargin', 'contributionMarginPercent', 'grossMarginPercent', 'avgMarginPerAppt', 'estimatedCOGS', 'processingFees', 'directLabor'].includes(m.id)) {
        groups['Profit & Margin'].push(m)
      } else if (['appointmentsCompleted', 'appointmentsBooked', 'appointmentsCancelled', 'noShowRate', 'lateCancelRate', 'lostRevenue', 'recoveryRate', 'avgLeadTime', 'utilizationPercent'].includes(m.id)) {
        groups['Appointments'].push(m)
      } else if (['rebook24h', 'rebook7d', 'rebook30d', 'avgDaysToNextVisit', 'return90d'].includes(m.id)) {
        groups['Retention'].push(m)
      } else if (['avgLTV12m', 'medianVisits12m', 'newClients', 'retention90d', 'retention180d', 'retention360d'].includes(m.id)) {
        groups['Clients'].push(m)
      } else if (['revenuePerHour', 'marginPerHour', 'upsellRate', 'onTimeStartPercent', 'tipsPerHour'].includes(m.id)) {
        groups['Staff'].push(m)
      } else if (['totalPayout', 'commissionTotal', 'hourlyTotal'].includes(m.id)) {
        groups['Payroll'].push(m)
      } else if (['totalTips', 'avgTipPercent', 'tipFeeCost'].includes(m.id)) {
        groups['Tips'].push(m)
      } else if (['taxableSales', 'nonTaxableSales', 'taxesCollected'].includes(m.id)) {
        groups['Taxes'].push(m)
      } else if (['itemsBelowReorder', 'daysOfSupply', 'costUsed', 'costPerAppt'].includes(m.id)) {
        groups['Inventory'].push(m)
      } else if (['messagesSent', 'confirmations', 'showUpsAttributed', 'costPerShowUp', 'marketingROI'].includes(m.id)) {
        groups['Marketing'].push(m)
      } else if (['pendingUnpaid', 'netDeposits'].includes(m.id)) {
        groups['Finance'].push(m)
      }
    })
    
    // Remove empty groups
    return Object.entries(groups).filter(([, metrics]) => metrics.length > 0)
  }, [filteredMetrics])
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Metric Definitions</DialogTitle>
          <DialogDescription>
            Reference guide for all metrics and calculations used in reports.
          </DialogDescription>
        </DialogHeader>
        
        {/* Search */}
        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search metrics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {/* Metrics List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6">
            {groupedMetrics.map(([group, metrics]) => (
              <div key={group}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {group}
                </h3>
                <div className="space-y-3">
                  {metrics.map(metric => (
                    <MetricCard key={metric.id} metric={metric} />
                  ))}
                </div>
              </div>
            ))}
            
            {filteredMetrics.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No metrics found matching "{search}"
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function MetricCard({ metric }: { metric: MetricDefinition }) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm">{metric.label}</h4>
            <Badge variant="outline" className="text-[10px]">
              {metric.format}
            </Badge>
            {metric.timeBasisSensitivity && (
              <Badge variant="secondary" className="text-[10px]">
                <Clock size={10} className="mr-0.5" />
                Time-sensitive
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {metric.definition}
          </p>
        </div>
      </div>
      
      <Separator className="my-2" />
      
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <Calculator size={12} className="text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Formula: </span>
            {metric.formula}
          </p>
        </div>
        
        {metric.exclusions && metric.exclusions.length > 0 && (
          <p className="text-xs text-muted-foreground pl-4">
            <span className="font-medium">Excludes: </span>
            {metric.exclusions.join(', ')}
          </p>
        )}
        
        <p className="text-xs text-muted-foreground pl-4">
          <span className="font-medium">Drill-down: </span>
          {metric.drillRowTypes.join(', ')}
        </p>
      </div>
    </div>
  )
}
