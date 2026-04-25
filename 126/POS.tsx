import { useState, useMemo, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useAppointmentServicesByAppointmentIds, useAppointments, useUpdateAppointment, type AppointmentService as DbAppointmentService } from "@/hooks/data/useAppointments"
import { useClients, useAllPets } from "@/hooks/data/useClients"
import { useInventoryItems, useRecordInventorySale } from "@/hooks/data/useInventory"
import { usePaymentMethodConfigs } from "@/hooks/data/useBusinessSettings"
import { appointmentFromDb } from "@/lib/mappers/appointmentMapper"
import { inventoryItemsFromDb } from "@/lib/mappers/inventoryMapper"
import { toast } from "sonner"
import { TransactionItem, InventoryItem } from "@/lib/types"
import { MagnifyingGlass, ShoppingCart, Trash, Plus, Minus, Receipt, CurrencyDollar, PawPrint } from "@phosphor-icons/react"
import { getTodayInBusinessTimezone } from "@/lib/date-utils"
import { CardPaymentModal } from "@/components/CardPaymentModal"
import { paymentClient, type StripeSaleMetadata } from "@/stripe/client"
import { supabase } from "@/lib/supabase"
import { useActiveStore } from "@/hooks/useActiveStore"
import {
  calculateSalesTaxForItems,
  calculateTaxableSubtotalForItems,
  DEFAULT_SALES_TAX_SETTINGS,
  normalizeSalesTaxSettings,
} from "@/lib/salesTax"

const normalizePosPaymentMethod = (methodName: string): "cash" | "card" | null => {
  const normalized = methodName.trim().toLowerCase()
  if (normalized.includes("cash")) return "cash"
  if (normalized.includes("card") || normalized.includes("credit") || normalized.includes("debit")) return "card"
  return null
}

