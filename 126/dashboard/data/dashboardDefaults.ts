export const appointmentData = {
  today: {
    scheduled: 0,
    completed: 0,
    canceled: 0,
    noShows: 0,
    late: 0,
  },
}

export const capacityData = {
  bookedPercentage: 0,
  target: 0,
}

export const revenueData = {
  today: {
    total: 0,
    profit: 0,
    tips: 0,
    commission: 0,
  },
  thisWeek: {
    total: 0,
    percentChange: 0,
    daily: [
      { day: 'Mon', date: '—', amount: 0 },
    ],
  },
}

export const issuesData = {
  lateArrivals: 0,
  noShows: 0,
  canceled: 0,
}

export const bookingHeatmapData: Array<{
  date: string
  dayOfWeek: string
  dayOfMonth: number
  bookedPercentage: number
  bookedSlots: number
  totalSlots: number
  openSlots: number
}> = []

export const bookingRateData: Array<{
  period: string
  percentage: number
  previousYearPercentage: number
}> = []

export const dashboardGroomerData: Array<{
  id: number
  name: string
  bookedPercentage: number
  appointmentCount: number
  lastAppointmentEnd: string
  schedule: Array<{ start: number; duration: number; client: string }>
}> = []

export const dashboardGroomerWeekData: Array<{
  id: number
  name: string
  weekUtilization: number
  weekAppointments: number
  weekSchedule: Array<{
    day: string
    utilization: number
    appointments: Array<{ start: number; duration: number }>
  }>
}> = []

export const clientMetrics = {
  returningClients: 0,
  newClients: 0,
  vipClients: 0,
  lapsedClients: 0,
}

export const dashboardRecentActivity: Array<{
  id: string
  type: string
  category: string
  description: string
  client: string
  time: string
}> = []

export const bookingSummary = {
  today: 0,
  week: 0,
  month: 0,
}

export const dashboardTopServicesData: Array<{
  name: string
  count: number
  revenue: number
  icon: string
}> = []

export const dashboardTopBreedsData: Array<{
  name: string
  count: number
  avgVisitValue?: number
}> = []

export const dashboardExpensesData: Array<{
  category: string
  amount: number
  color: string
}> = []

export const dogsGroomedData = {
  day: 0,
  week: 0,
  month: 0,
  lifetime: 0,
}

export const bookedPercentageData = {
  day: 0,
  week: 0,
  month: 0,
}

export const clientsData = {
  total: 0,
  newThisMonth: 0,
  repeatRate: 0,
  avgDaysBetween: 0,
}
