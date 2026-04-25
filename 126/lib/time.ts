export function parseTimeToMinutes(time: string): number | null {
  if (!time) return null

  const trimmed = time.trim()
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/)
  if (ampmMatch) {
    let hours = Number(ampmMatch[1])
    const minutes = Number(ampmMatch[2])
    const period = ampmMatch[4].toUpperCase()

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
    if (period === 'PM' && hours < 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    return hours * 60 + minutes
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match24) return null

  const hours = Number(match24[1])
  const minutes = Number(match24[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

export function minutesToTimeString(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60)
  const hours = Math.floor(normalized / 60).toString().padStart(2, '0')
  const minutes = (normalized % 60).toString().padStart(2, '0')
  return `${hours}:${minutes}`
}