export function POS() {
  const location = useLocation()
  const navigate = useNavigate()
  const { storeId } = useActiveStore()
  const { data: dbAppointments } = useAppointments()
  const appointmentIds = useMemo(() => (dbAppointments ?? []).map((appointment) => appointment.id), [dbAppointments])
  const { data: dbAppointmentServices } = useAppointmentServicesByAppointmentIds(appointmentIds)
  const { data: dbClients } = useClients()
  const { data: dbPets } = useAllPets()
  const { data: dbInventory } = useInventoryItems()
  const { data: dbPaymentMethods } = usePaymentMethodConfigs()
  const updateAppointment = useUpdateAppointment()
  const recordInventorySale = useRecordInventorySale()

  const appointments = useMemo(() => {
    const servicesByAppointment = new Map<string, DbAppointmentService[]>()
    for (const service of dbAppointmentServices ?? []) {
      const existing = servicesByAppointment.get(service.appointment_id) ?? []
      existing.push(service)
      servicesByAppointment.set(service.appointment_id, existing)
    }

    const clientMap = new Map((dbClients ?? []).map(client => [client.id, client]))
    const petMap = new Map((dbPets ?? []).map(pet => [pet.id, pet]))

    return (dbAppointments || []).map(db => {
      const client = clientMap.get(db.client_id)
      const pet = db.pet_id ? petMap.get(db.pet_id) : undefined

      return appointmentFromDb(
        db,
        servicesByAppointment.get(db.id),
        client ? `${client.first_name} ${client.last_name}`.trim() : '',
        pet?.name ?? '',
        pet?.breed ?? undefined,
        pet?.weight ?? undefined,
        pet?.weight_category ?? undefined,
      )
    })
  }, [dbAppointmentServices, dbAppointments, dbClients, dbPets])

  const inventory = useMemo(() => dbInventory ? inventoryItemsFromDb(dbInventory) : [], [dbInventory])
  const paymentMethods = useMemo(() => {
    const records = dbPaymentMethods && dbPaymentMethods.length > 0
      ? dbPaymentMethods
      : [
          { id: "cash", method_name: "Cash", is_enabled: true },
          { id: "card", method_name: "Card", is_enabled: false },
        ]
    const enabledByMethod: Record<"cash" | "card", boolean> = { cash: false, card: false }

    records.forEach((pm) => {
      const normalized = normalizePosPaymentMethod(pm.method_name)
      if (!normalized) return
      enabledByMethod[normalized] = enabledByMethod[normalized] || pm.is_enabled
    })

    return [
      { id: "cash", name: "Cash", enabled: enabledByMethod.cash },
      { id: "card", name: "Card", enabled: enabledByMethod.card },
    ]
  }, [dbPaymentMethods])
  
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [cartItems, setCartItems] = useState<TransactionItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [discountDescription, setDiscountDescription] = useState("")
  const [additionalFees, setAdditionalFees] = useState(0)
  const [additionalFeesDescription, setAdditionalFeesDescription] = useState("")
  const [tipAmount, setTipAmount] = useState(0)
  const [tipPaymentMethod, setTipPaymentMethod] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)
  const [cardPaymentModalOpen, setCardPaymentModalOpen] = useState(false)
  const [isFinalizingCheckout, setIsFinalizingCheckout] = useState(false)
  const [salesTaxSettings, setSalesTaxSettings] = useState(DEFAULT_SALES_TAX_SETTINGS)
  const [cardAcceptanceOptions, setCardAcceptanceOptions] = useState({
    tapToPayEnabled: true,
    manualCardEntryEnabled: true,
    onlinePaymentLinksEnabled: true,
  })
  const appliedAppointmentCartSignature = useRef("")
  
  const enabledPaymentMethods = (paymentMethods || []).filter(pm => pm.enabled)
  const tipPaymentLabel = tipPaymentMethod === "cash" ? "Cash" : tipPaymentMethod === "card" ? "Card" : ""
  const checkoutAppointmentIdFromRoute =
    typeof location.state === 'object' &&
    location.state &&
    'checkoutAppointmentId' in location.state &&
    typeof location.state.checkoutAppointmentId === 'string'
      ? location.state.checkoutAppointmentId
      : null

  const checkoutEligibleAppointments = useMemo(
    () => (appointments || []).filter((appointment) => appointment.status === 'ready' || appointment.status === 'in_progress'),
    [appointments],
  )

  const checkoutAppointments = useMemo(() => {
    const today = getTodayInBusinessTimezone()
    return checkoutEligibleAppointments.filter((appointment) => appointment.date === today)
  }, [checkoutEligibleAppointments])

  const pickedUpAppointments = useMemo(
    () =>
      [...(appointments || [])]
        .filter((appointment) => appointment.status === 'picked_up')
        .sort((a, b) => (b.pickedUpAt ?? b.date).localeCompare(a.pickedUpAt ?? a.date)),
    [appointments],
  )

  const selectedAppointment = useMemo(
    () => checkoutEligibleAppointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null,
    [checkoutEligibleAppointments, selectedAppointmentId],
  )

  const selectedAppointmentServiceSignature = useMemo(
    () =>
      selectedAppointment?.services
        .map((service) => `${service.serviceId}:${service.serviceName}:${service.price}:${service.type}`)
        .join("|") ?? "",
    [selectedAppointment],
  )

  const retailProducts = (inventory || []).filter(item => item.category === 'retail')

  useEffect(() => {
    let active = true

    void paymentClient.getPosSettings()
      .then((res) => {
        if (!active) return
        setCardAcceptanceOptions({
          tapToPayEnabled: res.settings?.tap_to_pay_enabled ?? true,
          manualCardEntryEnabled: res.settings?.manual_card_entry_enabled ?? true,
          onlinePaymentLinksEnabled: res.settings?.online_payment_links_enabled ?? true,
        })
        setSalesTaxSettings(normalizeSalesTaxSettings(res.settings?.sales_tax))
      })
      .catch((error) => {
        console.error('Failed to load POS tax settings', error)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!checkoutAppointmentIdFromRoute) return

    setSelectedAppointmentId((currentAppointmentId) =>
      currentAppointmentId === checkoutAppointmentIdFromRoute ? currentAppointmentId : checkoutAppointmentIdFromRoute
    )
    navigate(location.pathname, { replace: true, state: null })
  }, [checkoutAppointmentIdFromRoute, location.pathname, navigate])

  useEffect(() => {
    if (!selectedAppointmentId) {
      appliedAppointmentCartSignature.current = ""
      return
    }

    const nextAppointmentCartSignature = `${selectedAppointmentId}|${selectedAppointmentServiceSignature}`
    if (appliedAppointmentCartSignature.current === nextAppointmentCartSignature) return
    appliedAppointmentCartSignature.current = nextAppointmentCartSignature

    setCartItems((currentItems) => {
      const productItems = currentItems.filter((item) => item.type === 'product')
      const appointmentItems: TransactionItem[] = (selectedAppointment?.services ?? []).map(service => ({
        id: service.serviceId,
        name: service.serviceName,
        type: 'service',
        quantity: 1,
        price: service.price,
        total: service.price
      }))
      return [...appointmentItems, ...productItems]
    })
  }, [selectedAppointment, selectedAppointmentId, selectedAppointmentServiceSignature])

  const handleSelectAppointment = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId)
  }

  const buildStripeSaleMetadata = (): StripeSaleMetadata => {
    const selectedPaymentMethodName = enabledPaymentMethods.find((pm) => pm.id === paymentMethod)?.name ?? paymentMethod
    return {
      appointmentId: selectedAppointment?.id || null,
      clientId: selectedAppointment?.clientId || null,
      clientName: selectedAppointment?.clientName || "Walk-in",
      petName: selectedAppointment?.petName || null,
      groomerName: selectedAppointment?.groomerName || null,
      items: cartItems.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type === "service" || item.type === "product" ? item.type : "other",
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
      subtotal: calculateSubtotal(),
      taxableSubtotal: calculateTaxableSubtotal(),
      taxAmount: calculateSalesTax(),
      taxRate: salesTaxSettings.rate,
      discount,
      discountDescription,
      additionalFees,
      additionalFeesDescription,
      totalBeforeTip: calculateTotalBeforeTip(),
      total: calculateTotal(),
      tipAmount,
      tipPaymentMethod: tipAmount > 0 ? tipPaymentMethod : null,
      paymentMethod: selectedPaymentMethodName || paymentMethod || null,
    }
  }

  const handleAddProduct = (product: InventoryItem) => {
    if (product.quantity === 0) {
      toast.error(`${product.name} is out of stock`)
      return
    }

    const existingItem = cartItems.find(item => item.id === product.id && item.type === 'product')

    if (existingItem) {
      if (existingItem.quantity >= product.quantity) {
        toast.error(`Cannot add more ${product.name} — only ${product.quantity} in stock`)
        return
      }
      setCartItems(cartItems.map(item =>
        item.id === product.id && item.type === 'product'
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ))
    } else {
      setCartItems([...cartItems, {
        id: product.id,
        name: product.name,
        type: 'product',
        quantity: 1,
        price: product.price,
        total: product.price
      }])
    }
    toast.success(`Added ${product.name} to cart`)
  }

  const handleUpdateQuantity = (itemId: string, itemType: 'service' | 'product', delta: number) => {
    if (delta > 0 && itemType === 'product') {
      const cartItem = cartItems.find(item => item.id === itemId && item.type === 'product')
      const product = (inventory || []).find(p => p.id === itemId)
      if (cartItem && product && cartItem.quantity >= product.quantity) {
        toast.error(`Cannot add more ${cartItem.name} — only ${product.quantity} in stock`)
        return
      }
    }
    setCartItems(cartItems.map(item => {
      if (item.id === itemId && item.type === itemType) {
        const newQuantity = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQuantity, total: newQuantity * item.price }
      }
      return item
    }))
  }

  const handleRemoveItem = (itemId: string, itemType: 'service' | 'product') => {
    setCartItems(cartItems.filter(item => !(item.id === itemId && item.type === itemType)))
  }

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + item.total, 0)
  }

  const calculateTaxableSubtotal = () => {
    return calculateTaxableSubtotalForItems(
      cartItems.map((item) => ({ item_type: item.type, total: item.total })),
      salesTaxSettings
    )
  }

  const calculateSalesTax = () => {
    return calculateSalesTaxForItems(
      cartItems.map((item) => ({ item_type: item.type, total: item.total })),
      salesTaxSettings,
      discount
    )
  }

  const calculateTotalBeforeTip = () => {
    const subtotal = calculateSubtotal()
    return subtotal - discount + additionalFees + calculateSalesTax()
  }

  const calculateTotal = () => {
    return calculateTotalBeforeTip() + tipAmount
  }

  const handleCheckout = async () => {
    if (isFinalizingCheckout) {
      return
    }

    if (cartItems.length === 0) {
      toast.error("Cart is empty")
      return
    }

    if (!storeId) {
      toast.error("Please select an active store before checking out")
      return
    }
    
    if (!paymentMethod) {
      toast.error("Please select a payment method")
      return
    }

    if (tipAmount > 0 && !tipPaymentMethod) {
      toast.error("Please select a tip payment method")
      return
    }

    const isCardPayment = ["credit", "debit", "card"].includes(paymentMethod.toLowerCase())
    if (isCardPayment) {
      if (!cardAcceptanceOptions.tapToPayEnabled && !cardAcceptanceOptions.manualCardEntryEnabled && !cardAcceptanceOptions.onlinePaymentLinksEnabled) {
        toast.error("All card entry methods are turned off in POS settings.")
        return
      }
      setCheckoutDialogOpen(false)
      setCardPaymentModalOpen(true)
      return
    }

    await completeOfflineTransaction()
  }

  const handleCardPaymentSuccess = async (paymentIntentId: string, _chargeId?: string, _method?: string) => {
    try {
      if (!storeId) throw new Error("Please select an active store before checking out")
      const finalized = await paymentClient.finalizeSale(paymentIntentId)
      toast.success("Transaction completed!")
      setCheckoutDialogOpen(false)
      setCardPaymentModalOpen(false)
      resetCart()
      navigate(`/receipts/${finalized.receiptId || paymentIntentId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to finalize transaction")
    }
  }

  const handlePaymentLinkCreated = (_sessionId: string) => {
    // A Checkout link is NOT a completed sale. Keep the cart/order context in
    // place so the cashier can copy/resend the link. The sale will be finalized
    // only after Checkout payment succeeds via /payments/success or the webhook.
    toast.success("Payment link created – cart held until customer pays.")
  }

  const finalizeInventoryAdjustments = async (referenceId: string) => {
    if (selectedAppointment) {
      updateAppointment.mutate({
        id: selectedAppointment.id,
        updated_at: selectedAppointment.updatedAt,
        status: 'picked_up',
        picked_up_at: new Date().toISOString(),
        tip_amount: tipAmount,
        tip_payment_method: tipAmount > 0 ? tipPaymentMethod : undefined
      })
    }

    for (const item of cartItems.filter(i => i.type === 'product')) {
      const product = (inventory || []).find(p => p.id === item.id)
      if (product) {
        await recordInventorySale.mutateAsync({
          itemId: product.id,
          qty: item.quantity,
          referenceType: 'sale',
          referenceId: referenceId,
          notes: `PI #${referenceId.slice(-6)}`,
        })
      }
    }
  }

  const completeOfflineTransaction = async () => {
    setIsFinalizingCheckout(true)

    try {
      if (!storeId) throw new Error("Please select an active store before checking out")

      const internalId = `offline_${Date.now()}`
      const paymentMethodName = enabledPaymentMethods.find(pm => pm.id === paymentMethod)?.name ?? paymentMethod
      const metadata = {
        appointmentId: selectedAppointment?.id || null,
        clientId: selectedAppointment?.clientId || null,
        clientName: selectedAppointment?.clientName || "Walk-in",
        petName: selectedAppointment?.petName || null,
        groomerName: selectedAppointment?.groomerName || null,
        items: cartItems,
        subtotal: calculateSubtotal(),
        taxableSubtotal: calculateTaxableSubtotal(),
        taxAmount: calculateSalesTax(),
        taxRate: salesTaxSettings.rate,
        discount,
        discountDescription,
        additionalFees,
        additionalFeesDescription,
        totalBeforeTip: calculateTotalBeforeTip(),
        total: calculateTotal(),
        tipAmount,
        tipPaymentMethod: tipAmount > 0 ? tipPaymentMethod : null,
        paymentMethod: paymentMethodName,
      }
      const { error } = await supabase.from("payment_intents").insert({
        stripe_payment_intent_id: internalId,
        status: "succeeded",
        amount: Math.round(calculateTotal() * 100),
        currency: "usd",
        payment_method: paymentMethodName,
        store_id: storeId,
        metadata,
      })
      if (error) throw error

      await finalizeInventoryAdjustments(internalId)
      toast.success("Transaction completed!")
      setCheckoutDialogOpen(false)
      resetCart()
      navigate(`/receipts/${internalId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete transaction")
    } finally {
      setIsFinalizingCheckout(false)
    }
  }

  const resetCart = () => {
    setSelectedAppointmentId(null)
    setCartItems([])
    setDiscount(0)
    setDiscountDescription("")
    setAdditionalFees(0)
    setAdditionalFeesDescription("")
    setTipAmount(0)
    setTipPaymentMethod("")
    setPaymentMethod("")
  }

  const filteredProducts = retailProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div data-testid="page-pos" className="min-h-full bg-background p-3 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Retail Products</h2>
              <div className="relative w-64">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto scrollbar-thin">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full text-center text-muted-foreground py-8">
                  <ShoppingCart size={48} className="mx-auto mb-3 opacity-50" />
                  <p>No products found</p>
                </div>
              ) : (
                filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => handleAddProduct(product)}
                    className="p-3 border border-border rounded-lg hover:border-primary transition-colors text-left"
                    disabled={
                      product.quantity === 0 ||
                      (cartItems.find(item => item.id === product.id && item.type === 'product')?.quantity ?? 0) >= product.quantity
                    }
                  >
                    <div className="font-medium truncate">{product.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">Stock: {product.quantity}</div>
                    <div className="text-lg font-bold text-primary mt-2">${product.price.toFixed(2)}</div>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-3">Today's Completed Appointments</h2>
            <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
              {checkoutAppointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No completed appointments today</p>
              ) : (
                checkoutAppointments.map(apt => (
                  <button
                    key={apt.id}
                    onClick={() => handleSelectAppointment(apt.id)}
                    className={`w-full text-left p-3 border rounded-lg transition-colors ${
                      selectedAppointment?.id === apt.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <PawPrint size={12} weight="fill" className="text-primary shrink-0" />
                          <span>{apt.petName} - {apt.clientName}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{apt.startTime}</div>
                      </div>
                      <div className="text-lg font-bold text-primary">${apt.totalPrice.toFixed(2)}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-3">Picked Up Appointment History</h2>
            <div className="space-y-2 max-h-[260px] overflow-y-auto scrollbar-thin">
              {pickedUpAppointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No picked-up appointments yet</p>
              ) : (
                pickedUpAppointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          <PawPrint size={12} weight="fill" className="text-primary shrink-0" />
                          <span className="truncate">{appointment.petName} - {appointment.clientName}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {appointment.date} • Picked up
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-primary">${appointment.totalPrice.toFixed(2)}</div>
                        {appointment.pickedUpAt ? (
                          <div className="text-xs text-muted-foreground">
                            {new Date(appointment.pickedUpAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="p-4 sticky top-4">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart size={20} className="text-primary" />
              <h2 className="text-lg font-semibold">Cart</h2>
              {cartItems.length > 0 && (
                <Badge variant="secondary">{cartItems.length}</Badge>
              )}
            </div>

            <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto scrollbar-thin">
              {cartItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Cart is empty</p>
              ) : (
                cartItems.map((item, idx) => (
                  <div key={`${item.id}-${item.type}-${idx}`} className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <Badge variant="secondary" className="text-xs mt-1">{item.type}</Badge>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.id, item.type)}
                        className="text-destructive hover:opacity-80"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.type, -1)}
                          className="w-6 h-6 rounded border border-border hover:border-primary flex items-center justify-center"
                          disabled={item.quantity === 1}
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.type, 1)}
                          className="w-6 h-6 rounded border border-border hover:border-primary flex items-center justify-center"
                          disabled={
                            item.type === 'product' &&
                            ((inventory || []).find(p => p.id === item.id)?.quantity ?? Infinity) <= item.quantity
                          }
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="font-semibold">${item.total.toFixed(2)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="discount">Discount ($)</Label>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              
              {discount > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="discount-desc">Discount Description</Label>
                  <Input
                    id="discount-desc"
                    value={discountDescription}
                    onChange={(e) => setDiscountDescription(e.target.value)}
                    placeholder="e.g., Senior discount, Loyalty reward"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fees">Additional Fees ($)</Label>
                <Input
                  id="fees"
                  type="number"
                  min="0"
                  step="0.01"
                  value={additionalFees}
                  onChange={(e) => setAdditionalFees(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              
              {additionalFees > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="fees-desc">Fee Description</Label>
                  <Input
                    id="fees-desc"
                    value={additionalFeesDescription}
                    onChange={(e) => setAdditionalFeesDescription(e.target.value)}
                    placeholder="e.g., Rush service, Special handling"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="tip">Tip Amount ($)</Label>
                <Input
                  id="tip"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>

              {tipAmount > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="tip-method">Tip Payment Method</Label>
                  <Select value={tipPaymentMethod} onValueChange={setTipPaymentMethod}>
                    <SelectTrigger id="tip-method">
                      <SelectValue placeholder="Select tip payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="payment">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledPaymentMethods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Discount {discountDescription && `(${discountDescription})`}
                  </span>
                  <span className="font-medium text-green-500">-${discount.toFixed(2)}</span>
                </div>
              )}
              {additionalFees > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Additional Fees {additionalFeesDescription && `(${additionalFeesDescription})`}
                  </span>
                  <span className="font-medium">+${additionalFees.toFixed(2)}</span>
                </div>
              )}
              {calculateSalesTax() > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sales Tax ({salesTaxSettings.rate}%)</span>
                  <span className="font-medium">+${calculateSalesTax().toFixed(2)}</span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tip {tipPaymentLabel && `(${tipPaymentLabel})`}
                  </span>
                  <span className="font-medium">+${tipAmount.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between text-lg">
                <span className="font-bold">Total</span>
                <span className="font-bold text-primary text-2xl">${calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            <Button
              onClick={() => setCheckoutDialogOpen(true)}
              disabled={cartItems.length === 0}
              className="w-full mt-4"
              size="lg"
            >
              <Receipt className="mr-2" />
              Checkout
            </Button>

            {cartItems.length > 0 && (
              <Button
                onClick={resetCart}
                variant="outline"
                className="w-full mt-2"
              >
                Clear Cart
              </Button>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt size={24} className="text-primary" />
              Confirm Transaction
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedAppointment && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Client</div>
                <div className="font-medium">{selectedAppointment.clientName}</div>
                <div className="text-sm flex items-center gap-2">
                  <PawPrint size={12} weight="fill" className="text-primary shrink-0" />
                  <span>{selectedAppointment.petName}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {cartItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span>{item.name} x{item.quantity}</span>
                  <span className="font-medium">${item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>${calculateSubtotal().toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-green-500">
                  <span>
                    Discount {discountDescription && `(${discountDescription})`}
                  </span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
              )}
              {additionalFees > 0 && (
                <div className="flex items-center justify-between">
                  <span>
                    Additional Fees {additionalFeesDescription && `(${additionalFeesDescription})`}
                  </span>
                  <span>+${additionalFees.toFixed(2)}</span>
                </div>
              )}
              {calculateSalesTax() > 0 && (
                <div className="flex items-center justify-between">
                  <span>Sales Tax ({salesTaxSettings.rate}%)</span>
                  <span>+${calculateSalesTax().toFixed(2)}</span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span>
                    Tip {tipPaymentLabel && `(${tipPaymentLabel})`}
                  </span>
                  <span>+${tipAmount.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">${calculateTotal().toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Payment Method</span>
                <span className="capitalize">
                  {enabledPaymentMethods.find(pm => pm.id === paymentMethod)?.name || paymentMethod}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={isFinalizingCheckout}
              loadingText="Completing transaction..."
            >
              <CurrencyDollar className="mr-2" />
              Complete Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardPaymentModal
        open={cardPaymentModalOpen}
        onClose={() => setCardPaymentModalOpen(false)}
        amountCents={Math.round(calculateTotal() * 100)}
        onSuccess={handleCardPaymentSuccess}
        onLinkCreated={handlePaymentLinkCreated}
        description={`Payment for ${selectedAppointment?.clientName || "Walk-in"}`}
        paymentMetadata={buildStripeSaleMetadata()}
        enabledOptions={{
          terminal: cardAcceptanceOptions.tapToPayEnabled,
          manual: cardAcceptanceOptions.manualCardEntryEnabled,
          link: cardAcceptanceOptions.onlinePaymentLinksEnabled,
        }}
      />
    </div>
  )
}
