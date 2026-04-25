import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CurrencyDollar, Plus } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useStaff } from "@/hooks/data/useStaff"
import {
  useCreateStaffCompensation,
  useStaffCompensation,
  useUpdateStaffCompensation,
  type StaffCompensation as StaffCompensationRecord,
} from "@/hooks/data/useStaffExtensions"
import { staffListFromDb } from "@/lib/mappers/staffMapper"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"
import { cn } from "@/lib/utils"

type GuaranteePayoutMode = "both" | "higher"

interface TeamOverride {
  staffId: string
  staffName: string
  percentage: number
}

interface CompensationConfig {
  commission: {
    enabled: boolean
    percentage: number
  }
  hourly: {
    enabled: boolean
    rate: number
  }
  salary: {
    enabled: boolean
    annualAmount: number
  }
  weeklyGuarantee: {
    enabled: boolean
    amount: number
    payoutMode: GuaranteePayoutMode
  }
  teamOverrides: {
    enabled: boolean
    overrides: TeamOverride[]
  }
}

interface StaffCompensationProps {
  staffId?: string
  staffName: string
  showHeader?: boolean
}

interface StaffOption {
  id: string
  name: string
  isActive: boolean
}

interface CompensationOptionCardProps {
  title: string
  description: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
  children?: ReactNode
}

function createDefaultConfig(): CompensationConfig {
  return {
    commission: { enabled: false, percentage: 0 },
    hourly: { enabled: false, rate: 0 },
    salary: { enabled: false, annualAmount: 0 },
    weeklyGuarantee: { enabled: false, amount: 0, payoutMode: "higher" },
    teamOverrides: { enabled: false, overrides: [] }
  }
}

function parseNumericValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseTeamOverrides(
  value: StaffCompensationRecord["team_overrides"],
  staffOptions: Map<string, StaffOption>
): TeamOverride[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((override) => {
      if (!override || typeof override !== "object") {
        return null
      }

      const staffId = typeof override.staffId === "string" ? override.staffId : ""
      if (!staffId) {
        return null
      }

      const percentage = parseNumericValue(override.percentage)
      const resolvedStaff = staffOptions.get(staffId)

      return {
        staffId,
        staffName: resolvedStaff?.name ?? "Unknown staff member",
        percentage,
      }
    })
    .filter((override): override is TeamOverride => override !== null)
}

function configFromRecord(
  record: StaffCompensationRecord | null | undefined,
  staffOptions: Map<string, StaffOption>
): CompensationConfig {
  if (!record) {
    return createDefaultConfig()
  }

  const commissionPercentage = parseNumericValue(record.commission_percentage)
  const hourlyRate = parseNumericValue(record.hourly_rate)
  const salaryAnnualAmount = parseNumericValue(record.salary_annual_amount)
  const weeklyGuaranteeAmount = parseNumericValue(record.weekly_guarantee_amount)
  const teamOverrides = parseTeamOverrides(record.team_overrides ?? [], staffOptions)

  return {
    commission: {
      enabled: commissionPercentage > 0,
      percentage: commissionPercentage,
    },
    hourly: {
      enabled: hourlyRate > 0,
      rate: hourlyRate,
    },
    salary: {
      enabled: salaryAnnualAmount > 0,
      annualAmount: salaryAnnualAmount,
    },
    weeklyGuarantee: {
      enabled: weeklyGuaranteeAmount > 0,
      amount: weeklyGuaranteeAmount,
      payoutMode: record.weekly_guarantee_payout_mode === "both" ? "both" : "higher",
    },
    teamOverrides: {
      enabled: teamOverrides.length > 0,
      overrides: teamOverrides,
    },
  }
}

function CompensationOptionCard({
  title,
  description,
  enabled,
  onToggle,
  children,
}: CompensationOptionCardProps) {
  return (
    <Card
      className={cn(
        "p-4 bg-secondary/20 border-border transition-colors",
        enabled && "border-primary/50 bg-secondary/30"
      )}
    >
      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => onToggle(!enabled)}
        className="flex w-full items-start gap-3 text-left"
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
            enabled ? "border-primary bg-primary/15" : "border-muted-foreground/40 bg-background/80"
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full transition-colors",
              enabled ? "bg-primary" : "bg-transparent"
            )}
          />
        </span>
        <div className="space-y-1">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </button>

      {enabled && children ? (
        <div className="mt-4 border-t border-border/60 pt-4">
          {children}
        </div>
      ) : null}
    </Card>
  )
}

