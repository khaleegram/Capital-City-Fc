"use client"

import { useEffect, useState } from "react"
import { Check, Link2, Share2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Share a page, and copy its link.
 *
 * Two affordances rather than one, because the right gesture differs by device. A phone has a
 * system share sheet that reaches every app the person actually uses, so that is the primary
 * action there. A desktop browser usually has no share sheet at all, so the copy button has to
 * stand on its own.
 *
 * Both are plain buttons and neither is rendered conditionally on the browser's capabilities: a
 * conditional would have to wait for an effect, so the server and the first client render would
 * disagree and React would tear the row down and rebuild it. Instead the capability is checked
 * when the button is pressed — `navigator.share` on a desktop falls back to copying, so the
 * button still does something honest rather than nothing.
 */

type ShareArticleProps = {
  /** Used as the share sheet's title. The URL is read from the address bar, never passed in. */
  title: string
  className?: string
}

const PILL =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line/15 px-3.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mist/80 transition-colors hover:border-signal/50 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 disabled:opacity-60"

export function ShareArticle({ title, className }: ShareArticleProps) {
  const [copied, setCopied] = useState(false)

  // The confirmation clears itself so the row returns to its resting state.
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2200)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      /*
       * `navigator.clipboard` is unavailable over plain HTTP and can be refused by permissions, so
       * there is a fallback rather than a button that silently does nothing. The element has to be
       * in the document and selected for the older command to reach it.
       */
      const field = document.createElement("textarea")
      field.value = url
      field.setAttribute("readonly", "")
      field.style.position = "fixed"
      field.style.opacity = "0"
      document.body.appendChild(field)
      field.select()
      try {
        document.execCommand("copy")
        setCopied(true)
      } finally {
        document.body.removeChild(field)
      }
    }
  }

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href })
        return
      } catch {
        // Dismissing the sheet is a decision, not a failure — fall through to copying.
      }
    }
    await copy()
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button type="button" className={PILL} onClick={() => void share()}>
        <Share2 className="h-3.5 w-3.5" aria-hidden />
        Share
      </button>
      <button type="button" className={PILL} onClick={() => void copy()}>
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-signal" aria-hidden />
            Copied
          </>
        ) : (
          <>
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Copy link
          </>
        )}
      </button>
      {/* Announced rather than only shown: the label swap is invisible to a screen reader. */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to the clipboard." : ""}
      </span>
    </div>
  )
}
