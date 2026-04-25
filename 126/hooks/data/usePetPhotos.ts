import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'

export interface PetPhoto {
  id: string
  store_id: string
  pet_id: string
  path: string
  content_type?: string
  size_bytes?: number
  url?: string
  caption?: string
  is_before?: boolean
  is_after?: boolean
  created_at: string
  created_by?: string
}

const PET_PHOTOS_QUERY_KEY = 'pet_photos'

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

// ─── Queries ──────────────────────────────────────────────────────
// All queries include explicit store_id filter (defense-in-depth) in
// addition to RLS policies on the pet_photos table.
// ──────────────────────────────────────────────────────────────────

/**
 * List photos for a specific pet within the active store.
 * Ordered newest-first. Includes signed URLs for private bucket access.
 */
export function usePetPhotos(petId: string | undefined) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [PET_PHOTOS_QUERY_KEY, storeId, petId],
    queryFn: async () => {
      if (!storeId || !petId) throw new Error('Missing required parameters')

      const { data, error } = await supabase
        .from('pet_photos')
        .select('*')
        .eq('store_id', storeId)
        .eq('pet_id', petId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Generate signed URLs for each photo
      const photosWithUrls = await Promise.all(
        (data as PetPhoto[]).map(async (photo) => {
          if (!photo.path) return photo
          const { data: signedData } = await supabase.storage
            .from('pet_photos')
            .createSignedUrl(photo.path, 3600) // 1 hour expiry
          return { ...photo, url: signedData?.signedUrl }
        })
      )

      return photosWithUrls as PetPhoto[]
    },
    enabled: !!storeId && !!user && !!petId,
  })
}

/**
 * Upload a pet photo to storage and insert a DB record.
 * If the DB insert fails after a successful upload, the uploaded object
 * is cleaned up to prevent orphans.
 */
export function useUploadPetPhoto() {
  const { storeId } = useStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ petId, file }: { petId: string; file: File }) => {
      if (!storeId || !user) throw new Error('Missing required context')

      // Validate mime type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(
          `Invalid file type "${file.type}". Allowed types: JPEG, PNG, WebP, HEIC.`
        )
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(
          `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`
        )
      }

      // Compute file extension from mime type
      const extMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/heic': 'heic',
      }
      const ext = extMap[file.type] || 'jpg'

      // Generate unique object key: {store_id}/{pet_id}/{uuid}.{ext}
      const fileId = crypto.randomUUID?.() ?? Date.now().toString()
      const objectPath = `${storeId}/${petId}/${fileId}.${ext}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('pet_photos')
        .upload(objectPath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Insert DB record
      const { data, error: insertError } = await supabase
        .from('pet_photos')
        .insert({
          store_id: storeId,
          pet_id: petId,
          path: objectPath,
          content_type: file.type,
          size_bytes: file.size,
        })
        .select()
        .single()

      // If DB insert fails, clean up the uploaded storage object
      if (insertError) {
        await supabase.storage.from('pet_photos').remove([objectPath])
        throw insertError
      }

      return data as PetPhoto
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [PET_PHOTOS_QUERY_KEY, storeId, variables.petId],
      })
    },
  })
}

/**
 * Delete a pet photo: removes the storage object AND the DB row.
 * If storage deletion fails, the DB row is NOT deleted (error surfaced).
 * If DB deletion fails after storage delete, the error is surfaced.
 */
export function useDeletePetPhoto() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (photo: PetPhoto) => {
      if (!storeId) throw new Error('No active store')

      // Delete storage object first
      if (photo.path) {
        const { error: storageError } = await supabase.storage
          .from('pet_photos')
          .remove([photo.path])

        if (storageError) {
          throw new Error(
            `Failed to delete photo file: ${storageError.message}`
          )
        }
      }

      // Delete DB row
      const { error: dbError } = await supabase
        .from('pet_photos')
        .delete()
        .eq('id', photo.id)
        .eq('store_id', storeId)

      if (dbError) {
        throw new Error(
          `Photo file deleted but database record removal failed: ${dbError.message}`
        )
      }

      return { petId: photo.pet_id }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: [PET_PHOTOS_QUERY_KEY, storeId, result.petId],
      })
    },
  })
}
