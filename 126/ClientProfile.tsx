import { ArrowLeft, ChatCircleText, PencilSimple, Plus, PawPrint } from "@phosphor-icons/react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { StatWidget } from "@/components/StatWidget"
import { PetCard } from "@/components/PetCard"
import { ServiceHistoryCard } from "@/components/ServiceHistoryCard"
import { MedicalInfoCard } from "@/components/MedicalInfoCard"
import { PhotoGalleryCard } from "@/components/PhotoGalleryCard"
import { PageLoadingState } from "@/components/PageLoadingState"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useMemo, useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { useClient, usePets } from '@/hooks/data/useClients'
import { useAppointments } from '@/hooks/data/useAppointments'
import { useAppointmentCheckoutMap } from '@/hooks/useAppointmentCheckout'
import { paymentIntentMatchesClient, usePaymentIntents } from '@/hooks/data/usePayments'
import { clientFromDb } from '@/lib/mappers/clientMapper'
import { appointmentFromDb } from '@/lib/mappers/appointmentMapper'
import { formatInBusinessTimezone, getTodayInBusinessTimezone } from "@/lib/date-utils"

export function ClientProfile() {
  const navigate = useNavigate()
  const { clientId } = useParams()
  const isMobile = useIsMobile()
  const { data: dbClient, isPending: isClientLoading } = useClient(clientId)
  const { data: dbPets } = usePets(clientId)
  const { data: dbAppointments } = useAppointments()
  const checkoutByAppointmentId = useAppointmentCheckoutMap()
  const { data: paymentIntents } = usePaymentIntents()
  
  const client = useMemo(() => dbClient ? clientFromDb(dbClient, dbPets ?? []) : undefined, [dbClient, dbPets])
  const appointments = useMemo(() => 
    (dbAppointments ?? []).map(a => appointmentFromDb(a)),
    [dbAppointments]
  )
  
  const pets = useMemo(() => client ? client.pets
    .filter(pet => pet.isActive !== false)
    .map(pet => ({
    id: pet.id,
    name: pet.name,
    breed: pet.breed,
    mixedBreed: pet.mixedBreed ?? "",
    status: "Active",
    temperament: pet.temperament ?? ([] as string[]),
    weight: pet.weight ? `${pet.weight} lbs` : "",
    color: pet.color ?? "",
    gender: pet.gender ?? "",
    birthday: pet.birthday ?? "",
    overallLength: pet.overallLength ?? "",
    faceStyle: pet.faceStyle ?? "",
    skipEarTrim: pet.skipEarTrim ?? false,
    skipTailTrim: pet.skipTailTrim ?? false,
    desiredStylePhoto: pet.desiredStylePhoto ?? "",
    groomingNotes: pet.groomingNotes ?? ""
  })) : [], [client])

  const [selectedPet, setSelectedPet] = useState(pets.length > 0 ? pets[0].id : "")

  useEffect(() => {
    if (!selectedPet && pets.length > 0) {
      setSelectedPet(pets[0].id)
    }
  }, [pets, selectedPet])

  interface MedicalRecord {
    type: string
    name: string
    date: string
    nextDue?: string
  }

  // Create service history from actual appointments for each pet
  const petData = useMemo(() => {
    const data: Record<string, {
      serviceHistory: Array<{
        name: string
        date: string
        groomer: string
        duration?: string
        startTime?: string
        cost: string
        services: string[]
        notes?: string
      }>
      vaccinations: MedicalRecord[]
      groomingPhotos: never[]
      allergies: string[]
      medications: MedicalRecord[]
      notes: string
    }> = {}
    
    pets.forEach(pet => {
      // Get all completed appointments for this pet
      const petAppointments = (appointments || [])
        .filter(apt => apt.petId === pet.id && apt.clientId === clientId && 
          apt.status === 'picked_up')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      // Transform appointments into service history format
      const serviceHistory = petAppointments.map(apt => {
        const mainService = apt.services.find(s => s.type === 'main')
        const allServiceNames = apt.services.map(s => s.serviceName)
        
        return {
          name: mainService?.serviceName || 'Grooming',
          date: formatInBusinessTimezone(apt.date, 'M/d/yyyy'),
          groomer: apt.groomerName,
          startTime: apt.startTime,
          cost: `$${(checkoutByAppointmentId.get(apt.id)?.totalBeforeTip ?? apt.totalPrice).toFixed(2)}`,
          services: allServiceNames,
          notes: apt.notes
        }
      })
      
      data[pet.id] = {
        serviceHistory,
        vaccinations: [],
        groomingPhotos: [],
        allergies: [],
        medications: [],
        notes: ""
      }
    })
    
    return data
  }, [pets, appointments, clientId, checkoutByAppointmentId])

  const clientAppointmentIds = useMemo(
    () => new Set((dbAppointments ?? []).filter((appointment) => appointment.client_id === clientId).map((appointment) => appointment.id)),
    [dbAppointments, clientId],
  )

  const clientPayments = useMemo(
    () => (paymentIntents ?? []).filter((payment) => paymentIntentMatchesClient(payment, clientId, clientAppointmentIds)),
    [paymentIntents, clientAppointmentIds, clientId],
  )

  const clientAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.clientId === clientId),
    [appointments, clientId],
  )

  const paymentSummary = useMemo(() => {
    const settledPayments = clientPayments.filter((payment) =>
      ['succeeded', 'requires_capture', 'processing'].includes(payment.status),
    )
    const lifetimeValue = settledPayments.reduce((sum, payment) => sum + payment.amount, 0) / 100
    const averageVisitValue = settledPayments.length > 0 ? lifetimeValue / settledPayments.length : 0
    const averageTip =
      settledPayments.length > 0
        ? settledPayments.reduce((sum, payment) => sum + (payment.metadata.tipAmount ?? 0), 0) / settledPayments.length
        : 0

    return {
      lifetimeValue,
      paymentCount: settledPayments.length,
      averageVisitValue,
      averageTip,
    }
  }, [clientPayments])

  const appointmentSummary = useMemo(() => {
    const today = getTodayInBusinessTimezone()
    const completedAppointments = clientAppointments
      .filter((appointment) => appointment.status === 'picked_up')
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
    const latestCompletedAppointment = completedAppointments.at(-1)
    const upcomingAppointments = clientAppointments
      .filter((appointment) =>
        ['scheduled', 'checked_in', 'in_progress', 'ready'].includes(appointment.status) &&
        appointment.date >= today,
      )
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
    const nextAppointment = upcomingAppointments[0]

    let averageVisitIntervalDays: number | null = null
    if (completedAppointments.length >= 2) {
      let totalDaysBetweenVisits = 0
      for (let index = 1; index < completedAppointments.length; index += 1) {
        const previous = new Date(`${completedAppointments[index - 1].date}T00:00:00`)
        const current = new Date(`${completedAppointments[index].date}T00:00:00`)
        totalDaysBetweenVisits += Math.round((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24))
      }
      averageVisitIntervalDays = totalDaysBetweenVisits / (completedAppointments.length - 1)
    }

    return {
      averageVisitIntervalDays,
      lastVisitLabel: latestCompletedAppointment ? formatInBusinessTimezone(latestCompletedAppointment.date, 'M/d/yyyy') : '—',
      nextAppointmentLabel: nextAppointment ? formatInBusinessTimezone(nextAppointment.date, 'M/d/yyyy') : '—',
      upcomingCount: upcomingAppointments.length,
      noShowCount: clientAppointments.filter((appointment) => appointment.status === 'no_show').length,
      cancelCount: clientAppointments.filter((appointment) => appointment.status === 'cancelled').length,
    }
  }, [clientAppointments])

  const widgetValues = useMemo(() => {
    const intervalLabel =
      appointmentSummary.averageVisitIntervalDays === null
        ? '—'
        : `${Math.max(1, Math.round(appointmentSummary.averageVisitIntervalDays))}d`

    return {
      lifetime: `$${paymentSummary.lifetimeValue.toFixed(2)}`,
      payments: paymentSummary.paymentCount.toString(),
      averageVisit: `$${paymentSummary.averageVisitValue.toFixed(2)}`,
      averageTip: `$${paymentSummary.averageTip.toFixed(2)}`,
      interval: intervalLabel,
      lastVisit: appointmentSummary.lastVisitLabel,
      upcoming: appointmentSummary.upcomingCount.toString(),
      nextAppointment: appointmentSummary.nextAppointmentLabel,
      noShows: appointmentSummary.noShowCount.toString(),
      cancels: appointmentSummary.cancelCount.toString(),
    }
  }, [appointmentSummary, paymentSummary])

  const navigateToAppointments = (options?: { statuses?: string[]; appointmentId?: string }) => {
    const params = new URLSearchParams()
    if (clientId) {
      params.set('clientId', clientId)
    }
    params.set('view', 'list')
    if (options?.statuses?.length) {
      params.set('statuses', options.statuses.join(','))
    }
    if (options?.appointmentId) {
      params.set('appointmentId', options.appointmentId)
    }
    navigate(`/appointments?${params.toString()}`)
  }

  if (isClientLoading) {
    return <PageLoadingState label="Loading client profile…" />
  }
  
  // If client not found, show error message
  if (!client) {
    return (
      <div className="min-h-full bg-background text-foreground p-6">
        <div className="max-w-[1400px] mx-auto">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => navigate('/clients')}
          >
            <ArrowLeft size={24} className="mr-2" />
            Back to Clients
          </Button>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-2">Client Not Found</h1>
            <p className="text-muted-foreground">The client you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="bg-card/60 border-b border-border/50">
        <div className="max-w-[1400px] mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          <header className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-3 sm:gap-4 w-full sm:w-auto">
              <Button
                variant="ghost"
                size="icon"
                className="mt-0.5 sm:mt-1 hover:bg-secondary transition-all duration-200 shrink-0"
                onClick={() => navigate('/clients')}
              >
                <ArrowLeft size={24} />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight leading-none">
                  {client.name}
                </h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mt-1">
                  Client Since {client.createdAt ? formatInBusinessTimezone(client.createdAt, 'M/d/yyyy') : "—"}
                </p>
              </div>
            </div>
            
            {isMobile ? (
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-colors duration-200 text-sm"
                  onClick={() => navigate(`/appointments/new?clientId=${clientId}`)}
                >
                  Add Appt
                </Button>
                <Button
                  variant="secondary"
                  className="font-semibold transition-colors duration-200 text-sm"
                  onClick={() => navigate(`/clients/${clientId}/add-pet`)}
                >
                  <Plus size={16} className="mr-1" />
                  Add Pet
                </Button>
                <Button
                  variant="secondary"
                  className="font-semibold transition-colors duration-200 text-sm"
                  onClick={() => navigate(`/clients/${clientId}/payment-history`)}
                >
                  Payment History
                </Button>
                <Button
                  variant="outline"
                  className="font-semibold transition-colors duration-200 text-sm border-primary/35 bg-primary/10 text-foreground hover:bg-primary/15 hover:border-primary/45"
                  onClick={() => navigate(`/messages?clientId=${clientId}`)}
                >
                  Message
                </Button>
                <Button
                  variant="secondary"
                  className="font-semibold transition-colors duration-200 text-sm"
                  onClick={() => navigate(`/clients/${clientId}/contact`)}
                >
                  Contact
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-colors duration-200"
                  onClick={() => navigate(`/appointments/new?clientId=${clientId}`)}
                >
                  Add Appointment
                </Button>
                <Button
                  variant="secondary"
                  className="font-semibold transition-colors duration-200"
                  onClick={() => navigate(`/clients/${clientId}/add-pet`)}
                >
                  <Plus size={18} className="mr-2" />
                  Add Pet
                </Button>
                <Button
                  variant="secondary"
                  className="font-semibold transition-colors duration-200"
                  onClick={() => navigate(`/clients/${clientId}/payment-history`)}
                >
                  Payment History
                </Button>
                <Button
                  variant="outline"
                  className="font-semibold transition-colors duration-200 border-primary/35 bg-primary/10 text-foreground hover:bg-primary/15 hover:border-primary/45"
                  onClick={() => navigate(`/messages?clientId=${clientId}`)}
                >
                  <ChatCircleText size={18} className="mr-2" />
                  Message
                </Button>
                <Button
                  variant="secondary"
                  className="font-semibold transition-colors duration-200"
                  onClick={() => navigate(`/clients/${clientId}/contact`)}
                >
                  Contact
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-secondary transition-colors duration-200"
                  onClick={() => navigate(`/clients/${clientId}/edit`)}
                >
                  <PencilSimple size={20} />
                </Button>
              </div>
            )}
          </header>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4">
            <StatWidget
              stats={[
                { label: "LIFETIME", value: widgetValues.lifetime },
                { label: "PAYMENTS", value: widgetValues.payments }
              ]}
              onClick={() => navigate(`/clients/${clientId}/payment-history`)}
            />

            <StatWidget
              stats={[
                { label: "AVG VISIT", value: widgetValues.averageVisit },
                { label: "AVG TIP", value: widgetValues.averageTip }
              ]}
              onClick={() => navigate(`/clients/${clientId}/payment-history`)}
            />

            <StatWidget
              stats={[
                { label: "AVG INTERVAL", value: widgetValues.interval },
                { label: "LAST VISIT", value: widgetValues.lastVisit }
              ]}
              onClick={() => navigateToAppointments({ statuses: ['picked_up'] })}
            />

            <StatWidget
              stats={[
                { label: "UPCOMING", value: widgetValues.upcoming },
                { label: "NEXT APPT", value: widgetValues.nextAppointment }
              ]}
              onClick={() => navigateToAppointments({ statuses: ['scheduled', 'checked_in', 'in_progress', 'ready'] })}
            />

            <StatWidget
              stats={[
                { label: "NO-SHOWS", value: widgetValues.noShows },
                { label: "CANCELS", value: widgetValues.cancels }
              ]}
              onClick={() => navigateToAppointments({ statuses: ['no_show', 'cancelled'] })}
            />
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">

        {pets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No pets added yet</p>
            <Button
              onClick={() => navigate(`/clients/${clientId}/add-pet`)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={18} className="mr-2" />
              Add First Pet
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 pet-card-grid mb-6 sm:mb-8">
              {pets.map((pet, index) => (
                <PetCard 
                  key={pet.id} 
                  {...pet} 
                  index={index}
                />
              ))}
            </div>

            <div className="pt-3 sm:pt-4 border-t border-border">
              <Tabs value={selectedPet} onValueChange={setSelectedPet} className="w-full relative z-0">
              <div className="flex items-center justify-between mb-3">
                <TabsList className="bg-secondary/50 w-full sm:w-auto overflow-x-auto">
                  {pets.map((pet) => (
                    <TabsTrigger 
                      key={pet.id} 
                      value={pet.id} 
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm"
                    >
                      <PawPrint size={14} weight="fill" className="mr-1 sm:mr-1.5" />
                      {pet.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {pets.map((pet) => (
                <TabsContent key={pet.id} value={pet.id} className="space-y-3 sm:space-y-4 mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    <ServiceHistoryCard petName={pet.name} services={petData[pet.id]?.serviceHistory || []} />
                    
                    <PhotoGalleryCard petName={pet.name} petId={pet.id} />
                  </div>

                  <MedicalInfoCard
                    petName={pet.name}
                    vaccinations={petData[pet.id]?.vaccinations || []}
                    allergies={petData[pet.id]?.allergies || []}
                    medications={petData[pet.id]?.medications || []}
                    notes={petData[pet.id]?.notes || ""}
                  />
                </TabsContent>
              ))}
              </Tabs>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
