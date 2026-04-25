import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Plus, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStaff } from '@/hooks/data/useStaff'
import { staffListFromDb } from '@/lib/mappers/staffMapper'
import { getStaffScheduleMutationErrorMessage, useCreateStaffSchedule, useDeleteStaffSchedule, useStaffSchedules } from '@/hooks/data/useStaffExtensions'
import { toast } from 'sonner'

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

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DEFAULT_WORK_BLOCK = { startTime: '09:00', endTime: '17:00' }
const DEFAULT_LUNCH_BLOCK = { lunchStartTime: '12:00', lunchEndTime: '13:00' }

function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
}

function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
    }
  }
  return slots
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

const TIME_SLOTS = generateTimeSlots()

export function StaffScheduleEditor() {
  const navigate = useNavigate()
  const { staffId } = useParams()

  const { data: dbStaff } = useStaff()
  const staffMembers = useMemo(() => staffListFromDb(dbStaff ?? []), [dbStaff])
  const staffMember = (staffMembers || []).find((s) => s.id === staffId)

  const { data: dbSchedules } = useStaffSchedules(staffId)
  const createSchedule = useCreateStaffSchedule({ suppressGlobalError: true })
  const deleteSchedule = useDeleteStaffSchedule({ suppressGlobalError: true })

  const [editingDay, setEditingDay] = useState<keyof WeeklyTemplate>('monday')
  const [newBlock, setNewBlock] = useState(DEFAULT_WORK_BLOCK)
  const [addLunchBreak, setAddLunchBreak] = useState(false)
  const [lunchBlock, setLunchBlock] = useState(DEFAULT_LUNCH_BLOCK)

  const scheduleTemplate = useMemo(() => {
    const template = getEmptyWeeklyTemplate()
    if (!dbSchedules) return template
    const dayNames: (keyof WeeklyTemplate)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

    for (const sched of dbSchedules) {
      const day = dayNames[sched.day_of_week]
      if (!day) continue
      template[day].push({
        id: sched.id,
        startTime: sched.start_time,
        endTime: sched.end_time,
        isBreak: !sched.is_available,
      })
    }

    for (const day of dayNames) {
      template[day].sort((a, b) => a.startTime.localeCompare(b.startTime))
    }

    return template
  }, [dbSchedules])

  const hasPendingScheduleSave = createSchedule.isPending
  const isWorkDirty =
    newBlock.startTime !== DEFAULT_WORK_BLOCK.startTime ||
    newBlock.endTime !== DEFAULT_WORK_BLOCK.endTime
  const isLunchDirty =
    addLunchBreak ||
    lunchBlock.lunchStartTime !== DEFAULT_LUNCH_BLOCK.lunchStartTime ||
    lunchBlock.lunchEndTime !== DEFAULT_LUNCH_BLOCK.lunchEndTime

  const canSave =
    !!staffId &&
    (isWorkDirty || isLunchDirty) &&
    newBlock.startTime < newBlock.endTime &&
    (!addLunchBreak || lunchBlock.lunchStartTime < lunchBlock.lunchEndTime) &&
    !hasPendingScheduleSave

  const handleSave = async () => {
    if (!staffId) return
    if (newBlock.startTime >= newBlock.endTime) {
      toast.error('Work end time must be after start time')
      return
    }
    if (addLunchBreak && lunchBlock.lunchStartTime >= lunchBlock.lunchEndTime) {
      toast.error('Lunch end time must be after lunch start time')
      return
    }

    const dayMap: Record<keyof WeeklyTemplate, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    }

    createSchedule.mutate(
      {
        staff_id: staffId,
        day_of_week: dayMap[editingDay],
        start_time: newBlock.startTime,
        end_time: newBlock.endTime,
        is_available: true,
      },
      {
        onSuccess: () => {
          if (addLunchBreak) {
            createSchedule.mutate(
              {
                staff_id: staffId,
                day_of_week: dayMap[editingDay],
                start_time: lunchBlock.lunchStartTime,
                end_time: lunchBlock.lunchEndTime,
                is_available: false,
              },
              {
                onSuccess: () => toast.success('Schedule saved'),
                onError: (error) => toast.error(getStaffScheduleMutationErrorMessage(error, 'save')),
              }
            )
          } else {
            toast.success('Schedule saved')
          }
        },
        onError: (error) => toast.error(getStaffScheduleMutationErrorMessage(error, 'save')),
      }
    )

    setNewBlock(DEFAULT_WORK_BLOCK)
    setAddLunchBreak(false)
    setLunchBlock(DEFAULT_LUNCH_BLOCK)
  }

  const handleRemoveBlock = (blockId: string) => {
    if (!staffId) return
    const dbRecord = (dbSchedules ?? []).find((schedule) => schedule.id === blockId)
    if (!dbRecord) return

    deleteSchedule.mutate(
      { scheduleId: blockId, staffId },
      {
        onSuccess: () => toast.success('Block removed'),
        onError: (error) => toast.error(getStaffScheduleMutationErrorMessage(error, 'remove')),
      }
    )
  }

  if (!staffId) {
    return <div className="p-6">Invalid staff member.</div>
  }

  return (
    <div className="min-h-full bg-background text-foreground p-3 sm:p-6">
      <div className="max-w-[1100px] mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => navigate(`/staff/${staffId}`)}>
            <ArrowLeft size={16} className="mr-2" />
            Back to Staff Profile
          </Button>
          <div className="font-semibold text-sm">{staffMember?.name ?? 'Staff'} • Schedule Editor</div>
        </div>

        <Card className="p-4 bg-card border-border">
          <div className="space-y-4">
            <div className="flex gap-2 border-b pb-2 overflow-x-auto">
              {DAYS_OF_WEEK.map((day, idx) => (
                <Button
                  key={day}
                  variant={editingDay === day ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditingDay(day)}
                  className={editingDay === day ? 'bg-primary text-primary-foreground' : ''}
                >
                  {DAY_LABELS[idx]}
                </Button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-[170px] space-y-2">
                  <Label>Work Start</Label>
                  <Select value={newBlock.startTime} onValueChange={(value) => setNewBlock({ ...newBlock, startTime: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {TIME_SLOTS.map((time) => (
                        <SelectItem key={time} value={time}>{formatTime12Hour(time)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-[170px] space-y-2">
                  <Label>Work End</Label>
                  <Select value={newBlock.endTime} onValueChange={(value) => setNewBlock({ ...newBlock, endTime: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {TIME_SLOTS.map((time) => (
                        <SelectItem key={time} value={time}>{formatTime12Hour(time)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={addLunchBreak}
                    onChange={(e) => setAddLunchBreak(e.target.checked)}
                    className="rounded"
                  />
                  Add unpaid lunch break
                </label>

                <Button onClick={handleSave} disabled={!canSave}>
                  <Plus size={16} className="mr-2" />
                  Save
                </Button>
              </div>

              {addLunchBreak && (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-[170px] space-y-2">
                    <Label>Lunch Start</Label>
                    <Select value={lunchBlock.lunchStartTime} onValueChange={(value) => setLunchBlock({ ...lunchBlock, lunchStartTime: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>{formatTime12Hour(time)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[170px] space-y-2">
                    <Label>Lunch End</Label>
                    <Select value={lunchBlock.lunchEndTime} onValueChange={(value) => setLunchBlock({ ...lunchBlock, lunchEndTime: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {TIME_SLOTS.map((time) => (
                          <SelectItem key={time} value={time}>{formatTime12Hour(time)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Current Blocks ({DAY_LABELS[DAYS_OF_WEEK.indexOf(editingDay)]})</Label>
                <div className="space-y-2">
                  {scheduleTemplate[editingDay].length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                      No blocks defined. Staff is unavailable on this day.
                    </div>
                  ) : (
                    scheduleTemplate[editingDay].map((block) => (
                      <div key={block.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                        <div className="flex items-center gap-3">
                          <Clock size={16} />
                          <span className="font-semibold">{formatTime12Hour(block.startTime)} - {formatTime12Hour(block.endTime)}</span>
                          {block.isBreak && <Badge variant="outline" className="text-xs">Lunch (Unpaid)</Badge>}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveBlock(block.id)}>
                          <Trash size={16} className="text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
