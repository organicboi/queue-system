// Device surfaces render edge to edge with no app chrome: a lobby kiosk, a
// ceiling-mounted TV and an operator terminal are each the whole screen.
export default function SchoolDeviceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
