import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, MagnifyingGlass, FunnelSimple, Download, Circle } from '@phosphor-icons/react'
import { useExpenses } from "@/hooks/data/useExpenses"
import { expensesFromDb } from "@/lib/mappers/expenseMapper"
import { formatDateForDisplay } from "@/lib/date-utils"

export function UpcomingBills() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const { data: dbExpenses } = useExpenses()
  const expenses = useMemo(() => dbExpenses ? expensesFromDb(dbExpenses) : [], [dbExpenses])

  const pendingBills = (expenses || []).filter(expense => expense.status === 'Pending')
  
  const filteredBills = pendingBills.filter(bill => {
    const matchesSearch = bill.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bill.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'pending' && bill.status === 'Pending') ||
                         (statusFilter === 'paid' && bill.status === 'Paid')
    return matchesSearch && matchesStatus
  })

  const totalAmount = filteredBills.reduce((sum, bill) => sum + bill.amount, 0)

  const getDueInfo = (dateString: string) => {
    const dueDate = new Date(dateString + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffTime = dueDate.getTime() - today.getTime()
    const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const isOverdue = daysUntilDue < 0
    const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0
    const dueInText = isOverdue 
      ? `${Math.abs(daysUntilDue)} days overdue` 
      : daysUntilDue === 0 
        ? 'Due today' 
        : daysUntilDue === 1 
          ? 'Due in 1 day' 
          : `Due in ${daysUntilDue} days`
    return { daysUntilDue, isOverdue, isDueSoon, dueInText }
  }

  return (
    <div className="min-h-full bg-background p-3 md:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/finances?tab=expenses')}
          >
            <ArrowLeft size={24} />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Upcoming Bills</h1>
            <p className="text-sm text-muted-foreground">All pending and upcoming bills</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendor or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <FunnelSimple size={16} className="mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bills</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Pending</p>
              <p className="text-2xl font-bold">${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <Button variant="outline" size="sm">
              <Download size={16} className="mr-2" />
              Export
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Vendor</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Category</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Description</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Due Date</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase tracking-wider">Due In</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredBills.map((bill) => {
                    const { isOverdue, isDueSoon, dueInText } = getDueInfo(bill.date)
                    return (
                      <tr key={bill.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-sm font-semibold">{bill.vendor}</td>
                        <td className="p-3 text-sm">{bill.category}</td>
                        <td className="p-3 text-sm">{bill.description}</td>
                        <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">{formatDateForDisplay(bill.date)}</td>
                        <td className="p-3 text-center">
                          <span className={`text-sm flex items-center justify-center gap-1 ${
                            isOverdue ? 'text-red-500 font-semibold' : isDueSoon ? 'text-yellow-500 font-semibold' : 'text-muted-foreground'
                          }`}>
                            {dueInText}
                            {(isOverdue || isDueSoon) && (
                              <Circle size={8} className={isOverdue ? "text-red-500" : "text-yellow-500"} weight="fill" />
                            )}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${
                            bill.status === 'Paid' 
                              ? 'bg-emerald-500/20 text-emerald-600' 
                              : 'bg-amber-500/20 text-amber-600'
                          }`}>
                            {bill.status}
                          </span>
                        </td>
                        <td className="p-3 text-sm font-bold text-right tabular-nums">${bill.amount.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {filteredBills.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No upcoming bills found matching your filters.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
