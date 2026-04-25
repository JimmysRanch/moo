import { useMemo } from "react"
import { ArrowLeft, CalendarBlank, CreditCard, PawPrint, Receipt, User } from "@phosphor-icons/react"
import { useNavigate, useParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageLoadingState } from "@/components/PageLoadingState"
import { Separator } from "@/components/ui/separator"
import { useClient, usePets } from "@/hooks/data/useClients"
import { useAppointmentServicesByAppointmentIds, useAppointments } from "@/hooks/data/useAppointments"
import { getPaymentIntentAppointmentId, paymentIntentMatchesClient, usePaymentIntents, useRefunds } from "@/hooks/data/usePayments"
import { useStaff } from "@/hooks/data/useStaff"
import { appointmentFromDb } from "@/lib/mappers/appointmentMapper"
import { clientFromDb } from "@/lib/mappers/clientMapper"
import { formatInBusinessTimezone } from "@/lib/date-utils"
import { formatGroomerName } from "@/lib/utils"

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`
}

function formatPaymentMethod(value: string | undefined) {
  if (!value) return "Unknown"
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getPaymentStatusVariant(status: string) {
  if (status === "succeeded") return "default" as const
  if (status === "processing") return "secondary" as const
  return "outline" as const
}

export function PaymentHistory() {
  const navigate = useNavigate()
  const { clientId } = useParams()
  const { data: dbClient, isPending: isClientLoading } = useClient(clientId)
  const { data: dbPets } = usePets(clientId)
  const { data: dbAppointments } = useAppointments()
  const { data: dbAppointmentServices } = useAppointmentServicesByAppointmentIds((dbAppointments ?? []).map((appointment) => appointment.id))
  const { data: dbStaff } = useStaff()
  const { data: paymentIntents } = usePaymentIntents()

  const client = useMemo(
    () => (dbClient ? clientFromDb(dbClient, dbPets ?? []) : undefined),
    [dbClient, dbPets],
  )

  const clientAppointmentIds = useMemo(
    () => new Set((dbAppointments ?? []).filter((appointment) => appointment.client_id === clientId).map((appointment) => appointment.id)),
    [dbAppointments, clientId],
  )

  const clientPayments = useMemo(
    () => (paymentIntents ?? []).filter((payment) => paymentIntentMatchesClient(payment, clientId, clientAppointmentIds)),
    [paymentIntents, clientAppointmentIds, clientId],
  )

  const { data: refunds } = useRefunds(clientPayments.map((payment) => payment.stripe_payment_intent_id))

  const appointmentMap = useMemo(() => {
    const petsById = new Map((dbPets ?? []).map((pet) => [pet.id, pet]))
    const staffById = new Map((dbStaff ?? []).map((staff) => [staff.id, staff]))
    const servicesByAppointment = new Map<string, typeof dbAppointmentServices>()

    for (const service of dbAppointmentServices ?? []) {
      const existing = servicesByAppointment.get(service.appointment_id) ?? []
      existing.push(service)
      servicesByAppointment.set(service.appointment_id, existing)
    }

    return new Map(
      (dbAppointments ?? [])
        .filter((appointment) => appointment.client_id === clientId)
        .map((appointment) => {
          const pet = appointment.pet_id ? petsById.get(appointment.pet_id) : undefined
          const staff = appointment.groomer_id ? staffById.get(appointment.groomer_id) : undefined
          return [
            appointment.id,
            appointmentFromDb(
              appointment,
              servicesByAppointment.get(appointment.id),
              client?.name ?? '',
              pet?.name ?? '',
              pet?.breed ?? undefined,
              pet?.weight ?? undefined,
              pet?.weight_category ?? undefined,
              staff ? `${staff.first_name} ${staff.last_name}`.trim() : '',
            ),
          ]
        }),
    )
  }, [client?.name, clientId, dbAppointmentServices, dbAppointments, dbPets, dbStaff])

  const refundsByPaymentIntent = useMemo(() => {
    const map = new Map<string, typeof refunds>()
    for (const refund of refunds ?? []) {
      if (!refund.stripe_payment_intent_id) continue
      const existing = map.get(refund.stripe_payment_intent_id) ?? []
      existing.push(refund)
      map.set(refund.stripe_payment_intent_id, existing)
    }
    return map
  }, [refunds])

  const paymentCards = useMemo(
    () =>
      clientPayments.map((payment) => {
        const appointmentId = getPaymentIntentAppointmentId(payment)
        const appointment = appointmentId ? appointmentMap.get(appointmentId) : undefined
        const metadataItems =
          payment.metadata.items?.filter((item) => Boolean(item.name)).map((item) => ({
            name: item.name ?? 'Line item',
            total: item.total ?? (item.price ?? 0) * (item.quantity ?? 1),
            type: item.type ?? 'other',
          })) ?? []
        const appointmentServices =
          appointment?.services.map((service) => ({
            name: service.serviceName,
            total: service.price,
            type: service.type,
          })) ?? []
        const lineItems = metadataItems.length > 0 ? metadataItems : appointmentServices
        const paymentRefunds = refundsByPaymentIntent.get(payment.stripe_payment_intent_id) ?? []
        const totalRefunded = paymentRefunds.reduce((sum, refund) => sum + refund.amount, 0) / 100
        const discount = payment.metadata.discount ?? 0
        const discountDescription = payment.metadata.discountDescription
        const preDiscountSubtotal = payment.metadata.subtotal ?? appointment?.totalPrice ?? payment.amount / 100
        const subtotal = preDiscountSubtotal - discount
        const tipAmount = payment.metadata.tipAmount ?? appointment?.tipAmount ?? 0
        const totalAmount = payment.metadata.total ?? payment.amount / 100

        return {
          id: payment.stripe_payment_intent_id,
          createdAt: payment.created_at,
          status: payment.status,
          method: payment.metadata.paymentMethod ?? payment.payment_method,
          subtotal,
          discount,
          discountDescription,
          tipAmount,
          totalAmount,
          appointment,
          lineItems,
          petName: appointment?.petName ?? '',
          groomerName: appointment?.groomerName ?? '',
          refunds: paymentRefunds,
          totalRefunded,
        }
      }),
    [appointmentMap, clientPayments, refundsByPaymentIntent],
  )

  const summary = useMemo(() => {
    const completedPayments = paymentCards.filter((payment) => payment.status === 'succeeded')
    const totalPaid = completedPayments.reduce((sum, payment) => sum + payment.totalAmount, 0)
    const averageTicket = completedPayments.length > 0 ? totalPaid / completedPayments.length : 0
    const totalTips = completedPayments.reduce((sum, payment) => sum + payment.tipAmount, 0)
    const lastPayment = paymentCards[0]?.createdAt

    return {
      totalPaid,
      averageTicket,
      totalTips,
      lastPayment: lastPayment ? formatInBusinessTimezone(lastPayment, 'M/d/yyyy') : '—',
    }
  }, [paymentCards])

  if (isClientLoading) {
    return <PageLoadingState label="Loading payment history…" />
  }

  if (!client) {
    return (
      <div className="min-h-full bg-background text-foreground p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <Button variant="ghost" onClick={() => navigate('/clients')}>
            <ArrowLeft size={18} className="mr-2" />
            Back to Clients
          </Button>
          <Card className="p-6">
            <h1 className="text-2xl font-bold">Client Not Found</h1>
            <p className="text-muted-foreground mt-2">We couldn&apos;t load payment history for this client.</p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background text-foreground p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" className="-ml-2 mb-2" onClick={() => navigate(`/clients/${client.id}`)}>
              <ArrowLeft size={18} className="mr-2" />
              Back to Client Profile
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Receipt size={28} className="text-primary" />
              Payment History
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{client.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total Paid</div>
            <div className="text-2xl font-bold mt-1">{formatMoney(summary.totalPaid)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Average Ticket</div>
            <div className="text-2xl font-bold mt-1">{formatMoney(summary.averageTicket)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total Tips</div>
            <div className="text-2xl font-bold mt-1">{formatMoney(summary.totalTips)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Last Payment</div>
            <div className="text-2xl font-bold mt-1">{summary.lastPayment}</div>
          </Card>
        </div>

        {paymentCards.length === 0 ? (
          <Card className="p-8 text-center">
            <Receipt size={36} className="mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-xl font-semibold">No payment history yet</h2>
            <p className="text-muted-foreground mt-2">
              Payments for {client.name} will appear here once they&apos;re checked out in POS.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {paymentCards.map((payment) => (
              <Card key={payment.id} className="p-4 sm:p-5 space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getPaymentStatusVariant(payment.status)}>
                        {payment.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatInBusinessTimezone(payment.createdAt, 'M/d/yyyy h:mm a')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <CreditCard size={14} />
                        {formatPaymentMethod(payment.method)}
                      </span>
                      {payment.appointment && (
                        <span className="flex items-center gap-1.5">
                          <CalendarBlank size={14} />
                          {formatInBusinessTimezone(payment.appointment.date, 'M/d/yyyy')} at {payment.appointment.startTime}
                        </span>
                      )}
                      {payment.petName && (
                        <span className="flex items-center gap-1.5">
                          <PawPrint size={14} weight="fill" />
                          {payment.petName}
                        </span>
                      )}
                      {payment.groomerName && (
                        <span className="flex items-center gap-1.5">
                          <User size={14} />
                          {formatGroomerName(payment.groomerName)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/receipts/${payment.id}`)}>
                      View Receipt
                    </Button>
                    {payment.appointment && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(`/appointments?clientId=${client.id}&view=list&appointmentId=${payment.appointment?.id}`)
                        }
                      >
                        View Appointment
                      </Button>
                    )}
                  </div>
                </div>

                {payment.lineItems.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Services & Items</div>
                      <div className="grid gap-2">
                        {payment.lineItems.map((item, index) => (
                          <div key={`${payment.id}-${item.name}-${index}`} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{item.name}</span>
                            <span className="font-medium">{formatMoney(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatMoney(payment.subtotal)}</span>
                  </div>
                  {payment.discount > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        Discount{payment.discountDescription ? ` (${payment.discountDescription})` : ''}
                      </span>
                      <span className="font-medium text-green-600">-{formatMoney(payment.discount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Tip</span>
                    <span className="font-medium">{formatMoney(payment.tipAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Refunded</span>
                    <span className="font-medium">{formatMoney(payment.totalRefunded)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-primary">{formatMoney(payment.totalAmount)}</span>
                  </div>
                </div>

                {payment.refunds.length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <div className="text-sm font-semibold">Refund Activity</div>
                    {payment.refunds.map((refund) => (
                      <div key={refund.stripe_refund_id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">
                          {formatInBusinessTimezone(refund.created_at, 'M/d/yyyy h:mm a')} • {refund.status}
                        </span>
                        <span className="font-medium">{formatMoney(refund.amount / 100)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
