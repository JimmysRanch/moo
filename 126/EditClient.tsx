import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, User } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useClient, useUpdateClient } from '@/hooks/data/useClients'
import { clientFromDb } from '@/lib/mappers/clientMapper'

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 
  'Wisconsin', 'Wyoming'
]

const REFERRAL_SOURCES = [
  'Facebook',
  'Google',
  'Nextdoor',
  'Word-of-mouth',
  'Other'
]

export function EditClient() {
  const navigate = useNavigate()
  const { clientId } = useParams()
  const { data: dbClient } = useClient(clientId)
  const client = useMemo(() => dbClient ? clientFromDb(dbClient) : null, [dbClient])
  const updateClient = useUpdateClient()
  
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('Texas')
  const [zipCode, setZipCode] = useState('')
  const [referralSource, setReferralSource] = useState('')

  useEffect(() => {
    if (!client) return
    setFirstName(client.firstName ?? client.name.split(' ')[0] ?? '')
    setLastName(client.lastName ?? client.name.split(' ').slice(1).join(' ') ?? '')
    setEmail(client.email ?? "")
    setPhone(client.phone ?? "")
    setStreetAddress(client.address?.street ?? "")
    setCity(client.address?.city ?? "")
    setState(client.address?.state ?? "Texas")
    setZipCode(client.address?.zip ?? "")
    setReferralSource(client.referralSource ?? "")
  }, [client])

  const formatPhoneNumber = (value: string) => {
    const phoneNumber = value.replace(/\D/g, '')
    
    if (phoneNumber.length === 0) {
      return ''
    }
    
    if (phoneNumber.length <= 3) {
      return `(${phoneNumber}`
    }
    
    if (phoneNumber.length <= 6) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
    }
    
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhone(formatted)
  }

  const validateForm = () => {
    if (!firstName.trim()) {
      toast.error('Please enter a first name')
      return false
    }
    if (!lastName.trim()) {
      toast.error('Please enter a last name')
      return false
    }
    if (!email.trim()) {
      toast.error('Please enter an email address')
      return false
    }
    if (!phone.trim()) {
      toast.error('Please enter a phone number')
      return false
    }
    if (!referralSource.trim()) {
      toast.error('Please select how you heard about us')
      return false
    }

    return true
  }

  const handleSave = () => {
    if (!validateForm() || !clientId || !dbClient) {
      return
    }

    updateClient.mutate({
      id: clientId,
      updated_at: dbClient.updated_at,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: {
        street: streetAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zipCode.trim()
      },
      referral_source: referralSource.trim()
    }, {
      onSuccess: () => {
        toast.success('Client updated successfully!')
        navigate(`/clients/${clientId}`)
      },
      onError: (error) => {
        if (error.name === 'ConcurrencyError') {
          toast.error(error.message)
        } else {
          toast.error('Failed to update client. Please try again.')
        }
      }
    })
  }

  const handleCancel = () => {
    navigate(`/clients/${clientId}`)
  }

  return (
    <div data-testid="page-edit-client" className="min-h-full bg-background text-foreground p-3 sm:p-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-secondary transition-all duration-200"
            onClick={handleCancel}
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">Edit Client Information</h1>
        </div>

        <Card className="bg-card border-border mb-6">
          <CardHeader className="pt-4 pb-3">
            <CardTitle className="flex items-center gap-2">
              <User size={20} weight="fill" className="text-primary" />
              Client Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-3 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">First Name *</Label>
                <Input
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last Name *</Label>
                <Input
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="test@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="street-address">Street Address</Label>
                <Input
                  id="street-address"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Natalia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger id="state">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((stateName) => (
                      <SelectItem key={stateName} value={stateName}>
                        {stateName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip-code">ZIP Code</Label>
                <Input
                  id="zip-code"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="12345"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referral-source">How did you hear about us? *</Label>
              <Select value={referralSource} onValueChange={setReferralSource}>
                <SelectTrigger id="referral-source">
                  <SelectValue placeholder="Select a source" />
                </SelectTrigger>
                <SelectContent>
                  {REFERRAL_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={handleCancel}
            className="font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
