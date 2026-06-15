"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { generateTrackingUrl } from "@/lib/queueUtils"

interface QRDisplayProps {
  token: string
  queueNumber: number
  customerName: string
}

export function QRDisplay({ token, queueNumber, customerName }: QRDisplayProps) {
  const [copied, setCopied] = useState(false)
  const url = generateTrackingUrl(token)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success("Tracking link copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="rounded-sm bg-white border border-gray-200 p-4">
        <QRCodeSVG
          value={url}
          size={180}
          level="H"
          fgColor="#0f172a"
          bgColor="#ffffff"
        />
      </div>

      <div className="text-center">
        <p className="text-3xl font-black text-gray-900">#{queueNumber}</p>
        <p className="text-sm text-muted-foreground mt-1">{customerName}</p>
      </div>

      <div className="w-full rounded-sm border border-border bg-muted/40 p-3">
        <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Tracking Link</p>
        <p className="text-xs font-mono text-foreground break-all">{url}</p>
      </div>

      <div className="flex w-full gap-2">
        <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
          {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
          {copied ? "Copied!" : "Copy Link"}
        </Button>
        <Button variant="outline" size="icon" asChild>
          <a href={`/track/${token}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}
