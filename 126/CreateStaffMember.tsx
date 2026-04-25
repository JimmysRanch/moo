import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, PaperPlaneRight, UserPlus } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateStaffInvite } from '@/hooks/data/useStaffExtensions'
import { useCreateStaffCompensation, useCreateStaffSchedule } from '@/hooks/data/useStaffExtensions'
import { useInsertStaffNoLogin } from '@/hooks/data/useInsertStaffNoLogin'
import { toast } from 'sonner'

const STAFF_ROLES = [
  { value: 'groomer', label: 'Groomer' },
  { value: 'front_desk', label: 'Front Desk' },
  { value: 'bather', label: 'Bather' },
  { value: 'manager', label: 'Manager' },
] as const

type StaffRole = typeof STAFF_ROLES[number]['value']

export function CreateStaffMember() {
  const navigate = useNavigate()
  const [requiresLogin, setRequiresLogin] = useState<boolean | null>(null)
  const [role, setRole] = useState<StaffRole | ''>('')
  const [startDate, setStartDate] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [commissionPercentage, setCommissionPercentage] = useState('')

  // Login-required fields
  const [email, setEmail] = useState('')

  // No-login fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('TX')
  const [zip, setZip] = useState('')
  const [emergencyContactName, setEmergencyContactName] = useState('')
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('')
  const [notes, setNotes] = useState('')

  const [isLoading, setIsLoading] = useState(false)

  const createInvite = useCreateStaffInvite()
  const insertNoLoginStaff = useInsertStaffNoLogin()
  const createCompensation = useCreateStaffCompensation()
  const createSchedule = useCreateStaffSchedule()

  const handleSendInvite = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    if (!role) {
      toast.error('Please select a role')
      return
    }

    setIsLoading(true)

    const defaultSchedules = Array.from({ length: 5 }, (_, index) => ({
      day_of_week: index + 1,
      start_time: '09:00',
      end_time: '17:00',
      is_available: true,
    }))

    createInvite.mutate(
      {
        email,
        role: role as StaffRole,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        hire_date: startDate || null,
        compensation: {
          hourly_rate: hourlyRate ? parseFloat(hourlyRate) || 0 : 0,
          commission_percentage: commissionPercentage ? parseFloat(commissionPercentage) || 0 : 0,
        },
        schedules: defaultSchedules,
      },
      {
        onSuccess: () => {
          toast.success(`Invitation sent to ${email}`, {
            description: 'The staff member will receive an email with setup instructions.'
          })
          setTimeout(() => {
            navigate('/staff')
          }, 1500)
        },
        onError: () => {
          toast.error('Failed to send invitation')
          setIsLoading(false)
        }
      }
    )
  }

  const handleCreateStaff = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First name and last name are required')
      return
    }
    if (!role) {
      toast.error('Please select a role')
      return
    }

    setIsLoading(true)

    const fullName = `${firstName.trim()} ${lastName.trim()}`

    const dbPayload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role: STAFF_ROLES.find(r => r.value === role)?.label ?? role,
      status: 'active' as const,
      is_groomer: role === 'groomer',
      phone: phone.trim() || null,
      hire_date: startDate || null,
      notes: notes.trim() || null,
      hourly_rate: hourlyRate ? parseFloat(hourlyRate) || null : null,
      address: (streetAddress.trim() || city.trim() || state.trim() || zip.trim()) ? {
        street: streetAddress.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zip: zip.trim() || undefined,
      } : null,
      emergency_contact_name: emergencyContactName.trim() || null,
      emergency_contact_relation: emergencyContactRelation.trim() || null,
      emergency_contact_phone: emergencyContactPhone.trim() || null,
    }

    insertNoLoginStaff.mutate(dbPayload, {
      onSuccess: (data) => {
        const staffId = data?.id

        // Create compensation record
        if (hourlyRate || commissionPercentage) {
          createCompensation.mutate({
            staff_id: staffId,
            hourly_rate: parseFloat(hourlyRate) || 0,
            commission_percentage: parseFloat(commissionPercentage) || 0,
          })
        }

        // Create default schedule (Mon-Fri, 9-5)
        for (let day = 1; day <= 5; day++) {
          createSchedule.mutate({
            staff_id: staffId,
            day_of_week: day,
            start_time: '09:00',
            end_time: '17:00',
            is_available: true,
          })
        }

        toast.success(`${fullName} has been added to your team`, {
          description: 'Staff member created successfully.'
        })
        setTimeout(() => {
          navigate('/staff')
        }, 1500)
      },
      onError: () => {
        toast.error('Failed to create staff member')
        setIsLoading(false)
      }
    })
  }

  return (
    <div data-testid="page-create-staff" className="min-h-full bg-background text-foreground p-3 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4 sm:mb-6 hover:bg-secondary/50"
          onClick={() => navigate('/staff')}
        >
          <ArrowLeft size={18} className="mr-2" />
          Back to Staff
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Create New Staff Member</h1>
          <p className="text-muted-foreground">
            Add a new member to your team. Choose whether they need login credentials.
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          <div className="space-y-6">
            {/* Top question: requires login? */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Will this staff member require login credentials?
              </Label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={requiresLogin === true ? "default" : "outline"}
                  className={requiresLogin === true ? "bg-primary text-primary-foreground" : ""}
                  onClick={() => setRequiresLogin(true)}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={requiresLogin === false ? "default" : "outline"}
                  className={requiresLogin === false ? "bg-primary text-primary-foreground" : ""}
                  onClick={() => setRequiresLogin(false)}
                >
                  No
                </Button>
              </div>
            </div>

            {requiresLogin !== null && (
              <>
                {/* Role dropdown (shared) */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Shared fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                    <Input
                      id="hourlyRate"
                      type="number"
                      placeholder="0.00"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="commissionPercentage">Commission (%)</Label>
                    <Input
                      id="commissionPercentage"
                      type="number"
                      placeholder="0"
                      value={commissionPercentage}
                      onChange={(e) => setCommissionPercentage(e.target.value)}
                    />
                  </div>
                </div>

                {/* YES branch - login required */}
                {requiresLogin === true && (
                  <>
                    <div className="border-t border-border pt-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                        Login Credentials
                      </h3>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-base font-semibold">
                          Email Address
                        </Label>
                        <p className="text-sm text-muted-foreground mb-3">
                          An invitation email will be sent to this address
                        </p>
                        <Input
                          id="email"
                          type="email"
                          placeholder="staff@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isLoading}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendInvite()
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={handleSendInvite}
                        disabled={isLoading || !email || !role}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold flex-1 sm:flex-initial"
                      >
                        <PaperPlaneRight size={18} className="mr-2" />
                        {isLoading ? 'Sending...' : 'Send Invite'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => navigate('/staff')}
                        disabled={isLoading}
                        className="flex-1 sm:flex-initial"
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}

                {/* NO branch - no login */}
                {requiresLogin === false && (
                  <>
                    <div className="border-t border-border pt-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                        Staff Profile Information
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name *</Label>
                          <Input
                            id="firstName"
                            placeholder="John"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name *</Label>
                          <Input
                            id="lastName"
                            placeholder="Doe"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="streetAddress">Street Address</Label>
                          <Input
                            id="streetAddress"
                            placeholder="1234 Bark Lane"
                            value={streetAddress}
                            onChange={(e) => setStreetAddress(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            placeholder="Scruffyville"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            placeholder="TX"
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="zip">ZIP Code</Label>
                          <Input
                            id="zip"
                            placeholder="12345"
                            value={zip}
                            onChange={(e) => setZip(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                        Emergency Contact
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="emergencyName">Name</Label>
                          <Input
                            id="emergencyName"
                            placeholder="Jane Doe"
                            value={emergencyContactName}
                            onChange={(e) => setEmergencyContactName(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="emergencyRelation">Relation</Label>
                          <Input
                            id="emergencyRelation"
                            placeholder="Spouse, Parent, etc."
                            value={emergencyContactRelation}
                            onChange={(e) => setEmergencyContactRelation(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="emergencyPhone">Phone</Label>
                          <Input
                            id="emergencyPhone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={emergencyContactPhone}
                            onChange={(e) => setEmergencyContactPhone(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Input
                        id="notes"
                        placeholder="Certifications, specialties, scheduling preferences..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={handleCreateStaff}
                        disabled={isLoading || !firstName.trim() || !lastName.trim() || !role}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold flex-1 sm:flex-initial"
                      >
                        <UserPlus size={18} className="mr-2" />
                        {isLoading ? 'Creating...' : 'Create Staff Member'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => navigate('/staff')}
                        disabled={isLoading}
                        className="flex-1 sm:flex-initial"
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </Card>

        {requiresLogin === true && (
          <div className="mt-6 p-4 bg-secondary/30 rounded-lg border border-border">
            <h3 className="font-semibold mb-2">What happens next?</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>• The staff member will receive an email invitation</li>
              <li>• They'll click the link to create their account and password</li>
              <li>• They'll complete their profile with personal information</li>
              <li>• Once set up, they can access the system with the assigned role</li>
            </ul>
          </div>
        )}

        {requiresLogin === false && (
          <div className="mt-6 p-4 bg-secondary/30 rounded-lg border border-border">
            <h3 className="font-semibold mb-2">No-login staff member</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>• This staff member will be added without login credentials</li>
              <li>• They can be assigned to appointments and included in payroll</li>
              <li>• You can enable login later from their staff profile</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
