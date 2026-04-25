import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface BookedGaugeProps {
  percentage: number
  target: number
  delay?: number
  isSweetBlueTheme?: boolean
}

export function BookedGauge({ percentage, target, delay = 0, isSweetBlueTheme = false }: BookedGaugeProps) {
  const [displayPercentage, setDisplayPercentage] = useState(0)
  const [gradientId] = useState(() => `booked-gauge-gradient-${Math.random().toString(36).slice(2, 8)}`)
  const targetMarkerRatio = 0.025

  useEffect(() => {
    const timer = setTimeout(() => {
      let current = 0
      const increment = percentage / 60
      const interval = setInterval(() => {
        current += increment
        if (current >= percentage) {
          setDisplayPercentage(percentage)
          clearInterval(interval)
        } else {
          setDisplayPercentage(Math.floor(current))
        }
      }, 16)
      return () => clearInterval(interval)
    }, delay * 1000)
    return () => clearTimeout(timer)
  }, [percentage, delay])

  const circumference = 2 * Math.PI * 70
  const offset = circumference - (displayPercentage / 100) * circumference

  const targetOffset = circumference - (target / 100) * circumference

  return (
    <div
      className={cn(
        'relative flex items-center justify-center w-full h-full max-h-full',
        isSweetBlueTheme && 'dashboard-gauge-shell rounded-full'
      )}
    >
      <svg className="transform -rotate-90 w-full h-full max-w-[140px] max-h-[140px]" viewBox="0 0 180 180">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {isSweetBlueTheme ? (
              <>
                <stop offset="0%" stopColor="oklch(0.78 0.13 215)" />
                <stop offset="55%" stopColor="oklch(0.72 0.14 248)" />
                <stop offset="100%" stopColor="oklch(0.68 0.16 268)" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="oklch(0.75 0.15 195)" />
                <stop offset="25%" stopColor="oklch(0.75 0.15 150)" />
                <stop offset="50%" stopColor="oklch(0.75 0.15 120)" />
                <stop offset="75%" stopColor="oklch(0.75 0.15 60)" />
                <stop offset="100%" stopColor="oklch(0.75 0.15 340)" />
              </>
            )}
          </linearGradient>
        </defs>
        
        <circle
          cx="90"
          cy="90"
          r="70"
          stroke={isSweetBlueTheme ? 'rgba(148, 163, 184, 0.24)' : 'oklch(0.30 0.05 250)'}
          strokeWidth={isSweetBlueTheme ? '12' : '14'}
          fill="none"
        />

        {isSweetBlueTheme ? (
          <>
            <circle
              cx="90"
              cy="90"
              r="70"
              stroke="rgba(14, 165, 233, 0.2)"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="2 8"
            />

            <circle
              cx="90"
              cy="90"
              r="70"
              stroke="rgba(15, 23, 42, 0.18)"
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${Math.max(circumference * targetMarkerRatio, 8)} ${circumference}`}
              strokeDashoffset={targetOffset}
            />
          </>
        ) : null}
        
        <circle
          cx="90"
          cy="90"
          r="70"
          stroke={`url(#${gradientId})`}
          strokeWidth={isSweetBlueTheme ? '12' : '14'}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
        />
      </svg>
      
      <div
        className={cn(
          'absolute flex flex-col items-center justify-center',
          isSweetBlueTheme
            ? 'dashboard-gauge-core rounded-full border border-border/60 bg-card/80 text-center backdrop-blur-sm'
            : 'inset-0'
        )}
        style={isSweetBlueTheme ? { inset: '23%' } : undefined}
      >
        <div className={cn('text-2xl font-bold', isSweetBlueTheme && 'leading-none')}>
          {displayPercentage}%
        </div>
        <div className={cn('text-[10px] text-muted-foreground', isSweetBlueTheme ? 'font-medium mt-1' : 'mt-0.5')}>
          Today
        </div>
        <div className={cn('text-muted-foreground', isSweetBlueTheme ? 'text-[10px]' : 'text-[9px]')}>
          Target {target}%
        </div>
      </div>
    </div>
  )
}
