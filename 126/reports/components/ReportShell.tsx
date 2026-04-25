/**
 * Report Shell Component
 * Main layout component with filter sidebar and header actions
 */

import { useState, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { 
  FunnelSimple,
  FloppyDisk,
  Clock,
  DownloadSimple,
  ShareNetwork,
  Question,
  X,
  CaretDown,
  CalendarBlank,
} from '@phosphor-icons/react'
import { useIsMobile } from '@/hooks/use-mobile'
import { getWeightCategoryLabel } from '@/lib/types'
import { ReportFilters, TimeBasis, DateRangePreset, AppointmentStatus, PetSize, Channel, ClientType, PaymentMethod } from '../types'
import { useReportFilters } from '../hooks/useReportFilters'

interface ReportShellProps {
  title: string
  description?: string
  defaultTimeBasis?: TimeBasis
  children: ReactNode
  onSaveView?: () => void
  onSchedule?: () => void
  onExport?: () => void
  onShare?: () => void
  onShowDefinitions?: () => void
}

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'custom', label: 'Custom Range' },
]

const TIME_BASIS_OPTIONS: { value: TimeBasis; label: string; description: string }[] = [
  { value: 'service', label: 'Service Date', description: 'When the appointment was scheduled' },
  { value: 'checkout', label: 'Checkout Date', description: 'When the client checked out' },
  { value: 'transaction', label: 'Transaction Date', description: 'When payment was settled' },
]

