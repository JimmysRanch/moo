import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface KpiCardProps {
  title: string
  children: ReactNode
  delay?: number
  className?: string
}

export function KpiCard({ title, children, delay = 0, className = '' }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(117, 190, 218, 0.15)' }}
      className={`bg-card rounded-xl p-3 sm:p-4 border border-border ${className}`}
    >
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">
        {title}
      </div>
      {children}
    </motion.div>
  )
}
