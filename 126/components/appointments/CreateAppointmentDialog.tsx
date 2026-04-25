import { useState, useEffect, useMemo, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useAppointments, useCreateAppointment, useCreateAppointmentService, useDeleteAppointment } from '@/hooks/data/useAppointments'
import { useClients, useActivePets } from '@/hooks/data/useClients'
import { useStaff } from '@/hooks/data/useStaff'
import { useServices } from '@/hooks/data/useServices'
import { useBusinessSettings, useWeightRanges } from '@/hooks/data/useBusinessSettings'
import { useStaffScheduleOverrides, useStaffSchedules } from '@/hooks/data/useStaffExtensions'
import { clientsFromDb } from '@/lib/mappers/clientMapper'
import { staffListFromDb } from '@/lib/mappers/staffMapper'
import { serviceToMainService, serviceToAddOn } from '@/lib/mappers/serviceMapper'
import { appointmentFromDb } from '@/lib/mappers/appointmentMapper'
import { toast } from "sonner"
import { getPriceForWeight, getWeightCategory, getWeightCategoryLabel, mapWeightRanges } from "@/lib/types"
import { PawPrint, Receipt } from "@phosphor-icons/react"
import { getTodayInBusinessTimezone } from "@/lib/date-utils"
import {
  DEFAULT_HOURS_OF_OPERATION,
  formatTimeLabel,
  getHoursForDate,
  getTimeSlotsForDate,
  isTimeWithinBusinessHours
} from "@/lib/business-hours"
import { isStaffAvailableAt } from '@/lib/staff-schedule-availability'
import { minutesToTimeString, parseTimeToMinutes } from '@/lib/time'

interface CreateAppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateAppointmentDialog({ open, onOpenChange }: CreateAppointmentDialogProps) {
  const { data: dbAppointments } = useAppointments()
  const { data: dbClients } = useClients()
  const { data: dbStaff } = useStaff()
  const { data: dbServices } = useServices()
  const { data: dbBusinessSettings } = useBusinessSettings()
  const { data: dbPets } = useActivePets()
  const { data: weightRangesDb } = useWeightRanges()
  const createAppointmentMutation = useCreateAppointment()
  const createAppointmentService = useCreateAppointmentService()
  const deleteAppointmentMutation = useDeleteAppointment()

  const petsByClient = useMemo(() => {
    const map = new Map<string, typeof dbPets>()
    for (const p of dbPets ?? []) {
      const list = map.get(p.client_id) ?? []
      list.push(p)
      map.set(p.client_id, list)
    }
    return map
  }, [dbPets])

  const appointments = useMemo(() => {
    if (!dbAppointments) return []
    const clientMap = new Map((dbClients ?? []).map(c => [c.id, c]))
    const staffMap = new Map((dbStaff ?? []).map(s => [s.id, s]))
    const petMap = new Map((dbPets ?? []).map(p => [p.id, p]))
    return dbAppointments.map(a => {
      const client = clientMap.get(a.client_id)
      const staff = a.groomer_id ? staffMap.get(a.groomer_id) : undefined
      const pet = a.pet_id ? petMap.get(a.pet_id) : undefined
      return appointmentFromDb(
        a,
        undefined,
        client ? `${client.first_name} ${client.last_name}`.trim() : '',
        pet?.name ?? '',
        pet?.breed ?? undefined,
        pet?.weight ?? undefined,
        pet?.weight_category ?? undefined,
        staff ? `${staff.first_name} ${staff.last_name}`.trim() : ''
      )
    })
  }, [dbAppointments, dbClients, dbStaff, dbPets])

  const clients = useMemo(() => clientsFromDb(dbClients ?? [], petsByClient), [dbClients, petsByClient])
  const staffMembers = useMemo(() => staffListFromDb(dbStaff ?? []), [dbStaff])
  const mainServices = useMemo(() =>
    (dbServices ?? []).filter(s => s.service_type === 'main').map(serviceToMainService),
    [dbServices]
  )
  const addOns = useMemo(() =>
    (dbServices ?? []).filter(s => s.service_type === 'addon').map(serviceToAddOn),
    [dbServices]
  )
  const hoursOfOperation = dbBusinessSettings?.hours_of_operation ?? DEFAULT_HOURS_OF_OPERATION
  const businessTimezone = dbBusinessSettings?.timezone
  const maxAppointmentsPerSlot = Math.max(
    1,
    dbBusinessSettings?.booking_rules?.allow_concurrent_appointments
      ? dbBusinessSettings.booking_rules.max_appointments_per_slot ?? 1
      : 1
  )

