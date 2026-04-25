/**
 * Saved Views & Schedule Manager Components
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  FloppyDisk, 
  Trash, 
  Play, 
  Clock, 
  Eye,
} from '@phosphor-icons/react'
import { useSavedViews, useReportSchedules } from '../hooks/useReportData'
import { ReportFilters, SavedView, ScheduleConfig } from '../types'

// ==================== Save View Dialog ====================

interface SaveViewDialogProps {
  open: boolean
  onClose: () => void
  reportType: string
  filters: ReportFilters
  groupBy?: string
  _visibleColumns?: string[]
  compareEnabled?: boolean
  onSave: (name: string) => void
}

export function SaveViewDialog({
  open,
  onClose,
  reportType,
  filters,
  groupBy,
  _visibleColumns,
  compareEnabled = false,
  onSave,
}: SaveViewDialogProps) {
  const [name, setName] = useState('')
  
  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim())
      setName('')
      onClose()
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save View</DialogTitle>
          <DialogDescription>
            Save your current filters and settings to quickly access this view later.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="view-name">View Name</Label>
            <Input
              id="view-name"
              placeholder="e.g., Monthly Staff Performance"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          
          <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
            <p><span className="text-muted-foreground">Report:</span> {reportType}</p>
            <p><span className="text-muted-foreground">Date Range:</span> {filters.dateRange}</p>
            <p><span className="text-muted-foreground">Time Basis:</span> {filters.timeBasis}</p>
            {groupBy && <p><span className="text-muted-foreground">Group By:</span> {groupBy}</p>}
            {compareEnabled && <Badge variant="secondary" className="text-[10px]">Compare mode on</Badge>}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            <FloppyDisk size={14} className="mr-1" />
            Save View
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==================== Saved Views List ====================

interface SavedViewsListProps {
  open: boolean
  onClose: () => void
  onApply: (view: SavedView) => void
}

export function SavedViewsList({ open, onClose, onApply }: SavedViewsListProps) {
  const { savedViews, deleteView } = useSavedViews()
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Saved Views</DialogTitle>
          <DialogDescription>
            Select a saved view to apply its filters and settings.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[400px]">
          {savedViews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No saved views yet. Save a view to see it here.
            </div>
          ) : (
            <div className="space-y-2">
              {savedViews.map(view => (
                <div
                  key={view.id}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{view.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {view.reportType} • {view.filters.dateRange} • {view.filters.timeBasis}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(view.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onApply(view as SavedView)}
                      >
                        <Eye size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteView(view.id)}
                      >
                        <Trash size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ==================== Schedule Dialog ====================

interface ScheduleDialogProps {
  open: boolean
  onClose: () => void
  savedViews: SavedView[]
  onSchedule: (config: Omit<ScheduleConfig, 'id' | 'createdAt' | 'updatedAt'>) => void
  onRunNow: (savedViewId: string) => void
}

export function ScheduleDialog({
  open,
  onClose,
  savedViews,
  onSchedule,
  onRunNow,
}: ScheduleDialogProps) {
  const [selectedViewId, setSelectedViewId] = useState<string>('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [dayOfWeek, setDayOfWeek] = useState<number>(1) // Monday
  const [dayOfMonth, setDayOfMonth] = useState<number>(1)
  const [time, setTime] = useState('09:00')
  const [recipients, setRecipients] = useState('')
  
  const handleSchedule = () => {
    if (!selectedViewId) return
    
    onSchedule({
      savedViewId: selectedViewId,
      frequency,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      time,
      recipients: recipients.split(',').map(r => r.trim()).filter(Boolean),
      enabled: true,
    })
    onClose()
  }
  
  const handleRunNow = () => {
    if (selectedViewId) {
      onRunNow(selectedViewId)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Report</DialogTitle>
          <DialogDescription>
            Configure automatic report generation. Note: Email sending requires server integration.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Select View */}
          <div className="space-y-2">
            <Label>Report View</Label>
            <Select value={selectedViewId} onValueChange={setSelectedViewId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a saved view" />
              </SelectTrigger>
              <SelectContent>
                {savedViews.map(view => (
                  <SelectItem key={view.id} value={view.id}>
                    {view.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savedViews.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Save a view first to schedule it.
              </p>
            )}
          </div>
          
          {/* Frequency */}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as 'daily' | 'weekly' | 'monthly')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Day Selection */}
          {frequency === 'weekly' && (
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {frequency === 'monthly' && (
            <div className="space-y-2">
              <Label>Day of Month</Label>
              <Select value={String(dayOfMonth)} onValueChange={(v) => setDayOfMonth(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Time */}
          <div className="space-y-2">
            <Label>Time</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          
          {/* Recipients */}
          <div className="space-y-2">
            <Label>Recipients (optional)</Label>
            <Input
              placeholder="email@example.com, another@example.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated email addresses. Email sending is not implemented yet.
            </p>
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleRunNow}
            disabled={!selectedViewId}
            className="w-full sm:w-auto"
          >
            <Play size={14} className="mr-1" />
            Run Now (Preview)
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button 
              onClick={handleSchedule}
              disabled={!selectedViewId}
              className="flex-1 sm:flex-none"
            >
              <Clock size={14} className="mr-1" />
              Save Schedule
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==================== Schedules List ====================

interface SchedulesListProps {
  open: boolean
  onClose: () => void
}

export function SchedulesList({ open, onClose }: SchedulesListProps) {
  const { schedules, deleteSchedule, updateSchedule } = useReportSchedules()
  const { savedViews } = useSavedViews()
  
  const getViewName = (viewId: string) => {
    const view = savedViews.find(v => v.id === viewId)
    return view?.name || 'Unknown View'
  }
  
  const getFrequencyLabel = (schedule: typeof schedules[0]) => {
    if (schedule.frequency === 'daily') return 'Daily'
    if (schedule.frequency === 'weekly') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return `Weekly on ${days[schedule.dayOfWeek || 0]}`
    }
    return `Monthly on day ${schedule.dayOfMonth}`
  }
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Scheduled Reports</DialogTitle>
          <DialogDescription>
            Manage your scheduled report generation.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[400px]">
          {schedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No scheduled reports yet.
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map(schedule => (
                <div
                  key={schedule.id}
                  className="p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{getViewName(schedule.savedViewId)}</h4>
                        <Badge variant={schedule.enabled ? 'default' : 'secondary'} className="text-[10px]">
                          {schedule.enabled ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getFrequencyLabel(schedule)} at {schedule.time}
                      </p>
                      {schedule.lastRunAt && (
                        <p className="text-xs text-muted-foreground">
                          Last run: {new Date(schedule.lastRunAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateSchedule(schedule.id, { enabled: !schedule.enabled })}
                      >
                        {schedule.enabled ? <Clock size={14} /> : <Play size={14} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteSchedule(schedule.id)}
                      >
                        <Trash size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
