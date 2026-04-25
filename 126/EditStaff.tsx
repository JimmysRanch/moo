import { ArrowLeft } from "@phosphor-icons/react"
import { useEffect, useMemo, useState } from "react"
import { flushSync } from "react-dom"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StaffCompensation } from "@/components/StaffCompensation"
import { useStaff, useUpdateStaff } from "@/hooks/data/useStaff"
import { useStaffPositions } from "@/hooks/data/useBusinessSettings"
import { staffListFromDb, staffToDb } from "@/lib/mappers/staffMapper"
import { toast } from "sonner"
import { Staff } from "@/lib/types"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"

interface StaffAppointmentSummary {
  id: string
  client: string
  pet: string
  service: string
  date: string
  time: string
  duration?: string
  status?: string
  cost?: string
  tip?: string
  rating?: number
  notes?: string
}

interface StaffProfileDetail {
  name: string
  role: string
  email: string
  phone: string
  address: string
  emergencyContact: {
    name: string
    relation: string
    phone: string
  }
  hireDate: string
  status: "Active" | "On Leave" | "Inactive"
  hourlyRate: number
  specialties: string[]
  stats: {
    totalAppointments: number
    revenue: string
    avgTip: string
    noShows: number
    lateArrivals: number
  }
  upcomingAppointments: StaffAppointmentSummary[]
  recentAppointments: StaffAppointmentSummary[]
  notes?: string
}

interface StaffFormState {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  status: "Active" | "On Leave" | "Inactive"
  streetAddress: string
  city: string
  state: string
  zipCode: string
  notes: string
  emergencyFirstName: string
  emergencyLastName: string
  emergencyPhone: string
  emergencyRelation: string
}

const parseAddress = (address?: string) => {
  if (!address) {
    return { street: "", city: "", state: "TX", zip: "" }
  }
  const [street = "", city = "", stateZip = ""] = address.split(",").map((part) => part.trim())
  const [state = "TX", zip = ""] = stateZip.split(" ").filter(Boolean)
  return {
    street,
    city,
    state: state || "TX",
    zip
  }
}

