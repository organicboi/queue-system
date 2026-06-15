"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface LeaveQueueDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  queueNumber: number
}

export function LeaveQueueDialog({ open, onClose, onConfirm, queueNumber }: LeaveQueueDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-border sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Leave Queue</DialogTitle>
          <DialogDescription>
            Are you sure you want to leave queue #{queueNumber}? You will lose your spot and need to rejoin.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Stay in Queue
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            Leave Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
