import 'server-only'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/dal/session'
import { verticalHome } from '@/lib/verticals'
import type { ProfileDTO } from '@/lib/db/types'

/**
 * The mirror of requireSchoolContext() for the hotel product.
 *
 * /dashboard, /branch, /owner and /business all read queue_entries,
 * queue_state and counters — tables a school tenant has no rows in. Without
 * this guard a school account that types one of those URLs lands on an empty,
 * confusing surface instead of being sent to its own product.
 *
 * Both guards resolve their destination through verticalHome(), so they can
 * never disagree and bounce a user between them forever.
 *
 * Layout-level, hence redirect() rather than the throwing guards in
 * lib/dal/session.ts — a layout has no error boundary to catch them.
 */
export async function requireBusinessProfile(): Promise<ProfileDTO> {
  const profile = await requireProfile()
  if (profile.vertical === 'school' || profile.vertical === 'hospital') {
    redirect(verticalHome(profile.vertical, profile.role))
  }
  return profile
}
