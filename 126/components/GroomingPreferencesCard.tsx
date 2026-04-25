import { Scissors, PencilSimple, Star, PawPrint } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface GroomingPreferencesCardProps {
  petName: string
  haircut?: string
  shampoo?: string
  addOns: string[]
  specialInstructions?: string
  favoriteGroomer?: string
}

export function GroomingPreferencesCard({
  petName,
  haircut,
  shampoo,
  addOns,
  specialInstructions,
  favoriteGroomer
}: GroomingPreferencesCardProps) {
  return (
    <Card className="p-3 border-border bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Scissors size={18} className="text-primary" weight="fill" />
          Grooming Preferences - 
          <span className="flex items-center gap-1.5">
            <PawPrint size={16} weight="fill" className="text-primary" />
            {petName}
          </span>
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-secondary transition-all duration-200"
        >
          <PencilSimple size={14} />
        </Button>
      </div>

      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-secondary/30 rounded-md p-2 border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
              Preferred Cut
            </p>
            <p className="text-sm font-semibold">{haircut || "Not specified"}</p>
          </div>
          <div className="bg-secondary/30 rounded-md p-2 border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
              Shampoo
            </p>
            <p className="text-sm font-semibold">{shampoo || "Standard"}</p>
          </div>
        </div>

        {favoriteGroomer && (
          <div className="bg-secondary/30 rounded-md p-2 border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5 flex items-center gap-1">
              <Star size={12} className="text-primary" weight="fill" />
              Favorite Groomer
            </p>
            <p className="text-sm font-semibold">{favoriteGroomer}</p>
          </div>
        )}

        {addOns.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
              Regular Add-ons
            </p>
            <div className="flex flex-wrap gap-1.5">
              {addOns.map((addOn) => (
                <Badge
                  key={addOn}
                  variant="secondary"
                  className="text-xs bg-secondary/70"
                >
                  {addOn}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {specialInstructions && (
          <div className="bg-secondary/30 rounded-md p-2 border border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Special Instructions
            </p>
            <p className="text-sm text-foreground">{specialInstructions}</p>
          </div>
        )}
      </div>
    </Card>
  )
}
