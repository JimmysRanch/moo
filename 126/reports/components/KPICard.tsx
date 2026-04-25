/**
 * KPI Card Component
 * Displays a key performance indicator with value, delta, and tooltip
 */

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TrendUp, TrendDown, Minus, Info } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { KPIValue } from '../types'
import { getMetricDefinition, formatMetricValue, formatDelta } from '../engine/metricRegistry'

interface KPICardProps {
  metricId: string
  value: KPIValue
  onClick?: () => void
  className?: string
  compact?: boolean
}

export function KPICard({ metricId, value, onClick, className, compact = false }: KPICardProps) {
  const metric = getMetricDefinition(metricId)
  const [isHovered, setIsHovered] = useState(false)
  
  if (!metric) {
    return (
      <Card className={cn('p-3', className)}>
        <div className="text-sm text-muted-foreground">Unknown metric: {metricId}</div>
      </Card>
    )
  }
  
  const formattedValue = formatMetricValue(value.current, value.format)
  const deltaValue = value.delta !== undefined ? formatDelta(value.delta, value.format) : null
  const deltaPercent = value.deltaPercent !== undefined ? `${value.deltaPercent >= 0 ? '+' : ''}${value.deltaPercent.toFixed(1)}%` : null
  
  const isPositive = (value.delta ?? 0) > 0
  const isNegative = (value.delta ?? 0) < 0
  const isNeutral = value.delta === undefined || value.delta === 0
  
  // For some metrics, negative delta is actually good (e.g., no-show rate)
  const invertedMetrics = ['noShowRate', 'lateCancelRate', 'lostRevenue', 'processingFees', 'estimatedCOGS', 'directLabor']
  const isInverted = invertedMetrics.includes(metricId)
  
  const TrendIcon = isNeutral ? Minus : isPositive ? (isInverted ? TrendDown : TrendUp) : (isInverted ? TrendUp : TrendDown)
  const trendColor = isNeutral 
    ? 'text-muted-foreground' 
    : (isPositive && !isInverted) || (isNegative && isInverted)
      ? 'text-green-500' 
      : 'text-red-500'
  
  return (
    <TooltipProvider>
      <Card 
        className={cn(
          'relative overflow-hidden transition-all duration-200',
          onClick && 'cursor-pointer hover:border-primary/50 hover:shadow-md',
          compact ? 'p-2' : 'p-3',
          className
        )}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
        aria-label={`${metric.label}: ${formattedValue}${deltaPercent ? `, ${deltaPercent} change` : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className={cn(
                'font-medium text-muted-foreground truncate',
                compact ? 'text-[10px]' : 'text-xs'
              )}>
                {metric.label}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Information about ${metric.label}`}
                  >
                    <Info size={compact ? 10 : 12} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-2">
                    <p className="font-semibold">{metric.label}</p>
                    <p className="text-xs">{metric.definition}</p>
                    <div className="border-t pt-2 mt-2">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Formula: </span>
                        {metric.formula}
                      </p>
                      {metric.exclusions && metric.exclusions.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Excludes: </span>
                          {metric.exclusions.join(', ')}
                        </p>
                      )}
                      {metric.timeBasisSensitivity && (
                        <p className="text-xs text-amber-500 mt-1">
                          ⚠️ Value changes based on time basis selection
                        </p>
                      )}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            
            <div className={cn(
              'font-bold tracking-tight',
              compact ? 'text-lg mt-0.5' : 'text-2xl mt-1'
            )}>
              {formattedValue}
            </div>
          </div>
          
          {(deltaValue || deltaPercent) && (
            <div className={cn('flex flex-col items-end', trendColor)}>
              <TrendIcon size={compact ? 14 : 18} weight="bold" />
              <span className={cn('font-medium', compact ? 'text-[10px]' : 'text-xs')}>
                {deltaPercent || deltaValue}
              </span>
            </div>
          )}
        </div>
        
        {/* Hover indicator for clickable cards */}
        {onClick && isHovered && (
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/50" />
        )}
      </Card>
    </TooltipProvider>
  )
}

/**
 * KPI Deck - A row of KPI cards
 */
interface KPIDeckProps {
  metrics: {
    metricId: string
    value: KPIValue
    onClick?: () => void
  }[]
  className?: string
  compact?: boolean
}

export function KPIDeck({ metrics, className, compact = false }: KPIDeckProps) {
  return (
    <div 
      className={cn(
        'grid gap-3',
        metrics.length <= 4 ? 'grid-cols-2 md:grid-cols-4' : 
        metrics.length <= 6 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' :
        'grid-cols-2 md:grid-cols-4 lg:grid-cols-5',
        className
      )}
      role="region"
      aria-label="Key Performance Indicators"
    >
      {metrics.map(({ metricId, value, onClick }) => (
        <KPICard
          key={metricId}
          metricId={metricId}
          value={value}
          onClick={onClick}
          compact={compact}
        />
      ))}
    </div>
  )
}
