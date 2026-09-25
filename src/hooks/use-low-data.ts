"use client"

import { useEffect, useState } from "react"

type NetworkInfo = { saveData?: boolean; effectiveType?: string; addEventListener?: (t: string, cb: () => void) => void; removeEventListener?: (t: string, cb: () => void) => void }

/** True when the visitor asked to save data (Save-Data / slow connection) or prefers reduced motion. */
export function useLowData() {
  const [low, setLow] = useState(true)

  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: NetworkInfo }).connection
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const evaluate = () =>
      setLow(!!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? "") || motion.matches)
    evaluate()
    conn?.addEventListener?.("change", evaluate)
    motion.addEventListener("change", evaluate)
    return () => {
      conn?.removeEventListener?.("change", evaluate)
      motion.removeEventListener("change", evaluate)
    }
  }, [])

  return low
}
