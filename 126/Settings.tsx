import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash, PencilSimple, CaretUp, CaretDown, ArrowSquareOut, WifiHigh, CreditCard } from "@phosphor-icons/react"
import { toast } from "sonner"
import { NotificationSettingsTab } from "@/components/NotificationSettingsTab"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { type PayPeriodType, type PayPeriodSettings } from "@/lib/payroll-utils"
import { useAppearance, type AppearanceTheme, type AppearanceUi } from "@/hooks/useAppearance"
import { useStripeStatus } from "@/hooks/useStripeStatus"
import { format, addDays, nextFriday, startOfDay, addWeeks } from 'date-fns'
import { getTodayDateInBusinessTimezone, parseDateStringAsLocal, formatDateString } from "@/lib/date-utils"
import { useStaffPositions, useCreateStaffPosition, useDeleteStaffPosition, useTemperamentOptions, useCreateTemperamentOption, useDeleteTemperamentOption, useDogBreeds, useCreateDogBreed, useBulkCreateDogBreeds, useDeleteDogBreed, useUpdateDogBreed, useWeightRanges, useCreateWeightRange, useUpdateWeightRange, useDeleteWeightRange, usePaymentMethodConfigs, useCreatePaymentMethodConfig, useUpdatePaymentMethodConfig, useBusinessSettings, useCreateBusinessSettings, useUpdateBusinessSettings } from '@/hooks/data/useBusinessSettings'
import { useServices, useCreateService, useUpdateService, useDeleteService, useReorderServices, type Service } from '@/hooks/data/useServices'
import { usePayrollSettings, useUpsertPayrollSettings } from '@/hooks/data/usePayroll'
import { businessSettingsFromDb, businessSettingsToDb, type BookingRules, type BusinessInfo, type HoursOfOperation } from '@/lib/mappers/businessSettingsMapper'
import { DEFAULT_HOURS_OF_OPERATION } from '@/lib/business-hours'
import { payrollSettingsFromDb, payrollSettingsToDb } from '@/lib/mappers/payrollMapper'
import { serviceToMainService, serviceToAddOn, mainServiceToDb, addOnToDb } from '@/lib/mappers/serviceMapper'
import { DOG_BREEDS } from '@/lib/breeds'
import { WEIGHT_PRICING_KEYS } from '@/lib/types'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { LogsSettingsTab } from '@/components/LogsSettingsTab'
import { MessagesSettingsTab } from '@/components/messages/MessagesSettingsTab'
import { supabase } from '@/lib/supabase'
import { postJSON } from '@/stripe/api'
import { DEFAULT_SALES_TAX_SETTINGS, normalizeSalesTaxSettings, type SalesTaxSettings } from '@/lib/salesTax'
import { getPayrollPermissions } from '@/lib/payrollPermissions'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { getChangedServiceOrders, getOrderedServicesByType, swapServiceDisplayOrder } from '@/lib/serviceOrder'
import { isRLSError } from '@/lib/errorHandling'
import { StripeConnectProvider } from '@/stripe/connect'
import { ConnectAccountManagement, ConnectAccountOnboarding, ConnectDocuments, ConnectNotificationBanner } from '@stripe/react-connect-js'
import { paymentClient } from '@/stripe/client'

interface WeightRange {
  id: string
  pricingKey: string
  name: string
  min: number
  max: number | null
}

interface ServicePricing {
  [key: string]: number
}

interface BreedPricing {
  breedName: string
  price: number
}

interface MainService {
  id: string
  name: string
  description: string
  pricing: ServicePricing
  pricingStrategy: 'weight' | 'breed' | 'mixed'
  breedPricing?: BreedPricing[]
  estimatedDurationMinutes: number
}

interface AddOn {
  id: string
  name: string
  price?: number
  pricing?: ServicePricing
  hasSizePricing: boolean
  estimatedDurationMinutes: number
}

const DEFAULT_WEIGHT_RANGES: WeightRange[] = [
  { id: 'small', pricingKey: 'small', name: 'Small', min: 1, max: 25 },
  { id: 'medium', pricingKey: 'medium', name: 'Medium', min: 26, max: 50 },
  { id: 'large', pricingKey: 'large', name: 'Large', min: 51, max: 80 },
  { id: 'giant', pricingKey: 'giant', name: 'X-Large', min: 81, max: null }
]

const DEFAULT_MAIN_SERVICES: MainService[] = [
  {
    id: "fresh-bath",
    name: "Fresh Bath",
    description: "Includes Shampoo, Blow Out, Brush Out, Ear Cleaning, Nail Trim",
    pricing: { small: 45, medium: 55, large: 65, giant: 75 },
    pricingStrategy: 'weight',
    estimatedDurationMinutes: 60
  },
  {
    id: "trim-up",
    name: "Trim Up",
    description: "Bath + Trim Up: Round Out Paws, Neaten Face, Sanitary Trim",
    pricing: { small: 50, medium: 60, large: 70, giant: 80 },
    pricingStrategy: 'weight',
    estimatedDurationMinutes: 60
  },
  {
    id: "deluxe-groom",
    name: "Deluxe Groom",
    description: "Bath + Trim Up + Custom Haircut",
    pricing: { small: 70, medium: 80, large: 90, giant: 100 },
    pricingStrategy: 'weight',
    estimatedDurationMinutes: 90
  }
]

const DEFAULT_ADDONS: AddOn[] = [
  { id: "conditioning", name: "Conditioning Treatment with Massage", price: 20, hasSizePricing: false, estimatedDurationMinutes: 15 },
  { id: "paw-pad", name: "Paw Pad Cream", price: 10, hasSizePricing: false, estimatedDurationMinutes: 10 },
  { id: "teeth", name: "Teeth Brushing", price: 20, hasSizePricing: false, estimatedDurationMinutes: 10 },
  { id: "blueberry", name: "Blueberry Facial", price: 20, hasSizePricing: false, estimatedDurationMinutes: 10 },
  { id: "nail-trim", name: "Nail Trim", price: 15, hasSizePricing: false, estimatedDurationMinutes: 10 },
  { id: "deshedding", name: "Deshedding", pricing: { small: 20, medium: 25, large: 30, giant: 40 }, hasSizePricing: true, estimatedDurationMinutes: 20 }
]

const DEFAULT_PAYMENT_METHODS = [
  { id: "cash", name: "Cash", enabled: true },
  { id: "card", name: "Card", enabled: false },
]

const normalizePosPaymentMethod = (methodName: string): "cash" | "card" | null => {
  const normalized = methodName.trim().toLowerCase()
  if (normalized.includes("cash")) return "cash"
  if (normalized.includes("card") || normalized.includes("credit") || normalized.includes("debit")) return "card"
  return null
}

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Arizona Time (MT - No DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Puerto_Rico", label: "Atlantic Time (AST)" }
]

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" }
]

const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  companyName: "",
  businessPhone: "",
  businessEmail: "",
  address: "",
  city: "",
  state: "TX",
  zipCode: "",
  timezone: "America/New_York",
  website: "",
  hoursOfOperation: DEFAULT_HOURS_OF_OPERATION,
  bookingRules: {
    allowConcurrentAppointments: false,
    maxAppointmentsPerSlot: 1,
  },
}

const DEFAULT_BIWEEKLY_SETTINGS: PayPeriodSettings = {
  type: 'bi-weekly',
  anchorStartDate: '2024-12-30',
  anchorEndDate: '2025-01-12',
  anchorPayDate: '2025-01-17'
}

const DEFAULT_WEEKLY_SETTINGS: PayPeriodSettings = {
  type: 'weekly',
  anchorStartDate: '2024-12-30',
  anchorEndDate: '2025-01-05',
  anchorPayDate: '2025-01-10'
}

function defaultTerminalSimulatedMode() {
  return typeof window !== 'undefined' && window.location.hostname === 'localhost'
}

