export type ExpenseRecord = {
  id: string
  category: string
  vendor: string
  date: string
  status: "Paid" | "Pending"
  amount: number
  description: string
}

export type PaymentDetail = {
  id: string
  date: string
  client: string
  service: string
  amount: number
  tip: number
  method: string
  notes?: string
}
