import { motion } from 'framer-motion'
import { getBookingColor } from '../utils/dashboardCalculations'
import { bookingHeatmapData } from '../data/dashboardDefaults'
import { useState } from 'react'

export function BookingHeatmap14() {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const heatmapDays = bookingHeatmapData

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {(heatmapDays || []).map((day, index) => (
          <motion.div
            key={day.date}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
            whileHover={{ scale: 1.05 }}
            onHoverStart={() => setHoveredDay(index)}
            onHoverEnd={() => setHoveredDay(null)}
            className="relative group"
          >
            <div
              className="aspect-square rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer transition-all"
              style={{
                backgroundColor: getBookingColor(day.bookedPercentage),
              }}
            >
              <div className="text-xs font-medium text-white/90">{day.dayOfWeek}</div>
              <div className="text-lg font-bold text-white">{day.dayOfMonth}</div>
            </div>
            
            {hoveredDay === index && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-popover text-popover-foreground px-3 py-2 rounded-lg shadow-lg border border-border text-xs whitespace-nowrap z-10"
              >
                <div className="font-semibold">{day.bookedPercentage}% Booked</div>
                <div className="text-muted-foreground">
                  {day.bookedSlots} / {day.totalSlots} slots
                </div>
                <div className="text-muted-foreground">{day.openSlots} open</div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
