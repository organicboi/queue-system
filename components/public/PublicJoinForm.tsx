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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-6 text-center"
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Your {queueLabel}
          </p>
          <p className="text-8xl font-black text-white tabular-nums leading-none">
            #{entry.queueNumber}
          </p>
          <p className="text-sm font-mono text-slate-400">Bill {entry.billNumber}</p>
          {entry.customerName && (
            <p className="text-sm text-slate-300">{entry.customerName}</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1">
          <p className="text-sm text-slate-300">
            You are <span className="font-bold text-white">in the queue</span> at {branchName}.
          </p>
          <p className="text-xs text-slate-500">
            Watch the display screen for your number to be called.
          </p>
        </div>

        <p className="text-xs text-slate-600">
          Please keep this number. Do not leave the premises.
        </p>
      </motion.div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="form"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-4">
          <div className="text-center space-y-1 mb-2">
            <h2 className="text-lg font-bold text-white">Join the Queue</h2>
            <p className="text-sm text-slate-400">Enter your bill or order number</p>
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
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-4 text-center text-2xl font-black tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors"
            />
            <Input
              name="customerName"
              placeholder="Your name (optional)"
              className="bg-white/10 border-white/10 text-white placeholder:text-slate-600 focus:border-primary"
            />

            {state.error && (
              <p className="text-sm text-red-400 text-center">{state.error}</p>
            )}

            <Button
              type="submit"
              disabled={pending || !allowSelfJoin}
              className="w-full h-12 text-base bg-primary hover:bg-primary/90 font-bold"
            >
              {pending ? 'Joining…' : 'Get My Number'}
            </Button>
          </form>
        </div>

        {!allowSelfJoin && (
          <p className="text-center text-sm text-slate-500">
            Self-join is currently disabled. Please see the counter staff.
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
