import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { PawPrint, PencilSimple, Scissors } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface PetCardProps {
  id: string
  name: string
  breed: string
  mixedBreed?: string
  status: string
  temperament: string[]
  weight?: string
  color?: string
  gender?: string
  birthday?: string
  overallLength?: string
  faceStyle?: string
  skipEarTrim?: boolean
  skipTailTrim?: boolean
  desiredStylePhoto?: string
  groomingNotes?: string
  index: number
}

export function PetCard({
  id,
  name,
  breed,
  mixedBreed,
  status,
  temperament,
  weight,
  color,
  gender,
  birthday,
  overallLength,
  faceStyle,
  skipEarTrim,
  skipTailTrim,
  desiredStylePhoto,
  groomingNotes
}: PetCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const { clientId } = useParams()
  const navigate = useNavigate()

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/clients/${clientId}/pets/${id}/edit`)
  }

  return (
    <div
      className="h-full min-h-[320px] relative"
      style={{ perspective: "1000px" }}
    >
      <div
        className="relative w-full h-full cursor-pointer z-10"
        style={{ transformStyle: "preserve-3d" }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className="w-full h-full relative transition-transform duration-600"
          style={{ 
            transformStyle: "preserve-3d",
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
        >
          <Card 
            className="p-3 border-border bg-card hover:border-primary/50 transition-all duration-200 h-full"
            style={{ 
              backfaceVisibility: "hidden",
              position: isFlipped ? "absolute" : "relative",
              opacity: isFlipped ? 0 : 1
            }}
          >
            <div 
              className="absolute top-2 right-2 z-10"
              onClick={handleEditClick}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-secondary transition-all duration-200"
              >
                <PencilSimple size={14} />
              </Button>
            </div>

            <div className="mb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <PawPrint size={18} weight="fill" className="text-primary" />
                {name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {breed}{mixedBreed ? ` / ${mixedBreed}` : ''} • {status}
              </p>
              {temperament.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {temperament.map((trait) => (
                    <Badge
                      key={trait}
                      variant="secondary"
                      className="text-xs px-2 py-0.5 bg-secondary/50"
                    >
                      {trait}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {weight && (
                <div className="bg-secondary/30 rounded-md p-2 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Weight</p>
                  <p className="text-sm font-semibold">{weight}</p>
                </div>
              )}
              {gender && (
                <div className="bg-secondary/30 rounded-md p-2 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gender</p>
                  <p className="text-sm font-semibold">{gender}</p>
                </div>
              )}
              {color && (
                <div className="bg-secondary/30 rounded-md p-2 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Color</p>
                  <p className="text-sm font-semibold">{color}</p>
                </div>
              )}
              {birthday && (
                <div className="bg-secondary/30 rounded-md p-2 border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Birthday</p>
                  <p className="text-sm font-semibold">{birthday}</p>
                </div>
              )}
            </div>

            <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground italic">
              Click to flip
            </div>
          </Card>

          <Card 
            className="p-3 border-border bg-card h-full"
            style={{ 
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              position: isFlipped ? "relative" : "absolute",
              top: 0,
              left: 0,
              right: 0,
              opacity: isFlipped ? 1 : 0
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Scissors size={18} className="text-primary" weight="fill" />
                Grooming Preferences
              </h3>
              <div onClick={handleEditClick}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-secondary transition-all duration-200"
                >
                  <PencilSimple size={14} />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/30 rounded-md p-2 border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                    Overall length
                  </p>
                  <p className="text-sm font-semibold">{overallLength || "Not specified"}</p>
                </div>
                <div className="bg-secondary/30 rounded-md p-2 border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                    Face style
                  </p>
                  <p className="text-sm font-semibold">{faceStyle || "Not specified"}</p>
                </div>
              </div>

              <div className="bg-secondary/30 rounded-md p-2 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                  Trim preferences
                </p>
                <p className="text-sm font-semibold">
                  {skipEarTrim ? "Skip ear trim" : "Ear trim ok"} • {skipTailTrim ? "Skip tail trim" : "Tail trim ok"}
                </p>
              </div>

              {desiredStylePhoto && (
                <div className="bg-secondary/30 rounded-md p-2 border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Desired style
                  </p>
                  <img
                    src={desiredStylePhoto}
                    alt={`${name || 'Pet'} grooming reference`}
                    className="h-24 w-full object-cover rounded"
                  />
                </div>
              )}

              {groomingNotes && (
                <div className="bg-secondary/30 rounded-md p-2 border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Additional details
                  </p>
                  <p className="text-xs text-foreground">{groomingNotes}</p>
                </div>
              )}
            </div>

            <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground italic">
              Click to flip back
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
