"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Copy, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type CopyButtonProps = {
  text: string
  label?: string
  className?: string
}

export function CopyButton({
  text,
  label = "Copy",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleCopy = async () => {
    if (!text) return
    try {
      setBusy(true)
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className={cn("h-8 w-8", className)}
      onClick={handleCopy}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}
