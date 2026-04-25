import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      let current = 0
      const increment = value / 60
      const interval = setInterval(() => {
        current += increment
        if (current >= value) {
          setCount(value)
          clearInterval(interval)
        } else {
          setCount(Math.floor(current))
        }
      }, 16)
      return () => clearInterval(interval)
    }, delay * 1000)
    return () => clearTimeout(timer)
  }, [value, delay])

  return <span>{count}%</span>
}

interface BookedPercentageCardProps {
  data: {
    day: number
    week: number
    month: number
  }
  isSweetBlueTheme?: boolean
}

export function BookedPercentageCard({ data, isSweetBlueTheme = false }: BookedPercentageCardProps) {
  return (
    <div className="h-full flex items-center">
      <div className={cn('w-full', isSweetBlueTheme ? 'space-y-[3px]' : 'space-y-1.5')}>
        <div className={cn('space-y-0.5', isSweetBlueTheme && 'dashboard-stat-tile dashboard-stat-tile-compact rounded-lg border border-border/60 bg-secondary/20 px-1.5 py-1.5')}>
          <div className="flex items-center justify-between">
            <span className={cn('text-[10px] text-muted-foreground', isSweetBlueTheme && 'uppercase tracking-[0.08em]')}>Day</span>
            <span className={cn('font-bold', isSweetBlueTheme ? 'text-[13px] leading-none' : 'text-base')}>
              <AnimatedNumber value={data.day} delay={0.1} />
            </span>
          </div>
          <div className={cn('bg-secondary rounded-full overflow-hidden', isSweetBlueTheme ? 'dashboard-progress-track h-1' : 'h-1.5')}>
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${data.day}%` }}
            />
          </div>
        </div>

        <div className={cn('space-y-0.5', isSweetBlueTheme && 'dashboard-stat-tile dashboard-stat-tile-compact rounded-lg border border-border/60 bg-secondary/20 px-1.5 py-1.5')}>
          <div className="flex items-center justify-between">
            <span className={cn('text-[10px] text-muted-foreground', isSweetBlueTheme && 'uppercase tracking-[0.08em]')}>Week</span>
            <span className={cn('font-bold', isSweetBlueTheme ? 'text-[13px] leading-none' : 'text-base')}>
              <AnimatedNumber value={data.week} delay={0.2} />
            </span>
          </div>
          <div className={cn('bg-secondary rounded-full overflow-hidden', isSweetBlueTheme ? 'dashboard-progress-track h-1' : 'h-1.5')}>
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${data.week}%` }}
            />
          </div>
        </div>

        <div className={cn('space-y-0.5', isSweetBlueTheme && 'dashboard-stat-tile dashboard-stat-tile-compact rounded-lg border border-border/60 bg-secondary/20 px-1.5 py-1.5')}>
          <div className="flex items-center justify-between">
            <span className={cn('text-[10px] text-muted-foreground', isSweetBlueTheme && 'uppercase tracking-[0.08em]')}>Month</span>
            <span className={cn('font-bold', isSweetBlueTheme ? 'text-[13px] leading-none' : 'text-base')}>
              <AnimatedNumber value={data.month} delay={0.3} />
            </span>
          </div>
          <div className={cn('bg-secondary rounded-full overflow-hidden', isSweetBlueTheme ? 'dashboard-progress-track h-1' : 'h-1.5')}>
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${data.month}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
