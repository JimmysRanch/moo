/**
 * Insights Strip Component
 * Displays 1-3 actionable insights with drill-down capability
 */

import { Insight } from '../types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Warning, 
  Info, 
  CheckCircle, 
  ArrowRight,
  Lightning 
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface InsightsStripProps {
  insights: Insight[]
  onInsightClick?: (insight: Insight) => void
  className?: string
}

export function InsightsStrip({ insights, onInsightClick, className }: InsightsStripProps) {
  if (insights.length === 0) {
    return null
  }
  
  const getSeverityStyles = (severity: Insight['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-500/10 border-red-500/20',
          icon: 'text-red-500',
          badge: 'bg-red-500 text-white',
        }
      case 'warning':
        return {
          bg: 'bg-amber-500/10 border-amber-500/20',
          icon: 'text-amber-500',
          badge: 'bg-amber-500 text-white',
        }
      case 'positive':
        return {
          bg: 'bg-green-500/10 border-green-500/20',
          icon: 'text-green-500',
          badge: 'bg-green-500 text-white',
        }
      case 'info':
      default:
        return {
          bg: 'bg-blue-500/10 border-blue-500/20',
          icon: 'text-blue-500',
          badge: 'bg-blue-500 text-white',
        }
    }
  }
  
  const getIcon = (insight: Insight) => {
    switch (insight.severity) {
      case 'critical':
        return Warning
      case 'warning':
        return Warning
      case 'positive':
        return CheckCircle
      case 'info':
      default:
        return Info
    }
  }
  
  return (
    <div 
      className={cn('space-y-2', className)}
      role="region"
      aria-label="Insights and recommendations"
    >
      {insights.map((insight) => {
        const styles = getSeverityStyles(insight.severity)
        const Icon = getIcon(insight)
        
        return (
          <Card 
            key={insight.id}
            className={cn(
              'p-3 border transition-all duration-200',
              styles.bg,
              onInsightClick && 'cursor-pointer hover:shadow-md'
            )}
            onClick={() => onInsightClick?.(insight)}
            role={onInsightClick ? 'button' : undefined}
            tabIndex={onInsightClick ? 0 : undefined}
            onKeyDown={onInsightClick ? (e) => { 
              if (e.key === 'Enter' || e.key === ' ') onInsightClick(insight) 
            } : undefined}
          >
            <div className="flex items-start gap-3">
              <div className={cn('mt-0.5', styles.icon)}>
                <Icon size={20} weight="fill" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-sm">{insight.title}</h4>
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium uppercase',
                    styles.badge
                  )}>
                    {insight.severity}
                  </span>
                </div>
                
                <p className="text-sm text-muted-foreground mt-1">
                  {insight.description}
                </p>
                
                {insight.impactedSegment && (
                  <p className="text-xs text-muted-foreground/80 mt-1">
                    {insight.impactedSegment}
                  </p>
                )}
                
                <div className="flex items-center gap-2 mt-2">
                  <Lightning size={12} className={styles.icon} weight="fill" />
                  <span className="text-xs font-medium">
                    {insight.suggestedAction}
                  </span>
                </div>
              </div>
              
              {onInsightClick && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onInsightClick(insight)
                  }}
                >
                  <ArrowRight size={16} />
                </Button>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

/**
 * Empty state for when no insights are available
 */
export function InsightsEmptyState({ className }: { className?: string }) {
  return (
    <Card className={cn(
      'p-4 border-dashed border-border/60',
      'bg-gradient-to-br from-muted/30 to-muted/10',
      className
    )}>
      <div className="flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-green-500/10 shrink-0">
          <CheckCircle size={22} weight="fill" className="text-green-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">All systems operating normally</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            No anomalies or actionable insights detected for this period
          </p>
        </div>
      </div>
    </Card>
  )
}
