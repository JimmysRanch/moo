import { useState } from 'react'
import { PawPrint, PencilSimple } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface EditPetDialogProps {
  petId: string
  petName: string
  breed: string
  age: string
  weight: string
  color: string
  sex: string
  haircut?: string
  shampoo?: string
  favoriteGroomer?: string
  specialInstructions?: string
  temperament?: string[]
}

export function EditPetDialog({
  petId,
  petName: initialName,
  breed: initialBreed,
  age: _initialAge,
  weight: initialWeight,
  color: initialColor,
  sex: initialSex,
  haircut: initialHaircut,
  shampoo: initialShampoo,
  favoriteGroomer: initialFavoriteGroomer,
  specialInstructions: initialSpecialInstructions,
  temperament: initialTemperament
}: EditPetDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initialName)
  const [breed, setBreed] = useState(initialBreed)
  const [weight, setWeight] = useState(initialWeight.replace(' lbs', ''))
  const [color, setColor] = useState(initialColor)
  const [sex, setSex] = useState(initialSex)
  const [haircut, setHaircut] = useState(initialHaircut || '')
  const [shampoo, setShampoo] = useState(initialShampoo || '')
  const [favoriteGroomer, setFavoriteGroomer] = useState(initialFavoriteGroomer || '')
  const [specialInstructions, setSpecialInstructions] = useState(initialSpecialInstructions || '')
  const [temperamentStr, setTemperamentStr] = useState(initialTemperament?.join(', ') || '')

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Please enter a pet name')
      return
    }
    if (!breed.trim()) {
      toast.error('Please enter a breed')
      return
    }
    if (!weight.trim()) {
      toast.error('Please enter a weight')
      return
    }

    console.log('Updating pet:', {
      petId,
      name,
      breed,
      weight,
      color,
      sex,
      haircut,
      shampoo,
      favoriteGroomer,
      specialInstructions,
      temperament: temperamentStr.split(',').map(t => t.trim()).filter(Boolean)
    })

    toast.success('Pet information updated!')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-secondary transition-all duration-200"
        >
          <PencilSimple size={14} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <PawPrint size={24} weight="fill" className="text-primary" />
            Edit Pet Information
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-6 px-6 scrollbar-thin">
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Pet Name *</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Buddy"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-breed">Breed *</Label>
                <Input
                  id="edit-breed"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  placeholder="Labrador Retriever"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-weight">Weight (lbs) *</Label>
                <Input
                  id="edit-weight"
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-color">Color</Label>
                <Input
                  id="edit-color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Yellow"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sex">Gender</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger id="edit-sex">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-temperament">Temperament (comma-separated)</Label>
              <Input
                id="edit-temperament"
                value={temperamentStr}
                onChange={(e) => setTemperamentStr(e.target.value)}
                placeholder="Friendly, Energetic, Loves treats"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-haircut">Preferred Haircut</Label>
                <Input
                  id="edit-haircut"
                  value={haircut}
                  onChange={(e) => setHaircut(e.target.value)}
                  placeholder="Short summer cut"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-shampoo">Shampoo Preference</Label>
                <Input
                  id="edit-shampoo"
                  value={shampoo}
                  onChange={(e) => setShampoo(e.target.value)}
                  placeholder="Hypoallergenic"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-groomer">Favorite Groomer</Label>
              <Input
                id="edit-groomer"
                value={favoriteGroomer}
                onChange={(e) => setFavoriteGroomer(e.target.value)}
                placeholder="Sarah J."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-instructions">Special Instructions</Label>
              <Textarea
                id="edit-instructions"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Any special handling instructions..."
                rows={4}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
            onClick={handleSave}
          >
            <PencilSimple size={16} className="mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
