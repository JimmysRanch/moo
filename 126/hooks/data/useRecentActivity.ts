import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, isThisWeek, isToday, isYesterday, parseISO } from 'date-fns'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export interface AuditLogEntry {
  id: number
  store_id: string | null
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  actor_id: string | null
  created_at: string
  old_row: Record<string, unknown> | null
  new_row: Record<string, unknown> | null
  changed_keys: string[] | null
  request_id: string | null
}

export interface RecentActivityItem {
  id: string
  type: 'booking' | 'cancellation' | 'pricing' | 'discount' | 'staff'
  category: 'today' | 'yesterday' | 'thisWeek' | 'older'
  description: string
  client: string
  time: string
  createdAt: string
}

export interface RelatedActivityData {
  actorsById?: Map<string, string>
  appointmentsById?: Map<string, { petName?: string; clientName?: string }>
  clientsById?: Map<string, string>
  petsById?: Map<string, string>
}

const RECENT_ACTIVITY_QUERY_KEY = 'recent_activity'

export function titleCaseWords(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function getRowValue(row: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = row?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function toDisplayName(row: Record<string, unknown> | null | undefined): string | null {
  const firstName = getRowValue(row, 'first_name')
  const lastName = getRowValue(row, 'last_name')
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

  if (fullName) return fullName

  return (
    getRowValue(row, 'name') ??
    getRowValue(row, 'title') ??
    getRowValue(row, 'description')
  )
}

export function humanizeTableName(tableName: string): string {
  return titleCaseWords(tableName)
}

function titleCaseStatus(status: string | null): string | null {
  if (!status) return null
  return titleCaseWords(status)
}

function getActivityCategory(createdAt: string): RecentActivityItem['category'] {
  const date = parseISO(createdAt)

  if (isToday(date)) return 'today'
  if (isYesterday(date)) return 'yesterday'
  if (isThisWeek(date, { weekStartsOn: 1 })) return 'thisWeek'
  return 'older'
}

function getActivityType(entry: AuditLogEntry): RecentActivityItem['type'] {
  const row = entry.new_row ?? entry.old_row
  const nextStatus = getRowValue(entry.new_row, 'status')
  const previousStatus = getRowValue(entry.old_row, 'status')
  const changedStatus = previousStatus !== nextStatus

  if (
    entry.table_name === 'appointments' &&
    (entry.action === 'DELETE' || (changedStatus && nextStatus === 'cancelled'))
  ) {
    return 'cancellation'
  }

  if (entry.table_name === 'appointments') return 'booking'

  if (
    ['transactions', 'payment_records', 'expenses', 'payroll_settings', 'payroll_periods'].includes(entry.table_name)
  ) {
    return 'pricing'
  }

  if (['services', 'inventory_items', 'inventory_ledger'].includes(entry.table_name)) {
    return 'discount'
  }

  if (entry.table_name === 'staff') return 'staff'

  if (getRowValue(row, 'status')) return 'staff'

  return 'staff'
}

export function getActorLabel(entry: AuditLogEntry, related: RelatedActivityData): string {
  if (entry.actor_id) {
    const actorName = related.actorsById?.get(entry.actor_id)
    if (actorName) return `By ${actorName}`
  }

  return 'Store activity'
}

function getAppointmentLabel(entry: AuditLogEntry, related: RelatedActivityData): string | null {
  const appointment = related.appointmentsById?.get(entry.record_id)
  if (appointment?.petName) return appointment.petName

  const row = entry.new_row ?? entry.old_row
  const petId = getRowValue(row, 'pet_id')
  if (petId) {
    const petName = related.petsById?.get(petId)
    if (petName) return petName
  }

  return null
}

function getClientLabel(entry: AuditLogEntry, related: RelatedActivityData): string | null {
  const appointment = related.appointmentsById?.get(entry.record_id)
  if (appointment?.clientName) return appointment.clientName

  const row = entry.new_row ?? entry.old_row
  const clientId = getRowValue(row, 'client_id')
  if (clientId) {
    const clientName = related.clientsById?.get(clientId)
    if (clientName) return clientName
  }

  return toDisplayName(row)
}

export function getActivityDescription(entry: AuditLogEntry, related: RelatedActivityData): string {
  const row = entry.new_row ?? entry.old_row
  const subjectName = toDisplayName(row)
  const nextStatus = getRowValue(entry.new_row, 'status')
  const changedKeys = entry.changed_keys ?? []

  if (entry.table_name === 'appointments') {
    const petName = getAppointmentLabel(entry, related)
    const subject = petName ? ` for ${petName}` : ''

    if (entry.action === 'INSERT') return `Created appointment${subject}`
    if (entry.action === 'DELETE') return `Deleted appointment${subject}`
    if (changedKeys.includes('status')) {
      return `${titleCaseStatus(nextStatus) ?? 'Updated'} appointment${subject}`
    }
    return `Updated appointment${subject}`
  }

  if (entry.table_name === 'staff') {
    const subject = subjectName ? ` ${subjectName}` : ''

    if (entry.action === 'INSERT') return `Added staff member${subject}`
    if (entry.action === 'DELETE') return `Removed staff member${subject}`
    if (changedKeys.includes('status') && nextStatus) {
      return `Updated ${subjectName ?? 'staff member'} to ${titleCaseStatus(nextStatus)}`
    }
    return `Updated staff member${subject}`
  }

  if (entry.table_name === 'clients') {
    const subject = subjectName ? ` ${subjectName}` : ''
    if (entry.action === 'INSERT') return `Added client${subject}`
    if (entry.action === 'DELETE') return `Removed client${subject}`
    return `Updated client${subject}`
  }

  if (entry.table_name === 'pets') {
    const subject = subjectName ? ` ${subjectName}` : ''
    if (entry.action === 'INSERT') return `Added pet${subject}`
    if (entry.action === 'DELETE') return `Removed pet${subject}`
    return `Updated pet${subject}`
  }

  if (entry.table_name === 'transactions' || entry.table_name === 'payment_records') {
    const clientName = getClientLabel(entry, related)
    return clientName ? `Recorded payment for ${clientName}` : 'Recorded payment'
  }

  if (entry.table_name === 'expenses') {
    return subjectName ? `Logged expense ${subjectName}` : 'Logged expense'
  }

  if (entry.table_name === 'services') {
    return subjectName ? `Updated service ${subjectName}` : 'Updated services'
  }

  if (entry.table_name === 'inventory_items') {
    return subjectName ? `Updated inventory item ${subjectName}` : 'Updated inventory'
  }

  if (entry.table_name === 'inventory_ledger') {
    return 'Recorded inventory activity'
  }

  if (entry.table_name === 'payroll_settings') {
    return 'Updated payroll settings'
  }

  if (entry.table_name === 'payroll_periods') {
    return 'Updated payroll period'
  }

  const verb = entry.action === 'INSERT' ? 'Created' : entry.action === 'DELETE' ? 'Deleted' : 'Updated'
  return `${verb} ${humanizeTableName(entry.table_name)}`
}

export function buildRecentActivityFromAuditLog(
  logs: AuditLogEntry[],
  related: RelatedActivityData = {}
): RecentActivityItem[] {
  return logs
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((entry) => ({
      id: `audit-${entry.id}`,
      type: getActivityType(entry),
      category: getActivityCategory(entry.created_at),
      description: getActivityDescription(entry, related),
      client: getActorLabel(entry, related),
      time: formatDistanceToNow(parseISO(entry.created_at), { addSuffix: true }),
      createdAt: entry.created_at,
    }))
}

export function useRecentActivity(options?: { limit?: number }) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [RECENT_ACTIVITY_QUERY_KEY, storeId, options?.limit ?? null],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')

      let query = supabase
        .from('audit_log')
        .select('id, store_id, table_name, record_id, action, actor_id, created_at, old_row, new_row, changed_keys, request_id')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })

      if (typeof options?.limit === 'number') {
        query = query.limit(options.limit)
      }

      const { data, error } = await query

      if (error) throw error
      return (data ?? []) as AuditLogEntry[]
    },
    enabled: !!storeId && !!user,
    meta: {
      onError: () => {},
    },
  })
}
