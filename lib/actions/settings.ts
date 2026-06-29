'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServiceClient } from '@/lib/db/server'
import { requireAdmin } from '@/lib/dal/session'

const CustomerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  businessName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(300).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
})

export async function updateCustomerAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const profile = await requireAdmin()

  const parsed = CustomerSchema.safeParse({
    name: formData.get('name') || undefined,
    businessName: formData.get('businessName') || undefined,
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || '',
    address: formData.get('address') || undefined,
    primaryColor: formData.get('primaryColor') || undefined,
    secondaryColor: formData.get('secondaryColor') || undefined,
    logoUrl: formData.get('logoUrl') || '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('customers')
    .update({
      name: parsed.data.name,
      business_name: parsed.data.businessName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      address: parsed.data.address,
      primary_color: parsed.data.primaryColor,
      secondary_color: parsed.data.secondaryColor,
      logo_url: parsed.data.logoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.customerId)

  if (error) return { error: 'Failed to update settings' }

  revalidatePath('/settings')
  return {}
}
