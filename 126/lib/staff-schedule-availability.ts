import type { Appointment } from '@/lib/types'
import type { StaffSchedule, StaffScheduleOverride } from '@/hooks/data/useStaffExtensions'
import { parseTimeToMinutes } from '@/lib/time'
import { getEffectiveStaffScheduleForDate } from '@/lib/staff-schedule-overrides'

type AppointmentAvailabilityInput = Pick<Appointment, 'date' | 'endTime' | 'groomerId' | 'startTime' | 'status'>

export function isStaffAvailableAt({
  appointments,
  date,
  durationMinutes,
  maxAppointmentsPerSlot,
  overrides = [],
  schedules,
  slot,
  staffId,
}: {
  appointments: AppointmentAvailabilityInput[]
  date: string
  durationMinutes: number
  maxAppointmentsPerSlot: number
  overrides?: StaffScheduleOverride[]
  schedules: StaffSchedule[]
  slot: string
  staffId: string
}): boolean {
  const slotStartMinutes = parseTimeToMinutes(slot) ?? 0
  const slotEndMinutes = slotStartMinutes + durationMinutes
  const { breakBlocks, isUnavailable, workingBlocks } = getEffectiveStaffScheduleForDate({
    date,
    overrides,
    schedules,
    staffId,
  })

  if (isUnavailable) return false

  const isInsideWork = workingBlocks.some((entry) => {
    const start = parseTimeToMinutes(entry.start_time) ?? 0
    const end = parseTimeToMinutes(entry.end_time) ?? 0
    return slotStartMinutes >= start && slotEndMinutes <= end
  })
  if (!isInsideWork) return false

  const overlapsBreak = breakBlocks.some((entry) => {
    const start = parseTimeToMinutes(entry.start_time) ?? 0
    const end = parseTimeToMinutes(entry.end_time) ?? 0
    return slotStartMinutes < end && slotEndMinutes > start
  })
  if (overlapsBreak) return false

  const overlappingAppointments = appointments.filter((appointment) => {
    if (appointment.groomerId !== staffId || appointment.date !== date || appointment.status === 'cancelled') {
      return false
    }

    const appointmentStart = parseTimeToMinutes(appointment.startTime) ?? 0
    const fallbackEnd = appointmentStart + 60
    const appointmentEndRaw = parseTimeToMinutes(appointment.endTime) ?? 0
    const appointmentEnd = appointmentEndRaw > appointmentStart ? appointmentEndRaw : fallbackEnd
    return slotStartMinutes < appointmentEnd && slotEndMinutes > appointmentStart
  })

  return overlappingAppointments.length < maxAppointmentsPerSlot
}
