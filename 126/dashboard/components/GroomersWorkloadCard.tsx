import { motion } from 'framer-motion'
import { cn, formatGroomerName } from '@/lib/utils'

type GroomerDataItem = {
  id: number
  name: string
  bookedPercentage: number
  appointmentCount: number
  lastAppointmentEnd: string
  schedule: Array<{ start: number; duration: number; client: string }>
}

interface GroomerWorkloadItemProps {
  groomer: GroomerDataItem
  delay: number
  isSweetBlueTheme?: boolean
}

function GroomerWorkloadItem({ groomer, delay, isSweetBlueTheme = false }: GroomerWorkloadItemProps) {
  const totalMinutesInDay = 480
  const bookedMinutes = Math.round((groomer.bookedPercentage / 100) * totalMinutesInDay)

  const getBarColor = (groomerId: number) => {
    if (groomerId === 1) return 'from-pink-500 to-purple-500'
    if (groomerId === 2) return 'from-blue-500 to-cyan-500'
    return 'from-green-500 to-teal-500'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        'space-y-0.5',
        isSweetBlueTheme && 'dashboard-list-item dashboard-list-item-compact rounded-lg border border-border/60 bg-secondary/20 px-2 py-1.5'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className={cn('text-[11px] font-semibold truncate', isSweetBlueTheme && 'leading-tight')}>{formatGroomerName(groomer.name)}</div>
          <div className={cn('flex items-center text-muted-foreground', isSweetBlueTheme ? 'gap-1 text-[9px] leading-tight' : 'gap-1.5 text-[10px]')}>
            <span>{groomer.appointmentCount} appointments</span>
            <span>•</span>
            <span>{bookedMinutes}/{totalMinutesInDay} min</span>
          </div>
        </div>
        <div className={cn('font-bold text-primary flex-shrink-0', isSweetBlueTheme ? 'text-[13px]' : 'text-sm')}>
          {groomer.bookedPercentage}%
        </div>
      </div>

      <div className={cn('relative bg-secondary rounded-full overflow-hidden', isSweetBlueTheme ? 'dashboard-progress-track h-1' : 'h-1.5')}>
        <motion.div
          className={`h-full bg-gradient-to-r ${getBarColor(groomer.id)} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${groomer.bookedPercentage}%` }}
          transition={{ duration: 1, delay: delay + 0.2, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

interface GroomersWorkloadCardProps {
  data: GroomerDataItem[]
  isSweetBlueTheme?: boolean
}

export function GroomersWorkloadCard({ data, isSweetBlueTheme = false }: GroomersWorkloadCardProps) {
  const groomers = data || []
  return (
    <div className={cn('h-full flex flex-col', isSweetBlueTheme ? 'space-y-1 justify-start pt-0.5' : 'space-y-1.5 justify-center')}>
      {groomers.slice(0, 3).map((groomer, index) => (
        <GroomerWorkloadItem
          key={groomer.id}
          groomer={groomer}
          delay={index * 0.1}
          isSweetBlueTheme={isSweetBlueTheme}
        />
      ))}
    </div>
  )
}
