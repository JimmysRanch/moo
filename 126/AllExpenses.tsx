import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, MagnifyingGlass, FunnelSimple, Download, Plus } from '@phosphor-icons/react'
import { useExpenses } from "@/hooks/data/useExpenses"
import { expensesFromDb } from "@/lib/mappers/expenseMapper"
import { formatDateForDisplay } from "@/lib/date-utils"

export function AllExpenses() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const { data: dbExpenses } = useExpenses()
  const expenses = useMemo(() => dbExpenses ? expensesFromDb(dbExpenses) : [], [dbExpenses])

  const filteredExpenses = (expenses || []).filter(expense => {
    const matchesSearch = expense.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || expense.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

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
            <h1 className="text-2xl md:text-3xl font-bold">All Expenses</h1>
            <p className="text-sm text-muted-foreground">Complete expense history</p>
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <FunnelSimple size={16} className="mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Supplies">Supplies</SelectItem>
              <SelectItem value="Rent">Rent</SelectItem>
              <SelectItem value="Utilities">Utilities</SelectItem>
              <SelectItem value="Software">Software</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => navigate('/finances/add-expense')}>
            <Plus size={18} className="mr-2" />
            Add Expense
          </Button>
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
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
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Date</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Vendor</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Category</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Description</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-sm text-muted-foreground whitespace-nowrap">{formatDateForDisplay(expense.date)}</td>
                      <td className="p-3 text-sm font-semibold">{expense.vendor}</td>
                      <td className="p-3">
                        <span className="text-sm font-semibold">
                          {expense.category}
                        </span>
                      </td>
                      <td className="p-3 text-sm">{expense.description}</td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${
                          expense.status === 'Paid' 
                            ? 'bg-emerald-500/20 text-emerald-600' 
                            : 'bg-amber-500/20 text-amber-600'
                        }`}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="p-3 text-sm font-bold text-right tabular-nums">${expense.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredExpenses.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No expenses found matching your filters.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
