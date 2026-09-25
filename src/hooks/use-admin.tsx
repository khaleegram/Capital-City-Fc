"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "./use-auth"
import type { AdminUser } from "@/lib/data"

type AdminState = { admin: AdminUser | null; loading: boolean }

const AdminContext = createContext<AdminState>({ admin: null, loading: true })

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<AdminState>({ admin: null, loading: true })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setState({ admin: null, loading: false })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    return onSnapshot(
      doc(db, "admins", user.uid),
      (snap) =>
        setState({
          admin: snap.exists() ? ({ id: snap.id, ...snap.data() } as AdminUser) : null,
          loading: false,
        }),
      () => setState({ admin: null, loading: false })
    )
  }, [user, authLoading])

  return <AdminContext.Provider value={state}>{children}</AdminContext.Provider>
}

export const useAdmin = () => useContext(AdminContext)
