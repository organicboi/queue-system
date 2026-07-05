import 'server-only'
import { createSupabaseServiceClient } from '@/lib/db/server'

// All ad media (common + branch-specific) lives in this one bucket, split
// into folders per customer/branch. The bucket must already exist in
// Supabase and be marked public (see supabase/migrations/20260705_common_bucket_public.sql).
const BUCKET = 'common-bucket'

export async function uploadAdFile(
  file: File,
  customerId: string,
  branchId: string | null
): Promise<{ url: string; sizeBytes: number }> {
  const supabase = createSupabaseServiceClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const scope = branchId ? `branch/${branchId}` : 'common'
  const path = `${customerId}/${scope}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error('Failed to upload file to storage')

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, sizeBytes: file.size }
}

// Best-effort cleanup — only removes the object if the URL actually points
// into our bucket (older/manually-pasted URLs from before this change won't).
export async function deleteAdFileByUrl(publicUrl: string): Promise<void> {
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return

  const path = publicUrl.slice(idx + marker.length)
  const supabase = createSupabaseServiceClient()
  await supabase.storage.from(BUCKET).remove([path])
}
