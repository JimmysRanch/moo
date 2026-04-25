import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useAppointments, useUpdateAppointment, useAppointmentServices, useCreateAppointmentService, useDeleteAppointmentService } from '@/hooks/data/useAppointments'
import { useClients, useAllPets } from '@/hooks/data/useClients'
import { useStaff } from '@/hooks/data/useStaff'
import { useServices } from '@/hooks/data/useServices'
import { useWeightRanges } from '@/hooks/data/useBusinessSettings'
import { appointmentFromDb } from '@/lib/mappers/appointmentMapper'
import { clientsFromDb } from '@/lib/mappers/clientMapper'
import { staffListFromDb } from '@/lib/mappers/staffMapper'
import { serviceToMainService, serviceToAddOn } from '@/lib/mappers/serviceMapper'
import { formatTimeLabel } from '@/lib/business-hours'
import { minutesToTimeString, parseTimeToMinutes } from '@/lib/time'
import { Appointment, getWeightCategory, getWeightCategoryLabel, mapWeightRanges } from "@/lib/types"
import { toast } from "sonner"
import { ArrowLeft, PawPrint, CurrencyDollar, Scissors, Lock } from "@phosphor-icons/react"

const APPOINTMENT_TIME_OPTIONS = Array.from({ length: 12 }, (_, index) =>
  `${String(index + 8).padStart(2, '0')}:00`
)



