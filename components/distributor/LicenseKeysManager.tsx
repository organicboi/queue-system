'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { generateLicenseKeyAction } from '@/lib/actions/distributor'
import { Plus, Copy, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface LicenseKey {
  id: string
  key: string
  plan_id: string
  used_at: string | null
  notes: string | null
  created_at: string
}
interface Plan { id: string; name: string }

interface Props {
  keys: LicenseKey[]
  plans: Plan[]
}

export function LicenseKeysManager({ keys, plans }: Props) {
  const [selectedPlan, setSelectedPlan] = useState(plans[0]?.id ?? '')
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleGenerate() {
    if (!selectedPlan) return
    startTransition(async () => {
      const result = await generateLicenseKeyAction(selectedPlan)
      if (result.error) toast.error(result.error)
      else {
        setGeneratedKey(result.key ?? null)
        toast.success('License key generated!')
      }
    })
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => toast.success('Copied!'))
  }

  return (
    <div className="space-y-6">
      {/* Generator */}
      <div className="rounded-xl border border-border bg-white p-5 space-y-4">
        <h3 className="text-sm font-semibold">Generate New Key</h3>
        <div className="flex items-center gap-3">
          <Select value={selectedPlan} onValueChange={setSelectedPlan}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleGenerate} disabled={!selectedPlan} className="gap-1.5">
            <Plus className="size-3.5" />
            Generate
          </Button>
        </div>
        {generatedKey && (
          <div className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
            <span className="font-mono font-bold text-emerald-800 flex-1 tracking-widest">{generatedKey}</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyKey(generatedKey)}>
              <Copy className="size-3.5 mr-1" />
              Copy
            </Button>
          </div>
        )}
      </div>

      {/* Keys list */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">All Keys</h3>
        </div>
        <div className="divide-y divide-border">
          {keys.map(k => {
            const plan = plans.find(p => p.id === k.plan_id)
            return (
              <div key={k.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-sm font-semibold tracking-widest text-gray-800">{k.key}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {plan && <span className="text-xs text-muted-foreground">{plan.name}</span>}
                    {k.notes && <span className="text-xs text-muted-foreground">• {k.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {k.used_at ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                      <CheckCircle2 className="size-2.5" />
                      USED
                    </span>
                  ) : (
                    <>
                      <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                        AVAILABLE
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => copyKey(k.key)}>
                        <Copy className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {keys.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">No keys yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}
