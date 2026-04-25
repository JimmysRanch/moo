export interface Pet {
  id: string
  name: string
  breed: string
  weight: number
  weightCategory: WeightCategory
  ownerId: string
  birthday?: string
  gender?: string
  mixedBreed?: string
  color?: string
  age?: string
  haircut?: string
  shampoo?: string
  favoriteGroomer?: string
  specialInstructions?: string
  temperament?: string[]
  overallLength?: string
  faceStyle?: string
  skipEarTrim?: boolean
  skipTailTrim?: boolean
  desiredStylePhoto?: string
  groomingNotes?: string
  isActive?: boolean
}

export interface Client {
  id: string
  name: string
  email: string
  phone: string
  pets: Pet[]
  createdAt?: string
  firstName?: string
  lastName?: string
  lastVisit?: string
  nextVisit?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zip?: string
  }
  referralSource?: string
}

export const WEIGHT_PRICING_KEYS = ['small', 'medium', 'large', 'giant', 'xxlarge'] as const

export type WeightCategory = typeof WEIGHT_PRICING_KEYS[number]

export const WEIGHT_CATEGORY_LABELS: Record<WeightCategory, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  giant: 'X-Large',
  xxlarge: 'XX-Large',
}

export interface ServicePricing {
  small: number
  medium: number
  large: number
  giant: number
  xxlarge: number
}

export interface MainService {
  id: string
  name: string
  description: string
  pricing: ServicePricing
  estimatedDurationMinutes: number
}

export interface AddOn {
  id: string
  name: string
  price?: number
  pricing?: ServicePricing
  hasSizePricing: boolean
  estimatedDurationMinutes: number
}

export interface AppointmentService {
  serviceId: string
  serviceName: string
  price: number
  type: 'main' | 'addon'
}

export interface Appointment {
  id: string
  clientId: string
  clientName: string
  petId: string
  petName: string
  petBreed?: string
  petWeight: number
  petWeightCategory: WeightCategory
  groomerId: string
  groomerName: string
  groomerRequested: boolean
  date: string
  startTime: string
  endTime: string
  services: AppointmentService[]
  totalPrice: number
  status: 'scheduled' | 'checked_in' | 'in_progress' | 'ready' | 'picked_up' | 'cancelled' | 'no_show'
  tipAmount?: number
  tipPaymentMethod?: 'cash' | 'card'
  notes?: string
  groomingPreferences?: {
    overallLength?: string
    faceStyle?: string
    skipEarTrim?: boolean
    skipTailTrim?: boolean
    groomingNotes?: string
    handlingNotes?: string[]
    sensitiveAreas?: string[]
    photoWant?: string | null
    photoDontWant?: string | null
  }
  // Workflow state
  isLate: boolean
  checkedInAt?: string | null
  inProgressAt?: string | null
  readyAt?: string | null
  pickedUpAt?: string | null
  // Notification metadata
  clientNotifiedAt?: string | null
  notificationType?: 'manual_heads_up' | 'ready_pickup' | null
  createdAt: string
  updatedAt: string
}



export interface MessageConversationSummary {
  id: string
  clientId: string
  appointmentId?: string | null
  assignedStaffId?: string | null
  unreadCount: number
  status: 'active' | 'archived'
  lastMessagePreview?: string | null
  lastMessageAt?: string | null
  lastMessageDirection?: 'inbound' | 'outbound' | 'system' | null
  lastMessageStatus?: 'draft' | 'queued' | 'sent' | 'delivered' | 'failed' | 'received' | null
}

export interface MessageThreadItem {
  id: string
  conversationId: string
  clientId: string
  appointmentId?: string | null
  staffId?: string | null
  direction: 'inbound' | 'outbound' | 'system'
  messageType: 'sms' | 'system' | 'template_generated'
  body: string
  deliveryStatus: 'draft' | 'queued' | 'sent' | 'delivered' | 'failed' | 'received'
  isRead: boolean
  isAutomated: boolean
  sentAt?: string | null
  deliveredAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface MessageTemplateDefinition {
  id: string
  name: string
  category: string
  body: string
  isEnabled: boolean
}

export interface Staff {
  id: string
  name: string
  role: string
  email: string
  phone: string
  status: 'Active' | 'On Leave' | 'Inactive'
  isGroomer: boolean
  isOwner?: boolean
  canTakeAppointments?: boolean
  specialties?: string[]
  hourlyRate?: string
  totalAppointments?: number
  rating?: number
  hireDate?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zip?: string
  }
  emergencyContact?: {
    name?: string
    relation?: string
    phone?: string
  }
  notes?: string
}

