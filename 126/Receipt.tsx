import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ReceiptView } from "@/components/ReceiptView"
import { toast } from "sonner"
import { paymentClient } from "@/stripe/client"
import { supabase } from "@/lib/supabase"
import { useActiveStore } from "@/hooks/useActiveStore"
import { useClient } from "@/hooks/data/useClients"
import { useBusinessSettings } from "@/hooks/data/useBusinessSettings"
import { businessSettingsFromDb } from "@/lib/mappers/businessSettingsMapper"
import { formatInBusinessTimezone } from "@/lib/date-utils"
import { formatPhoneNumber, validatePhoneNumber } from "@/utils/phone"
import { useAuth } from "@/contexts/AuthContext"
import { useCreateRefund } from "@/hooks/data/usePayments"
import type { Transaction } from "@/lib/types"

interface PaymentRow {
  stripe_payment_intent_id: string
  stripe_charge_id: string | null
  status: string
  amount: number
  currency: string
  payment_method: string
  metadata: Record<string, unknown>
  updated_at?: string
}

interface ReceiptItem {
  id: string
  name: string
  type: 'service' | 'product'
  quantity: number
  price: number
  total: number
}

interface ReceiptMetadata {
  appointmentId?: string | null
  clientId?: string | null
  clientName?: string
  petName?: string
  groomerName?: string
  items?: ReceiptItem[]
  subtotal?: number
  taxableSubtotal?: number
  taxAmount?: number
  taxRate?: string
  discount?: number
  discountDescription?: string
  additionalFees?: number
  additionalFeesDescription?: string
  totalBeforeTip?: number
  total?: number
  tipAmount?: number
  tipPaymentMethod?: string | null
  paymentMethod?: string | null
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const formatMethodLabel = (method?: string) => {
  if (!method) return "Payment"
  // Fall back gracefully for raw UUID values stored by older transactions
  if (UUID_PATTERN.test(method)) return "Card"
  return method
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export const REFUND_REASONS = [
  { value: "requested_by_customer", label: "Requested by customer" },
  { value: "wrong_appointment", label: "Wrong appointment" },
  { value: "discount_correction", label: "Discount correction" },
  { value: "pricing_error", label: "Pricing error" },
  { value: "duplicate_charge", label: "Duplicate charge" },
  { value: "customer_service", label: "Customer service" },
  { value: "other", label: "Other" },
] as const

export type RefundReasonValue = (typeof REFUND_REASONS)[number]["value"]

function buildReceiptTransaction(payment: PaymentRow, metadata: ReceiptMetadata): Transaction {
  const items = Array.isArray(metadata.items)
    ? metadata.items.filter((item): item is ReceiptItem => Boolean(item?.id && item?.name && item?.type))
    : []
  const hasServices = items.some((item) => item.type === "service")
  const hasProducts = items.some((item) => item.type === "product")

  return {
    id: payment.stripe_payment_intent_id,
    appointmentId: metadata.appointmentId ?? undefined,
    date: payment.updated_at ?? new Date().toISOString(),
    clientId: metadata.clientId ?? "",
    clientName: metadata.clientName ?? "Walk-in",
    items,
    subtotal: metadata.subtotal ?? 0,
    discount: metadata.discount ?? 0,
    discountDescription: metadata.discountDescription ?? undefined,
    additionalFees: metadata.additionalFees ?? 0,
    additionalFeesDescription: metadata.additionalFeesDescription ?? undefined,
    total: metadata.total ?? payment.amount / 100,
    tipAmount: metadata.tipAmount ?? 0,
    tipPaymentMethod: metadata.tipPaymentMethod === "cash" || metadata.tipPaymentMethod === "card"
      ? metadata.tipPaymentMethod
      : undefined,
    paymentMethod: typeof metadata.paymentMethod === "string" && metadata.paymentMethod.trim().length > 0
      ? metadata.paymentMethod
      : payment.payment_method,
    status: payment.status.includes("refund")
      ? payment.status.includes("partial")
        ? "partially-refunded"
        : "refunded"
      : "completed",
    type: hasServices && hasProducts ? "mixed" : hasProducts ? "retail" : "appointment",
    stripePaymentIntentId: payment.stripe_payment_intent_id,
    stripeChargeId: payment.stripe_charge_id ?? undefined,
    stripePaymentStatus: payment.status === "succeeded" ? "succeeded" : undefined,
  }
}

function buildReceiptSmsBody({
  businessName,
  businessPhone,
  payment,
  metadata,
}: {
  businessName: string
  businessPhone?: string
  payment: PaymentRow
  metadata: ReceiptMetadata
}) {
  const receiptDate = payment.updated_at
    ? formatInBusinessTimezone(payment.updated_at, "MMM d, yyyy h:mm a")
    : "Just now"
  const lines = [
    businessName,
    "Customer Receipt",
    `Receipt ID: ${payment.stripe_payment_intent_id}`,
    `Date: ${receiptDate}`,
    `Client: ${metadata.clientName || "Walk-in"}`,
    "",
    "Items",
    ...(metadata.items ?? []).map((item) => `• ${item.name} x${item.quantity}  ${formatCurrency(item.total)}`),
    "",
    `Subtotal: ${formatCurrency(metadata.subtotal ?? 0)}`,
  ]

  if ((metadata.discount ?? 0) > 0) {
    lines.push(`Discount: -${formatCurrency(metadata.discount ?? 0)}`)
  }
  if ((metadata.additionalFees ?? 0) > 0) {
    lines.push(`Fees: ${formatCurrency(metadata.additionalFees ?? 0)}`)
  }
  if ((metadata.taxAmount ?? 0) > 0) {
    lines.push(`Tax: ${formatCurrency(metadata.taxAmount ?? 0)}`)
  }
  if ((metadata.tipAmount ?? 0) > 0) {
    lines.push(`Tip: ${formatCurrency(metadata.tipAmount ?? 0)}`)
  }

  lines.push(`Total: ${formatCurrency(metadata.total ?? payment.amount / 100)}`)
  lines.push(`Paid via ${formatMethodLabel(payment.payment_method)}`)

  if (businessPhone) {
    lines.push("", `Questions? Call ${businessPhone}`)
  }

  lines.push("", "Thank you for your business!")

  return lines.join("\n")
}

export function Receipt() {
  const { receiptId } = useParams()
  const navigate = useNavigate()
  const { storeId } = useActiveStore()
  const { user } = useAuth()
  const { mutateAsync: createRefund } = useCreateRefund()
  const [payment, setPayment] = useState<PaymentRow | null>(null)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [refundType, setRefundType] = useState<"full" | "partial">("full")
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReasonCode, setRefundReasonCode] = useState<RefundReasonValue | "">("")
  const [refundNote, setRefundNote] = useState("")
  const [refunding, setRefunding] = useState(false)
  const [textRecipient, setTextRecipient] = useState("")
  const [appointmentPetName, setAppointmentPetName] = useState("")
  const [appointmentStaffName, setAppointmentStaffName] = useState("")

  const amountDollars = useMemo(() => ((payment?.amount ?? 0) / 100).toFixed(2), [payment])
  const metadata = useMemo(() => (payment?.metadata ?? {}) as ReceiptMetadata, [payment])
  const taxAmount = metadata.taxAmount ?? 0
  const clientId = typeof metadata.clientId === "string" ? metadata.clientId : undefined
  const { data: client } = useClient(clientId)
  const { data: dbSettings } = useBusinessSettings()
  const businessInfo = useMemo(() => dbSettings ? businessSettingsFromDb(dbSettings) : null, [dbSettings])
  const receiptTransaction = useMemo(
    () => (payment ? buildReceiptTransaction(payment, metadata) : null),
    [metadata, payment],
  )
  const formattedTextRecipient = useMemo(() => formatPhoneNumber(textRecipient), [textRecipient])
  const canTextReceipt = Boolean(formattedTextRecipient && payment)
  const smsHref = useMemo(() => {
    if (!payment || !formattedTextRecipient) return ""
    const message = buildReceiptSmsBody({
      businessName: businessInfo?.companyName || "Business",
      businessPhone: businessInfo?.businessPhone || "",
      payment,
      metadata,
    })
    return `sms:${formattedTextRecipient}?&body=${encodeURIComponent(message)}`
  }, [businessInfo?.businessPhone, businessInfo?.companyName, formattedTextRecipient, metadata, payment])

  useEffect(() => {
    async function load() {
      if (!receiptId || !storeId) return
      const { data, error } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("store_id", storeId)
        .eq("stripe_payment_intent_id", receiptId)
        .maybeSingle()
      if (error) {
        toast.error("Failed to load receipt")
        return
      }
      setPayment((data as PaymentRow) ?? null)
    }
    void load()
  }, [receiptId, storeId])

  useEffect(() => {
    if (!textRecipient && client?.phone) {
      setTextRecipient(client.phone)
    }
  }, [client?.phone, textRecipient])

  useEffect(() => {
    async function loadAppointmentDetails() {
      if (!storeId) return

      const appointmentId = typeof metadata.appointmentId === "string" ? metadata.appointmentId : ""
      if (!appointmentId) {
        setAppointmentPetName("")
        setAppointmentStaffName("")
        return
      }

      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .select("pet_id, groomer_id")
        .eq("store_id", storeId)
        .eq("id", appointmentId)
        .maybeSingle()

      if (appointmentError || !appointment) {
        setAppointmentPetName("")
        setAppointmentStaffName("")
        return
      }

      const petId = typeof appointment.pet_id === "string" ? appointment.pet_id : ""
      const groomerId = typeof appointment.groomer_id === "string" ? appointment.groomer_id : ""

      const [petResult, staffResult] = await Promise.all([
        petId
          ? supabase
              .from("pets")
              .select("name")
              .eq("id", petId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        groomerId
          ? supabase
              .from("staff")
              .select("first_name, last_name")
              .eq("store_id", storeId)
              .eq("id", groomerId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      const resolvedPetName = petResult.data && typeof petResult.data.name === "string"
        ? petResult.data.name
        : ""
      const resolvedStaffName = staffResult.data
        ? `${staffResult.data.first_name ?? ""} ${staffResult.data.last_name ?? ""}`.trim()
        : ""

      setAppointmentPetName(resolvedPetName)
      setAppointmentStaffName(resolvedStaffName)
    }

    void loadAppointmentDetails()
  }, [metadata.appointmentId, storeId])

  // Case-insensitive: legacy records store "cash" (id) while new records store "Cash" (name)
  const isCashPayment = payment?.payment_method?.toLowerCase() === "cash"
  const canRefund = payment && (payment.status === "succeeded" || payment.status === "partially_refunded")

  function resetRefundForm() {
    setRefundType("full")
    setRefundAmount("")
    setRefundReasonCode("")
    setRefundNote("")
  }

  async function processRefund() {
    if (!payment || !storeId) return
    setRefunding(true)
    try {
      const amountCents =
        refundType === "full"
          ? payment.amount
          : Math.round(parseFloat(refundAmount || "0") * 100)
      if (!amountCents || amountCents <= 0) throw new Error("Invalid refund amount")
      if (!refundReasonCode) throw new Error("Please select a refund reason")

      let stripeRefundId: string
      let refundStatus: string

      if (isCashPayment) {
        stripeRefundId = `cash_refund_${crypto.randomUUID()}`
        refundStatus = "succeeded"
        await createRefund({
          stripe_refund_id: stripeRefundId,
          stripe_payment_intent_id: payment.stripe_payment_intent_id,
          amount: amountCents,
          reason: refundReasonCode,
          notes: refundNote || null,
          status: refundStatus,
          store_id: storeId,
          actor_user_id: user?.id ?? null,
        })
      } else {
        const result = await paymentClient.createRefund(
          payment.stripe_payment_intent_id,
          amountCents,
          refundReasonCode,
        )
        stripeRefundId = result.id
        refundStatus = result.status
      }

      const newStatus = refundType === "full" ? "refunded" : "partially_refunded"
      await supabase
        .from("payment_intents")
        .update({ status: newStatus })
        .eq("stripe_payment_intent_id", payment.stripe_payment_intent_id)
        .eq("store_id", storeId)

      const { data } = await supabase
        .from("payment_intents")
        .select("*")
        .eq("stripe_payment_intent_id", payment.stripe_payment_intent_id)
        .eq("store_id", storeId)
        .maybeSingle()
      setPayment((data as PaymentRow) ?? payment)

      toast.success(
        isCashPayment ? "Cash refund recorded." : "Refund submitted. Status will update via webhook.",
      )
      setRefundDialogOpen(false)
      resetRefundForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refund failed")
    } finally {
      setRefunding(false)
    }
  }

  function handleDialogOpenChange(open: boolean) {
    setRefundDialogOpen(open)
    if (!open) resetRefundForm()
  }

  if (!payment) {
    return <div className="p-6">Receipt not found.</div>
  }

  return (
    <div className="p-6 space-y-4">
      {receiptTransaction && (
        <Card className="p-6">
          <div className="mb-4 space-y-1">
            <h1 className="text-xl font-semibold">Customer Receipt</h1>
          </div>
          <ReceiptView
            transaction={receiptTransaction}
            taxAmount={taxAmount}
            petName={metadata.petName || appointmentPetName}
            staffName={metadata.groomerName || appointmentStaffName}
          />
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Text Receipt</h2>
          <p className="text-sm text-muted-foreground">
            Best on iPad or iPhone — opens Messages with this receipt prefilled.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="receipt-text-recipient">Client phone number</Label>
          <Input
            id="receipt-text-recipient"
            value={textRecipient}
            onChange={(event) => setTextRecipient(event.target.value)}
            placeholder="(555) 123-4567"
            inputMode="tel"
          />
          {textRecipient && !validatePhoneNumber(textRecipient) && (
            <p className="text-sm text-destructive">Enter a valid 10-digit phone number to text this receipt.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
          {canTextReceipt ? (
            <Button asChild>
              <a href={smsHref}>Text Receipt</a>
            </Button>
          ) : (
            <Button disabled>Text Receipt</Button>
          )}
          <Button disabled={!canRefund} onClick={() => setRefundDialogOpen(true)}>Refund</Button>
        </div>
      </Card>

      <Dialog open={refundDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Refund will be returned via the original payment method.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground font-medium">Refund method</span>
              <span className="font-semibold">{formatMethodLabel(payment?.payment_method)}</span>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={refundType} onValueChange={(v: "full" | "partial") => setRefundType(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full refund (${amountDollars})</SelectItem>
                  <SelectItem value="partial">Partial refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {refundType === "partial" && (
              <div>
                <Label>Amount ($)</Label>
                <Input
                  className="mt-1"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </div>
            )}
            <div>
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Select value={refundReasonCode} onValueChange={(v) => setRefundReasonCode(v as RefundReasonValue)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {REFUND_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Internal note (optional)</Label>
              <Textarea
                className="mt-1"
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                placeholder="Additional context for your records…"
                rows={2}
              />
            </div>
            <Button
              className="w-full"
              disabled={refunding || !refundReasonCode}
              onClick={processRefund}
            >
              {refunding ? "Processing…" : "Process Refund"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
