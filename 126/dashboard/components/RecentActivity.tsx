import { motion } from 'framer-motion'
import type { RecentActivityItem } from '@/hooks/data/useRecentActivity'
import { Calendar, XCircle, CurrencyDollar, Tag, Users } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

const iconMap = {
  booking: Calendar,
  cancellation: XCircle,
  pricing: CurrencyDollar,
  discount: Tag,
  staff: Users,
}

const colorMap = {
  booking: 'text-primary',
  cancellation: 'text-destructive',
  pricing: 'text-yellow-500',
  discount: 'text-green-500',
  staff: 'text-purple-500',
}

interface RecentActivityProps {
  data: RecentActivityItem[]
  isSweetBlueTheme?: boolean
}

export function RecentActivity({ data, isSweetBlueTheme = false }: RecentActivityProps) {
  const activity = data || []
  const categoryOrder: Array<RecentActivityItem['category']> = ['today', 'yesterday', 'thisWeek', 'older']
  const categoryLabels: Record<RecentActivityItem['category'], string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'Earlier this week',
    older: 'Older activity',
  }

  if (activity.length === 0) {
    return <div className="py-6 text-center text-xs text-muted-foreground">No recent activity yet.</div>
  }

  return (
    <div className={cn(isSweetBlueTheme ? 'space-y-1.5' : 'space-y-2')}>
      {categoryOrder.map((category) => {
        const activities = activity.filter((item) => item.category === category)
        if (activities.length === 0) return null
        
        return (
          <div key={category} className={cn(isSweetBlueTheme ? 'space-y-0.5' : 'space-y-1')}>
            <div className={cn('px-1 text-[10px] font-medium uppercase text-muted-foreground', isSweetBlueTheme ? 'pt-0.5 tracking-[0.1em]' : 'pt-1 tracking-[0.12em]')}>
              {categoryLabels[category]}
            </div>
            <div className={cn(isSweetBlueTheme ? 'space-y-0.5' : 'space-y-1')}>
              {activities.map((activity, index) => {
                const Icon = iconMap[activity.type as keyof typeof iconMap] ?? Users
                const iconColor = colorMap[activity.type as keyof typeof colorMap] ?? colorMap.staff
                
                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    whileHover={{ x: 4 }}
                    className={cn(
                      'flex items-start rounded-lg bg-card border border-border cursor-pointer',
                      isSweetBlueTheme
                        ? 'dashboard-activity-item dashboard-activity-item-compact gap-1.5 px-2 py-1.5'
                        : 'gap-2 p-1.5'
                    )}
                  >
                    <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
                      <Icon size={isSweetBlueTheme ? 12 : 14} weight="duotone" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className={cn('font-medium leading-tight', isSweetBlueTheme ? 'text-[11px]' : 'text-xs')}>
                        {activity.description}
                      </div>
                      <div className={cn('text-[10px] text-muted-foreground truncate', isSweetBlueTheme && 'leading-tight')}>
                        {activity.client}
                      </div>
                    </div>
                    
                    <div className={cn('text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0', isSweetBlueTheme && 'leading-tight')}>
                      {activity.time}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
