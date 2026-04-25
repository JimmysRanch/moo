import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { StripeConnectProvider } from '@/stripe/connect'
import { paymentClient, type StripeConnectHealth } from '@/stripe/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConnectNotificationBanner } from '@stripe/react-connect-js'
import { ArrowSquareOut, Warning } from '@phosphor-icons/react'
import { useStore } from '@/contexts/StoreContext'

type StripeFinanceGuardProps = {
  children: ReactNode
  mode: 'payouts' | 'disputes'
}

export default function StripeFinanceGuard({ children, mode }: StripeFinanceGuardProps) {
  const [status, setStatus] = useState<StripeConnectHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()
  const { role } = useStore()

  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const stripeStatus = await paymentClient.stripeStatus()
        if (!cancelled) {
          setStatus(stripeStatus)
        }
      } catch {
        if (!cancelled) {
          setStatus(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  if (!publishableKey) {
    return (
      <Card className="p-4 border-destructive bg-destructive/10">
        <div className="flex items-center gap-2 text-destructive">
          <Warning size={20} />
          <span>Missing VITE_STRIPE_PUBLISHABLE_KEY - Stripe features disabled</span>
        </div>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          <span>Checking Stripe connection…</span>
        </div>
      </Card>
    )
  }

  if (!status || !status.connected || !status.details_submitted) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-amber-600 mb-4">
          <Warning size={24} />
          <span className="text-lg font-semibold">Stripe Setup Required</span>
        </div>
        <p className="text-muted-foreground mb-4">
          Complete Stripe onboarding to start accepting payments and manage your finances.
        </p>
        <Button onClick={() => nav('/settings?tab=card')}>
          <ArrowSquareOut size={16} className="mr-2" />
          Complete Stripe Setup
        </Button>
      </Card>
    )
  }

  if (role && role !== 'owner' && role !== 'admin') {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-amber-600 mb-4">
          <Warning size={24} />
          <span className="text-lg font-semibold">Owner or admin access required</span>
        </div>
        <p className="text-muted-foreground mb-4">
          Embedded Stripe finance tools are currently limited to store owners and admins.
        </p>
        <Button onClick={() => nav('/finances?tab=payments')}>
          <ArrowSquareOut size={16} className="mr-2" />
          Go to Payments Ledger
        </Button>
      </Card>
    )
  }

  const needsCapability =
    mode === 'payouts'
      ? !status.payouts_enabled
      : !status.charges_enabled

  if (needsCapability) {
    const capabilityLabel = mode === 'payouts' ? 'payouts' : 'charges'
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-amber-600 mb-4">
          <Warning size={24} />
          <span className="text-lg font-semibold">Action Required</span>
        </div>
        <p className="text-muted-foreground mb-4">
          Your Stripe account needs additional information before you can enable {capabilityLabel}.
        </p>
        <Button onClick={() => nav('/settings?tab=card')}>
          <ArrowSquareOut size={16} className="mr-2" />
          Complete Setup
        </Button>
      </Card>
    )
  }

  if (!status.stripe_account_id) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-amber-600 mb-4">
          <Warning size={24} />
          <span className="text-lg font-semibold">Stripe account needs reconnecting</span>
        </div>
        <p className="text-muted-foreground mb-4">
          We could not find your connected Stripe account ID. Re-run onboarding to restore embedded payouts and disputes.
        </p>
        <Button onClick={() => nav('/settings?tab=card')}>
          <ArrowSquareOut size={16} className="mr-2" />
          Reconnect Stripe
        </Button>
      </Card>
    )
  }

  return (
    <StripeConnectProvider accountId={status.stripe_account_id}>
      <div className="space-y-4">
        <ConnectNotificationBanner />
        {children}
      </div>
    </StripeConnectProvider>
  )
}
