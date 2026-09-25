"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatBytes, percentUsed, type SignupUploadKind } from "@/lib/signup-limits"
import { deleteSignupUpload, signupStorageUsage } from "@/lib/signup-actions"
import { uploadSignupFile, type UploadedFile } from "@/lib/signup-upload"

export type Usage = { usedBytes: number; remainingBytes: number; limitBytes: number }

/** Live bar showing how much of the player's 1 GB is gone. Fed by real bucket listings. */
export function StorageMeter({ usage, className }: { usage: Usage | null; className?: string }) {
  const used = usage?.usedBytes ?? 0
  const limit = usage?.limitBytes ?? 0
  const pct = limit ? percentUsed(used, limit) : 0
  const tight = pct >= 90

  return (
    <div className={cn("rounded-2xl border border-line/10 p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-stamp text-mist/70">Your club storage</p>
        <p className="font-mono text-xs text-mist/85">
          <span className={cn("font-semibold", tight ? "text-signal" : "text-ivory")}>{formatBytes(used)}</span> of{" "}
          {formatBytes(limit)} used
        </p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-line/15"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Storage used"
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", tight ? "bg-signal" : "bg-signal/70")}
          style={{ width: `${Math.max(pct, used > 0 ? 2 : 0)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-mist/75">
        {usage === null
          ? "Checking your storage…"
          : `${formatBytes(usage.remainingBytes)} left. Remove a file any time to free space.`}
      </p>
    </div>
  )
}

type FilePickerProps = {
  sessionId: string
  kind: SignupUploadKind
  accept: string
  label: string
  hint?: string
  /** 1 for the profile photo, more for gallery and footage. */
  max: number
  value: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
  onUsage: (usage: Usage) => void
  /** Runs before the file dialog opens — used to show the photo guidance first. */
  onBeforePick?: () => boolean
  disabled?: boolean
  previewAspect?: string
}

/**
 * Uploads straight to the player's own staging prefix via a server-signed URL.
 *
 * Progress is per file, because a 150 MB video needs feedback while a 200 KB photo
 * finishes instantly. A failed upload never leaves a half-recorded entry: the file is
 * only added to `value` once storage has accepted the whole body.
 */
export function FilePicker({
  sessionId,
  kind,
  accept,
  label,
  hint,
  max,
  value,
  onChange,
  onUsage,
  onBeforePick,
  disabled,
  previewAspect = "aspect-[4/5]",
}: FilePickerProps) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [busyUrl, setBusyUrl] = useState<string | null>(null)
  const [error, setError] = useState("")

  const full = value.length >= max
  const isVideo = kind === "video"

  const openPicker = () => {
    if (onBeforePick && !onBeforePick()) return
    input.current?.click()
  }

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    setError("")
    const room = max - value.length
    const chosen = Array.from(files).slice(0, room)

    for (const file of chosen) {
      setProgress(0)
      try {
        const uploaded = await uploadSignupFile(sessionId, file, kind, setProgress)
        onChange([...value, uploaded])
        onUsage(await signupStorageUsage(sessionId))
      } catch (err) {
        setError((err as Error).message)
        break
      } finally {
        setProgress(null)
      }
    }
    if (input.current) input.current.value = ""
  }
  const remove = async (file: UploadedFile) => {
    setError("")
    setBusyUrl(file.url)
    try {
      const usage = await deleteSignupUpload(sessionId, file.url)
      onChange(value.filter((f) => f.url !== file.url))
      onUsage(usage)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyUrl(null)
    }
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className={cn("grid gap-3", isVideo ? "sm:grid-cols-2" : "grid-cols-3 sm:grid-cols-4")}>
          {value.map((file) => (
            <li key={file.url} className="relative overflow-hidden rounded-xl border border-line/15">
              <div className={cn("relative bg-ink/40", isVideo ? "aspect-video" : previewAspect)}>
                {isVideo ? (
                  <video src={file.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  <Image src={file.url} alt="" fill sizes="200px" className="object-cover object-top" />
                )}
                {busyUrl === file.url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/70">
                    <Loader2 className="h-5 w-5 animate-spin text-ivory" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="min-w-0 truncate font-mono text-[10px] text-mist/70" title={file.name}>
                  {formatBytes(file.bytes)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(file)}
                  disabled={busyUrl === file.url}
                  className="rounded-full p-1 text-mist/70 hover:bg-white/10 hover:text-signal disabled:opacity-50"
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled || progress !== null}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line/25 bg-ink/20 px-4 py-5 text-sm text-mist/75 transition-colors hover:border-signal/60 hover:text-ivory",
            (disabled || progress !== null) && "opacity-60"
          )}
        >
          {progress !== null ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-mono text-xs">Uploading {progress}%</span>
            </>
          ) : (
            <>
              {isVideo ? <UploadCloud className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
              <span>
                {label}
                {max > 1 && <span className="ml-1 text-mist/60">({value.length}/{max})</span>}
              </span>
            </>
          )}
        </button>
      )}

      {hint && <p className="text-xs text-mist/70">{hint}</p>}
      {error && (
        <p role="alert" className="rounded-xl border border-signal/40 bg-signal/10 px-3 py-2 text-xs text-ivory">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={max > 1}
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  )
}
