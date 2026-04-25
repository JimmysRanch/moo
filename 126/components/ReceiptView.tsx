import { useMemo } from "react"
import { useBusinessSettings } from "@/hooks/data/useBusinessSettings"
import { businessSettingsFromDb, type BusinessInfo } from "@/lib/mappers/businessSettingsMapper"
import { Separator } from "@/components/ui/separator"
import { Appointment, Transaction } from "@/lib/types"
import { formatInBusinessTimezone } from "@/lib/date-utils"
import { formatGroomerName } from "@/lib/utils"

interface PaymentLine {
  method: string
  amount: number
  cardLast4?: string
  cashTendered?: number
  change?: number
}

interface ReceiptLineItem {
  label: string
  amount: number
  isAddon?: boolean
}

interface ReceiptViewProps {
  transaction: Transaction
  appointment?: Appointment
  payments?: PaymentLine[]
  taxAmount?: number
  petName?: string
  staffName?: string
}

const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  companyName: "Scruffy Butts",
  businessPhone: "",
  businessEmail: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  timezone: "America/New_York",
  website: ""
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)

const formatMethodLabel = (method?: string) => {
  if (!method) return "Payment"
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(method)) return "Card"
  return method
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function ReceiptView({ transaction, appointment, payments, taxAmount = 0, petName, staffName }: ReceiptViewProps) {
  const { data: dbSettings } = useBusinessSettings()
  const businessInfo = useMemo<BusinessInfo>(() => dbSettings ? businessSettingsFromDb(dbSettings) : DEFAULT_BUSINESS_INFO, [dbSettings])

  const contactLine = useMemo(() => {
    const parts = [businessInfo.address, businessInfo.city, businessInfo.state, businessInfo.zipCode]
      .filter(Boolean)
      .join(", ")
    return parts
  }, [businessInfo.address, businessInfo.city, businessInfo.state, businessInfo.zipCode])

  const receiptDate = useMemo(() => {
    try {
      return formatInBusinessTimezone(transaction.date, "MMM d, yyyy h:mm a")
    } catch {
      return transaction.date
    }
  }, [transaction.date])

  const serviceLines: ReceiptLineItem[] = []
  let hasServices = false

  if (appointment?.services?.length) {
    appointment.services.forEach((service) => {
      if (service.type === "main") {
        hasServices = true
        serviceLines.push({
          label: `${service.serviceName}${appointment.petName ? ` (${appointment.petName})` : ""}`,
          amount: service.price
        })
        return
      }

      serviceLines.push({
        label: service.serviceName,
        amount: service.price,
        isAddon: true
      })
    })
  } else {
    const fallbackServices = transaction.items.filter((item) => item.type === "service")
    fallbackServices.forEach((item) => {
      hasServices = true
      serviceLines.push({ label: item.name, amount: item.total })
    })
  }

  const retailLines: ReceiptLineItem[] = transaction.items
    .filter((item) => item.type === "product")
    .map((item) => ({
      label: `${item.name}${item.quantity > 1 ? ` x ${item.quantity}` : ""}`,
      amount: item.total
    }))

  const adjustmentLines: ReceiptLineItem[] = []

  if (transaction.discount > 0) {
    adjustmentLines.push({
      label: `Discount${transaction.discountDescription ? ` (${transaction.discountDescription})` : ""}`,
      amount: -transaction.discount
    })
  }

  if (transaction.additionalFees > 0) {
    adjustmentLines.push({
      label: `Additional Fees${transaction.additionalFeesDescription ? ` (${transaction.additionalFeesDescription})` : ""}`,
      amount: transaction.additionalFees
    })
  }

  const fallbackPayments = useMemo(() => {
    if (payments?.length) return payments

    const tipAmount = transaction.tipAmount || 0
    const primaryMethod = formatMethodLabel(transaction.paymentMethod)
    const tipMethod = transaction.tipPaymentMethod
      ? formatMethodLabel(transaction.tipPaymentMethod)
      : undefined

    if (tipAmount > 0 && tipMethod && tipMethod !== primaryMethod) {
      return [
        { method: primaryMethod, amount: transaction.total - tipAmount },
        { method: `${tipMethod} (Tip)`, amount: tipAmount }
      ]
    }

    return [{ method: primaryMethod, amount: transaction.total }]
  }, [payments, transaction.paymentMethod, transaction.tipAmount, transaction.tipPaymentMethod, transaction.total])

  const netSubtotal = transaction.subtotal - transaction.discount + transaction.additionalFees

  return (
    <div className="w-full max-w-[380px] mx-auto text-[11px] text-foreground font-mono">
      <div className="text-center space-y-1">
        <div className="text-lg font-bold tracking-wide">
          {businessInfo.companyName || DEFAULT_BUSINESS_INFO.companyName}
        </div>
        {contactLine && (
          <div className="text-[10px] text-muted-foreground">{contactLine}</div>
        )}
        {(businessInfo.businessPhone || businessInfo.website) && (
          <div className="text-[10px] text-muted-foreground">
            {businessInfo.businessPhone && businessInfo.website 
              ? `${businessInfo.businessPhone} • ${businessInfo.website}`
              : businessInfo.businessPhone || businessInfo.website}
          </div>
        )}
      </div>

      <Separator className="my-3" />

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Date & Time</span>
          <span className="font-semibold">{receiptDate}</span>
        </div>
      </div>

      <Separator className="my-3" />

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Customer</span>
          <span className="font-semibold">{transaction.clientName || "Walk-in"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pet</span>
          <span className="font-semibold">{petName || appointment?.petName || "Walk-in"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Staff</span>
          <span className="font-semibold">
            {staffName
              ? formatGroomerName(staffName)
              : (appointment?.groomerName ? formatGroomerName(appointment.groomerName) : "-")}
          </span>
        </div>
      </div>

      <Separator className="my-3" />

      <div className="space-y-2">
        {hasServices && (
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Services</div>
        )}
        {serviceLines.map((item, index) => (
          <div key={`service-${index}`} className="flex justify-between gap-3">
            <span className={item.isAddon ? "pl-3 text-muted-foreground" : ""}>
              {item.isAddon ? `+ ${item.label}` : item.label}
            </span>
            <span className="font-semibold">{formatCurrency(item.amount)}</span>
          </div>
        ))}
        {retailLines.length > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">Retail</div>
            {retailLines.map((item, index) => (
              <div key={`retail-${index}`} className="flex justify-between gap-3">
                <span>{item.label}</span>
                <span className="font-semibold">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </>
        )}
        {adjustmentLines.map((item, index) => (
          <div key={`adjustment-${index}`} className="flex justify-between gap-3">
            <span>{item.label}</span>
            <span className="font-semibold">{formatCurrency(item.amount)}</span>
          </div>
        ))}
      </div>

      <Separator className="my-3" />

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold">{formatCurrency(netSubtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax</span>
          <span className="font-semibold">{formatCurrency(taxAmount)}</span>
        </div>
        {transaction.tipAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tip</span>
            <span className="font-semibold">{formatCurrency(transaction.tipAmount)}</span>
          </div>
        )}
        <Separator className="my-2" />
        <div className="flex justify-between text-sm font-bold">
          <span>Grand Total</span>
          <span className="text-primary">{formatCurrency(transaction.total)}</span>
        </div>
      </div>

      <Separator className="my-3" />

      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Payment Method</div>
        {fallbackPayments.map((payment, index) => (
          <div key={`payment-${index}`} className="space-y-1">
            <div className="flex justify-between">
              <span>{formatMethodLabel(payment.method)}</span>
              <span className="font-semibold">{formatCurrency(payment.amount)}</span>
            </div>
            {payment.cardLast4 && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Card •••• {payment.cardLast4}</span>
                <span></span>
              </div>
            )}
            {typeof payment.cashTendered === "number" && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Cash Tendered</span>
                <span>{formatCurrency(payment.cashTendered)}</span>
              </div>
            )}
            {typeof payment.change === "number" && (
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Change</span>
                <span>{formatCurrency(payment.change)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <Separator className="my-3" />

      <div className="text-center text-[10px] text-muted-foreground">
        Thanks for trusting Scruffy Butts — see you next time!
      </div>
    </div>
  )
}
