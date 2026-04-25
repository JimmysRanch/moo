import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Info, Receipt } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDateForDisplay, getTodayInBusinessTimezone } from '@/lib/date-utils'
import {
  buildSalesTaxPeriodSummaries,
  DEFAULT_SALES_TAX_SETTINGS,
  SALES_TAX_DISCLAIMER,
  normalizeSalesTaxSettings,
  upsertSalesTaxHistoryEntry,
} from '@/lib/salesTax'
import { paymentClient } from '@/stripe/client'
import { useTransactionItemsForTransactions, useTransactions, type TransactionItem } from '@/hooks/data/useTransactions'

export function FileTaxes() {
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [detailsLocked, setDetailsLocked] = useState(true)
  const [formData, setFormData] = useState({
    period: '',
    taxCollected: '',
    taxRate: DEFAULT_SALES_TAX_SETTINGS.rate,
    filingDate: getTodayInBusinessTimezone(),
    confirmationNumber: '',
    notes: '',
  })

  const { data: dbTransactions } = useTransactions()
  const transactionIds = useMemo(() => (dbTransactions || []).map((transaction) => transaction.id), [dbTransactions])
  const { data: dbTransactionItems } = useTransactionItemsForTransactions(transactionIds)
  const { data: taxSettings = DEFAULT_SALES_TAX_SETTINGS } = useQuery({
    queryKey: ['pos-tax-settings'],
    queryFn: async () => {
      const res = await paymentClient.getPosSettings()
      return normalizeSalesTaxSettings(res.settings?.sales_tax)
    },
  })

  const itemsByTransactionId = useMemo(() => {
    return (dbTransactionItems || []).reduce<Record<string, TransactionItem[]>>((acc, item) => {
      acc[item.transaction_id] = [...(acc[item.transaction_id] || []), item]
      return acc
    }, {})
  }, [dbTransactionItems])

  const periods = useMemo(
    () => buildSalesTaxPeriodSummaries(dbTransactions || [], itemsByTransactionId, taxSettings, new Date(), 12),
    [dbTransactions, itemsByTransactionId, taxSettings]
  )

  const selectedPeriod = periods.find((period) => period.periodKey === formData.period)
  const selectedHistoryEntry = taxSettings.filingHistory.find((entry) => entry.periodKey === formData.period)
  const taxRateValue = Number.parseFloat(formData.taxRate || '0')
  const taxRateDecimal = taxRateValue > 0 ? taxRateValue / 100 : 0
  const taxCollectedValue = Number.parseFloat(formData.taxCollected || '0')
  const estimatedGrossSales = taxRateDecimal > 0
    ? (taxCollectedValue / taxRateDecimal).toFixed(2)
    : '0.00'

  const populatePeriodDetails = useCallback((periodKey: string) => {
    const nextPeriod = periods.find((period) => period.periodKey === periodKey)
    const existingEntry = taxSettings.filingHistory.find((entry) => entry.periodKey === periodKey)
    if (!nextPeriod) return

    setFormData((current) => ({
      ...current,
      period: periodKey,
      taxCollected: (existingEntry?.taxCollected ?? nextPeriod.taxCollected).toFixed(2),
      taxRate: taxSettings.rate,
      filingDate: existingEntry?.filedAt ?? existingEntry?.paidAt ?? getTodayInBusinessTimezone(),
      confirmationNumber: existingEntry?.confirmationNumber ?? '',
      notes: existingEntry?.notes ?? '',
    }))
    setDetailsLocked(true)
  }, [periods, taxSettings.filingHistory, taxSettings.rate])

  useEffect(() => {
    if (periods.length === 0 || formData.period) return
    const defaultPeriod = periods.find((period) => period.status !== 'paid') ?? periods[0]
    populatePeriodDetails(defaultPeriod.periodKey)
  }, [formData.period, periods, populatePeriodDetails])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.period || !formData.taxCollected || !selectedPeriod) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSaving(true)

    try {
        await paymentClient.setPosSettings({
          sales_tax: upsertSalesTaxHistoryEntry(taxSettings, {
            periodKey: selectedPeriod.periodKey,
            status: 'paid',
            paidAt: formData.filingDate,
            periodLabel: selectedPeriod.periodLabel,
            startDate: selectedPeriod.startDate,
            endDate: selectedPeriod.endDate,
            dueDate: selectedPeriod.dueDate,
            totalSales: selectedPeriod.totalSales,
            taxableSales: selectedPeriod.taxableSales,
            taxCollected: taxCollectedValue,
            filedAt: formData.filingDate,
            confirmationNumber: formData.confirmationNumber,
            notes: formData.notes,
          }),
        })

      toast.success('Tax filing recorded successfully')
      navigate('/finances?tab=taxes')
    } catch (error) {
      toast.error('Failed to record tax filing')
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-background text-foreground p-3 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 md:mb-6">
          <Button
            variant="ghost"
            className="gap-2 -ml-2 mb-3 md:mb-4"
            onClick={() => navigate('/finances?tab=taxes')}
          >
            <ArrowLeft size={18} />
            Back to Finances
          </Button>
          <div className="flex items-center gap-3">
            <Receipt size={28} className="text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">File Taxes</h1>
              <p className="text-sm text-muted-foreground">Record sales tax filing for a period</p>
            </div>
          </div>
        </div>

        <Card className="border-border bg-blue-500/10 mb-4">
          <div className="p-4 flex gap-3">
            <Info size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-500 mb-1">Recording Information</p>
              <p className="text-muted-foreground">
                This form updates your internal sales-tax filing history after you file with your state's tax authority. {SALES_TAX_DISCLAIMER}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-border">
          <form onSubmit={handleSubmit}>
            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="period">Tax Period *</Label>
                  <Select
                    value={formData.period}
                    onValueChange={populatePeriodDetails}
                  >
                    <SelectTrigger id="period">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      {periods.map((period) => (
                        <SelectItem key={period.periodKey} value={period.periodKey}>
                          {period.periodLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filingDate">Filing Date *</Label>
                  <Input
                    id="filingDate"
                    type="date"
                    value={formData.filingDate}
                    onChange={(e) => setFormData({ ...formData, filingDate: e.target.value })}
                    disabled={detailsLocked}
                    required
                  />
                </div>
              </div>

              {selectedPeriod && (
                <Card className="border-border bg-muted/30">
                  <div className="p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Status</span>
                      <div className="flex items-center gap-2">
                        {selectedHistoryEntry?.status === 'paid' && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Recorded
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailsLocked((current) => !current)}
                        >
                          {detailsLocked ? 'Edit details' : 'Lock details'}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Selected period</span>
                      <span className="font-medium">{selectedPeriod.periodLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Due date</span>
                      <span className="font-medium">{formatDateForDisplay(selectedPeriod.dueDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Tracked amount</span>
                      <span className="font-medium">
                        ${selectedPeriod.taxCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Filing details are auto-filled from the selected period and your current sales-tax settings. Use Edit details only if you need to override them.
                    </p>
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxCollected">Tax Collected *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="taxCollected"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      value={formData.taxCollected}
                      onChange={(e) => setFormData({ ...formData, taxCollected: e.target.value })}
                      disabled={detailsLocked}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    placeholder="8.25"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                    disabled={detailsLocked}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmationNumber">Confirmation Number</Label>
                <Input
                  id="confirmationNumber"
                  placeholder="Enter filing confirmation number"
                  value={formData.confirmationNumber}
                  onChange={(e) => setFormData({ ...formData, confirmationNumber: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional details about this filing..."
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              {formData.taxCollected && formData.taxRate && (
                <Card className="bg-muted/50 border-border p-4">
                  <h3 className="font-bold text-sm mb-3">Filing Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gross Sales (estimated):</span>
                      <span className="font-medium">${estimatedGrossSales}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax Rate:</span>
                      <span className="font-medium">{formData.taxRate}%</span>
                    </div>
                    <div className="pt-2 border-t border-border flex justify-between">
                      <span className="font-bold">Tax Collected:</span>
                      <span className="font-bold text-lg">${taxCollectedValue.toFixed(2)}</span>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            <div className="p-4 md:p-6 border-t border-border flex flex-col-reverse md:flex-row gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/finances?tab=taxes')}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" className="gap-2" disabled={isSaving || periods.length === 0}>
                <Receipt size={18} />
                {isSaving ? 'Recording…' : 'Record Filing'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
