import { useState } from "react"
import { Scissors, Calendar, Clock, User, PawPrint } from "@phosphor-icons/react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { motion } from "framer-motion"
import { useIsMobile } from "@/hooks/use-mobile"

interface Service {
  name: string
  date: string
  groomer: string
  duration?: string
  startTime?: string
  cost: string
  services: string[]
  notes?: string
}

interface ServiceHistoryCardProps {
  petName: string
  services: Service[]
}

export function ServiceHistoryCard({ petName, services }: ServiceHistoryCardProps) {
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const isMobile = useIsMobile()

  return (
    <>
      <motion.div className="relative">
        <motion.div
          className="absolute inset-0 rounded-lg opacity-0 blur-xl pointer-events-none"
          animate={{
            opacity: [0.06, 0.1, 0.06],
            background: [
              "radial-gradient(circle at 80% 20%, oklch(0.75 0.15 195 / 0.25), transparent 65%)",
              "radial-gradient(circle at 20% 80%, oklch(0.75 0.15 195 / 0.3), transparent 65%)",
              "radial-gradient(circle at 50% 50%, oklch(0.75 0.15 195 / 0.28), transparent 65%)",
              "radial-gradient(circle at 80% 20%, oklch(0.75 0.15 195 / 0.25), transparent 65%)"
            ]
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <Card className="p-3 border-border bg-card relative z-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className={`${isMobile ? "text-base" : "text-lg"} font-bold flex items-center gap-1.5 sm:gap-2`}>
              <Scissors size={isMobile ? 16 : 18} className="text-primary shrink-0" weight="fill" />
              <span className="flex items-center gap-1 sm:gap-1.5">
                <span className={isMobile ? "hidden" : "inline"}>Service History - </span>
                <PawPrint size={isMobile ? 14 : 16} weight="fill" className="text-primary shrink-0" />
                <span className="truncate">{petName}</span>
              </span>
            </h3>
          </div>

          <div className="space-y-2">
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No service history yet</p>
            ) : (
              services.map((service, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  onClick={() => setSelectedService(service)}
                  className="bg-secondary/30 rounded-md p-2.5 border border-border hover:border-primary/50 transition-all duration-200 cursor-pointer hover:bg-secondary/50"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{service.name}</p>
                      <div className={`flex ${isMobile ? "flex-col gap-0.5" : "items-center gap-3"} mt-1`}>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar size={12} className="shrink-0" />
                          {service.date}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User size={12} className="shrink-0" />
                          {service.groomer}
                        </p>
                        {!isMobile && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock size={12} />
                            {service.startTime || service.duration}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="font-bold text-primary shrink-0">{service.cost}</p>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-1">
                    {service.services.slice(0, isMobile ? 3 : undefined).map((svc) => (
                      <Badge
                        key={svc}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 bg-secondary/70"
                      >
                        {svc}
                      </Badge>
                    ))}
                    {isMobile && service.services.length > 3 && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 bg-secondary/70"
                      >
                        +{service.services.length - 3}
                      </Badge>
                    )}
                  </div>

                  {service.notes && !isMobile && (
                    <p className="text-xs text-muted-foreground italic mt-1.5 border-t border-border/50 pt-1.5 line-clamp-2">
                      {service.notes}
                    </p>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </motion.div>

      <Dialog open={selectedService !== null} onOpenChange={() => setSelectedService(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          {selectedService && (
            <>
              <DialogHeader>
                <DialogTitle className={`${isMobile ? "text-lg" : "text-xl"} font-bold flex items-center gap-2`}>
                  <Scissors size={20} className="text-primary" weight="fill" />
                  Appointment Details
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className={`${isMobile ? "text-xl" : "text-2xl"} font-bold mb-2`}>{selectedService.name}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar size={16} className="text-primary shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
                          <p className="font-semibold">{selectedService.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={16} className="text-primary shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Start Time</p>
                          <p className="font-semibold">{selectedService.startTime || selectedService.duration}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <User size={16} className="text-primary shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Groomer</p>
                          <p className="font-semibold">{selectedService.groomer}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <PawPrint size={16} className="text-primary shrink-0" weight="fill" />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pet</p>
                          <p className="font-semibold">{petName}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={`text-${isMobile ? "left" : "right"} w-full sm:w-auto`}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Cost</p>
                    <p className={`${isMobile ? "text-2xl" : "text-3xl"} font-bold text-primary`}>{selectedService.cost}</p>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Services Provided</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedService.services.map((svc) => (
                      <Badge
                        key={svc}
                        variant="secondary"
                        className="text-sm px-3 py-1 bg-secondary/70"
                      >
                        {svc}
                      </Badge>
                    ))}
                  </div>
                </div>

                {selectedService.notes && (
                  <div className="border-t border-border pt-4">
                    <p className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Notes</p>
                    <p className="text-sm bg-secondary/30 rounded-md p-3 border border-border italic">
                      {selectedService.notes}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
