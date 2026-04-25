import { Appointment, Client, WEIGHT_CATEGORY_LABELS } from "@/lib/types"
import { PerformanceData } from "@/lib/performance-types"

const MONTH_COUNT = 5

const sizeOrder = ["small", "medium", "large", "giant", "xxlarge"]

const parseDateTime = (dateValue?: string, timeValue?: string) => {
  if (!dateValue || !timeValue) return null
  const parsed = new Date(`${dateValue} ${timeValue}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getAppointmentDate = (appointment: Appointment) => {
  const direct = new Date(appointment.date)
  if (!Number.isNaN(direct.getTime())) {
    return direct
  }
  return parseDateTime(appointment.date, appointment.startTime)
}

const getDurationMinutes = (appointment: Appointment) => {
  const start = parseDateTime(appointment.date, appointment.startTime)
  const end = parseDateTime(appointment.date, appointment.endTime)
  if (!start || !end) return null
  const minutes = (end.getTime() - start.getTime()) / 60000
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  return minutes
}

const getMonthBuckets = () => {
  const buckets: Array<{ key: string; label: string; year: number; month: number }> = []
  const now = new Date()
  for (let offset = MONTH_COUNT - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const month = date.getMonth()
    const year = date.getFullYear()
    const label = date.toLocaleString("en-US", { month: "short" }).toUpperCase()
    buckets.push({ key: `${year}-${month}`, label, year, month })
  }
  return buckets
}

const formatCurrency = (value: number) => `$${value.toFixed(2)}`

const getPetLookup = (clients: Client[]) => {
  const lookup = new Map<string, { breed: string; size: string }>()
  clients.forEach((client) => {
    client.pets.forEach((pet) => {
      lookup.set(pet.id, { breed: pet.breed, size: pet.weightCategory })
    })
  })
  return lookup
}

const isCompletedAppointment = (appointment: Appointment) =>
  appointment.status === "picked_up"

export const isPerformanceDataEmpty = (data: PerformanceData) =>
  data.kpis.length === 0 &&
  data.charts.length === 0 &&
  data.earningsByBreed.length === 0 &&
  data.topCombos.length === 0 &&
  data.bottomCombos.length === 0 &&
  data.matrixData.rows.length === 0

export const buildPerformanceData = ({
  appointments,
  clients,
  staffId,
}: {
  appointments: Appointment[]
  clients: Client[]
  staffId?: string
}): PerformanceData => {
  const petLookup = getPetLookup(clients)
  const relevantAppointments = appointments.filter(
    (appointment) =>
      (!staffId || appointment.groomerId === staffId) &&
      isCompletedAppointment(appointment)
  )

  let totalMinutes = 0
  let totalRevenue = 0
  let totalCount = 0

  const monthlyBuckets = getMonthBuckets()
  const monthlyStats = new Map(
    monthlyBuckets.map((bucket) => [bucket.key, { minutes: 0, revenue: 0, count: 0 }])
  )
  const sizeStats = new Map<string, { minutes: number; revenue: number }>()
  const breedStats = new Map<string, { minutes: number; revenue: number; count: number }>()
  const comboStats = new Map<string, { minutes: number; revenue: number; count: number }>()

  relevantAppointments.forEach((appointment) => {
    const minutes = getDurationMinutes(appointment)
    const date = getAppointmentDate(appointment)
    if (!minutes || !date) return

    const revenue = appointment.totalPrice + (appointment.tipAmount ?? 0)
    totalMinutes += minutes
    totalRevenue += revenue
    totalCount += 1

    const monthKey = `${date.getFullYear()}-${date.getMonth()}`
    const monthStat = monthlyStats.get(monthKey)
    if (monthStat) {
      monthStat.minutes += minutes
      monthStat.revenue += revenue
      monthStat.count += 1
    }

    const petInfo = petLookup.get(appointment.petId)
    const breed = petInfo?.breed?.trim() || "Unknown"
    const size = petInfo?.size || appointment.petWeightCategory

    const sizeBucket = sizeStats.get(size) ?? { minutes: 0, revenue: 0 }
    sizeBucket.minutes += minutes
    sizeBucket.revenue += revenue
    sizeStats.set(size, sizeBucket)

    const breedBucket = breedStats.get(breed) ?? { minutes: 0, revenue: 0, count: 0 }
    breedBucket.minutes += minutes
    breedBucket.revenue += revenue
    breedBucket.count += 1
    breedStats.set(breed, breedBucket)

    const comboKey = `${breed}|||${size}`
    const comboBucket = comboStats.get(comboKey) ?? { minutes: 0, revenue: 0, count: 0 }
    comboBucket.minutes += minutes
    comboBucket.revenue += revenue
    comboBucket.count += 1
    comboStats.set(comboKey, comboBucket)
  })

  const averageMinutes = totalCount > 0 ? totalMinutes / totalCount : 0
  const rpm = totalMinutes > 0 ? totalRevenue / totalMinutes : 0

  const monthlyLabels = monthlyBuckets.map((bucket) => bucket.label)
  const monthlyRpmValues = monthlyBuckets.map((bucket) => {
    const stat = monthlyStats.get(bucket.key)
    if (!stat || stat.minutes === 0) return 0
    return stat.revenue / stat.minutes
  })
  const monthlyAvgMinutes = monthlyBuckets.map((bucket) => {
    const stat = monthlyStats.get(bucket.key)
    if (!stat || stat.count === 0) return 0
    return stat.minutes / stat.count
  })

  const sizeLabelsOrdered = sizeOrder.map((size) => WEIGHT_CATEGORY_LABELS[size])
  const sizeRpmValues = sizeOrder.map((size) => {
    const stat = sizeStats.get(size)
    if (!stat || stat.minutes === 0) return 0
    return stat.revenue / stat.minutes
  })

  const rpmByBreed = Array.from(breedStats.entries())
    .map(([breed, stat]) => ({
      breed,
      rpm: stat.minutes > 0 ? stat.revenue / stat.minutes : 0,
    }))
    .filter((item) => item.rpm > 0)
    .sort((a, b) => b.rpm - a.rpm)

  const earningsByBreed = rpmByBreed.slice(0, 7).map((item) => ({
    left: item.breed,
    right: formatCurrency(item.rpm),
  }))

  const comboRpm = Array.from(comboStats.entries())
    .map(([key, stat]) => {
      const [breed, size] = key.split("|||")
      return {
        label: `${breed} ${WEIGHT_CATEGORY_LABELS[size] ?? size}`,
        rpm: stat.minutes > 0 ? stat.revenue / stat.minutes : 0,
      }
    })
    .filter((item) => item.rpm > 0)

  const sortedCombos = comboRpm.sort((a, b) => b.rpm - a.rpm)
  const topCombos = sortedCombos.slice(0, 3).map((item) => ({
    left: item.label,
    right: formatCurrency(item.rpm),
  }))
  const bottomCombos = sortedCombos
    .slice()
    .reverse()
    .slice(0, 3)
    .map((item) => ({
      left: item.label,
      right: formatCurrency(item.rpm),
    }))

  const topBreedsForMatrix = Array.from(breedStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)

  const matrixRows = topBreedsForMatrix.map(([breed]) => {
    const cells = sizeOrder.map((size) => {
      const comboKey = `${breed}|||${size}`
      const combo = comboStats.get(comboKey)
      if (!combo || combo.minutes === 0) return null
      return formatCurrency(combo.revenue / combo.minutes)
    })
    return { name: breed, cells }
  })

  return {
    kpis: [
      {
        value: `${Math.round(averageMinutes)}`,
        unit: "mins",
        label: "AVG MINUTES / APPOINTMENT",
        accent: "blue",
        icon: "⏱️",
      },
      {
        value: formatCurrency(rpm),
        label: "REVENUE PER MIN | RPM",
        accent: "amber",
        icon: "💵",
      },
      {
        value: `${totalCount}`,
        label: "COMPLETED APPOINTMENTS",
        accent: "green",
        icon: "🐾",
      },
    ],
    charts: [
      {
        title: "RPM (Monthly)",
        accent: "blue",
        labels: monthlyLabels,
        values: monthlyRpmValues,
        prefix: "$",
      },
      {
        title: "Average Minutes per Appointment (Monthly)",
        accent: "blue",
        labels: monthlyLabels,
        values: monthlyAvgMinutes,
        suffix: " mins",
      },
      {
        title: "RPM by Dog Size",
        accent: "amber",
        labels: sizeLabelsOrdered,
        values: sizeRpmValues,
        prefix: "$",
      },
    ],
    earningsByBreed,
    topCombos,
    bottomCombos,
    matrixData: {
      cols: sizeOrder.map((size) => WEIGHT_CATEGORY_LABELS[size]),
      rows: matrixRows,
    },
  }
}
