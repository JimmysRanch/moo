import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { List, SignOut } from '@phosphor-icons/react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { supabase } from '@/lib/supabase'
import { clearAuthStorage } from '@/lib/auth/clearAuthStorage'
import { useAuth } from '@/contexts/AuthContext'
import { forwardRef } from 'react'
import { APP_NAV_Z_INDEX } from '@/lib/layout'
import { useAppearance } from '@/hooks/useAppearance'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'appointments', label: 'Appointments', path: '/appointments' },
  { id: 'messages', label: 'Messages', path: '/messages' },
  { id: 'clients', label: 'Clients', path: '/clients' },
  { id: 'staff', label: 'Staff', path: '/staff' },
  { id: 'pos', label: 'POS', path: '/pos' },
  { id: 'inventory', label: 'Inventory', path: '/inventory' },
  { id: 'finances', label: 'Finances', path: '/finances' },
  { id: 'reports', label: 'Reports', path: '/reports' },
  { id: 'settings', label: 'Settings', path: '/settings' },
]

type TopNavProps = {
  className?: string
}

export const TopNav = forwardRef<HTMLElement, TopNavProps>(function TopNav({ className }, ref) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const { logoutInProgressRef } = useAuth()
  const { selectedTheme } = useAppearance()
  const isSteelNoirTheme = selectedTheme === 'steel-noir' || selectedTheme === 'blue-steel'

  const handleNavigation = (path: string) => {
    navigate(path)
    setOpen(false)
  }

  const handleLogout = async () => {
    logoutInProgressRef.current = true
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        // Fallback: ensure local auth state is cleared if Supabase sign-out fails.
        console.error('Error signing out:', error)
        clearAuthStorage()
      }
      navigate('/login', { replace: true })
    } finally {
      logoutInProgressRef.current = false
    }
  }

  return (
    <nav
      ref={ref}
      className={cn(
        'top-nav-shell bg-card border-b border-border sticky top-0 pt-[env(safe-area-inset-top)]',
        isSteelNoirTheme && 'top-nav-shell-steel-noir',
        className
      )}
      style={{ zIndex: APP_NAV_Z_INDEX }}
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
        
        <div className="md:hidden flex items-center justify-between h-14">
          <div className="text-lg font-bold text-primary">Scruffy Butts</div>
          
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                <List size={24} />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex flex-col gap-2 mt-8">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path || 
                    (item.path !== '/' && location.pathname.startsWith(item.path))
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.path)}
                      className={cn(
                        "top-nav-link px-4 py-3 text-sm font-semibold transition-all duration-200 rounded-lg text-left",
                        isActive
                          ? "top-nav-link-active bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </button>
                  )
                })}
                <button
                  onClick={handleLogout}
                  className="px-4 py-3 text-sm font-semibold transition-all duration-200 rounded-lg text-left text-destructive hover:bg-destructive/10 flex items-center gap-2 mt-2 border-t border-border pt-4"
                >
                  <SignOut size={16} />
                  Logout
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="hidden md:flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path))
            
            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  "top-nav-link px-4 py-4 text-sm font-semibold transition-all duration-200 border-b-2 hover:text-primary whitespace-nowrap",
                  isActive
                    ? "top-nav-link-active border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-primary/50"
                )}
              >
                {item.label}
              </button>
            )
          })}
          <button
            data-testid="nav-logout"
            onClick={handleLogout}
            className="ml-auto px-4 py-4 text-sm font-semibold transition-all duration-200 border-b-2 border-transparent text-muted-foreground hover:text-destructive hover:border-destructive/50 whitespace-nowrap flex items-center gap-1"
          >
            <SignOut size={16} />
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
})
