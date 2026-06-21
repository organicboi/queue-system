export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {children}
    </div>
  )
}
