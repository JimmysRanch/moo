import { motion } from 'framer-motion'
import { useState } from 'react'
import { dashboardTopServicesData } from '../data/dashboardDefaults'
import { Scissors, Sparkle, Eyedropper } from '@phosphor-icons/react'

const iconMap = {
  scissors: Scissors,
  sparkle: Sparkle,
  eyedropper: Eyedropper,
}

export function TopServicesCard() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const services = dashboardTopServicesData
  const safeServices = services || []
  const maxRevenue = safeServices.length > 0 ? Math.max(...safeServices.map(s => s.revenue)) : 1

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-0.5">
          <motion.div 
            className="text-2xl font-bold"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            Top Services
          </motion.div>
          <div className="text-xs text-muted-foreground">
            This Week's Best Performers
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        {safeServices.map((service, index) => {
          const Icon = iconMap[service.icon as keyof typeof iconMap]
          const widthPercent = (service.revenue / maxRevenue) * 100
          const isHovered = hoveredIndex === index

          return (
            <motion.div
              key={service.name}
              className="relative"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.7 + index * 0.1 }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <motion.div
                    className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center"
                    animate={{
                      scale: isHovered ? 1.1 : 1,
                      backgroundColor: isHovered ? 'oklch(0.75 0.15 195 / 0.3)' : 'oklch(0.75 0.15 195 / 0.2)'
                    }}
                  >
                    <Icon size={14} className="text-primary" weight={isHovered ? 'fill' : 'regular'} />
                  </motion.div>
                  <div>
                    <div className={`text-xs font-medium transition-colors ${isHovered ? 'text-primary' : 'text-foreground'}`}>
                      {service.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {service.count} bookings
                    </div>
                  </div>
                </div>
                <motion.div 
                  className="text-sm font-bold"
                  animate={{
                    scale: isHovered ? 1.1 : 1,
                    color: isHovered ? 'oklch(0.75 0.15 195)' : 'oklch(0.98 0 0)'
                  }}
                >
                  ${service.revenue.toLocaleString()}
                </motion.div>
              </div>

              <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full relative overflow-hidden"
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{ duration: 0.8, delay: 0.8 + index * 0.1, ease: 'easeOut' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/80" />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{
                      x: isHovered ? ['0%', '100%'] : '0%',
                    }}
                    transition={{
                      duration: 0.8,
                      ease: 'easeInOut',
                    }}
                  />
                </motion.div>
              </div>

              {isHovered && (
                <motion.div
                  className="absolute -top-1 -left-1 -right-1 -bottom-1 rounded-lg border border-primary/30 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </motion.div>
          )
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Total Revenue</span>
          <motion.span 
            className="font-bold text-primary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            ${safeServices.reduce((sum, s) => sum + s.revenue, 0).toLocaleString()}
          </motion.span>
        </div>
      </div>
    </div>
  )
}
