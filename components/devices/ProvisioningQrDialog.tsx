'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Scan-to-provision for the Flutter device app. Encodes exactly what
 * `ProvisioningPayload.tryParse` in `mobile/kiosk/lib/src/config/provisioning_qr.dart`
 * expects, so scanning this from the setup wizard's Pair step fills in the
 * server URL, role, and token in one step instead of three manual entries.
 *
 * Version-tagged (`v: 1`) so a future field addition can't silently misparse
 * an old QR still printed on a sticker on the back of a tablet somewhere.
 * `vertical` is optional and additive — a school QR omits it (unchanged wire
 * format); a hospital QR carries `"hospital"` so the app opens the hospital
 * route set. Older app builds ignore the extra key.
 */
export function ProvisioningQrDialog({
  role,
  token,
  label,
  vertical,
}: {
  role: 'kiosk' | 'display'
  token: string
  label: string
  vertical?: 'school' | 'hospital'
}) {
  const [open, setOpen] = useState(false)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const payload = JSON.stringify({
    v: 1,
    baseUrl,
    role,
    token,
    ...(vertical ? { vertical } : {}),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="size-3.5" />
          Provisioning QR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="rounded-sm bg-white border border-slate-200 p-4">
            <QRCodeSVG value={payload} size={200} level="M" fgColor="#0f172a" bgColor="#ffffff" />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Scan this from the app&apos;s setup wizard — Pair step — to fill in the server,
            role, and token in one step.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
