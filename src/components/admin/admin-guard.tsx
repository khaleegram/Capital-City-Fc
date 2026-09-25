"use client"

import Image from "next/image"
import Link from "next/link"
import { Loader2, ShieldAlert } from "lucide-react"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/hooks/use-auth"
import { useAdmin } from "@/hooks/use-admin"
import { TEAM_LOGO_URL } from "@/lib/brand"
import { LoginForm } from "@/components/login-form"
import { Button } from "@/components/ui/button"

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-ink p-5">
      <div aria-hidden className="absolute inset-0 bg-grid opacity-40" />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-navy-deep/80 p-6 backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <Image src={TEAM_LOGO_URL} alt="" width={40} height={40} className="h-10 w-10" />
          <div>
            <p className="font-display text-lg font-extrabold uppercase leading-none font-condensed">CCFC Staff</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist/60">Admin console</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { admin, loading: adminLoading } = useAdmin()

  if (loading || (user && adminLoading)) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-ink">
        <Loader2 className="h-6 w-6 animate-spin text-mist" />
      </div>
    )
  }

  if (!user) {
    return (
      <Frame>
        <LoginForm />
        <Link href="/" className="mt-6 block text-center text-sm text-mist/70 hover:text-ivory">
          ← Back to the site
        </Link>
      </Frame>
    )
  }

  if (!admin) {
    return (
      <Frame>
        <div className="space-y-4">
          <ShieldAlert className="h-8 w-8 text-signal" />
          <h1 className="font-display text-2xl font-bold">No staff access</h1>
          <p className="text-sm text-mist/80">
            You&apos;re signed in as <span className="text-ivory">{user.email}</span>, but this account isn&apos;t on the staff list.
            Ask an owner to add you under Admin users.
          </p>
          <p className="break-all font-mono text-[10px] text-mist/50">UID {user.uid}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => signOut(auth)}>
              Sign out
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">Back to site</Link>
            </Button>
          </div>
        </div>
      </Frame>
    )
  }

  return <>{children}</>
}
