import { useState, useEffect, useMemo } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useInventoryItems, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem, useInventorySnapshots, useCreateInventorySnapshot, useRecordInventoryPurchase } from "@/hooks/data/useInventory"
import { useCreateExpense } from "@/hooks/data/useExpenses"
import { inventoryItemFromDb, inventoryItemsFromDb } from "@/lib/mappers/inventoryMapper"
import { calculateInventorySummary, createInventorySnapshotValues, getInventoryPotentialProfitPerUnit } from "@/lib/inventoryMetrics"
import { toast } from "sonner"
import { InventoryItem } from "@/lib/types"
import { Plus, MagnifyingGlass, PencilSimple, Trash, Package, Warning, DownloadSimple, ClockCounterClockwise, Tag } from "@phosphor-icons/react"
import { useNavigate } from 'react-router-dom'

const createEmptyReceiveFormData = () => ({
  qty: "",
  totalCost: "",
  costPerUnit: "",
})

type ReceiveFormData = ReturnType<typeof createEmptyReceiveFormData>

const isPositiveFiniteNumber = (value: number) => Number.isFinite(value) && value > 0

const getNextReceiveFormData = (
  currentReceiveFormData: ReceiveFormData,
  field: 'qty' | 'totalCost' | 'costPerUnit',
  value: string,
) => {
  const numValue = value === "" ? "" : value
  const newFormData = { ...currentReceiveFormData, [field]: numValue }

  if (numValue === "") {
    return newFormData
  }

  const qty = field === 'qty' ? parseFloat(numValue) : parseFloat(newFormData.qty)
  const totalCost = field === 'totalCost' ? parseFloat(numValue) : parseFloat(newFormData.totalCost)
  const costPerUnit = field === 'costPerUnit' ? parseFloat(numValue) : parseFloat(newFormData.costPerUnit)

  if (field === 'qty' && isPositiveFiniteNumber(qty) && !isNaN(totalCost)) {
    newFormData.costPerUnit = (totalCost / qty).toFixed(2)
  } else if (field === 'qty' && isPositiveFiniteNumber(qty) && !isNaN(costPerUnit)) {
    newFormData.totalCost = (qty * costPerUnit).toFixed(2)
  } else if (field === 'totalCost' && !isNaN(totalCost) && isPositiveFiniteNumber(qty)) {
    newFormData.costPerUnit = (totalCost / qty).toFixed(2)
  } else if (field === 'totalCost' && !isNaN(totalCost) && isPositiveFiniteNumber(costPerUnit)) {
    newFormData.qty = (totalCost / costPerUnit).toFixed(0)
  } else if (field === 'costPerUnit' && isPositiveFiniteNumber(costPerUnit) && !isNaN(qty)) {
    newFormData.totalCost = (qty * costPerUnit).toFixed(2)
  } else if (field === 'costPerUnit' && isPositiveFiniteNumber(costPerUnit) && !isNaN(totalCost)) {
    newFormData.qty = (totalCost / costPerUnit).toFixed(0)
  }

  return newFormData
}

const getProjectedQuantity = (qty: string, currentQuantity = 0) => {
  const parsedQty = parseInt(qty, 10)
  return Number.isFinite(parsedQty) ? parsedQty + currentQuantity : undefined
}

