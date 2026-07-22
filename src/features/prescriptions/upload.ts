import 'server-only'
import { randomUUID } from 'node:crypto'
import { supabaseService } from '@/lib/supabase/server'

/**
 * Prescription upload at checkout.
 *
 * Files land in the PRIVATE 'prescriptions' bucket (0015): health records,
 * served only through short-lived signed URLs. Path convention:
 * `<user_id>/...` for account holders (matches the RLS owner-folder
 * policies), `guest/...` for guest checkout (service-role only, reachable
 * exclusively through the order that references the prescription row).
 *
 * Upload failure NEVER blocks the order — the customer can send the file on
 * WhatsApp afterwards; the pharmacist gate (awaiting_rx) holds either way.
 */

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_BYTES = 10 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export interface UploadedPrescription {
  id: string
}

export async function uploadPrescription(input: {
  file: File
  userId: string | null
  patientName: string
}): Promise<UploadedPrescription | { error: string }> {
  const { file, userId, patientName } = input

  if (!ALLOWED_MIME.includes(file.type)) {
    return { error: 'Prescription must be a JPG, PNG, WebP, or PDF file.' }
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return { error: 'Prescription file must be between 1 byte and 10 MB.' }
  }

  const db = supabaseService()
  const path = `${userId ?? 'guest'}/${randomUUID()}.${EXTENSIONS[file.type]}`

  const { error: uploadError } = await db.storage
    .from('prescriptions')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) {
    console.error('[rx] upload failed', uploadError)
    return { error: 'Could not upload the prescription. You can send it on WhatsApp instead.' }
  }

  const { data, error } = await db
    .from('prescriptions')
    .insert({
      user_id: userId,
      file_path: path,
      file_mime: file.type,
      patient_name: patientName,
    })
    .select('id')
    .single()
  if (error) {
    console.error('[rx] row insert failed', error)
    return { error: 'Could not record the prescription. You can send it on WhatsApp instead.' }
  }

  return { id: (data as { id: string }).id }
}
