/**
 * Report Filter Hooks
 * Manages global filter state with URL persistence and localStorage fallback
 */

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useKV } from '@/lib/spark-hooks'
import {
  ReportFilters,
  TimeBasis,
  DateRangePreset,
} from '../types'

const DEFAULT_FILTERS: ReportFilters = {
  dateRange: 'last30',
  timeBasis: 'checkout',
  staffIds: [],
  serviceIds: [],
  serviceCategories: [],
  petSizes: [],
  channels: [],
  clientTypes: [],
  appointmentStatuses: ['picked_up'],
  paymentMethods: [],
  includeDiscounts: true,
  includeRefunds: true,
  includeTips: true,
  includeTaxes: true,
  includeGiftCardRedemptions: true,
}

const FILTER_KEYS = [
  'dateRange', 'customDateStart', 'customDateEnd', 'timeBasis',
  'staffIds', 'serviceIds', 'serviceCategories', 'petSizes',
  'channels', 'clientTypes', 'appointmentStatuses', 'paymentMethods',
  'includeDiscounts', 'includeRefunds', 'includeTips', 'includeTaxes',
  'includeGiftCardRedemptions', 'locationId'
] as const

/**
 * Parse filter value from URL parameter
 */
function parseFilterValue(key: string, value: string | null): unknown {
  if (value === null) return undefined
  
  // Boolean values
  if (['includeDiscounts', 'includeRefunds', 'includeTips', 'includeTaxes', 'includeGiftCardRedemptions'].includes(key)) {
    return value === 'true'
  }
  
  // Array values
  if (['staffIds', 'serviceIds', 'serviceCategories', 'petSizes', 'channels', 'clientTypes', 'appointmentStatuses', 'paymentMethods'].includes(key)) {
    return value ? value.split(',') : []
  }
  
  return value
}

/**
 * Serialize filter value for URL parameter
 */
function serializeFilterValue(key: string, value: unknown): string | null {
  if (value === undefined || value === null) return null
  
  // Array values
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(',') : null
  }
  
  // Boolean values
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  
  return String(value)
}

/**
 * Parse filters from URL search params
 */
function parseFiltersFromURL(searchParams: URLSearchParams): Partial<ReportFilters> {
  const filters: Partial<ReportFilters> = {}
  
  FILTER_KEYS.forEach(key => {
    const value = searchParams.get(key)
    if (value !== null) {
      (filters as Record<string, unknown>)[key] = parseFilterValue(key, value)
    }
  })
  
  return filters
}

/**
 * Convert filters to URL search params
 */
function filtersToURLParams(filters: ReportFilters): Record<string, string> {
  const params: Record<string, string> = {}
  
  FILTER_KEYS.forEach(key => {
    const value = filters[key]
    const defaultValue = DEFAULT_FILTERS[key]
    
    // Only include non-default values
    if (JSON.stringify(value) !== JSON.stringify(defaultValue)) {
      const serialized = serializeFilterValue(key, value)
      if (serialized !== null) {
        params[key] = serialized
      }
    }
  })
  
  return params
}

/**
 * Generate a stable hash for filter state (used for caching)
 */
export function generateFilterHash(filters: ReportFilters): string {
  const sortedKeys = Object.keys(filters).sort() as (keyof ReportFilters)[]
  const values = sortedKeys.map(k => `${k}:${JSON.stringify(filters[k])}`)
  return values.join('|')
}

/**
 * Main filter hook
 * Manages filter state with URL + localStorage persistence
 */
export function useReportFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [storedFilters, setStoredFilters] = useKV<Partial<ReportFilters>>('report-filters', {})
  
  // Merge URL params with localStorage with defaults
  const filters = useMemo<ReportFilters>(() => {
    const urlFilters = parseFiltersFromURL(searchParams)
    return {
      ...DEFAULT_FILTERS,
      ...storedFilters,
      ...urlFilters,
    }
  }, [searchParams, storedFilters])
  
  // Update a single filter
  const setFilter = useCallback(<K extends keyof ReportFilters>(
    key: K,
    value: ReportFilters[K]
  ) => {
    const newFilters = { ...filters, [key]: value }
    
    // Update localStorage
    setStoredFilters(prev => ({ ...prev, [key]: value }))
    
    // Update URL
    const urlParams = filtersToURLParams(newFilters)
    const newSearchParams = new URLSearchParams()
    Object.entries(urlParams).forEach(([k, v]) => newSearchParams.set(k, v))
    setSearchParams(newSearchParams, { replace: true })
  }, [filters, setStoredFilters, setSearchParams])
  
  // Update multiple filters at once
  const setFilters = useCallback((updates: Partial<ReportFilters>) => {
    const newFilters = { ...filters, ...updates }
    
    // Update localStorage
    setStoredFilters(prev => ({ ...prev, ...updates }))
    
    // Update URL
    const urlParams = filtersToURLParams(newFilters)
    const newSearchParams = new URLSearchParams()
    Object.entries(urlParams).forEach(([k, v]) => newSearchParams.set(k, v))
    setSearchParams(newSearchParams, { replace: true })
  }, [filters, setStoredFilters, setSearchParams])
  
  // Reset to defaults
  const resetFilters = useCallback(() => {
    setStoredFilters({})
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setStoredFilters, setSearchParams])
  
  // Set time basis
  const setTimeBasis = useCallback((basis: TimeBasis) => {
    setFilter('timeBasis', basis)
  }, [setFilter])
  
  // Set date range
  const setDateRange = useCallback((range: DateRangePreset, customStart?: string, customEnd?: string) => {
    if (range === 'custom' && customStart && customEnd) {
      setFilters({
        dateRange: range,
        customDateStart: customStart,
        customDateEnd: customEnd,
      })
    } else {
      setFilter('dateRange', range)
    }
  }, [setFilter, setFilters])
  
  // Toggle array filter values
  const toggleArrayFilter = useCallback(<K extends 'staffIds' | 'serviceIds' | 'petSizes' | 'channels' | 'clientTypes' | 'appointmentStatuses' | 'paymentMethods'>(
    key: K,
    value: ReportFilters[K][number]
  ) => {
    const current = filters[key] as string[]
    const newValue = current.includes(value as string)
      ? current.filter(v => v !== value)
      : [...current, value]
    setFilter(key, newValue as ReportFilters[K])
  }, [filters, setFilter])
  
  // Filter hash for caching
  const filterHash = useMemo(() => generateFilterHash(filters), [filters])
  
  return {
    filters,
    setFilter,
    setFilters,
    resetFilters,
    setTimeBasis,
    setDateRange,
    toggleArrayFilter,
    filterHash,
  }
}

/**
 * Hook for getting report-specific default time basis
 */
export function useReportDefaults(reportType: string) {
  const defaultTimeBasis: Record<string, TimeBasis> = {
    'owner-overview': 'checkout',
    'true-profit': 'checkout',
    'sales-summary': 'checkout',
    'finance-reconciliation': 'transaction',
    'appointments-capacity': 'service',
    'no-shows-cancellations': 'service',
    'retention-rebooking': 'service',
    'client-cohorts-ltv': 'service',
    'staff-performance': 'checkout',
    'payroll-compensation': 'checkout',
    'service-mix-pricing': 'checkout',
    'inventory-usage': 'service',
    'marketing-messaging': 'checkout',
    'tips-gratuities': 'checkout',
    'taxes-summary': 'checkout',
  }
  
  return {
    defaultTimeBasis: defaultTimeBasis[reportType] || 'checkout',
  }
}
