'use client'

import { useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronsUpDown, GitBranch, Check, Plus } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { setActiveBranchAction } from '@/lib/actions/branches'
import type { BranchDTO } from '@/lib/db/types'

interface Props {
  branches: BranchDTO[]
  activeBranchId: string | null
}

export function BranchSwitcher({ branches, activeBranchId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const active = branches.find((b) => b.id === activeBranchId)

  if (branches.length === 0) return null

  function handleSelect(branchId: string) {
    if (branchId === activeBranchId || pending) return
    startTransition(async () => {
      await setActiveBranchAction(branchId)
      // If already looking at a branch-scoped tab, jump to the same tab for
      // the newly-selected branch instead of always landing on Overview.
      const match = pathname.match(/^\/branches\/[^/]+(\/.*)?$/)
      const suffix = match?.[1] ?? ''
      router.push(`/branches/${branchId}${suffix}`)
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={pending}
          className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-slate-800 active:bg-slate-50 transition-colors disabled:opacity-50 shrink-0"
        >
          <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
          <span className="truncate max-w-36 sm:max-w-48">{active?.name ?? 'Select branch'}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {branches.map((b) => (
          <DropdownMenuItem key={b.id} onClick={() => handleSelect(b.id)} className="flex items-center justify-between gap-2">
            <span className="truncate">{b.name}</span>
            {b.id === activeBranchId && <Check className="size-3.5 text-accent-600 shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/branches')} className="flex items-center gap-2 text-muted-foreground">
          <Plus className="size-3.5 shrink-0" />
          New Branch
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
