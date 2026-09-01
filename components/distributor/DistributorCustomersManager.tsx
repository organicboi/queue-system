'use client'

import { useState, useActionState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VERTICALS, DEFAULT_VERTICAL, verticalMeta } from '@/lib/verticals'
import type { CustomerVertical } from '@/lib/db/types'
import {
  createCustomerAction, toggleCustomerActiveAction, changePlanAction,
  setCustomerSchoolLimitsAction, setSchoolIdentityAction,
} from '@/lib/actions/distributor'
import type { SchoolBranchIdentity } from '@/lib/db/school-types'
import { MAX_SCHOOL_ENTITLEMENT } from '@/lib/db/types'
import { Plus, Power, Copy, Check, Key, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import type { CustomerDTO } from '@/lib/db/types'

interface Plan { id: string; name: string }
type CustomerWithPlan = CustomerDTO & { planName?: string }

interface Props {
  customers: CustomerWithPlan[]
  plans: Plan[]
  // Branch branding, keyed by customer id. Only school tenants have entries.
  identities: Record<string, SchoolBranchIdentity[]>
}

const INIT: { error?: string; licenseKey?: string } = {}

export function DistributorCustomersManager({ customers, plans, identities }: Props) {
  const [open, setOpen] = useState(false)
  // Which school tenant's setup — branding and allowance — is being edited.
  const [setupFor, setSetupFor] = useState<CustomerWithPlan | null>(null)
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  // The key issued with this customer carries the system, and the customer row
  // is stamped with it too — so the tenant lands in the right product the very
  // first time they sign in.
  const [vertical, setVertical] = useState<CustomerVertical>(DEFAULT_VERTICAL)
  const [copied, setCopied] = useState(false)
  const [state, formAction, pending] = useActionState(createCustomerAction, INIT)

  const justCreated = !state.error && state !== INIT && state.licenseKey

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleClose(val: boolean) {
    if (!val) setCopied(false)
    setOpen(val)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              Create Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Customer</DialogTitle>
            </DialogHeader>

            {justCreated ? (
              /* ── Success: show the generated license key ── */
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                  <Key className="size-5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">License Key Generated</p>
                    <p className="font-mono font-black text-lg text-emerald-900 tracking-widest">{state.licenseKey}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this key with the client. They enter it at <span className="font-mono text-foreground">/onboard</span> to set up their own email and password.
                </p>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-1.5"
                    onClick={() => copyKey(state.licenseKey!)}
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? 'Copied!' : 'Copy Key'}
                  </Button>
                  <Button variant="outline" onClick={() => { setOpen(false) }}>Done</Button>
                </div>
              </div>
            ) : (
              /* ── Create form ── */
              <form action={formAction} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Plan</Label>
                  <Select value={planId} onValueChange={setPlanId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>
                      {plans.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="planId" value={planId} />
                </div>
                <div className="space-y-1.5">
                  <Label>System</Label>
                  <Select
                    value={vertical}
                    onValueChange={(v) => setVertical(v as CustomerVertical)}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select system" /></SelectTrigger>
                    <SelectContent>
                      {VERTICALS.map(v => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="vertical" value={vertical} />
                  <p className="text-xs text-muted-foreground">
                    {verticalMeta(vertical).description}. This customer can only sign in
                    to the system chosen here.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input id="businessName" name="businessName" placeholder="Acme Corp" required />
                  <p className="text-[11px] text-muted-foreground">The client can update this after signing in.</p>
                </div>
                {state.error && <p className="text-sm text-red-600">{state.error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={pending || !planId}>
                    {pending ? 'Creating…' : 'Create & Get Key'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="divide-y divide-border">
          {customers.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-4">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{c.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Which product this tenant signs in to. Read-only here: it is
                      set by the key they redeemed, and a live tenant already has
                      rows in that product's tables. */}
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      c.vertical === 'school'
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-sky-100 text-sky-700'
                    }`}
                    title={verticalMeta(c.vertical).label}
                  >
                    {verticalMeta(c.vertical).short.toUpperCase()}
                  </span>
                  {c.planName && <span className="text-xs text-muted-foreground">{c.planName}</span>}
                  {/* What this school is entitled to build, per branch. The
                      tenant cannot raise it — that is the point of it living
                      here. */}
                  {c.vertical === 'school' && (
                    <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                      {c.maxSchoolDepartments} dept · {c.maxSchoolCounters} counter
                      {c.maxSchoolCounters === 1 ? '' : 's'}
                    </span>
                  )}
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    c.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {c.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  defaultValue={c.planId !== null ? c.planId : undefined}
                  onValueChange={async (newPlanId) => {
                    const r = await changePlanAction(c.id, newPlanId)
                    if (r.error) toast.error(r.error)
                    else toast.success('Plan updated')
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {c.vertical === 'school' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setSetupFor(c)}
                  >
                    <SlidersHorizontal className="size-3.5 mr-1" />
                    School setup
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 text-xs px-2 ${c.isActive ? 'text-red-500 hover:text-red-600' : 'text-emerald-600 hover:text-emerald-700'}`}
                  onClick={async () => {
                    const r = await toggleCustomerActiveAction(c.id)
                    if (r.error) toast.error(r.error)
                  }}
                >
                  <Power className="size-3.5 mr-1" />
                  {c.isActive ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </div>
          ))}
          {customers.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No customers yet.</div>
          )}
        </div>
      </div>

      <SchoolSetupDialog
        customer={setupFor}
        branches={setupFor ? identities[setupFor.id] ?? [] : []}
        onClose={() => setSetupFor(null)}
      />
    </div>
  )
}

// Everything about a school tenant that the tenant itself may not change:
// its branding (name and logo, which brand the TV board and every ticket) and
// its department/counter allowance. Two scopes in one dialog — identity is per
// branch, the allowance is per customer and applies at every branch — so each
// section saves on its own rather than sharing one ambiguous button.
function SchoolSetupDialog({ customer, branches, onClose }: {
  customer: CustomerWithPlan | null
  branches: SchoolBranchIdentity[]
  onClose: () => void
}) {
  const [forId, setForId] = useState<string | null>(null)
  const [departments, setDepartments] = useState('1')
  const [counters, setCounters] = useState('1')
  const [savingLimits, setSavingLimits] = useState(false)

  const [branchId, setBranchId] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [savingIdentity, setSavingIdentity] = useState(false)

  function loadBranch(id: string, list: SchoolBranchIdentity[], customerName: string) {
    const b = list.find((x) => x.branchId === id)
    setBranchId(id)
    // A tenant created before branding moved here may have no name saved; fall
    // back to what the account is called so the field is never blank.
    setNameEn(b?.schoolNameEn || customerName)
    setNameAr(b?.schoolNameAr ?? '')
    setLogoUrl(b?.logoUrl ?? '')
  }

  if (customer && forId !== customer.id) {
    setForId(customer.id)
    setDepartments(String(customer.maxSchoolDepartments))
    setCounters(String(customer.maxSchoolCounters))
    loadBranch(branches[0]?.branchId ?? '', branches, customer.name)
  }

  async function saveLimits() {
    if (!customer) return
    setSavingLimits(true)
    const r = await setCustomerSchoolLimitsAction(customer.id, {
      maxSchoolDepartments: Number(departments),
      maxSchoolCounters: Number(counters),
    })
    setSavingLimits(false)
    if (r.error) toast.error(r.error)
    else toast.success('Limits updated')
  }

  async function saveIdentity() {
    if (!branchId) return
    setSavingIdentity(true)
    const r = await setSchoolIdentityAction({ branchId, schoolNameEn: nameEn, schoolNameAr: nameAr, logoUrl })
    setSavingIdentity(false)
    if (r.error) toast.error(r.error)
    else toast.success('Identity updated')
  }

  return (
    <Dialog open={!!customer} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer?.name} — school setup</DialogTitle>
        </DialogHeader>

        {/* ── Identity ── */}
        <section className="space-y-3 rounded-xl border border-border p-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Identity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Shown on the TV board and printed on every ticket. Read-only for the
              client on /school/settings.
            </p>
          </div>

          {branches.length === 0 ? (
            <p className="text-xs text-muted-foreground">This customer has no branches yet.</p>
          ) : (
            <>
              {/* Identity is per branch — a multi-campus tenant brands each one. */}
              {branches.length > 1 && (
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Select
                    value={branchId}
                    onValueChange={(v) => loadBranch(v, branches, customer?.name ?? '')}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.branchId} value={b.branchId}>{b.branchName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="schoolNameEn">School name</Label>
                <Input
                  id="schoolNameEn"
                  value={nameEn}
                  maxLength={120}
                  onChange={(e) => setNameEn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schoolNameAr">School name (Arabic)</Label>
                <Input
                  id="schoolNameAr"
                  dir="rtl"
                  value={nameAr}
                  maxLength={120}
                  onChange={(e) => setNameAr(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  placeholder="https://…"
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={saveIdentity} disabled={savingIdentity}>
                {savingIdentity ? 'Saving…' : 'Save Identity'}
              </Button>
            </>
          )}
        </section>

        {/* ── Limits ── */}
        <section className="space-y-3 rounded-xl border border-border p-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Limits</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              How many departments and counters this school can run at each branch.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="maxSchoolDepartments">Departments</Label>
              <Input
                id="maxSchoolDepartments"
                type="number"
                min={0}
                max={MAX_SCHOOL_ENTITLEMENT}
                value={departments}
                onChange={(e) => setDepartments(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxSchoolCounters">Counters</Label>
              <Input
                id="maxSchoolCounters"
                type="number"
                min={0}
                max={MAX_SCHOOL_ENTITLEMENT}
                value={counters}
                onChange={(e) => setCounters(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Lowering a number never removes anything the school already built — it just
            stops them adding more until they deactivate down to the new limit.
          </p>
          <Button size="sm" onClick={saveLimits} disabled={savingLimits}>
            {savingLimits ? 'Saving…' : 'Save Limits'}
          </Button>
        </section>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
