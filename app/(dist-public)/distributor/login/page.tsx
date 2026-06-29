import { DistributorLoginForm } from '@/components/distributor/DistributorLoginForm'
import { Shield } from 'lucide-react'

export default function DistributorLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 mb-4">
            <Shield className="size-7 text-amber-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Distributor Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Restricted access</p>
        </div>

        <div className="rounded-2xl border border-border bg-white shadow-sm p-8">
          <DistributorLoginForm />
        </div>
      </div>
    </div>
  )
}
