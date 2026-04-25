import { Syringe, FirstAid, Warning, PencilSimple, PawPrint, Upload, FileText, Plus } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { motion } from "framer-motion"
import { useIsMobile } from "@/hooks/use-mobile"
import { useState, useRef } from "react"
import { toast } from "sonner"

interface MedicalRecord {
  type: string
  name: string
  date: string
  nextDue?: string
}

interface MedicalInfoCardProps {
  petName: string
  vaccinations: MedicalRecord[]
  allergies: string[]
  medications: MedicalRecord[]
  notes?: string
}

export function MedicalInfoCard({
  petName,
  vaccinations,
  allergies,
  medications,
  notes
}: MedicalInfoCardProps) {
  const isMobile = useIsMobile()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [recordFile, setRecordFile] = useState<File | null>(null)
  const [recordName, setRecordName] = useState('')
  const [recordType, setRecordType] = useState('vaccination')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editVaccinations, setEditVaccinations] = useState(vaccinations.map(v => ({ ...v })))
  const [editAllergies, setEditAllergies] = useState(allergies.join(', '))
  const [editMedications, setEditMedications] = useState(medications.map(m => ({ ...m })))
  const [editNotes, setEditNotes] = useState(notes || '')

  const handleSaveEdit = () => {
    console.log('Saving medical info:', {
      vaccinations: editVaccinations,
      allergies: editAllergies.split(',').map(a => a.trim()).filter(Boolean),
      medications: editMedications,
      notes: editNotes
    })
    toast.success('Medical information updated!')
    setEditDialogOpen(false)
  }

  const handleUploadRecord = () => {
    if (!recordFile) {
      toast.error('Please select a file to upload')
      return
    }
    if (!recordName.trim()) {
      toast.error('Please enter a record name')
      return
    }

    console.log('Uploading record:', {
      file: recordFile,
      name: recordName,
      type: recordType
    })

    toast.success('Medical record uploaded successfully!')
    setUploadDialogOpen(false)
    setRecordFile(null)
    setRecordName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const addVaccination = () => {
    setEditVaccinations([...editVaccinations, { type: 'vaccine', name: '', date: '', nextDue: '' }])
  }

  const removeVaccination = (index: number) => {
    setEditVaccinations(editVaccinations.filter((_, i) => i !== index))
  }

  const updateVaccination = (index: number, field: keyof MedicalRecord, value: string) => {
    const updated = [...editVaccinations]
    updated[index] = { ...updated[index], [field]: value }
    setEditVaccinations(updated)
  }

  const addMedication = () => {
    setEditMedications([...editMedications, { type: 'medication', name: '', date: '' }])
  }

  const removeMedication = (index: number) => {
    setEditMedications(editMedications.filter((_, i) => i !== index))
  }

  const updateMedication = (index: number, field: keyof MedicalRecord, value: string) => {
    const updated = [...editMedications]
    updated[index] = { ...updated[index], [field]: value }
    setEditMedications(updated)
  }
  
  return (
    <motion.div className="relative">
      <motion.div
        className="absolute inset-0 rounded-lg opacity-0 blur-xl pointer-events-none"
        animate={{
          opacity: [0.05, 0.09, 0.05],
          background: [
            "radial-gradient(circle at 60% 40%, oklch(0.75 0.15 195 / 0.26), transparent 65%)",
            "radial-gradient(circle at 40% 60%, oklch(0.75 0.15 195 / 0.31), transparent 65%)",
            "radial-gradient(circle at 50% 50%, oklch(0.75 0.15 195 / 0.28), transparent 65%)",
            "radial-gradient(circle at 60% 40%, oklch(0.75 0.15 195 / 0.26), transparent 65%)"
          ]
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />
      <Card className="p-3 border-border bg-card relative z-10">
        <div className="flex items-center justify-between mb-3">
        <h3 className={`${isMobile ? "text-base" : "text-lg"} font-bold flex items-center gap-1.5 sm:gap-2 min-w-0`}>
          <FirstAid size={isMobile ? 16 : 18} className="text-primary shrink-0" weight="fill" />
          <span className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <span className={isMobile ? "hidden" : "inline"}>Medical Info - </span>
            <PawPrint size={isMobile ? 14 : 16} weight="fill" className="text-primary shrink-0" />
            <span className="truncate">{petName}</span>
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <>
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs font-semibold transition-all duration-200 hover:scale-[1.02] shrink-0"
                  >
                    <Upload size={12} className="mr-1" />
                    Upload
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                      <FileText size={20} weight="fill" className="text-primary" />
                      Upload Medical Record
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="record-name">Record Name *</Label>
                      <Input
                        id="record-name"
                        value={recordName}
                        onChange={(e) => setRecordName(e.target.value)}
                        placeholder="e.g., Rabies Vaccination Certificate"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="record-type">Record Type</Label>
                      <select
                        id="record-type"
                        value={recordType}
                        onChange={(e) => setRecordType(e.target.value)}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      >
                        <option value="vaccination">Vaccination</option>
                        <option value="medical">Medical Report</option>
                        <option value="test">Test Results</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="record-file">File *</Label>
                      <Input
                        ref={fileInputRef}
                        id="record-file"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setRecordFile(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground">Accepted formats: Images (JPG, PNG) or PDF</p>
                    </div>
                  </div>

                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setUploadDialogOpen(false)}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
                      onClick={handleUploadRecord}
                    >
                      <Upload size={16} className="mr-2" />
                      Upload
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-secondary transition-all duration-200 shrink-0"
                  >
                    <PencilSimple size={14} />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      <FirstAid size={24} weight="fill" className="text-primary" />
                      Edit Medical Information
                    </DialogTitle>
                  </DialogHeader>

                  <div className="overflow-y-auto flex-1 -mx-6 px-6 scrollbar-thin">
                    <div className="space-y-4 py-2">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-semibold">Vaccinations</Label>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={addVaccination}
                            className="h-7 text-xs"
                          >
                            <Plus size={12} className="mr-1" />
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {editVaccinations.map((vax, index) => (
                            <div key={index} className="grid grid-cols-4 gap-2 p-2 bg-secondary/30 rounded-md">
                              <Input
                                placeholder="Vaccine name"
                                value={vax.name}
                                onChange={(e) => updateVaccination(index, 'name', e.target.value)}
                              />
                              <Input
                                placeholder="Date"
                                value={vax.date}
                                onChange={(e) => updateVaccination(index, 'date', e.target.value)}
                              />
                              <Input
                                placeholder="Next due"
                                value={vax.nextDue || ''}
                                onChange={(e) => updateVaccination(index, 'nextDue', e.target.value)}
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeVaccination(index)}
                                className="h-9"
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-allergies">Allergies (comma-separated)</Label>
                        <Input
                          id="edit-allergies"
                          value={editAllergies}
                          onChange={(e) => setEditAllergies(e.target.value)}
                          placeholder="Chicken, Corn, etc."
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-semibold">Medications</Label>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={addMedication}
                            className="h-7 text-xs"
                          >
                            <Plus size={12} className="mr-1" />
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {editMedications.map((med, index) => (
                            <div key={index} className="grid grid-cols-3 gap-2 p-2 bg-secondary/30 rounded-md">
                              <Input
                                placeholder="Medication name"
                                value={med.name}
                                onChange={(e) => updateMedication(index, 'name', e.target.value)}
                                className="col-span-2"
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeMedication(index)}
                                className="h-9"
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-notes">Special Notes</Label>
                        <Textarea
                          id="edit-notes"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Any special medical notes..."
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setEditDialogOpen(false)}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
                      onClick={handleSaveEdit}
                    >
                      <PencilSimple size={16} className="mr-2" />
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
            <Syringe size={12} className="text-primary" />
            Vaccinations
          </p>
          {vaccinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">None recorded</p>
          ) : (
            <div className="space-y-1.5">
              {vaccinations.map((vax, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-secondary/30 rounded-md p-2 border border-border"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{vax.name}</p>
                      <p className="text-xs text-muted-foreground">Last: {vax.date}</p>
                    </div>
                    {vax.nextDue && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-primary/20 text-primary shrink-0"
                      >
                        {isMobile ? vax.nextDue : `Due: ${vax.nextDue}`}
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
            <Warning size={12} className="text-destructive" />
            Allergies
          </p>
          {allergies.length === 0 ? (
            <p className="text-sm text-muted-foreground">None recorded</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {allergies.map((allergy) => (
                <Badge
                  key={allergy}
                  variant="destructive"
                  className="text-xs"
                >
                  {allergy}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {medications.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Current Medications
            </p>
            <div className="space-y-1.5">
              {medications.map((med, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-secondary/30 rounded-md p-2 border border-border"
                >
                  <p className="text-sm font-medium">{med.name}</p>
                  <p className="text-xs text-muted-foreground">Started: {med.date}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {notes && (
          <div className="bg-secondary/30 rounded-md p-2 border border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Special Notes
            </p>
            <p className="text-sm text-foreground">{notes}</p>
          </div>
        )}
      </div>
    </Card>
    </motion.div>
  )
}
