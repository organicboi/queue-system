'use client'

import { useState, useActionState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { inviteUserAction, deactivateUserAction, reactivateUserAction, assignUserBranchesAction, resetUserPasswordAction, deleteUserAction } from '@/lib/actions/users'
import { Plus, UserCheck, UserX, Crown, User, GitBranch, Copy, Check, KeyRound, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ProfileDTO, BranchDTO } from '@/lib/db/types'

interface Props {
  users: ProfileDTO[]
  branches: BranchDTO[]
  currentUserId: string
  userBranchMap: Record<string, BranchDTO[]>
}

const INIT: { error?: string; password?: string; email?: string } = {}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  let pwd = ''
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd
}

function CredentialsCard({ email, password, onDone }: { email: string; password: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
        <p className="text-sm font-medium text-emerald-800">Login details for {email}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 rounded bg-white border border-emerald-200 px-2.5 py-1.5">
            <span className="text-xs text-muted-foreground shrink-0">Email</span>
            <code className="text-sm font-mono truncate">{email}</code>
          </div>
          <div className="flex items-center justify-between gap-2 rounded bg-white border border-emerald-200 px-2.5 py-1.5">
            <span className="text-xs text-muted-foreground shrink-0">Password</span>
            <code className="text-sm font-mono truncate">{password}</code>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full gap-1.5"
          onClick={() => {
            const origin = typeof window !== 'undefined' ? window.location.origin : ''
            const text = `Queue System Login\nEmail: ${email}\nPassword: ${password}\nLogin: ${origin}/login`
            navigator.clipboard.writeText(text)
            setCopied(true)
            toast.success('Login details copied')
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy Login Details'}
        </Button>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onDone}>Done</Button>
      </div>
    </div>
  )
}

function InviteUserForm({ branches, onDone }: { branches: BranchDTO[]; onDone: () => void }) {
  const [role, setRole] = useState<'admin' | 'branch_user'>('branch_user')
  const [branchId, setBranchId] = useState('')
  const [password, setPassword] = useState('')
  const [state, formAction, pending] = useActionState(inviteUserAction, INIT)

  if (state.password) {
    return <CredentialsCard email={state.email!} password={state.password} onDone={onDone} />
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="staff@example.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full Name</Label>
        <Input id="fullName" name="fullName" required placeholder="Jane Smith" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setPassword(generatePassword())}
          >
            Generate
          </button>
        </div>
        <Input
          id="password"
          name="password"
          type="text"
          required
          minLength={8}
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select name="role" defaultValue="branch_user" onValueChange={(v) => setRole(v as 'admin' | 'branch_user')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="branch_user">Branch User</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {role === 'branch_user' && (
        <div className="space-y-1.5">
          <Label>Branch</Label>
          <Select value={branchId} onValueChange={setBranchId} required>
            <SelectTrigger>
              <SelectValue placeholder="Select a branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {branches.length === 0 && (
            <p className="text-xs text-muted-foreground">Create a branch first to assign one.</p>
          )}
          <input type="hidden" name="branchIds" value={branchId ? JSON.stringify([branchId]) : ''} />
        </div>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending || password.length < 8 || (role === 'branch_user' && !branchId)}>
          {pending ? 'Inviting…' : 'Send Invite'}
        </Button>
      </div>
    </form>
  )
}

function ResetPasswordForm({ userId, email, onDone }: { userId: string; email: string; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  if (result) {
    return <CredentialsCard email={email} password={result} onDone={onDone} />
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="reset-password">New Password</Label>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setPassword(generatePassword())}
          >
            Generate
          </button>
        </div>
        <Input
          id="reset-password"
          type="text"
          required
          minLength={8}
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button
          type="button"
          disabled={pending || password.length < 8}
          onClick={async () => {
            setPending(true)
            setError(null)
            const r = await resetUserPasswordAction(userId, password)
            setPending(false)
            if (r.error || !r.password) setError(r.error ?? 'Failed to reset password')
            else setResult(r.password)
          }}
        >
          {pending ? 'Setting…' : 'Set Password'}
        </Button>
      </div>
    </div>
  )
}

export function UsersManager({ users, branches, currentUserId, userBranchMap }: Props) {
  const [open, setOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<{ id: string; email: string } | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            {open && <InviteUserForm branches={branches} onDone={() => setOpen(false)} />}
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!resetTarget} onOpenChange={(v) => { if (!v) setResetTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          {resetTarget && (
            <ResetPasswordForm
              userId={resetTarget.id}
              email={resetTarget.email}
              onDone={() => setResetTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="divide-y divide-border">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-3 px-5 py-4">
              <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-primary">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.fullName}</p>
                  {user.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      <Crown className="size-2.5" />ADMIN
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      <User className="size-2.5" />STAFF
                    </span>
                  )}
                  {!user.isActive && (
                    <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">INACTIVE</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              {user.role === 'branch_user' && (
                <div className="shrink-0 w-40">
                  <Select
                    value={userBranchMap[user.id]?.[0]?.id ?? ''}
                    onValueChange={async (newBranchId) => {
                      const r = await assignUserBranchesAction(user.id, [newBranchId])
                      if (r.error) toast.error(r.error)
                      else toast.success('Branch updated')
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <GitBranch className="size-3 shrink-0" />
                      <SelectValue placeholder="No branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  onClick={() => setResetTarget({ id: user.id, email: user.email })}
                >
                  <KeyRound className="size-3.5 mr-1" />
                  Reset Password
                </Button>
              </div>
              {user.id !== currentUserId && (
                <div className="shrink-0">
                  {user.isActive ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        const r = await deactivateUserAction(user.id)
                        if (r.error) toast.error(r.error)
                        else toast.success('User deactivated')
                      }}
                    >
                      <UserX className="size-3.5 mr-1" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={async () => {
                        const r = await reactivateUserAction(user.id)
                        if (r.error) toast.error(r.error)
                        else toast.success('User reactivated')
                      }}
                    >
                      <UserCheck className="size-3.5 mr-1" />
                      Reactivate
                    </Button>
                  )}
                </div>
              )}
              {user.id !== currentUserId && (
                <div className="shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={async () => {
                      if (!confirm(`Permanently delete ${user.fullName}? This cannot be undone.`)) return
                      const r = await deleteUserAction(user.id)
                      if (r.error) toast.error(r.error)
                      else toast.success('User deleted')
                    }}
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No team members yet. Invite someone to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