export interface InventoryItem {
  id: string
  name: string
  category: 'retail' | 'supply'
  sku: string
  quantity: number
  price: number
  cost: number
  avgUnitCost?: number | null
  inventoryValue?: number
  lastUnitCost?: number | null
  reorderLevel: number
  supplier?: string
  description?: string
  staffCompensationType?: 'fixed' | 'percentage'
  staffCompensationValue?: number
  isActive?: boolean
  updated_at?: string
}

export interface InventoryValueSnapshot {
  id: string
  timestamp: string
  totalValue: number
  retailValue: number
  supplyValue: number
  retailPotentialProfit: number
  itemCount: number
  retailCount: number
  supplyCount: number
}

export interface ReceiveHistoryEntry {
  id: string
  itemId: string
  itemName: string
  timestamp: string
  quantity: number
  totalCost: number
  costPerUnit: number
  action: 'receive'
}

export interface InventoryLedgerEntry {
  id: string
  timestamp: string
  itemId: string
  itemName: string
  change: number
  reason: 'Received' | 'Sale' | 'Refund' | 'Adjustment'
  reference?: string
  user: string
  resultingQuantity: number
}

export interface Transaction {
  id: string
  appointmentId?: string
  date: string
  clientId: string
  clientName: string
  items: TransactionItem[]
  subtotal: number
  discount: number
  discountDescription?: string
  additionalFees: number
  additionalFeesDescription?: string
  total: number
  tipAmount: number
  tipPaymentMethod?: 'cash' | 'card'
  paymentMethod: string
  status: 'pending' | 'completed' | 'refunded' | 'partially-refunded'
  type: 'appointment' | 'retail' | 'mixed'
  // Stripe payment information
  stripePaymentIntentId?: string
  stripeChargeId?: string
  stripePaymentMethod?: 'card-present' | 'manual-entry' | 'online-deposit'
  stripePaymentStatus?: 'succeeded' | 'failed' | 'refunded' | 'partially-refunded'
  stripeRefundAmount?: number
  stripePaymentLinkUrl?: string
}

export interface TransactionItem {
  id: string
  name: string
  type: 'service' | 'product'
  quantity: number
  price: number
  total: number
}

export function getWeightCategory(
  weight: number,
  ranges?: Array<{ min: number; max: number | null }>
): WeightCategory {
  const sortedRanges = (ranges ?? []).slice().sort((a, b) => a.min - b.min)

  if (sortedRanges.length > 0) {
    for (const [index, range] of sortedRanges.entries()) {
      const pricingKey = WEIGHT_PRICING_KEYS[index]
      if (!pricingKey) break
      const matchesRange = weight >= range.min && (range.max === null || weight <= range.max)
      if (matchesRange) return pricingKey
    }

    const lastSupportedRange = sortedRanges[Math.min(sortedRanges.length, WEIGHT_PRICING_KEYS.length) - 1]
    if (lastSupportedRange && weight >= lastSupportedRange.min) {
      return WEIGHT_PRICING_KEYS[Math.min(sortedRanges.length, WEIGHT_PRICING_KEYS.length) - 1]
    }
  }

  if (weight <= 25) return 'small'
  if (weight <= 50) return 'medium'
  if (weight <= 80) return 'large'
  return 'giant'
}

export function getPriceForWeight(pricing: ServicePricing, weightCategory: WeightCategory): number {
  return pricing[weightCategory]
}

export function getWeightCategoryLabel(weightCategory: WeightCategory | string): string {
  return WEIGHT_CATEGORY_LABELS[weightCategory as WeightCategory] ?? weightCategory
}

export function mapWeightRanges(
  ranges?: Array<{ min_weight: number; max_weight: number }>
): Array<{ min: number; max: number | null }> | undefined {
  return ranges?.map((range) => ({
    min: range.min_weight,
    max: range.max_weight === 0 ? null : range.max_weight,
  }))
}
