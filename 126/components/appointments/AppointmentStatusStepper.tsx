import { cn } from '@/lib/utils'
import { Check } from '@phosphor-icons/react'
import {
  type AppointmentStatus,
  WORKFLOW_STEPS,
  STATUS_LABELS,
  STEP_COLORS,
  workflowStepIndex,
  isValidTransition,
} from '@/lib/appointmentStatus'

interface AppointmentStatusStepperProps {
  status: AppointmentStatus
  isLate?: boolean
  /** Called when the user clicks a step to advance. Only valid transitions fire. */
  onAdvance?: (next: AppointmentStatus) => void
  disabled?: boolean
  labelOverrides?: Partial<Record<typeof WORKFLOW_STEPS[number], string>>
  className?: string
}

/**
 * Compact horizontal 4-step stepper:
 *   Checked In → In Progress → Ready → Picked Up
 *
 * - Completed prior steps are shown with a check mark and muted color
 * - Current step is highlighted
 * - Future steps are muted
 * - Clicking a future step that is the next valid transition calls onAdvance
 * - Clicking an already-completed step is a no-op
 */
export function AppointmentStatusStepper({
  status,
  isLate,
  onAdvance,
  disabled,
  labelOverrides,
  className,
}: AppointmentStatusStepperProps) {
  const currentIdx = workflowStepIndex(status)
  // -1 means status is outside the main workflow (scheduled / cancelled / no_show)
  const isInWorkflow = currentIdx >= 0

  return (
    <div className={cn('flex items-center gap-0', className)}>
      {WORKFLOW_STEPS.map((step, idx) => {
        const stepLabel = labelOverrides?.[step] ?? STATUS_LABELS[step]
        const isCompleted = isInWorkflow && idx < currentIdx
        const isCurrent   = isInWorkflow && idx === currentIdx
        const isFuture    = !isInWorkflow || idx > currentIdx

        const isClickable =
          !disabled &&
          !!onAdvance &&
          isFuture &&
          isValidTransition(status, step)

        const dotColor = isCompleted || isCurrent
          ? STEP_COLORS[step]
          : 'bg-muted-foreground/30'

        const labelColor = isCurrent
          ? 'text-foreground font-semibold'
          : isCompleted
            ? 'text-muted-foreground'
            : 'text-muted-foreground/50'

        return (
          <div key={step} className="flex items-center">
            {/* Step node */}
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onAdvance?.(step)}
              title={isClickable ? `Advance to ${stepLabel}` : stepLabel}
              className={cn(
                'flex flex-col items-center gap-1 group',
                isClickable ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              {/* Dot / check */}
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all',
                  isCompleted
                    ? cn(dotColor, 'border-transparent opacity-70')
                    : isCurrent
                      ? cn(dotColor, 'border-white/20 ring-2 ring-offset-1 ring-offset-background', STEP_RING_COLORS[step])
                      : 'border-muted-foreground/30 bg-muted/30',
                  isClickable && 'group-hover:opacity-80 group-hover:scale-105'
                )}
              >
                {isCompleted ? (
                  <Check size={12} weight="bold" className="text-white" />
                ) : isCurrent ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-white/90" />
                ) : null}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'text-[10px] leading-tight text-center max-w-[56px]',
                  labelColor
                )}
              >
                {idx === 0 && isLate ? (
                  <>
                    {stepLabel}
                    <span className="block text-amber-400 font-semibold">Late</span>
                  </>
                ) : (
                  stepLabel
                )}
              </span>
            </button>

            {/* Connector line between steps */}
            {idx < WORKFLOW_STEPS.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-8 flex-shrink-0 transition-all',
                  isInWorkflow && idx < currentIdx
                    ? 'bg-muted-foreground/40'
                    : 'bg-muted-foreground/15'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Ring accent colors per step for the current active step highlight
const STEP_RING_COLORS: Record<typeof WORKFLOW_STEPS[number], string> = {
  checked_in:  'ring-blue-500/50',
  in_progress: 'ring-purple-500/50',
  ready:       'ring-orange-500/50',
  picked_up:   'ring-green-500/50',
}
