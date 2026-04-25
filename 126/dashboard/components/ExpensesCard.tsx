import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

interface ExpensesCardProps {
  data: Array<{
    category: string
    amount: number
    color: string
  }>
  isSweetBlueTheme?: boolean
}

export function ExpensesCard({ data, isSweetBlueTheme = false }: ExpensesCardProps) {
  const sortedExpenses = useMemo(
    () => [...(data || [])].sort((a, b) => b.amount - a.amount),
    [data]
  )
  const [animatedValues, setAnimatedValues] = useState(sortedExpenses.map(() => 0))
  
  const total = sortedExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  
  useEffect(() => {
    setAnimatedValues(sortedExpenses.map(() => 0))
  }, [sortedExpenses])

  useEffect(() => {
    const timers = sortedExpenses.map((_, index) => 
      setTimeout(() => {
        let current = 0
        const target = sortedExpenses[index].amount
        const increment = target / 60
        const interval = setInterval(() => {
          current += increment
          if (current >= target) {
            setAnimatedValues(prev => {
              const newValues = [...prev]
              newValues[index] = target
              return newValues
            })
            clearInterval(interval)
          } else {
            setAnimatedValues(prev => {
              const newValues = [...prev]
              newValues[index] = current
              return newValues
            })
          }
        }, 16)
        return () => clearInterval(interval)
      }, index * 100)
    )
    return () => timers.forEach(timer => clearTimeout(timer))
  }, [sortedExpenses])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="space-y-0 overflow-y-auto flex-1 scrollbar-thin pr-1 min-h-0">
        {sortedExpenses.map((expense, index) => {
          const percentage = total > 0 ? ((animatedValues[index] / total) * 100).toFixed(1) : 0
          
          return (
            <motion.div
              key={expense.category}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={cn(
                'flex items-center justify-between text-xs gap-2',
                isSweetBlueTheme
                  ? 'dashboard-list-item py-2 px-2.5 rounded-lg border border-border/60 bg-secondary/20'
                  : 'py-0.5'
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div 
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: expense.color }}
                />
                <span className="text-muted-foreground truncate text-[11px]">{expense.category}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="font-semibold text-[11px]">${Math.round(animatedValues[index]).toLocaleString()}</span>
                <span className="text-muted-foreground text-[10px] w-8 text-right">{percentage}%</span>
              </div>
            </motion.div>
          )
        })}
      </div>
      
      <div
        className={cn(
          'flex-shrink-0 mt-1',
          isSweetBlueTheme
            ? 'dashboard-inset pt-1.5 px-2.5 pb-2 border border-border/60 rounded-lg bg-secondary/20'
            : 'pt-1 border-t border-border'
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Total Expenses</span>
          <span className="text-sm font-bold">
            ${Math.round(animatedValues.reduce((sum, val) => sum + val, 0)).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
