import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/queueUtils'
import type { ActivityLogDTO } from '@/lib/db/types'

const dotColor: Record<string, string> = {
  joined:    'bg-slate-400',
  called:    'bg-blue-500',
  recalled:  'bg-indigo-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-400',
  'no-show': 'bg-orange-400',
  reset:     'bg-purple-400',
  paused:    'bg-yellow-400',
  resumed:   'bg-green-400',
}

interface ActivityFeedServerProps {
  logs: ActivityLogDTO[]
  /** When provided, shows a "View all" link to a dedicated full logs page. */
  viewAllHref?: string
}

export function ActivityFeedServer({ logs, viewAllHref }: ActivityFeedServerProps) {
  return (
    <div className="rounded-xl border border-border bg-white flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <h3 className="text-sm font-semibold">Activity Feed</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{logs.length} events</span>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all
              <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-0.5">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/40 transition-colors"
            >
              <span className={cn('mt-1.5 size-1.5 rounded-full shrink-0', dotColor[log.type] ?? 'bg-gray-400')} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground leading-snug">{log.message}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatRelativeTime(log.createdAt)}
                </p>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No activity yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
