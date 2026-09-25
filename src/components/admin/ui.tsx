"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2, UploadCloud, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { uploadFile } from "@/lib/admin-client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function AdminPage({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8", className)}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight font-condensed">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, body, action }: { icon?: React.ElementType; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line/20 px-6 py-14 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-mist/60" />}
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function LoadingBlock() {
  return (
    <div className="flex h-48 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-mist" />
    </div>
  )
}

export function PublishBadge({ published }: { published?: boolean }) {
  return published ? <Badge variant="ivory">Live</Badge> : <Badge variant="outline">Draft</Badge>
}

export function ConfirmDelete({ onConfirm, label = "Delete", what = "this item" }: { onConfirm: () => Promise<void> | void; label?: string; what?: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="text-mist/70 hover:text-signal">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {what}?</AlertDialogTitle>
          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault()
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
              }
            }}
            className="bg-signal hover:bg-signal-soft"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Single image/video field that uploads straight to R2 and returns the public URL. */
export function UploadField({
  value,
  onChange,
  prefix,
  accept = "image/*",
  label = "Upload image",
  aspect = "aspect-video",
  className,
}: {
  value?: string | null
  onChange: (url: string | null) => void
  prefix: string
  accept?: string
  label?: string
  aspect?: string
  className?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const { toast } = useToast()
  const isVideo = accept.startsWith("video")

  const pick = async (file?: File) => {
    if (!file) return
    setProgress(0)
    try {
      const url = await uploadFile(file, prefix, setProgress)
      onChange(url)
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: (err as Error).message })
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-dashed border-line/20 bg-line/[0.03]", aspect, className)}>
      {value ? (
        <>
          {isVideo ? (
            <video src={value} className="h-full w-full object-cover" muted playsInline />
          ) : (
            <Image src={value} alt="" fill sizes="400px" className="object-cover" />
          )}
          <div className="absolute right-2 top-2 flex gap-1">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="on-dark flex h-8 w-8 items-center justify-center rounded-full bg-ink/80 text-ivory"
              aria-label="Replace photo"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="on-dark flex h-8 w-8 items-center justify-center rounded-full bg-ink/80 text-ivory"
              aria-label="Remove"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={progress !== null}
          className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-sm text-mist/70 hover:text-ivory"
        >
          {progress !== null ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="font-mono text-xs">{progress}%</span>
            </>
          ) : (
            <>
              {isVideo ? <UploadCloud className="h-6 w-6" /> : <ImagePlus className="h-6 w-6" />}
              {label}
            </>
          )}
        </button>
      )}
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}
