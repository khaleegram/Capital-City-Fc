"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Images, Loader2, Plus } from "lucide-react"
import type { Gallery } from "@/lib/data"
import { saveDoc, useCollection } from "@/lib/collections"
import { formatDate } from "@/lib/utils"
import { AdminPage, EmptyState, LoadingBlock, PublishBadge } from "@/components/admin/ui"
import { Button } from "@/components/ui/button"

export default function GalleriesAdmin() {
  const { items, loading } = useCollection<Gallery>("galleries", (a, b) => (b.chapter ?? 0) - (a.chapter ?? 0))
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const create = async () => {
    setCreating(true)
    const chapter = Math.max(0, ...items.map((g) => g.chapter ?? 0)) + 1
    const id = await saveDoc("galleries", null, { title: `Chapter ${chapter}`, slug: "", chapter, photos: [], published: false })
    router.push(`/admin/galleries/${id}`)
  }

  return (
    <AdminPage
      title="Galleries"
      description="Photo stories told in chapters. Drop in a batch of photos, add captions and tag players."
      actions={
        <Button onClick={create} disabled={creating}>
          {creating ? <Loader2 className="animate-spin" /> : <Plus />} New chapter
        </Button>
      }
    >
      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState icon={Images} title="No photo stories yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((g) => (
            <Link key={g.id} href={`/admin/galleries/${g.id}`} className="group overflow-hidden rounded-2xl border border-white/10">
              <div className="relative aspect-[4/3] bg-navy-deep">
                {g.photos?.[0] && <Image src={g.photos[0].url} alt="" fill sizes="33vw" className="object-cover" />}
                <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">Ch. {g.chapter ?? "-"}</span>
              </div>
              <div className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.photos?.length ?? 0} photos {g.date ? `· ${formatDate(g.date)}` : ""}
                  </p>
                </div>
                <PublishBadge published={g.published} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AdminPage>
  )
}