  const [selectedClient, setSelectedClient] = useState("")
  const [selectedPet, setSelectedPet] = useState("")
  const [selectedMainService, setSelectedMainService] = useState("")
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([])
  const [selectedGroomer, setSelectedGroomer] = useState("")
  const [, setGroomerRequested] = useState(false)
  const [appointmentDate, setAppointmentDate] = useState("")
  const [appointmentTime, setAppointmentTime] = useState("")
  const [notes, setNotes] = useState("")

  const client = (clients || []).find(c => c.id === selectedClient)
  const pet = client?.pets.find(p => p.id === selectedPet)
  const weightRanges = useMemo(() => mapWeightRanges(weightRangesDb), [weightRangesDb])
  const weightCategory = pet ? getWeightCategory(pet.weight, weightRanges) : null
  const groomers = (staffMembers || []).filter(member => member.canTakeAppointments)
  const hoursForSelectedDate = useMemo(() => (
    appointmentDate ? getHoursForDate(appointmentDate, hoursOfOperation) : null
  ), [appointmentDate, hoursOfOperation])
  const timeSlots = useMemo(() => (
    appointmentDate ? getTimeSlotsForDate(appointmentDate, hoursOfOperation) : []
  ), [appointmentDate, hoursOfOperation])
  const isClosedDay = Boolean(appointmentDate && (!hoursForSelectedDate || !hoursForSelectedDate.isOpen))
  const isOutsideBusinessHours = Boolean(
    appointmentDate &&
      appointmentTime &&
      !isTimeWithinBusinessHours(appointmentDate, appointmentTime, hoursOfOperation)
  )


  const { data: dbStaffSchedules } = useStaffSchedules()
  const { data: dbStaffScheduleOverrides } = useStaffScheduleOverrides()
  const isGroomerAvailableAt = useCallback((groomerId: string, date: string, slot: string, durationMinutes: number) => {
    return isStaffAvailableAt({
      appointments,
      date,
      durationMinutes,
      maxAppointmentsPerSlot,
      overrides: dbStaffScheduleOverrides || [],
      schedules: dbStaffSchedules || [],
      slot,
      staffId: groomerId,
    })
  }, [appointments, dbStaffScheduleOverrides, dbStaffSchedules, maxAppointmentsPerSlot])

  const appointmentDurationMinutes = useMemo(() => {
    const mainDuration = (mainServices || []).find((service) => service.id === selectedMainService)?.estimatedDurationMinutes ?? 0
    const addOnDuration = selectedAddOns.reduce((total, addonId) => {
      const addOn = (addOns || []).find((entry) => entry.id === addonId)
      return total + (addOn?.estimatedDurationMinutes ?? 0)
    }, 0)

    return Math.max(15, mainDuration + addOnDuration)
  }, [mainServices, addOns, selectedMainService, selectedAddOns])

  const availableTimeSlots = useMemo(() => {
    if (!appointmentDate || !selectedGroomer) return []

    return timeSlots.filter((slot) => isGroomerAvailableAt(selectedGroomer, appointmentDate, slot, appointmentDurationMinutes))
  }, [appointmentDate, selectedGroomer, timeSlots, isGroomerAvailableAt, appointmentDurationMinutes])

  const calculateTotal = () => {
    let total = 0

    if (selectedMainService && weightCategory) {
      const mainService = (mainServices || []).find(s => s.id === selectedMainService)
      if (mainService) {
        total += getPriceForWeight(mainService.pricing, weightCategory)
      }
    }

    selectedAddOns.forEach(addonId => {
      const addon = (addOns || []).find(a => a.id === addonId)
      if (addon) {
        if (addon.hasSizePricing && addon.pricing && weightCategory) {
          total += getPriceForWeight(addon.pricing, weightCategory)
        } else if (addon.price) {
          total += addon.price
        }
      }
    })

    return total
  }

