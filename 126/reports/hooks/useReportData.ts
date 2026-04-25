/**
 * Report Data Hook
 * Fetches and normalizes data for reports with caching and memoization
 */

import { useMemo } from 'react'
import { useKV } from '@/lib/spark-hooks'
import { useAppointments } from '@/hooks/data/useAppointments'
import { useClients, useAllPets } from '@/hooks/data/useClients'
import { useStaff } from '@/hooks/data/useStaff'
import { useTransactions } from '@/hooks/data/useTransactions'
import { useInventoryItems } from '@/hooks/data/useInventory'
import { usePayrollSettings } from '@/hooks/data/usePayroll'
import { useAllStaffCompensations } from '@/hooks/data/useStaffExtensions'
import { useAppointmentCheckoutMap } from '@/hooks/useAppointmentCheckout'
import { useStore } from '@/contexts/StoreContext'
import { appointmentFromDb } from '@/lib/mappers/appointmentMapper'
import { clientsFromDb } from '@/lib/mappers/clientMapper'
import { staffListFromDb } from '@/lib/mappers/staffMapper'
import { transactionFromDb } from '@/lib/mappers/transactionMapper'
import { inventoryItemsFromDb } from '@/lib/mappers/inventoryMapper'
import { getPayrollPermissions } from '@/lib/payrollPermissions'
import {
  NormalizedDataStore,
  ReportFilters,
} from '../types'
import {
  createNormalizedDataStore,
  generateFilterHash,
} from '../engine/dataNormalization'
import {
  filterAppointments,
  filterTransactions,
  getDateRange,
  getPreviousPeriod,
  measurePerformance,
} from '../engine/analyticsEngine'
import { Appointment, Client, Staff, InventoryItem, Transaction } from '@/lib/types'

/**
 * Hook for accessing normalized report data
 * Handles data fetching, normalization, and caching
 */
export function useReportData(filters: ReportFilters) {
  // Fetch raw data from Supabase hooks
  const { data: dbAppointments } = useAppointments()
  const { data: dbTransactions } = useTransactions()
  const { data: dbStaffMembers } = useStaff()
  const { data: dbClients } = useClients()
  const { data: dbInventory } = useInventoryItems()
  const { data: dbPets } = useAllPets()
  const { data: payrollSettings } = usePayrollSettings()
  const { data: allStaffCompensations } = useAllStaffCompensations()
  const checkoutByAppointmentId = useAppointmentCheckoutMap()

  // Map DB rows to UI types
  const rawAppointments = useMemo<Appointment[]>(() => {
    if (!dbAppointments) return []
    const clientMap = new Map((dbClients ?? []).map(c => [c.id, c]))
    const staffMap = new Map((dbStaffMembers ?? []).map(s => [s.id, s]))
    const petMap = new Map((dbPets ?? []).map(p => [p.id, p]))
    return dbAppointments.map(a => {
      const client = clientMap.get(a.client_id)
      const groomer = a.groomer_id ? staffMap.get(a.groomer_id) : undefined
      const pet = a.pet_id ? petMap.get(a.pet_id) : undefined
      return appointmentFromDb(
        a, undefined,
        client ? `${client.first_name} ${client.last_name}`.trim() : '',
        pet?.name ?? '',
        pet?.breed ?? undefined,
        pet?.weight ?? undefined,
        pet?.weight_category ?? undefined,
        groomer ? `${groomer.first_name} ${groomer.last_name}`.trim() : ''
      )
    })
  }, [dbAppointments, dbClients, dbStaffMembers, dbPets])

  const rawTransactions = useMemo<Transaction[]>(() =>
    dbTransactions ? dbTransactions.map(t => transactionFromDb(t)) : [],
    [dbTransactions]
  )
  const rawStaff = useMemo<Staff[]>(() =>
    dbStaffMembers ? staffListFromDb(dbStaffMembers) : [],
    [dbStaffMembers]
  )
  const rawClients = useMemo<Client[]>(() =>
    dbClients ? clientsFromDb(dbClients, new Map()) : [],
    [dbClients]
  )
  const rawInventory = useMemo<InventoryItem[]>(() =>
    dbInventory ? inventoryItemsFromDb(dbInventory) : [],
    [dbInventory]
  )
  const staffCompensationMap = useMemo(
    () => new Map((allStaffCompensations ?? []).map(compensation => [compensation.staff_id, compensation])),
    [allStaffCompensations]
  )
  
  // Normalize data (memoized)
  const dataStore = useMemo<NormalizedDataStore>(() => {
    return measurePerformance('normalizeData', () => 
      createNormalizedDataStore(
        rawAppointments,
        rawTransactions,
        rawStaff,
        rawClients,
        rawInventory,
        checkoutByAppointmentId,
        staffCompensationMap,
        payrollSettings?.default_commission_rate
      )
    )
  }, [rawAppointments, rawTransactions, rawStaff, rawClients, rawInventory, checkoutByAppointmentId, staffCompensationMap, payrollSettings?.default_commission_rate])
  
  // Filter data based on current filters
  const filteredAppointments = useMemo(() => {
    return measurePerformance('filterAppointments', () =>
      filterAppointments(dataStore.appointments, filters)
    )
  }, [dataStore.appointments, filters])
  
  const filteredTransactions = useMemo(() => {
    return measurePerformance('filterTransactions', () =>
      filterTransactions(dataStore.transactions, filters)
    )
  }, [dataStore.transactions, filters])
  
  // Get previous period data for comparison
  const previousPeriodData = useMemo(() => {
    const { start, end } = getDateRange(filters)
    const { start: prevStart, end: prevEnd } = getPreviousPeriod(start, end)
    
    const previousFilters: ReportFilters = {
      ...filters,
      dateRange: 'custom',
      customDateStart: prevStart.toISOString().split('T')[0],
      customDateEnd: prevEnd.toISOString().split('T')[0],
    }
    
    return {
      appointments: filterAppointments(dataStore.appointments, previousFilters),
      transactions: filterTransactions(dataStore.transactions, previousFilters),
    }
  }, [dataStore.appointments, dataStore.transactions, filters])
  
  // Generate filter hash for cache keys
  const filterHash = useMemo(() => generateFilterHash(filters), [filters])
  
  return {
    // Normalized data store
    dataStore,
    
    // Filtered current period data
    appointments: filteredAppointments,
    transactions: filteredTransactions,
    
    // Previous period data for comparison
    previousAppointments: previousPeriodData.appointments,
    previousTransactions: previousPeriodData.transactions,
    
    // Additional data
    staff: dataStore.staff,
    clients: dataStore.clients,
    inventoryItems: dataStore.inventoryItems,
    messages: dataStore.messages,
    services: dataStore.services,
    
    // Cache key
    filterHash,
    
    // Loading state (for future async data fetching)
    isLoading: false,
    error: null,
  }
}

