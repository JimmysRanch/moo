import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Appointment, getWeightCategoryLabel } from "@/lib/types"
import { useUpdateAppointment, useAppointmentServices, type Appointment as DbAppointment } from '@/hooks/data/useAppointments'
import { useServices } from '@/hooks/data/useServices'
import { useAppointmentCheckoutMap } from '@/hooks/useAppointmentCheckout'
import { toast } from "sonner"
import { format } from "date-fns"
import { PawPrint, User, Clock, CurrencyDollar, PencilSimple, Bell, ChatCircleText, X, Warning } from "@phosphor-icons/react"
import { useNavigate } from "react-router-dom"
import { formatTimeLabel } from "@/lib/business-hours"
import { formatGroomerName } from '@/lib/utils'
import { useMemo } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  type AppointmentStatus,
  isValidTransition,
  timestampFieldForStep,
  formatShortTime,
  STATUS_LABELS,
  TERMINAL_STATUSES,
} from '@/lib/appointmentStatus'
import { AppointmentStatusStepper } from './AppointmentStatusStepper'
import { AppointmentStatusBadge } from './AppointmentStatusBadge'
import { TimeInShopDisplay } from './TimeInShopDisplay'

interface AppointmentDetailsDialogProps {
  appointment: Appointment
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AppointmentDetailsDialog({ appointment, open, onOpenChange }: AppointmentDetailsDialogProps) {
  const updateAppointment = useUpdateAppointment()
  const navigate = useNavigate()
  const { data: dbServices } = useAppointmentServices(appointment.id)
  const { data: serviceCatalog } = useServices()
  const checkoutByAppointmentId = useAppointmentCheckoutMap()
  const checkout = checkoutByAppointmentId.get(appointment.id)

  const [lateConfirmPending, setLateConfirmPending] = useState(false)

  const serviceNameById = useMemo(
    () => new Map((serviceCatalog ?? []).map((service) => [service.id, service.name])),
    [serviceCatalog]
  )

  // Group services: use live DB services if available, fallback to appointment.services
  const allServices = dbServices && dbServices.length > 0
    ? dbServices.map((s) => {
      const serviceId = s.service_id ?? s.id
      const resolvedServiceName = s.service_name?.trim() || (s.service_id ? serviceNameById.get(s.service_id) : undefined) || 'Scheduled service'
      return {
        serviceId,
        serviceName: resolvedServiceName,
        price: s.price,
        type: s.service_type === 'addon' ? 'addon' : 'main',
      }
    })
    : appointment.services
  const servicesToDisplay = allServices

  const isMutating = updateAppointment.isPending

  /** Core status update – sets status + the matching workflow timestamp. */
  const applyStatusChange = (
    newStatus: AppointmentStatus,
    extra?: Partial<Pick<DbAppointment,
      'is_late' | 'checked_in_at' | 'in_progress_at' | 'ready_at' | 'picked_up_at' |
      'client_notified_at' | 'notification_type'>>
  ) => {
    const now = new Date().toISOString()
    const workflowSteps = ['checked_in', 'in_progress', 'ready', 'picked_up'] as const
    type WorkflowStep = typeof workflowSteps[number]
    const isWorkflowStep = (s: AppointmentStatus): s is WorkflowStep =>
      (workflowSteps as readonly string[]).includes(s)
    const timestampUpdate = isWorkflowStep(newStatus)
      ? { [timestampFieldForStep(newStatus)]: now }
      : {}

    updateAppointment.mutate(
      {
        id: appointment.id,
        updated_at: appointment.updatedAt,
        status: newStatus,
        ...timestampUpdate,
        ...extra,
      },
      {
        onSuccess: () => {
          // Always show the label for the status the user requested, not the
          // compat-mapped value that may have been stored in the DB. The cache
          // has already been updated to the intended status by useUpdateAppointment.
          toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`)
        },
        onError: (error) => {
          if (error.name === 'ConcurrencyError') {
            toast.error('This appointment was recently updated. Please close and reopen to see the latest changes.')
          } else {
            toast.error('Failed to update appointment status. Please try again.')
          }
        },
      }
    )
  }

  /** Handle advancing through the main workflow stepper. */
  const handleAdvance = (next: AppointmentStatus) => {
    if (!isValidTransition(appointment.status as AppointmentStatus, next)) return

    if (next === 'picked_up') {
      onOpenChange(false)
      navigate('/pos', { state: { checkoutAppointmentId: appointment.id } })
      return
    }

    if (next === 'checked_in') {
      const scheduledDateTime = new Date(`${appointment.date}T${appointment.startTime}`)
      const isLate = new Date() > scheduledDateTime
      if (isLate) {
        setLateConfirmPending(true)
        return // open modal, handled in confirmCheckin
      }
      applyStatusChange('checked_in', { is_late: false })
      return
    }

    applyStatusChange(next)
  }

  /** Confirm check-in from the late-confirm dialog. */
  const confirmCheckin = (markLate: boolean) => {
    setLateConfirmPending(false)
    applyStatusChange('checked_in', { is_late: markLate })
  }

  const notifyNotificationType = appointment.status === 'ready' ? 'ready_pickup' : 'manual_heads_up'

  /** Notify Client – route through the Messages workspace while preserving appointment state. */
  const handleNotifyClient = () => {
    onOpenChange(false)
    navigate(`/messages?clientId=${appointment.clientId}&appointmentId=${appointment.id}&notificationType=${notifyNotificationType}`)
  }

  const canNotify =
    ['checked_in', 'in_progress'].includes(appointment.status)
      ? appointment.notificationType !== 'manual_heads_up'
      : appointment.status === 'ready'
        ? appointment.notificationType !== 'ready_pickup'
        : false

  const isTerminal = TERMINAL_STATUSES.includes(appointment.status as AppointmentStatus)
  const canCancel = !isTerminal
  const canNoShow = ['scheduled', 'checked_in'].includes(appointment.status) && !isTerminal

  const openClientProfile = () => {
    onOpenChange(false)
    navigate(`/clients/${appointment.clientId}`)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <PawPrint size={24} className="text-primary" />
              Appointment Details
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">

              {/* Header: Pet name + status */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-2xl font-bold">
                    <PawPrint size={24} weight="fill" className="text-primary shrink-0" />
                    <Button
                      type="button"
                      variant="link"
                      aria-label={`View client profile for ${appointment.petName}'s owner`}
                      className="h-auto justify-start p-0 text-2xl font-bold text-foreground no-underline hover:text-primary hover:no-underline"
                      onClick={openClientProfile}
                    >
                      {appointment.petName}
                    </Button>
                  </h3>
                  <Button
                    type="button"
                    variant="link"
                    aria-label={`View client profile for ${appointment.clientName}`}
                    className="h-auto justify-start p-0 text-muted-foreground no-underline hover:text-primary hover:no-underline"
                    onClick={openClientProfile}
                  >
                    {appointment.clientName}
                  </Button>
                </div>
                <AppointmentStatusBadge
                  status={appointment.status as AppointmentStatus}
                  isLate={appointment.isLate}
                />
              </div>

              <Separator />

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Date & Time</div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span className="font-medium">
                      {format(new Date(appointment.date + 'T00:00:00'), 'MMM d, yyyy')} at {formatTimeLabel(appointment.startTime)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Groomer</div>
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    <span className="font-medium">{formatGroomerName(appointment.groomerName)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Pet Weight</div>
                  <div className="font-medium">{appointment.petWeight} lbs ({getWeightCategoryLabel(appointment.petWeightCategory)})</div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">{checkout ? 'Final Price' : 'Total Price'}</div>
                  {checkout ? (
                    <div className="space-y-0.5">
                      {checkout.discount > 0 && (
                        <>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CurrencyDollar size={14} />
                            <span>Subtotal: ${checkout.subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-primary">
                            <span className="ml-5">Discount: -${checkout.discount.toFixed(2)}</span>
                            {checkout.discountDescription && (
                              <span className="text-xs text-muted-foreground">({checkout.discountDescription})</span>
                            )}
                          </div>
                          {checkout.additionalFees > 0 && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="ml-5">Fees: +${checkout.additionalFees.toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex items-center gap-2">
                        <CurrencyDollar size={16} />
                        <span className="font-bold text-primary text-xl">${checkout.totalBeforeTip.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CurrencyDollar size={16} />
                      <span className="font-bold text-primary text-xl">${appointment.totalPrice.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Workflow stepper */}
              <div>
                <h4 className="font-semibold mb-3">Appointment Progress</h4>
                <AppointmentStatusStepper
                  status={appointment.status as AppointmentStatus}
                  isLate={appointment.isLate}
                  onAdvance={handleAdvance}
                  disabled={isMutating}
                  labelOverrides={{ picked_up: 'Check Out' }}
                />

                {/* Time in shop — shown under the stepper for active appointments.
                    Falls back to the scheduled start time when checkedInAt is null
                    (pre-migration 036 where the checked_in_at column doesn't exist
                    yet), so the timer still displays something useful. */}
                {['checked_in', 'in_progress', 'ready', 'picked_up'].includes(appointment.status) && (
                  <div className="mt-3">
                    <TimeInShopDisplay
                      checkedInAt={appointment.checkedInAt}
                      inProgressAt={appointment.inProgressAt}
                      readyAt={appointment.readyAt}
                      pickedUpAt={appointment.pickedUpAt}
                      fallbackStartTime={
                        appointment.checkedInAt
                          ? null
                          : `${appointment.date}T${appointment.startTime}`
                      }
                    />
                  </div>
                )}
              </div>

              {/* Notification status */}
              {appointment.clientNotifiedAt && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-md p-2">
                  <Bell size={14} className="text-primary" />
                  <span>
                    Client notified at {formatShortTime(appointment.clientNotifiedAt)}
                    {appointment.notificationType === 'ready_pickup' ? ' (ready for pickup)' : ' (manual heads-up)'}
                  </span>
                </div>
              )}

              {/* Exception actions */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    navigate(`/messages?clientId=${appointment.clientId}&appointmentId=${appointment.id}`)
                  }}
                >
                  <ChatCircleText size={16} className="mr-1" />
                  Message Client
                </Button>
                {canNotify && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isMutating}
                    onClick={handleNotifyClient}
                    className="flex-1 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Bell size={14} className="mr-1" />
                    Notify Client
                  </Button>
                )}
                {canNoShow && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        className="flex-1 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                      >
                        <Warning size={14} className="mr-1" />
                        No Show
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Mark No Show?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to mark this appointment as a no show?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>No, Keep It</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => applyStatusChange('no_show')}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Yes, Mark No Show
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {canCancel && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <X size={14} className="mr-1" />
                        Cancel Appt
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to cancel this appointment?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>No, Keep It</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => applyStatusChange('cancelled')}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Yes, Cancel Appointment
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              <Separator />

              {/* Services */}
              <div>
                <h4 className="font-semibold mb-3">Services</h4>
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  {servicesToDisplay.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No services scheduled</div>
                  ) : (
                    servicesToDisplay.map((service, idx) => (
                      <div
                        key={service.serviceId || idx}
                        className={`flex items-center justify-between ${service.type === 'addon' ? 'pl-4 text-sm text-muted-foreground' : ''}`}
                      >
                        <div className={service.type === 'addon' ? 'flex items-center gap-1' : 'font-medium'}>
                          {service.type === 'addon' && <span>+</span>}
                          <span>{service.serviceName}</span>
                        </div>
                        <div className={service.type === 'addon' ? 'font-medium' : 'font-semibold'}>
                          ${service.price.toFixed(2)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {appointment.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                  </div>
                </>
              )}

              <Separator />

              {/* Edit action */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false)
                    navigate(`/appointments/${appointment.id}/edit`)
                  }}
                  className="flex-1"
                >
                  <PencilSimple className="mr-2" />
                  Edit
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Late confirmation dialog */}
      {lateConfirmPending && (
        <Dialog open onOpenChange={() => setLateConfirmPending(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock size={20} className="text-amber-400" />
                Late Check-In
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This check-in is after the scheduled appointment time. Mark this client as late?
            </p>
            <p className="text-xs text-muted-foreground">
              (Sometimes the client arrived on time but the button was pressed later.)
            </p>
            <div className="flex gap-2 mt-2">
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => confirmCheckin(true)}
              >
                Yes, mark late
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => confirmCheckin(false)}
              >
                No, don't mark late
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
