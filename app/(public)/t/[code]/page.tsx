import { getPublicTicketStatus } from '@/lib/dal/school'
import { getHospitalPublicTicketStatus } from '@/lib/dal/hospital'
import { TrackerClient } from './TrackerClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ code: string }>
}

// Public, unauthenticated: what the QR on a printed school ticket points at.
// `code` is the opaque school_tokens.public_code, never the row id.
//
// Rendered server-side from the DAL directly (not a self-fetch of
// /api/public/ticket/[code]) so first paint has real data with no client
// waterfall — this page is opened on lobby mobile data by someone who is
// already impatient. TrackerClient takes it from there with adaptive
// polling.
//
// Every outcome — unknown code, tracking turned off, a previous day's
// leftover ticket — is a normal render of the same component, never a 404:
// a wrong QR scan should explain itself, not throw a framework error page.
export default async function PublicTicketPage({ params }: Props) {
  const { code } = await params
  let initial = await getPublicTicketStatus(code)
  if (initial.status === 'not-found') {
    const hospital = await getHospitalPublicTicketStatus(code)
    if (hospital) initial = hospital
  }

  return <TrackerClient code={code} initial={initial} />
}
