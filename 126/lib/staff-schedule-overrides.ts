import type { StaffAttendanceStatus, StaffSchedule, StaffScheduleOverride, StaffScheduleOverrideType } from '@/hooks/data/useStaffExtensions'
import { parseDateStringAsLocal } from '@/lib/date-utils'

type EffectiveScheduleSource = 'recurring' | 'override'

export interface EffectiveStaffScheduleBlock {
  id: string
  start_time: string
  end_time: string
  is_available: boolean
  source: EffectiveScheduleSource
}

export interface EffectiveStaffScheduleForDate {
  attendanceStatus: StaffAttendanceStatus | null
  actualArrivalTime: string | null
  scheduleOverrideType: StaffScheduleOverrideType | null
  override: StaffScheduleOverride | null
  workingBlocks: EffectiveStaffScheduleBlock[]
  breakBlocks: EffectiveStaffScheduleBlock[]
  isUnavailable: boolean
}

function dayOfWeekForDate(date: string): number {
  return parseDateStringAsLocal(date).getDay()
}

function compareScheduleBlocksByStartTime(a: { start_time: string }, b: { start_time: string }) {
  return a.start_time.localeCompare(b.start_time)
}

export function getStaffScheduleOverrideForDate({
  date,
  overrides,
  staffId,
}: {
  date: string
  overrides: StaffScheduleOverride[]
  staffId: string
}): StaffScheduleOverride | null {
  return overrides.find((entry) => entry.staff_id === staffId && entry.override_date === date) ?? null
}

export function getEffectiveStaffScheduleForDate({
  date,
  overrides,
  schedules,
  staffId,
}: {
  date: string
  overrides: StaffScheduleOverride[]
  schedules: StaffSchedule[]
  staffId: string
}): EffectiveStaffScheduleForDate {
  const day = dayOfWeekForDate(date)
  const recurringBlocks = schedules
    .filter((entry) => entry.staff_id === staffId && entry.day_of_week === day)
    .sort(compareScheduleBlocksByStartTime)
  const recurringWorkingBlocks = recurringBlocks
    .filter((entry) => entry.is_available)
    .map((entry) => ({
      id: entry.id,
      start_time: entry.start_time,
      end_time: entry.end_time,
      is_available: true,
      source: 'recurring' as const,
    }))
  const recurringBreakBlocks = recurringBlocks
    .filter((entry) => !entry.is_available)
    .map((entry) => ({
      id: entry.id,
      start_time: entry.start_time,
      end_time: entry.end_time,
      is_available: false,
      source: 'recurring' as const,
    }))
  const override = getStaffScheduleOverrideForDate({ date, overrides, staffId })
  const attendanceStatus = override?.attendance_status ?? null
  const actualArrivalTime = override?.actual_arrival_time ?? null
  const scheduleOverrideType = override?.schedule_override_type ?? null
  const isUnavailableForAttendance = attendanceStatus === 'sick_personal' || attendanceStatus === 'no_call_no_show'
  const isUnavailable = isUnavailableForAttendance || scheduleOverrideType === 'approved_day_off'

  if (isUnavailable) {
    return {
      attendanceStatus,
      actualArrivalTime,
      scheduleOverrideType,
      override,
      workingBlocks: [],
      breakBlocks: [],
      isUnavailable: true,
    }
  }

  if (scheduleOverrideType === 'modify_hours' && override?.start_time && override?.end_time) {
    return {
      attendanceStatus,
      actualArrivalTime,
      scheduleOverrideType,
      override,
      workingBlocks: [{
        id: `override-${override.id}`,
        start_time: override.start_time,
        end_time: override.end_time,
        is_available: true,
        source: 'override',
      }],
      breakBlocks: [],
      isUnavailable: false,
    }
  }

  if (scheduleOverrideType === 'block_hours' && override?.start_time && override?.end_time) {
    return {
      attendanceStatus,
      actualArrivalTime,
      scheduleOverrideType,
      override,
      workingBlocks: recurringWorkingBlocks,
      breakBlocks: [
        ...recurringBreakBlocks,
        {
          id: `override-${override.id}`,
          start_time: override.start_time,
          end_time: override.end_time,
          is_available: false,
          source: 'override',
        },
      ].sort(compareScheduleBlocksByStartTime),
      isUnavailable: false,
    }
  }

  return {
    attendanceStatus,
    actualArrivalTime,
    scheduleOverrideType,
    override,
    workingBlocks: recurringWorkingBlocks,
    breakBlocks: recurringBreakBlocks,
    isUnavailable: false,
  }
}