export function EditAppointment() {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const { data: dbAppointments } = useAppointments()
  const { data: dbClients } = useClients()
  const { data: dbStaff } = useStaff()
  const { data: dbServices } = useServices()
  const { data: dbPets } = useAllPets()
  const { data: weightRangesDb } = useWeightRanges()
  const { data: dbAppointmentServices, isFetched: appointmentServicesFetched } = useAppointmentServices(appointmentId)
  const updateAppointment = useUpdateAppointment()
  const createAppointmentService = useCreateAppointmentService()
  const deleteAppointmentService = useDeleteAppointmentService()

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
  const staff = useMemo(() => staffListFromDb(dbStaff ?? []), [dbStaff])
  const mainServices = useMemo(() =>
    (dbServices ?? []).filter(s => s.service_type === 'main').map(serviceToMainService),
    [dbServices]
  )
  const addOns = useMemo(() =>
    (dbServices ?? []).filter(s => s.service_type === 'addon').map(serviceToAddOn),
    [dbServices]
  )

  const appointment = (appointments || []).find(apt => apt.id === appointmentId)
  const isLocked = appointment?.status === 'picked_up'

  const [selectedClientId, setSelectedClientId] = useState("")
  const [selectedPetId, setSelectedPetId] = useState("")
  const [selectedGroomerId, setSelectedGroomerId] = useState("")
  const [groomerRequested, setGroomerRequested] = useState(false)
  const [appointmentDate, setAppointmentDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [selectedMainService, setSelectedMainService] = useState("")
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [totalPrice, setTotalPrice] = useState(0)

  // Grooming preferences state
  const [overallLength, setOverallLength] = useState("")
  const [faceStyle, setFaceStyle] = useState("")
  const [skipEarTrim, setSkipEarTrim] = useState(false)
  const [skipTailTrim, setSkipTailTrim] = useState(false)
  const [groomingNotes, setGroomingNotes] = useState("")

  // Pre-populate form once appointment data and services load
  const [detailsInitialized, setDetailsInitialized] = useState(false)
  const [servicesInitialized, setServicesInitialized] = useState(false)

  useEffect(() => {
    setDetailsInitialized(false)
    setServicesInitialized(false)
  }, [appointmentId])

  useEffect(() => {
    if (!appointment || detailsInitialized) return
    setSelectedClientId(appointment.clientId || "")
    setSelectedPetId(appointment.petId || "")
    setSelectedGroomerId(appointment.groomerId || "")
    setGroomerRequested(appointment.groomerRequested || false)
    setAppointmentDate(appointment.date || "")
    setStartTime(appointment.startTime || "")
    setNotes(appointment.notes || "")
    setTotalPrice(appointment.totalPrice || 0)
    setOverallLength(appointment.groomingPreferences?.overallLength || "")
    setFaceStyle(appointment.groomingPreferences?.faceStyle || "")
    setSkipEarTrim(appointment.groomingPreferences?.skipEarTrim || false)
    setSkipTailTrim(appointment.groomingPreferences?.skipTailTrim || false)
    setGroomingNotes(appointment.groomingPreferences?.groomingNotes || "")
    setDetailsInitialized(true)
  }, [appointment, detailsInitialized])

  useEffect(() => {
    if (!appointment || servicesInitialized || (!appointmentServicesFetched && appointment.services.length === 0)) return

    // Pre-populate services from live appointment_services if available, else from appointment.services
    const servicesToLoad = appointmentServicesFetched
      ? (dbAppointmentServices ?? []).map(s => ({ serviceId: s.service_id ?? s.id, type: s.service_type as 'main' | 'addon' }))
      : appointment.services.map(s => ({ serviceId: s.serviceId, type: s.type }))

    const mainSvc = servicesToLoad.find(s => s.type === 'main')
    setSelectedMainService(mainSvc?.serviceId ?? "")
    setSelectedAddOns(servicesToLoad.filter(s => s.type === 'addon').map(s => s.serviceId))
    setServicesInitialized(true)
  }, [appointment, appointmentServicesFetched, dbAppointmentServices, servicesInitialized])

  const selectedClient = clients?.find(c => c.id === selectedClientId)
  const selectedPet = selectedClient?.pets.find(p => p.id === selectedPetId)
  const weightRanges = useMemo(() => mapWeightRanges(weightRangesDb), [weightRangesDb])
  const selectedPetWeightCategory = selectedPet ? getWeightCategory(selectedPet.weight, weightRanges) : null
  const groomers = staff?.filter(s => s.canTakeAppointments) || []
  const normalizedStartTime = useMemo(() => {
    const currentStartTimeMinutes = parseTimeToMinutes(startTime)
    if (currentStartTimeMinutes === null) return startTime
    return minutesToTimeString(currentStartTimeMinutes)
  }, [startTime])

  useEffect(() => {
    if (!selectedPet || !selectedMainService) {
      setTotalPrice(0)
      return
    }

    let total = 0

    const mainService = mainServices?.find(s => s.id === selectedMainService)
    if (mainService && selectedPetWeightCategory) {
      total += mainService.pricing[selectedPetWeightCategory]
    }

    selectedAddOns.forEach(addonId => {
      const addon = addOns?.find(a => a.id === addonId)
      if (addon) {
        if (addon.hasSizePricing && addon.pricing && selectedPetWeightCategory) {
          total += addon.pricing[selectedPetWeightCategory]
        } else if (addon.price) {
          total += addon.price
        }
      }
    })

    setTotalPrice(total)
  }, [selectedPet, selectedPetWeightCategory, selectedMainService, selectedAddOns, mainServices, addOns])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isLocked) {
      // Locked appointment: only update notes and groomingNotes
      const groomingPreferences = {
        ...appointment!.groomingPreferences,
        groomingNotes,
      }
      updateAppointment.mutate(
        {
          id: appointment!.id,
          updated_at: appointment!.updatedAt,
          notes,
          grooming_preferences: groomingPreferences as Record<string, unknown>,
        },
        {
          onSuccess: () => {
            toast.success("Notes updated successfully!")
            navigate('/appointments')
          },
          onError: (error) => {
            if (error.name === 'ConcurrencyError') {
              toast.error(error.message)
            } else {
              toast.error("Failed to update notes. Please try again.")
            }
          },
        }
      )
      return
    }

    if (!selectedClientId || !selectedPetId || !selectedGroomerId || !appointmentDate || !normalizedStartTime || !selectedMainService) {
      toast.error("Please fill in all required fields")
      return
    }

    const client = clients?.find(c => c.id === selectedClientId)
    const pet = client?.pets.find(p => p.id === selectedPetId)
    const groomer = groomers.find(g => g.id === selectedGroomerId)

    if (!client || !pet || !groomer) {
      toast.error("Invalid selection")
      return
    }

    const services: Appointment['services'] = []
    const petWeightCategory = getWeightCategory(pet.weight, weightRanges)

    const mainService = mainServices?.find(s => s.id === selectedMainService)
    if (mainService) {
      services.push({
        serviceId: mainService.id,
        serviceName: mainService.name,
        price: mainService.pricing[petWeightCategory],
        type: 'main'
      })
    }

    selectedAddOns.forEach(addonId => {
      const addon = addOns?.find(a => a.id === addonId)
      if (addon) {
        let price = 0
        if (addon.hasSizePricing && addon.pricing) {
          price = addon.pricing[petWeightCategory]
        } else if (addon.price) {
          price = addon.price
        }
        services.push({
          serviceId: addon.id,
          serviceName: addon.name,
          price,
          type: 'addon'
        })
      }
    })

    const groomingPreferences = {
      overallLength,
      faceStyle,
      skipEarTrim,
      skipTailTrim,
      groomingNotes
    }

    updateAppointment.mutate(
      {
        id: appointment!.id,
        updated_at: appointment!.updatedAt,
        client_id: client.id,
        pet_id: pet.id,
        groomer_id: groomer.id,
        date: appointmentDate,
        start_time: normalizedStartTime,
        end_time: normalizedStartTime,
        total_price: totalPrice,
        notes,
        grooming_preferences: groomingPreferences as Record<string, unknown>,
      },
      {
        onSuccess: async () => {
          // Update appointment_services: delete existing then insert new
          const existingServices = dbAppointmentServices ?? []
          try {
            await Promise.all(
              existingServices.map(s =>
                deleteAppointmentService.mutateAsync({ serviceId: s.id, appointmentId: appointment!.id })
              )
            )
            await Promise.all(
              services.map(s =>
                createAppointmentService.mutateAsync({
                  appointment_id: appointment!.id,
                  service_id: s.serviceId || undefined,
                  service_name: s.serviceName,
                  service_type: s.type,
                  price: s.price,
                })
              )
            )
          } catch {
            toast.warning("Appointment updated but services could not be saved. Please try saving again.")
            return
          }
          toast.success("Appointment updated successfully!")
          navigate('/appointments')
        },
        onError: (error) => {
          if (error.name === 'ConcurrencyError') {
            toast.error(error.message)
          } else {
            toast.error("Failed to update appointment. Please try again.")
          }
        },
      }
    )
  }

  const [showNotifyDialog, setShowNotifyDialog] = useState(false)

  const handleCancelAppointment = () => {
    updateAppointment.mutate(
      { id: appointment!.id, updated_at: appointment!.updatedAt, status: 'cancelled' as Appointment['status'] },
      { onSuccess: () => setShowNotifyDialog(true) }
    )
  }

  const handleNotifyClient = (notify: boolean) => {
    if (notify) {
      toast.success("Appointment cancelled and client will be notified")
    } else {
      toast.success("Appointment cancelled")
    }
    navigate('/appointments')
  }

  if (!appointment) {
    return (
      <div className="min-h-full bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Appointment not found</p>
            <Button onClick={() => navigate('/appointments')} className="mt-4">
              Back to Appointments
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="page-edit-appointment" className="min-h-full bg-background p-3 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/appointments')}
          className="mb-4 hover:bg-secondary/50"
        >
          <ArrowLeft className="mr-2" />
          Back to Appointments
        </Button>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <PawPrint size={32} className="text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Edit Appointment</h1>
              <p className="text-sm text-muted-foreground">Update appointment details</p>
            </div>
          </div>

          {isLocked && (
            <div
              data-testid="locked-banner"
              className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 mb-6 dark:border-amber-700 dark:bg-amber-950/30"
            >
              <Lock size={20} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">Appointment locked after checkout</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                  Financial and service details cannot be changed. Only notes can still be edited.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Select key={`client-${selectedClientId || 'empty'}`} value={selectedClientId} onValueChange={(value) => {
                  setSelectedClientId(value)
                  setSelectedPetId("")
                }} disabled={isLocked}>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pet">Pet *</Label>
                <Select key={`pet-${selectedClientId || 'none'}-${selectedPetId || 'empty'}`} value={selectedPetId} onValueChange={setSelectedPetId} disabled={!selectedClientId || isLocked}>
                  <SelectTrigger id="pet">
                    <SelectValue placeholder="Select a pet" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedClient?.pets.map(pet => (
                      <SelectItem key={pet.id} value={pet.id}>
                        <span className="flex items-center gap-2">
                          <PawPrint size={16} />
                          {pet.name} - {pet.weight} lbs ({getWeightCategoryLabel(getWeightCategory(pet.weight, weightRanges))})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  required
                  disabled={isLocked}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Time *</Label>
                <Select key={`time-${normalizedStartTime || 'empty'}`} value={normalizedStartTime} onValueChange={setStartTime} disabled={isLocked}>
                  <SelectTrigger id="time">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_TIME_OPTIONS.map(time => (
                      <SelectItem key={time} value={time}>{formatTimeLabel(time)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="groomer">Groomer *</Label>
                <Select key={`groomer-${selectedGroomerId || 'empty'}`} value={selectedGroomerId} onValueChange={setSelectedGroomerId} disabled={isLocked}>
                  <SelectTrigger id="groomer">
                    <SelectValue placeholder="Select groomer" />
                  </SelectTrigger>
                  <SelectContent>
                    {groomers.map(groomer => (
                      <SelectItem key={groomer.id} value={groomer.id}>
                        {groomer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 pt-8">
                <Checkbox
                  id="requested"
                  checked={groomerRequested}
                  onCheckedChange={(checked) => setGroomerRequested(checked as boolean)}
                  disabled={isLocked}
                />
                <label
                  htmlFor="requested"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Client requested this groomer
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="mainService">Main Service *</Label>
                <Select key={`main-service-${selectedMainService || 'empty'}`} value={selectedMainService} onValueChange={setSelectedMainService} disabled={!selectedPet || isLocked}>
                  <SelectTrigger id="mainService" className="mt-2">
                    <SelectValue placeholder="Select main service" />
                  </SelectTrigger>
                  <SelectContent>
                    {mainServices?.map(service => (
                      <SelectItem key={service.id} value={service.id}>
                        <div className="flex justify-between items-center w-full">
                          <span>{service.name}</span>
                          {selectedPet && selectedPetWeightCategory && (
                            <span className="ml-4 text-muted-foreground">
                              ${service.pricing[selectedPetWeightCategory].toFixed(2)}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Add-Ons (Optional)</Label>
                <div className="space-y-2 mt-2">
                  {addOns?.map(addon => {
                    const isSelected = selectedAddOns.includes(addon.id)
                    let price = 0
                    if (selectedPet) {
                      if (addon.hasSizePricing && addon.pricing && selectedPetWeightCategory) {
                        price = addon.pricing[selectedPetWeightCategory]
                      } else if (addon.price) {
                        price = addon.price
                      }
                    }

                    return (
                      <div key={addon.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/20 transition-colors">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={addon.id}
                            checked={isSelected}
                            disabled={!selectedPet || isLocked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedAddOns([...selectedAddOns, addon.id])
                              } else {
                                setSelectedAddOns(selectedAddOns.filter(id => id !== addon.id))
                              }
                            }}
                          />
                          <label
                            htmlFor={addon.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {addon.name}
                          </label>
                        </div>
                        {selectedPet && (
                          <span className="text-sm text-muted-foreground">
                            ${price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Grooming Preferences Card */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Scissors size={20} className="text-primary" />
                <h3 className="font-semibold">Grooming Preferences</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Overall length</Label>
                  <RadioGroup value={overallLength} onValueChange={setOverallLength} disabled={isLocked}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {["Short & neat", "Medium & neat", "Long & fluffy", "Breed standard"].map((option) => (
                        <div key={option} className="flex items-center space-x-1.5">
                          <RadioGroupItem value={option} id={`length-${option}`} />
                          <Label htmlFor={`length-${option}`} className="text-sm font-normal cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm font-medium mb-2 block">Face style</Label>
                  <RadioGroup value={faceStyle} onValueChange={setFaceStyle} disabled={isLocked}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {["Short & neat", "Round / Teddy", "Beard / Mustache", "Breed Standard"].map((option) => (
                        <div key={option} className="flex items-center space-x-1.5">
                          <RadioGroupItem value={option} id={`face-${option}`} />
                          <Label htmlFor={`face-${option}`} className="text-sm font-normal cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm font-medium mb-2 block">Trim preferences</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="flex items-center space-x-1.5">
                      <Checkbox
                        id="skip-ear-trim"
                        checked={skipEarTrim}
                        onCheckedChange={(checked) => setSkipEarTrim(checked as boolean)}
                        disabled={isLocked}
                      />
                      <Label htmlFor="skip-ear-trim" className="text-sm font-normal cursor-pointer">
                        Skip Ear Trim
                      </Label>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Checkbox
                        id="skip-tail-trim"
                        checked={skipTailTrim}
                        onCheckedChange={(checked) => setSkipTailTrim(checked as boolean)}
                        disabled={isLocked}
                      />
                      <Label htmlFor="skip-tail-trim" className="text-sm font-normal cursor-pointer">
                        Skip Tail Trim
                      </Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label htmlFor="grooming-notes" className="text-sm font-medium mb-2 block">Grooming Notes</Label>
                  <Textarea
                    id="grooming-notes"
                    value={groomingNotes}
                    onChange={(e) => setGroomingNotes(e.target.value)}
                    placeholder="Any special grooming instructions..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions or notes..."
                rows={3}
              />
            </div>

            <Card className="p-6 bg-primary/5 border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CurrencyDollar size={24} className="text-primary" />
                  <span className="text-lg font-semibold">Total Price</span>
                </div>
                <div className="text-3xl font-bold text-primary">
                  ${totalPrice.toFixed(2)}
                </div>
              </div>
            </Card>

            <div className="flex gap-3 flex-col sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/appointments')}
                className="flex-1"
              >
                Back
              </Button>
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                {isLocked ? "Save Notes" : "Save Changes"}
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
              {!isLocked && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      Cancel Appt
                    </Button>
                  </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel this appointment?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>No, Keep It</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelAppointment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Yes, Cancel Appointment
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              )}

            <AlertDialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Notify Client?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Would you like to notify the client about this cancellation?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => handleNotifyClient(false)}>
                    No, Don't Notify
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleNotifyClient(true)}>
                    Yes, Notify Client
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>
      </div>
    </div>
  )
}
