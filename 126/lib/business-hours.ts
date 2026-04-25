import { format, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { getBusinessTimezone } from './date-utils'
import { parseTimeToMinutes } from './time'

export interface HoursOfOperation {
  day: string
  isOpen: boolean
  openTime: string
  closeTime: string
}

export const DEFAULT_HOURS_OF_OPERATION: HoursOfOperation[] = [
  { day: 'Monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
  { day: 'Tuesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
  { day: 'Wednesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
  { day: 'Thursday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
  { day: 'Friday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
  { day: 'Saturday', isOpen: true, openTime: '10:00', closeTime: '16:00' },
  { day: 'Sunday', isOpen: false, openTime: '09:00', closeTime: '17:00' }
]

const formatMinutesToLabel = (minutes: number): string => {
  const totalMinutes = ((minutes % 1440) + 1440) % 1440
  const hours24 = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hour12 = hours24 % 12 || 12
  return `${hour12}:${mins.toString().padStart(2, '0')} ${period}`
}

export const formatTimeLabel = (time: string): string => {
  const minutes = parseTimeToMinutes(time)
  if (minutes === null) return time
  return formatMinutesToLabel(minutes)
}

export const getHoursForDate = (
  date: string,
  hoursOfOperation: HoursOfOperation[]
): HoursOfOperation | null => {
  if (!date) return null
  const timezone = getBusinessTimezone()
  const zonedDate = toZonedTime(parseISO(date), timezone)
  const dayName = format(zonedDate, 'EEEE')
  return hoursOfOperation.find((hours) => hours.day === dayName) || null
}

export const getTimeSlotsForDate = (
  date: string,
  hoursOfOperation: HoursOfOperation[],
  intervalMinutes = 60
): string[] => {
  const hoursForDate = getHoursForDate(date, hoursOfOperation)
  if (!hoursForDate || !hoursForDate.isOpen) return []
  const openMinutes = parseTimeToMinutes(hoursForDate.openTime)
  const closeMinutes = parseTimeToMinutes(hoursForDate.closeTime)
  if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes) return []
  const slots: string[] = []
  for (let minutes = openMinutes; minutes < closeMinutes; minutes += intervalMinutes) {
    slots.push(formatMinutesToLabel(minutes))
  }
  return slots
}

export const isTimeWithinBusinessHours = (
  date: string,
  time: string,
  hoursOfOperation: HoursOfOperation[]
): boolean => {
  const hoursForDate = getHoursForDate(date, hoursOfOperation)
  if (!hoursForDate || !hoursForDate.isOpen) return false
  const openMinutes = parseTimeToMinutes(hoursForDate.openTime)
  const closeMinutes = parseTimeToMinutes(hoursForDate.closeTime)
  const timeMinutes = parseTimeToMinutes(time)
  if (openMinutes === null || closeMinutes === null || timeMinutes === null) return false
  return timeMinutes >= openMinutes && timeMinutes < closeMinutes
}
