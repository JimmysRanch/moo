/**
 * Reports Module - Main Entry Point
 * Card-based layout organized by category
 */

import { useNavigate, Routes, Route } from 'react-router-dom'
import { 
  ChartLine,
  ChartPie,
  CurrencyDollar,
  Receipt,
  CalendarBlank,
  XCircle,
  ArrowsClockwise,
  Users,
  UserCircle,
  Briefcase,
  Tag,
  Package,
  Percent,
  CaretRight,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Import report pages
import { OwnerOverview } from './pages/OwnerOverview'
import { TrueProfitMargin } from './pages/TrueProfitMargin'
import { SalesSummary } from './pages/SalesSummary'
import { FinanceReconciliation } from './pages/FinanceReconciliation'
import { AppointmentsCapacity } from './pages/AppointmentsCapacity'
import { NoShowsCancellations } from './pages/NoShowsCancellations'
import { RetentionRebooking } from './pages/RetentionRebooking'
import { ClientCohortsLTV } from './pages/ClientCohortsLTV'
import { StaffPerformance } from './pages/StaffPerformance'
import { PayrollCompensation } from './pages/PayrollCompensation'
import { ServiceMixPricing } from './pages/ServiceMixPricing'
import { TaxesSummary } from './pages/TaxesSummary'

// New report pages
import { TipFeeCost } from './pages/TipFeeCost'
import { MonthlyRevenue } from './pages/MonthlyRevenue'
import { AddOnPerformance } from './pages/AddOnPerformance'
import { RetailProductPerformance } from './pages/RetailProductPerformance'
import { PaymentTypeRevenue } from './pages/PaymentTypeRevenue'
import { RevenueByWeightClass } from './pages/RevenueByWeightClass'
import { RevenuePerGroomingHour } from './pages/RevenuePerGroomingHour'
import { ProfitMarginByWeightClass } from './pages/ProfitMarginByWeightClass'
import { RevenueByBreed } from './pages/RevenueByBreed'
import { BreedWeightClassOverview } from './pages/BreedWeightClassOverview'
import { ServiceMix } from './pages/ServiceMix'
import { RevenueTrend } from './pages/RevenueTrend'
import { ClientRetention } from './pages/ClientRetention'
import { DiscountImpact } from './pages/DiscountImpact'
import { GroomersDiscounts } from './pages/GroomersDiscounts'
import { GroomersAdditionalFees } from './pages/GroomersAdditionalFees'
import { NewVsReturningCustomers } from './pages/NewVsReturningCustomers'
import { AppointmentsByWeightClass } from './pages/AppointmentsByWeightClass'
import { AppointmentsByBreed } from './pages/AppointmentsByBreed'
import { ServicesByWeightClass } from './pages/ServicesByWeightClass'
import { ServicesByBreed } from './pages/ServicesByBreed'
import { AppointmentFrequencyRetention } from './pages/AppointmentFrequencyRetention'
import { BreedLoyaltyLifetimeValue } from './pages/BreedLoyaltyLifetimeValue'
import { ReferralSources } from './pages/ReferralSources'
import { TopClients } from './pages/TopClients'
import { PetBreedCount } from './pages/PetBreedCount'
import { PetList } from './pages/PetList'
import { GroomerProductivity } from './pages/GroomerProductivity'
import { AppointmentDurationAnalysis } from './pages/AppointmentDurationAnalysis'

// Report definitions
interface ReportDefinition {
  id: string
  name: string
  path: string
  icon: typeof ChartLine
  category: 'overview' | 'financial' | 'operations' | 'clients' | 'staff' | 'marketing'
}

const REPORTS: ReportDefinition[] = [
  // Overview
  { id: 'owner-overview', name: 'Owner Overview', path: '/reports/owner-overview', icon: ChartLine, category: 'overview' },
  
  // Financial
  { id: 'true-profit', name: 'True Profit & Margin', path: '/reports/true-profit', icon: CurrencyDollar, category: 'financial' },
  { id: 'sales-summary', name: 'Sales Summary', path: '/reports/sales-summary', icon: ChartPie, category: 'financial' },
  { id: 'finance-reconciliation', name: 'Finance & Reconciliation', path: '/reports/finance-reconciliation', icon: Receipt, category: 'financial' },
  { id: 'taxes-summary', name: 'Taxes Summary', path: '/reports/taxes-summary', icon: Percent, category: 'financial' },
  { id: 'tip-fee-cost', name: 'Tip Fee Cost', path: '/reports/tip-fee-cost', icon: CurrencyDollar, category: 'financial' },
  { id: 'monthly-revenue', name: 'Monthly Revenue', path: '/reports/monthly-revenue', icon: ChartLine, category: 'financial' },
  { id: 'payment-type-revenue', name: 'Payment Type Revenue', path: '/reports/payment-type-revenue', icon: CurrencyDollar, category: 'financial' },
  { id: 'revenue-by-weight-class', name: 'Revenue by Weight Class', path: '/reports/revenue-by-weight-class', icon: ChartPie, category: 'financial' },
  { id: 'revenue-per-grooming-hour', name: 'Revenue per Grooming Hour', path: '/reports/revenue-per-grooming-hour', icon: ChartLine, category: 'financial' },
  { id: 'profit-margin-by-weight-class', name: 'Profit Margin by Weight Class', path: '/reports/profit-margin-by-weight-class', icon: Percent, category: 'financial' },
  { id: 'revenue-by-breed', name: 'Revenue by Breed', path: '/reports/revenue-by-breed', icon: ChartPie, category: 'financial' },
  { id: 'revenue-trend', name: 'Revenue Trend', path: '/reports/revenue-trend', icon: ChartLine, category: 'financial' },
  { id: 'discount-impact', name: 'Discount Impact', path: '/reports/discount-impact', icon: Percent, category: 'financial' },
  
  // Operations
  { id: 'appointments-capacity', name: 'Appointments & Capacity', path: '/reports/appointments-capacity', icon: CalendarBlank, category: 'operations' },
  { id: 'no-shows-cancellations', name: 'No-Shows & Cancellations', path: '/reports/no-shows-cancellations', icon: XCircle, category: 'operations' },
  { id: 'service-mix-pricing', name: 'Service Mix & Pricing', path: '/reports/service-mix-pricing', icon: Tag, category: 'operations' },
  { id: 'add-on-performance', name: 'Add-On Performance', path: '/reports/add-on-performance', icon: Tag, category: 'operations' },
  { id: 'retail-product-performance', name: 'Retail Product Performance', path: '/reports/retail-product-performance', icon: Package, category: 'operations' },
  { id: 'breed-weight-class-overview', name: 'Breed + Weight Class Overview', path: '/reports/breed-weight-class-overview', icon: ChartPie, category: 'operations' },
  { id: 'service-mix', name: 'Service Mix', path: '/reports/service-mix', icon: ChartPie, category: 'operations' },
  { id: 'appointment-duration-analysis', name: 'Appointment Duration Analysis', path: '/reports/appointment-duration-analysis', icon: CalendarBlank, category: 'operations' },
  
  // Clients
  { id: 'retention-rebooking', name: 'Retention & Rebooking', path: '/reports/retention-rebooking', icon: ArrowsClockwise, category: 'clients' },
  { id: 'client-cohorts-ltv', name: 'Client Cohorts & LTV', path: '/reports/client-cohorts-ltv', icon: Users, category: 'clients' },
  { id: 'client-retention', name: 'Client Retention', path: '/reports/client-retention', icon: ArrowsClockwise, category: 'clients' },
  { id: 'new-vs-returning-customers', name: 'New vs Returning Customers', path: '/reports/new-vs-returning-customers', icon: Users, category: 'clients' },
  { id: 'appointments-by-weight-class', name: 'Appointments by Weight Class', path: '/reports/appointments-by-weight-class', icon: ChartPie, category: 'clients' },
  { id: 'appointments-by-breed', name: 'Appointments by Breed', path: '/reports/appointments-by-breed', icon: ChartPie, category: 'clients' },
  { id: 'services-by-weight-class', name: 'Services by Weight Class', path: '/reports/services-by-weight-class', icon: ChartPie, category: 'clients' },
  { id: 'services-by-breed', name: 'Services by Breed', path: '/reports/services-by-breed', icon: ChartPie, category: 'clients' },
  { id: 'appointment-frequency-retention', name: 'Appointment Frequency & Retention', path: '/reports/appointment-frequency-retention', icon: ArrowsClockwise, category: 'clients' },
  { id: 'breed-loyalty-lifetime-value', name: 'Breed Loyalty & Lifetime Value', path: '/reports/breed-loyalty-lifetime-value', icon: Users, category: 'clients' },
  { id: 'referral-sources', name: 'Referral Sources', path: '/reports/referral-sources', icon: Users, category: 'clients' },
  { id: 'top-clients', name: 'Top Clients', path: '/reports/top-clients', icon: Users, category: 'clients' },
  { id: 'pet-breed-count', name: 'Pet Breed Count', path: '/reports/pet-breed-count', icon: ChartPie, category: 'clients' },
  { id: 'pet-list', name: 'Pet List', path: '/reports/pet-list', icon: Users, category: 'clients' },
  
  // Staff
  { id: 'staff-performance', name: 'Staff Performance', path: '/reports/staff-performance', icon: UserCircle, category: 'staff' },
  { id: 'payroll-compensation', name: 'Payroll / Compensation', path: '/reports/payroll-compensation', icon: Briefcase, category: 'staff' },
  { id: 'groomers-discounts', name: 'Groomers Discounts', path: '/reports/groomers-discounts', icon: Percent, category: 'staff' },
  { id: 'groomers-additional-fees', name: 'Groomers Additional Fees', path: '/reports/groomers-additional-fees', icon: CurrencyDollar, category: 'staff' },
  { id: 'groomer-productivity', name: 'Groomer Productivity', path: '/reports/groomer-productivity', icon: UserCircle, category: 'staff' },
]

const CATEGORIES = [
  { id: 'overview', name: 'Overview', description: 'High-level business insights' },
  { id: 'financial', name: 'Financial', description: 'Revenue, profit, and expenses' },
  { id: 'operations', name: 'Operations', description: 'Appointments, services, and inventory' },
  { id: 'clients', name: 'Clients', description: 'Customer retention and value' },
  { id: 'staff', name: 'Staff', description: 'Team performance and payroll' },
]

// Report button component
function ReportButton({ report, navigate }: { report: ReportDefinition; navigate: (path: string) => void }) {
  const Icon = report.icon
  return (
    <Button
      variant="ghost"
      className="w-full justify-between h-auto py-2 px-3 hover:bg-primary/10 group"
      onClick={() => navigate(report.path)}
    >
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded bg-primary/10 text-primary">
          <Icon size={18} weight="duotone" />
        </div>
        <span className="text-sm font-medium text-foreground">{report.name}</span>
      </div>
      <CaretRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
    </Button>
  )
}

// Category card component
function CategoryCard({ category, reports, navigate }: { 
  category: { id: string; name: string; description: string }
  reports: ReportDefinition[]
  navigate: (path: string) => void 
}) {
  if (reports.length === 0) return null
  
  return (
    <Card className="border-border h-fit">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">{category.name}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{category.description}</p>
      </div>
      <div className="p-2 space-y-1">
        {reports.map(report => (
          <ReportButton key={report.id} report={report} navigate={navigate} />
        ))}
      </div>
    </Card>
  )
}

// Reports Landing Page - Card-based layout
function ReportsLanding() {
  const navigate = useNavigate()
  
  // Group reports by category
  const groupedReports = CATEGORIES.map(cat => ({
    category: cat,
    reports: REPORTS.filter(r => r.category === cat.id),
  }))
  
  // Organize cards into columns to eliminate dead space
  const column1 = groupedReports.filter(g => ['overview', 'operations'].includes(g.category.id))
  const column2 = groupedReports.filter(g => ['financial'].includes(g.category.id))
  const column3 = groupedReports.filter(g => ['clients', 'staff'].includes(g.category.id))
  
  return (
    <div data-testid="reports-landing" className="min-h-full bg-background text-foreground p-2 md:p-3">
      <div data-testid="reports-landing-inner" className="max-w-[1400px] mx-auto">
        <div className="mb-3 flex-shrink-0">
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">View business insights and analytics</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
          <div className="space-y-3">
            {column1.map(({ category, reports }) => (
              <CategoryCard 
                key={category.id} 
                category={category} 
                reports={reports} 
                navigate={navigate} 
              />
            ))}
          </div>
          <div className="space-y-3">
            {column2.map(({ category, reports }) => (
              <CategoryCard 
                key={category.id} 
                category={category} 
                reports={reports} 
                navigate={navigate} 
              />
            ))}
          </div>
          <div className="space-y-3">
            {column3.map(({ category, reports }) => (
              <CategoryCard 
                key={category.id} 
                category={category} 
                reports={reports} 
                navigate={navigate} 
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Main Reports Component with Routing
export function Reports() {
  return (
    <Routes>
      <Route index element={<ReportsLanding />} />
      <Route path="owner-overview" element={<OwnerOverview />} />
      <Route path="true-profit" element={<TrueProfitMargin />} />
      <Route path="sales-summary" element={<SalesSummary />} />
      <Route path="finance-reconciliation" element={<FinanceReconciliation />} />
      <Route path="appointments-capacity" element={<AppointmentsCapacity />} />
      <Route path="no-shows-cancellations" element={<NoShowsCancellations />} />
      <Route path="retention-rebooking" element={<RetentionRebooking />} />
      <Route path="client-cohorts-ltv" element={<ClientCohortsLTV />} />
      <Route path="staff-performance" element={<StaffPerformance />} />
      <Route path="payroll-compensation" element={<PayrollCompensation />} />
      <Route path="service-mix-pricing" element={<ServiceMixPricing />} />
      <Route path="taxes-summary" element={<TaxesSummary />} />
      
      {/* New Financial Reports */}
      <Route path="tip-fee-cost" element={<TipFeeCost />} />
      <Route path="monthly-revenue" element={<MonthlyRevenue />} />
      <Route path="payment-type-revenue" element={<PaymentTypeRevenue />} />
      <Route path="revenue-by-weight-class" element={<RevenueByWeightClass />} />
      <Route path="revenue-per-grooming-hour" element={<RevenuePerGroomingHour />} />
      <Route path="profit-margin-by-weight-class" element={<ProfitMarginByWeightClass />} />
      <Route path="revenue-by-breed" element={<RevenueByBreed />} />
      <Route path="revenue-trend" element={<RevenueTrend />} />
      <Route path="discount-impact" element={<DiscountImpact />} />
      
      {/* New Operations Reports */}
      <Route path="add-on-performance" element={<AddOnPerformance />} />
      <Route path="retail-product-performance" element={<RetailProductPerformance />} />
      <Route path="breed-weight-class-overview" element={<BreedWeightClassOverview />} />
      <Route path="service-mix" element={<ServiceMix />} />
      <Route path="appointment-duration-analysis" element={<AppointmentDurationAnalysis />} />
      
      {/* New Client Reports */}
      <Route path="client-retention" element={<ClientRetention />} />
      <Route path="new-vs-returning-customers" element={<NewVsReturningCustomers />} />
      <Route path="appointments-by-weight-class" element={<AppointmentsByWeightClass />} />
      <Route path="appointments-by-breed" element={<AppointmentsByBreed />} />
      <Route path="services-by-weight-class" element={<ServicesByWeightClass />} />
      <Route path="services-by-breed" element={<ServicesByBreed />} />
      <Route path="appointment-frequency-retention" element={<AppointmentFrequencyRetention />} />
      <Route path="breed-loyalty-lifetime-value" element={<BreedLoyaltyLifetimeValue />} />
      <Route path="referral-sources" element={<ReferralSources />} />
      <Route path="top-clients" element={<TopClients />} />
      <Route path="pet-breed-count" element={<PetBreedCount />} />
      <Route path="pet-list" element={<PetList />} />
      
      {/* New Staff Reports */}
      <Route path="groomers-discounts" element={<GroomersDiscounts />} />
      <Route path="groomers-additional-fees" element={<GroomersAdditionalFees />} />
      <Route path="groomer-productivity" element={<GroomerProductivity />} />
    </Routes>
  )
}

export { REPORTS, CATEGORIES }
