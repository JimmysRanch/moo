/**
 * Drill Drawer Component
 * Right-side drawer for showing underlying data rows
 */

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  DownloadSimple, 
  Copy, 
  ArrowSquareOut,
  CalendarBlank,
  User,
  Receipt,
  Package,
  ChatCircle,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { DrillRow, NormalizedAppointment, NormalizedTransaction, NormalizedClient } from '../types'
import { formatMetricValue } from '../engine/metricRegistry'

interface DrillDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  totalValue?: { label: string; value: number; format: 'money' | 'percent' | 'number' }
  rows: DrillRow[]
  onExportCSV?: () => void
  onOpenAppointment?: (id: string) => void
  onOpenClient?: (id: string) => void
}

export function DrillDrawer({
  open,
  onClose,
  title,
  subtitle,
  totalValue,
  rows,
  onExportCSV,
  onOpenAppointment,
  onOpenClient,
}: DrillDrawerProps) {
  const [activeTab, setActiveTab] = useState<string>('appointments')
  
  // Group rows by type
  const appointmentRows = rows.filter(r => r.type === 'appointment')
  const transactionRows = rows.filter(r => r.type === 'transaction')
  const clientRows = rows.filter(r => r.type === 'client')
  const inventoryRows = rows.filter(r => r.type === 'inventory')
  const messageRows = rows.filter(r => r.type === 'message')
  
  // Determine which tabs to show
  const tabs = [
    { id: 'appointments', label: 'Appointments', count: appointmentRows.length, icon: CalendarBlank },
    { id: 'transactions', label: 'Transactions', count: transactionRows.length, icon: Receipt },
    { id: 'clients', label: 'Clients', count: clientRows.length, icon: User },
    { id: 'inventory', label: 'Inventory', count: inventoryRows.length, icon: Package },
    { id: 'messages', label: 'Messages', count: messageRows.length, icon: ChatCircle },
  ].filter(t => t.count > 0)
  
  // Set active tab to first available
  if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
    setActiveTab(tabs[0].id)
  }
  
  // Calculate sum for verification
  const calculateSum = () => {
    switch (activeTab) {
      case 'appointments':
        return appointmentRows.reduce((sum, r) => {
          const appt = r.data as NormalizedAppointment
          return sum + (appt.netCents || 0)
        }, 0)
      case 'transactions':
        return transactionRows.reduce((sum, r) => {
          const txn = r.data as NormalizedTransaction
          return sum + (txn.totalCents || 0)
        }, 0)
      default:
        return 0
    }
  }
  
  const rowSum = calculateSum()
  
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:w-[540px] sm:max-w-[90vw] flex flex-col p-0"
      >
        <SheetHeader className="p-4 pb-2 border-b">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-base">{title}</SheetTitle>
              {subtitle && (
                <SheetDescription className="text-sm mt-0.5">
                  {subtitle}
                </SheetDescription>
              )}
            </div>
          </div>
          
          {/* Total Value Display */}
          {totalValue && (
            <div className="flex items-center justify-between mt-3 p-2 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">{totalValue.label}</span>
              <span className="text-lg font-bold">
                {formatMetricValue(totalValue.value, totalValue.format)}
              </span>
            </div>
          )}
          
          {/* Reconciliation check */}
          {totalValue && totalValue.format === 'money' && (
            <div className={cn(
              'flex items-center gap-2 text-xs mt-2',
              Math.abs(totalValue.value - rowSum) <= 1 ? 'text-green-600' : 'text-amber-600'
            )}>
              <span>Row sum: {formatMetricValue(rowSum, 'money')}</span>
              {Math.abs(totalValue.value - rowSum) <= 1 ? (
                <Badge variant="outline" className="text-[10px] bg-green-500/10">✓ Reconciled</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10">
                  Δ {formatMetricValue(totalValue.value - rowSum, 'money')}
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>
        
        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="px-4 pt-2 border-b">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-9">
                {tabs.map(tab => (
                  <TabsTrigger key={tab.id} value={tab.id} className="text-xs gap-1">
                    <tab.icon size={14} />
                    {tab.label}
                    <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                      {tab.count}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}
        
        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {activeTab === 'appointments' && (
            <AppointmentsList 
              rows={appointmentRows} 
              onOpenAppointment={onOpenAppointment}
              onOpenClient={onOpenClient}
            />
          )}
          {activeTab === 'transactions' && (
            <TransactionsList rows={transactionRows} />
          )}
          {activeTab === 'clients' && (
            <ClientsList rows={clientRows} onOpenClient={onOpenClient} />
          )}
          {activeTab === 'inventory' && (
            <InventoryList rows={inventoryRows} />
          )}
          {activeTab === 'messages' && (
            <MessagesList rows={messageRows} />
          )}
        </ScrollArea>
        
        {/* Footer Actions */}
        <SheetFooter className="p-4 pt-2 border-t flex-row gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onExportCSV}>
            <DownloadSimple size={14} className="mr-1" />
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Copy data to clipboard
              const text = rows.map(r => JSON.stringify(r.data)).join('\n')
              navigator.clipboard.writeText(text)
            }}
          >
            <Copy size={14} />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ==================== Row List Components ====================

function AppointmentsList({ 
  rows, 
  onOpenAppointment,
  onOpenClient,
}: { 
  rows: DrillRow[]
  onOpenAppointment?: (id: string) => void
  onOpenClient?: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      {rows.map(row => {
        const appt = row.data as NormalizedAppointment
        return (
          <div 
            key={row.id}
            className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{appt.petName}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {appt.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {appt.clientName} • {appt.groomerName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {appt.serviceDate} at {appt.startTime}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {appt.services.map(s => (
                    <Badge key={s.id} variant="secondary" className="text-[10px]">
                      {s.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {formatMetricValue(appt.netCents, 'money')}
                </div>
                {appt.tipCents > 0 && (
                  <div className="text-xs text-muted-foreground">
                    +{formatMetricValue(appt.tipCents, 'money')} tip
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
              {onOpenAppointment && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => onOpenAppointment(appt.id)}
                >
                  <ArrowSquareOut size={12} className="mr-1" />
                  Open Appointment
                </Button>
              )}
              {onOpenClient && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => onOpenClient(appt.clientId)}
                >
                  <User size={12} className="mr-1" />
                  Open Client
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TransactionsList({ rows }: { rows: DrillRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map(row => {
        const txn = row.data as NormalizedTransaction
        return (
          <div 
            key={row.id}
            className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Txn #{txn.id.slice(-6)}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {txn.status}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {txn.paymentMethod}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {txn.clientName} • {txn.date}
                </p>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {formatMetricValue(txn.totalCents, 'money')}
                </div>
                {txn.processingFeeCents > 0 && (
                  <div className="text-xs text-muted-foreground">
                    -{formatMetricValue(txn.processingFeeCents, 'money')} fee
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ClientsList({ 
  rows,
  onOpenClient,
}: { 
  rows: DrillRow[]
  onOpenClient?: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      {rows.map(row => {
        const client = row.data as NormalizedClient
        return (
          <div 
            key={row.id}
            className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{client.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {client.email || client.phone}
                </p>
                <p className="text-xs text-muted-foreground">
                  {client.totalVisits} visits • Last: {client.lastVisitDate || 'Never'}
                </p>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {formatMetricValue(client.totalSpentCents, 'money')}
                </div>
                <div className="text-xs text-muted-foreground">
                  lifetime
                </div>
              </div>
            </div>
            
            {onOpenClient && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => onOpenClient(client.id)}
                >
                  <ArrowSquareOut size={12} className="mr-1" />
                  Open Client Profile
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function InventoryList({ rows }: { rows: DrillRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map(row => {
        const item = row.data as Record<string, unknown>
        return (
          <div 
            key={row.id}
            className="p-3 rounded-lg border bg-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="font-medium text-sm">{String(item.name || 'Unknown')}</span>
                <p className="text-xs text-muted-foreground">
                  SKU: {String(item.sku || '—')}
                </p>
              </div>
              <div className="text-right">
                <div className="font-semibold">{String(item.quantityOnHand || 0)}</div>
                <div className="text-xs text-muted-foreground">in stock</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MessagesList({ rows }: { rows: DrillRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map(row => {
        const msg = row.data as Record<string, unknown>
        return (
          <div 
            key={row.id}
            className="p-3 rounded-lg border bg-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{String(msg.type || 'Message')}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {String(msg.channel || 'unknown')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sent: {String(msg.sentAt || '—')}
                </p>
              </div>
              <div className="text-right">
                {msg.confirmed && (
                  <Badge variant="outline" className="text-[10px] bg-green-500/10">
                    Confirmed
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
