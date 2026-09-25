"use client"

import { useState } from "react"
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth"
import { Loader2 } from "lucide-react"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState<"email" | "google" | null>(null)
  const { toast } = useToast()

  const fail = (error: unknown) =>
    toast({ variant: "destructive", title: "Sign-in failed", description: (error as Error)?.message })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy("email")
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      fail(error)
    } finally {
      setBusy(null)
    }
  }

  const handleGoogle = async () => {
    setBusy("google")
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (error) {
      fail(error)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={!!busy}>
          {busy === "email" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>
      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-mist/50">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={!!busy}>
        {busy === "google" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-4 w-4" aria-hidden viewBox="0 0 488 512">
            <path
              fill="currentColor"
              d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-72.2 68.7C297.6 114.5 273.5 104 248 104c-73.8 0-134.3 60.3-134.3 135S174.2 375 248 375c85.3 0 118.4-62 122.7-94.2H248v-85.3h236.1c2.3 12.7 3.9 26.9 3.9 41.4z"
            />
          </svg>
        )}
        Continue with Google
      </Button>
    </div>
  )
}
