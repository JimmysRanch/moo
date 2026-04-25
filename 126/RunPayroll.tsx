import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, CalendarBlank, CheckCircle, CurrencyDollar, Lock, Wallet, WarningCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/AuthContext'
import { useStore } from '@/contexts/StoreContext'
import { useStaff } from '@/hooks/data/useStaff'
import { useAppointmentServicesByAppointmentIds, useAppointments } from '@/hooks/data/useAppointments'
import { useClients, useAllPets } from '@/hooks/data/useClients'
import {
  usePayrollPeriods,
  usePayrollSettings,
  useUpsertPayrollPeriod,
  useUpdatePayrollPeriod,
} from '@/hooks/data/usePayroll'
import { useAllStaffCompensations } from '@/hooks/data/useStaffExtensions'
import { useAppointmentCheckoutMap } from '@/hooks/useAppointmentCheckout'
import { getPayrollPermissions } from '@/lib/payrollPermissions'
import { payrollSettingsFromDb } from '@/lib/mappers/payrollMapper'
import { formatPayPeriodType, getCurrentPayPeriod, isPayPeriodSettingsComplete } from '@/lib/payroll-utils'
import { hydrateAppointmentsForPayroll } from '@/lib/payrollDisplay'
import { calculatePayrollSummaries, createPayrollPeriodPayload } from '@/lib/payrollProcessing'

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`
}

export function RunPayroll() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { role } = useStore()
  const permissions = getPayrollPermissions(role)
  const { data: dbStaff } = useStaff()
  const { data: dbAppointments } = useAppointments()
  const appointmentIds = useMemo(() => (dbAppointments ?? []).map((appointment) => appointment.id), [dbAppointments])
  const { data: dbAppointmentServices } = useAppointmentServicesByAppointmentIds(appointmentIds)
  const { data: dbClients } = useClients()
  const { data: dbPets } = useAllPets()
  const { data: payrollSettingsRecord } = usePayrollSettings()
  const { data: payrollPeriods } = usePayrollPeriods()
  const { data: allStaffCompensations } = useAllStaffCompensations()
  const checkoutByAppointmentId = useAppointmentCheckoutMap()
  const upsertPayrollPeriod = useUpsertPayrollPeriod()
  const updatePayrollPeriod = useUpdatePayrollPeriod()

  const payPeriodSettings = useMemo(
    () => (payrollSettingsRecord ? payrollSettingsFromDb(payrollSettingsRecord) : null),
    [payrollSettingsRecord]
  )

  const appointments = useMemo(() => hydrateAppointmentsForPayroll({
    dbAppointments,
    dbAppointmentServices,
    dbClients,
    dbPets,
    dbStaff,
  }), [dbAppointmentServices, dbAppointments, dbClients, dbPets, dbStaff])

  const staffCompensationMap = useMemo(
    () => new Map((allStaffCompensations ?? []).map((record) => [record.staff_id, record])),
    [allStaffCompensations]
  )

  const currentPayPeriod = useMemo(
    () => (isPayPeriodSettingsComplete(payPeriodSettings) ? getCurrentPayPeriod(payPeriodSettings) : null),
    [payPeriodSettings]
  )

  const currentPayrollPeriods = useMemo(() => {
    if (!currentPayPeriod) return []
    return (payrollPeriods ?? []).filter(
      (period) => period.period_start === currentPayPeriod.startDate && period.period_end === currentPayPeriod.endDate
    )
  }, [currentPayPeriod, payrollPeriods])

  const payrollSummaries = useMemo(() => {
    if (!payrollSettingsRecord || !currentPayPeriod || !dbStaff) return []
    return calculatePayrollSummaries({
      appointments,
      checkoutByAppointmentId,
      staffMembers: dbStaff,
      staffCompensationMap,
      payrollSettings: payrollSettingsRecord,
      payPeriod: currentPayPeriod,
      existingPayrollPeriods: currentPayrollPeriods,
    })
  }, [appointments, checkoutByAppointmentId, currentPayPeriod, currentPayrollPeriods, dbStaff, payrollSettingsRecord, staffCompensationMap])

  const periodStatus = useMemo(() => {
    if (currentPayrollPeriods.length === 0) return 'unsaved'
    if (currentPayrollPeriods.every((period) => period.status === 'paid')) return 'paid'
    if (currentPayrollPeriods.every((period) => period.status === 'finalized' || period.status === 'paid')) return 'finalized'
    return 'draft'
  }, [currentPayrollPeriods])

  const totalGrossPay = payrollSummaries.reduce((sum, summary) => sum + summary.grossPay, 0)
  const totalTips = payrollSummaries.reduce((sum, summary) => sum + summary.tips, 0)
  const totalPayroll = payrollSummaries.reduce((sum, summary) => sum + summary.totalPay, 0)
  const editablePayrollSummaries = useMemo(
    () => payrollSummaries.filter((summary) => !summary.existingPeriod || summary.existingPeriod.status === 'draft'),
    [payrollSummaries]
  )

  const persistPayroll = async (status: 'draft' | 'finalized') => {
    try {
      if (!permissions.canManagePayroll) {
        toast.error('You do not have permission to manage payroll.')
        return
      }

      if (!payrollSettingsRecord || !currentPayPeriod || !isPayPeriodSettingsComplete(payPeriodSettings)) {
        toast.error('Complete payroll settings before running payroll.')
        return
      }

      if (payrollSummaries.length === 0) {
        toast.error('No payroll entries were found for the current pay period.')
        return
      }

      if (editablePayrollSummaries.length === 0) {
        toast.error(status === 'draft'
          ? 'All payroll entries for this pay period are already finalized or paid.'
          : 'There are no editable draft payroll entries to finalize.')
        return
      }

      await Promise.all(
        editablePayrollSummaries.map((summary) =>
          upsertPayrollPeriod.mutateAsync(
            createPayrollPeriodPayload(summary, currentPayPeriod, payPeriodSettings, status, user?.id)
          )
        )
      )

      toast.success(status === 'draft' ? 'Payroll draft saved.' : 'Payroll finalized and locked.')
    } catch (error) {
      console.error(error)
      toast.error('Failed to save payroll.')
    }
  }

  const markPayrollPaid = async () => {
    try {
      if (!permissions.canManagePayroll) {
        toast.error('You do not have permission to manage payroll.')
        return
      }

      const finalizedPeriods = currentPayrollPeriods.filter((period) => period.status === 'finalized')
      if (finalizedPeriods.length === 0) {
        toast.error('Finalize payroll before marking it as paid.')
        return
      }

      await Promise.all(
        finalizedPeriods.map((period) =>
          updatePayrollPeriod.mutateAsync({
            id: period.id,
            updated_at: period.updated_at,
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
        )
      )

      toast.success('Payroll marked as paid.')
    } catch (error) {
      console.error(error)
      toast.error('Failed to mark payroll as paid.')
    }
  }

  if (!permissions.canViewPayroll) {
    return (
      <div className="min-h-full bg-background text-foreground p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <Card className="p-8 text-center border-border">
            <Lock size={48} className="mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">Payroll access restricted</h1>
            <p className="text-muted-foreground">
              Payroll data is only available to managers and owners for the active store.
            </p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background text-foreground p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <Button
            variant="ghost"
            className="gap-2 -ml-2 mb-3"
            onClick={() => navigate('/finances')}
          >
            <ArrowLeft size={18} />
            Back to Finances
          </Button>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Run Payroll</h1>
              <p className="text-sm text-muted-foreground">
                Review live payroll calculations, save a draft, finalize the snapshot, and mark it paid.
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {periodStatus === 'paid' ? 'Paid' : periodStatus === 'finalized' ? 'Finalized' : periodStatus === 'draft' ? 'Draft saved' : 'Not saved'}
            </Badge>
          </div>
        </div>

        {!isPayPeriodSettingsComplete(payPeriodSettings) ? (
          <Alert>
            <WarningCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
              <span>Payroll settings must be saved before payroll can run.</span>
              <Button variant="outline" size="sm" onClick={() => navigate('/settings?tab=payroll')}>
                Open Payroll Settings
              </Button>
            </AlertDescription>
          </Alert>
        ) : currentPayPeriod ? (
          <Card className="border-border bg-primary/10">
            <div className="p-4 md:p-6 flex items-start gap-3">
              <CalendarBlank size={24} className="text-primary mt-0.5" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pay Frequency</p>
                  <p className="font-semibold">{formatPayPeriodType(payPeriodSettings.type)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pay Period</p>
                  <p className="font-semibold">
                    {format(parseISO(currentPayPeriod.startDate), 'MMM d')} - {format(parseISO(currentPayPeriod.endDate), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pay Date</p>
                  <p className="font-semibold text-primary">
                    {format(parseISO(currentPayPeriod.payDate), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-border">
            <div className="flex items-center gap-2 mb-2">
              <CurrencyDollar size={20} className="text-primary" />
              <h2 className="font-semibold">Gross payroll</h2>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalGrossPay)}</p>
            <p className="text-sm text-muted-foreground">Before payroll-funded tips</p>
          </Card>
          <Card className="p-4 border-border">
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={20} className="text-primary" />
              <h2 className="font-semibold">Tips in payroll</h2>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalTips)}</p>
            <p className="text-sm text-muted-foreground">Card tips only</p>
          </Card>
          <Card className="p-4 border-border">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={20} className="text-primary" />
              <h2 className="font-semibold">Total payout</h2>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalPayroll)}</p>
            <p className="text-sm text-muted-foreground">{payrollSummaries.length} staff record(s)</p>
          </Card>
        </div>

        <Card className="border-border">
          <div className="p-4 md:p-6 border-b border-border flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-semibold">Payroll details</h2>
              <p className="text-sm text-muted-foreground">
                Drafts stay editable. Finalized payroll rows are locked and paid rows only track payment.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => persistPayroll('draft')}
                disabled={editablePayrollSummaries.length === 0}
              >
                Save Draft
              </Button>
              <Button
                variant="outline"
                onClick={() => persistPayroll('finalized')}
                disabled={periodStatus === 'paid' || editablePayrollSummaries.length === 0}
              >
                Finalize Payroll
              </Button>
              <Button
                onClick={markPayrollPaid}
                disabled={periodStatus === 'paid' || periodStatus === 'unsaved' || currentPayrollPeriods.every((period) => period.status !== 'finalized')}
              >
                Mark as Paid
              </Button>
            </div>
          </div>

          {payrollSummaries.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No completed appointments were found for the current pay period.</div>
          ) : (
            <div className="divide-y divide-border">
              {payrollSummaries.map((summary) => (
                <div key={summary.staffId} className="p-4 md:p-6 space-y-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-lg">{summary.staffName}</h3>
                      <p className="text-sm text-muted-foreground">{summary.role}</p>
                    </div>
                    <Badge variant="outline">
                      {summary.status === 'paid' ? 'Paid' : summary.status === 'finalized' ? 'Finalized' : summary.existingPeriod ? 'Draft saved' : 'Live preview'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Revenue</p>
                      <p className="font-semibold">{formatCurrency(summary.totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Hours</p>
                      <p className="font-semibold">{summary.totalHours.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Commission</p>
                      <p className="font-semibold">{formatCurrency(summary.commissionPay)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Hourly / Salary</p>
                      <p className="font-semibold">{formatCurrency(summary.hourlyPay + summary.salaryPay)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Pay</p>
                      <p className="font-semibold text-primary">{formatCurrency(summary.totalPay)}</p>
                    </div>
                  </div>

                  {(summary.teamOverridePay > 0 || summary.guaranteePay > 0 || summary.tips > 0) && (
                    <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
                      {summary.teamOverridePay > 0 && <span>Team overrides {formatCurrency(summary.teamOverridePay)}</span>}
                      {summary.guaranteePay > 0 && <span>Guarantee {formatCurrency(summary.guaranteePay)}</span>}
                      {summary.tips > 0 && <span>Tips {formatCurrency(summary.tips)}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
