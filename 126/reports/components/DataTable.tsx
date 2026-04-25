/**
 * Data Table Component
 * Table with grouping, column picker, sorting, pagination
 */

import { useState, useMemo, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { 
  CaretUp, 
  CaretDown, 
  Columns, 
  FunnelSimple,
  ArrowRight,
  DownloadSimple,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { AggregatedRow } from '../types'
import { formatMetricValue } from '../engine/metricRegistry'

interface ColumnDefinition {
  id: string
  label: string
  format?: 'money' | 'percent' | 'number' | 'minutes' | 'days'
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  defaultVisible?: boolean
  width?: string
}

interface DataTableProps {
  title: string
  data: AggregatedRow[]
  columns: ColumnDefinition[]
  groupByOptions?: { value: string; label: string }[]
  selectedGroupBy?: string
  onGroupByChange?: (groupBy: string) => void
  onRowClick?: (row: AggregatedRow) => void
  onExport?: () => void
  maxPreviewRows?: number
  showViewAll?: boolean
  onViewAll?: () => void
  className?: string
}

export function DataTable({
  title,
  data,
  columns,
  groupByOptions,
  selectedGroupBy,
  onGroupByChange,
  onRowClick,
  onExport,
  maxPreviewRows = 5,
  showViewAll = true,
  onViewAll,
  className,
}: DataTableProps) {
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => 
    new Set(columns.filter(c => c.defaultVisible !== false).map(c => c.id))
  )
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Pagination state
  const [showAll, setShowAll] = useState(false)
  
  // Get visible column definitions
  const visibleColumnDefs = useMemo(() => 
    columns.filter(c => visibleColumns.has(c.id)),
    [columns, visibleColumns]
  )
  
  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return data
    
    return [...data].sort((a, b) => {
      const aVal = a.metrics[sortColumn] ?? 0
      const bVal = b.metrics[sortColumn] ?? 0
      const diff = aVal - bVal
      return sortDirection === 'asc' ? diff : -diff
    })
  }, [data, sortColumn, sortDirection])
  
  // Paginate data
  const displayData = useMemo(() => {
    if (showAll) return sortedData
    return sortedData.slice(0, maxPreviewRows)
  }, [sortedData, showAll, maxPreviewRows])
  
  // Toggle column visibility
  const toggleColumn = useCallback((columnId: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(columnId)) {
        next.delete(columnId)
      } else {
        next.add(columnId)
      }
      return next
    })
  }, [])
  
  // Handle sort
  const handleSort = useCallback((columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnId)
      setSortDirection('desc')
    }
  }, [sortColumn])
  
  // Format cell value
  const formatCellValue = (value: number | undefined, format?: ColumnDefinition['format']) => {
    if (value === undefined || value === null) return '—'
    if (!format) return value.toLocaleString()
    return formatMetricValue(value, format)
  }
  
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Group By Selector */}
            {groupByOptions && groupByOptions.length > 1 && (
              <Select value={selectedGroupBy} onValueChange={onGroupByChange}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <FunnelSimple size={14} className="mr-1" />
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  {groupByOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Column Picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Columns size={14} className="mr-1" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={visibleColumns.has(col.id)}
                    onCheckedChange={() => toggleColumn(col.id)}
                    className="text-xs"
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Export Button */}
            {onExport && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onExport}>
                <DownloadSimple size={14} className="mr-1" />
                Export
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold w-[180px]">
                  {selectedGroupBy ? groupByOptions?.find(o => o.value === selectedGroupBy)?.label : 'Dimension'}
                </TableHead>
                {visibleColumnDefs.map(col => (
                  <TableHead 
                    key={col.id}
                    className={cn(
                      'text-xs font-semibold',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.sortable !== false && 'cursor-pointer hover:bg-muted/80 transition-colors'
                    )}
                    style={{ width: col.width }}
                    onClick={col.sortable !== false ? () => handleSort(col.id) : undefined}
                  >
                    <div className={cn(
                      'flex items-center gap-1',
                      col.align === 'right' && 'justify-end',
                      col.align === 'center' && 'justify-center'
                    )}>
                      {col.label}
                      {sortColumn === col.id && (
                        sortDirection === 'asc' ? <CaretUp size={12} /> : <CaretDown size={12} />
                      )}
                    </div>
                  </TableHead>
                ))}
                {onRowClick && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={visibleColumnDefs.length + 1 + (onRowClick ? 1 : 0)} 
                    className="text-center text-muted-foreground py-8"
                  >
                    No data available for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                displayData.map((row) => (
                  <TableRow 
                    key={row.id}
                    className={cn(
                      onRowClick && 'cursor-pointer hover:bg-muted/50'
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    <TableCell className="font-medium text-sm">
                      {row.dimensionValue}
                    </TableCell>
                    {visibleColumnDefs.map(col => (
                      <TableCell 
                        key={col.id}
                        className={cn(
                          'text-sm tabular-nums',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center'
                        )}
                      >
                        {formatCellValue(row.metrics[col.id], col.format)}
                      </TableCell>
                    ))}
                    {onRowClick && (
                      <TableCell className="text-right">
                        <ArrowRight size={14} className="text-muted-foreground" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* View All / Pagination */}
        {showViewAll && sortedData.length > maxPreviewRows && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">
              Showing {displayData.length} of {sortedData.length} rows
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs h-8"
              onClick={() => {
                if (onViewAll) {
                  onViewAll()
                } else {
                  setShowAll(!showAll)
                }
              }}
            >
              {showAll ? 'Show Less' : 'View All'}
              <ArrowRight size={12} className="ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Simple table for drill drawer
 */
interface DrillTableProps {
  data: Record<string, unknown>[]
  columns: { id: string; label: string; format?: (value: unknown) => string }[]
  onRowClick?: (row: Record<string, unknown>) => void
}

export function DrillTable({ data, columns, onRowClick }: DrillTableProps) {
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {columns.map(col => (
              <TableHead key={col.id} className="text-xs font-semibold">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow 
              key={i}
              className={cn(onRowClick && 'cursor-pointer hover:bg-muted/50')}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(col => (
                <TableCell key={col.id} className="text-sm">
                  {col.format ? col.format(row[col.id]) : String(row[col.id] ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
