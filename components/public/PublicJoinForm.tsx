'use client'

import { useActionState, useEffect } from 'react'
import { publicJoinAction } from '@/lib/actions/queue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface Props {
  branchId: string
  branchName: string
  queueLabel: string
  allowSelfJoin: boolean
}

const INIT: { error?: string; entry?: import('@/lib/db/types').QueueEntryDTO } = {}

export function PublicJoinForm({ branchId, branchName, queueLabel, allowSelfJoin }: Props) {
  const [state, action, pending] = useActionState(publicJoinAction, INIT)

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  if (state.entry) {
    const entry = state.entry
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-4 text-center"
      >
        <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Your {queueLabel}
          </p>
          <p className="text-8xl font-black text-teal-600 tabular-nums leading-none">
            #{entry.queueNumber}
          </p>
          <p className="text-sm font-mono text-gray-500">Bill {entry.billNumber}</p>
          {entry.customerName && (
            <p className="text-sm text-gray-600">{entry.customerName}</p>
          )}
        </div>

        <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 space-y-1">
          <p className="text-sm text-gray-700">
            You are <span className="font-semibold text-gray-900">in the queue</span> at {branchName}.
          </p>
          <p className="text-xs text-gray-500">
            Watch the display screen for your number to be called.
          </p>
        </div>

        <p className="text-xs text-gray-400">
          Please keep this number. Do not leave the premises.
        </p>
      </motion.div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="form"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="text-center space-y-1 mb-2">
            <h2 className="text-base font-semibold text-gray-900">Join the Queue</h2>
            <p className="text-sm text-gray-500">Enter your bill or order number</p>
          </div>

          <form action={action} className="space-y-3">
            <input type="hidden" name="branchId" value={branchId} />
            <input
              name="billNumber"
              type="text"
              inputMode="numeric"
              placeholder="Bill / Order No."
              autoComplete="off"
              required
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-4 text-center text-2xl font-black tracking-widest text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-teal-500 transition-colors"
            />
            <Input
              name="customerName"
              placeholder="Your name (optional)"
              className="h-10 rounded-lg border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:border-teal-500 focus-visible:ring-0"
            />

            {state.error && (
              <p className="text-sm text-red-600 text-center">{state.error}</p>
            )}

            <Button
              type="submit"
              disabled={pending || !allowSelfJoin}
              className="w-full h-11 text-base bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg border-0 shadow-none"
            >
              {pending ? 'Joining…' : 'Get My Number'}
            </Button>
          </form>
        </div>

        {!allowSelfJoin && (
          <p className="text-center text-sm text-gray-500">
            Self-join is currently disabled. Please see the counter staff.
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
