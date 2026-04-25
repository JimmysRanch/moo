export const appointmentData = {
  today: {
    scheduled: 18,
    completed: 12,
    canceled: 2,
    noShows: 1,
    late: 3,
  },
}

export const capacityData = {
  bookedPercentage: 82,
  target: 90,
}

export const revenueData = {
  today: {
    total: 1450,
    profit: 1160,
    tips: 145,
    commission: 290,
  },
  thisWeek: {
    total: 8250,
    percentChange: 12.5,
    daily: [
      { day: 'Mon', date: '12/15', amount: 1050 },
      { day: 'Tue', date: '12/16', amount: 1320 },
      { day: 'Wed', date: '12/17', amount: 980 },
      { day: 'Thu', date: '12/18', amount: 1450 },
      { day: 'Fri', date: '12/19', amount: 1680 },
      { day: 'Sat', date: '12/20', amount: 1420 },
      { day: 'Sun', date: '12/21', amount: 350 },
    ],
  },
}

export const issuesData = {
  lateArrivals: 3,
  noShows: 1,
  canceled: 2,
}

export const bookingHeatmapData = Array.from({ length: 14 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() + i)
  
  const bookedPercentage = Math.floor(Math.random() * 40) + 60
  const totalSlots = 20
  const bookedSlots = Math.floor((bookedPercentage / 100) * totalSlots)
  
  return {
    date: date.toISOString().split('T')[0],
    dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
    dayOfMonth: date.getDate(),
    bookedPercentage,
    bookedSlots,
    totalSlots,
    openSlots: totalSlots - bookedSlots,
  }
})

export const bookingRateData = [
  { period: 'Jan', percentage: 72, previousYearPercentage: 68 },
  { period: 'Feb', percentage: 85, previousYearPercentage: 78 },
  { period: 'Mar', percentage: 78, previousYearPercentage: 82 },
  { period: 'Apr', percentage: 91, previousYearPercentage: 85 },
  { period: 'May', percentage: 68, previousYearPercentage: 72 },
  { period: 'Jun', percentage: 82, previousYearPercentage: 79 },
  { period: 'Jul', percentage: 88, previousYearPercentage: 83 },
  { period: 'Aug', percentage: 76, previousYearPercentage: 74 },
  { period: 'Sep', percentage: 84, previousYearPercentage: 80 },
  { period: 'Oct', percentage: 79, previousYearPercentage: 76 },
  { period: 'Nov', percentage: 92, previousYearPercentage: 88 },
  { period: 'Dec', percentage: 87, previousYearPercentage: 85 },
]

export const groomerData = [
  {
    id: 1,
    name: 'Sarah Johnson',
    bookedPercentage: 95,
    appointmentCount: 8,
    lastAppointmentEnd: '5:30 PM',
    schedule: [
      { start: 8, duration: 1.5, client: 'Max (Golden)' },
      { start: 9.5, duration: 1, client: 'Luna (Poodle)' },
      { start: 11, duration: 2, client: 'Charlie (Husky)' },
      { start: 13, duration: 1, client: 'Bella (Shih Tzu)' },
      { start: 14.5, duration: 1.5, client: 'Rocky (Lab)' },
      { start: 16, duration: 1.5, client: 'Daisy (Terrier)' },
    ],
  },
  {
    id: 2,
    name: 'Mike Chen',
    bookedPercentage: 78,
    appointmentCount: 6,
    lastAppointmentEnd: '4:00 PM',
    schedule: [
      { start: 8.5, duration: 1, client: 'Buddy (Beagle)' },
      { start: 10, duration: 1.5, client: 'Coco (Yorkie)' },
      { start: 12, duration: 1, client: 'Zeus (Bulldog)' },
      { start: 14, duration: 2, client: 'Princess (Afghan)' },
      { start: 16, duration: 1, client: 'Duke (Boxer)' },
    ],
  },
  {
    id: 3,
    name: 'Emily Rodriguez',
    bookedPercentage: 88,
    appointmentCount: 7,
    lastAppointmentEnd: '5:00 PM',
    schedule: [
      { start: 8, duration: 1, client: 'Milo (Corgi)' },
      { start: 9.5, duration: 1.5, client: 'Sadie (Shepherd)' },
      { start: 11.5, duration: 1, client: 'Oscar (Dachshund)' },
      { start: 13, duration: 1.5, client: 'Lola (Maltese)' },
      { start: 15, duration: 1, client: 'Tucker (Spaniel)' },
      { start: 16.5, duration: 1.5, client: 'Bailey (Retriever)' },
    ],
  },
]

