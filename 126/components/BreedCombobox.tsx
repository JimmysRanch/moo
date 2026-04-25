import { useRef, useState } from 'react'
import { Check, CaretUpDown } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DOG_BREEDS } from "@/lib/breeds"

interface BreedComboboxProps {
  value: string
  onChange: (value: string) => void
  onBlur?: (value: string) => void
  id?: string
  error?: boolean
  breeds?: readonly string[]
}

export function BreedCombobox({ value, onChange, onBlur, id, error, breeds = DOG_BREEDS }: BreedComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [hasInteracted, setHasInteracted] = useState(false)
  const pendingBlurValue = useRef<string | null>(null)
  const breedOptions = breeds.length > 0 ? breeds : DOG_BREEDS

  const filteredBreeds = breedOptions.filter(breed =>
    breed.toLowerCase().includes(searchValue.toLowerCase())
  )

  const isValidSelection = breedOptions.includes(value)

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setSearchValue("")
      setHasInteracted(true)
      const blurValue = pendingBlurValue.current ?? value
      pendingBlurValue.current = null
      onBlur?.(blurValue)
    }
  }

  const handleSelect = (currentValue: string) => {
    const selectedBreed = breedOptions.find(breed => breed === currentValue)
    if (selectedBreed) {
      pendingBlurValue.current = selectedBreed
      onChange(selectedBreed)
      setOpen(false)
      setSearchValue("")
      setHasInteracted(true)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            error && hasInteracted && !isValidSelection && "border-destructive focus-visible:ring-destructive"
          )}
        >
          {value || "Start typing to search"}
          <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search breed..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>No breed found.</CommandEmpty>
            <CommandGroup>
              {filteredBreeds.map((breed) => (
                <CommandItem
                  key={breed}
                  value={breed}
                  onSelect={() => handleSelect(breed)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === breed ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {breed}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
