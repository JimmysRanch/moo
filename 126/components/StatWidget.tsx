import { Card } from "@/components/ui/card"

interface Stat {
  label: string
  value: string | number
}

interface StatWidgetProps {
  stats: Stat[]
  onClick?: () => void
}

export function StatWidget({ 
  stats, 
  onClick 
}: StatWidgetProps) {
  return (
    <Card 
      className="p-2 sm:p-2 border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 cursor-pointer relative"
      onClick={onClick}
    >
      <div className="space-y-0.5">
        {stats.map((stat, index) => (
          <div key={stat.label}>
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider leading-tight">
                {stat.label}
              </p>
              <p className="text-lg sm:text-2xl font-bold">
                {stat.value}
              </p>
            </div>
            {index < stats.length - 1 && (
              <div className="h-px my-0.5 bg-border" />
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
