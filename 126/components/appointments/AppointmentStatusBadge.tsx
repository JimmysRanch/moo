import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  type AppointmentStatus,
  STATUS_LABELS,
  STATUS_BADGE_CLASSES,
  LATE_BADGE_CLASSES,
} from '@/lib/appointmentStatus'

interface AppointmentStatusBadgeProps {
  status: AppointmentStatus
  isLate?: boolean
  className?: string
}

/**
 * Displays the canonical appointment status as a styled badge.
 * Optionally shows a "Late" badge alongside it.
 */
export function AppointmentStatusBadge({
  status,
  isLate,
  className,
}: AppointmentStatusBadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Badge className={cn('rounded-full text-xs font-medium', STATUS_BADGE_CLASSES[status])}>
        {STATUS_LABELS[status]}
      </Badge>
      {isLate && (
        <Badge className={cn('rounded-full text-xs font-medium', LATE_BADGE_CLASSES)}>
          Late
        </Badge>
      )}
    </span>
  )
}
