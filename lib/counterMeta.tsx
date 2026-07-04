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

export const COUNTER_META: Record<CounterType, CounterTypeMeta> = {
  order:    { label: 'Order',    icon: <ClipboardList className="size-4" />, color: 'text-teal-600',    bg: 'bg-teal-50',    optional: false },
  kitchen:  { label: 'Kitchen',  icon: <ChefHat className="size-4" />,       color: 'text-orange-600',  bg: 'bg-orange-50',  optional: true  },
  billing:  { label: 'Billing',  icon: <Receipt className="size-4" />,       color: 'text-emerald-600', bg: 'bg-emerald-50', optional: false },
  delivery: { label: 'Delivery', icon: <Truck className="size-4" />,         color: 'text-blue-600',    bg: 'bg-blue-50',    optional: true  },
}