export const groomerWeekData = [
  {
    id: 1,
    name: 'Sarah Johnson',
    weekUtilization: 87,
    weekAppointments: 42,
    weekSchedule: [
      { 
        day: 'Monday',
        utilization: 95,
        appointments: [
          { start: 8, duration: 1.5 },
          { start: 9.5, duration: 1 },
          { start: 11, duration: 2 },
          { start: 13, duration: 1 },
          { start: 14.5, duration: 1.5 },
          { start: 16, duration: 1.5 },
        ]
      },
      { 
        day: 'Tuesday',
        utilization: 90,
        appointments: [
          { start: 8, duration: 1 },
          { start: 9.5, duration: 1.5 },
          { start: 11.5, duration: 1.5 },
          { start: 13.5, duration: 1 },
          { start: 15, duration: 2 },
        ]
      },
      { 
        day: 'Wednesday',
        utilization: 85,
        appointments: [
          { start: 8.5, duration: 1.5 },
          { start: 10.5, duration: 1 },
          { start: 12, duration: 1.5 },
          { start: 14, duration: 1.5 },
          { start: 16, duration: 1 },
        ]
      },
      { 
        day: 'Thursday',
        utilization: 88,
        appointments: [
          { start: 8, duration: 1 },
          { start: 9.5, duration: 2 },
          { start: 12, duration: 1 },
          { start: 13.5, duration: 1.5 },
          { start: 15.5, duration: 1.5 },
        ]
      },
      { 
        day: 'Friday',
        utilization: 92,
        appointments: [
          { start: 8, duration: 1.5 },
          { start: 10, duration: 1 },
          { start: 11.5, duration: 1.5 },
          { start: 13.5, duration: 1 },
          { start: 15, duration: 2 },
        ]
      },
      { 
        day: 'Saturday',
        utilization: 80,
        appointments: [
          { start: 9, duration: 1.5 },
          { start: 11, duration: 1 },
          { start: 13, duration: 1.5 },
          { start: 15, duration: 1 },
        ]
      },
      { 
        day: 'Sunday',
        utilization: 0,
        appointments: []
      },
    ]
  },
  {
    id: 2,
    name: 'Mike Chen',
    weekUtilization: 72,
    weekAppointments: 35,
    weekSchedule: [
      { 
        day: 'Monday',
        utilization: 78,
        appointments: [
          { start: 8.5, duration: 1 },
          { start: 10, duration: 1.5 },
          { start: 12, duration: 1 },
          { start: 14, duration: 2 },
          { start: 16, duration: 1 },
        ]
      },
      { 
        day: 'Tuesday',
        utilization: 75,
        appointments: [
          { start: 8, duration: 1.5 },
          { start: 10, duration: 1 },
          { start: 12, duration: 1.5 },
          { start: 14, duration: 1 },
          { start: 15.5, duration: 1.5 },
        ]
      },
      { 
        day: 'Wednesday',
        utilization: 70,
        appointments: [
          { start: 9, duration: 1 },
          { start: 10.5, duration: 1.5 },
          { start: 13, duration: 1 },
          { start: 15, duration: 1.5 },
        ]
      },
      { 
        day: 'Thursday',
        utilization: 68,
        appointments: [
          { start: 8.5, duration: 1.5 },
          { start: 10.5, duration: 1 },
          { start: 12.5, duration: 1.5 },
          { start: 15, duration: 1 },
        ]
      },
      { 
        day: 'Friday',
        utilization: 80,
        appointments: [
          { start: 8, duration: 1 },
          { start: 9.5, duration: 1.5 },
          { start: 11.5, duration: 1 },
          { start: 13, duration: 1.5 },
          { start: 15, duration: 1.5 },
        ]
      },
      { 
        day: 'Saturday',
        utilization: 65,
        appointments: [
          { start: 9, duration: 1.5 },
          { start: 11, duration: 1 },
          { start: 13.5, duration: 1.5 },
        ]
      },
      { 
        day: 'Sunday',
        utilization: 0,
        appointments: []
      },
    ]
  },
  {
    id: 3,
    name: 'Emily Rodriguez',
    weekUtilization: 81,
    weekAppointments: 38,
    weekSchedule: [
      { 
        day: 'Monday',
        utilization: 88,
        appointments: [
          { start: 8, duration: 1 },
          { start: 9.5, duration: 1.5 },
          { start: 11.5, duration: 1 },
          { start: 13, duration: 1.5 },
          { start: 15, duration: 1 },
          { start: 16.5, duration: 1.5 },
        ]
      },
      { 
        day: 'Tuesday',
        utilization: 82,
        appointments: [
          { start: 8.5, duration: 1.5 },
          { start: 10.5, duration: 1 },
          { start: 12, duration: 1.5 },
          { start: 14, duration: 1 },
          { start: 15.5, duration: 1.5 },
        ]
      },
      { 
        day: 'Wednesday',
        utilization: 78,
        appointments: [
          { start: 8, duration: 1.5 },
          { start: 10, duration: 1 },
          { start: 11.5, duration: 1.5 },
          { start: 13.5, duration: 1 },
          { start: 15, duration: 1.5 },
        ]
      },
      { 
        day: 'Thursday',
        utilization: 85,
        appointments: [
          { start: 8.5, duration: 1 },
          { start: 10, duration: 1.5 },
          { start: 12, duration: 1 },
          { start: 13.5, duration: 1.5 },
          { start: 15.5, duration: 1.5 },
        ]
      },
      { 
        day: 'Friday',
        utilization: 90,
        appointments: [
          { start: 8, duration: 1.5 },
          { start: 9.5, duration: 1 },
          { start: 11, duration: 1.5 },
          { start: 13, duration: 1 },
          { start: 14.5, duration: 2 },
        ]
      },
      { 
        day: 'Saturday',
        utilization: 75,
        appointments: [
          { start: 9, duration: 1 },
          { start: 10.5, duration: 1.5 },
          { start: 13, duration: 1 },
          { start: 15, duration: 1.5 },
        ]
      },
      { 
        day: 'Sunday',
        utilization: 0,
        appointments: []
      },
    ]
  },
]

