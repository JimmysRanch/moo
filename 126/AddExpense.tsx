import { useState } from 'react'
import { getTodayInBusinessTimezone } from "@/lib/date-utils"
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Receipt } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useCreateExpense } from "@/hooks/data/useExpenses"

export function AddExpense() {
  const navigate = useNavigate()
  const createExpense = useCreateExpense()
  const [formData, setFormData] = useState({
    vendor: '',
    amount: '',
    category: '',
    date: getTodayInBusinessTimezone(),
    description: '',
    status: 'yes'
  })

  const categories = [
    'Supplies',
    'Utilities',
    'Rent',
    'Software',
    'Marketing',
    'Insurance',
    'Maintenance',
    'Other'
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.vendor || !formData.amount || !formData.category) {
      toast.error('Please fill in all required fields')
      return
    }

    createExpense.mutate({
      category: formData.category,
      vendor: formData.vendor.trim(),
      date: formData.date,
      amount: Number.parseFloat(formData.amount),
      description: formData.description.trim()
    }, {
      onSuccess: () => {
        toast.success('Expense added successfully')
        navigate('/finances?tab=expenses')
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to add expense')
      }
    })
  }

  return (
    <div data-testid="page-add-expense" className="min-h-full bg-background text-foreground p-3 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 md:mb-6">
          <Button 
            variant="ghost" 
            className="gap-2 -ml-2 mb-3 md:mb-4"
            onClick={() => navigate('/finances?tab=expenses')}
          >
            <ArrowLeft size={18} />
            Back to Expenses
          </Button>
          <div className="flex items-center gap-3">
            <Receipt size={28} className="text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Add Expense</h1>
              <p className="text-sm text-muted-foreground">Record a new business expense</p>
            </div>
          </div>
        </div>

        <Card className="border-border">
          <form onSubmit={handleSubmit}>
            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor">Who did you pay? *</Label>
                  <Input
                    id="vendor"
                    placeholder="e.g., Pet Supply Co"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">How much did you pay? *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Enter the total you paid, including tax.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat.toLowerCase()}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">When did you pay it? *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Has this been paid yet?</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">What was this for?</Label>
                <Textarea
                  id="description"
                  placeholder="Dog shampoo, grooming table, dryer repair, etc."
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            <div className="p-4 md:p-6 border-t border-border flex flex-col-reverse md:flex-row gap-3 justify-end">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate('/finances?tab=expenses')}
              >
                Cancel
              </Button>
              <Button data-testid="expense-save" type="submit" className="gap-2">
                <Receipt size={18} />
                Save Expense
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