export function Settings() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { selectedTheme, selectedUi, setSelectedTheme, setSelectedUi } = useAppearance()
  const { status: stripeStatus, fetchStatus: fetchStripeStatus } = useStripeStatus()
  const { user } = useAuth()
  const { storeId, stores, setActiveStoreId, role } = useStore()
  const [switching, setSwitching] = useState(false)
  const seedingRef = useRef<Record<string, boolean>>({})

  const isAppOwner =
    !!import.meta.env.VITE_APP_OWNER_USER_ID &&
    user?.id === import.meta.env.VITE_APP_OWNER_USER_ID
  const {
    data: isPlatformAdmin,
    isLoading: isPlatformAdminLoading,
    isError: isPlatformAdminError,
  } = useQuery({
    queryKey: ['is_platform_admin', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_platform_admin')
      if (error) {
        console.warn('Failed to resolve platform admin status for Settings logs tab', error)
        return false
      }
      return data === true
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  })
  const canViewLogs = isAppOwner || isPlatformAdmin === true
  const showLogsTabPlaceholder = !!user && !canViewLogs && (isPlatformAdminLoading || isPlatformAdminError)
  useEffect(() => {
    fetchStripeStatus();
  }, [fetchStripeStatus]);

  const [activeTab, setActiveTab] = useState("business")
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string
  const [onboardingAccountId, setOnboardingAccountId] = useState<string | null>(null)
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [onboardingError, setOnboardingError] = useState<string | null>(null)
  const [onboardingTimeout, setOnboardingTimeout] = useState(false)
  const [documentsWarning, setDocumentsWarning] = useState<string | null>(null)
  const canManageCardSetup = role === 'owner' || role === 'admin'
  const SETTINGS_TABS = useMemo(
    () => new Set(["store", "business", "services", "pets", "notifications", "messages", "pos", "appearance", "card", "dev-pages", "logs"]),
    []
  )

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    if (!tab) return
    const normalizedTab = tab === "onboarding" ? "card" : tab
    if (SETTINGS_TABS.has(normalizedTab)) {
      setActiveTab(normalizedTab)
    }
  }, [SETTINGS_TABS, location.search])

  const initializeEmbeddedOnboarding = useCallback(async () => {
    if (!publishableKey || !canManageCardSetup) return
    setOnboardingLoading(true)
    setOnboardingError(null)
    setOnboardingTimeout(false)
    setDocumentsWarning(null)

    try {
      if (stripeStatus?.stripe_account_id) {
        setOnboardingAccountId(stripeStatus.stripe_account_id)
        return
      }

      const status = await Promise.race([
        paymentClient.stripeStatus(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timed out while loading Stripe status')), 15000)
        }),
      ])

      if (status.stripe_account_id) {
        setOnboardingAccountId(status.stripe_account_id)
        return
      }

      const created = await Promise.race([
        paymentClient.ensureConnectAccount("US"),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timed out while creating Stripe account')), 15000)
        }),
      ])
      setOnboardingAccountId(created.connectedAccountId)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load Stripe onboarding"
      setOnboardingError(message)
      if (message.toLowerCase().includes('timed out')) {
        setOnboardingTimeout(true)
      }
    } finally {
      setOnboardingLoading(false)
    }
  }, [canManageCardSetup, publishableKey, stripeStatus?.stripe_account_id])

  useEffect(() => {
    setOnboardingAccountId(null)
    setOnboardingError(null)
    setOnboardingLoading(false)
    setOnboardingTimeout(false)
  }, [storeId])

  useEffect(() => {
    if (activeTab !== 'card' || !publishableKey || onboardingAccountId || onboardingLoading || !canManageCardSetup) return
    void initializeEmbeddedOnboarding()
  }, [activeTab, canManageCardSetup, initializeEmbeddedOnboarding, onboardingAccountId, onboardingLoading, publishableKey])

  const { data: staffPositionsDb } = useStaffPositions()
  const createStaffPositionMut = useCreateStaffPosition()
  const deleteStaffPositionMut = useDeleteStaffPosition()
  const staffPositions = useMemo(() =>
    staffPositionsDb?.map(p => p.position_name) ?? ["Owner", "Groomer", "Front Desk", "Bather"],
    [staffPositionsDb]
  )
  const staffPositionsDbList = staffPositionsDb ?? []

  const [newPosition, setNewPosition] = useState("")
  const [editingPosition, setEditingPosition] = useState<string | null>(null)
  const [editPositionValue, setEditPositionValue] = useState("")

  const { data: dogBreedsDb } = useDogBreeds()
  const createDogBreedMut = useCreateDogBreed()
  const bulkCreateDogBreedsMut = useBulkCreateDogBreeds()
  const deleteDogBreedMut = useDeleteDogBreed()
  const updateDogBreedMut = useUpdateDogBreed()
  const dogBreeds = useMemo(() =>
    dogBreedsDb?.map((breed) => breed.breed_name) ?? [],
    [dogBreedsDb]
  )
  const displayDogBreeds = useMemo(() =>
    dogBreeds.length > 0 ? dogBreeds : DOG_BREEDS,
    [dogBreeds]
  )
  const dogBreedsDbList = dogBreedsDb ?? []

  const [newDogBreed, setNewDogBreed] = useState("")
  const [editingDogBreed, setEditingDogBreed] = useState<string | null>(null)
  const [editDogBreedValue, setEditDogBreedValue] = useState("")
  const [dogBreedListExpanded, setDogBreedListExpanded] = useState(false)

  const { data: temperamentOptionsDb } = useTemperamentOptions()
  const createTemperamentOptionMut = useCreateTemperamentOption()
  const deleteTemperamentOptionMut = useDeleteTemperamentOption()
  const temperamentOptions = useMemo(() =>
    temperamentOptionsDb?.map(t => t.option_name) ?? ["Friendly", "Energetic", "Calm", "Nervous", "Aggressive", "Playful", "Shy", "Loves treats"],
    [temperamentOptionsDb]
  )
  const temperamentOptionsDbList = temperamentOptionsDb ?? []

  const [newTemperament, setNewTemperament] = useState("")
  const [editingTemperament, setEditingTemperament] = useState<string | null>(null)
  const [editTemperamentValue, setEditTemperamentValue] = useState("")

  const { data: servicesDb } = useServices()
  const createServiceMut = useCreateService()
  const updateServiceMut = useUpdateService()
  const reorderServicesMut = useReorderServices()
  const deleteServiceMut = useDeleteService()
  const mainServicesDbList = useMemo(
    () => getOrderedServicesByType(servicesDb ?? [], 'main'),
    [servicesDb]
  )
  const addOnsDbList = useMemo(
    () => getOrderedServicesByType(servicesDb ?? [], 'addon'),
    [servicesDb]
  )
  const mainServices: MainService[] = useMemo(() => {
    if (!servicesDb) return DEFAULT_MAIN_SERVICES
    const mapped = mainServicesDbList.map(s => {
      const base = serviceToMainService(s)
      return {
        id: base.id,
        name: base.name,
        description: base.description,
        pricing: base.pricing as unknown as ServicePricing,
        pricingStrategy: 'weight' as const,
        estimatedDurationMinutes: base.estimatedDurationMinutes,
      }
    })
    return mapped.length > 0 ? mapped : DEFAULT_MAIN_SERVICES
  }, [mainServicesDbList, servicesDb])

  const addOns: AddOn[] = useMemo(() => {
    if (!servicesDb) return DEFAULT_ADDONS
    const mapped = addOnsDbList.map(s => {
      const base = serviceToAddOn(s)
      return {
        id: base.id,
        name: base.name,
        hasSizePricing: base.hasSizePricing,
        ...(base.hasSizePricing
          ? { pricing: base.pricing as unknown as ServicePricing }
          : { price: base.price }),
        estimatedDurationMinutes: base.estimatedDurationMinutes,
      } as AddOn
    })
    return mapped.length > 0 ? mapped : DEFAULT_ADDONS
  }, [addOnsDbList, servicesDb])

  const { data: weightRangesDb } = useWeightRanges()
  const createWeightRangeMut = useCreateWeightRange()
  const updateWeightRangeMut = useUpdateWeightRange()
  const deleteWeightRangeMut = useDeleteWeightRange()
  const weightRanges: WeightRange[] = useMemo(() => {
    if (!weightRangesDb) return DEFAULT_WEIGHT_RANGES
    const mapped = weightRangesDb.map((wr, index) => ({
      id: wr.id,
      pricingKey: WEIGHT_PRICING_KEYS[index] ?? `unsupported-${index}`,
      name: wr.category,
      min: wr.min_weight,
      max: wr.max_weight === 0 ? null : wr.max_weight,
    }))
    return mapped.length > 0 ? mapped : DEFAULT_WEIGHT_RANGES
  }, [weightRangesDb])

  const [editingWeightRangeId, setEditingWeightRangeId] = useState<string | null>(null)
  const [editWeightRangeForm, setEditWeightRangeForm] = useState({
    name: "",
    min: "",
    max: ""
  })
  
  const [weightRangeDialogOpen, setWeightRangeDialogOpen] = useState(false)

  const displayWeightRanges = useMemo(() => {
    if (editingWeightRangeId?.startsWith('new-')) {
      const nextPricingKey = WEIGHT_PRICING_KEYS[weightRanges.length]
      if (!nextPricingKey) return weightRanges
      return [...weightRanges, { id: editingWeightRangeId, pricingKey: nextPricingKey, name: '', min: 0, max: null }]
    }
    return weightRanges
  }, [weightRanges, editingWeightRangeId])

  const { data: paymentMethodsDb } = usePaymentMethodConfigs()
  const createPaymentMethodMut = useCreatePaymentMethodConfig()
  const updatePaymentMethodMut = useUpdatePaymentMethodConfig()
  const cashPaymentMethod = useMemo(
    () => paymentMethodsDb?.find((pm) => normalizePosPaymentMethod(pm.method_name) === "cash"),
    [paymentMethodsDb],
  )
  const cardPaymentMethod = useMemo(
    () => paymentMethodsDb?.find((pm) => normalizePosPaymentMethod(pm.method_name) === "card"),
    [paymentMethodsDb],
  )

  // POS Settings state (backend-backed)
  const [posSettings, setPosSettings] = useState<{
    accept_cards?: boolean;
    tap_to_pay_enabled?: boolean;
    manual_card_entry_enabled?: boolean;
    online_payment_links_enabled?: boolean;
    tipping_enabled?: boolean;
    tipPresets?: number[];
    receipt_email_enabled?: boolean;
    receipt_print_enabled?: boolean;
    receipt_default_method?: string;
    terminal_location_id?: string;
    terminal_simulated_mode?: boolean;
    connected_reader_id?: string;
    connected_reader_label?: string;
    cash_drawer_enabled?: boolean;
    printer_enabled?: boolean;
    dev_role?: string;
    sales_tax?: SalesTaxSettings;
  }>({})
  const [posSettingsSaving, setPosSettingsSaving] = useState(false)
  const [_posSettingsLoading, setPosSettingsLoading] = useState(true)
  const [salesTaxDraft, setSalesTaxDraft] = useState<SalesTaxSettings>(DEFAULT_SALES_TAX_SETTINGS)
  const [editingTipPresets, setEditingTipPresets] = useState<number[]>([10, 15, 20])
  const [newTipPreset, setNewTipPreset] = useState("")
  const [readerStatus, setReaderStatus] = useState<string>("idle")
  const [discoveredReaders, setDiscoveredReaders] = useState<Array<{id: string; label: string; serial_number?: string; device_type?: string; status?: string}>>([])
  const [showAdvancedTerminalLocation, setShowAdvancedTerminalLocation] = useState<boolean>(false)
  const [terminalInstance, setTerminalInstance] = useState<unknown>(null)

  const [mainServiceDialogOpen, setMainServiceDialogOpen] = useState(false)
  const [addOnDialogOpen, setAddOnDialogOpen] = useState(false)
  const [editingMainService, setEditingMainService] = useState<MainService | null>(null)
  const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null)
  
  const [mainServiceForm, setMainServiceForm] = useState({
    name: "",
    description: "",
    pricingStrategy: "weight" as 'weight' | 'breed' | 'mixed',
    pricing: {} as Record<string, string>,
    breedPricing: [] as BreedPricing[],
    estimatedDurationMinutes: "60"
  })
  
  const [addOnForm, setAddOnForm] = useState({
    name: "",
    hasSizePricing: "false",
    price: "",
    pricing: {} as Record<string, string>,
    estimatedDurationMinutes: "15"
  })
  
  const { data: businessSettingsDb } = useBusinessSettings()
  const createBusinessSettingsMut = useCreateBusinessSettings()
  const updateBusinessSettingsMut = useUpdateBusinessSettings()
  const businessInfo = useMemo(() => {
    if (!businessSettingsDb) return DEFAULT_BUSINESS_INFO
    const mapped = businessSettingsFromDb(businessSettingsDb)
    return {
      ...mapped,
      hoursOfOperation: mapped.hoursOfOperation || DEFAULT_HOURS_OF_OPERATION,
      bookingRules: mapped.bookingRules || DEFAULT_BUSINESS_INFO.bookingRules,
    } as BusinessInfo
  }, [businessSettingsDb])
  
  const [businessFormData, setBusinessFormData] = useState<BusinessInfo>(DEFAULT_BUSINESS_INFO)
  
  const { data: payrollSettingsDb } = usePayrollSettings()
  const upsertPayrollSettingsMut = useUpsertPayrollSettings({ suppressGlobalError: true })
  
  const [payrollFormData, setPayrollFormData] = useState<PayPeriodSettings>(DEFAULT_BIWEEKLY_SETTINGS)
  const [isPayrollScheduleExpanded, setIsPayrollScheduleExpanded] = useState(true)
  const payrollPermissions = useMemo(() => getPayrollPermissions(role), [role])
  
  const getNextFriday = (): Date => {
    const today = startOfDay(getTodayDateInBusinessTimezone())
    const friday = nextFriday(today)
    return friday
  }
  
  const getUpcomingFridays = (): Array<{ date: Date; label: string; value: string }> => {
    const fridays: Array<{ date: Date; label: string; value: string }> = []
    const firstFriday = getNextFriday()
    
    for (let i = 0; i < 4; i++) {
      const friday = addWeeks(firstFriday, i)
      const dateStr = format(friday, 'yyyy-MM-dd')
      let label = ''
      
      if (i === 0) {
        label = `This Coming Friday (${format(friday, 'MMM d, yyyy')})`
      } else if (i === 1) {
        label = `Next Friday (${format(friday, 'MMM d, yyyy')})`
      } else if (i === 2) {
        label = `The Friday After That (${format(friday, 'MMM d, yyyy')})`
      } else {
        label = `One More After That (${format(friday, 'MMM d, yyyy')})`
      }
      
      fridays.push({ date: friday, label, value: dateStr })
    }
    
    return fridays
  }

  const buildInitialPayrollSettings = useCallback((type: PayPeriodType = 'bi-weekly'): PayPeriodSettings => {
    const nextFri = getNextFriday()
    const payDate = format(nextFri, 'yyyy-MM-dd')
    const periodEnd = addDays(nextFri, -5)
    const periodStart = addDays(periodEnd, type === 'weekly' ? -6 : -13)

    return {
      type,
      anchorStartDate: format(periodStart, 'yyyy-MM-dd'),
      anchorEndDate: format(periodEnd, 'yyyy-MM-dd'),
      anchorPayDate: payDate,
    }
  }, [])
  
  useEffect(() => {
    if (businessInfo) {
      setBusinessFormData({
        ...businessInfo,
        hoursOfOperation: businessInfo.hoursOfOperation || DEFAULT_HOURS_OF_OPERATION,
        bookingRules: businessInfo.bookingRules || DEFAULT_BUSINESS_INFO.bookingRules,
      })
    }
  }, [businessInfo])
  
  useEffect(() => {
    if (!payrollSettingsDb) {
      setPayrollFormData(buildInitialPayrollSettings())
      return
    }

    const persistedPayPeriod = payrollSettingsFromDb(payrollSettingsDb)
    if (persistedPayPeriod.anchorStartDate && persistedPayPeriod.anchorEndDate && persistedPayPeriod.anchorPayDate) {
      setPayrollFormData(persistedPayPeriod)
      return
    }

    setPayrollFormData(buildInitialPayrollSettings(persistedPayPeriod.type))
  }, [buildInitialPayrollSettings, payrollSettingsDb])

  useEffect(() => {
    if (typeof payrollSettingsDb === 'undefined') return
    setIsPayrollScheduleExpanded(!payrollSettingsDb)
  }, [payrollSettingsDb])

  // Auto-seed default payment methods when DB returns empty
  useEffect(() => {
    if (paymentMethodsDb && paymentMethodsDb.length === 0 && !seedingRef.current.paymentMethods) {
      seedingRef.current.paymentMethods = true
      DEFAULT_PAYMENT_METHODS.forEach((pm, idx) => {
        createPaymentMethodMut.mutate({
          method_name: pm.name,
          is_enabled: pm.enabled,
          display_order: idx,
        })
      })
    }
  }, [paymentMethodsDb]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-seed default staff positions when DB returns empty
  useEffect(() => {
    if (staffPositionsDb && staffPositionsDb.length === 0 && !seedingRef.current.staffPositions) {
      seedingRef.current.staffPositions = true
      const defaultPositions = ["Owner", "Groomer", "Front Desk", "Bather"]
      defaultPositions.forEach((name, idx) => {
        createStaffPositionMut.mutate({
          position_name: name,
          display_order: idx,
        })
      })
    }
  }, [staffPositionsDb]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-seed default temperament options when DB returns empty
  useEffect(() => {
    if (temperamentOptionsDb && temperamentOptionsDb.length === 0 && !seedingRef.current.temperamentOptions) {
      seedingRef.current.temperamentOptions = true
      const defaultTemperaments = ["Friendly", "Energetic", "Calm", "Nervous", "Aggressive", "Playful", "Shy", "Loves treats"]
      defaultTemperaments.forEach((name, idx) => {
        createTemperamentOptionMut.mutate({
          option_name: name,
          display_order: idx,
        })
      })
    }
  }, [temperamentOptionsDb]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-seed default dog breeds when DB returns empty
  useEffect(() => {
    if (dogBreedsDb && dogBreedsDb.length === 0 && !seedingRef.current.dogBreeds) {
      seedingRef.current.dogBreeds = true
      bulkCreateDogBreedsMut.mutate(
        DOG_BREEDS.map((breed_name, idx) => ({
          breed_name,
          display_order: idx,
        }))
      )
    }
  }, [dogBreedsDb]) // eslint-disable-line react-hooks/exhaustive-deps


  // Auto-seed default weight ranges when DB returns empty
  useEffect(() => {
    if (weightRangesDb && weightRangesDb.length === 0 && !seedingRef.current.weightRanges) {
      seedingRef.current.weightRanges = true
      DEFAULT_WEIGHT_RANGES.forEach((range, idx) => {
        createWeightRangeMut.mutate({
          category: range.name,
          min_weight: range.min,
          max_weight: range.max ?? 0,
          display_order: idx,
        })
      })
    }
  }, [weightRangesDb]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-seed default services when DB returns empty
  useEffect(() => {
    if (servicesDb && servicesDb.length === 0 && !seedingRef.current.services) {
      seedingRef.current.services = true
      DEFAULT_MAIN_SERVICES.forEach((service, idx) => {
        createServiceMut.mutate({
          ...mainServiceToDb(service as MainService),
          display_order: idx,
        })
      })
      DEFAULT_ADDONS.forEach((addon, idx) => {
        createServiceMut.mutate({
          ...addOnToDb(addon as AddOn),
          display_order: idx,
        })
      })
    }
  }, [servicesDb]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadPosSettings() {
      try {
        const res = await postJSON<{ settings: typeof posSettings }>(`/api/stripe/settings`, { action: "pos_get" })
        if (res.settings) {
          setPosSettings(res.settings)
          if (res.settings.tipPresets?.length) {
            setEditingTipPresets(res.settings.tipPresets)
          }
        }
      } catch (e) {
        console.error("Failed to load POS settings:", e)
      } finally {
        setPosSettingsLoading(false)
      }
    }
    loadPosSettings()
  }, [])

  async function savePosSettings(patch: Record<string, unknown>) {
    setPosSettingsSaving(true)
    try {
      const res = await postJSON<{ settings: typeof posSettings }>("/api/stripe/settings", {
        action: "pos_set",
        partialSettings: patch,
      })
      if (res.settings) {
        setPosSettings(res.settings)
        toast.success("POS settings saved")
      }
    } catch (e) {
      toast.error("Failed to save settings")
      console.error(e)
    } finally {
      setPosSettingsSaving(false)
    }
  }

  useEffect(() => {
    setSalesTaxDraft(normalizeSalesTaxSettings(posSettings.sales_tax))
  }, [posSettings.sales_tax])

  const salesTaxChanged = useMemo(
    () => JSON.stringify(salesTaxDraft) !== JSON.stringify(normalizeSalesTaxSettings(posSettings.sales_tax)),
    [posSettings.sales_tax, salesTaxDraft]
  )

  const salesTaxCollectionEnabled = salesTaxDraft.collectSalesTax
  const salesTaxUnsavedChanges = salesTaxChanged && !posSettingsSaving
  const salesTaxUnsavedMessage = 'You have unsaved sales tax settings. Leaving now will discard those changes. Continue?'

  useUnsavedChangesGuard({
    hasUnsavedChanges: salesTaxUnsavedChanges,
    message: salesTaxUnsavedMessage,
  })

  const discardSalesTaxDraft = () => {
    setSalesTaxDraft(normalizeSalesTaxSettings(posSettings.sales_tax))
  }

  const handleSaveSalesTaxSettings = () => {
    savePosSettings({ sales_tax: salesTaxDraft })
  }

  const handleTabChange = (nextTab: string) => {
    if (activeTab === 'pos' && salesTaxUnsavedChanges) {
      const shouldLeave = window.confirm(salesTaxUnsavedMessage)
      if (!shouldLeave) {
        return
      }
      discardSalesTaxDraft()
    }

    setActiveTab(nextTab)
  }

  const handleAddPosition = () => {
    if (!newPosition.trim()) {
      toast.error("Position name cannot be empty")
      return
    }

    if (staffPositions.includes(newPosition.trim())) {
      toast.error("This position already exists")
      return
    }

    createStaffPositionMut.mutate(
      { position_name: newPosition.trim(), display_order: staffPositions.length },
      {
        onSuccess: () => { setNewPosition(""); toast.success("Position added successfully") },
        onError: () => toast.error("Failed to add position")
      }
    )
  }

  const handleDeletePosition = (position: string) => {
    const pos = staffPositionsDbList.find(p => p.position_name === position)
    if (pos) {
      deleteStaffPositionMut.mutate(pos.id, {
        onSuccess: () => toast.success("Position removed successfully"),
        onError: () => toast.error("Failed to remove position")
      })
    }
  }

  const handleEditPosition = (position: string) => {
    setEditingPosition(position)
    setEditPositionValue(position)
  }

  const handleSaveEditPosition = () => {
    if (!editPositionValue.trim()) {
      toast.error("Position name cannot be empty")
      return
    }

    if (editingPosition && editPositionValue.trim() !== editingPosition) {
      if (staffPositions.includes(editPositionValue.trim())) {
        toast.error("This position already exists")
        return
      }
    }

    const oldPos = staffPositionsDbList.find(p => p.position_name === editingPosition)
    if (oldPos) {
      deleteStaffPositionMut.mutate(oldPos.id, {
        onSuccess: () => {
          createStaffPositionMut.mutate(
            { position_name: editPositionValue.trim(), display_order: oldPos.display_order },
            {
              onSuccess: () => { setEditingPosition(null); setEditPositionValue(""); toast.success("Position updated successfully") },
              onError: () => toast.error("Failed to update position")
            }
          )
        },
        onError: () => toast.error("Failed to update position")
      })
    }
  }

  const handleCancelEditPosition = () => {
    setEditingPosition(null)
    setEditPositionValue("")
  }

  const handleAddDogBreed = () => {
    if (!newDogBreed.trim()) {
      toast.error("Breed name cannot be empty")
      return
    }

    if (displayDogBreeds.includes(newDogBreed.trim())) {
      toast.error("This breed already exists")
      return
    }

    createDogBreedMut.mutate(
      { breed_name: newDogBreed.trim(), display_order: displayDogBreeds.length },
      {
        onSuccess: () => {
          setNewDogBreed("")
          setDogBreedListExpanded(true)
          toast.success("Breed added successfully")
        },
        onError: () => toast.error("Failed to add breed")
      }
    )
  }

  const isUsingDefaultDogBreeds = dogBreedsDbList.length === 0

  const persistDefaultDogBreeds = (
    breedTransformFn: (breeds: readonly string[]) => string[],
    messages: { success: string; error: string },
    onSuccess?: () => void
  ) => {
    bulkCreateDogBreedsMut.mutate(
      breedTransformFn(DOG_BREEDS).map((breed_name, idx) => ({
        breed_name,
        display_order: idx,
      })),
      {
        onSuccess: () => {
          onSuccess?.()
          toast.success(messages.success)
        },
        onError: () => toast.error(messages.error)
      }
    )
  }

  const handleDeleteDogBreed = (breed: string) => {
    const breedOption = dogBreedsDbList.find((option) => option.breed_name === breed)
    if (breedOption) {
      deleteDogBreedMut.mutate(breedOption.id, {
        onSuccess: () => toast.success("Breed removed successfully"),
        onError: () => toast.error("Failed to remove breed")
      })
    } else if (isUsingDefaultDogBreeds) {
      persistDefaultDogBreeds(
        (breeds) => breeds.filter((currentBreed) => currentBreed !== breed),
        {
          success: "Breed removed successfully",
          error: "Failed to remove breed"
        }
      )
    }
  }

  const handleEditDogBreed = (breed: string) => {
    setEditingDogBreed(breed)
    setEditDogBreedValue(breed)
  }

  const handleSaveEditDogBreed = () => {
    if (!editDogBreedValue.trim()) {
      toast.error("Breed name cannot be empty")
      return
    }

    if (editingDogBreed && editDogBreedValue.trim() !== editingDogBreed) {
      if (displayDogBreeds.includes(editDogBreedValue.trim())) {
        toast.error("This breed already exists")
        return
      }
    }

    const oldBreed = dogBreedsDbList.find((option) => option.breed_name === editingDogBreed)
    if (oldBreed) {
      updateDogBreedMut.mutate({
        id: oldBreed.id,
        updates: {
          breed_name: editDogBreedValue.trim(),
          display_order: oldBreed.display_order,
        },
      }, {
        onSuccess: () => { setEditingDogBreed(null); setEditDogBreedValue(""); toast.success("Breed updated successfully") },
        onError: () => toast.error("Failed to update breed")
      })
    } else if (editingDogBreed && isUsingDefaultDogBreeds) {
      persistDefaultDogBreeds(
        (breeds) => breeds.map((breed_name) => breed_name === editingDogBreed ? editDogBreedValue.trim() : breed_name),
        {
          success: "Breed updated successfully",
          error: "Failed to update breed"
        },
        () => {
          setEditingDogBreed(null)
          setEditDogBreedValue("")
        }
      )
    }
  }

  const handleCancelEditDogBreed = () => {
    setEditingDogBreed(null)
    setEditDogBreedValue("")
  }
  
  const handleAddTemperament = () => {
    if (!newTemperament.trim()) {
      toast.error("Temperament option cannot be empty")
      return
    }

    if (temperamentOptions.includes(newTemperament.trim())) {
      toast.error("This temperament option already exists")
      return
    }

    createTemperamentOptionMut.mutate(
      { option_name: newTemperament.trim(), display_order: temperamentOptions.length },
      {
        onSuccess: () => { setNewTemperament(""); toast.success("Temperament option added successfully") },
        onError: () => toast.error("Failed to add temperament option")
      }
    )
  }

  const handleDeleteTemperament = (temperament: string) => {
    const opt = temperamentOptionsDbList.find(t => t.option_name === temperament)
    if (opt) {
      deleteTemperamentOptionMut.mutate(opt.id, {
        onSuccess: () => toast.success("Temperament option removed successfully"),
        onError: () => toast.error("Failed to remove temperament option")
      })
    }
  }

  const handleEditTemperament = (temperament: string) => {
    setEditingTemperament(temperament)
    setEditTemperamentValue(temperament)
  }

  const handleSaveEditTemperament = () => {
    if (!editTemperamentValue.trim()) {
      toast.error("Temperament option cannot be empty")
      return
    }

    if (editingTemperament && editTemperamentValue.trim() !== editingTemperament) {
      if (temperamentOptions.includes(editTemperamentValue.trim())) {
        toast.error("This temperament option already exists")
        return
      }
    }

    const oldOpt = temperamentOptionsDbList.find(t => t.option_name === editingTemperament)
    if (oldOpt) {
      deleteTemperamentOptionMut.mutate(oldOpt.id, {
        onSuccess: () => {
          createTemperamentOptionMut.mutate(
            { option_name: editTemperamentValue.trim(), display_order: oldOpt.display_order },
            {
              onSuccess: () => { setEditingTemperament(null); setEditTemperamentValue(""); toast.success("Temperament option updated successfully") },
              onError: () => toast.error("Failed to update temperament option")
            }
          )
        },
        onError: () => toast.error("Failed to update temperament option")
      })
    }
  }

  const handleCancelEditTemperament = () => {
    setEditingTemperament(null)
    setEditTemperamentValue("")
  }
  
  const openMainServiceDialog = (service?: MainService) => {
    if (service) {
      setEditingMainService(service)
      const pricingForm: Record<string, string> = {}
      Object.keys(service.pricing).forEach(key => {
        pricingForm[key] = service.pricing[key].toString()
      })
      setMainServiceForm({
        name: service.name,
        description: service.description,
        pricingStrategy: service.pricingStrategy || 'weight',
        pricing: pricingForm,
        breedPricing: service.breedPricing || [],
        estimatedDurationMinutes: service.estimatedDurationMinutes.toString()
      })
    } else {
      setEditingMainService(null)
      const pricingForm: Record<string, string> = {}
      weightRanges.forEach(range => {
        pricingForm[range.pricingKey] = ""
      })
      setMainServiceForm({
        name: "",
        description: "",
        pricingStrategy: 'weight',
        pricing: pricingForm,
        breedPricing: [],
        estimatedDurationMinutes: "60"
      })
    }
    setMainServiceDialogOpen(true)
  }
  
  const openWeightRangeDialog = () => {
    setWeightRangeDialogOpen(true)
  }
  
  const handleAddWeightRange = () => {
    if (weightRanges.length >= WEIGHT_PRICING_KEYS.length) {
      toast.error("Services support up to 5 size ranges right now")
      return
    }

    const tempId = `new-${Date.now()}`
    setEditingWeightRangeId(tempId)
    setEditWeightRangeForm({
      name: "",
      min: "0",
      max: ""
    })
  }
  
  const handleDeleteWeightRange = (id: string) => {
    deleteWeightRangeMut.mutate(id, {
      onSuccess: () => toast.success("Weight range deleted successfully"),
      onError: () => toast.error("Failed to delete weight range")
    })
  }
  
  const handleEditWeightRange = (range: WeightRange) => {
    setEditingWeightRangeId(range.id)
    setEditWeightRangeForm({
      name: range.name,
      min: range.min.toString(),
      max: range.max?.toString() || ""
    })
  }
  
  const handleSaveWeightRange = () => {
    if (!editingWeightRangeId) return
    
    if (!editWeightRangeForm.name.trim()) {
      toast.error("Range name is required")
      return
    }
    
    const min = parseFloat(editWeightRangeForm.min)
    const max = editWeightRangeForm.max ? parseFloat(editWeightRangeForm.max) : null
    
    if (isNaN(min)) {
      toast.error("Minimum weight must be a valid number")
      return
    }
    
    if (editWeightRangeForm.max && isNaN(max as number)) {
      toast.error("Maximum weight must be a valid number")
      return
    }
    
    const resetWeightRangeEditor = () => {
      setEditingWeightRangeId(null)
      setEditWeightRangeForm({ name: "", min: "", max: "" })
    }

    if (editingWeightRangeId.startsWith('new-')) {
      createWeightRangeMut.mutate({
        category: editWeightRangeForm.name.trim(),
        min_weight: min,
        max_weight: max ?? 0,
        display_order: weightRanges.length,
      }, {
        onSuccess: () => {
          resetWeightRangeEditor()
          toast.success("Weight range added successfully")
        },
        onError: () => toast.error("Failed to save weight range")
      })
      return
    }

    const existingRange = weightRangesDb?.find(wr => wr.id === editingWeightRangeId)
    if (existingRange) {
      updateWeightRangeMut.mutate({
        id: existingRange.id,
        updates: {
          category: editWeightRangeForm.name.trim(),
          min_weight: min,
          max_weight: max ?? 0,
          display_order: existingRange.display_order,
        },
      }, {
        onSuccess: () => {
          resetWeightRangeEditor()
          toast.success("Weight range updated successfully")
        },
        onError: () => toast.error("Failed to update weight range")
      })
      return
    }

    // Range not found in DB (e.g. it is a default range not yet persisted) — create it
    createWeightRangeMut.mutate({
      category: editWeightRangeForm.name.trim(),
      min_weight: min,
      max_weight: max ?? 0,
      display_order: weightRanges.length,
    }, {
      onSuccess: () => {
        resetWeightRangeEditor()
        toast.success("Weight range saved successfully")
      },
      onError: () => toast.error("Failed to save weight range")
    })
  }
  
  const handleCancelEditWeightRange = () => {
    setEditingWeightRangeId(null)
    setEditWeightRangeForm({ name: "", min: "", max: "" })
  }

  const formatWeightRange = (range: WeightRange) => {
    if (range.max === null) {
      return `${range.min}+ lbs`
    }
    return `${range.min}-${range.max} lbs`
  }
  
  const openAddOnDialog = (addOn?: AddOn) => {
    if (addOn) {
      setEditingAddOn(addOn)
      // Build pricing object from add-on's existing pricing, keyed by pricing key
      const pricing: Record<string, string> = {}
      if (addOn.pricing) {
        Object.entries(addOn.pricing).forEach(([key, value]) => {
          pricing[key] = value?.toString() || ""
        })
      }
      setAddOnForm({
        name: addOn.name,
        hasSizePricing: addOn.hasSizePricing ? "true" : "false",
        price: addOn.price?.toString() || "",
        pricing,
        estimatedDurationMinutes: addOn.estimatedDurationMinutes.toString()
      })
    } else {
      setEditingAddOn(null)
      // Initialize empty pricing for all weight ranges
      const pricing: Record<string, string> = {}
      weightRanges.forEach(range => {
        pricing[range.pricingKey] = ""
      })
      setAddOnForm({
        name: "",
        hasSizePricing: "false",
        price: "",
        pricing,
        estimatedDurationMinutes: "15"
      })
    }
    setAddOnDialogOpen(true)
  }
  
  const handleSaveMainService = () => {
    if (!mainServiceForm.name.trim()) {
      toast.error("Service name is required")
      return
    }
    
    const estimatedDurationMinutes = parseInt(mainServiceForm.estimatedDurationMinutes, 10)
    if (Number.isNaN(estimatedDurationMinutes) || estimatedDurationMinutes <= 0) {
      toast.error("Estimated duration must be a positive whole number")
      return
    }

    const pricing: ServicePricing = {}
    let hasInvalidPrice = false
    
    Object.keys(mainServiceForm.pricing).forEach(key => {
      const price = parseFloat(mainServiceForm.pricing[key])
      if (isNaN(price)) {
        hasInvalidPrice = true
      } else {
        pricing[key] = price
      }
    })
    
    if (hasInvalidPrice) {
      toast.error("All prices must be valid numbers")
      return
    }
    
    const newService: MainService = {
      id: editingMainService?.id || `service-${Date.now()}`,
      name: mainServiceForm.name.trim(),
      description: mainServiceForm.description.trim(),
      pricingStrategy: mainServiceForm.pricingStrategy,
      pricing,
      breedPricing: mainServiceForm.breedPricing,
      estimatedDurationMinutes
    }
    
    if (editingMainService) {
      const dbRecord = servicesDb?.find(s => s.id === editingMainService.id)
      if (dbRecord) {
        updateServiceMut.mutate({
          id: editingMainService.id,
          updated_at: dbRecord.updated_at,
          ...mainServiceToDb(newService as MainService),
        }, {
          onSuccess: () => { toast.success("Service updated successfully"); setMainServiceDialogOpen(false) },
          onError: (error) => {
            if (error.name === 'ConcurrencyError') { toast.error(error.message) } else { toast.error("Failed to update service") }
          }
        })
      } else {
        // Service not in DB yet (e.g. a default service being saved for the first time)
        createServiceMut.mutate({
          ...mainServiceToDb(newService as MainService),
          display_order: mainServices.length,
        }, {
          onSuccess: () => { toast.success("Service saved successfully"); setMainServiceDialogOpen(false) },
          onError: () => toast.error("Failed to save service")
        })
      }
    } else {
      createServiceMut.mutate({
        ...mainServiceToDb(newService as MainService),
        display_order: mainServices.length,
      }, {
        onSuccess: () => { toast.success("Service added successfully"); setMainServiceDialogOpen(false) },
        onError: () => toast.error("Failed to add service")
      })
    }
  }
  
  const handleSaveAddOn = () => {
    if (!addOnForm.name.trim()) {
      toast.error("Add-on name is required")
      return
    }
    
    const hasSizePricing = addOnForm.hasSizePricing === "true"
    const estimatedDurationMinutes = parseInt(addOnForm.estimatedDurationMinutes, 10)

    if (Number.isNaN(estimatedDurationMinutes) || estimatedDurationMinutes <= 0) {
      toast.error("Estimated duration must be a positive whole number")
      return
    }
    
    if (hasSizePricing) {
      const pricing: ServicePricing = {}
      let hasInvalidPrice = false
      
      weightRanges.forEach(range => {
        const priceValue = parseFloat(addOnForm.pricing[range.pricingKey] || "")
        if (isNaN(priceValue)) {
          hasInvalidPrice = true
        } else {
          pricing[range.pricingKey] = priceValue
        }
      })
      
      if (hasInvalidPrice) {
        toast.error("All prices must be valid numbers")
        return
      }
      
      const newAddOn: AddOn = {
        id: editingAddOn?.id || `addon-${Date.now()}`,
        name: addOnForm.name.trim(),
        hasSizePricing: true,
        pricing,
        estimatedDurationMinutes
      }
      
      if (editingAddOn) {
        const dbRecord = servicesDb?.find(s => s.id === editingAddOn.id)
        if (dbRecord) {
          updateServiceMut.mutate({
            id: editingAddOn.id,
            updated_at: dbRecord.updated_at,
            ...addOnToDb(newAddOn as AddOn),
            display_order: dbRecord.display_order,
          }, {
            onSuccess: () => { toast.success("Add-on updated successfully"); setAddOnDialogOpen(false) },
            onError: (error) => {
              if (error.name === 'ConcurrencyError') { toast.error(error.message) } else { toast.error("Failed to update add-on") }
            }
          })
        } else {
          // Add-on not in DB yet (e.g. a default add-on being saved for the first time)
          createServiceMut.mutate({
            ...addOnToDb(newAddOn as AddOn),
            display_order: addOns.length,
          }, {
            onSuccess: () => { toast.success("Add-on saved successfully"); setAddOnDialogOpen(false) },
            onError: () => toast.error("Failed to save add-on")
          })
        }
      } else {
        createServiceMut.mutate({
          ...addOnToDb(newAddOn as AddOn),
          display_order: addOns.length,
        }, {
          onSuccess: () => { toast.success("Add-on added successfully"); setAddOnDialogOpen(false) },
          onError: () => toast.error("Failed to add add-on")
        })
      }
    } else {
      const price = parseFloat(addOnForm.price)
      
      if (isNaN(price)) {
        toast.error("Price must be a valid number")
        return
      }
      
      const newAddOn: AddOn = {
        id: editingAddOn?.id || `addon-${Date.now()}`,
        name: addOnForm.name.trim(),
        hasSizePricing: false,
        price,
        estimatedDurationMinutes
      }
      
      if (editingAddOn) {
        const dbRecord = servicesDb?.find(s => s.id === editingAddOn.id)
        if (dbRecord) {
          updateServiceMut.mutate({
            id: editingAddOn.id,
            updated_at: dbRecord.updated_at,
            ...addOnToDb(newAddOn as AddOn),
            display_order: dbRecord.display_order,
          }, {
            onSuccess: () => { toast.success("Add-on updated successfully"); setAddOnDialogOpen(false) },
            onError: (error) => {
              if (error.name === 'ConcurrencyError') { toast.error(error.message) } else { toast.error("Failed to update add-on") }
            }
          })
        } else {
          // Add-on not in DB yet (e.g. a default add-on being saved for the first time)
          createServiceMut.mutate({
            ...addOnToDb(newAddOn as AddOn),
            display_order: addOns.length,
          }, {
            onSuccess: () => { toast.success("Add-on saved successfully"); setAddOnDialogOpen(false) },
            onError: () => toast.error("Failed to save add-on")
          })
        }
      } else {
        createServiceMut.mutate({
          ...addOnToDb(newAddOn as AddOn),
          display_order: addOns.length,
        }, {
          onSuccess: () => { toast.success("Add-on added successfully"); setAddOnDialogOpen(false) },
          onError: () => toast.error("Failed to add add-on")
        })
      }
    }
  }
  
  const handleDeleteMainService = (id: string) => {
    deleteServiceMut.mutate(id, {
      onSuccess: () => toast.success("Service deleted successfully"),
      onError: () => toast.error("Failed to delete service")
    })
  }
  
  const handleDeleteAddOn = (id: string) => {
    deleteServiceMut.mutate(id, {
      onSuccess: () => toast.success("Add-on deleted successfully"),
      onError: () => toast.error("Failed to delete add-on")
    })
  }

  const handleMoveService = (id: string, serviceType: 'main' | 'addon', direction: 'up' | 'down') => {
    const services = serviceType === 'main' ? mainServicesDbList : addOnsDbList
    const index = services.findIndex(service => service.id === id)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= services.length) return

    if (!servicesDb) return

    const reorderedServices = swapServiceDisplayOrder(servicesDb, id, serviceType, direction)
    const changedServices = getChangedServiceOrders(servicesDb, reorderedServices, serviceType)

    if (changedServices.length === 0) return

    const reorderErrorMessage = serviceType === 'main'
      ? "Failed to reorder services"
      : "Failed to reorder add-ons"
    const reorderSuccessMessage = serviceType === 'main'
      ? "Service order updated"
      : "Add-on order updated"
    const handleReorderError = (error: Error) => {
      if (storeId) {
        queryClient.setQueryData<Service[] | undefined>(['services', storeId], servicesDb)
      }
      if (error.name === 'ConcurrencyError') {
        toast.error(error.message)
      } else {
        toast.error(reorderErrorMessage)
      }
    }

    if (storeId) {
      queryClient.setQueryData<Service[] | undefined>(['services', storeId], reorderedServices)
    }

    reorderServicesMut.mutate(changedServices.map((service) => ({
      id: service.id,
      updated_at: servicesDb.find((existingService) => existingService.id === service.id)?.updated_at ?? service.updated_at,
      display_order: service.display_order,
    })), {
      onSuccess: () => {
        if (storeId) {
          queryClient.setQueryData<Service[] | undefined>(['services', storeId], reorderedServices)
        }
        toast.success(reorderSuccessMessage)
      },
      onError: handleReorderError,
    })
  }
  
  const saveBusinessSettings = (messages: { success: string; error: string }) => {
    if (!businessSettingsDb) {
      createBusinessSettingsMut.mutate({ ...businessSettingsToDb(businessFormData), tax_rate: 0, currency: 'usd' }, {
        onSuccess: () => toast.success(messages.success),
        onError: () => toast.error(messages.error),
      })
      return
    }

    updateBusinessSettingsMut.mutate({ ...businessSettingsToDb(businessFormData), updated_at: businessSettingsDb.updated_at }, {
      onSuccess: () => toast.success(messages.success),
      onError: (error) => {
        if (error.name === 'ConcurrencyError') {
          toast.error(error.message)
        } else {
          toast.error(messages.error)
        }
      },
    })
  }

  const handleSaveBusinessInfo = () => {
    if (!businessFormData.companyName.trim()) {
      toast.error("Company name is required")
      return
    }

    if (!businessFormData.timezone) {
      toast.error("Timezone is required")
      return
    }

    saveBusinessSettings({
      success: "Business information saved successfully",
      error: "Failed to save business information",
    })
  }

  const handleSaveHoursOfOperation = () => {
    saveBusinessSettings({
      success: "Hours of operation saved successfully",
      error: "Failed to save hours of operation",
    })
  }

  const handleSaveBookingRules = () => {
    saveBusinessSettings({
      success: "Booking rules saved successfully",
      error: "Failed to save booking rules",
    })
  }
  
  const handleBusinessInfoChange = (field: keyof BusinessInfo, value: string) => {
    setBusinessFormData((prev) => ({
      ...prev,
      [field]: value
    }))
  }
  
  const handleHoursChange = (index: number, field: keyof HoursOfOperation, value: string | boolean) => {
    setBusinessFormData((prev) => {
      const currentHours = prev.hoursOfOperation || DEFAULT_HOURS_OF_OPERATION
      const newHours = [...currentHours]
      newHours[index] = { ...newHours[index], [field]: value }
      return { ...prev, hoursOfOperation: newHours }
    })
  }

  const handleBookingRulesChange = <K extends keyof BookingRules>(field: K, value: BookingRules[K]) => {
    setBusinessFormData((prev) => ({
      ...prev,
      bookingRules: {
        ...(prev.bookingRules || DEFAULT_BUSINESS_INFO.bookingRules!),
        [field]: value,
      },
    }))
  }
  
  const handlePayrollChange = (field: keyof PayPeriodSettings, value: string) => {
    setPayrollFormData((prev) => {
      const updated = { ...prev, [field]: value }
      
      if (field === 'type') {
        setIsPayrollScheduleExpanded(true)
        const newType = value as PayPeriodType
        if (newType === 'weekly') {
          updated.anchorStartDate = DEFAULT_WEEKLY_SETTINGS.anchorStartDate
          updated.anchorEndDate = DEFAULT_WEEKLY_SETTINGS.anchorEndDate
          updated.anchorPayDate = DEFAULT_WEEKLY_SETTINGS.anchorPayDate
        } else if (newType === 'bi-weekly') {
          const nextFri = getNextFriday()
          updated.anchorPayDate = format(nextFri, 'yyyy-MM-dd')
          const periodEnd = addDays(nextFri, -5)
          updated.anchorEndDate = format(periodEnd, 'yyyy-MM-dd')
          const periodStart = addDays(periodEnd, -13)
          updated.anchorStartDate = format(periodStart, 'yyyy-MM-dd')
        }
        return updated
      }
      
      if (field === 'anchorPayDate' && updated.type === 'bi-weekly') {
        const payDate = parseDateStringAsLocal(value)
        if (!isNaN(payDate.getTime())) {
          const periodEnd = addDays(payDate, -5)
          const periodStart = addDays(periodEnd, -13)
          
          updated.anchorEndDate = format(periodEnd, 'yyyy-MM-dd')
          updated.anchorStartDate = format(periodStart, 'yyyy-MM-dd')
        }
      }

      if (field === 'anchorPayDate' && updated.type === 'weekly') {
        const payDate = parseDateStringAsLocal(value)
        if (!isNaN(payDate.getTime())) {
          const periodEnd = addDays(payDate, -5)
          const periodStart = addDays(periodEnd, -6)

          updated.anchorEndDate = format(periodEnd, 'yyyy-MM-dd')
          updated.anchorStartDate = format(periodStart, 'yyyy-MM-dd')
        }
      }
      
      return updated
    })
  }
  
  const handleSavePayrollSettings = async () => {
    if (!payrollPermissions.canManagePayroll) {
      toast.error("You do not have permission to save payroll settings")
      return
    }

    if (!payrollFormData.anchorStartDate || !payrollFormData.anchorEndDate || !payrollFormData.anchorPayDate) {
      toast.error("Choose a payroll frequency and complete the pay period dates before saving")
      return
    }

    try {
      await upsertPayrollSettingsMut.mutateAsync({
        ...payrollSettingsToDb(payrollFormData),
        default_commission_rate: payrollSettingsDb?.default_commission_rate ?? 0.45,
      })
      toast.success("Payroll settings saved successfully")
    } catch (error) {
      if (isRLSError(error)) {
        toast.error("You do not have permission to save payroll settings")
        return
      }
      toast.error("Failed to save payroll settings")
    }
  }

  const isBusinessInfoCardDirty = useMemo(() => (
    businessFormData.companyName !== businessInfo.companyName
    || businessFormData.businessPhone !== businessInfo.businessPhone
    || businessFormData.businessEmail !== businessInfo.businessEmail
    || businessFormData.website !== businessInfo.website
    || businessFormData.address !== businessInfo.address
    || businessFormData.city !== businessInfo.city
    || businessFormData.state !== businessInfo.state
    || businessFormData.zipCode !== businessInfo.zipCode
    || businessFormData.timezone !== businessInfo.timezone
  ), [businessFormData, businessInfo])

  const isHoursCardDirty = useMemo(
    () => JSON.stringify(businessFormData.hoursOfOperation || DEFAULT_HOURS_OF_OPERATION)
      !== JSON.stringify(businessInfo.hoursOfOperation || DEFAULT_HOURS_OF_OPERATION),
    [businessFormData.hoursOfOperation, businessInfo.hoursOfOperation]
  )

  const isBookingRulesCardDirty = useMemo(
    () => JSON.stringify(businessFormData.bookingRules || DEFAULT_BUSINESS_INFO.bookingRules)
      !== JSON.stringify(businessInfo.bookingRules || DEFAULT_BUSINESS_INFO.bookingRules),
    [businessFormData.bookingRules, businessInfo.bookingRules]
  )

  const payrollBaseline = useMemo(() => {
    if (!payrollSettingsDb) return buildInitialPayrollSettings()
    const persistedPayPeriod = payrollSettingsFromDb(payrollSettingsDb)
    if (persistedPayPeriod.anchorStartDate && persistedPayPeriod.anchorEndDate && persistedPayPeriod.anchorPayDate) {
      return persistedPayPeriod
    }
    return buildInitialPayrollSettings(persistedPayPeriod.type)
  }, [buildInitialPayrollSettings, payrollSettingsDb])

  const isPayrollCardDirty = useMemo(
    () => JSON.stringify(payrollFormData) !== JSON.stringify(payrollBaseline),
    [payrollBaseline, payrollFormData]
  )


  return (
    <div data-testid="page-settings" className="min-h-full bg-background text-foreground p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="overflow-x-auto -mx-6 px-6 mb-6 flex justify-center">
            <TabsList className="bg-secondary/50 inline-flex">
              <TabsTrigger 
                value="store" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
              >
                Store
              </TabsTrigger>
              <TabsTrigger 
                value="business" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
              >
                Business
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
              >
                Services
              </TabsTrigger>
              <TabsTrigger 
                value="pets" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
              >
                Pets
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
              >
                Notifications
              </TabsTrigger>
              <TabsTrigger 
                value="messages" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
              >
                Messages
              </TabsTrigger>
              <TabsTrigger 
                value="pos" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
              >
                POS
              </TabsTrigger>
              <TabsTrigger 
                value="appearance" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
              >
                Appearance
              </TabsTrigger>
              <TabsTrigger
                value="card"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
              >
                Card
              </TabsTrigger>
              <TabsTrigger 
                value="dev-pages" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
              >
                Dev Pages
              </TabsTrigger>
              {(canViewLogs || showLogsTabPlaceholder) && (
                <TabsTrigger 
                  value="logs" 
                  disabled={!canViewLogs}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
                >
                  Logs
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="store" className="mt-0">
            <Card className="p-4 md:p-6 bg-card border-border">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Store</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    View and switch between stores you belong to.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Current Store</Label>
                    <p className="text-lg font-semibold mt-1">
                      {stores.find((s) => s.id === storeId)?.name ?? 'Unknown Store'}
                    </p>
                  </div>

                  {stores.length > 1 && (
                    <div className="space-y-2">
                      <Label htmlFor="store-switcher">Switch Store</Label>
                      <Select
                        value={storeId ?? ''}
                        disabled={switching}
                        onValueChange={(value) => {
                          if (value === storeId) return
                          setSwitching(true)
                          setActiveStoreId(value)
                          setTimeout(() => setSwitching(false), 500)
                        }}
                      >
                        <SelectTrigger id="store-switcher" className="w-full max-w-sm">
                          <SelectValue placeholder="Select a store" />
                        </SelectTrigger>
                        <SelectContent>
                          {stores.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {switching && (
                        <p className="text-sm text-muted-foreground">Switching store…</p>
                      )}
                    </div>
                  )}

                  {stores.length <= 1 && (
                    <p className="text-sm text-muted-foreground">
                      You are a member of one store.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="business" className="mt-0">
            <div className="space-y-6">
              <Card className="p-4 md:p-6 bg-card border-border">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Business Information</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Configure your business details for receipts, invoices, and system-wide settings. Timezone is critical for appointments, schedules, and all time-based operations.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="company-name" className="text-sm font-medium flex items-center gap-1">
                      Company Name
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="company-name"
                      placeholder="Scruffy Butts Dog Grooming"
                      value={businessFormData.companyName}
                      onChange={(e) => handleBusinessInfoChange('companyName', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">This will appear on all receipts and invoices</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business-phone" className="text-sm font-medium">
                      Business Phone
                    </Label>
                    <Input
                      id="business-phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={businessFormData.businessPhone}
                      onChange={(e) => handleBusinessInfoChange('businessPhone', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business-email" className="text-sm font-medium">
                      Business Email
                    </Label>
                    <Input
                      id="business-email"
                      type="email"
                      placeholder="info@scruffybutts.com"
                      value={businessFormData.businessEmail}
                      onChange={(e) => handleBusinessInfoChange('businessEmail', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-sm font-medium">
                      Website
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="www.scruffybutts.com"
                      value={businessFormData.website}
                      onChange={(e) => handleBusinessInfoChange('website', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-sm font-medium">
                      Street Address
                    </Label>
                    <Input
                      id="address"
                      placeholder="123 Main Street"
                      value={businessFormData.address}
                      onChange={(e) => handleBusinessInfoChange('address', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-sm font-medium">
                      City
                    </Label>
                    <Input
                      id="city"
                      placeholder="Springfield"
                      value={businessFormData.city}
                      onChange={(e) => handleBusinessInfoChange('city', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-sm font-medium">
                      State
                    </Label>
                    <Select
                      value={businessFormData.state}
                      onValueChange={(value) => handleBusinessInfoChange('state', value)}
                    >
                      <SelectTrigger id="state" className="w-full">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zip-code" className="text-sm font-medium">
                      ZIP Code
                    </Label>
                    <Input
                      id="zip-code"
                      placeholder="12345"
                      value={businessFormData.zipCode}
                      onChange={(e) => handleBusinessInfoChange('zipCode', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="timezone" className="text-sm font-medium flex items-center gap-1">
                      Business Timezone
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={businessFormData.timezone}
                      onValueChange={(value) => handleBusinessInfoChange('timezone', value)}
                    >
                      <SelectTrigger id="timezone" className="w-full">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Critical: This timezone will be used for all appointments, staff schedules, drop-off/pick-up times, and system metrics
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    onClick={handleSaveBusinessInfo}
                    disabled={!isBusinessInfoCardDirty}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    Save Business Information
                  </Button>
                </div>
              </div>
              </Card>

              <Card className="p-4 md:p-6 bg-card border-border">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Hours of Operation</h2>
                  <p className="text-sm text-muted-foreground">
                    Set your business hours for each day of the week.
                  </p>
                </div>

                <div className="space-y-3">
                  {(businessFormData.hoursOfOperation || DEFAULT_HOURS_OF_OPERATION).map((hours, index) => (
                    <div key={hours.day} className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-4 rounded-lg bg-secondary/20 border border-border">
                      <div className="w-full md:w-28">
                        <span className="font-medium">{hours.day}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          id={`open-${hours.day}`}
                          checked={hours.isOpen}
                          onCheckedChange={(checked) => handleHoursChange(index, 'isOpen', checked)}
                        />
                        <Label htmlFor={`open-${hours.day}`} className="text-sm cursor-pointer">
                          {hours.isOpen ? 'Open' : 'Closed'}
                        </Label>
                      </div>

                      <div
                        className={`flex flex-col sm:flex-row gap-3 sm:gap-2 md:flex-1 transition-opacity ${
                          hours.isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                        aria-hidden={!hours.isOpen}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <Label htmlFor={`open-time-${hours.day}`} className="text-sm text-muted-foreground w-12">
                            From
                          </Label>
                          <Input
                            id={`open-time-${hours.day}`}
                            type="time"
                            value={hours.openTime}
                            onChange={(e) => handleHoursChange(index, 'openTime', e.target.value)}
                            className="w-full sm:w-32"
                            disabled={!hours.isOpen}
                          />
                        </div>

                        <div className="flex items-center gap-2 flex-1">
                          <Label htmlFor={`close-time-${hours.day}`} className="text-sm text-muted-foreground w-12">
                            To
                          </Label>
                          <Input
                            id={`close-time-${hours.day}`}
                            type="time"
                            value={hours.closeTime}
                            onChange={(e) => handleHoursChange(index, 'closeTime', e.target.value)}
                            className="w-full sm:w-32"
                            disabled={!hours.isOpen}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    onClick={handleSaveHoursOfOperation}
                    disabled={!isHoursCardDirty}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    Save Hours of Operation
                  </Button>
                </div>
              </div>
              </Card>

              <Card className="p-4 md:p-6 bg-card border-border">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Appointment Booking Rules</h2>
                  <p className="text-sm text-muted-foreground">
                    Control whether a groomer can handle multiple clients in the same booking window and how many overlapping appointments are allowed.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="allow-concurrent-appointments" className="text-sm font-medium">
                        Allow concurrent appointments per groomer
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Turn this on for bathers, kennel-assisted workflows, or any setup where a groomer can responsibly manage more than one pet at the same time.
                      </p>
                    </div>
                    <Switch
                      id="allow-concurrent-appointments"
                      checked={businessFormData.bookingRules?.allowConcurrentAppointments ?? false}
                      onCheckedChange={(checked) => handleBookingRulesChange('allowConcurrentAppointments', checked)}
                    />
                  </div>

                  <div className="grid gap-2 md:max-w-xs">
                    <Label htmlFor="max-appointments-per-slot" className="text-sm font-medium">
                      Max clients per groomer per booking window
                    </Label>
                    <Select
                      value={String(businessFormData.bookingRules?.maxAppointmentsPerSlot ?? 1)}
                      onValueChange={(value) => handleBookingRulesChange('maxAppointmentsPerSlot', Number(value))}
                      disabled={!(businessFormData.bookingRules?.allowConcurrentAppointments ?? false)}
                    >
                      <SelectTrigger id="max-appointments-per-slot" className="w-full">
                        <SelectValue placeholder="Select capacity" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((count) => (
                          <SelectItem key={count} value={String(count)}>
                            {count} {count === 1 ? 'client' : 'clients'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      When concurrent appointments are off, each groomer can only take one appointment at a time.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    onClick={handleSaveBookingRules}
                    disabled={!isBookingRulesCardDirty}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    Save Booking Rules
                  </Button>
                </div>
              </div>
              </Card>

              <Card className="p-4 md:p-6 bg-card border-border">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Staff Positions</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage the available positions for your staff members. These will appear in the dropdown when adding or editing staff.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                      <Label htmlFor="new-position" className="sr-only">New Position</Label>
                      <Input
                        id="new-position"
                        placeholder="Enter new position (e.g., Senior Groomer)"
                        value={newPosition}
                        onChange={(e) => setNewPosition(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddPosition()
                          }
                        }}
                      />
                    </div>
                    <Button
                      onClick={handleAddPosition}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full md:w-auto"
                    >
                      <Plus size={18} className="mr-2" />
                      Add Position
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {staffPositions.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        No positions configured. Add your first position above.
                      </div>
                    ) : (
                      staffPositions.map((position) => (
                        <div
                          key={position}
                          className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border hover:border-primary/50 transition-colors"
                        >
                          {editingPosition === position ? (
                            <>
                              <Input
                                value={editPositionValue}
                                onChange={(e) => setEditPositionValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveEditPosition()
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditPosition()
                                  }
                                }}
                                className="flex-1 mr-3"
                                autoFocus
                              />
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEditPosition}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-primary text-primary-foreground"
                                  onClick={handleSaveEditPosition}
                                >
                                  Save
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="font-medium break-all">{position}</span>
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-foreground hover:bg-primary/10"
                                  onClick={() => handleEditPosition(position)}
                                >
                                  <PencilSimple size={18} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeletePosition(position)}
                                >
                                  <Trash size={18} />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              </Card>

              <Card className="p-4 md:p-6 bg-card border-border">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Payroll Settings</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Configure your payroll schedule. The system will automatically calculate when payday is based on your pay period settings.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex flex-col gap-4 rounded-lg border border-border p-4 bg-secondary/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold">Pay Schedule</h3>
                          {!isPayrollScheduleExpanded && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {payrollFormData.type === 'weekly' ? 'Weekly' : 'Bi-Weekly'} frequency · First payday {formatDateString(payrollFormData.anchorPayDate)}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsPayrollScheduleExpanded((prev) => !prev)}
                        >
                          {isPayrollScheduleExpanded ? 'Collapse' : 'Change pay period frequency'}
                        </Button>
                      </div>

                      {isPayrollScheduleExpanded && (
                        <>
                          <Label htmlFor="pay-period-type" className="text-sm font-medium flex items-center gap-1">
                            Pay Period Frequency
                            <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={payrollFormData.type}
                            onValueChange={(value) => handlePayrollChange('type', value as PayPeriodType)}
                          >
                            <SelectTrigger id="pay-period-type" className="w-full md:w-64">
                              <SelectValue placeholder="Select pay period" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            How often you pay your staff members
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {isPayrollScheduleExpanded && payrollFormData.type === 'weekly' && (
                    <>
                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                        <h4 className="text-sm font-semibold mb-2 text-primary">Weekly Payroll Rules</h4>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• Pay period: 1 week</li>
                          <li>• Work weeks: Monday → Sunday</li>
                          <li>• Payday: Friday</li>
                          <li>• Payroll locks: When the ACH file is sent (default Wednesday night)</li>
                          <li>• Holidays: If Friday is a bank holiday, pay Thursday</li>
                          <li>• Overtime: Over 40 hours in a week = 1.5×</li>
                        </ul>
                      </div>

                      <div className="border-t border-border pt-6 space-y-4">
                        <div>
                          <h3 className="text-base font-semibold mb-1">First Payday Friday</h3>
                          <p className="text-sm text-muted-foreground">
                            Select which Friday you want your first payday to be. The system will calculate all future weekly pay periods from this date.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="first-weekly-payday-friday" className="text-sm font-medium">
                            Choose Your First Payday Friday
                          </Label>
                          <Select
                            value={payrollFormData.anchorPayDate}
                            onValueChange={(value) => handlePayrollChange('anchorPayDate', value)}
                          >
                            <SelectTrigger id="first-weekly-payday-friday" className="w-full">
                              <SelectValue placeholder="Select a Friday" />
                            </SelectTrigger>
                            <SelectContent>
                              {getUpcomingFridays().map((friday) => (
                                <SelectItem key={friday.value} value={friday.value}>
                                  {friday.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            This will be the Friday you pay your staff for the most recent week
                          </p>
                        </div>

                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <p className="text-sm text-blue-400">
                            <strong>How it works:</strong> If you select {payrollFormData.anchorPayDate && formatDateString(payrollFormData.anchorPayDate)}, your staff will be paid every Friday starting from that date. The pay period will cover the week ending the Sunday before payday.
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {isPayrollScheduleExpanded && payrollFormData.type === 'bi-weekly' && (
                    <>
                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                        <h4 className="text-sm font-semibold mb-2 text-primary">Bi-Weekly Payroll Rules</h4>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• Pay period: 2 weeks</li>
                          <li>• Work weeks: Monday → Sunday</li>
                          <li>• Payday: Friday</li>
                          <li>• Payroll locks: When the ACH file is sent (default Wednesday night)</li>
                          <li>• Holidays: If Friday is a bank holiday, pay Thursday</li>
                          <li>• Overtime: Over 40 hours in a week = 1.5×</li>
                        </ul>
                      </div>

                      <div className="border-t border-border pt-6 space-y-4">
                        <div>
                          <h3 className="text-base font-semibold mb-1">First Payday Friday</h3>
                          <p className="text-sm text-muted-foreground">
                            Select which Friday you want your first payday to be. The system will calculate all future pay periods from this date.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="first-payday-friday" className="text-sm font-medium">
                            Choose Your First Payday Friday
                          </Label>
                          <Select
                            value={payrollFormData.anchorPayDate}
                            onValueChange={(value) => handlePayrollChange('anchorPayDate', value)}
                          >
                            <SelectTrigger id="first-payday-friday" className="w-full">
                              <SelectValue placeholder="Select a Friday" />
                            </SelectTrigger>
                            <SelectContent>
                              {getUpcomingFridays().map((friday) => (
                                <SelectItem key={friday.value} value={friday.value}>
                                  {friday.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            This will be the Friday you pay your staff for the most recent 2-week period
                          </p>
                        </div>

                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <p className="text-sm text-blue-400">
                            <strong>How it works:</strong> If you select {payrollFormData.anchorPayDate && formatDateString(payrollFormData.anchorPayDate)}, your staff will be paid every other Friday starting from that date. The pay period will cover the 2 weeks ending the Sunday before payday.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <Separator className="my-6" />

                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Refunds / Chargebacks Policy</h2>
                    <p className="text-sm text-muted-foreground mb-6">
                      Configure how commission is handled when refunds or chargebacks occur
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/20">
                      <div className="flex-1">
                        <Label className="font-medium text-base">Reverse commission on full refunds</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Commission is reversed when a full refund is issued
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/20">
                      <div className="flex-1">
                        <Label className="font-medium text-base">Prorate commission on partial refunds</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Commission is reduced proportionally to the refund amount
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/20">
                      <div className="flex-1">
                        <Label className="font-medium text-base">Reverse commission on chargebacks</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Commission is reversed on disputed payment amounts
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    onClick={handleSavePayrollSettings}
                    disabled={!payrollPermissions.canManagePayroll || upsertPayrollSettingsMut.isPending || !isPayrollCardDirty}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  >
                    Save Payroll Settings
                  </Button>
                </div>
              </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="services" className="mt-0">
            <div className="space-y-6">
              <Card className="p-4 md:p-6 bg-card border-border">
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Weight Size Configuration</h2>
                      <p className="text-sm text-muted-foreground">
                        Define weight ranges for each size category
                      </p>
                    </div>
                    <Button
                      onClick={openWeightRangeDialog}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full md:w-auto"
                    >
                      <PencilSimple size={18} className="mr-2" />
                      Edit Weight Ranges
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {weightRanges.map((range) => (
                      <div key={range.id} className="bg-background/50 p-3 rounded-md">
                        <div className="text-xs text-muted-foreground mb-1">{range.name}</div>
                        <div className="text-lg font-semibold">
                          {formatWeightRange(range)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 md:p-6 bg-card border-border">
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Main Services</h2>
                      <p className="text-sm text-muted-foreground">
                        Core grooming services with flexible pricing strategies
                      </p>
                    </div>
                    <Button
                      onClick={() => openMainServiceDialog()}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full md:w-auto"
                    >
                      <Plus size={18} className="mr-2" />
                      Add Main Service
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Use the arrow buttons to control the order shown throughout the app.
                    </p>
                    {mainServices.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        No main services configured. Add your first service above.
                      </div>
                    ) : (
                      mainServices.map((service) => (
                        <div
                          key={service.id}
                          className="p-5 rounded-lg bg-secondary/20 border border-border hover:border-primary/50 transition-colors"
                        >
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h3 className="font-semibold text-lg">{service.name}</h3>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                                  {service.pricingStrategy === 'weight' ? 'By Weight' : service.pricingStrategy === 'breed' ? 'By Breed' : 'Mixed Pricing'}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                              <p className="text-xs text-muted-foreground mt-2">Estimated duration: {service.estimatedDurationMinutes} min</p>
                            </div>
                            <div className="flex items-center gap-2 self-end md:self-start">
                              <div className="flex flex-col shrink-0">
                                <button
                                  type="button"
                                  aria-label={`Move ${service.name} up`}
                                  onClick={() => handleMoveService(service.id, 'main', 'up')}
                                  disabled={mainServicesDbList.length <= 1 || reorderServicesMut.isPending || mainServicesDbList[0]?.id === service.id}
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                                >
                                  <CaretUp size={18} weight="bold" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Move ${service.name} down`}
                                  onClick={() => handleMoveService(service.id, 'main', 'down')}
                                  disabled={mainServicesDbList.length <= 1 || reorderServicesMut.isPending || mainServicesDbList[mainServicesDbList.length - 1]?.id === service.id}
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                                >
                                  <CaretDown size={18} weight="bold" />
                                </button>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-foreground hover:bg-primary/10"
                                onClick={() => openMainServiceDialog(service)}
                              >
                                <PencilSimple size={18} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteMainService(service.id)}
                              >
                                <Trash size={18} />
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {weightRanges.map((range) => (
                              <div key={`${service.id}-${range.id}`} className="bg-background/50 p-3 rounded-md">
                                <div className="text-xs text-muted-foreground mb-1">{range.name} ({formatWeightRange(range)})</div>
                                <div className="text-lg font-semibold">${service.pricing[range.pricingKey] ?? 0}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>

              <Card className="p-4 md:p-6 bg-card border-border">
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Add-On Services</h2>
                      <p className="text-sm text-muted-foreground">
                        Optional services that can be added to any main service
                      </p>
                    </div>
                    <Button
                      onClick={() => openAddOnDialog()}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full md:w-auto"
                    >
                      <Plus size={18} className="mr-2" />
                      Add Add-On
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Use the arrow buttons to keep your most common add-ons easy to find.
                    </p>
                    {addOns.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        No add-ons configured. Add your first add-on above.
                      </div>
                    ) : (
                      addOns.map((addOn) => (
                        <div
                          key={addOn.id}
                          className={addOn.hasSizePricing ? "p-5 rounded-lg bg-secondary/20 border border-border hover:border-primary/50 transition-colors" : "flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-lg bg-secondary/20 border border-border hover:border-primary/50 transition-colors"}
                        >
                          {addOn.hasSizePricing && addOn.pricing ? (
                            <>
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-base">{addOn.name}</h3>
                                </div>
                                <div className="flex items-center gap-2 self-end md:self-start">
                                  <div className="flex flex-col shrink-0">
                                    <button
                                      type="button"
                                      aria-label={`Move ${addOn.name} up`}
                                      onClick={() => handleMoveService(addOn.id, 'addon', 'up')}
                                      disabled={addOnsDbList.length <= 1 || reorderServicesMut.isPending || addOnsDbList[0]?.id === addOn.id}
                                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                                    >
                                      <CaretUp size={18} weight="bold" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Move ${addOn.name} down`}
                                      onClick={() => handleMoveService(addOn.id, 'addon', 'down')}
                                      disabled={addOnsDbList.length <= 1 || reorderServicesMut.isPending || addOnsDbList[addOnsDbList.length - 1]?.id === addOn.id}
                                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                                    >
                                      <CaretDown size={18} weight="bold" />
                                    </button>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-foreground hover:bg-primary/10"
                                    onClick={() => openAddOnDialog(addOn)}
                                  >
                                    <PencilSimple size={18} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteAddOn(addOn.id)}
                                  >
                                    <Trash size={18} />
                                  </Button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {weightRanges.map((range) => (
                                  <div key={`${addOn.id}-${range.id}`} className="bg-background/50 p-3 rounded-md">
                                    <div className="text-xs text-muted-foreground mb-1">{range.name} ({formatWeightRange(range)})</div>
                                    <div className="text-lg font-semibold">${addOn.pricing[range.pricingKey] ?? 0}</div>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-4">
                                <span className="font-medium break-all">{addOn.name}</span>
                                <span className="text-primary font-semibold shrink-0">${addOn.price}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                                <div className="flex flex-col shrink-0">
                                  <button
                                    type="button"
                                    aria-label={`Move ${addOn.name} up`}
                                    onClick={() => handleMoveService(addOn.id, 'addon', 'up')}
                                    disabled={addOnsDbList.length <= 1 || reorderServicesMut.isPending || addOnsDbList[0]?.id === addOn.id}
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                                  >
                                    <CaretUp size={18} weight="bold" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Move ${addOn.name} down`}
                                    onClick={() => handleMoveService(addOn.id, 'addon', 'down')}
                                    disabled={addOnsDbList.length <= 1 || reorderServicesMut.isPending || addOnsDbList[addOnsDbList.length - 1]?.id === addOn.id}
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                                  >
                                    <CaretDown size={18} weight="bold" />
                                  </button>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-foreground hover:bg-primary/10"
                                  onClick={() => openAddOnDialog(addOn)}
                                >
                                  <PencilSimple size={18} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteAddOn(addOn.id)}
                                >
                                  <Trash size={18} />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pets" className="mt-0">
            <Card className="p-4 md:p-6 bg-card border-border">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Dog Breed List</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Manage the breed options that appear when adding or editing pets.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                      <Label htmlFor="new-dog-breed" className="sr-only">New Dog Breed</Label>
                      <Input
                        id="new-dog-breed"
                        placeholder="Enter new dog breed (e.g., Goldendoodle)"
                        value={newDogBreed}
                        onChange={(e) => setNewDogBreed(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddDogBreed()
                          }
                        }}
                      />
                    </div>
                    <Button
                      onClick={handleAddDogBreed}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full md:w-auto"
                    >
                      <Plus size={18} className="mr-2" />
                      Add Breed
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-between border border-border bg-secondary/20 px-4 py-3 h-auto hover:bg-secondary/30"
                      onClick={() => setDogBreedListExpanded((expanded) => !expanded)}
                    >
                      <span className="font-medium">
                        {dogBreedListExpanded ? "Hide Breed List" : "Show Breed List"} ({displayDogBreeds.length})
                      </span>
                      {dogBreedListExpanded ? (
                        <CaretUp size={18} weight="bold" />
                      ) : (
                        <CaretDown size={18} weight="bold" />
                      )}
                    </Button>

                    {dogBreedListExpanded && (
                      displayDogBreeds.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          No dog breeds configured. Add your first breed above.
                        </div>
                      ) : (
                        displayDogBreeds.map((breed) => (
                          <div
                            key={breed}
                            className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border hover:border-primary/50 transition-colors"
                          >
                            {editingDogBreed === breed ? (
                              <>
                                <Input
                                  value={editDogBreedValue}
                                  onChange={(e) => setEditDogBreedValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveEditDogBreed()
                                    } else if (e.key === 'Escape') {
                                      handleCancelEditDogBreed()
                                    }
                                  }}
                                  className="flex-1 mr-3"
                                  autoFocus
                                />
                                <div className="flex gap-2 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEditDogBreed}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-primary text-primary-foreground"
                                    onClick={handleSaveEditDogBreed}
                                  >
                                    Save
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="font-medium break-all">{breed}</span>
                                <div className="flex gap-2 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-foreground hover:bg-primary/10"
                                    onClick={() => handleEditDogBreed(breed)}
                                  >
                                    <PencilSimple size={18} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteDogBreed(breed)}
                                  >
                                    <Trash size={18} />
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      )
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <h2 className="text-lg font-semibold mb-2">Temperament Options</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Manage the available temperament options that appear when adding or editing pets.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                      <Label htmlFor="new-temperament" className="sr-only">New Temperament Option</Label>
                      <Input
                        id="new-temperament"
                        placeholder="Enter new temperament option (e.g., Anxious)"
                        value={newTemperament}
                        onChange={(e) => setNewTemperament(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddTemperament()
                          }
                        }}
                      />
                    </div>
                    <Button
                      onClick={handleAddTemperament}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full md:w-auto"
                    >
                      <Plus size={18} className="mr-2" />
                      Add Option
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {temperamentOptions.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        No temperament options configured. Add your first option above.
                      </div>
                    ) : (
                      temperamentOptions.map((temperament) => (
                        <div
                          key={temperament}
                          className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border hover:border-primary/50 transition-colors"
                        >
                          {editingTemperament === temperament ? (
                            <>
                              <Input
                                value={editTemperamentValue}
                                onChange={(e) => setEditTemperamentValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveEditTemperament()
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditTemperament()
                                  }
                                }}
                                className="flex-1 mr-3"
                                autoFocus
                              />
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEditTemperament}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-primary text-primary-foreground"
                                  onClick={handleSaveEditTemperament}
                                >
                                  Save
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="font-medium break-all">{temperament}</span>
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-foreground hover:bg-primary/10"
                                  onClick={() => handleEditTemperament(temperament)}
                                >
                                  <PencilSimple size={18} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteTemperament(temperament)}
                                >
                                  <Trash size={18} />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-0">
            <NotificationSettingsTab />
          </TabsContent>

          <TabsContent value="messages" className="mt-0">
            <MessagesSettingsTab />
          </TabsContent>
          
          <TabsContent value="appearance" className="mt-0">
            <Card className="p-4 md:p-6 bg-card border-border">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Choose your appearance</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Pick a preset to update colors and layout together.
                  </p>
                </div>

                <RadioGroup
                  value={
                    [
                      { id: "classic", theme: "classic", ui: "classic" },
                      { id: "rose-glow", theme: "rose", ui: "compact" },
                      { id: "midnight-focus", theme: "midnight", ui: "focus" },
                      { id: "sweet-blue-3d", theme: "sweet-blue", ui: "focus" },
                      { id: "scruffy-blue-3d", theme: "scruffy-blue", ui: "comfort" },
                      { id: "steel-noir-industrial", theme: "steel-noir", ui: "comfort" },
                      { id: "blue-steel-industrial", theme: "blue-steel", ui: "comfort" }
                    ].find((preset) => preset.theme === selectedTheme && preset.ui === selectedUi)?.id ?? "classic"
                  }
                  onValueChange={(value) => {
                    const presetMap: Record<string, { theme: AppearanceTheme; ui: AppearanceUi }> = {
                      classic: { theme: "classic", ui: "classic" },
                      "rose-glow": { theme: "rose", ui: "compact" },
                      "midnight-focus": { theme: "midnight", ui: "focus" },
                      "sweet-blue-3d": { theme: "sweet-blue", ui: "focus" },
                      "scruffy-blue-3d": { theme: "scruffy-blue", ui: "comfort" },
                      "steel-noir-industrial": { theme: "steel-noir", ui: "comfort" },
                      "blue-steel-industrial": { theme: "blue-steel", ui: "comfort" }
                    }
                    const preset = presetMap[value]
                    if (preset) {
                      setSelectedTheme(preset.theme)
                      setSelectedUi(preset.ui)
                    }
                  }}
                  className="space-y-3"
                >
                  {[
                    {
                      id: "classic",
                      label: "Classic",
                      description: "Balanced neutrals with the signature Scruffy Butts palette."
                    },
                    {
                      id: "rose-glow",
                      label: "Rose Glow",
                      description: "Warmer highlights paired with a compact layout for a cozy flow."
                    },
                    {
                      id: "midnight-focus",
                      label: "Midnight Focus",
                      description: "Cooler tones and a distraction-free layout built for focus."
                    },
                    {
                      id: "sweet-blue-3d",
                      label: "Sweet Blue 3D",
                      description: "Soft blue accents with lifted, layered surfaces for a more dimensional feel."
                    },
                    {
                      id: "scruffy-blue-3d",
                      label: "Scruffy Blue 3D",
                      description: "Vibrant royal-blue surfaces with hot-pink accents and bold 3D depth — the signature Scruffy Butts look brought to life."
                    },
                    {
                      id: "steel-noir-industrial",
                      label: "Steel Noir Industrial",
                      description: "Brushed-metal panels, cyan progress glow, and rugged dark framing inspired by a futuristic control room."
                    },
                    {
                      id: "blue-steel-industrial",
                      label: "Blue Steel Industrial",
                      description: "The same industrial layout with polished steel blues for a cooler, high-end control-room finish."
                    }
                  ].map((preset) => (
                    <Label
                      key={preset.id}
                      htmlFor={`appearance-${preset.id}`}
                      className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-4 hover:border-primary/50 transition-colors"
                    >
                      <RadioGroupItem id={`appearance-${preset.id}`} value={preset.id} className="mt-1" />
                      <div>
                        <p className="font-medium text-sm">{preset.label}</p>
                        <p className="text-sm text-muted-foreground">{preset.description}</p>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </Card>

          </TabsContent>

          <TabsContent value="dev-pages" className="mt-0">
            <Card className="p-4 md:p-6 bg-card border-border">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Dev Pages</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Pages that exist in the app but don't have navigation routes. These are typically accessed through email links or other external triggers.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div
                    className="p-4 rounded-lg bg-secondary/20 border border-border hover:border-primary/50 transition-colors flex flex-col gap-2 text-left cursor-pointer"
                    onClick={() => navigate('/dev/login')}
                  >
                    <h3 className="font-semibold text-base">Login Screen</h3>
                    <p className="text-sm text-muted-foreground">
                      Preview the signed-out login experience without leaving your authenticated pre-production session.
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">/dev/login</code>
                      <a
                        href="/dev/login"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary hover:underline"
                      >
                        Open ↗
                      </a>
                    </div>
                  </div>

                  <div
                    className="p-4 rounded-lg bg-secondary/20 border border-border hover:border-primary/50 transition-colors flex flex-col gap-2 text-left cursor-pointer"
                    onClick={() => navigate('/dev/onboarding/create-store')}
                  >
                    <h3 className="font-semibold text-base">Create Your Store</h3>
                    <p className="text-sm text-muted-foreground">
                      Preview the owner onboarding form used when a newly registered account sets up its first store.
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">/dev/onboarding/create-store</code>
                      <a
                        href="/dev/onboarding/create-store"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary hover:underline"
                      >
                        Open ↗
                      </a>
                    </div>
                  </div>

                  <div
                    className="p-4 rounded-lg bg-secondary/20 border border-border hover:border-primary/50 transition-colors flex flex-col gap-2 text-left cursor-pointer"
                    onClick={() => navigate('/dev/staff-onboarding')}
                  >
                    <h3 className="font-semibold text-base">You&apos;re Invited to Join the Team</h3>
                    <p className="text-sm text-muted-foreground">
                      Welcome screen a staff member sees after clicking the invite email link.
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">/dev/staff-onboarding</code>
                      <a
                        href="/dev/staff-onboarding"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary hover:underline"
                      >
                        Open ↗
                      </a>
                    </div>
                  </div>

                  <div
                    className="p-4 rounded-lg bg-secondary/20 border border-border hover:border-primary/50 transition-colors flex flex-col gap-2 text-left cursor-pointer"
                    onClick={() => navigate('/dev/staff-profile-setup')}
                  >
                    <h3 className="font-semibold text-base">Complete Your Profile</h3>
                    <p className="text-sm text-muted-foreground">
                      Form where staff members set their password and complete their profile (name, address, emergency contact).
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">/dev/staff-profile-setup</code>
                      <a
                        href="/dev/staff-profile-setup"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary hover:underline"
                      >
                        Open ↗
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

          </TabsContent>

          <TabsContent value="pos" className="mt-0">
            <Card className="p-4 md:p-6 bg-card border-border">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Payment Methods</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Enable or disable Cash and Card for POS checkout.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/20">
                    <div>
                      <Label className="text-sm font-medium">Cash</Label>
                      <p className="text-xs text-muted-foreground">Allow cash tender in POS checkout.</p>
                    </div>
                    <Switch
                      checked={cashPaymentMethod?.is_enabled ?? true}
                      onCheckedChange={(checked) => {
                        if (cashPaymentMethod) {
                          updatePaymentMethodMut.mutate({
                            id: cashPaymentMethod.id,
                            updated_at: cashPaymentMethod.updated_at,
                            is_enabled: checked,
                          })
                        } else {
                          createPaymentMethodMut.mutate({
                            method_name: "Cash",
                            is_enabled: checked,
                            display_order: 0,
                          })
                        }
                      }}
                      disabled={posSettingsSaving}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/20">
                    <div>
                      <Label className="text-sm font-medium">Card</Label>
                      <p className="text-xs text-muted-foreground">
                        {!stripeStatus?.connected
                          ? "Complete Stripe onboarding to enable card payments."
                          : "Turn card checkout on or off for POS."}
                      </p>
                    </div>
                    <Switch
                      checked={posSettings.accept_cards ?? false}
                      onCheckedChange={(checked) => {
                        savePosSettings({ accept_cards: checked })
                        if (cardPaymentMethod) {
                          updatePaymentMethodMut.mutate({
                            id: cardPaymentMethod.id,
                            updated_at: cardPaymentMethod.updated_at,
                            is_enabled: checked,
                          })
                        } else {
                          createPaymentMethodMut.mutate({
                            method_name: "Card",
                            is_enabled: checked,
                            display_order: 1,
                          })
                        }
                      }}
                      disabled={!stripeStatus?.connected || posSettingsSaving}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4 md:p-6 bg-card border-border mt-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Card Payment Options</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Turn on or off the Stripe card flows you want to offer.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className={`flex items-center justify-between p-4 rounded-lg border border-border ${posSettings.accept_cards ? 'bg-secondary/20' : 'bg-muted/30 opacity-60'}`}>
                    <div>
                      <Label className="text-sm font-medium">Tap to Pay</Label>
                      <p className="text-xs text-muted-foreground">Use Stripe Terminal for card-present checkout.</p>
                    </div>
                    <Switch
                      checked={posSettings.tap_to_pay_enabled ?? false}
                      onCheckedChange={(checked) => savePosSettings({ tap_to_pay_enabled: checked })}
                      disabled={!posSettings.accept_cards || posSettingsSaving}
                    />
                  </div>
                  <div className={`flex items-center justify-between p-4 rounded-lg border border-border ${posSettings.accept_cards ? 'bg-secondary/20' : 'bg-muted/30 opacity-60'}`}>
                    <div>
                      <Label className="text-sm font-medium">Manual Card Entry</Label>
                      <p className="text-xs text-muted-foreground">Type in card details when needed.</p>
                    </div>
                    <Switch
                      checked={posSettings.manual_card_entry_enabled ?? false}
                      onCheckedChange={(checked) => savePosSettings({ manual_card_entry_enabled: checked })}
                      disabled={!posSettings.accept_cards || posSettingsSaving}
                    />
                  </div>
                  <div className={`flex items-center justify-between p-4 rounded-lg border border-border ${posSettings.accept_cards ? 'bg-secondary/20' : 'bg-muted/30 opacity-60'}`}>
                    <div>
                      <Label className="text-sm font-medium">Online Payment Links</Label>
                      <p className="text-xs text-muted-foreground">Send links so customers can pay remotely.</p>
                    </div>
                    <Switch
                      checked={posSettings.online_payment_links_enabled ?? false}
                      onCheckedChange={(checked) => savePosSettings({ online_payment_links_enabled: checked })}
                      disabled={!posSettings.accept_cards || posSettingsSaving}
                    />
                  </div>
                  <Button onClick={() => navigate('/stripe/onboarding')} className="w-full md:w-auto" variant="outline">
                    <ArrowSquareOut size={18} className="mr-2" />
                    {stripeStatus?.connected ? 'Manage Stripe Account' : 'Complete Stripe Onboarding'}
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-4 md:p-6 bg-card border-border mt-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Sales Tax</h2>
                  <p className="text-sm text-muted-foreground">
                    Configure tax collection, taxable categories, and your filing schedule.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/20">
                  <div>
                    <Label className="text-sm font-medium">Collect Sales Tax</Label>
                    <p className="text-xs text-muted-foreground">Turn tax collection on or off for POS checkout.</p>
                  </div>
                  <Switch
                    checked={salesTaxDraft.collectSalesTax}
                    onCheckedChange={(checked) => setSalesTaxDraft((current) => ({ ...current, collectSalesTax: checked }))}
                    disabled={posSettingsSaving}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sales-tax-rate" className="text-sm font-medium">Sales Tax Rate (%)</Label>
                    <Input
                      id="sales-tax-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={salesTaxDraft.rate}
                      disabled={!salesTaxCollectionEnabled}
                      onChange={(e) => setSalesTaxDraft((current) => ({ ...current, rate: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sales-tax-state" className="text-sm font-medium">Filing State</Label>
                    <Select
                      value={salesTaxDraft.nexusState}
                      onValueChange={(value) => setSalesTaxDraft((current) => ({ ...current, nexusState: value }))}
                      disabled={!salesTaxCollectionEnabled}
                    >
                      <SelectTrigger id="sales-tax-state" className="w-full">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sales-tax-schedule" className="text-sm font-medium">Filing Schedule</Label>
                    <Select
                      value={salesTaxDraft.filingSchedule}
                      onValueChange={(value: SalesTaxSettings['filingSchedule']) => setSalesTaxDraft((current) => ({ ...current, filingSchedule: value }))}
                      disabled={!salesTaxCollectionEnabled}
                    >
                      <SelectTrigger id="sales-tax-schedule" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sales-tax-due-day" className="text-sm font-medium">Pay By Day Of Month</Label>
                    <Input
                      id="sales-tax-due-day"
                      type="number"
                      min="1"
                      max="31"
                      value={salesTaxDraft.filingDueDay}
                      disabled={!salesTaxCollectionEnabled}
                      onChange={(e) => {
                        const nextValue = Number.parseInt(e.target.value, 10)
                        setSalesTaxDraft((current) => ({
                          ...current,
                          filingDueDay: Number.isFinite(nextValue) ? Math.max(1, Math.min(31, nextValue)) : current.filingDueDay,
                        }))
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Apply Taxes To</Label>
                  <div className="space-y-3 rounded-lg border border-border bg-secondary/10 p-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sales-tax-services"
                        checked={salesTaxDraft.applyToServices}
                        disabled={!salesTaxCollectionEnabled}
                        onCheckedChange={(checked) => setSalesTaxDraft((current) => ({
                          ...current,
                          applyToServices: checked === true,
                        }))}
                      />
                      <Label
                        htmlFor="sales-tax-services"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Services
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sales-tax-retail-products"
                        checked={salesTaxDraft.applyToRetailProducts}
                        disabled={!salesTaxCollectionEnabled}
                        onCheckedChange={(checked) => setSalesTaxDraft((current) => ({
                          ...current,
                          applyToRetailProducts: checked === true,
                        }))}
                      />
                      <Label
                        htmlFor="sales-tax-retail-products"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Retail Products
                      </Label>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sales tax is added at checkout and is not included in listed prices.
                  </p>
                </div>

                <div className="flex justify-end pt-2 border-t border-border">
                  <Button
                    onClick={handleSaveSalesTaxSettings}
                    disabled={posSettingsSaving || !salesTaxChanged}
                    data-testid="sales-tax-save"
                  >
                    Save
                  </Button>
                </div>
              </div>
            </Card>

            {/* === B) Terminal, Cash Drawer & Printer === */}
            <Card className={`p-4 md:p-6 bg-card border-border mt-6 ${!posSettings.accept_cards ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Terminal, Cash Drawer & Printer</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Pair your Stripe Terminal reader and manage local checkout hardware.
                  </p>
                </div>
                {posSettings.connected_reader_label && (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard size={18} className="text-green-600" />
                        <span className="text-sm font-medium">Connected: {posSettings.connected_reader_label}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReaderStatus("idle")
                          setDiscoveredReaders([])
                          if (terminalInstance) {
                            try { terminalInstance.disconnectReader() } catch (e) { console.error("Reader disconnect error:", e) }
                          }
                          savePosSettings({ connected_reader_id: "", connected_reader_label: "" })
                          toast.success("Reader disconnected")
                        }}
                        disabled={posSettingsSaving}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  <div className="p-4 rounded-lg border border-border bg-secondary/10 space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Terminal Location</Label>
                      <p className="text-xs text-muted-foreground">
                        Required before a real reader can be paired. One tap creates (or syncs) a
                        Stripe Terminal Location on your connected account.
                      </p>
                    </div>
                    {posSettings.terminal_location_id ? (
                      <div className="text-xs text-muted-foreground font-mono break-all">
                        {posSettings.terminal_location_id}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No location linked yet.</div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        disabled={!posSettings.accept_cards || posSettingsSaving}
                        onClick={async () => {
                          try {
                            const result = await paymentClient.createTerminalLocation()
                            await savePosSettings({ terminal_location_id: result.locationId })
                            toast.success(result.created ? "Terminal location created" : "Terminal location synced")
                          } catch (error) {
                            const message = error instanceof Error ? error.message : "Failed to create terminal location"
                            if (/TERMINAL_LOCATION_ADDRESS_REQUIRED|Complete the store address/i.test(message)) {
                              toast.error("Complete your business address under Settings → Business before creating a Stripe Terminal Location.")
                            } else {
                              toast.error(message)
                            }
                          }
                        }}
                      >
                        {posSettings.terminal_location_id ? "Sync Terminal Location" : "Create Terminal Location"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => setShowAdvancedTerminalLocation((v) => !v)}
                      >
                        {showAdvancedTerminalLocation ? "Hide advanced" : "Advanced"}
                      </Button>
                    </div>
                  </div>
                  {showAdvancedTerminalLocation && (
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="terminal-location-id">Stripe Terminal Location ID (advanced)</Label>
                      <Input
                        id="terminal-location-id"
                        value={posSettings.terminal_location_id ?? ""}
                        onChange={(event) => setPosSettings((current) => ({ ...current, terminal_location_id: event.target.value }))}
                        placeholder="tml_..."
                        disabled={!posSettings.accept_cards || posSettingsSaving}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        disabled={!posSettings.accept_cards || posSettingsSaving || !(posSettings.terminal_location_id ?? "").trim()}
                        onClick={async () => {
                          const locationId = (posSettings.terminal_location_id ?? "").trim()
                          if (!locationId) return
                          try {
                            await paymentClient.setTerminalLocation(locationId, posSettings.connected_reader_label)
                            await savePosSettings({ terminal_location_id: locationId })
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to save terminal location")
                          }
                        }}
                      >
                        Save Location
                      </Button>
                    </div>
                  </div>
                  )}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/20">
                    <div>
                      <Label className="text-sm font-medium">Use simulated readers</Label>
                      <p className="text-xs text-muted-foreground">Turn this off for real Stripe readers in production.</p>
                    </div>
                    <Switch
                      checked={posSettings.terminal_simulated_mode ?? defaultTerminalSimulatedMode()}
                      onCheckedChange={(checked) => savePosSettings({ terminal_simulated_mode: checked })}
                      disabled={!posSettings.accept_cards || posSettingsSaving}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full md:w-auto"
                    disabled={readerStatus === "discovering" || readerStatus === "connecting"}
                    onClick={async () => {
                      try {
                        const terminalSupported = typeof window !== "undefined" && !/iPad|iPhone|iPod/i.test(navigator.userAgent)
                        if (!terminalSupported) {
                          setReaderStatus("unsupported")
                          toast("Terminal pairing is not supported in this browser. Use Manual Card Entry or Payment Links on this device.")
                          return
                        }
                        setReaderStatus("discovering")
                        setDiscoveredReaders([])
                        const { loadStripeTerminal } = await import("@stripe/terminal-js")
                        const StripeTerminal = await loadStripeTerminal()
                        if (!StripeTerminal) {
                          toast.error("Failed to load Stripe Terminal SDK")
                          setReaderStatus("error")
                          return
                        }
                        const term = StripeTerminal.create({
                          onFetchConnectionToken: async () => {
                            const { secret } = await paymentClient.terminalConnectionToken(posSettings.terminal_location_id?.trim() || undefined)
                            return secret
                          },
                          onUnexpectedReaderDisconnect: () => {
                            setReaderStatus("disconnected")
                            toast.error("Reader disconnected unexpectedly")
                          },
                        })
                        setTerminalInstance(term)
                        const simulated = posSettings.terminal_simulated_mode ?? defaultTerminalSimulatedMode()
                        const savedLocationId = posSettings.terminal_location_id?.trim()
                        const discover = await (term as { discoverReaders: (options: Record<string, unknown>) => Promise<{ error?: { message: string }; discoveredReaders?: unknown[] }> }).discoverReaders({
                          simulated,
                          ...(savedLocationId ? { location: savedLocationId } : {}),
                        })
                        if (discover.error) {
                          toast.error(discover.error.message)
                          setReaderStatus("error")
                          return
                        }
                        const readers = ((discover.discoveredReaders || []) as Array<Record<string, unknown>>).map((r: Record<string, unknown>) => ({
                          id: (r.id || r.serial_number) as string,
                          label: (r.label || r.serial_number || "Unknown Reader") as string,
                          serial_number: r.serial_number as string | undefined,
                          device_type: r.device_type as string | undefined,
                          status: r.status as string | undefined,
                        }))
                        setDiscoveredReaders(readers)
                        setReaderStatus(readers.length > 0 ? "discovered" : "no-readers")
                        if (readers.length === 0) {
                          toast("No readers found. Make sure your reader is powered on and nearby.")
                        }
                      } catch (err: unknown) {
                        const error = err as { message?: string }
                        toast.error(error.message || "Reader discovery failed")
                        setReaderStatus("error")
                      }
                    }}
                  >
                    <WifiHigh size={16} className="mr-2" />
                    {readerStatus === "discovering" ? "Discovering..." : "Discover Readers"}
                  </Button>
                  {readerStatus === "unsupported" && (
                    <p className="text-sm text-muted-foreground">
                      Stripe Terminal pairing is not supported in this browser/device.
                    </p>
                  )}
                  {readerStatus === "no-readers" && (
                    <p className="text-sm text-muted-foreground">No readers found. Ensure your reader is powered on and nearby.</p>
                  )}
                  {discoveredReaders.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Discovered Readers</Label>
                      {discoveredReaders.map((reader) => (
                        <div key={reader.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/10">
                          <div>
                            <p className="text-sm font-medium">{reader.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {reader.device_type && <span>{reader.device_type} • </span>}
                              {reader.serial_number && <span>S/N: {reader.serial_number} • </span>}
                              <span className="capitalize">{reader.status || "available"}</span>
                            </p>
                          </div>
                          <Button
                            size="sm"
                            disabled={readerStatus === "connecting"}
                            onClick={async () => {
                              if (!terminalInstance) return
                              try {
                                setReaderStatus("connecting")
                                const conn = await (terminalInstance as { connectReader: (reader: Record<string, unknown>) => Promise<{ error?: { message: string } }> }).connectReader({ id: reader.id, label: reader.label, serial_number: reader.serial_number, device_type: reader.device_type, status: reader.status })
                                if (conn.error) {
                                  toast.error(conn.error.message)
                                  setReaderStatus("error")
                                  return
                                }
                                setReaderStatus("connected")
                                await paymentClient.saveTerminalReader({
                                  readerId: reader.id,
                                  label: reader.label,
                                  deviceType: reader.device_type,
                                  status: reader.status,
                                })
                                savePosSettings({ connected_reader_id: reader.id, connected_reader_label: reader.label })
                                toast.success(`Connected to ${reader.label}`)
                              } catch (err: unknown) {
                                const error = err as { message?: string }
                                toast.error(error.message || "Connection failed")
                                setReaderStatus("error")
                              }
                            }}
                          >
                            {readerStatus === "connecting" ? "Connecting..." : "Connect"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border">
                    <div>
                      <Label className="text-sm font-medium">Cash Drawer</Label>
                      <p className="text-xs text-muted-foreground">Coming soon — Auto-open on cash transactions</p>
                    </div>
                    <Switch
                      checked={posSettings.cash_drawer_enabled ?? false}
                      onCheckedChange={(checked) => savePosSettings({ cash_drawer_enabled: checked })}
                      disabled={posSettingsSaving}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border">
                    <div>
                      <Label className="text-sm font-medium">Receipt Printer</Label>
                      <p className="text-xs text-muted-foreground">Coming soon — Auto-print after checkout</p>
                    </div>
                    <Switch
                      checked={posSettings.printer_enabled ?? false}
                      onCheckedChange={(checked) => savePosSettings({ printer_enabled: checked })}
                      disabled={posSettingsSaving}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* === C) Tips === */}
            <Card className="p-4 md:p-6 bg-card border-border mt-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Tips</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Configure tipping options for checkout.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border">
                    <div>
                      <Label className="text-sm font-medium">Enable Tips at Checkout</Label>
                      <p className="text-xs text-muted-foreground">Show tipping options during the payment flow</p>
                    </div>
                    <Switch
                      checked={posSettings.tipping_enabled ?? false}
                      onCheckedChange={(checked) => savePosSettings({ tipping_enabled: checked })}
                      disabled={posSettingsSaving}
                    />
                  </div>
                  {posSettings.tipping_enabled && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Tip Presets (%)</Label>
                      <div className="flex flex-wrap gap-2">
                        {editingTipPresets.map((preset, i) => (
                          <div key={i} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary/30 border border-border">
                            <span className="text-sm">{preset}%</span>
                            <button
                              className="text-muted-foreground hover:text-destructive ml-1"
                              onClick={() => {
                                const next = editingTipPresets.filter((_, j) => j !== i)
                                setEditingTipPresets(next)
                                savePosSettings({ tipPresets: next })
                              }}
                            >
                              <Trash size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          placeholder="Custom %"
                          value={newTipPreset}
                          onChange={(e) => setNewTipPreset(e.target.value)}
                          className="w-32"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = parseInt(newTipPreset)
                              if (val > 0 && val <= 100 && !editingTipPresets.includes(val)) {
                                const next = [...editingTipPresets, val].sort((a, b) => a - b)
                                setEditingTipPresets(next)
                                savePosSettings({ tipPresets: next })
                                setNewTipPreset("")
                              }
                            }
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const val = parseInt(newTipPreset)
                            if (val > 0 && val <= 100 && !editingTipPresets.includes(val)) {
                              const next = [...editingTipPresets, val].sort((a, b) => a - b)
                              setEditingTipPresets(next)
                              savePosSettings({ tipPresets: next })
                              setNewTipPreset("")
                            }
                          }}
                        >
                          <Plus size={14} className="mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* === D) Receipts === */}
            <Card className="p-4 md:p-6 bg-card border-border mt-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Receipts</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Configure receipt delivery options after payment.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border">
                    <div>
                      <Label className="text-sm font-medium">Email Receipts</Label>
                      <p className="text-xs text-muted-foreground">Send receipt via email after payment</p>
                    </div>
                    <Switch
                      checked={posSettings.receipt_email_enabled ?? false}
                      onCheckedChange={(checked) => savePosSettings({ receipt_email_enabled: checked })}
                      disabled={posSettingsSaving}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border">
                    <div>
                      <Label className="text-sm font-medium">Print Receipts</Label>
                      <p className="text-xs text-muted-foreground">Coming soon — Print receipt to connected printer</p>
                    </div>
                    <Switch
                      checked={posSettings.receipt_print_enabled ?? false}
                      onCheckedChange={(checked) => savePosSettings({ receipt_print_enabled: checked })}
                      disabled={posSettingsSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Default Receipt Delivery</Label>
                    <Select
                      value={posSettings.receipt_default_method || "none"}
                      onValueChange={(val) => savePosSettings({ receipt_default_method: val })}
                    >
                      <SelectTrigger className="w-full md:w-60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="print">Print</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </Card>

            {/* === E) Refund Rules === */}
            <Card className="p-4 md:p-6 bg-card border-border mt-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Refund Rules</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Policy summary for refund authorization by role. The server enforces these rules.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-4 font-medium">Role</th>
                        <th className="text-left py-2 pr-4 font-medium">Scope</th>
                        <th className="text-left py-2 pr-4 font-medium">Max Amount</th>
                        <th className="text-left py-2 pr-4 font-medium">Time Window</th>
                        <th className="text-left py-2 font-medium">Tips</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2 pr-4">Staff / Front Desk</td>
                        <td className="py-2 pr-4">Service only</td>
                        <td className="py-2 pr-4">≤ $100</td>
                        <td className="py-2 pr-4">Same day</td>
                        <td className="py-2">No</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 pr-4">Manager</td>
                        <td className="py-2 pr-4">Service + tips</td>
                        <td className="py-2 pr-4">≤ $500</td>
                        <td className="py-2 pr-4">≤ 30 days</td>
                        <td className="py-2">Yes (notes required)</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4">Owner / Admin</td>
                        <td className="py-2 pr-4">Unlimited</td>
                        <td className="py-2 pr-4">Unlimited</td>
                        <td className="py-2 pr-4">Unlimited</td>
                        <td className="py-2">Yes (notes required)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

          </TabsContent>

          <TabsContent value="card" className="mt-0">
            <Card className="p-4 md:p-6 bg-card border-border">
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Card</h2>
                  <p className="text-sm text-muted-foreground">
                    Set up and manage card payments for your salon.
                  </p>
                </div>

                {!canManageCardSetup && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Only an owner or admin can manage card setup.
                    </p>
                  </div>
                )}

                {!publishableKey && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive font-medium">
                      Missing VITE_STRIPE_PUBLISHABLE_KEY. Add it to enable embedded Stripe card setup.
                    </p>
                  </div>
                )}

                {publishableKey && canManageCardSetup && onboardingLoading && (
                  <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground space-y-3">
                    <p>Loading card setup…</p>
                  </div>
                )}

                {publishableKey && canManageCardSetup && onboardingError && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
                    <p className="text-sm text-destructive">{onboardingError}</p>
                    {onboardingTimeout && (
                      <p className="text-xs text-muted-foreground">
                        The card setup request is taking too long. Please retry.
                      </p>
                    )}
                    <Button onClick={async () => {
                      setOnboardingError(null)
                      setOnboardingAccountId(null)
                      setDocumentsWarning(null)
                      await initializeEmbeddedOnboarding()
                    }}>
                      Retry
                    </Button>
                  </div>
                )}

                {publishableKey && canManageCardSetup && onboardingAccountId && (
                  <StripeConnectProvider accountId={onboardingAccountId}>
                    <div className="space-y-5">
                      <ConnectNotificationBanner />

                      <Card className="p-4 md:p-5 space-y-2">
                        <h3 className="font-semibold">Card Payments</h3>
                        <p className="text-sm text-muted-foreground">
                          Status: {
                            stripeStatus?.stripe_card_setup_status === 'active'
                              ? 'Active'
                              : stripeStatus?.stripe_card_setup_status === 'restricted'
                                ? 'Restricted'
                                : stripeStatus?.stripe_card_setup_status === 'pending'
                                  ? 'Pending'
                                  : 'Not set up'
                          }
                        </p>
                        {stripeStatus?.disabled_reason && (
                          <p className="text-xs text-muted-foreground">
                            Stripe needs updates before card payments can stay active.
                          </p>
                        )}
                      </Card>

                      {stripeStatus?.stripe_card_setup_status !== 'active' && (
                        <Card className="p-3 md:p-4">
                          <h3 className="font-semibold mb-2">Finish card setup</h3>
                          <ConnectAccountOnboarding
                            onExit={async () => {
                              await fetchStripeStatus()
                              toast.success('Card setup status refreshed')
                            }}
                            onLoadError={({ error }) => {
                              const message = error instanceof Error ? error.message : String(error ?? 'Unable to load onboarding')
                              setOnboardingError(message)
                            }}
                          />
                        </Card>
                      )}

                      <Card className="p-3 md:p-4">
                        <h3 className="font-semibold mb-2">Manage card payments</h3>
                        <ConnectAccountManagement
                          onLoadError={({ error }) => {
                            const message = error instanceof Error ? error.message : String(error ?? 'Unable to load account management')
                            setOnboardingError(message)
                          }}
                        />
                      </Card>

                      {(documentsWarning || (stripeStatus?.requirements_due?.some((item) => item.includes('document')) ?? false)) && (
                        <Card className="p-3 md:p-4">
                          <h3 className="font-semibold mb-2">Documents</h3>
                          {documentsWarning && (
                            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">{documentsWarning}</p>
                          )}
                          <ConnectDocuments
                            onLoadError={({ error }) => {
                              const message = error instanceof Error ? error.message : String(error ?? 'Unable to load documents')
                              setDocumentsWarning(message)
                            }}
                          />
                        </Card>
                      )}
                    </div>
                  </StripeConnectProvider>
                )}
              </div>
            </Card>
          </TabsContent>

          {canViewLogs && (
            <TabsContent value="logs" className="mt-0">
              <LogsSettingsTab />
            </TabsContent>
          )}
        </Tabs>
        
        <Dialog open={mainServiceDialogOpen} onOpenChange={setMainServiceDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-full">
            <DialogHeader>
              <DialogTitle>{editingMainService ? "Edit Main Service" : "Add Main Service"}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="service-name">Service Name</Label>
                <Input
                  id="service-name"
                  placeholder="e.g., Fresh Bath"
                  value={mainServiceForm.name}
                  onChange={(e) => setMainServiceForm({ ...mainServiceForm, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="service-description">Description</Label>
                <Input
                  id="service-description"
                  placeholder="e.g., Includes Shampoo, Blow Out, Brush Out..."
                  value={mainServiceForm.description}
                  onChange={(e) => setMainServiceForm({ ...mainServiceForm, description: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="service-duration">Estimated Duration (minutes)</Label>
                <Input
                  id="service-duration"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="60"
                  value={mainServiceForm.estimatedDurationMinutes}
                  onChange={(e) => setMainServiceForm({ ...mainServiceForm, estimatedDurationMinutes: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricing-strategy">Pricing Strategy</Label>
                <Select
                  value={mainServiceForm.pricingStrategy}
                  onValueChange={(value: 'weight' | 'breed' | 'mixed') => 
                    setMainServiceForm({ ...mainServiceForm, pricingStrategy: value })
                  }
                >
                  <SelectTrigger id="pricing-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weight">By Weight Only</SelectItem>
                    <SelectItem value="breed">By Breed Only</SelectItem>
                    <SelectItem value="mixed">Mixed (Weight + Breed Exceptions)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {mainServiceForm.pricingStrategy === 'weight' && "Price based on dog's weight using size categories"}
                  {mainServiceForm.pricingStrategy === 'breed' && "Set specific prices for certain breeds (e.g., Doodles cost more)"}
                  {mainServiceForm.pricingStrategy === 'mixed' && "Use weight-based pricing with breed-specific overrides"}
                </p>
              </div>
              
              <div className="space-y-3">
                <Label>Base Weight-Based Pricing</Label>
                <div className="grid grid-cols-2 gap-4">
                  {weightRanges.map((range) => (
                    <div key={range.id} className="space-y-2">
                      <Label htmlFor={`${range.id}-price`} className="text-sm text-muted-foreground">
                        {range.name} ({formatWeightRange(range)})
                      </Label>
                      <Input
                        id={`${range.id}-price`}
                        type="number"
                        placeholder="0"
                        value={mainServiceForm.pricing?.[range.pricingKey] || ""}
                        onChange={(e) => setMainServiceForm({ 
                          ...mainServiceForm, 
                          pricing: { ...mainServiceForm.pricing, [range.pricingKey]: e.target.value }
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              {(mainServiceForm.pricingStrategy === 'breed' || mainServiceForm.pricingStrategy === 'mixed') && (
                <div className="space-y-3 p-4 rounded-lg bg-secondary/20 border border-border">
                  <div className="flex items-center justify-between">
                    <Label>Breed-Specific Pricing</Label>
                    <p className="text-xs text-muted-foreground">Coming soon: Add breed exceptions</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This feature will allow you to set custom prices for specific breeds (e.g., Goldendoodles, Poodles).
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setMainServiceDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveMainService} className="bg-primary text-primary-foreground" disabled={createServiceMut.isPending || updateServiceMut.isPending}>
                {createServiceMut.isPending || updateServiceMut.isPending ? "Saving..." : editingMainService ? "Update Service" : "Add Service"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Dialog open={weightRangeDialogOpen} onOpenChange={setWeightRangeDialogOpen}>
          <DialogContent className="max-w-lg w-[95vw] md:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Weight Ranges</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-5 py-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Define weight ranges for size categories. These ranges are used for pricing throughout the app.
                </p>
                <Button
                  onClick={handleAddWeightRange}
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 w-full md:w-auto shrink-0"
                >
                  <Plus size={16} className="mr-2" />
                  Add Range
                </Button>
              </div>
              
              <div className="space-y-3">
                {displayWeightRanges.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No weight ranges configured. Add your first range above.
                  </div>
                ) : (
                  displayWeightRanges.map((range) => (
                    <div
                      key={range.id}
                      className="flex items-start gap-3 p-4 rounded-lg bg-secondary/20 border border-border"
                    >
                      {editingWeightRangeId === range.id ? (
                        <>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor={`edit-name-${range.id}`} className="text-xs text-muted-foreground">
                                Name
                              </Label>
                              <Input
                                id={`edit-name-${range.id}`}
                                placeholder="e.g., Small"
                                value={editWeightRangeForm.name}
                                onChange={(e) => setEditWeightRangeForm({ ...editWeightRangeForm, name: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveWeightRange()
                                  if (e.key === 'Escape') handleCancelEditWeightRange()
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`edit-min-${range.id}`} className="text-xs text-muted-foreground">
                                Min (lbs)
                              </Label>
                              <Input
                                id={`edit-min-${range.id}`}
                                type="number"
                                value={editWeightRangeForm.min}
                                onChange={(e) => setEditWeightRangeForm({ ...editWeightRangeForm, min: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveWeightRange()
                                  if (e.key === 'Escape') handleCancelEditWeightRange()
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`edit-max-${range.id}`} className="text-xs text-muted-foreground">
                                Max (lbs) - leave empty for no max
                              </Label>
                              <Input
                                id={`edit-max-${range.id}`}
                                type="number"
                                placeholder="No max"
                                value={editWeightRangeForm.max}
                                onChange={(e) => setEditWeightRangeForm({ ...editWeightRangeForm, max: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveWeightRange()
                                  if (e.key === 'Escape') handleCancelEditWeightRange()
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 pt-0 md:pt-5 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEditWeightRange}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="bg-primary text-primary-foreground"
                              onClick={handleSaveWeightRange}
                              disabled={createWeightRangeMut.isPending || updateWeightRangeMut.isPending}
                            >
                              {createWeightRangeMut.isPending || updateWeightRangeMut.isPending ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex-1">
                            <div className="font-semibold text-base mb-1">{range.name}</div>
                            <div className="text-sm text-muted-foreground">{formatWeightRange(range)}</div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-foreground hover:bg-primary/10"
                              onClick={() => handleEditWeightRange(range)}
                            >
                              <PencilSimple size={18} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteWeightRange(range.id)}
                            >
                              <Trash size={18} />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setWeightRangeDialogOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Dialog open={addOnDialogOpen} onOpenChange={setAddOnDialogOpen}>
          <DialogContent className="max-w-2xl w-[95vw] md:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAddOn ? "Edit Add-On" : "Add Add-On"}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="addon-name">Add-On Name</Label>
                <Input
                  id="addon-name"
                  placeholder="e.g., Conditioning Treatment"
                  value={addOnForm.name}
                  onChange={(e) => setAddOnForm({ ...addOnForm, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="addon-duration">Estimated Duration (minutes)</Label>
                <Input
                  id="addon-duration"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="15"
                  value={addOnForm.estimatedDurationMinutes}
                  onChange={(e) => setAddOnForm({ ...addOnForm, estimatedDurationMinutes: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricing-type">Pricing Type</Label>
                <Select
                  value={addOnForm.hasSizePricing}
                  onValueChange={(value) => setAddOnForm({ ...addOnForm, hasSizePricing: value })}
                >
                  <SelectTrigger id="pricing-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Fixed Price</SelectItem>
                    <SelectItem value="true">Size-Based Pricing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {addOnForm.hasSizePricing === "false" ? (
                <div className="space-y-2">
                  <Label htmlFor="addon-price">Price</Label>
                  <Input
                    id="addon-price"
                    type="number"
                    placeholder="20"
                    value={addOnForm.price}
                    onChange={(e) => setAddOnForm({ ...addOnForm, price: e.target.value })}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <Label>Size-Based Pricing</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {weightRanges.map((range) => (
                      <div key={range.id} className="space-y-2">
                        <Label htmlFor={`addon-${range.id}-price`} className="text-sm text-muted-foreground">
                          {range.name} ({formatWeightRange(range)})
                        </Label>
                        <Input
                          id={`addon-${range.id}-price`}
                          type="number"
                          placeholder="0"
                          value={addOnForm.pricing[range.pricingKey] || ""}
                          onChange={(e) => setAddOnForm({
                            ...addOnForm,
                            pricing: { ...addOnForm.pricing, [range.pricingKey]: e.target.value }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOnDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveAddOn}
                className="bg-primary text-primary-foreground"
                disabled={createServiceMut.isPending || updateServiceMut.isPending}
              >
                {createServiceMut.isPending || updateServiceMut.isPending
                  ? (editingAddOn ? "Updating..." : "Adding...")
                  : (editingAddOn ? "Update Add-On" : "Add Add-On")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
      </div>
    </div>
  )
}
