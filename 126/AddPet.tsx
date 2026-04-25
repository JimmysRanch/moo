import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PawPrint, Scissors } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { BreedCombobox } from "@/components/BreedCombobox"
import { DOG_BREEDS } from "@/lib/breeds"
import { useCreatePet } from '@/hooks/data/useClients'
import { useDogBreeds, useTemperamentOptions, useWeightRanges } from '@/hooks/data/useBusinessSettings'
import { getWeightCategory, mapWeightRanges } from "@/lib/types"

const DOG_COLORS = [
  'Black',
  'White',
  'Brown',
  'Golden',
  'Cream',
  'Red',
  'Blue',
  'Gray',
  'Silver',
  'Tan',
  'Yellow',
  'Apricot',
  'Chocolate',
  'Brindle',
  'Sable',
  'Merle',
  'Parti-color',
  'Tricolor',
  'Other'
]

export function AddPet() {
  const navigate = useNavigate()
  const { clientId } = useParams()
  const createPet = useCreatePet()
  const { data: weightRangesDb } = useWeightRanges()
  
  const { data: dogBreedsDb } = useDogBreeds()
  const { data: temperamentOptionsDb } = useTemperamentOptions()

  const breedOptions = useMemo(() =>
    dogBreedsDb && dogBreedsDb.length > 0
      ? dogBreedsDb.map((breedOption) => breedOption.breed_name)
      : DOG_BREEDS,
    [dogBreedsDb]
  )
  
  const temperamentOptions = useMemo(() =>
    temperamentOptionsDb?.map(t => t.option_name) ?? [
      "Friendly",
      "Energetic",
      "Calm",
      "Nervous",
      "Aggressive",
      "Playful",
      "Shy",
      "Loves treats"
    ],
    [temperamentOptionsDb]
  )
  
  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [weight, setWeight] = useState('')
  const [gender, setGender] = useState('')
  const [breed, setBreed] = useState('')
  const [mixedBreed, setMixedBreed] = useState('')
  const [color, setColor] = useState('')
  const [temperament, setTemperament] = useState<string[]>([])
  const [breedError, setBreedError] = useState(false)
  const [mixedBreedError, setMixedBreedError] = useState(false)
  const [overallLength, setOverallLength] = useState('')
  const [faceStyle, setFaceStyle] = useState('')
  const [skipEarTrim, setSkipEarTrim] = useState(false)
  const [skipTailTrim, setSkipTailTrim] = useState(false)
  const [desiredStylePhoto, setDesiredStylePhoto] = useState('')
  const [groomingNotes, setGroomingNotes] = useState('')

  const validateForm = () => {
    if (!name.trim()) {
      toast.error('Please enter a pet name')
      return false
    }
    if (!weight.trim()) {
      toast.error('Please enter a weight')
      return false
    }
    if (!gender.trim()) {
      toast.error('Please select a gender')
      return false
    }
    if (!breed.trim() || !breedOptions.includes(breed)) {
      setBreedError(true)
      toast.error('Please select a breed from the list')
      return false
    }
    if (mixedBreed.trim() && !breedOptions.includes(mixedBreed)) {
      setMixedBreedError(true)
      toast.error('Please select a mixed breed from the list')
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (!validateForm() || !clientId) {
      return
    }

    try {
      const parsedWeight = Number.parseFloat(weight)
      const weightRanges = mapWeightRanges(weightRangesDb)
      await createPet.mutateAsync({
        client_id: clientId,
        name: name.trim(),
        breed: breed.trim(),
        mixed_breed: mixedBreed.trim() || undefined,
        weight: parsedWeight,
        weight_category: getWeightCategory(parsedWeight, weightRanges),
        birthday: birthday.trim() || undefined,
        gender: gender.trim() || undefined,
        color: color.trim() || undefined,
        temperament: temperament.length > 0 ? temperament : undefined,
        grooming_notes: groomingNotes.trim() || undefined,
      })

      toast.success('Pet added successfully!')
      navigate(`/clients/${clientId}`)
    } catch {
      toast.error('Failed to add pet. Please try again.')
    }
  }

  const handleCancel = () => {
    navigate(`/clients/${clientId}`)
  }

  return (
    <div data-testid="page-add-pet" className="min-h-full bg-background text-foreground p-3 sm:p-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-start gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-secondary transition-all duration-200 mt-1"
            onClick={handleCancel}
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <PawPrint size={24} weight="fill" className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Add New Pet</h1>
              <p className="text-sm text-muted-foreground">Create a profile for this pet</p>
            </div>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pt-4 pb-3">
            <CardTitle className="flex items-center gap-2">
              <PawPrint size={20} weight="fill" className="text-primary" />
              Pet Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-3 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Pet Name *</Label>
                <Input
                  id="name"
                  data-testid="pet-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Buddy"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (lbs) *</Label>
                <Input
                  id="weight"
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="breed">Breed *</Label>
                <BreedCombobox
                  id="breed"
                  breeds={breedOptions}
                  value={breed}
                  onChange={(value) => {
                    setBreed(value)
                    setBreedError(false)
                  }}
                  onBlur={(value) => {
                    if (!breedOptions.includes(value)) {
                      setBreedError(true)
                    }
                  }}
                  error={breedError}
                />
                <p className="text-xs text-muted-foreground">Select a breed from the list</p>
                {breedError && (
                  <p className="text-xs text-destructive">Please select a breed from the list.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mixed-breed">Mixed Breed (if applicable)</Label>
                <BreedCombobox
                  id="mixed-breed"
                  breeds={breedOptions}
                  value={mixedBreed}
                  onChange={(value) => {
                    setMixedBreed(value)
                    setMixedBreedError(false)
                  }}
                  onBlur={(value) => {
                    if (value && !breedOptions.includes(value)) {
                      setMixedBreedError(true)
                    }
                  }}
                  error={mixedBreedError}
                />
                <p className="text-xs text-muted-foreground">Select a second breed if mixed</p>
                {mixedBreedError && (
                  <p className="text-xs text-destructive">Please select a breed from the list.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger id="color">
                    <SelectValue placeholder="Select color" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOG_COLORS.map((dogColor) => (
                      <SelectItem key={dogColor} value={dogColor}>
                        {dogColor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthday">Birthday</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium mb-2 block">Temperament</Label>
              <div className="flex flex-wrap gap-2">
                {temperamentOptions.map((option) => {
                  const isSelected = temperament.includes(option)
                  return (
                    <Badge
                      key={option}
                      variant={isSelected ? "default" : "outline"}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                          : "hover:bg-secondary"
                      }`}
                      onClick={() => {
                        const newTemperament = isSelected
                          ? temperament.filter(t => t !== option)
                          : [...temperament, option]
                        setTemperament(newTemperament)
                      }}
                    >
                      {option}
                    </Badge>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border mb-6">
          <CardHeader className="pt-4 pb-3">
            <CardTitle className="flex items-center gap-2">
              <Scissors size={20} weight="fill" className="text-primary" />
              Grooming Preferences {name ? `• ${name}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-3 pb-6">
            <div>
              <Label className="text-sm font-medium mb-2 block">Overall length</Label>
              <RadioGroup value={overallLength} onValueChange={setOverallLength}>
                <div className="grid grid-cols-4 gap-px">
                  <div className="flex items-center space-x-px whitespace-nowrap">
                    <RadioGroupItem value="Short & neat" id="length-short" />
                    <Label htmlFor="length-short" className="text-sm font-normal cursor-pointer whitespace-nowrap">
                      Short & neat
                    </Label>
                  </div>
                  <div className="flex items-center space-x-px whitespace-nowrap">
                    <RadioGroupItem value="Medium & neat" id="length-medium" />
                    <Label htmlFor="length-medium" className="text-sm font-normal cursor-pointer whitespace-nowrap">
                      Medium & neat
                    </Label>
                  </div>
                  <div className="flex items-center space-x-px whitespace-nowrap">
                    <RadioGroupItem value="Long & fluffy" id="length-long" />
                    <Label htmlFor="length-long" className="text-sm font-normal cursor-pointer whitespace-nowrap">
                      Long & fluffy
                    </Label>
                  </div>
                  <div className="flex items-center space-x-px whitespace-nowrap">
                    <RadioGroupItem value="Breed standard" id="length-breed" />
                    <Label htmlFor="length-breed" className="text-sm font-normal cursor-pointer whitespace-nowrap">
                      Breed standard
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium mb-2 block">Face style</Label>
              <RadioGroup value={faceStyle} onValueChange={setFaceStyle}>
                <div className="grid grid-cols-4 gap-px">
                  <div className="flex items-center space-x-px whitespace-nowrap">
                    <RadioGroupItem value="Short & neat" id="face-short" />
                    <Label htmlFor="face-short" className="text-sm font-normal cursor-pointer whitespace-nowrap">
                      Short & neat
                    </Label>
                  </div>
                  <div className="flex items-center space-x-px whitespace-nowrap">
                    <RadioGroupItem value="Round / Teddy" id="face-round" />
                    <Label htmlFor="face-round" className="text-sm font-normal cursor-pointer whitespace-nowrap">
                      Round / Teddy
                    </Label>
                  </div>
                  <div className="flex items-center space-x-px whitespace-nowrap">
                    <RadioGroupItem value="Beard / Mustache" id="face-beard" />
                    <Label htmlFor="face-beard" className="text-sm font-normal cursor-pointer whitespace-nowrap">
                      Beard / Mustache
                    </Label>
                  </div>
                  <div className="flex items-center space-x-px whitespace-nowrap">
                    <RadioGroupItem value="Breed Standard" id="face-breed" />
                    <Label htmlFor="face-breed" className="text-sm font-normal cursor-pointer whitespace-nowrap">
                      Breed Standard
                    </Label>
                  </div>
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
                  />
                  <Label htmlFor="skip-tail-trim" className="text-sm font-normal cursor-pointer">
                    Skip Tail Trim
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desired-style" className="text-sm font-medium">What I want</Label>
              <Input
                id="desired-style"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) {
                    setDesiredStylePhoto('')
                    return
                  }
                  const reader = new FileReader()
                  reader.onload = () => {
                    setDesiredStylePhoto(typeof reader.result === 'string' ? reader.result : '')
                  }
                  reader.readAsDataURL(file)
                }}
              />
              <p className="text-xs text-muted-foreground">Upload a reference photo for the desired look.</p>
              {desiredStylePhoto && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">Preview uploaded photo</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setDesiredStylePhoto('')}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="mt-2 overflow-hidden rounded-md border border-border bg-background">
                    <img
                      src={desiredStylePhoto}
                      alt={`${name || 'Pet'} grooming reference`}
                      className="max-h-40 w-auto object-contain mx-auto"
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Image uploaded successfully.</p>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <Label htmlFor="grooming-notes" className="text-sm font-medium mb-2 block">Additional Details</Label>
              <Textarea
                id="grooming-notes"
                value={groomingNotes}
                onChange={(e) => setGroomingNotes(e.target.value)}
                placeholder="Any special grooming instructions..."
                rows={2}
                className="text-sm"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 mt-6 pt-6 border-t border-border">
          <Button
            variant="secondary"
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            data-testid="pet-save"
            onClick={handleSave}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
          >
            Save Pet
          </Button>
        </div>
      </div>
    </div>
  )
}
