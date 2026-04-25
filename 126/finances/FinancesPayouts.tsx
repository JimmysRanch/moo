import { useState } from 'react'
import { ConnectPayouts } from '@stripe/react-connect-js'
import { Wallet } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import StripeFinanceGuard from '@/pages/finances/StripeFinanceGuard'

export default function FinancesPayouts() {
  const [embedError, setEmbedError] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Wallet size={20} />
            Payouts
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage Stripe payouts. This page will stay visible even when no payouts exist yet.
          </p>
        </div>
      </Card>

      <StripeFinanceGuard mode="payouts">
        <Card className="p-4 md:p-6 space-y-4">
          {embedError ? (
            <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Unable to load Stripe payouts right now.</p>
              <p className="mt-1">{embedError}</p>
            </div>
          ) : null}
          <ConnectPayouts
            onLoadError={({ error }) => {
              const message = error instanceof Error ? error.message : String(error ?? 'Unknown Stripe error')
              setEmbedError(message)
            }}
          />
        </Card>
      </StripeFinanceGuard>
    </div>
  )
}
