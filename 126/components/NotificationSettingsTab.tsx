import { useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// ── Types ────────────────────────────────────────────────────────────────────

interface NotificationPreferences {
  appointment_reminders: boolean
  appointment_confirmations: boolean
  cancellation_alerts: boolean
  new_booking_alerts: boolean
  daily_summary: boolean
  payment_received: boolean
  refund_processed: boolean
  low_inventory_alerts: boolean
  staff_schedule_changes: boolean
  new_client_registered: boolean
}

const STORAGE_KEY = "spark.notification_preferences"

const DEFAULT_PREFS: NotificationPreferences = {
  appointment_reminders: true,
  appointment_confirmations: true,
  cancellation_alerts: true,
  new_booking_alerts: true,
  daily_summary: false,
  payment_received: true,
  refund_processed: true,
  low_inventory_alerts: true,
  staff_schedule_changes: true,
  new_client_registered: false,
}

function loadPrefs(): NotificationPreferences {
  try {
    if (typeof window === "undefined") return DEFAULT_PREFS
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFS
  }
}

function savePrefs(prefs: NotificationPreferences) {
  try {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function NotificationSettingsTab() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(loadPrefs)

  const toggle = useCallback(
    (key: keyof NotificationPreferences) => {
      setPrefs((prev) => {
        const updated = { ...prev, [key]: !prev[key] }
        savePrefs(updated)
        toast.success("Notification preference saved")
        return updated
      })
    },
    []
  )

  return (
    <div className="space-y-6">
      {/* Appointments */}
      <Card className="p-4 md:p-6 bg-card border-border">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Appointment Notifications</h2>
            <p className="text-sm text-muted-foreground">
              Manage how you receive appointment-related notifications.
            </p>
          </div>

          <div className="space-y-3">
            <NotifRow
              label="Appointment Reminders"
              description="Send reminders to clients before their appointments"
              checked={prefs.appointment_reminders}
              onToggle={() => toggle("appointment_reminders")}
            />
            <NotifRow
              label="Booking Confirmations"
              description="Send confirmation when an appointment is booked"
              checked={prefs.appointment_confirmations}
              onToggle={() => toggle("appointment_confirmations")}
            />
            <NotifRow
              label="Cancellation Alerts"
              description="Get notified when an appointment is cancelled"
              checked={prefs.cancellation_alerts}
              onToggle={() => toggle("cancellation_alerts")}
            />
            <NotifRow
              label="New Booking Alerts"
              description="Get notified when a new appointment is created"
              checked={prefs.new_booking_alerts}
              onToggle={() => toggle("new_booking_alerts")}
            />
          </div>
        </div>
      </Card>

      {/* Payments */}
      <Card className="p-4 md:p-6 bg-card border-border">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Payment Notifications</h2>
            <p className="text-sm text-muted-foreground">
              Control notifications related to payments and transactions.
            </p>
          </div>

          <div className="space-y-3">
            <NotifRow
              label="Payment Received"
              description="Get notified when a payment is completed"
              checked={prefs.payment_received}
              onToggle={() => toggle("payment_received")}
            />
            <NotifRow
              label="Refund Processed"
              description="Get notified when a refund is issued"
              checked={prefs.refund_processed}
              onToggle={() => toggle("refund_processed")}
            />
          </div>
        </div>
      </Card>

      {/* Business Operations */}
      <Card className="p-4 md:p-6 bg-card border-border">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Business Notifications</h2>
            <p className="text-sm text-muted-foreground">
              Stay informed about your business operations.
            </p>
          </div>

          <div className="space-y-3">
            <NotifRow
              label="Daily Summary"
              description="Receive a daily overview of appointments and revenue"
              checked={prefs.daily_summary}
              onToggle={() => toggle("daily_summary")}
            />
            <NotifRow
              label="Low Inventory Alerts"
              description="Get notified when product inventory runs low"
              checked={prefs.low_inventory_alerts}
              onToggle={() => toggle("low_inventory_alerts")}
            />
            <NotifRow
              label="Staff Schedule Changes"
              description="Get notified when staff schedules are modified"
              checked={prefs.staff_schedule_changes}
              onToggle={() => toggle("staff_schedule_changes")}
            />
            <NotifRow
              label="New Client Registered"
              description="Get notified when a new client is added"
              checked={prefs.new_client_registered}
              onToggle={() => toggle("new_client_registered")}
            />
          </div>
        </div>
      </Card>

    </div>
  )
}

// ── Row ──────────────────────────────────────────────────────────────────────

function NotifRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string
  description: string
  checked: boolean
  onToggle: () => void
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-")

  return (
    <>
      <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
        <div className="space-y-0.5 pr-4">
          <Label htmlFor={id} className="font-medium text-sm cursor-pointer">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onToggle} />
      </div>
    </>
  )
}
