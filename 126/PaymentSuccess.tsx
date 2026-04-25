import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, ClockClockwise, WarningCircle } from "@phosphor-icons/react"
import { paymentClient } from "@/stripe/client"

type CheckoutState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "pending" }
  | { kind: "success"; receiptId: string | null }

export function PaymentSuccess() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<CheckoutState>({ kind: "loading" })
  const sessionId = searchParams.get("session_id")
  const token = searchParams.get("token")

  useEffect(() => {
    let active = true

    async function resolveCheckout() {
      if (!sessionId || !token) {
        if (active) setState({ kind: "error", message: "Missing checkout session details." })
        return
      }

      try {
        const result = await paymentClient.resolveCheckoutSession(sessionId, token)
        if (!active) return
        if (!result.paid || !result.finalized) {
          setState({ kind: "pending" })
          return
        }
        setState({ kind: "success", receiptId: result.receiptId })
      } catch (error) {
        if (!active) return
        setState({ kind: "error", message: error instanceof Error ? error.message : "Unable to confirm payment." })
      }
    }

    void resolveCheckout()
    return () => { active = false }
  }, [sessionId, token])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        {state.kind === "loading" && (
          <>
            <ClockClockwise size={48} className="mx-auto text-primary animate-spin" />
            <h1 className="text-2xl font-bold">Confirming Payment</h1>
            <p className="text-muted-foreground text-sm">Please wait while we finalize your checkout.</p>
          </>
        )}

        {state.kind === "pending" && (
          <>
            <ClockClockwise size={48} className="mx-auto text-primary" weight="fill" />
            <h1 className="text-2xl font-bold">Payment Received</h1>
            <p className="text-muted-foreground text-sm">
              Your payment is still finishing in our system. You can safely close this page.
            </p>
          </>
        )}

        {state.kind === "success" && (
          <>
            <CheckCircle size={48} className="mx-auto text-green-500" weight="fill" />
            <h1 className="text-2xl font-bold">Payment Successful</h1>
            <p className="text-muted-foreground text-sm">
              Your payment has been processed successfully and the order is finalized.
            </p>
            {state.receiptId && (
              <p className="text-xs text-muted-foreground/70">Receipt reference: {state.receiptId}</p>
            )}
          </>
        )}

        {state.kind === "error" && (
          <>
            <WarningCircle size={48} className="mx-auto text-destructive" weight="fill" />
            <h1 className="text-2xl font-bold">We Couldn&apos;t Confirm This Payment</h1>
            <p className="text-muted-foreground text-sm">{state.message}</p>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
          <Button variant="outline" onClick={() => navigate("/login")}>
            Sign In
          </Button>
        </div>
      </Card>
    </div>
  )
}