  const handleSubmit = async () => {
    if (
      createAppointmentMutation.isPending ||
      createAppointmentService.isPending ||
      deleteAppointmentMutation.isPending
    ) {
      return
    }

    if (!selectedClient || !selectedPet || !selectedMainService || !selectedGroomer || !appointmentDate || !appointmentTime) {
      toast.error("Please fill in all required fields")
      return
    }

    if (!isTimeWithinBusinessHours(appointmentDate, appointmentTime, hoursOfOperation)) {
      toast.error("Selected time is outside business hours")
      return
    }

    if (groomers.length === 0) {
      toast.error("Add a groomer before scheduling appointments")
      return
    }

    if (!availableTimeSlots.includes(appointmentTime)) {
      toast.error('Selected time is not available for this staff schedule')
      return
    }

    const groomer = groomers.find(g => g.id === selectedGroomer)
    if (!groomer) {
      toast.error("Could not assign groomer")
      return
    }
    if (!weightCategory) {
      toast.error("Could not determine pet size for pricing")
      return
    }
    const selectedMainServiceRecord = (mainServices || []).find(s => s.id === selectedMainService)
    if (!selectedMainServiceRecord) {
      toast.error("Selected main service is unavailable. Please reselect and try again.")
      return
    }

    const newAppointment = await createAppointmentMutation.mutateAsync({
      client_id: selectedClient,
      pet_id: selectedPet,
      groomer_id: groomer.id,
      date: appointmentDate,
      start_time: appointmentTime,
      end_time: minutesToTimeString((parseTimeToMinutes(appointmentTime) ?? 0) + appointmentDurationMinutes),
      status: 'scheduled',
      total_price: calculateTotal(),
      notes,
    })

    const servicesToSave: { service_id?: string; service_name: string; service_type: 'main' | 'addon'; price: number }[] = [
      {
        service_id: selectedMainServiceRecord.id,
        service_name: selectedMainServiceRecord.name,
        service_type: 'main',
        price: getPriceForWeight(selectedMainServiceRecord.pricing, weightCategory),
      }
    ]

    selectedAddOns.forEach(addonId => {
      const addon = (addOns || []).find(a => a.id === addonId)
      if (addon) {
        const price = addon.hasSizePricing && addon.pricing && weightCategory
          ? getPriceForWeight(addon.pricing, weightCategory)
          : addon.price ?? 0
        servicesToSave.push({
          service_id: addon.id,
          service_name: addon.name,
          service_type: 'addon',
          price,
        })
      }
    })

    try {
      await Promise.all(
        servicesToSave.map(s =>
          createAppointmentService.mutateAsync({
            appointment_id: newAppointment.id,
            service_id: s.service_id,
            service_name: s.service_name,
            service_type: s.service_type,
            price: s.price,
          })
        )
      )
    } catch (serviceError) {
      console.error('Failed to persist appointment services; rolling back appointment', serviceError)
      try {
        await deleteAppointmentMutation.mutateAsync(newAppointment.id)
        toast.error("Appointment could not be completed and was rolled back. Please retry.")
      } catch (rollbackError) {
        console.error('Failed to roll back appointment after service persistence error', rollbackError)
        toast.error(`Rollback failed. Refresh and contact support with appointment ID: ${newAppointment.id}`)
      }
      onOpenChange(false)
      resetForm()
      return
    }

    toast.success("Appointment created successfully!")
    onOpenChange(false)
    resetForm()
  }

  const resetForm = () => {
    setSelectedClient("")
    setSelectedPet("")
    setSelectedMainService("")
    setSelectedAddOns([])
    setSelectedGroomer("")
    setGroomerRequested(false)
    setAppointmentDate("")
    setAppointmentTime("")
    setNotes("")
  }

