import { useState, useRef } from "react"
import { Images, Plus, X, PawPrint, Upload, Trash, SpinnerGap } from "@phosphor-icons/react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { usePetPhotos, useUploadPetPhoto, useDeletePetPhoto } from "@/hooks/data/usePetPhotos"
import type { PetPhoto } from "@/hooks/data/usePetPhotos"

interface PhotoGalleryCardProps {
  petName: string
  petId: string
}

export function PhotoGalleryCard({ petName, petId }: PhotoGalleryCardProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [deleteConfirmPhoto, setDeleteConfirmPhoto] = useState<PetPhoto | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  const { data: photos, isLoading } = usePetPhotos(petId)
  const uploadMutation = useUploadPetPhoto()
  const deleteMutation = useDeletePetPhoto()

  const currentPhotos = photos || []

  const handleFileChange = (file: File | null) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setFilePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a photo')
      return
    }

    try {
      await uploadMutation.mutateAsync({ petId, file: selectedFile })
      toast.success('Photo uploaded successfully!')
      resetUploadForm()
      setUploadDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const resetUploadForm = () => {
    setSelectedFile(null)
    setFilePreview("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleDeletePhoto = async (photo: PetPhoto) => {
    try {
      await deleteMutation.mutateAsync(photo)
      setDeleteConfirmPhoto(null)
      toast.success('Photo deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <>
      <motion.div className="relative">
        <motion.div
          className="absolute inset-0 rounded-lg opacity-0 blur-xl pointer-events-none"
          animate={{
            opacity: [0.07, 0.11, 0.07],
            background: [
              "radial-gradient(circle at 30% 30%, oklch(0.75 0.15 195 / 0.28), transparent 65%)",
              "radial-gradient(circle at 70% 70%, oklch(0.75 0.15 195 / 0.33), transparent 65%)",
              "radial-gradient(circle at 50% 50%, oklch(0.75 0.15 195 / 0.3), transparent 65%)",
              "radial-gradient(circle at 30% 30%, oklch(0.75 0.15 195 / 0.28), transparent 65%)"
            ]
          }}
          transition={{
            duration: 8.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5
          }}
        />
        <Card className="p-3 border-border bg-card relative z-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Images size={18} className="text-primary" weight="fill" />
              Photo Gallery - 
              <span className="flex items-center gap-1.5">
                <PawPrint size={16} weight="fill" className="text-primary" />
                {petName}
              </span>
            </h3>
            <Button
              size="sm"
              variant="secondary"
              className="font-semibold text-xs transition-all duration-200 hover:scale-[1.02]"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Plus size={14} className="mr-1" />
              Add Photos
            </Button>
          </div>

          {isLoading ? (
            <div className="bg-secondary/30 rounded-md p-8 border border-dashed border-border text-center">
              <SpinnerGap size={32} className="text-muted-foreground mx-auto mb-2 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading photos…</p>
            </div>
          ) : currentPhotos.length === 0 ? (
            <div className="bg-secondary/30 rounded-md p-8 border border-dashed border-border text-center">
              <Images size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No grooming photos yet</p>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Plus size={14} className="mr-1" />
                Upload First Photos
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {currentPhotos.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="group cursor-pointer"
                >
                  <div className="relative aspect-square rounded-md overflow-hidden border border-border bg-secondary/30 hover:border-primary/50 transition-all duration-200">
                    {photo.url ? (
                      <img
                        src={photo.url}
                        alt={photo.caption || 'Pet photo'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Images size={24} className="text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirmPhoto(photo)
                      }}
                    >
                      <Trash size={12} weight="bold" />
                    </Button>
                  </div>
                  <div className="space-y-0.5 mt-2">
                    {photo.caption && <p className="text-xs font-semibold">{photo.caption}</p>}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(photo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Upload dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open)
        if (!open) resetUploadForm()
      }}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className={`${isMobile ? "text-base" : "text-lg"} font-bold flex items-center gap-2`}>
              <Upload size={20} className="text-primary" weight="fill" />
              Upload Photo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div 
                className="relative aspect-square rounded-md border-2 border-dashed border-border hover:border-primary/50 transition-all duration-200 overflow-hidden bg-secondary/30 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                {filePreview ? (
                  <>
                    <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        onClick={(e) => {
                          e.stopPropagation()
                          resetUploadForm()
                        }}
                      >
                        <X size={14} className="mr-1" />
                        Remove
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <Upload size={isMobile ? 24 : 32} weight="fill" className="mb-2" />
                    <p className="text-xs font-medium">Click to upload</p>
                    <p className="text-[10px] text-muted-foreground mt-1">JPEG, PNG, WebP, HEIC — max 10MB</p>
                  </div>
                )}
              </div>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
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
              onClick={handleUpload}
              disabled={uploadMutation.isPending || !selectedFile}
            >
              {uploadMutation.isPending ? (
                <SpinnerGap size={16} className="mr-2 animate-spin" />
              ) : (
                <Upload size={16} className="mr-2" />
              )}
              {uploadMutation.isPending ? 'Uploading…' : 'Upload Photo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmPhoto !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmPhoto(null) }}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Delete Photo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this photo? This action cannot be undone.
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="secondary"
              onClick={() => setDeleteConfirmPhoto(null)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmPhoto && handleDeletePhoto(deleteConfirmPhoto)}
              disabled={deleteMutation.isPending}
              className="w-full sm:w-auto"
            >
              {deleteMutation.isPending ? (
                <SpinnerGap size={14} className="mr-1 animate-spin" />
              ) : (
                <Trash size={14} className="mr-1" />
              )}
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