export function ReportShell({
  title,
  description,
  children,
  onSaveView,
  onSchedule,
  onExport,
  onShare,
  onShowDefinitions,
}: ReportShellProps) {
  const isMobile = useIsMobile()
  const { filters, setFilter, resetFilters, setTimeBasis, setDateRange } = useReportFilters()
  const [filtersOpen, setFiltersOpen] = useState(false)
  
  // Count active filters
  const activeFilterCount = [
    filters.staffIds.length > 0,
    filters.serviceIds.length > 0,
    filters.petSizes.length > 0,
    filters.channels.length > 0,
    filters.clientTypes.length > 0,
    filters.appointmentStatuses.length > 1, // Default is ['picked_up']
    filters.paymentMethods.length > 0,
    !filters.includeDiscounts,
    !filters.includeRefunds,
    !filters.includeTips,
    !filters.includeTaxes,
    !filters.includeGiftCardRedemptions,
  ].filter(Boolean).length
  
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Date Range */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          Date Range
        </Label>
        <Select 
          value={filters.dateRange} 
          onValueChange={(v) => setDateRange(v as DateRangePreset)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Time Basis */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          Time Basis
        </Label>
        <Select 
          value={filters.timeBasis} 
          onValueChange={(v) => setTimeBasis(v as TimeBasis)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_BASIS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                <div>
                  <div>{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground">{opt.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Separator />
      
      {/* Appointment Status */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          Appointment Status
        </Label>
        <div className="space-y-1.5">
          {[
            { value: 'picked_up',   label: 'Picked Up' },
            { value: 'ready',       label: 'Ready' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'checked_in',  label: 'Checked In' },
            { value: 'scheduled',   label: 'Scheduled' },
            { value: 'cancelled',   label: 'Cancelled' },
            { value: 'no_show',     label: 'No Show' },
          ].map(({ value: status, label }) => (
            <div key={status} className="flex items-center gap-2">
              <Checkbox 
                id={`status-${status}`}
                checked={filters.appointmentStatuses.includes(status as AppointmentStatus)}
                onCheckedChange={(checked) => {
                  const newStatuses = checked
                    ? [...filters.appointmentStatuses, status as AppointmentStatus]
                    : filters.appointmentStatuses.filter(s => s !== status)
                  setFilter('appointmentStatuses', newStatuses)
                }}
              />
              <Label htmlFor={`status-${status}`} className="text-sm">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Pet Size */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          Pet Size
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          {['small', 'medium', 'large', 'giant', 'xxlarge'].map(size => (
            <div key={size} className="flex items-center gap-2">
              <Checkbox 
                id={`size-${size}`}
                checked={filters.petSizes.includes(size as PetSize)}
                onCheckedChange={(checked) => {
                  const newSizes = checked
                    ? [...filters.petSizes, size as PetSize]
                    : filters.petSizes.filter(s => s !== size)
                  setFilter('petSizes', newSizes)
                }}
              />
              <Label htmlFor={`size-${size}`} className="text-sm">
                {getWeightCategoryLabel(size)}
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Channel */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          Booking Channel
        </Label>
        <div className="space-y-1.5">
          {['walk-in', 'phone', 'online'].map(channel => (
            <div key={channel} className="flex items-center gap-2">
              <Checkbox 
                id={`channel-${channel}`}
                checked={filters.channels.includes(channel as Channel)}
                onCheckedChange={(checked) => {
                  const newChannels = checked
                    ? [...filters.channels, channel as Channel]
                    : filters.channels.filter(c => c !== channel)
                  setFilter('channels', newChannels)
                }}
              />
              <Label htmlFor={`channel-${channel}`} className="text-sm capitalize">
                {channel}
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Client Type */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          Client Type
        </Label>
        <div className="space-y-1.5">
          {['new', 'returning'].map(type => (
            <div key={type} className="flex items-center gap-2">
              <Checkbox 
                id={`type-${type}`}
                checked={filters.clientTypes.includes(type as ClientType)}
                onCheckedChange={(checked) => {
                  const newTypes = checked
                    ? [...filters.clientTypes, type as ClientType]
                    : filters.clientTypes.filter(t => t !== type)
                  setFilter('clientTypes', newTypes)
                }}
              />
              <Label htmlFor={`type-${type}`} className="text-sm capitalize">
                {type}
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Payment Method */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          Payment Method
        </Label>
        <div className="space-y-1.5">
          {['card', 'cash', 'other'].map(method => (
            <div key={method} className="flex items-center gap-2">
              <Checkbox 
                id={`method-${method}`}
                checked={filters.paymentMethods.includes(method as PaymentMethod)}
                onCheckedChange={(checked) => {
                  const newMethods = checked
                    ? [...filters.paymentMethods, method as PaymentMethod]
                    : filters.paymentMethods.filter(m => m !== method)
                  setFilter('paymentMethods', newMethods)
                }}
              />
              <Label htmlFor={`method-${method}`} className="text-sm capitalize">
                {method}
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      <Separator />
      
      {/* Include/Exclude Toggles */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          Include in Calculations
        </Label>
        <div className="space-y-1.5">
          {[
            { key: 'includeDiscounts', label: 'Discounts' },
            { key: 'includeRefunds', label: 'Refunds' },
            { key: 'includeTips', label: 'Tips' },
            { key: 'includeTaxes', label: 'Taxes' },
            { key: 'includeGiftCardRedemptions', label: 'Gift Card Redemptions' },
          ].map(toggle => (
            <div key={toggle.key} className="flex items-center gap-2">
              <Checkbox 
                id={toggle.key}
                checked={filters[toggle.key as keyof ReportFilters] as boolean}
                onCheckedChange={(checked) => 
                  setFilter(toggle.key as keyof ReportFilters, checked as boolean)
                }
              />
              <Label htmlFor={toggle.key} className="text-sm">
                {toggle.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Clear All */}
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full"
        onClick={resetFilters}
      >
        <X size={14} className="mr-1" />
        Clear All Filters
      </Button>
    </div>
  )
  
  return (
    <div className="min-h-full bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Range Badge */}
              <Badge variant="outline" className="text-xs">
                <CalendarBlank size={12} className="mr-1" />
                {DATE_RANGE_OPTIONS.find(o => o.value === filters.dateRange)?.label}
              </Badge>
              
              {/* Time Basis Badge */}
              <Badge variant="outline" className="text-xs">
                <Clock size={12} className="mr-1" />
                {TIME_BASIS_OPTIONS.find(o => o.value === filters.timeBasis)?.label}
              </Badge>
              
              {/* Filters Button (Mobile) */}
              {isMobile ? (
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="relative">
                      <FunnelSimple size={14} className="mr-1" />
                      Filters
                      {activeFilterCount > 0 && (
                        <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[80vh]">
                    <SheetHeader>
                      <SheetTitle>Filters</SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="h-full pr-4 mt-4">
                      <FilterContent />
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="relative">
                      <FunnelSimple size={14} className="mr-1" />
                      More Filters
                      {activeFilterCount > 0 && (
                        <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                          {activeFilterCount}
                        </Badge>
                      )}
                      <CaretDown size={12} className="ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 p-4">
                    <FilterContent />
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {/* Actions */}
              {onSaveView && (
                <Button variant="outline" size="sm" onClick={onSaveView}>
                  <FloppyDisk size={14} className="mr-1" />
                  Save View
                </Button>
              )}
              
              {onSchedule && (
                <Button variant="outline" size="sm" onClick={onSchedule}>
                  <Clock size={14} className="mr-1" />
                  Schedule
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <DownloadSimple size={14} className="mr-1" />
                    Export
                    <CaretDown size={12} className="ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onExport}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onExport}>
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onShare}>
                    <ShareNetwork size={14} className="mr-2" />
                    Share
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {onShowDefinitions && (
                <Button variant="ghost" size="sm" onClick={onShowDefinitions}>
                  <Question size={14} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 max-w-[1600px] mx-auto w-full p-4">
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  )
}
