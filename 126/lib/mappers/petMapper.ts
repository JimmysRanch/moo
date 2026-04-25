import type { Pet as UIPet } from '@/lib/types'
import type { Pet as DbPet } from '@/hooks/data/useClients'

export function petFromDb(db: DbPet): UIPet {
  return {
    id: db.id,
    name: db.name,
    breed: db.breed ?? '',
    mixedBreed: db.mixed_breed ?? undefined,
    weight: db.weight ?? 0,
    weightCategory: (db.weight_category as UIPet['weightCategory']) ?? 'medium',
    ownerId: db.client_id,
    birthday: db.birthday ?? undefined,
    gender: db.gender ?? undefined,
    color: db.color ?? undefined,
    temperament: db.temperament ?? undefined,
    groomingNotes: db.grooming_notes ?? undefined,
    overallLength: db.overall_length ?? undefined,
    faceStyle: db.face_style ?? undefined,
    skipEarTrim: db.skip_ear_trim ?? undefined,
    skipTailTrim: db.skip_tail_trim ?? undefined,
    desiredStylePhoto: db.desired_style_photo ?? undefined,
    isActive: db.is_active ?? true,
  }
}

export function petToDb(
  ui: UIPet,
  clientId?: string
): Omit<DbPet, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {
  return {
    client_id: clientId ?? ui.ownerId,
    name: ui.name,
    breed: ui.breed || undefined,
    mixed_breed: ui.mixedBreed || undefined,
    weight: ui.weight || undefined,
    weight_category: ui.weightCategory || undefined,
    birthday: ui.birthday ?? undefined,
    gender: ui.gender ?? undefined,
    color: ui.color ?? undefined,
    temperament: ui.temperament ?? undefined,
    grooming_notes: ui.groomingNotes ?? undefined,
    overall_length: ui.overallLength ?? undefined,
    face_style: ui.faceStyle ?? undefined,
    skip_ear_trim: ui.skipEarTrim ?? undefined,
    skip_tail_trim: ui.skipTailTrim ?? undefined,
    desired_style_photo: ui.desiredStylePhoto ?? undefined,
  }
}

export function petsFromDb(dbPets: DbPet[]): UIPet[] {
  return dbPets.map(petFromDb)
}
