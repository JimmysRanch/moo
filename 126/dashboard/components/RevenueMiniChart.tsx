import { motion } from 'framer-motion'
import { revenueData } from '../data/dashboardDefaults'
import { TrendUp, TrendDown } from '@phosphor-icons/react'
import { useState } from 'react'

export function RevenueMiniChart() {
  const revenue = revenueData
  const { thisWeek } = revenue || revenueData
  const maxAmount = Math.max(...thisWeek.daily.map(d => d.amount))
  const minAmount = Math.min(...thisWeek.daily.map(d => d.amount))
  const isPositive = thisWeek.percentChange >= 0
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const points = thisWeek.daily.map((day, index) => {
    const x = (index / (thisWeek.daily.length - 1)) * 100
    const y = 100 - ((day.amount - minAmount) / (maxAmount - minAmount)) * 100
    return { x, y, day, index }
  })

  const pathD = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`
    const prev = points[i - 1]
    const cpX = (prev.x + point.x) / 2
    return `${acc} Q ${cpX} ${prev.y}, ${cpX} ${(prev.y + point.y) / 2} Q ${cpX} ${point.y}, ${point.x} ${point.y}`
  }, '')

  const areaD = `${pathD} L 100 100 L 0 100 Z`

  return (
    <div className="relative h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-0.5">
          <motion.div 
            className="text-2xl font-bold"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            ${(thisWeek.total / 1000).toFixed(1)}k
          </motion.div>
          <div className="text-xs text-muted-foreground">
            This Week's Revenue
          </div>
        </div>
        <motion.div 
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          whileHover={{ scale: 1.05 }}
        >
          <motion.div
            animate={{ y: isPositive ? [-1, 0, -1] : [1, 0, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {isPositive ? <TrendUp size={14} weight="bold" /> : <TrendDown size={14} weight="bold" />}
          </motion.div>
          <span className="text-xs font-bold">{Math.abs(thisWeek.percentChange)}%</span>
        </motion.div>
      </div>

      <div className="flex-1 relative">
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="oklch(0.75 0.15 195)" stopOpacity="0.4" />
              <stop offset="50%" stopColor="oklch(0.75 0.15 195)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="oklch(0.75 0.15 195)" stopOpacity="0.05" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <motion.path
            d={areaD}
            fill="url(#revenueGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          />

          <motion.path
            d={pathD}
            fill="none"
            stroke="oklch(0.75 0.15 195)"
            strokeWidth="0.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.7, ease: 'easeOut' }}
            filter="url(#glow)"
          />

          {points.map((point, index) => (
            <g key={index}>
              <motion.circle
                cx={point.x}
                cy={point.y}
                r={hoveredIndex === index ? 2 : 1.2}
                fill="oklch(0.75 0.15 195)"
                className="cursor-pointer"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.7 + index * 0.05 }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              {hoveredIndex === index && (
                <motion.circle
                  cx={point.x}
                  cy={point.y}
                  r={3}
                  fill="none"
                  stroke="oklch(0.75 0.15 195)"
                  strokeWidth="0.5"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.5 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </g>
          ))}
        </svg>

        {hoveredIndex !== null && (
          <motion.div
            className="absolute bg-card px-3 py-2 rounded-lg shadow-xl border border-primary/30 z-10"
            style={{
              left: `${points[hoveredIndex].x}%`,
              top: `${points[hoveredIndex].y}%`,
              transform: 'translate(-50%, -120%)'
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="text-xs font-bold">${thisWeek.daily[hoveredIndex].amount.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">{thisWeek.daily[hoveredIndex].day}, {thisWeek.daily[hoveredIndex].date}</div>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 mt-3 pt-3 border-t border-border">
        {thisWeek.daily.map((day, index) => (
          <motion.div
            key={index}
            className="flex flex-col items-center cursor-pointer"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.8 + index * 0.05 }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className={`text-[10px] font-medium transition-colors ${hoveredIndex === index ? 'text-primary' : 'text-foreground'}`}>
              {day.day}
            </div>
            <div className={`text-[9px] transition-colors ${hoveredIndex === index ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
              {day.date}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
