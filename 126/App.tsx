import { createBrowserRouter, RouterProvider, Routes, Route, useLocation, Navigate, Outlet } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Toaster } from '@/components/ui/sonner'
import { TopNav } from '@/components/TopNav'
import { Dashboard } from '@/pages/Dashboard'
import { ClientsList } from '@/pages/ClientsList'
import { ClientProfile } from '@/pages/ClientProfile'
import { AddClient } from '@/pages/AddClient'
import { EditClient } from '@/pages/EditClient'
import { AddPet } from '@/pages/AddPet'
import { EditPet } from '@/pages/EditPet'
import { PaymentHistory } from '@/pages/PaymentHistory'
import { ContactInfo } from '@/pages/ContactInfo'
import { Finances } from '@/pages/Finances'
import { ExpensesDetail } from '@/pages/ExpensesDetail'
import { AllExpenses } from '@/pages/AllExpenses'
import { AddExpense } from '@/pages/AddExpense'
import { FileTaxes } from '@/pages/FileTaxes'
import { RunPayroll } from '@/pages/RunPayroll'
import { UpcomingBills } from '@/pages/UpcomingBills'
import { Staff } from '@/pages/Staff'
import { StaffProfile } from '@/pages/StaffProfile'
import { StaffPayrollBreakdown } from '@/pages/StaffPayrollBreakdown'
import { EditStaff } from '@/pages/EditStaff'
import { StaffScheduleEditor } from '@/pages/StaffScheduleEditor'
import { Settings } from '@/pages/Settings'
import { Messages } from '@/pages/Messages'
import { Appointments } from '@/pages/Appointments'
import { NewAppointment } from '@/pages/NewAppointment'
import { EditAppointment } from '@/pages/EditAppointment'
import { POS } from '@/pages/POS'
import { Inventory } from '@/pages/Inventory'
import { InventoryHistory } from '@/pages/InventoryHistory'
import { FinancesStaffPayrollBreakdown } from '@/pages/FinancesStaffPayrollBreakdown'
import { StaffOnboarding } from '@/pages/dev/StaffOnboarding'
import { StaffProfileSetup } from '@/pages/dev/StaffProfileSetup'
import { InviteStaff } from '@/pages/InviteStaff'
import { CreateStaffMember } from '@/pages/CreateStaffMember'
import { Receipt } from '@/pages/Receipt'
import { PaymentSuccess } from '@/pages/PaymentSuccess'
import { PaymentCancel } from '@/pages/PaymentCancel'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { RecentActivityPage } from '@/pages/RecentActivityPage'
import { syncAppearanceTargets, syncAppearanceThemeColorMeta, useAppearance } from '@/hooks/useAppearance'
import { Reports } from '@/pages/reports'
import StripeOnboardingPage from '@/pages/StripeOnboarding'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { CreateStore } from '@/pages/onboarding/CreateStore'
import { AuthCallback } from '@/pages/auth/AuthCallback'
import { CheckEmail } from '@/pages/auth/CheckEmail'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { StoreProvider, useStore } from '@/contexts/StoreContext'
import { queryClient } from '@/lib/queryClient'
import { setSentryContext } from '@/lib/sentry'
import { setLoggerContext } from '@/lib/appLogger'
import { setAppViewportVariables } from '@/lib/layout'