export const clientMetrics = {
  totalClients: 156,
  newThisMonth: 12,
  repeatVisitRate: 78,
  avgDaysBetweenVisits: 28,
}

export const recentActivity = [
  {
    id: 1,
    type: 'booking',
    description: 'New appointment booked for Max',
    client: 'John Smith',
    time: '2 minutes ago',
    category: 'today',
  },
  {
    id: 2,
    type: 'cancellation',
    description: 'Appointment canceled for Luna',
    client: 'Sarah Williams',
    time: '15 minutes ago',
    category: 'today',
  },
  {
    id: 3,
    type: 'booking',
    description: 'New appointment booked for Charlie',
    client: 'Mike Johnson',
    time: '1 hour ago',
    category: 'today',
  },
  {
    id: 4,
    type: 'pricing',
    description: 'Service price updated: Full Groom',
    client: 'System',
    time: '3 hours ago',
    category: 'today',
  },
  {
    id: 5,
    type: 'booking',
    description: 'New appointment booked for Bella',
    client: 'Emma Davis',
    time: 'Yesterday 5:30 PM',
    category: 'yesterday',
  },
  {
    id: 6,
    type: 'discount',
    description: '10% discount applied to repeat customer',
    client: 'David Brown',
    time: 'Yesterday 2:15 PM',
    category: 'yesterday',
  },
  {
    id: 7,
    type: 'staff',
    description: 'Staff role changed: Emily promoted to Lead Groomer',
    client: 'Admin',
    time: 'Yesterday 10:00 AM',
    category: 'yesterday',
  },
  {
    id: 8,
    type: 'booking',
    description: 'New appointment booked for Rocky',
    client: 'Lisa Anderson',
    time: '3 days ago',
    category: 'thisWeek',
  },
]

export const bookingSummary = {
  today: 82,
  week: 78,
  month: 73,
}

export const topServicesData = [
  {
    name: 'Full Groom',
    icon: 'scissors',
    count: 24,
    revenue: 2880,
  },
  {
    name: 'Bath & Brush',
    icon: 'sparkle',
    count: 18,
    revenue: 1440,
  },
  {
    name: 'Nail Trim',
    icon: 'eyedropper',
    count: 32,
    revenue: 640,
  },
  {
    name: 'Deluxe Spa',
    icon: 'sparkle',
    count: 8,
    revenue: 960,
  },
]

export const topBreedsData = [
  {
    name: 'Golden Retriever',
    count: 28,
    avgVisitValue: 85,
  },
  {
    name: 'Labrador',
    count: 24,
    avgVisitValue: 75,
  },
  {
    name: 'Poodle',
    count: 22,
    avgVisitValue: 95,
  },
  {
    name: 'German Shepherd',
    count: 18,
    avgVisitValue: 80,
  },
]

export const expensesData = [
  {
    category: 'Payroll',
    amount: 4200,
    color: 'oklch(0.75 0.15 195)',
  },
  {
    category: 'Supplies',
    amount: 1850,
    color: 'oklch(0.75 0.20 285)',
  },
  {
    category: 'Rent',
    amount: 2500,
    color: 'oklch(0.70 0.18 340)',
  },
  {
    category: 'Utilities',
    amount: 650,
    color: 'oklch(0.80 0.15 85)',
  },
  {
    category: 'Marketing',
    amount: 800,
    color: 'oklch(0.65 0.22 25)',
  },
]

export const dogsGroomedData = {
  day: 12,
  week: 68,
  month: 285,
  lifetime: 3842,
}

export const bookedPercentageData = {
  day: 82,
  week: 78,
  month: 73,
}

export const clientsData = {
  total: 156,
  newThisMonth: 12,
  repeatRate: 78,
  avgDaysBetween: 28,
}
