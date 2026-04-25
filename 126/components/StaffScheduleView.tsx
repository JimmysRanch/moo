import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useAppearance } from '@/hooks/useAppearance'
import { cn } from '@/lib/utils'

import { useStaff } from '@/hooks/data/useStaff'
import {
  type StaffAttendanceStatus,
  type StaffScheduleOverrideType,
  useDeleteStaffScheduleOverride,
  useStaffScheduleOverrides,
  useStaffSchedules,
  useUpsertStaffScheduleOverride,
} from '@/hooks/data/useStaffExtensions'
import { staffListFromDb } from '@/lib/mappers/staffMapper'
import {
  dateToBusinessDateString,
  formatDateString,
  getTodayDateInBusinessTimezone,
} from '@/lib/date-utils'
import { getEffectiveStaffScheduleForDate, getStaffScheduleOverrideForDate } from '@/lib/staff-schedule-overrides'

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

interface WorkBlock {
  id: string
  startTime: string
  endTime: string
  isBreak?: boolean
}

interface WeeklyTemplate {
  monday: WorkBlock[]
  tuesday: WorkBlock[]
  wednesday: WorkBlock[]
  thursday: WorkBlock[]
  friday: WorkBlock[]
  saturday: WorkBlock[]
  sunday: WorkBlock[]
}

interface StaffRecurringSchedule {
  weeklyTemplate: WeeklyTemplate
  setupComplete: boolean
}

const DAYS_OF_WEEK: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DB_DAY_KEYS: Array<'sunday' | DayKey> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const ATTENDANCE_LABELS: Record<StaffAttendanceStatus, string> = {
  late: 'Late',
  sick_personal: 'Sick / Personal',
  no_call_no_show: 'No Call No Show',
}
const SCHEDULE_OVERRIDE_LABELS: Record<StaffScheduleOverrideType, string> = {
  approved_day_off: 'Approved Day Off',
  block_hours: 'Block Hours',
  modify_hours: 'Modify Hours',
}

function getEmptyWeeklyTemplate(): WeeklyTemplate {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  }
}

function formatScheduleTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes.toString().padStart(2, '0')}`
}

function normalizeTimeInputValue(time?: string | null): string {
  return time ? time.slice(0, 5) : ''
}

function getMonthDates(date: Date): Date[] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const dates: Date[] = []
  const startDay = firstDay.getDay()
  const adjustedStart = startDay === 0 ? 6 : startDay - 1

  for (let i = 0; i < adjustedStart; i += 1) {
    dates.push(new Date(year, month, -adjustedStart + i + 1))
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    dates.push(new Date(year, month, day))
  }

  return dates
}

function getMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}

export function StaffScheduleView({ staffId, isOwner = true, allowEditing = true }: { staffId?: string; isOwner?: boolean; allowEditing?: boolean }) {
  const navigate = useNavigate()
  const { selectedTheme } = useAppearance()
  const isIndustrialTheme = selectedTheme === 'steel-noir' || selectedTheme === 'blue-steel'
  const { data: dbStaff } = useStaff()
  const { data: dbSchedules } = useStaffSchedules(staffId)
  const { data: dbScheduleOverrides } = useStaffScheduleOverrides(staffId)
  const upsertOverride = useUpsertStaffScheduleOverride({ suppressGlobalError: true })
  const deleteOverride = useDeleteStaffScheduleOverride({ suppressGlobalError: true })

  const [roleFilter, setRoleFilter] = useState('All')
  const [selectedMonth, setSelectedMonth] = useState(getTodayDateInBusinessTimezone())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isDayEditorOpen, setIsDayEditorOpen] = useState(false)
  const [attendanceStatus, setAttendanceStatus] = useState<StaffAttendanceStatus | null>(null)
  const [actualArrivalTime, setActualArrivalTime] = useState('')
  const [scheduleOverrideType, setScheduleOverrideType] = useState<StaffScheduleOverrideType | null>(null)
  const [overrideStartTime, setOverrideStartTime] = useState('09:00')
  const [overrideEndTime, setOverrideEndTime] = useState('17:00')

  const staffMembers = useMemo(() => staffListFromDb(dbStaff ?? []), [dbStaff])
  const isTeamView = !staffId
  const currentMonth = selectedMonth.getMonth()
  const monthDates = useMemo(() => getMonthDates(selectedMonth), [selectedMonth])

  const recurringScheduleMap = useMemo(() => {
    const schedulesByStaff = new Map<string, StaffRecurringSchedule>()

    const getSchedule = (currentStaffId: string) => {
      const existing = schedulesByStaff.get(currentStaffId)
      if (existing) return existing

      const nextSchedule: StaffRecurringSchedule = {
        weeklyTemplate: getEmptyWeeklyTemplate(),
        setupComplete: false,
      }
      schedulesByStaff.set(currentStaffId, nextSchedule)
      return nextSchedule
    }

    for (const schedule of dbSchedules ?? []) {
      const dayKey = DB_DAY_KEYS[schedule.day_of_week]
      if (!dayKey) continue

      const staffSchedule = getSchedule(schedule.staff_id)
      staffSchedule.weeklyTemplate[dayKey].push({
        id: schedule.id,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        isBreak: !schedule.is_available,
      })
      staffSchedule.setupComplete = true
    }

    for (const schedule of schedulesByStaff.values()) {
      for (const day of DAYS_OF_WEEK) {
        schedule.weeklyTemplate[day].sort((a, b) => a.startTime.localeCompare(b.startTime))
      }
    }

    return schedulesByStaff
  }, [dbSchedules])

  const filteredStaff = roleFilter === 'All'
    ? staffMembers
    : staffMembers.filter((member) => member.role === roleFilter)
  const displayStaff = staffId
    ? staffMembers.filter((member) => member.id === staffId)
    : filteredStaff
  const selectedStaff = displayStaff[0] ?? null
  const selectedOverride = useMemo(() => {
    if (!selectedDate || !selectedStaff) return null
    return getStaffScheduleOverrideForDate({
      date: selectedDate,
      overrides: dbScheduleOverrides ?? [],
      staffId: selectedStaff.id,
    })
  }, [dbScheduleOverrides, selectedDate, selectedStaff])

  useEffect(() => {
    if (!isDayEditorOpen) return

    setAttendanceStatus(selectedOverride?.attendance_status ?? null)
    setActualArrivalTime(normalizeTimeInputValue(selectedOverride?.actual_arrival_time))
    setScheduleOverrideType(selectedOverride?.schedule_override_type ?? null)
    setOverrideStartTime(normalizeTimeInputValue(selectedOverride?.start_time) || '09:00')
    setOverrideEndTime(normalizeTimeInputValue(selectedOverride?.end_time) || '17:00')
  }, [isDayEditorOpen, selectedOverride])

  const getStaffRecurringSchedule = (currentStaffId: string): StaffRecurringSchedule => {
    return recurringScheduleMap.get(currentStaffId) ?? {
      weeklyTemplate: getEmptyWeeklyTemplate(),
      setupComplete: false,
    }
  }

  const clearAttendance = () => {
    setAttendanceStatus(null)
    setActualArrivalTime('')
  }

  const clearScheduleOverride = () => {
    setScheduleOverrideType(null)
    setOverrideStartTime('09:00')
    setOverrideEndTime('17:00')
  }

  const handleAttendanceToggle = (nextStatus: StaffAttendanceStatus) => {
    if (attendanceStatus === nextStatus) {
      clearAttendance()
      return
    }

    if (nextStatus === 'late') {
      setAttendanceStatus('late')
      if (scheduleOverrideType === 'approved_day_off') {
        clearScheduleOverride()
      }
      return
    }

    setAttendanceStatus(nextStatus)
    setActualArrivalTime('')
    clearScheduleOverride()
  }

  const handleScheduleOverrideToggle = (nextType: StaffScheduleOverrideType) => {
    if (scheduleOverrideType === nextType) {
      clearScheduleOverride()
      return
    }

    setScheduleOverrideType(nextType)

    if (nextType === 'approved_day_off') {
      clearAttendance()
      setOverrideStartTime('09:00')
      setOverrideEndTime('17:00')
      return
    }

    if (attendanceStatus === 'sick_personal' || attendanceStatus === 'no_call_no_show') {
      clearAttendance()
    }
  }

  const openDayEditor = (dateString: string) => {
    if (!selectedStaff || !allowEditing || !isOwner) return
    setSelectedDate(dateString)
    setIsDayEditorOpen(true)
  }

  const canResetDay = Boolean(selectedOverride || attendanceStatus || actualArrivalTime || scheduleOverrideType)
  const requiresArrivalTime = attendanceStatus === 'late'
  const requiresOverrideHours = scheduleOverrideType === 'block_hours' || scheduleOverrideType === 'modify_hours'
  const hasScheduleSelection = Boolean(scheduleOverrideType)
  const hasAttendanceSelection = Boolean(attendanceStatus)
  const hasValidOverrideHours = !requiresOverrideHours || (overrideStartTime !== '' && overrideEndTime !== '' && overrideStartTime < overrideEndTime)
  const canSaveDay = selectedDate != null && selectedStaff != null && (
    (hasAttendanceSelection && (!requiresArrivalTime || actualArrivalTime !== ''))
    || (hasScheduleSelection && hasValidOverrideHours)
    || selectedOverride != null
  )

  const handleResetDay = () => {
    if (selectedOverride && selectedStaff) {
      deleteOverride.mutate(
        { overrideId: selectedOverride.id, staffId: selectedStaff.id, updated_at: selectedOverride.updated_at },
        {
          onSuccess: () => {
            toast.success('Day reset')
            setIsDayEditorOpen(false)
          },
          onError: (error) => {
            toast.error(getMutationErrorMessage(error, 'Failed to reset day override.'))
          },
        },
      )
      return
    }

    clearAttendance()
    clearScheduleOverride()
  }

  const handleSaveDay = () => {
    if (!selectedDate || !selectedStaff) return

    let nextAttendanceStatus = attendanceStatus
    let nextActualArrivalTime = attendanceStatus === 'late' ? actualArrivalTime : null
    let nextScheduleOverrideType = scheduleOverrideType
    let nextStartTime: string | null = null
    let nextEndTime: string | null = null

    if (nextAttendanceStatus === 'sick_personal' || nextAttendanceStatus === 'no_call_no_show') {
      nextScheduleOverrideType = null
    }

    if (nextScheduleOverrideType === 'approved_day_off') {
      nextAttendanceStatus = null
      nextActualArrivalTime = null
    }

    if (nextAttendanceStatus === 'late' && !nextActualArrivalTime) {
      toast.error('Enter the actual arrival time.')
      return
    }

    if (nextScheduleOverrideType === 'block_hours' || nextScheduleOverrideType === 'modify_hours') {
      if (!overrideStartTime || !overrideEndTime || overrideStartTime >= overrideEndTime) {
        toast.error('Enter valid times with end time after start time.')
        return
      }
      nextStartTime = overrideStartTime
      nextEndTime = overrideEndTime
    }

    if (!nextAttendanceStatus && !nextScheduleOverrideType) {
      if (selectedOverride) {
        handleResetDay()
      } else {
        setIsDayEditorOpen(false)
      }
      return
    }

    upsertOverride.mutate(
      {
        id: selectedOverride?.id,
        updated_at: selectedOverride?.updated_at,
        staff_id: selectedStaff.id,
        override_date: selectedDate,
        attendance_status: nextAttendanceStatus,
        actual_arrival_time: nextActualArrivalTime,
        schedule_override_type: nextScheduleOverrideType,
        start_time: nextStartTime,
        end_time: nextEndTime,
      },
      {
        onSuccess: () => {
          toast.success('Day updated')
          setIsDayEditorOpen(false)
        },
        onError: (error) => {
          toast.error(getMutationErrorMessage(error, 'Failed to save day override.'))
        },
      },
    )
  }

  return (
    <div className="staff-schedule-theme space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {isTeamView ? (
          <div>
            <h3 className="text-lg font-semibold">Weekly Staff Schedule</h3>
            <p className="text-sm text-muted-foreground">
              Review each team member&apos;s recurring availability across the week.
            </p>
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          {isTeamView && (
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Roles</SelectItem>
                <SelectItem value="Groomer">Groomers</SelectItem>
                <SelectItem value="Bather">Bathers</SelectItem>
                <SelectItem value="Front Desk">Front Desk</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isTeamView ? (
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[220px_repeat(7,minmax(0,1fr))] bg-muted/40 border-b border-border">
                <div className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Staff</div>
                {DAY_LABELS.map((label) => (
                  <div key={label} className="p-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {label.substring(0, 3)}
                  </div>
                ))}
              </div>

              <div className="divide-y divide-border">
                {displayStaff.length === 0 && (
                  <div className="p-6 text-sm text-muted-foreground">No staff members available.</div>
                )}
                {displayStaff.map((staff) => {
                  const schedule = getStaffRecurringSchedule(staff.id)

                  return (
                    <div key={staff.id} className="grid grid-cols-[220px_repeat(7,minmax(0,1fr))]">
                      <div className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="font-semibold">{staff.name}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                              {staff.role}
                            </Badge>
                            {!schedule.setupComplete && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] text-yellow-600 border-yellow-500/30",
                                  isIndustrialTheme && "border-primary/35 bg-primary/15 text-primary"
                                )}
                              >
                                Needs Schedule
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {DAYS_OF_WEEK.map((day) => {
                        const blocks = schedule.weeklyTemplate[day]

                        return (
                          <div key={day} className="p-3 border-l border-border">
                            {blocks.length === 0 ? (
                              <div className="text-xs text-muted-foreground">Off</div>
                            ) : (
                              <div className="space-y-1">
                                {blocks.map((block) => (
                                  <div
                                    key={block.id}
                                    className={cn(
                                      "rounded-md px-2 py-1 text-[11px] font-medium",
                                      block.isBreak
                                        ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                        : 'bg-primary/10 text-primary border border-primary/20',
                                      isIndustrialTheme && "border-primary/35 bg-primary/15 text-primary"
                                    )}
                                  >
                                    {block.isBreak ? 'Break · ' : ''}{formatScheduleTime(block.startTime)} - {formatScheduleTime(block.endTime)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <div className="p-2 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Previous month"
                onClick={() => {
                  const prevMonth = new Date(selectedMonth)
                  prevMonth.setMonth(prevMonth.getMonth() - 1)
                  setSelectedMonth(prevMonth)
                }}
              >
                <CaretLeft size={14} />
              </Button>
              <div className="h-8 min-w-[180px] px-3 rounded-md border border-input bg-background text-xs font-semibold flex items-center justify-center whitespace-nowrap">
                {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Next month"
                onClick={() => {
                  const nextMonth = new Date(selectedMonth)
                  nextMonth.setMonth(nextMonth.getMonth() + 1)
                  setSelectedMonth(nextMonth)
                }}
              >
                <CaretRight size={14} />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && allowEditing && selectedStaff && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/staff/${selectedStaff.id}/schedule/edit`)}
                >
                  Add / Edit Schedule
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-7 bg-muted/40 border-b border-border">
            {DAY_LABELS.map((label) => (
              <div key={label} className="p-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label.substring(0, 3)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border">
            {!selectedStaff && (
              <div className="col-span-7 p-6 text-sm text-muted-foreground">
                No staff member selected.
              </div>
            )}
            {selectedStaff && monthDates.map((date) => {
              const dateString = dateToBusinessDateString(date)
              const daySchedule = getEffectiveStaffScheduleForDate({
                date: dateString,
                overrides: dbScheduleOverrides ?? [],
                schedules: dbSchedules ?? [],
                staffId: selectedStaff.id,
              })
              const isToday = dateString === dateToBusinessDateString(getTodayDateInBusinessTimezone())
              const isCurrentMonth = date.getMonth() === currentMonth
              const primaryLabel = daySchedule.isUnavailable
                ? (daySchedule.attendanceStatus
                    ? ATTENDANCE_LABELS[daySchedule.attendanceStatus]
                    : daySchedule.scheduleOverrideType
                      ? SCHEDULE_OVERRIDE_LABELS[daySchedule.scheduleOverrideType]
                      : null)
                : null
              const secondaryLabel = daySchedule.attendanceStatus === 'late' && daySchedule.actualArrivalTime
                ? `${ATTENDANCE_LABELS.late} · ${formatScheduleTime(daySchedule.actualArrivalTime)}`
                : daySchedule.scheduleOverrideType === 'block_hours' && daySchedule.override?.start_time && daySchedule.override?.end_time
                  ? `Blocked · ${formatScheduleTime(daySchedule.override.start_time)} - ${formatScheduleTime(daySchedule.override.end_time)}`
                  : null

              const content = (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <div className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {date.getDate()}
                    </div>
                    {daySchedule.scheduleOverrideType === 'modify_hours' && !daySchedule.isUnavailable && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1.5 py-0 border-blue-500/30 text-blue-600",
                          isIndustrialTheme && "border-primary/35 bg-primary/15 text-primary"
                        )}
                      >
                        Modified
                      </Badge>
                    )}
                    {daySchedule.attendanceStatus === 'late' && !daySchedule.isUnavailable && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1.5 py-0 border-amber-500/30 text-amber-600",
                          isIndustrialTheme && "border-primary/35 bg-primary/15 text-primary"
                        )}
                      >
                        Late
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 space-y-1 text-left">
                    {primaryLabel ? (
                      <div className={cn("text-[9px] font-medium text-red-600", isIndustrialTheme && "text-primary")}>{primaryLabel}</div>
                    ) : daySchedule.workingBlocks.length > 0 ? (
                      daySchedule.workingBlocks.map((block) => (
                        <div
                          key={block.id}
                          className={cn(
                            "rounded-md px-1 py-0.5 text-[9px] leading-tight bg-primary/10 text-primary border border-primary/20",
                            isIndustrialTheme && "bg-primary/15 border-primary/35"
                          )}
                          title={`${formatScheduleTime(block.start_time)}-${formatScheduleTime(block.end_time)}`}
                        >
                          {formatScheduleTime(block.start_time)} - {formatScheduleTime(block.end_time)}
                        </div>
                      ))
                    ) : (
                      <div className="text-[9px] text-muted-foreground">No shifts</div>
                    )}
                    {secondaryLabel && !primaryLabel && (
                      <div className={cn("text-[9px] text-amber-600", isIndustrialTheme && "text-primary")}>{secondaryLabel}</div>
                    )}
                  </div>
                </>
              )

              if (allowEditing && isOwner) {
                return (
                  <button
                    key={dateString}
                    type="button"
                    aria-label={`Edit schedule for ${formatDateString(dateString, 'MMMM d, yyyy')}`}
                    className={cn(
                      "min-h-[72px] p-1 bg-card text-left transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary",
                      isIndustrialTheme && "hover:bg-primary/10",
                      !isCurrentMonth ? 'opacity-40' : ''
                    )}
                    onClick={() => openDayEditor(dateString)}
                  >
                    {content}
                  </button>
                )
              }

              return (
                <div key={dateString} className={`min-h-[72px] p-1 bg-card ${!isCurrentMonth ? 'opacity-40' : ''}`}>
                  {content}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Dialog open={isDayEditorOpen} onOpenChange={setIsDayEditorOpen}>
        <DialogContent aria-describedby={undefined} className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedDate ? formatDateString(selectedDate, 'MMMM d, yyyy') : ''}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            <div className="space-y-3">
              <div className="text-sm font-semibold">Attendance</div>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant={attendanceStatus === 'late' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => handleAttendanceToggle('late')}
                >
                  {ATTENDANCE_LABELS.late}
                </Button>
                {attendanceStatus === 'late' && (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <Label htmlFor="actual-arrival-time">Actual arrival time</Label>
                    <Input
                      id="actual-arrival-time"
                      type="time"
                      step="60"
                      value={actualArrivalTime}
                      onChange={(event) => setActualArrivalTime(event.target.value)}
                    />
                  </div>
                )}

                <Button
                  type="button"
                  variant={attendanceStatus === 'sick_personal' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => handleAttendanceToggle('sick_personal')}
                >
                  {ATTENDANCE_LABELS.sick_personal}
                </Button>

                <Button
                  type="button"
                  variant={attendanceStatus === 'no_call_no_show' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => handleAttendanceToggle('no_call_no_show')}
                >
                  {ATTENDANCE_LABELS.no_call_no_show}
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="text-sm font-semibold">Schedule Override</div>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant={scheduleOverrideType === 'approved_day_off' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => handleScheduleOverrideToggle('approved_day_off')}
                >
                  {SCHEDULE_OVERRIDE_LABELS.approved_day_off}
                </Button>

                <Button
                  type="button"
                  variant={scheduleOverrideType === 'block_hours' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => handleScheduleOverrideToggle('block_hours')}
                >
                  {SCHEDULE_OVERRIDE_LABELS.block_hours}
                </Button>
                {scheduleOverrideType === 'block_hours' && (
                  <div className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="block-start-time">Start time</Label>
                      <Input
                        id="block-start-time"
                        type="time"
                        step="60"
                        value={overrideStartTime}
                        onChange={(event) => setOverrideStartTime(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="block-end-time">End time</Label>
                      <Input
                        id="block-end-time"
                        type="time"
                        step="60"
                        value={overrideEndTime}
                        onChange={(event) => setOverrideEndTime(event.target.value)}
                      />
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  variant={scheduleOverrideType === 'modify_hours' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => handleScheduleOverrideToggle('modify_hours')}
                >
                  {SCHEDULE_OVERRIDE_LABELS.modify_hours}
                </Button>
                {scheduleOverrideType === 'modify_hours' && (
                  <div className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="modify-start-time">Start time</Label>
                      <Input
                        id="modify-start-time"
                        type="time"
                        step="60"
                        value={overrideStartTime}
                        onChange={(event) => setOverrideStartTime(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modify-end-time">End time</Label>
                      <Input
                        id="modify-end-time"
                        type="time"
                        step="60"
                        value={overrideEndTime}
                        onChange={(event) => setOverrideEndTime(event.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={handleResetDay} disabled={!canResetDay || deleteOverride.isPending}>
              Reset
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDayEditorOpen(false)} disabled={upsertOverride.isPending || deleteOverride.isPending}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveDay} disabled={!canSaveDay || upsertOverride.isPending || deleteOverride.isPending}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
