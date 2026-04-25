import { motion } from 'framer-motion'
import { dashboardGroomerWeekData } from '../data/dashboardDefaults'
import { useNavigate } from 'react-router-dom'

export function GroomerUtilization() {
  const navigate = useNavigate()
  const groomers = dashboardGroomerWeekData
  const workdayStart = 8
  const workdayEnd = 18
  const workdayHours = workdayEnd - workdayStart
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const handleCardClick = () => {
    navigate('/staff')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(groomers || []).map((groomer, index) => (
          <motion.div
            key={groomer.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            onClick={handleCardClick}
            className="bg-secondary/50 rounded-lg p-3 border border-border cursor-pointer hover:bg-secondary/70 hover:shadow-lg transition-all duration-200"
          >
            <div className="font-semibold text-xs mb-1.5">{groomer.name}</div>
            <div className="flex items-baseline gap-2 mb-1">
              <div className="text-xl font-bold text-primary">{groomer.weekUtilization}%</div>
              <div className="text-xs text-muted-foreground">{groomer.weekAppointments} appts</div>
            </div>
            <div className="text-[10px] text-muted-foreground">This Week</div>
          </motion.div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Weekly Schedule
        </div>
        
        {(groomers || []).map((groomer, groomerIndex) => (
          <div key={groomer.id} className="space-y-1.5">
            <div className="text-xs font-medium">{groomer.name}</div>
            
            <div className="space-y-1">
              {daysOfWeek.map((day, dayIndex) => {
                const daySchedule = groomer.weekSchedule[dayIndex]
                
                return (
                  <div key={day} className="flex items-center gap-2">
                    <div className="w-8 text-[10px] text-muted-foreground font-medium">{day}</div>
                    
                    <div className="flex-1 relative h-6 bg-secondary/30 rounded-lg">
                      <div className="absolute inset-0 flex items-center px-1.5 pointer-events-none">
                        <div className="flex w-full justify-between text-[8px] text-muted-foreground/40">
                          <span>8a</span>
                          <span>12p</span>
                          <span>6p</span>
                        </div>
                      </div>
                      
                      {daySchedule.appointments.map((appointment, apptIndex) => {
                        const leftPercent = ((appointment.start - workdayStart) / workdayHours) * 100
                        const widthPercent = (appointment.duration / workdayHours) * 100
                        
                        return (
                          <motion.div
                            key={apptIndex}
                            initial={{ scaleX: 0, opacity: 0 }}
                            animate={{ scaleX: 1, opacity: 1 }}
                            transition={{ 
                              duration: 0.3, 
                              delay: groomerIndex * 0.15 + dayIndex * 0.02 + apptIndex * 0.01,
                              ease: 'easeOut'
                            }}
                            className="absolute top-0.5 bottom-0.5 bg-primary rounded flex items-center justify-center overflow-hidden group origin-left"
                            style={{
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                            }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80" />
                          </motion.div>
                        )
                      })}
                    </div>
                    
                    <div className="w-10 text-[10px] text-muted-foreground text-right">
                      {daySchedule.utilization}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
