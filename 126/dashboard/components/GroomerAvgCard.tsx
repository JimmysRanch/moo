import { motion } from 'framer-motion'
import { cn, formatGroomerName } from '@/lib/utils'

type GroomerLifetimeDataItem = {
  id: number
  groomerId: string
  name: string
  totalAppointments: number
  totalRevenue: number
  daysWorked: number
  avgDogsPerDay: number
  avgRevenuePerDay: number
}

interface GroomerAvgItemProps {
  groomer: GroomerLifetimeDataItem
  delay: number
  isSweetBlueTheme?: boolean
}

function GroomerAvgItem({ groomer, delay, isSweetBlueTheme = false }: GroomerAvgItemProps) {
  const getBarColor = (groomerId: number) => {
    if (groomerId === 1) return 'bg-pink-500'
    if (groomerId === 2) return 'bg-blue-500'
    return 'bg-green-500'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        'flex items-center gap-1.5',
        isSweetBlueTheme && 'dashboard-list-item dashboard-list-item-compact rounded-lg border border-border/60 bg-secondary/20 px-2 py-1.5'
      )}
    >
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getBarColor(groomer.id)}`} />
      <div className="flex-shrink-0 min-w-0 flex-1">
        <div className={cn('text-[11px] font-semibold truncate', isSweetBlueTheme && 'leading-tight')}>{formatGroomerName(groomer.name)}</div>
      </div>
      <div className={cn('flex items-center gap-1.5 flex-shrink-0', isSweetBlueTheme ? 'text-[10px]' : 'text-[11px]')}>
        <div className="text-right">
          <div className={cn('font-bold', isSweetBlueTheme && 'leading-none')}>{groomer.avgDogsPerDay}</div>
          <div className={cn('text-muted-foreground', isSweetBlueTheme ? 'text-[10px] uppercase tracking-[0.04em]' : 'text-[9px]')}>dogs/day</div>
        </div>
        <div className="text-right">
          <div className={cn('font-bold text-primary', isSweetBlueTheme && 'leading-none')}>${groomer.avgRevenuePerDay}</div>
          <div className={cn('text-muted-foreground', isSweetBlueTheme ? 'text-[10px] uppercase tracking-[0.04em]' : 'text-[9px]')}>revenue/day</div>
        </div>
      </div>
    </motion.div>
  )
}

interface GroomerAvgCardProps {
  data: GroomerLifetimeDataItem[]
  isSweetBlueTheme?: boolean
}

export function GroomerAvgCard({ data, isSweetBlueTheme = false }: GroomerAvgCardProps) {
  const groomers = data || []

  return (
    <div className={cn('h-full flex flex-col', isSweetBlueTheme ? 'space-y-1 justify-start pt-0.5' : 'space-y-1.5 justify-center')}>
      {groomers.slice(0, 3).map((groomer, index) => (
        <GroomerAvgItem
          key={groomer.id}
          groomer={groomer}
          delay={index * 0.1}
          isSweetBlueTheme={isSweetBlueTheme}
        />
      ))}
    </div>
  )
}
