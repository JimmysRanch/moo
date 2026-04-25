import { useReducer, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { formatTimeInShop, formatShortTime } from '@/lib/appointmentStatus'

interface TimeInShopDisplayProps {
  checkedInAt?: string | null
  inProgressAt?: string | null
  readyAt?: string | null
  pickedUpAt?: string | null
  /**
   * Fallback start time used when checkedInAt is null (e.g. pre-migration 036
   * where the checked_in_at column doesn't exist yet). Typically the appointment's
   * scheduled date + startTime ISO string.
   */
  fallbackStartTime?: string | null
  className?: string
}

/**
 * Compact display of workflow timestamps and time-in-shop duration.
 * Shows nothing if neither checkedInAt nor a fallbackStartTime is available.
 *
 * Live ticker: the elapsed time updates every minute while the appointment is
 * still active (i.e. pickedUpAt is not set).
 */
export function TimeInShopDisplay({
  checkedInAt,
  inProgressAt,
  readyAt,
  pickedUpAt,
  fallbackStartTime,
  className,
}: TimeInShopDisplayProps) {
  const effectiveStart = checkedInAt ?? fallbackStartTime
  if (!effectiveStart) return null

  // Live ticker — re-renders every 60 s so "In shop: Xh Ym" stays current.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [, tick] = useReducer((n: number) => n + 1, 0)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (pickedUpAt) return // already completed — no need to tick
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [pickedUpAt])

  const timeInShop = formatTimeInShop(effectiveStart, pickedUpAt)

  const isFallback = !checkedInAt && !!fallbackStartTime
  const parts: string[] = []
  if (checkedInAt)  parts.push(`In: ${formatShortTime(checkedInAt)}`)
  if (inProgressAt) parts.push(`Started: ${formatShortTime(inProgressAt)}`)
  if (readyAt)      parts.push(`Ready: ${formatShortTime(readyAt)}`)
  if (pickedUpAt)   parts.push(`Picked up: ${formatShortTime(pickedUpAt)}`)

  return (
    <div className={cn('text-xs text-muted-foreground space-y-0.5', className)}>
      {timeInShop && (
        <div className="font-medium text-foreground/80">
          In shop: <span className="text-primary">{timeInShop}</span>
          {isFallback && (
            <span className="ml-1 opacity-60">(est.)</span>
          )}
        </div>
      )}
      {parts.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {parts.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </div>
      )}
    </div>
  )
}