export function StaffCompensation({ staffId, staffName, showHeader = true }: StaffCompensationProps) {
  const { data: dbStaff } = useStaff()
  const { data: dbCompensation, isLoading } = useStaffCompensation(staffId)
  const createCompensation = useCreateStaffCompensation()
  const updateCompensation = useUpdateStaffCompensation()

  const isSaving = createCompensation.isPending || updateCompensation.isPending

  const allStaffOptions = useMemo<StaffOption[]>(() => {
    return staffListFromDb(dbStaff ?? [])
      .filter((member) => member.id !== staffId)
      .map((member) => ({
        id: member.id,
        name: member.name,
        isActive: member.status === "Active",
      }))
  }, [dbStaff, staffId])

  const staffOptionMap = useMemo(
    () => new Map(allStaffOptions.map((member) => [member.id, member])),
    [allStaffOptions]
  )

  const activeStaffOptions = useMemo(
    () => allStaffOptions.filter((member) => member.isActive),
    [allStaffOptions]
  )

  const [config, setConfig] = useState<CompensationConfig>(() => createDefaultConfig())
  const [initialConfig, setInitialConfig] = useState<CompensationConfig>(() => createDefaultConfig())
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) {
      return
    }

    const nextConfig = configFromRecord(dbCompensation, staffOptionMap)
    setConfig(nextConfig)
    setInitialConfig(nextConfig)
    setCurrentUpdatedAt(dbCompensation?.updated_at ?? null)
  }, [dbCompensation, isLoading, staffOptionMap])

  const formSnapshot = useMemo(() => JSON.stringify(config), [config])
  const initialSnapshot = useMemo(() => JSON.stringify(initialConfig), [initialConfig])
  const hasUnsavedChanges = formSnapshot !== initialSnapshot

  useUnsavedChangesGuard({
    hasUnsavedChanges: hasUnsavedChanges && !isSaving,
    message: "You have unsaved compensation updates. Leaving now will discard those changes. Continue?"
  })

  const validateConfig = (): boolean => {
    if (config.commission.enabled && config.commission.percentage <= 0) {
      toast.error("Commission percentage must be greater than 0")
      return false
    }
    if (config.hourly.enabled && config.hourly.rate <= 0) {
      toast.error("Hourly rate must be greater than 0")
      return false
    }
    if (config.salary.enabled && config.salary.annualAmount <= 0) {
      toast.error("Salary amount must be greater than 0")
      return false
    }
    if (config.weeklyGuarantee.enabled && config.weeklyGuarantee.amount <= 0) {
      toast.error("Weekly guarantee amount must be greater than 0")
      return false
    }
    if (config.weeklyGuarantee.enabled && !config.commission.enabled) {
      toast.error("Weekly Guarantee requires Commission to be enabled")
      return false
    }
    if (config.weeklyGuarantee.enabled && (config.hourly.enabled || config.salary.enabled)) {
      toast.error("Weekly Guarantee cannot be combined with Hourly or Salary")
      return false
    }
    if (config.salary.enabled && config.hourly.enabled) {
      toast.error("Salary and Hourly cannot be enabled together")
      return false
    }
    if (config.salary.enabled && config.commission.enabled) {
      toast.error("Salary and Commission cannot be enabled together")
      return false
    }
    if (config.teamOverrides.enabled && config.teamOverrides.overrides.length === 0) {
      toast.error("Add at least one team override before saving")
      return false
    }
    if (config.teamOverrides.enabled) {
      const duplicateIds = new Set<string>()
      for (const override of config.teamOverrides.overrides) {
        if (!override.staffId) {
          toast.error("Select a team member for each override")
          return false
        }
        if (duplicateIds.has(override.staffId)) {
          toast.error("Each team member can only be selected once")
          return false
        }
        duplicateIds.add(override.staffId)
        if (override.percentage <= 0) {
          toast.error("Each team override percentage must be greater than 0")
          return false
        }
      }
    }
    return true
  }

  const handleSave = () => {
    if (!staffId) {
      toast.error("Staff member not found")
      return
    }
    if (!hasUnsavedChanges) {
      return
    }
    if (!validateConfig()) {
      return
    }

    const payload = {
      staff_id: staffId,
      commission_percentage: config.commission.enabled ? config.commission.percentage : 0,
      hourly_rate: config.hourly.enabled ? config.hourly.rate : 0,
      salary_annual_amount: config.salary.enabled ? config.salary.annualAmount : null,
      weekly_guarantee_amount: config.weeklyGuarantee.enabled ? config.weeklyGuarantee.amount : null,
      weekly_guarantee_payout_mode: config.weeklyGuarantee.enabled ? config.weeklyGuarantee.payoutMode : null,
      team_overrides: config.teamOverrides.enabled
        ? config.teamOverrides.overrides.map((override) => ({
            staffId: override.staffId,
            percentage: override.percentage,
          }))
        : [],
      service_commission_overrides: dbCompensation?.service_commission_overrides ?? {},
    }

    const mutation = dbCompensation ? updateCompensation : createCompensation
    mutation.mutate(
      dbCompensation
        ? {
            ...payload,
            updated_at: currentUpdatedAt ?? dbCompensation.updated_at,
          }
        : payload,
      {
        onSuccess: (result) => {
          toast.success("Compensation configuration saved successfully")
          setInitialConfig(config)
          setCurrentUpdatedAt(result.updated_at)
        },
      }
    )
  }

  const remainingActiveStaffCount = activeStaffOptions.filter(
    (member) => !config.teamOverrides.overrides.some((override) => override.staffId === member.id)
  ).length

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">Compensation</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Combine hourly pay, commission, guarantees, and team overrides to match how {staffName} earns.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <CompensationOptionCard
          title="Commission on personal grooms"
          description="Pay a percentage of every dog this staff member personally grooms."
          enabled={config.commission.enabled}
          onToggle={(enabled) => {
            setConfig(prev => ({
              ...prev,
              commission: { ...prev.commission, enabled }
            }))
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="commission-percentage">Commission %</Label>
            <Input
              id="commission-percentage"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={config.commission.percentage || ""}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                commission: { ...prev.commission, percentage: parseFloat(e.target.value) || 0 }
              }))}
              placeholder="50"
              className="max-w-[200px]"
            />
          </div>
        </CompensationOptionCard>

        <CompensationOptionCard
          title="Hourly pay"
          description="Guarantee an hourly base rate in addition to any other earnings."
          enabled={config.hourly.enabled}
          onToggle={(enabled) => {
            setConfig(prev => ({
              ...prev,
              hourly: { ...prev.hourly, enabled }
            }))
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="hourly-rate">Hourly rate ($)</Label>
            <Input
              id="hourly-rate"
              type="number"
              min="0"
              step="0.01"
              value={config.hourly.rate || ""}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                hourly: { ...prev.hourly, rate: parseFloat(e.target.value) || 0 }
              }))}
              placeholder="1"
              className="max-w-[200px]"
            />
          </div>
        </CompensationOptionCard>

        <CompensationOptionCard
          title="Salary"
          description="Track an annual salary amount for reporting and payroll exports."
          enabled={config.salary.enabled}
          onToggle={(enabled) => {
            setConfig(prev => ({
              ...prev,
              salary: { ...prev.salary, enabled }
            }))
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="salary-amount">Salary (annual $)</Label>
            <Input
              id="salary-amount"
              type="number"
              min="0"
              step="1000"
              value={config.salary.annualAmount || ""}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                salary: { ...prev.salary, annualAmount: parseFloat(e.target.value) || 0 }
              }))}
              placeholder="1000"
              className="max-w-[200px]"
            />
          </div>
        </CompensationOptionCard>

        <CompensationOptionCard
          title="Weekly guarantee vs. commission"
          description="Guarantee pay per week and choose whether it&apos;s paid alongside their commission or whichever amount is higher."
          enabled={config.weeklyGuarantee.enabled}
          onToggle={(enabled) => {
            setConfig(prev => ({
              ...prev,
              weeklyGuarantee: { ...prev.weeklyGuarantee, enabled }
            }))
          }}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="weekly-guarantee">Weekly guarantee ($)</Label>
              <Input
                id="weekly-guarantee"
                type="number"
                min="0"
                step="50"
                value={config.weeklyGuarantee.amount || ""}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  weeklyGuarantee: { ...prev.weeklyGuarantee, amount: parseFloat(e.target.value) || 0 }
                }))}
                placeholder="500"
                className="max-w-[200px]"
              />
            </div>

            <div>
              <Label className="text-sm font-semibold mb-3 block">How should the guarantee pay out?</Label>
              <RadioGroup
                value={config.weeklyGuarantee.payoutMode}
                onValueChange={(value) => setConfig(prev => ({
                  ...prev,
                  weeklyGuarantee: { ...prev.weeklyGuarantee, payoutMode: value as GuaranteePayoutMode }
                }))}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                  <RadioGroupItem value="both" id="payout-both" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="payout-both" className="cursor-pointer">
                      <div className="font-semibold">Pay the weekly guarantee and their commission</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        They receive both the guaranteed amount and whatever commission they earn.
                      </p>
                    </Label>
                  </div>
                </div>

                <div className="flex items-start space-x-3 rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                  <RadioGroupItem value="higher" id="payout-higher" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="payout-higher" className="cursor-pointer">
                      <div className="font-semibold">Pay whichever amount is higher</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Compare their commission earnings to the guarantee and pay the larger amount.
                      </p>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        </CompensationOptionCard>

        <CompensationOptionCard
          title="Team overrides"
          description="Pay them an extra share of the appointments completed by groomers they manage. This amount comes out of the business share—the groomers below them keep their full commission."
          enabled={config.teamOverrides.enabled}
          onToggle={(enabled) => {
            setConfig(prev => ({
              ...prev,
              teamOverrides: { ...prev.teamOverrides, enabled }
            }))
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose from the current active staff members when setting up override relationships.
            </p>

            <div className="space-y-3">
              {config.teamOverrides.overrides.map((override, index) => {
                const selectedStaffIds = config.teamOverrides.overrides
                  .filter((_, overrideIndex) => overrideIndex !== index)
                  .map((item) => item.staffId)
                const selectableStaff = allStaffOptions.filter((member) => {
                  if (member.id === override.staffId) {
                    return true
                  }
                  return member.isActive && !selectedStaffIds.includes(member.id)
                })

                return (
                  <div key={`${override.staffId || "override"}-${index}`} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3 lg:flex-row lg:items-end">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Team member</Label>
                      <Select
                        value={override.staffId || "__select__"}
                        onValueChange={(value) => {
                          const selectedStaff = staffOptionMap.get(value)
                          setConfig(prev => {
                            const overrides = [...prev.teamOverrides.overrides]
                            overrides[index] = {
                              ...overrides[index],
                              staffId: value,
                              staffName: selectedStaff?.name ?? "",
                            }
                            return {
                              ...prev,
                              teamOverrides: { ...prev.teamOverrides, overrides }
                            }
                          })
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__select__" disabled>Select staff member</SelectItem>
                          {selectableStaff.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full lg:w-40">
                      <Label className="text-sm font-medium">Override % of appointment revenue</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={override.percentage || ""}
                        onChange={(e) => {
                          const updatedOverrides = [...config.teamOverrides.overrides]
                          updatedOverrides[index] = { ...updatedOverrides[index], percentage: parseFloat(e.target.value) || 0 }
                          setConfig(prev => ({
                            ...prev,
                            teamOverrides: { ...prev.teamOverrides, overrides: updatedOverrides }
                          }))
                        }}
                        placeholder="20"
                        className="mt-1"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const overrides = config.teamOverrides.overrides.filter((_, overrideIndex) => overrideIndex !== index)
                        setConfig(prev => ({
                          ...prev,
                          teamOverrides: { ...prev.teamOverrides, overrides }
                        }))
                      }}
                      className="text-destructive hover:text-destructive lg:mb-0.5"
                    >
                      Remove
                    </Button>
                  </div>
                )
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setConfig(prev => ({
                    ...prev,
                    teamOverrides: {
                      ...prev.teamOverrides,
                      overrides: [
                        ...prev.teamOverrides.overrides,
                        { staffId: "", staffName: "", percentage: 0 }
                      ]
                    }
                  }))
                }}
                className="w-full"
                disabled={remainingActiveStaffCount === 0}
              >
                <Plus size={16} className="mr-2" />
                Add override
              </Button>
            </div>
          </div>
        </CompensationOptionCard>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CurrencyDollar size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Pay Summary</h3>
              <p className="text-xs text-muted-foreground">Compensation structure for this staff member</p>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-3">
            {!config.commission.enabled && !config.hourly.enabled && !config.salary.enabled && !config.weeklyGuarantee.enabled && !config.teamOverrides.enabled && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No compensation configured yet. Enable at least one compensation method above.
              </div>
            )}

            {config.commission.enabled && (
              <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium">Commission</span>
                <span className="font-bold">{config.commission.percentage}%</span>
              </div>
            )}

            {config.hourly.enabled && (
              <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium">Hourly Rate</span>
                <span className="font-bold">${config.hourly.rate.toFixed(2)}/hr</span>
              </div>
            )}

            {config.salary.enabled && (
              <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium">Annual Salary</span>
                <span className="font-bold">${config.salary.annualAmount.toLocaleString()}</span>
              </div>
            )}

            {config.weeklyGuarantee.enabled && (
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium">Weekly Guarantee</span>
                  <span className="font-bold">${config.weeklyGuarantee.amount.toFixed(2)}</span>
                </div>
                <div className="pl-3 py-2 border-l-2 border-primary/30">
                  <p className="text-xs text-muted-foreground">
                    {config.weeklyGuarantee.payoutMode === "higher"
                      ? "Pay whichever is higher: guarantee or commission"
                      : "Pay both guarantee + full commission"}
                  </p>
                </div>
              </div>
            )}

            {config.teamOverrides.enabled && config.teamOverrides.overrides.length > 0 && (
              <div className="space-y-2">
                {config.teamOverrides.overrides.map((override, index) => (
                  <div key={index} className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium">Team Override ({override.staffName || "Unassigned"})</span>
                    <span className="font-bold">{override.percentage}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </Card>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setConfig(initialConfig)}
            disabled={!hasUnsavedChanges || isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!hasUnsavedChanges || isSaving || isLoading}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}
