import { getAllCustomers } from '@/lib/dal/customers'
import { requireDistributor } from '@/lib/dal/session'
import { Users, Building2, Activity, Key } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DistributorOverviewPage() {
  await requireDistributor()
  const customers = await getAllCustomers()

  const active = customers.filter(c => c.isActive).length
  const inactive = customers.length - active

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Distributor Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage all customer tenants</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Customers', value: customers.length, icon: Building2, color: 'blue' },
          { label: 'Active', value: active, icon: Activity, color: 'emerald' },
          { label: 'Inactive', value: inactive, icon: Users, color: 'red' },
          { label: 'License Keys', value: '—', icon: Key, color: 'amber' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border ${
                color === 'blue' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                color === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                color === 'red' ? 'bg-red-50 text-red-500 border-red-100' :
                'bg-amber-50 text-amber-600 border-amber-100'
              }`}>
                <Icon className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-black text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link
          href="/distributor/customers"
          className="rounded-xl border border-border bg-white p-4 hover:shadow-md transition-shadow flex items-center gap-3"
        >
          <Building2 className="size-5 text-primary" />
          <div>
            <p className="font-semibold text-sm">Manage Customers</p>
            <p className="text-xs text-muted-foreground">View and manage all tenants</p>
          </div>
        </Link>
        <Link
          href="/distributor/keys"
          className="rounded-xl border border-border bg-white p-4 hover:shadow-md transition-shadow flex items-center gap-3"
        >
          <Key className="size-5 text-amber-600" />
          <div>
            <p className="font-semibold text-sm">License Keys</p>
            <p className="text-xs text-muted-foreground">Generate and track license keys</p>
          </div>
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Recent Customers</h3>
        </div>
        <div className="divide-y divide-border">
          {customers.slice(0, 10).map(c => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{c.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                {c.planName && <p className="text-xs text-muted-foreground">{c.planName}</p>}
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                c.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {c.isActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
