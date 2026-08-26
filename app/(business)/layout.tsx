import { requireBusinessProfile } from '@/lib/dal/business-context'

// /business/* is the hotel product's branch hub. It had no guard of its own —
// the pages call requireProfile() but never checked which product the tenant
// bought, so a school account could open it by typing the URL.
export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  await requireBusinessProfile()

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {children}
    </div>
  )
}
