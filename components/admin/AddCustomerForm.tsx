'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { addEntryAction } from '@/lib/actions/queue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ArrowLeft, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { QueueEntryDTO } from '@/lib/db/types'

interface Props {
  branchId: string
  queueLabel: string
}

export function AddCustomerForm({ branchId, queueLabel }: Props) {
  const router = useRouter()
  const [state, action, pending] = useActionState(addEntryAction, {})
  const [lastEntry, setLastEntry] = useState<QueueEntryDTO | null>(null)
  const [step, setStep] = useState<'entry' | 'success'>('entry')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state.entry) {
      setLastEntry(state.entry)
      setStep('success')
      toast.success(`${queueLabel} #${state.entry.queueNumber} assigned to Bill ${state.entry.billNumber}`)
    }
    if (state.error) {
      toast.error(state.error)
    }
  }, [state, queueLabel])

  useEffect(() => {
    if (step === 'entry') inputRef.current?.focus()
  }, [step])

  return (
    <AnimatePresence mode="wait">
      {step === 'entry' ? (
        <motion.div
          key="entry"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.18 }}
        >
          <form action={action} className="space-y-4">
            <input type="hidden" name="branchId" value={branchId} />
            <input
              ref={inputRef}
              name="billNumber"
              type="text"
              inputMode="numeric"
              placeholder="Bill / order number…"
              autoComplete="off"
              required
              className="w-full rounded-xl border-2 border-input bg-background px-4 py-5 text-center text-3xl font-black tracking-widest placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors"
            />
            <Input name="customerName" placeholder="Customer name (optional)" className="text-center" />

            {state.error && (
              <p className="text-sm text-red-500 text-center">{state.error}</p>
            )}

            <Button
              type="submit"
              disabled={pending}
              className="w-full h-12 text-base bg-primary active:bg-primary/90"
            >
              {pending ? 'Assigning…' : 'Generate Queue Number'}
            </Button>

            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1.5 mx-auto text-sm text-muted-foreground active:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
          </form>
        </motion.div>
      ) : (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="space-y-6 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-accent-50 flex items-center justify-center mx-auto">
            <span className="text-accent-700 text-2xl font-bold">✓</span>
          </div>

          <div className="rounded-2xl border-2 border-border bg-muted/20 py-8 px-10 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
              {queueLabel}
            </p>
            <p className="text-7xl font-black text-slate-800 tabular-nums leading-none">
              #{lastEntry?.queueNumber}
            </p>
            <p className="text-sm font-mono text-muted-foreground mt-2">
              Bill {lastEntry?.billNumber}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={() => setStep('entry')}
            >
              <Plus className="size-4" />
              Add Another
            </Button>
            <Button
              className="flex-1 bg-primary active:bg-primary/90"
              onClick={() => router.push(`/branches/${branchId}`)}
            >
              View Queue
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
