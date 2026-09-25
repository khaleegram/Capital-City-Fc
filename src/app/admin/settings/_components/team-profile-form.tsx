"use client"

import { useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import type { TeamProfile } from "@/lib/data"
import { updateTeamProfile } from "@/lib/team"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, UploadField } from "@/components/admin/ui"

export function TeamProfileForm({ profile }: { profile: TeamProfile }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: profile.name,
    homeVenue: profile.homeVenue,
    heroImageUrl: profile.heroImageUrl ?? "",
    heroVideoUrl: profile.heroVideoUrl ?? "",
    instagram: profile.socials?.instagram ?? "",
    tiktok: profile.socials?.tiktok ?? "",
    youtube: profile.socials?.youtube ?? "",
    x: profile.socials?.x ?? "",
  })

  useEffect(() => {
    setForm({
      name: profile.name,
      homeVenue: profile.homeVenue,
      heroImageUrl: profile.heroImageUrl ?? "",
      heroVideoUrl: profile.heroVideoUrl ?? "",
      instagram: profile.socials?.instagram ?? "",
      tiktok: profile.socials?.tiktok ?? "",
      youtube: profile.socials?.youtube ?? "",
      x: profile.socials?.x ?? "",
    })
  }, [profile])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await updateTeamProfile({
        name: form.name.trim() || "Capital City FC",
        homeVenue: form.homeVenue.trim(),
        heroImageUrl: form.heroImageUrl || undefined,
        heroVideoUrl: form.heroVideoUrl || undefined,
        socials: { instagram: form.instagram, tiktok: form.tiktok, youtube: form.youtube, x: form.x },
      })
      toast({ title: "Saved", description: "Club profile updated on the public site." })
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't save", description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Club profile</CardTitle>
        <CardDescription>Name, home base, homepage hero media and social links. The crest is fixed brand artwork.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Club name">
              <Input value={form.name} onChange={set("name")} required />
            </Field>
            <Field label="Home base">
              <Input value={form.homeVenue} onChange={set("homeVenue")} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Homepage hero image" hint="Also used as the video poster. Landscape, at least 1600px wide.">
              <UploadField value={form.heroImageUrl} onChange={(url) => setForm((f) => ({ ...f, heroImageUrl: url ?? "" }))} prefix="team/hero" />
            </Field>
            <Field label="Homepage hero video (optional)" hint="Short, silent loop. Only plays on tap for low-data visitors.">
              <UploadField
                value={form.heroVideoUrl}
                onChange={(url) => setForm((f) => ({ ...f, heroVideoUrl: url ?? "" }))}
                prefix="team/hero"
                accept="video/*"
                label="Upload video"
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Instagram URL">
              <Input value={form.instagram} onChange={set("instagram")} placeholder="https://instagram.com/…" />
            </Field>
            <Field label="TikTok URL">
              <Input value={form.tiktok} onChange={set("tiktok")} />
            </Field>
            <Field label="YouTube URL">
              <Input value={form.youtube} onChange={set("youtube")} />
            </Field>
            <Field label="X URL">
              <Input value={form.x} onChange={set("x")} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save profile
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