  const total = calculateTotal()
  useEffect(() => {
    if (!appointmentDate || !appointmentTime) return
    if (!isTimeWithinBusinessHours(appointmentDate, appointmentTime, hoursOfOperation)) {
      setAppointmentTime('')
      toast.error('Selected time is outside business hours')
      return
    }

    if (!availableTimeSlots.includes(appointmentTime)) {
      setAppointmentTime('')
      toast.error('Selected time is not available for the selected staff schedule')
    }
  }, [appointmentDate, appointmentTime, hoursOfOperation, availableTimeSlots])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PawPrint size={24} className="text-primary" />
            Create New Appointment
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Select value={selectedClient} onValueChange={(value) => {
                  setSelectedClient(value)
                  setSelectedPet("")
                }}>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clients || []).map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {appointmentDate && availableTimeSlots.length === 0 && (
                  <p className="text-xs text-muted-foreground">No available times based on selected staff schedules.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pet">Pet *</Label>
                <Select value={selectedPet} onValueChange={setSelectedPet} disabled={!selectedClient}>
                  <SelectTrigger id="pet">
                    <SelectValue placeholder="Select pet" />
                  </SelectTrigger>
                  <SelectContent>
                    {client?.pets.map(pet => (
                      <SelectItem key={pet.id} value={pet.id}>
                        {pet.name} ({pet.weight} lbs)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {appointmentDate && availableTimeSlots.length === 0 && (
                  <p className="text-xs text-muted-foreground">No available times based on selected staff schedules.</p>
                )}
              </div>
            </div>

            {pet && (
              <Card className="p-3 bg-muted/50">
                <div className="flex items-center gap-2 text-sm">
                  <PawPrint size={16} />
                  <span className="font-medium">{pet.name}</span>
                  <span className="text-muted-foreground">•</span>
                  <span>{pet.breed}</span>
                  <span className="text-muted-foreground">•</span>
                  <Badge variant="secondary">{pet.weight} lbs ({weightCategory ? getWeightCategoryLabel(weightCategory) : 'Unknown'})</Badge>
                </div>
              </Card>
            )}

            <Separator />

            <div className="space-y-3">
              <Label>Main Service *</Label>
              <div className="space-y-2">
                {(mainServices || []).map(service => {
                  const price = weightCategory ? getPriceForWeight(service.pricing, weightCategory) : 0
                  return (
                    <button
                      key={service.id}
                      disabled={!pet}
                      onClick={() => setSelectedMainService(service.id)}
                      className={`w-full text-left p-4 border rounded-lg transition-all ${
                        selectedMainService === service.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      } ${!pet ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold">{service.name}</div>
                          <div className="text-sm text-muted-foreground mt-1">{service.description}</div>
                        </div>
                        {pet && (
                          <div className="text-lg font-bold text-primary">${price}</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Add-Ons (Optional)</Label>
              <div className="space-y-2">
                {(addOns || []).map(addon => {
                  const isSelected = selectedAddOns.includes(addon.id)
                  const price = addon.hasSizePricing && addon.pricing && weightCategory
                    ? getPriceForWeight(addon.pricing, weightCategory)
                    : (addon.price || 0)

                  return (
                    <button
                      key={addon.id}
                      disabled={!pet}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedAddOns(selectedAddOns.filter(id => id !== addon.id))
                        } else {
                          setSelectedAddOns([...selectedAddOns, addon.id])
                        }
                      }}
                      className={`w-full text-left p-3 border rounded-lg transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      } ${!pet ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} disabled={!pet} />
                          <span className="font-medium">{addon.name}</span>
                        </div>
                        {pet && (
                          <div className="font-semibold text-primary">${price}</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="groomer">Groomer *</Label>
              <Select value={selectedGroomer} onValueChange={setSelectedGroomer}>
                <SelectTrigger id="groomer">
                  <SelectValue placeholder="Select groomer" />
                </SelectTrigger>
                <SelectContent>
                  {groomers.length === 0 && (
                    <SelectItem value="none" disabled>
                      No groomers available
                    </SelectItem>
                  )}
                  {groomers.map(groomer => (
                    <SelectItem key={groomer.id} value={groomer.id}>
                      {groomer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedGroomer && (
                <p className="text-xs text-muted-foreground">Showing only this groomer&apos;s working schedule and open booking windows.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  min={getTodayInBusinessTimezone(businessTimezone)}
                  disabled={!selectedGroomer}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Time *</Label>
                <Select
                  value={appointmentTime}
                  onValueChange={setAppointmentTime}
                  disabled={!selectedGroomer || !appointmentDate || isClosedDay}
                >
                  <SelectTrigger id="time">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {!selectedGroomer && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Select a groomer first to see their availability.
                      </div>
                    )}
                    {!appointmentDate && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Select a date to see available times.
                      </div>
                    )}
                    {appointmentDate && timeSlots.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No open hours for the selected date.
                      </div>
                    )}
                    {availableTimeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {appointmentDate && selectedGroomer && availableTimeSlots.length === 0 && (
                  <p className="text-xs text-muted-foreground">No available times for this groomer based on their schedule and current bookings.</p>
                )}
                {appointmentDate && hoursForSelectedDate?.isOpen && (
                  <p className="text-xs text-muted-foreground">
                    Open {formatTimeLabel(hoursForSelectedDate.openTime)} - {formatTimeLabel(hoursForSelectedDate.closeTime)}.
                  </p>
                )}
                {isClosedDay && (
                  <p className="text-xs text-destructive">Selected date is outside business hours.</p>
                )}
                {isOutsideBusinessHours && (
                  <p className="text-xs text-destructive">Selected time is outside business hours.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any special instructions or notes..."
                rows={3}
              />
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-4 sticky top-4">
              <div className="flex items-center gap-2 mb-4">
                <Receipt size={20} className="text-primary" />
                <h3 className="font-semibold">Summary</h3>
              </div>

              <div className="space-y-3">
                {pet && (
                  <div className="pb-3 border-b border-border">
                    <div className="text-sm text-muted-foreground mb-1">Pet</div>
                    <div className="font-medium">{pet.name}</div>
                    <div className="text-xs text-muted-foreground">{pet.weight} lbs ({weightCategory ? getWeightCategoryLabel(weightCategory) : 'Unknown'})</div>
                  </div>
                )}

                {selectedMainService && weightCategory && (
                  <div className="pb-3 border-b border-border">
                    <div className="text-sm text-muted-foreground mb-2">Main Service</div>
                    {(() => {
                      const service = (mainServices || []).find(s => s.id === selectedMainService)
                      const price = service ? getPriceForWeight(service.pricing, weightCategory) : 0
                      return (
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{service?.name}</span>
                          <span className="font-semibold">${price.toFixed(2)}</span>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {selectedAddOns.length > 0 && weightCategory && (
                  <div className="pb-3 border-b border-border">
                    <div className="text-sm text-muted-foreground mb-2">Add-Ons</div>
                    <div className="space-y-2">
                      {selectedAddOns.map(addonId => {
                        const addon = (addOns || []).find(a => a.id === addonId)
                        const price = addon?.hasSizePricing && addon.pricing
                          ? getPriceForWeight(addon.pricing, weightCategory)
                          : (addon?.price || 0)
                        return (
                          <div key={addonId} className="flex items-center justify-between text-sm">
                            <span>{addon?.name}</span>
                            <span className="font-semibold">${price.toFixed(2)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <div className="flex items-center justify-between text-lg">
                    <span className="font-bold">Total</span>
                    <span className="font-bold text-primary text-2xl">${total.toFixed(2)}</span>
                  </div>
                </div>

                {appointmentDate && appointmentTime && (
                  <div className="pt-3 border-t border-border text-sm">
                    <div className="text-muted-foreground mb-1">Scheduled For</div>
                    <div className="font-medium">{appointmentDate}</div>
                    <div className="font-medium">{appointmentTime}</div>
                    <div className="text-xs text-muted-foreground">Estimated duration: {appointmentDurationMinutes} min</div>
                  </div>
                )}

                {selectedGroomer && (
                  <div className="pt-3 border-t border-border text-sm">
                    <div className="text-muted-foreground mb-1">Groomer</div>
                    <div className="font-medium">
                      {groomers.find(g => g.id === selectedGroomer)?.name}
                    </div>
                    <Badge variant="secondary" className="text-xs mt-1">Client Requested</Badge>
                  </div>
                )}
              </div>

              <Button 
                onClick={handleSubmit} 
                className="w-full mt-6"
                loadingText="Creating appointment..."
                disabled={
                  !selectedClient ||
                  !selectedPet ||
                  !selectedMainService ||
                  !selectedGroomer ||
                  !appointmentDate ||
                  !appointmentTime ||
                  createAppointmentMutation.isPending ||
                  createAppointmentService.isPending ||
                  deleteAppointmentMutation.isPending ||
                  isClosedDay ||
                  isOutsideBusinessHours
                }
              >
                Create Appointment
              </Button>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
