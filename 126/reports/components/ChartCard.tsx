/**
 * Chart Card Component
 * Wrapper for charts with title, export actions, and accessibility
 */

import { useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart'
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import { DotsThreeVertical, DownloadSimple, Copy, Image } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { ChartDataPoint } from '../types'

interface ChartCardProps {
  title: string
  description?: string
  children: React.ReactNode
  onExportPNG?: () => void
  onExportData?: () => void
  className?: string
  ariaLabel?: string
}

export function ChartCard({ 
  title, 
  description, 
  children, 
  onExportPNG, 
  onExportData,
  className,
  ariaLabel,
}: ChartCardProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  
  const handleCopyImage = async () => {
    if (!chartRef.current) return
    
    try {
      // Use html2canvas or similar if available, for now just trigger download
      onExportPNG?.()
    } catch (error) {
      console.error('Failed to copy chart as image:', error)
    }
  }
  
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <DotsThreeVertical size={16} />
                <span className="sr-only">Chart options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onExportPNG && (
                <DropdownMenuItem onClick={onExportPNG}>
                  <Image size={16} className="mr-2" />
                  Export as PNG
                </DropdownMenuItem>
              )}
              {onExportData && (
                <DropdownMenuItem onClick={onExportData}>
                  <DownloadSimple size={16} className="mr-2" />
                  Export Data
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleCopyImage}>
                <Copy size={16} className="mr-2" />
                Copy Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          ref={chartRef}
          role="img"
          aria-label={ariaLabel || title}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== Chart Components ====================

// Vibrant color palette for charts - using CSS custom properties for theme support
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
  'var(--chart-9)',
  'var(--chart-10)',
]

interface SimpleBarChartProps {
  data: ChartDataPoint[]
  height?: number
  formatValue?: (value: number) => string
  color?: string
  onClick?: (item: ChartDataPoint) => void
}

export function SimpleBarChart({ 
  data, 
  height = 200, 
  formatValue = (v) => v.toLocaleString(),
  color = CHART_COLORS[0],
  onClick,
}: SimpleBarChartProps) {
  const config: ChartConfig = {
    value: {
      label: 'Value',
      color,
    },
  }
  
  return (
    <ChartContainer config={config} className={`h-[${height}px]`}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis 
          dataKey="label" 
          tickLine={false}
          axisLine={false}
          fontSize={10}
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis 
          tickLine={false}
          axisLine={false}
          fontSize={10}
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={formatValue}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar 
          dataKey="value" 
          fill={color}
          radius={[4, 4, 0, 0]}
          cursor={onClick ? 'pointer' : undefined}
          onClick={(data) => onClick?.(data as unknown as ChartDataPoint)}
        />
      </BarChart>
    </ChartContainer>
  )
}

interface SimpleStackedBarChartProps {
  data: { category: string; data: ChartDataPoint[] }[]
  height?: number
  formatValue?: (value: number) => string
  _onClick?: (item: ChartDataPoint, category: string) => void
}

export function SimpleStackedBarChart({ 
  data, 
  height = 200, 
  formatValue = (v) => v.toLocaleString(),
  _onClick,
}: SimpleStackedBarChartProps) {
  // Transform data for stacked bar chart
  const allLabels = [...new Set(data.flatMap(cat => cat.data.map(d => d.label)))]
  const chartData = allLabels.map(label => {
    const item: Record<string, unknown> = { label }
    data.forEach(cat => {
      const point = cat.data.find(d => d.label === label)
      item[cat.category] = point?.value || 0
    })
    return item
  })
  
  const config: ChartConfig = {}
  data.forEach((cat, i) => {
    config[cat.category] = {
      label: cat.category,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }
  })
  
  return (
    <ChartContainer config={config} className={`h-[${height}px]`}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis 
          dataKey="label" 
          tickLine={false}
          axisLine={false}
          fontSize={10}
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis 
          tickLine={false}
          axisLine={false}
          fontSize={10}
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={formatValue}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        {data.map((cat, i) => (
          <Bar 
            key={cat.category}
            dataKey={cat.category} 
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            stackId="stack"
            radius={i === data.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

interface SimpleDualLineChartProps {
  data: ChartDataPoint[]
  height?: number
  formatValue?: (value: number) => string
  line1Label?: string
  line2Label?: string
  onClick?: (item: ChartDataPoint) => void
}

export function SimpleDualLineChart({ 
  data, 
  height = 200, 
  formatValue = (v) => v.toLocaleString(),
  line1Label = 'Current',
  line2Label = 'Previous',
  onClick,
}: SimpleDualLineChartProps) {
  const config: ChartConfig = {
    value: {
      label: line1Label,
      color: CHART_COLORS[0],
    },
    previousValue: {
      label: line2Label,
      color: CHART_COLORS[1],
    },
  }
  
  return (
    <ChartContainer config={config} className={`h-[${height}px]`}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis 
          dataKey="label" 
          tickLine={false}
          axisLine={false}
          fontSize={10}
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis 
          tickLine={false}
          axisLine={false}
          fontSize={10}
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={formatValue}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Line 
          type="monotone"
          dataKey="value" 
          stroke={CHART_COLORS[0]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          cursor={onClick ? 'pointer' : undefined}
        />
        <Line 
          type="monotone"
          dataKey="previousValue" 
          stroke={CHART_COLORS[1]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          strokeDasharray="5 5"
        />
      </LineChart>
    </ChartContainer>
  )
}

interface SimpleFunnelChartProps {
  data: ChartDataPoint[]
  height?: number
  formatValue?: (value: number) => string
  onClick?: (item: ChartDataPoint) => void
}

export function SimpleFunnelChart({ 
  data, 
  height = 200, 
  formatValue = (v) => v.toLocaleString(),
  onClick,
}: SimpleFunnelChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1)
  
  return (
    <div className="space-y-2" style={{ minHeight: height }}>
      {data.map((item, index) => {
        const width = (item.value / maxValue) * 100
        const conversionRate = index > 0 && data[index - 1].value > 0
          ? ((item.value / data[index - 1].value) * 100).toFixed(1)
          : null
        
        return (
          <div 
            key={item.label}
            className={cn(
              "relative",
              onClick && "cursor-pointer hover:opacity-80"
            )}
            onClick={() => onClick?.(item)}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground min-w-[100px]">
                {item.label}
              </span>
              {conversionRate && (
                <span className="text-[10px] text-muted-foreground">
                  ({conversionRate}%)
                </span>
              )}
            </div>
            <div className="relative h-8 bg-muted rounded overflow-hidden">
              <div 
                className="h-full transition-all duration-300"
                style={{ 
                  width: `${width}%`,
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length]
                }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium">
                {formatValue(item.value)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface SimpleScatterChartProps {
  data: ChartDataPoint[]
  height?: number
  formatXValue?: (value: number) => string
  formatYValue?: (value: number) => string
  xLabel?: string
  yLabel?: string
  onClick?: (item: ChartDataPoint) => void
}

export function SimpleScatterChart({ 
  data, 
  height = 200, 
  formatXValue = (v) => v.toFixed(1) + '%',
  formatYValue = (v) => v.toFixed(1) + '%',
  xLabel = 'X',
  yLabel = 'Y',
  onClick,
}: SimpleScatterChartProps) {
  // Transform data for scatter plot - use value as x, previousValue as y
  const scatterData = data.map(d => ({
    label: d.label,
    x: d.value,
    y: d.previousValue || 0,
  }))
  
  return (
    <div style={{ height }} className="relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="grid gap-2 p-4" style={{ 
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gridTemplateRows: '1fr auto',
          width: '100%',
          height: '100%'
        }}>
          {/* Y-axis label */}
          <div className="flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground -rotate-90 whitespace-nowrap">
              {yLabel}
            </span>
          </div>
          
          {/* Plot area */}
          <div className="relative border-l border-b border-muted">
            {scatterData.map((point, i) => {
              const maxX = Math.max(...scatterData.map(p => p.x), 1)
              const maxY = Math.max(...scatterData.map(p => p.y), 1)
              const x = (point.x / maxX) * 90 + 5 // 5-95% range
              const y = 95 - (point.y / maxY) * 90 // Invert Y
              
              return (
                <div
                  key={point.label}
                  className={cn(
                    "absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2",
                    onClick && "cursor-pointer hover:ring-2 hover:ring-primary"
                  )}
                  style={{ 
                    left: `${x}%`, 
                    top: `${y}%`,
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length]
                  }}
                  title={`${point.label}: ${formatXValue(point.x)}, ${formatYValue(point.y)}`}
                  onClick={() => onClick?.({ 
                    label: point.label, 
                    value: point.x, 
                    previousValue: point.y 
                  })}
                />
              )
            })}
          </div>
          
          {/* Empty corner */}
          <div />
          
          {/* X-axis label */}
          <div className="flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">{xLabel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SimpleLineChartProps {
  data: ChartDataPoint[]
  height?: number
  formatValue?: (value: number) => string
  color?: string
  showArea?: boolean
  previousData?: ChartDataPoint[]
  onClick?: (item: ChartDataPoint) => void
}

export function SimpleLineChart({ 
  data, 
  height = 200, 
  formatValue = (v) => v.toLocaleString(),
  color = CHART_COLORS[0],
  showArea = false,
  previousData,
  onClick,
}: SimpleLineChartProps) {
  const config: ChartConfig = {
    value: {
      label: 'Current',
      color,
    },
    previousValue: {
      label: 'Previous',
      color: 'hsl(var(--muted-foreground))',
    },
  }
  
  // Merge current and previous data
  const mergedData = data.map((item, i) => ({
    ...item,
    previousValue: previousData?.[i]?.value,
  }))
  
  const ChartComponent = showArea ? AreaChart : LineChart
  
  return (
    <ChartContainer config={config} className={`h-[${height}px]`}>
      <ChartComponent data={mergedData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis 
          dataKey="label" 
          tickLine={false}
          axisLine={false}
          fontSize={10}
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis 
          tickLine={false}
          axisLine={false}
          fontSize={10}
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={formatValue}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        {previousData && (
          showArea ? (
            <Area 
              type="monotone"
              dataKey="previousValue" 
              stroke="hsl(var(--muted-foreground))"
              fill="hsl(var(--muted-foreground))"
              fillOpacity={0.1}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ) : (
            <Line 
              type="monotone"
              dataKey="previousValue" 
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
            />
          )
        )}
        {showArea ? (
          <Area 
            type="monotone"
            dataKey="value" 
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, cursor: onClick ? 'pointer' : undefined }}
          />
        ) : (
          <Line 
            type="monotone"
            dataKey="value" 
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, cursor: onClick ? 'pointer' : undefined }}
          />
        )}
      </ChartComponent>
    </ChartContainer>
  )
}

interface SimplePieChartProps {
  data: ChartDataPoint[]
  height?: number
  formatValue?: (value: number) => string
  onClick?: (item: ChartDataPoint) => void
}

export function SimplePieChart({ 
  data, 
  height = 200,
  formatValue: _formatValue = (v: number) => v.toLocaleString(),
  onClick,
}: SimplePieChartProps) {
  const config: ChartConfig = data.reduce((acc, item, i) => {
    acc[item.label] = {
      label: item.label,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }
    return acc
  }, {} as ChartConfig)
  
  return (
    <ChartContainer config={config} className={`h-[${height}px]`}>
      <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={height / 3}
          innerRadius={height / 5}
          paddingAngle={2}
          cursor={onClick ? 'pointer' : undefined}
          onClick={(data) => onClick?.(data as unknown as ChartDataPoint)}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend 
          layout="horizontal"
          align="center"
          verticalAlign="bottom"
          formatter={(value) => <span className="text-xs">{value}</span>}
        />
      </PieChart>
    </ChartContainer>
  )
}

// Heatmap component (simplified)
interface HeatmapProps {
  data: { weekday: string; hour: number; value: number }[]
  height?: number
  formatValue?: (value: number) => string
  onClick?: (item: { weekday: string; hour: number; value: number }) => void
}

export function SimpleHeatmap({ 
  data, 
  height = 200,
  formatValue = (v) => v.toLocaleString(),
  onClick,
  colorScheme = 'blue',
}: HeatmapProps & { colorScheme?: 'blue' | 'red' | 'green' }) {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const hours = Array.from({ length: 11 }, (_, i) => i + 8) // 8 AM to 6 PM
  
  const maxValue = Math.max(...data.map(d => d.value), 1)
  
  const getColor = (value: number) => {
    const intensity = value / maxValue
    const hue = colorScheme === 'red' ? 0 : colorScheme === 'green' ? 145 : 200
    const saturation = 70
    const lightness = 95 - (intensity * 50)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }
  
  return (
    <div style={{ height }} className="w-full">
      <div className="grid gap-0.5 h-full" style={{ gridTemplateColumns: `32px repeat(${hours.length}, 1fr)`, gridTemplateRows: `auto repeat(${weekdays.length}, 1fr)` }}>
        {/* Header row */}
        <div className="text-xs text-muted-foreground"></div>
        {hours.map(hour => (
          <div key={hour} className="text-[9px] text-muted-foreground text-center truncate">
            {hour}
          </div>
        ))}
        
        {/* Data rows */}
        {weekdays.map(weekday => (
          <>
            <div key={`${weekday}-label`} className="text-[9px] text-muted-foreground flex items-center">
              {weekday}
            </div>
            {hours.map(hour => {
              const cell = data.find(d => d.weekday === weekday && d.hour === hour)
              const value = cell?.value || 0
              return (
                <div
                  key={`${weekday}-${hour}`}
                  className={cn(
                    'rounded-sm transition-colors min-h-[16px]',
                    onClick && 'cursor-pointer hover:ring-1 hover:ring-primary'
                  )}
                  style={{ backgroundColor: getColor(value) }}
                  onClick={() => cell && onClick?.(cell)}
                  title={`${weekday} ${hour}:00 - ${formatValue(value)}`}
                />
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}

// ==================== Cohort Retention Grid ====================

interface CohortGridProps {
  data: { cohort: string; month: number; retention: number }[]
  height?: number
  formatValue?: (value: number) => string
  onClick?: (item: { cohort: string; month: number; retention: number }) => void
}

export function SimpleCohortGrid({ 
  data, 
  height = 200,
  formatValue = (v) => v.toFixed(1) + '%',
  onClick,
}: CohortGridProps) {
  // Get unique cohorts and months
  const cohorts = [...new Set(data.map(d => d.cohort))].sort()
  const months = [...new Set(data.map(d => d.month))].sort((a, b) => a - b)
  
  const getColor = (retention: number) => {
    const intensity = retention / 100
    const hue = 145 // Green
    const saturation = 70
    const lightness = 95 - (intensity * 50)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }
  
  return (
    <div className="overflow-x-auto">
      <div style={{ minHeight: height }}>
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-1 text-left text-muted-foreground">Cohort</th>
              {months.map(month => (
                <th key={month} className="p-1 text-center text-muted-foreground">
                  M{month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.slice(-6).map(cohort => (
              <tr key={cohort}>
                <td className="p-1 text-muted-foreground">{cohort}</td>
                {months.map(month => {
                  const cell = data.find(d => d.cohort === cohort && d.month === month)
                  const retention = cell?.retention || 0
                  return (
                    <td 
                      key={`${cohort}-${month}`}
                      className={cn(
                        'p-1 text-center',
                        onClick && 'cursor-pointer hover:ring-1 hover:ring-primary'
                      )}
                      style={{ backgroundColor: getColor(retention) }}
                      onClick={() => cell && onClick?.(cell)}
                      title={`${cohort} Month ${month}: ${formatValue(retention)}`}
                    >
                      {retention > 0 ? formatValue(retention) : '-'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
