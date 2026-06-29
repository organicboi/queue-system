'use client'

import { useState, useActionState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { inviteUserAction, deactivateUserAction, reactivateUserAction } from '@/lib/actions/users'
import { Plus, UserCheck, UserX, Crown, User } from 'lucide-react'
import { toast } from 'sonner'
import type { ProfileDTO, BranchDTO } from '@/lib/db/types'

interface Props {
  users: ProfileDTO[]
  branches: BranchDTO[]
  currentUserId: string
}

const INIT: { error?: string } = {}

export function UsersManager({ users, branches, currentUserId }: Props) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(inviteUserAction, INIT)

  if (!state.error && state !== INIT && open) {
    setOpen(false)
  }

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
                <Label>Role</Label>
                <Select name="role" defaultValue="branch_user">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="branch_user">Branch User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {state.error && <p className="text-sm text-red-600">{state.error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Inviting…' : 'Send Invite'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
