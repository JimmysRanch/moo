type AppointmentSummary = {
  today: {
    scheduled: number
    completed: number
    canceled: number
    noShows: number
    late: number
  }
}

export function calculateAppointmentProgress(appointmentData: AppointmentSummary) {
  const { scheduled, completed, canceled, noShows } = appointmentData.today
  const remaining = scheduled - completed - canceled - noShows
  const total = scheduled
  
  return {
    completed,
    remaining: Math.max(0, remaining),
    total,
    percentageComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
}

export function calculateRevenueChange(current: number, previous: number) {
  if (previous === 0) return 0
  return Math.round(((current - previous) / previous) * 100)
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatTime(hour: number) {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  const period = h >= 12 ? 'PM' : 'AM'
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return m > 0 ? `${displayHour}:${m.toString().padStart(2, '0')}${period}` : `${displayHour}${period}`
}

export function getBookingColor(percentage: number) {
  if (percentage >= 90) return 'oklch(0.75 0.15 340)'
  if (percentage >= 75) return 'oklch(0.75 0.15 60)'
  if (percentage >= 60) return 'oklch(0.75 0.15 120)'
  if (percentage >= 40) return 'oklch(0.75 0.15 195)'
  return 'oklch(0.55 0.10 195)'
}