/**
 * Hook for saved views
 */
export function useSavedViews() {
  const [savedViews, setSavedViews] = useKV<Record<string, {
    id: string
    name: string
    reportType: string
    filters: ReportFilters
    groupBy?: string
    visibleColumns?: string[]
    compareEnabled: boolean
    createdAt: string
    updatedAt: string
  }>>('report-saved-views', {})
  
  const saveView = (view: {
    name: string
    reportType: string
    filters: ReportFilters
    groupBy?: string
    visibleColumns?: string[]
    compareEnabled: boolean
  }) => {
    const id = `view-${Date.now()}`
    const now = new Date().toISOString()
    setSavedViews(prev => ({
      ...prev,
      [id]: {
        ...view,
        id,
        createdAt: now,
        updatedAt: now,
      },
    }))
    return id
  }
  
  const deleteView = (id: string) => {
    setSavedViews(prev => {
      const { [id]: _removed, ...rest } = prev
      return rest
    })
  }
  
  const updateView = (id: string, updates: Partial<typeof savedViews[string]>) => {
    setSavedViews(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    }))
  }
  
  return {
    savedViews: Object.values(savedViews),
    saveView,
    deleteView,
    updateView,
    getView: (id: string) => savedViews[id],
  }
}

/**
 * Hook for report schedules
 */
export function useReportSchedules() {
  const [schedules, setSchedules] = useKV<Record<string, {
    id: string
    savedViewId: string
    frequency: 'daily' | 'weekly' | 'monthly'
    dayOfWeek?: number
    dayOfMonth?: number
    time: string
    recipients: string[]
    enabled: boolean
    createdAt: string
    updatedAt: string
    lastRunAt?: string
  }>>('report-schedules', {})
  
  const createSchedule = (schedule: Omit<typeof schedules[string], 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = `schedule-${Date.now()}`
    const now = new Date().toISOString()
    setSchedules(prev => ({
      ...prev,
      [id]: {
        ...schedule,
        id,
        createdAt: now,
        updatedAt: now,
      },
    }))
    return id
  }
  
  const deleteSchedule = (id: string) => {
    setSchedules(prev => {
      const { [id]: _removed, ...rest } = prev
      return rest
    })
  }
  
  const updateSchedule = (id: string, updates: Partial<typeof schedules[string]>) => {
    setSchedules(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    }))
  }
  
  const markRun = (id: string) => {
    updateSchedule(id, { lastRunAt: new Date().toISOString() })
  }
  
  return {
    schedules: Object.values(schedules),
    createSchedule,
    deleteSchedule,
    updateSchedule,
    markRun,
    getSchedule: (id: string) => schedules[id],
  }
}

/**
 * Hook for user preferences (essentials toggle, etc.)
 */
export function useReportPreferences() {
  const [preferences, setPreferences] = useKV<{
    showEssentialsOnly: boolean
    defaultTimeBasis: string
    favoriteReports: string[]
  }>('report-preferences', {
    showEssentialsOnly: false,
    defaultTimeBasis: 'checkout',
    favoriteReports: [],
  })
  
  const toggleEssentialsOnly = () => {
    setPreferences(prev => ({
      ...prev,
      showEssentialsOnly: !prev.showEssentialsOnly,
    }))
  }
  
  const toggleFavorite = (reportId: string) => {
    setPreferences(prev => ({
      ...prev,
      favoriteReports: prev.favoriteReports.includes(reportId)
        ? prev.favoriteReports.filter(id => id !== reportId)
        : [...prev.favoriteReports, reportId],
    }))
  }
  
  return {
    preferences,
    toggleEssentialsOnly,
    toggleFavorite,
    setPreferences,
  }
}

/**
 * Hook for user permissions
 * Provides role-based access control for reports
 */
export function useUserPermissions() {
  const { role } = useStore()
  const permissions = useMemo(() => getPayrollPermissions(role), [role])

  const hasPermission = (permission: string): boolean => {
    switch (permission) {
      case 'view-payroll':
        return permissions.canViewPayroll
      case 'export-payroll':
        return permissions.canExportPayroll
      case 'view-staff-details':
        return permissions.canViewStaffDetails
      case 'view-finance':
        return permissions.canViewFinance
      case 'manage-schedules':
        return permissions.canManageSchedules
      default:
        return permissions.role === 'admin'
    }
  }
  
  return {
    ...permissions,
    hasPermission,
  }
}
