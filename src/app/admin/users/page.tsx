"use client"

import { useState } from "react"
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore"
import { Loader2, ShieldCheck, UserPlus } from "lucide-react"
import { db } from "@/lib/firebase"
import type { AdminUser } from "@/lib/data"
import { useCollection } from "@/lib/collections"
import { useAdmin } from "@/hooks/use-admin"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { AdminPage, ConfirmDelete, EmptyState, Field, LoadingBlock } from "@/components/admin/ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AdminUsersPage() {
  const { admin } = useAdmin()
  const { user } = useAuth()
  const { toast } = useToast()
  const { items, loading } = useCollection<AdminUser>("admins", (a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === "owner" ? -1 : 1))
  const [form, setForm] = useState({ uid: "", email: "", name: "", role: "editor" as AdminUser["role"] })
  const [busy, setBusy] = useState(false)
  const isOwner = admin?.role === "owner"

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await setDoc(doc(db, "admins", form.uid.trim()), {
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
        role: form.role,
        createdAt: serverTimestamp(),
      })
      toast({ title: "Staff access granted", description: form.email })
      setForm({ uid: "", email: "", name: "", role: "editor" })
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't add", description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const setRole = async (u: AdminUser, role: AdminUser["role"]) => {
    try {
      await setDoc(doc(db, "admins", u.id), { role }, { merge: true })
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't update role", description: (err as Error).message })
    }
  }

  return (
    <AdminPage title="Admin users" description="Only accounts on this list can open the staff console or edit club data.">
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <LoadingBlock />
            ) : items.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={ShieldCheck} title="No staff yet" />
              </div>
            ) : (
              <ul className="divide-y divide-line/10">
                {items.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {u.name || u.email} {u.id === user?.uid && <span className="text-xs text-mist/60">(you)</span>}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                    </div>
                    {isOwner && u.id !== user?.uid ? (
                      <>
                        <Select value={u.role} onValueChange={(v) => setRole(u, v as AdminUser["role"])}>
                          <SelectTrigger className="h-9 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                          </SelectContent>
                        </Select>
                        <ConfirmDelete what={`${u.email}'s access`} label="Remove" onConfirm={() => deleteDoc(doc(db, "admins", u.id))} />
                      </>
                    ) : (
                      <Badge variant={u.role === "owner" ? "ivory" : "outline"}>{u.role}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add staff</CardTitle>
            <CardDescription>
              Ask the person to sign in at <span className="font-mono">/admin</span> once. The &ldquo;No staff access&rdquo; screen shows
              their UID; paste it here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isOwner ? (
              <form onSubmit={add} className="space-y-4">
                <Field label="User UID">
                  <Input value={form.uid} onChange={(e) => setForm((f) => ({ ...f, uid: e.target.value }))} required className="font-mono text-xs" />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
                </Field>
                <Field label="Name">
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </Field>
                <Field label="Role" hint="Owners can manage staff. Editors manage content.">
                  <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as AdminUser["role"] }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Grant access
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Only owners can add or remove staff.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  )
}
