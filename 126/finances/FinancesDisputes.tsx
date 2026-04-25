import { useState } from 'react'
import { ConnectDisputesList } from '@stripe/react-connect-js'
import { WarningCircle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import StripeFinanceGuard from '@/pages/finances/StripeFinanceGuard'

export default function FinancesDisputes() {
  const [embedError, setEmbedError] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <WarningCircle size={20} />
            Disputes
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Review and respond to Stripe disputes directly in-app. This page shell remains available even when there are no disputes.
          </p>
        </div>
      </Card>

      <StripeFinanceGuard mode="disputes">
        <Card className="p-4 md:p-6 space-y-4">
          {embedError ? (
            <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Unable to load Stripe disputes right now.</p>
              <p className="mt-1">{embedError}</p>
            </div>
          ) : null}
          <ConnectDisputesList
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
