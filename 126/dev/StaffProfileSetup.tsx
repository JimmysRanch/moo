import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, UserCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { setActiveStoreId } from '@/lib/activeStore'

interface StaffProfileForm {
  firstName: string
  lastName: string
  password: string
  confirmPassword: string
  phone: string
  staffEmail: string
  address: string
  city: string
  state: string
  zip: string
  emergencyContactFirstName: string
  emergencyContactLastName: string
  emergencyContactRelation: string
  emergencyContactPhone: string
}

export function StaffProfileSetup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteId = searchParams.get('invite') || searchParams.get('token') || ''
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState<StaffProfileForm>({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    phone: '',
    staffEmail: '',
    address: '',
    city: '',
    state: 'TX',
    zip: '',
    emergencyContactFirstName: '',
    emergencyContactLastName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
  })

  const validateForm = useMemo(() => {
    return [
      formData.firstName,
      formData.lastName,
      formData.phone,
      formData.address,
      formData.city,
      formData.state,
      formData.zip,
      formData.emergencyContactFirstName,
      formData.emergencyContactLastName,
      formData.emergencyContactRelation,
      formData.emergencyContactPhone,
    ].every((field) => field.trim().length > 0)
  }, [formData])

  const handleChange = (field: keyof StaffProfileForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = async () => {
    if (!inviteId) {
      toast.error('Missing invite id. Please restart onboarding from the invite email.')
      return
    }

    if (!validateForm) {
      toast.error('Please fill in all required fields')
      return
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsSaving(true)

    const { error: passwordError } = await supabase.auth.updateUser({ password: formData.password })
    if (passwordError) {
      toast.error(passwordError.message || 'Failed to set password. Please try again.')
      setIsSaving(false)
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    const accountEmail = sessionData.session?.user?.email

    if (!accessToken || !accountEmail) {
      toast.error('Your session expired. Please sign in again from the invite link.')
      setIsSaving(false)
      return
    }

    const response = await fetch('/api/staff/accept-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        inviteId,
        profile: {
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          phone: formData.phone.trim(),
          address: {
            street: formData.address.trim(),
            city: formData.city.trim(),
            state: formData.state.trim(),
            zip: formData.zip.trim(),
          },
          emergency_contact_name: `${formData.emergencyContactFirstName.trim()} ${formData.emergencyContactLastName.trim()}`.trim(),
          emergency_contact_relation: formData.emergencyContactRelation.trim(),
          emergency_contact_phone: formData.emergencyContactPhone.trim(),
          email: accountEmail,
        },
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      toast.error(payload?.message || 'Unable to complete onboarding. Please try again.')
      setIsSaving(false)
      return
    }

    if (payload?.storeId) {
      setActiveStoreId(payload.storeId)
    }

    toast.success(payload?.alreadyAccepted ? 'Invite was already accepted. Welcome back!' : 'Profile saved successfully!')
    window.location.replace('/dashboard')
  }

  return (
    <div className="min-h-full bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,oklch(0.35_0.15_195),transparent_50%)] opacity-30" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/settings')}
        className="fixed top-4 right-4 z-50 bg-card/80 backdrop-blur-sm border border-border text-xs"
      >
        <ArrowLeft size={14} className="mr-1" />
        Back to App
      </Button>

      <Card className="w-full max-w-2xl p-8 my-8 relative z-10 bg-card/90 backdrop-blur-sm border-primary/20 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <UserCircle size={32} className="text-primary" weight="duotone" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Complete Your Profile</h1>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><Label>First Name *</Label><Input value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} /></div>
            <div className="space-y-2"><Label>Last Name *</Label><Input value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} /></div>
            <div className="space-y-2"><Label>Password *</Label><Input type="password" autoComplete="new-password" value={formData.password} onChange={(e) => handleChange('password', e.target.value)} /></div>
            <div className="space-y-2"><Label>Confirm Password *</Label><Input type="password" autoComplete="new-password" value={formData.confirmPassword} onChange={(e) => handleChange('confirmPassword', e.target.value)} /></div>
            <div className="space-y-2"><Label>Phone *</Label><Input value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} /></div>
            <div className="space-y-2"><Label>Address *</Label><Input value={formData.address} onChange={(e) => handleChange('address', e.target.value)} /></div>
            <div className="space-y-2"><Label>City *</Label><Input value={formData.city} onChange={(e) => handleChange('city', e.target.value)} /></div>
            <div className="space-y-2"><Label>State *</Label>
              <Select value={formData.state} onValueChange={(v) => handleChange('state', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="TX">TX</SelectItem><SelectItem value="CA">CA</SelectItem><SelectItem value="FL">FL</SelectItem><SelectItem value="NY">NY</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>ZIP *</Label><Input value={formData.zip} onChange={(e) => handleChange('zip', e.target.value)} /></div>
            <div className="space-y-2"><Label>Emergency Contact First Name *</Label><Input value={formData.emergencyContactFirstName} onChange={(e) => handleChange('emergencyContactFirstName', e.target.value)} /></div>
            <div className="space-y-2"><Label>Emergency Contact Last Name *</Label><Input value={formData.emergencyContactLastName} onChange={(e) => handleChange('emergencyContactLastName', e.target.value)} /></div>
            <div className="space-y-2"><Label>Emergency Contact Relation *</Label><Input value={formData.emergencyContactRelation} onChange={(e) => handleChange('emergencyContactRelation', e.target.value)} /></div>
            <div className="space-y-2"><Label>Emergency Contact Phone *</Label><Input value={formData.emergencyContactPhone} onChange={(e) => handleChange('emergencyContactPhone', e.target.value)} /></div>
          </div>
          <Button className="w-full" onClick={handleSaveProfile} disabled={isSaving}>{isSaving ? 'Finishing...' : 'Finish Onboarding'}</Button>
        </div>
      </Card>
    </div>
  )
}