export function EditStaff() {
  const navigate = useNavigate()
  const { staffId } = useParams()

  const { data: dbPositions } = useStaffPositions()
  const staffPositions = useMemo(
    () => dbPositions && dbPositions.length > 0
      ? dbPositions.map(p => p.position_name)
      : ["Owner", "Manager", "Groomer", "Front Desk", "Bather"],
    [dbPositions]
  )

  const { data: dbStaff } = useStaff()
  const staffMembers = useMemo(() => staffListFromDb(dbStaff ?? []), [dbStaff])
  const updateStaffMutation = useUpdateStaff()

  const staffProfiles: Record<string, StaffProfileDetail> = {}

  const staffFromList = (staffMembers || []).find((member) => member.id === staffId)
  const staffProfileEntry = staffId ? staffProfiles?.[staffId] : undefined
  const isOwnerRecord = staffFromList?.isOwner ?? false
  const parsedAddress = useMemo(() => {
    const sourceAddress = staffFromList?.address
      ? [staffFromList.address.street, staffFromList.address.city, `${staffFromList.address.state ?? ''} ${staffFromList.address.zip ?? ''}`.trim()]
          .filter(Boolean)
          .join(', ')
      : staffProfileEntry?.address
    return parseAddress(sourceAddress)
  }, [staffFromList?.address, staffProfileEntry?.address])
  const availablePositions = staffPositions && staffPositions.length > 0
    ? staffPositions
    : ["Owner", "Manager", "Groomer", "Front Desk", "Bather"]
  const defaultRole = staffFromList?.role ?? staffProfileEntry?.role ?? availablePositions[0]
  const defaultStatus = staffFromList?.status ?? staffProfileEntry?.status ?? "Active"
  const [savedFormData, setSavedFormData] = useState<StaffFormState | null>(null)
  const [canTakeAppointments, setCanTakeAppointments] = useState<boolean>(false)
  const [initialCanTakeAppointments, setInitialCanTakeAppointments] = useState<boolean>(false)
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string>("")
  const [loadedStaffId, setLoadedStaffId] = useState<string | null>(null)

  const [formData, setFormData] = useState<StaffFormState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: defaultRole,
    status: defaultStatus,
    streetAddress: "",
    city: "",
    state: "TX",
    zipCode: "",
    notes: "",
    emergencyFirstName: "",
    emergencyLastName: "",
    emergencyPhone: "",
    emergencyRelation: ""
  })

  useEffect(() => {
    if (!staffId || loadedStaffId === staffId) {
      return
    }

    const nameParts = (staffFromList?.name ?? staffProfileEntry?.name ?? "").split(" ").filter(Boolean)
    const [firstName = "", ...lastNameParts] = nameParts
    const lastName = lastNameParts.join(" ")
    const emergencyName = staffFromList?.emergencyContact?.name ?? staffProfileEntry?.emergencyContact?.name ?? ""
    const emergencyParts = emergencyName.split(" ").filter(Boolean)
    const [emergencyFirst = "", ...emergencyLastParts] = emergencyParts
    const emergencyLast = emergencyLastParts.join(" ")

    const nextFormData: StaffFormState = {
      firstName,
      lastName,
      email: staffFromList?.email ?? staffProfileEntry?.email ?? "",
      phone: staffFromList?.phone ?? staffProfileEntry?.phone ?? "",
      role: defaultRole,
      status: defaultStatus,
      streetAddress: parsedAddress.street,
      city: parsedAddress.city,
      state: parsedAddress.state,
      zipCode: parsedAddress.zip,
      notes: staffFromList?.notes ?? staffProfileEntry?.notes ?? "",
      emergencyFirstName: emergencyFirst,
      emergencyLastName: emergencyLast,
      emergencyPhone: staffFromList?.emergencyContact?.phone ?? staffProfileEntry?.emergencyContact?.phone ?? "",
      emergencyRelation: staffFromList?.emergencyContact?.relation ?? staffProfileEntry?.emergencyContact?.relation ?? ""
    }

    setFormData(nextFormData)
    setSavedFormData(nextFormData)
    const apptValue = staffFromList?.canTakeAppointments ?? false
    setCanTakeAppointments(apptValue)
    setInitialCanTakeAppointments(apptValue)
    setCurrentUpdatedAt((dbStaff ?? []).find((staff) => staff.id === staffId)?.updated_at ?? "")
    setLoadedStaffId(staffId)
  }, [dbStaff, defaultRole, defaultStatus, loadedStaffId, parsedAddress, staffFromList, staffId, staffProfileEntry])

  const handleChange = (field: keyof StaffFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const basicFormSnapshot = useMemo(() => JSON.stringify({
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    phone: formData.phone,
    streetAddress: formData.streetAddress,
    city: formData.city,
    state: formData.state,
    zipCode: formData.zipCode,
    notes: formData.notes,
    emergencyFirstName: formData.emergencyFirstName,
    emergencyLastName: formData.emergencyLastName,
    emergencyPhone: formData.emergencyPhone,
    emergencyRelation: formData.emergencyRelation,
  }), [formData])
  const initialBasicSnapshot = useMemo(() => JSON.stringify({
    firstName: savedFormData?.firstName ?? "",
    lastName: savedFormData?.lastName ?? "",
    email: savedFormData?.email ?? "",
    phone: savedFormData?.phone ?? "",
    streetAddress: savedFormData?.streetAddress ?? "",
    city: savedFormData?.city ?? "",
    state: savedFormData?.state ?? "TX",
    zipCode: savedFormData?.zipCode ?? "",
    notes: savedFormData?.notes ?? "",
    emergencyFirstName: savedFormData?.emergencyFirstName ?? "",
    emergencyLastName: savedFormData?.emergencyLastName ?? "",
    emergencyPhone: savedFormData?.emergencyPhone ?? "",
    emergencyRelation: savedFormData?.emergencyRelation ?? "",
  }), [savedFormData])
  const schedulingSnapshot = useMemo(() => JSON.stringify({
    role: formData.role,
    status: formData.status,
    canTakeAppointments,
  }), [canTakeAppointments, formData.role, formData.status])
  const initialSchedulingSnapshot = useMemo(() => JSON.stringify({
    role: savedFormData?.role ?? defaultRole,
    status: savedFormData?.status ?? defaultStatus,
    canTakeAppointments: initialCanTakeAppointments,
  }), [defaultRole, defaultStatus, initialCanTakeAppointments, savedFormData])
  const hasBasicUnsavedChanges = savedFormData !== null && basicFormSnapshot !== initialBasicSnapshot
  const hasSchedulingUnsavedChanges = savedFormData !== null && schedulingSnapshot !== initialSchedulingSnapshot
  const hasUnsavedChanges = hasBasicUnsavedChanges || hasSchedulingUnsavedChanges

  useUnsavedChangesGuard({
    hasUnsavedChanges: hasUnsavedChanges && !updateStaffMutation.isPending,
    message: "You have unsaved staff updates. Leaving now will discard those changes. Continue?"
  })

  const handleNavigateAway = (path: string) => {
    navigate(path)
  }

  const buildStaffPayload = (section: "basic" | "scheduling") => {
    if (!staffId) {
      toast.error("Staff member not found")
      return null
    }
    if (!savedFormData) {
      toast.error("Staff member not found")
      return null
    }

    const sourceFormData = section === "basic"
      ? {
          ...savedFormData,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          streetAddress: formData.streetAddress,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          notes: formData.notes,
          emergencyFirstName: formData.emergencyFirstName,
          emergencyLastName: formData.emergencyLastName,
          emergencyPhone: formData.emergencyPhone,
          emergencyRelation: formData.emergencyRelation,
        }
      : {
          ...savedFormData,
          role: formData.role,
          status: formData.status,
        }
    const sourceCanTakeAppointments = section === "scheduling" ? canTakeAppointments : initialCanTakeAppointments

    if (!sourceFormData.firstName.trim() || !sourceFormData.lastName.trim() || !sourceFormData.email.trim()) {
      toast.error("Please complete the required staff details")
      return null
    }

    const fullName = `${sourceFormData.firstName.trim()} ${sourceFormData.lastName.trim()}`.trim()
    const emergencyName = `${sourceFormData.emergencyFirstName.trim()} ${sourceFormData.emergencyLastName.trim()}`.trim()
    const updatedStaff: Staff = {
      id: staffId,
      name: fullName,
      role: sourceFormData.role,
      email: sourceFormData.email.trim(),
      phone: sourceFormData.phone.trim(),
      status: sourceFormData.status,
      isGroomer: staffFromList?.isGroomer ?? true,
      canTakeAppointments: sourceCanTakeAppointments,
      specialties: staffFromList?.specialties ?? staffProfileEntry?.specialties ?? [],
      hourlyRate: staffFromList?.hourlyRate ?? staffProfileEntry?.hourlyRate?.toString(),
      totalAppointments: staffFromList?.totalAppointments ?? staffProfileEntry?.stats?.totalAppointments ?? 0,
      address: {
        street: sourceFormData.streetAddress.trim() || undefined,
        city: sourceFormData.city.trim() || undefined,
        state: sourceFormData.state.trim() || undefined,
        zip: sourceFormData.zipCode.trim() || undefined,
      },
      emergencyContact: {
        name: emergencyName || undefined,
        relation: sourceFormData.emergencyRelation.trim() || undefined,
        phone: sourceFormData.emergencyPhone.trim() || undefined,
      },
      notes: sourceFormData.notes.trim() || undefined,
    }

    const dbPayload = staffToDb(updatedStaff)
    if (!currentUpdatedAt) {
      toast.error('Staff record not found. Please reload.')
      return null
    }

    return { dbPayload, fullName }
  }

  const handleSaveSection = (section: "basic" | "scheduling") => {
    const payload = buildStaffPayload(section)
    if (!payload || !staffId) {
      return
    }

    updateStaffMutation.mutate(
      { id: staffId, updated_at: currentUpdatedAt, ...payload.dbPayload },
      {
        onSuccess: (result) => {
          toast.success(section === "basic" ? "Basic information updated successfully" : "Scheduling updated successfully")
          flushSync(() => {
            setSavedFormData((prev) => {
              const base = prev ?? formData
              if (section === "basic") {
                return {
                  ...base,
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                  email: formData.email,
                  phone: formData.phone,
                  streetAddress: formData.streetAddress,
                  city: formData.city,
                  state: formData.state,
                  zipCode: formData.zipCode,
                  notes: formData.notes,
                  emergencyFirstName: formData.emergencyFirstName,
                  emergencyLastName: formData.emergencyLastName,
                  emergencyPhone: formData.emergencyPhone,
                  emergencyRelation: formData.emergencyRelation,
                }
              }

              return {
                ...base,
                role: formData.role,
                status: formData.status,
              }
            })
            if (section === "scheduling") {
              setInitialCanTakeAppointments(canTakeAppointments)
            }
            setCurrentUpdatedAt((result as { updated_at?: string }).updated_at ?? currentUpdatedAt)
          })
        },
        onError: (error) => {
          if (error.name === 'ConcurrencyError') {
            toast.error(error.message)
          } else {
            toast.error("Failed to update staff information")
          }
        }
      }
    )
  }

  const handleCancelBasicChanges = () => {
    if (!savedFormData) {
      return
    }

    setFormData((prev) => ({
      ...prev,
      firstName: savedFormData.firstName,
      lastName: savedFormData.lastName,
      email: savedFormData.email,
      phone: savedFormData.phone,
      streetAddress: savedFormData.streetAddress,
      city: savedFormData.city,
      state: savedFormData.state,
      zipCode: savedFormData.zipCode,
      notes: savedFormData.notes,
      emergencyFirstName: savedFormData.emergencyFirstName,
      emergencyLastName: savedFormData.emergencyLastName,
      emergencyPhone: savedFormData.emergencyPhone,
      emergencyRelation: savedFormData.emergencyRelation,
    }))
  }

  const handleCancelSchedulingChanges = () => {
    if (!savedFormData) {
      return
    }

    setFormData((prev) => ({
      ...prev,
      role: savedFormData.role,
      status: savedFormData.status,
    }))
    setCanTakeAppointments(initialCanTakeAppointments)
  }

  if (!staffId || (!staffFromList && !staffProfileEntry)) {
    return (
      <div className="min-h-full bg-background text-foreground p-3 sm:p-6">
        <div className="max-w-[1000px] mx-auto space-y-4 sm:space-y-6">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-secondary transition-all duration-200"
            onClick={() => handleNavigateAway("/staff")}
          >
            <ArrowLeft size={24} />
          </Button>
          <Card className="p-6 text-center text-muted-foreground">
            Staff member not found.
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background text-foreground p-3 sm:p-6">
      <div className="max-w-[1000px] mx-auto space-y-4 sm:space-y-6">
        <header className="flex items-center gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-secondary transition-all duration-200"
            onClick={() => handleNavigateAway(`/staff/${staffId}`)}
          >
            <ArrowLeft size={24} />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight leading-none">
              Edit Staff Member
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {formData.firstName} {formData.lastName}
            </p>
          </div>
        </header>

        <div className="space-y-6">
          <Card className="p-6 bg-card border-border space-y-6">
            <Card className="p-6 bg-card border-border">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
                <div className="space-y-2 lg:col-span-6">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(event) => handleChange("firstName", event.target.value)}
                  />
                </div>
                <div className="space-y-2 lg:col-span-6">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(event) => handleChange("lastName", event.target.value)}
                  />
                </div>
                <div className="space-y-2 lg:col-span-6">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => handleChange("email", event.target.value)}
                  />
                </div>
                <div className="space-y-2 lg:col-span-6">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(event) => handleChange("phone", event.target.value)}
                  />
                </div>
                <div className="space-y-2 lg:col-span-5">
                  <Label htmlFor="streetAddress">Street Address</Label>
                  <Input
                    id="streetAddress"
                    placeholder="1234 Bark Lane"
                    value={formData.streetAddress}
                    onChange={(event) => handleChange("streetAddress", event.target.value)}
                  />
                </div>
                <div className="space-y-2 lg:col-span-3">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Scruffyville"
                    value={formData.city}
                    onChange={(event) => handleChange("city", event.target.value)}
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => handleChange("state", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AL">Alabama</SelectItem>
                      <SelectItem value="AK">Alaska</SelectItem>
                      <SelectItem value="AZ">Arizona</SelectItem>
                      <SelectItem value="AR">Arkansas</SelectItem>
                      <SelectItem value="CA">California</SelectItem>
                      <SelectItem value="CO">Colorado</SelectItem>
                      <SelectItem value="CT">Connecticut</SelectItem>
                      <SelectItem value="DE">Delaware</SelectItem>
                      <SelectItem value="FL">Florida</SelectItem>
                      <SelectItem value="GA">Georgia</SelectItem>
                      <SelectItem value="HI">Hawaii</SelectItem>
                      <SelectItem value="ID">Idaho</SelectItem>
                      <SelectItem value="IL">Illinois</SelectItem>
                      <SelectItem value="IN">Indiana</SelectItem>
                      <SelectItem value="IA">Iowa</SelectItem>
                      <SelectItem value="KS">Kansas</SelectItem>
                      <SelectItem value="KY">Kentucky</SelectItem>
                      <SelectItem value="LA">Louisiana</SelectItem>
                      <SelectItem value="ME">Maine</SelectItem>
                      <SelectItem value="MD">Maryland</SelectItem>
                      <SelectItem value="MA">Massachusetts</SelectItem>
                      <SelectItem value="MI">Michigan</SelectItem>
                      <SelectItem value="MN">Minnesota</SelectItem>
                      <SelectItem value="MS">Mississippi</SelectItem>
                      <SelectItem value="MO">Missouri</SelectItem>
                      <SelectItem value="MT">Montana</SelectItem>
                      <SelectItem value="NE">Nebraska</SelectItem>
                      <SelectItem value="NV">Nevada</SelectItem>
                      <SelectItem value="NH">New Hampshire</SelectItem>
                      <SelectItem value="NJ">New Jersey</SelectItem>
                      <SelectItem value="NM">New Mexico</SelectItem>
                      <SelectItem value="NY">New York</SelectItem>
                      <SelectItem value="NC">North Carolina</SelectItem>
                      <SelectItem value="ND">North Dakota</SelectItem>
                      <SelectItem value="OH">Ohio</SelectItem>
                      <SelectItem value="OK">Oklahoma</SelectItem>
                      <SelectItem value="OR">Oregon</SelectItem>
                      <SelectItem value="PA">Pennsylvania</SelectItem>
                      <SelectItem value="RI">Rhode Island</SelectItem>
                      <SelectItem value="SC">South Carolina</SelectItem>
                      <SelectItem value="SD">South Dakota</SelectItem>
                      <SelectItem value="TN">Tennessee</SelectItem>
                      <SelectItem value="TX">Texas</SelectItem>
                      <SelectItem value="UT">Utah</SelectItem>
                      <SelectItem value="VT">Vermont</SelectItem>
                      <SelectItem value="VA">Virginia</SelectItem>
                      <SelectItem value="WA">Washington</SelectItem>
                      <SelectItem value="WV">West Virginia</SelectItem>
                      <SelectItem value="WI">Wisconsin</SelectItem>
                      <SelectItem value="WY">Wyoming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    placeholder="12345"
                    value={formData.zipCode}
                    onChange={(event) => handleChange("zipCode", event.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-12">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea 
                    id="notes" 
                    placeholder="Add context about certifications, specialties, or scheduling preferences."
                    rows={3}
                    value={formData.notes}
                    onChange={(event) => handleChange("notes", event.target.value)}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-card border-border">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyFirstName">First Name</Label>
                  <Input
                    id="emergencyFirstName"
                    placeholder="Jane"
                    value={formData.emergencyFirstName}
                    onChange={(event) => handleChange("emergencyFirstName", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyLastName">Last Name</Label>
                  <Input
                    id="emergencyLastName"
                    placeholder="Doe"
                    value={formData.emergencyLastName}
                    onChange={(event) => handleChange("emergencyLastName", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Phone Number</Label>
                  <Input
                    id="emergencyPhone"
                    placeholder="(555) 123-4567"
                    value={formData.emergencyPhone}
                    onChange={(event) => handleChange("emergencyPhone", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyRelation">Relation</Label>
                  <Input
                    id="emergencyRelation"
                    placeholder="Spouse, Parent, Sibling, etc."
                    value={formData.emergencyRelation}
                    onChange={(event) => handleChange("emergencyRelation", event.target.value)}
                  />
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleCancelBasicChanges}
                disabled={!hasBasicUnsavedChanges || updateStaffMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => handleSaveSection("basic")}
                disabled={!hasBasicUnsavedChanges || updateStaffMutation.isPending}
              >
                {updateStaffMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Scheduling
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  {isOwnerRecord ? (
                    <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                      Owner
                    </div>
                  ) : (
                    <Select
                      value={formData.role}
                      onValueChange={(value) => handleChange("role", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePositions.map((position) => (
                          <SelectItem key={position} value={position}>
                            {position}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleChange("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="canTakeAppointments"
                  checked={canTakeAppointments}
                  onCheckedChange={(checked) => setCanTakeAppointments(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="canTakeAppointments" className="text-sm font-medium cursor-pointer">
                    Can take appointments
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If enabled, this staff member can appear on the schedule and be assigned or booked for appointments.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleCancelSchedulingChanges}
                disabled={!hasSchedulingUnsavedChanges || updateStaffMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => handleSaveSection("scheduling")}
                disabled={!hasSchedulingUnsavedChanges || updateStaffMutation.isPending}
              >
                {updateStaffMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Compensation</h2>
              <p className="text-sm text-muted-foreground">
                Choose how this staff member should be paid, then review the summary before saving.
              </p>
            </div>
            <StaffCompensation
              staffId={staffId}
              staffName={`${formData.firstName} ${formData.lastName}`.trim() || "Staff member"}
              showHeader={false}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
