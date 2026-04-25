import { Receipt, PawPrint } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useNavigate } from "react-router-dom"

interface PaymentRecord {
  id: string
  date: string
  total: string
  paid: string
  tip: string
  method: string
  status: string
  pets: {
    name: string
    services: string[]
    cost: string
  }[]
}

interface PaymentHistoryDialogProps {
  clientName: string
  payments: PaymentRecord[]
}

export function PaymentHistoryDialog({ clientName, payments }: PaymentHistoryDialogProps) {
  const navigate = useNavigate()
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          className="font-semibold transition-all duration-200 hover:scale-[1.02]"
        >
          <Receipt size={18} className="mr-2" />
          Payment History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Receipt size={24} className="text-primary" />
            Payment History - {clientName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          <div className="space-y-4 py-2">
            {payments.map((payment) => (
              <Card key={payment.id} className="p-4 bg-card border-border">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{payment.date}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant={payment.status === "Paid" ? "default" : "secondary"}
                        className={payment.status === "Paid" ? "bg-primary/20 text-primary" : ""}
                      >
                        {payment.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{payment.method}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 px-2"
                    onClick={() => navigate(`/receipts/${payment.id}`)}
                  >
                    View Receipt
                  </Button>
                </div>

                <div className="space-y-3 mb-3">
                  {payment.pets.map((pet, index) => (
                    <div key={index}>
                      <p className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                        <PawPrint size={14} weight="fill" className="text-primary" />
                        {pet.name}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {pet.services.map((service, sIndex) => (
                          <div key={sIndex} className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-primary"></span>
                            {service}
                          </div>
                        ))}
                      </div>
                      <p className="text-sm font-medium mt-1 text-right">{pet.cost}</p>
                      {index < payment.pets.length - 1 && <Separator className="mt-3" />}
                    </div>
                  ))}
                </div>

                <Separator className="mb-3" />

                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{payment.paid}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tip</span>
                    <span className="font-medium">{payment.tip}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span className="text-primary">{payment.total}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