function ReceiveFormFields({
  title,
  description,
  formValues,
  onChange,
  qtyId,
  totalCostId,
  costPerUnitId,
  projectedQuantityLabel,
  projectedQuantity,
}: {
  title?: string
  description?: string
  formValues: ReceiveFormData
  onChange: (field: 'qty' | 'totalCost' | 'costPerUnit', value: string) => void
  qtyId: string
  totalCostId: string
  costPerUnitId: string
  projectedQuantityLabel?: string
  projectedQuantity?: number
}) {
  return (
    <div className="space-y-4">
      {(title || description) && (
        <div className="space-y-1">
          {title && <h4 className="font-medium">{title}</h4>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={qtyId}>QTY</Label>
          <Input
            id={qtyId}
            type="number"
            value={formValues.qty}
            onChange={(e) => onChange('qty', e.target.value)}
            placeholder="5"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={totalCostId}>Total Cost (incl. shipping)</Label>
          <Input
            id={totalCostId}
            type="number"
            step="0.01"
            value={formValues.totalCost}
            onChange={(e) => onChange('totalCost', e.target.value)}
            placeholder="10.00"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={costPerUnitId}>Cost Per Unit (my cost)</Label>
          <Input
            id={costPerUnitId}
            type="number"
            step="0.01"
            value={formValues.costPerUnit}
            onChange={(e) => onChange('costPerUnit', e.target.value)}
            placeholder="2"
          />
        </div>
      </div>

      {formValues.qty && projectedQuantity !== undefined && projectedQuantityLabel && (
        <p className="text-sm text-muted-foreground text-center">
          {projectedQuantityLabel}: <span className="font-bold text-foreground">{projectedQuantity}</span>
        </p>
      )}
    </div>
  )
}

export function Inventory() {
  const navigate = useNavigate()
  const { data: dbInventory } = useInventoryItems()
  const { data: dbSnapshots } = useInventorySnapshots()
  const createInventoryItem = useCreateInventoryItem()
  const updateInventoryItemMutation = useUpdateInventoryItem()
  const deleteInventoryItemMutation = useDeleteInventoryItem()
  const createSnapshot = useCreateInventorySnapshot()
  const recordPurchase = useRecordInventoryPurchase({ suppressGlobalError: true })
  const createExpense = useCreateExpense({ suppressGlobalError: true })

  const inventory = useMemo(() => dbInventory ? inventoryItemsFromDb(dbInventory) : [], [dbInventory])
  const inventorySummary = useMemo(() => calculateInventorySummary(inventory), [inventory])
  const valueHistory = useMemo(() => {
    return (dbSnapshots || []).map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      totalValue: s.total_value,
      retailValue: s.retail_value,
      supplyValue: s.supply_value,
      retailPotentialProfit: 0,
      itemCount: s.item_count,
      retailCount: 0,
      supplyCount: 0
    }))
  }, [dbSnapshots])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory] = useState<"all" | "retail" | "supply">("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false)
  const [retailPricingDialogOpen, setRetailPricingDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [receivingItem, setReceivingItem] = useState<InventoryItem | null>(null)
  const [pricingItem, setPricingItem] = useState<InventoryItem | null>(null)
  const [activeTab, setActiveTab] = useState<"inventory" | "reports">("inventory")
  const [formData, setFormData] = useState({
    name: "",
    category: "retail" as "retail" | "supply",
    description: ""
  })

  const [receiveFormData, setReceiveFormData] = useState<ReceiveFormData>(createEmptyReceiveFormData)
  const [initialReceiveFormData, setInitialReceiveFormData] = useState<ReceiveFormData>(createEmptyReceiveFormData)

  const [retailPricingFormData, setRetailPricingFormData] = useState({
    retailPrice: "",
    commissionType: "" as "" | "fixed" | "percentage",
    commissionAmount: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Calculate and track inventory value snapshots
  useEffect(() => {
    if (inventory && inventory.length > 0) {
      const snapshotValues = createInventorySnapshotValues(inventory)

      const lastSnapshot = valueHistory[0]

      // Only create if value changed or it's been more than 24 hours
      if (!lastSnapshot || 
          Math.abs(lastSnapshot.totalValue - snapshotValues.total_value) > 0.01 ||
          Math.abs(lastSnapshot.retailValue - snapshotValues.retail_value) > 0.01 ||
          Math.abs(lastSnapshot.supplyValue - snapshotValues.supply_value) > 0.01 ||
          lastSnapshot.itemCount !== snapshotValues.item_count ||
          (new Date().getTime() - new Date(lastSnapshot.timestamp).getTime()) > 24 * 60 * 60 * 1000) {
        createSnapshot.mutate({
          timestamp: new Date().toISOString(),
          ...snapshotValues,
        })
      }
    }
  }, [inventory, createSnapshot, valueHistory])

  const filteredInventory = (inventory || []).filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.supplier && item.supplier.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = activeCategory === "all" || item.category === activeCategory

    return matchesSearch && matchesCategory
  })

  const lowStockItems = (inventory || []).filter(item => item.quantity <= item.reorderLevel)
  const retailItems = filteredInventory.filter(item => item.category === 'retail')
  const supplyItems = filteredInventory.filter(item => item.category === 'supply')

  const handleOpenDialog = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        name: item.name,
        category: item.category,
        description: item.description || ""
      })
    } else {
      setEditingItem(null)
      setFormData({
        name: "",
        category: "retail",
        description: ""
      })
      setInitialReceiveFormData(createEmptyReceiveFormData())
    }
    setDialogOpen(true)
  }

  const parseReceiveFormData = (currentReceiveFormData: ReceiveFormData) => {
    if (!currentReceiveFormData.qty || !currentReceiveFormData.totalCost || !currentReceiveFormData.costPerUnit) {
      toast.error("Please fill in all fields")
      return null
    }

    const qty = parseInt(currentReceiveFormData.qty, 10)
    const costPerUnit = parseFloat(currentReceiveFormData.costPerUnit)
    const totalCost = parseFloat(currentReceiveFormData.totalCost)

    if (!isPositiveFiniteNumber(qty) || !isPositiveFiniteNumber(costPerUnit) || !isPositiveFiniteNumber(totalCost)) {
      toast.error("Please enter valid positive quantities and costs")
      return null
    }

    return { qty, costPerUnit, totalCost }
  }

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error("Please fill in all required fields")
      return
    }

    const hasInitialQuantity = Object.values(initialReceiveFormData).some(value => value !== "")
    const initialReceipt = !editingItem && hasInitialQuantity ? parseReceiveFormData(initialReceiveFormData) : null

    if (!editingItem && hasInitialQuantity && !initialReceipt) {
      return
    }

    setIsSubmitting(true)
    if (editingItem) {
      updateInventoryItemMutation.mutate({
        id: editingItem.id,
        updated_at: editingItem.updated_at,
        name: formData.name,
        category: formData.category,
        description: formData.description,
      }, {
        onSuccess: (updatedDbItem) => {
          toast.success("Item updated successfully")
          setEditingItem(inventoryItemFromDb(updatedDbItem))
          setDialogOpen(false)
          setIsSubmitting(false)
        },
        onError: () => {
          setIsSubmitting(false)
        }
      })
    } else {
      createInventoryItem.mutate({
        name: formData.name,
        category: formData.category,
        quantity: 0,
        price: 0,
        cost: 0,
        reorder_level: 0,
        description: formData.description,
        is_active: true,
      }, {
        onSuccess: async (newItem) => {
          try {
            toast.success("Item added successfully")
            const uiItem: InventoryItem = {
              id: newItem.id,
              name: newItem.name,
              category: newItem.category as 'retail' | 'supply',
              sku: newItem.sku || '',
              quantity: newItem.quantity,
              price: newItem.price || 0,
              cost: newItem.cost || 0,
              reorderLevel: newItem.reorder_level,
              supplier: newItem.supplier,
              description: newItem.description,
              updated_at: newItem.updated_at,
            }

            if (initialReceipt) {
              const receiveResult = await handleReceiveSubmit(uiItem, initialReceiveFormData, initialReceipt)

              if (receiveResult && uiItem.category === 'retail' && receiveResult.costingResult) {
                const updatedItem: typeof uiItem = {
                  ...uiItem,
                  quantity: receiveResult.costingResult.on_hand_qty,
                  cost: receiveResult.costingResult.avg_unit_cost ?? receiveResult.costPerUnit,
                  avgUnitCost: receiveResult.costingResult.avg_unit_cost,
                  inventoryValue: receiveResult.costingResult.inventory_value,
                  lastUnitCost: receiveResult.costingResult.last_unit_cost ?? receiveResult.costPerUnit,
                  updated_at: receiveResult.costingResult.updated_at,
                }
                handleOpenRetailPricingDialog(updatedItem)
              }
            }
          } finally {
            setDialogOpen(false)
            setInitialReceiveFormData(createEmptyReceiveFormData())
            setIsSubmitting(false)
          }
        },
        onError: () => {
          setIsSubmitting(false)
        }
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteInventoryItemMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Item deleted")
        setDeleteDialogOpen(false)
        setDialogOpen(false)
      }
    })
  }

  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true)
  }

  const handleOpenReceiveDialog = (item: InventoryItem) => {
    setReceivingItem(item)
    setReceiveFormData(createEmptyReceiveFormData())
    setReceiveDialogOpen(true)
  }

  const handleReceiveFormChange = (field: 'qty' | 'totalCost' | 'costPerUnit', value: string) => {
    setReceiveFormData(getNextReceiveFormData(receiveFormData, field, value))
  }

  const handleInitialReceiveFormChange = (field: 'qty' | 'totalCost' | 'costPerUnit', value: string) => {
    setInitialReceiveFormData(getNextReceiveFormData(initialReceiveFormData, field, value))
  }

  const handleReceiveSubmit = async (
    item?: InventoryItem | null,
    currentReceiveFormData?: ReceiveFormData,
    parsedReceiveData?: { qty: number; costPerUnit: number; totalCost: number } | null,
  ) => {
    const targetItem = item ?? receivingItem
    const nextReceiveFormData = currentReceiveFormData ?? receiveFormData
    const nextParsedReceiveData = parsedReceiveData ?? parseReceiveFormData(nextReceiveFormData)

    if (!targetItem || !nextParsedReceiveData) {
      return null
    }

    const { qty, costPerUnit, totalCost } = nextParsedReceiveData
    const today = new Date().toISOString().split('T')[0]

    try {
      // Use weighted-average purchase RPC (atomic: updates qty + avg_unit_cost in one transaction)
      const costingResult = await recordPurchase.mutateAsync({
        itemId: targetItem.id,
        qty,
        unitCost: costPerUnit,
        referenceType: 'purchase',
        notes: `Received ${qty} units of ${targetItem.name} @ $${costPerUnit.toFixed(2)} each`,
      })

      try {
        await createExpense.mutateAsync({
          category: 'supplies',
          vendor: targetItem.supplier || 'Inventory Purchase',
          date: today,
          amount: totalCost,
          description: `Received ${qty} units of ${targetItem.name} @ $${costPerUnit.toFixed(2)} each`
        })
      } catch {
        toast.warning('Inventory was received, but the expense record could not be saved.')
      }

      toast.success(`Received ${qty} units of ${targetItem.name}`)
      return { costingResult, qty, costPerUnit }
    } catch {
      toast.error('Failed to save inventory receive entry. Please refresh and verify item quantity.')
      return null
    }
  }

  const handleOpenRetailPricingDialog = (item: InventoryItem) => {
    setPricingItem(item)
    setRetailPricingFormData({
      retailPrice: item.price ? item.price.toString() : "",
      commissionType: item.staffCompensationType || "",
      commissionAmount: item.staffCompensationValue ? item.staffCompensationValue.toString() : ""
    })
    setRetailPricingDialogOpen(true)
  }

  const handleRetailPricingSubmit = () => {
    if (!retailPricingFormData.retailPrice || !pricingItem) {
      toast.error("Please enter a retail price")
      return
    }

    setIsSubmitting(true)
    const retailPrice = parseFloat(retailPricingFormData.retailPrice)
    const commissionAmount = retailPricingFormData.commissionAmount ? parseFloat(retailPricingFormData.commissionAmount) : undefined

    updateInventoryItemMutation.mutate({
      id: pricingItem.id,
      updated_at: pricingItem.updated_at,
      price: retailPrice,
      staff_compensation_type: (retailPricingFormData.commissionType as 'none' | 'percentage' | 'fixed') || 'none',
      staff_compensation_value: commissionAmount ?? 0
    }, {
      onSuccess: () => {
        toast.success("Retail pricing updated successfully")
        setRetailPricingDialogOpen(false)
        setPricingItem(null)
        setIsSubmitting(false)
      },
      onError: () => {
        setIsSubmitting(false)
      }
    })
  }

  const renderInventoryTable = (items: InventoryItem[], categoryLabel: string) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-3 text-sm font-medium text-muted-foreground">Item</th>
            <th className="text-right p-3 text-sm font-medium text-muted-foreground">In Stock</th>
            <th className="text-right p-3 text-sm font-medium text-muted-foreground">Avg Cost</th>
            <th className="text-right p-3 text-sm font-medium text-muted-foreground">Last Cost</th>
            {categoryLabel === 'Retail' && (
              <>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Commission</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Retail</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Profit</th>
              </>
            )}
            <th className="text-center p-3 text-sm font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={categoryLabel === 'Retail' ? 9 : 5} className="text-center py-12 text-muted-foreground">
                <Package size={48} className="mx-auto mb-3 opacity-50" />
                <p>No items found</p>
              </td>
            </tr>
          ) : (
            items.map(item => {
              const profit = categoryLabel === 'Retail' ? getInventoryPotentialProfitPerUnit(item) : 0
              return (
                <tr key={item.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                  <td className="p-3">
                    <div className="font-medium">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <span className={`font-medium ${
                      item.quantity <= item.reorderLevel ? 'text-destructive' : ''
                    }`}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="p-3 text-right text-sm">
                    {item.quantity > 0 && item.avgUnitCost != null
                      ? `$${Number(item.avgUnitCost).toFixed(2)}`
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3 text-right text-sm">
                    {item.lastUnitCost != null
                      ? `$${Number(item.lastUnitCost).toFixed(2)}`
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  {categoryLabel === 'Retail' && (
                    <>
                      <td className="p-3 text-right text-sm">
                        {item.staffCompensationType && item.staffCompensationValue !== undefined ? (
                          item.staffCompensationType === 'fixed' 
                            ? `$${item.staffCompensationValue.toFixed(2)}`
                            : `${item.staffCompensationValue}%`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium">
                        ${item.price.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-medium">
                        ${profit.toFixed(2)}
                      </td>
                    </>
                  )}
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenDialog(item)}
                        className="text-primary hover:opacity-80"
                      >
                        <PencilSimple size={18} />
                      </button>
                      <button
                        onClick={() => handleOpenReceiveDialog(item)}
                        className="text-primary hover:opacity-80"
                      >
                        <DownloadSimple size={18} />
                      </button>
                      {categoryLabel === 'Retail' && (
                        <button
                          onClick={() => handleOpenRetailPricingDialog(item)}
                          className="text-primary hover:opacity-80"
                        >
                          <Tag size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div data-testid="page-inventory" className="min-h-full bg-background p-3 sm:p-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "inventory")} className="w-full">
        <TabsContent value="inventory" className="space-y-4">
          {lowStockItems.length > 0 && (
            <Card className="p-4 border-destructive/50 bg-destructive/5">
              <div className="flex items-start gap-3">
                <Warning size={24} className="text-destructive flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-destructive mb-2">Low Stock Alert</h3>
                  <div className="space-y-1">
                    {lowStockItems.map(item => (
                      <div key={item.id} className="text-sm">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted-foreground"> - {item.quantity} remaining (reorder at {item.reorderLevel})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-2 md:p-2.5 border-border">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">COST VALUE</p>
                  <p className="text-lg md:text-xl font-bold mt-0.5">${inventorySummary.costValue.toFixed(2)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-2 md:p-2.5 border-border">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">TOTAL POTENTIAL REVENUE</p>
                  <p className="text-lg md:text-xl font-bold mt-0.5">${inventorySummary.totalPotentialRevenue.toFixed(2)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-2 md:p-2.5 border-border">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">SUPPLY VALUE</p>
                  <p className="text-lg md:text-xl font-bold mt-0.5">${inventorySummary.supplyValue.toFixed(2)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-2 md:p-2.5 border-border">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">POTENTIAL PROFIT</p>
                  <p className="text-lg md:text-xl font-bold mt-0.5">${inventorySummary.potentialProfit.toFixed(2)}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by name or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => navigate('/inventory/history')} variant="outline" className="w-full sm:w-auto">
              <ClockCounterClockwise className="mr-2" />
              History
            </Button>
            <Button data-testid="inventory-new" onClick={() => handleOpenDialog()} className="w-full sm:w-auto bg-primary text-primary-foreground">
              <Plus className="mr-2" />
              Add Item
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">Retail Products</h3>
                  <p className="text-sm text-muted-foreground">Items for sale to customers</p>
                </div>
                <Package size={32} className="text-primary opacity-50" />
              </div>
              {renderInventoryTable(retailItems, 'Retail')}
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">Supplies</h3>
                  <p className="text-sm text-muted-foreground">Items for business use</p>
                </div>
                <Package size={32} className="text-secondary opacity-50" />
              </div>
              {renderInventoryTable(supplyItems, 'Supply')}
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </DialogTitle>
            {!editingItem && (
              <DialogDescription>
                Create the item details and optionally set the starting quantity below.
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Premium Dog Shampoo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(v: "retail" | "supply") => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail (For Sale)</SelectItem>
                  <SelectItem value="supply">Supply (For Use)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Item description..."
                rows={3}
              />
            </div>

            {!editingItem && (
              <div className="border-t pt-4">
                <ReceiveFormFields
                  title="Initial Quantity"
                  description="Optional starting inventory for this item."
                  formValues={initialReceiveFormData}
                  onChange={handleInitialReceiveFormChange}
                  qtyId="initialQty"
                  totalCostId="initialTotalCost"
                  costPerUnitId="initialCostPerUnit"
                  projectedQuantityLabel="Initial stock on hand"
                  projectedQuantity={getProjectedQuantity(initialReceiveFormData.qty)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            {editingItem && (
              <Button 
                variant="destructive" 
                onClick={handleOpenDeleteDialog}
                className="mr-auto"
              >
                <Trash className="mr-2" />
                Delete Item
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button data-testid="inventory-save" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : (editingItem ? 'Update' : 'Add') + ' Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{editingItem?.name}" from your inventory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => editingItem && handleDelete(editingItem.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receive Item</DialogTitle>
            <DialogDescription>
              Add more stock and update the item&apos;s purchase cost details.
            </DialogDescription>
          </DialogHeader>

          <ReceiveFormFields
            formValues={receiveFormData}
            onChange={handleReceiveFormChange}
            qtyId="qty"
            totalCostId="totalCost"
            costPerUnitId="costPerUnit"
            projectedQuantityLabel="Received to total stock"
            projectedQuantity={receiveFormData.qty && receivingItem
              ? getProjectedQuantity(receiveFormData.qty, receivingItem.quantity)
              : undefined}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!receivingItem) {
                  return
                }

                setIsSubmitting(true)
                const receiveResult = await handleReceiveSubmit()

                if (receiveResult) {
                  setReceiveDialogOpen(false)

                  if (receivingItem.category === 'retail') {
                    const updatedItem: typeof receivingItem = {
                      ...receivingItem,
                      quantity: receiveResult.costingResult.on_hand_qty,
                      cost: receiveResult.costingResult.avg_unit_cost ?? receiveResult.costPerUnit,
                      avgUnitCost: receiveResult.costingResult.avg_unit_cost,
                      inventoryValue: receiveResult.costingResult.inventory_value,
                      lastUnitCost: receiveResult.costingResult.last_unit_cost ?? receiveResult.costPerUnit,
                      updated_at: receiveResult.costingResult.updated_at,
                    }
                    handleOpenRetailPricingDialog(updatedItem)
                  }

                  setReceivingItem(null)
                }

                setIsSubmitting(false)
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting…' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={retailPricingDialogOpen} onOpenChange={setRetailPricingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Retail Pricing</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="perItemCost">Per Item (my price)</Label>
              <Input
                id="perItemCost"
                type="text"
                value={pricingItem ? `$${pricingItem.cost.toFixed(2)}` : ''}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retailPrice">Retail Price *</Label>
              <Input
                id="retailPrice"
                type="number"
                step="0.01"
                value={retailPricingFormData.retailPrice}
                onChange={(e) => setRetailPricingFormData({ ...retailPricingFormData, retailPrice: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Commission Type *</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => setRetailPricingFormData({ ...retailPricingFormData, commissionType: 'fixed' })}
                  variant={retailPricingFormData.commissionType === 'fixed' ? 'default' : 'outline'}
                  className="flex-1"
                >
                  Fixed
                </Button>
                <Button
                  type="button"
                  onClick={() => setRetailPricingFormData({ ...retailPricingFormData, commissionType: 'percentage' })}
                  variant={retailPricingFormData.commissionType === 'percentage' ? 'default' : 'outline'}
                  className="flex-1"
                >
                  Percentage
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commissionAmount">Commission Amount *</Label>
              <div className="relative">
                <Input
                  id="commissionAmount"
                  type="number"
                  step={retailPricingFormData.commissionType === 'percentage' ? '1' : '0.01'}
                  value={retailPricingFormData.commissionAmount}
                  onChange={(e) => setRetailPricingFormData({ ...retailPricingFormData, commissionAmount: e.target.value })}
                  placeholder="0"
                  className={retailPricingFormData.commissionType === 'percentage' ? 'pr-8' : 'pl-8'}
                />
                {retailPricingFormData.commissionType === 'fixed' && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                )}
                {retailPricingFormData.commissionType === 'percentage' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRetailPricingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRetailPricingSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
