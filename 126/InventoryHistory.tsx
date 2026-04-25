import { useState, useMemo } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useInventoryItems, useInventoryLedger } from "@/hooks/data/useInventory"
import { useStaff } from "@/hooks/data/useStaff"
import { InventoryLedgerEntry } from "@/lib/types"
import { MagnifyingGlass, ArrowLeft, Package } from "@phosphor-icons/react"
import { useNavigate, useSearchParams } from 'react-router-dom'

// Map DB ledger reasons to UI reason union
const DB_REASON_TO_UI: Record<string, InventoryLedgerEntry['reason']> = {
  purchase: 'Received',
  sale: 'Sale',
  return: 'Refund',
  adjustment: 'Adjustment',
  damage: 'Adjustment',
  transfer: 'Adjustment',
}

export function InventoryHistory() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const itemIdParam = searchParams.get('itemId') || undefined
  const { data: dbLedger } = useInventoryLedger(itemIdParam)
  const { data: dbItems } = useInventoryItems(true)
  const { data: dbStaff } = useStaff()
  const [searchQuery, setSearchQuery] = useState("")

  // Map DB ledger entries to UI InventoryLedgerEntry format
  const inventoryLedger: InventoryLedgerEntry[] = useMemo(() => {
    if (!dbLedger) return []
    const itemNameMap = new Map((dbItems || []).map(i => [i.id, i.name]))
    const staffNameMap = new Map((dbStaff || []).map(s => [s.user_id || s.id, `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || s.email || s.id]))
    return dbLedger.map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp,
      itemId: entry.item_id,
      itemName: itemNameMap.get(entry.item_id) || 'Unknown Item',
      change: entry.change,
      reason: DB_REASON_TO_UI[entry.reason] ?? 'Adjustment',
      reference: entry.reference,
      user: (entry.user_id && staffNameMap.get(entry.user_id)) || 'System',
      resultingQuantity: entry.resulting_quantity
    }))
  }, [dbLedger, dbItems, dbStaff])

  const filteredEntries = (inventoryLedger || []).filter(entry => {
    const matchesSearch = 
      entry.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.reference && entry.reference.toLowerCase().includes(searchQuery.toLowerCase())) ||
      entry.user.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesSearch
  })

  const sortedEntries = [...filteredEntries].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const getReasonBadgeVariant = (reason: string) => {
    switch (reason) {
      case 'Received':
        return 'default'
      case 'Sale':
        return 'secondary'
      case 'Refund':
        return 'outline'
      case 'Adjustment':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const formatChange = (change: number) => {
    if (change > 0) {
      return `+${change}`
    }
    return change.toString()
  }

  return (
    <div data-testid="page-inventory-history" className="min-h-full bg-background p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/inventory')}
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Inventory History</h1>
            <p className="text-sm text-muted-foreground">Complete audit trail of all inventory changes</p>
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search by item name, reason, reference, or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card className="p-4">
          {sortedEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package size={48} className="mx-auto mb-3 opacity-50" />
              <p>No inventory history entries yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date/Time</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Item Name</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground">Change</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground">Reason</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Reference</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">User</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">On-Hand Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="p-3 text-sm whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </td>
                      <td className="p-3 font-medium">{entry.itemName}</td>
                      <td className="p-3 text-center">
                        <span className={`font-semibold ${
                          entry.change > 0 ? 'text-green-600' : 'text-destructive'
                        }`}>
                          {formatChange(entry.change)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={getReasonBadgeVariant(entry.reason)}>
                          {entry.reason}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {entry.reference || '—'}
                      </td>
                      <td className="p-3 text-sm">{entry.user}</td>
                      <td className="p-3 text-right font-medium">{entry.resultingQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          Showing {sortedEntries.length} {sortedEntries.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>
    </div>
  )
}
