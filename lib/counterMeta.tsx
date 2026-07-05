import { ClipboardList, Receipt, ChefHat, Truck } from 'lucide-react'
import type { CounterType } from '@/lib/db/types'

export interface CounterTypeMeta {
  label: string
  icon: React.ReactNode
  color: string
  bg: string
  optional: boolean
}

// Pipeline order: a customer places an order, it optionally goes through
// kitchen prep, then billing, then optionally delivery. Order and Billing are
// the two stages every business needs; Kitchen and Delivery are opt-in.
export const COUNTER_TYPE_ORDER: CounterType[] = ['order', 'kitchen', 'billing', 'delivery']

// Design system v5, §2.5 — color signals status, not category. Counter type
// is differentiated by icon shape + label only; no per-type hue (that would
// blow the system's 3-saturated-hue budget: accent, amber, red).
export const COUNTER_META: Record<CounterType, CounterTypeMeta> = {
  order:    { label: 'Order',    icon: <ClipboardList className="size-4" />, color: 'text-slate-600', bg: 'bg-slate-100', optional: false },
  kitchen:  { label: 'Kitchen',  icon: <ChefHat className="size-4" />,       color: 'text-slate-600', bg: 'bg-slate-100', optional: true  },
  billing:  { label: 'Billing',  icon: <Receipt className="size-4" />,       color: 'text-slate-600', bg: 'bg-slate-100', optional: false },
  delivery: { label: 'Delivery', icon: <Truck className="size-4" />,         color: 'text-slate-600', bg: 'bg-slate-100', optional: true  },
}