function AppLayout() {
  const location = useLocation()
  const { user } = useAuth()
  const { storeId, stores } = useStore()
  const { selectedTheme, selectedUi } = useAppearance()
  const contentRef = useRef<HTMLDivElement>(null)
  const topNavRef = useRef<HTMLElement>(null)

  // Keep Sentry + internal logger context in sync with auth / store / route
  useEffect(() => {
    setSentryContext({
      userId: user?.id ?? null,
      storeId: storeId ?? null,
      route: location.pathname,
    })

    const meta = user?.user_metadata as Record<string, string> | undefined
    const firstName = meta?.first_name ?? ''
    const lastName = meta?.last_name ?? ''
    const userName = [firstName, lastName].filter(Boolean).join(' ') || user?.email || null
    const storeName = stores.find((s) => s.id === storeId)?.name ?? null

    setLoggerContext({
      userId: user?.id ?? null,
      userName,
      storeId: storeId ?? null,
      storeName,
      route: location.pathname,
    })
  }, [user?.id, user?.user_metadata, user?.email, storeId, stores, location.pathname])

  // Scroll content area to top on every navigation
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    const sparkApp = document.getElementById('spark-app')
    syncAppearanceTargets(
      [document.documentElement, sparkApp].filter(
        (target): target is HTMLElement => Boolean(target)
      ),
      selectedTheme,
      selectedUi
    )
    syncAppearanceThemeColorMeta(selectedTheme)
  }, [selectedTheme, selectedUi])

  const loginRoutes = [
    '/',
    '/login',
    '/dev/login',
    '/create-account',
    '/onboarding/create-store',
    '/dev/onboarding/create-store',
    '/auth/callback',
    '/auth/check-email',
    '/forgot-password',
    '/reset-password',
    '/dev/staff-onboarding',
    '/dev/staff-profile-setup',
    '/onboarding/staff',
    '/onboarding/staff/profile'
  ]
  const isLoginRoute = loginRoutes.includes(location.pathname)

  useLayoutEffect(() => {
    const rootStyle = document.documentElement.style

    const updateViewportVariables = () => {
      const topNavHeight = isLoginRoute ? 0 : topNavRef.current?.getBoundingClientRect().height ?? 0
      setAppViewportVariables(rootStyle, topNavHeight)
    }

    updateViewportVariables()

    if (isLoginRoute || !topNavRef.current) {
      return
    }

    const topNavElement = topNavRef.current
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateViewportVariables)
        : null

    resizeObserver?.observe(topNavElement)
    window.addEventListener('resize', updateViewportVariables)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateViewportVariables)
    }
  }, [isLoginRoute])

  return (
    <div className="h-dvh bg-background text-foreground flex flex-col">
      {!isLoginRoute && <TopNav ref={topNavRef} />}
      <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto relative z-[1]">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />
          <Route path="/dev/login" element={<Login previewMode />} />
          <Route
            path="/create-account"
            element={
              <PublicOnly>
                <Signup />
              </PublicOnly>
            }
          />
          <Route path="/onboarding/create-store" element={<CreateStore />} />
          <Route path="/dev/onboarding/create-store" element={<CreateStore previewMode />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/check-email" element={<CheckEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/payments/success" element={<PaymentSuccess />} />
          <Route path="/payments/cancel" element={<PaymentCancel />} />
          <Route element={<RequireAuthOnly />}>
            <Route path="/dev/staff-onboarding" element={<StaffOnboarding />} />
            <Route path="/dev/staff-profile-setup" element={<StaffProfileSetup />} />
            <Route path="/onboarding/staff" element={<StaffOnboarding />} />
            <Route path="/onboarding/staff/profile" element={<StaffProfileSetup />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/appointments/new" element={<NewAppointment />} />
            <Route path="/appointments/:appointmentId/edit" element={<EditAppointment />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/clients" element={<ClientsList />} />
            <Route path="/clients/new" element={<AddClient />} />
            <Route path="/clients/:clientId" element={<ClientProfile />} />
            <Route path="/clients/:clientId/edit" element={<EditClient />} />
            <Route path="/clients/:clientId/add-pet" element={<AddPet />} />
            <Route path="/clients/:clientId/pets/:petId/edit" element={<EditPet />} />
            <Route path="/clients/:clientId/payment-history" element={<PaymentHistory />} />
            <Route path="/clients/:clientId/contact" element={<ContactInfo />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/staff/new" element={<CreateStaffMember />} />
            <Route path="/staff/invite" element={<InviteStaff />} />
            <Route path="/staff/:staffId" element={<StaffProfile />} />
            <Route path="/staff/:staffId/edit" element={<EditStaff />} />
            <Route path="/staff/:staffId/schedule/edit" element={<StaffScheduleEditor />} />
            <Route path="/staff/:staffId/payroll-breakdown" element={<StaffPayrollBreakdown />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/history" element={<InventoryHistory />} />
            <Route path="/receipts/:receiptId" element={<Receipt />} />
            <Route path="/finances" element={<Finances />} />
            <Route path="/finances/expenses" element={<ExpensesDetail />} />
            <Route path="/finances/all-expenses" element={<AllExpenses />} />
            <Route path="/finances/add-expense" element={<AddExpense />} />
            <Route path="/finances/upcoming-bills" element={<UpcomingBills />} />
            <Route path="/finances/file-taxes" element={<FileTaxes />} />
            <Route path="/finances/run-payroll" element={<RunPayroll />} />
            <Route path="/finances/staff/:staffId/payroll-breakdown" element={<FinancesStaffPayrollBreakdown />} />
            <Route path="/reports/*" element={<Reports />} />
            <Route path="/recent-activity" element={<RecentActivityPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/stripe/onboarding" element={<StripeOnboardingPage />} />
          </Route>
        </Routes>
      </div>
      <Toaster />
    </div>
  )
}

function HomeRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex h-[var(--app-content-height)] items-center justify-center">Loading...</div>
  }

  return <Navigate to={user ? '/dashboard' : '/login'} replace />
}

function RequireAuth() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const { storeId, loading: storeLoading, error: storeError } = useStore()

  if (loading || storeLoading) {
    return <div className="flex h-[var(--app-content-height)] items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (storeError) {
    return (
      <div className="flex h-[var(--app-content-height)] items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">We couldn't load your stores</h1>
          <p className="mt-2 text-sm text-muted-foreground">{storeError}</p>
        </div>
      </div>
    )
  }

  if (!storeId) {
    const metadata = user.user_metadata
    const inviteId = metadata?.staff_invite_id ?? metadata?.staff_invite_token
    if (inviteId) {
      return <Navigate to={`/onboarding/staff?token=${encodeURIComponent(inviteId)}`} replace />
    }
    return <Navigate to="/onboarding/create-store" replace />
  }

  return <Outlet />
}

function RequireAuthOnly() {
  const location = useLocation()
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex h-[var(--app-content-height)] items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}


function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex h-[var(--app-content-height)] items-center justify-center">Loading...</div>
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

const router = createBrowserRouter([{ path: '*', element: <AppLayout /> }])

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StoreProvider>
          <RouterProvider router={router} />
        </StoreProvider>
      </AuthProvider>
      <SpeedInsights />
    </QueryClientProvider>
  )
}

export default App
