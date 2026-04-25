import { useNavigate } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { XCircle } from "@phosphor-icons/react"

export function PaymentCancel() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <XCircle size={48} className="mx-auto text-muted-foreground" weight="fill" />
        <h1 className="text-2xl font-bold">Payment Cancelled</h1>
        <p className="text-muted-foreground text-sm">
          The payment was cancelled. No charges were made.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={() => navigate("/pos")}>Back to POS</Button>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  )
}
