"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Archive, Inbox, Mail, MailCheck, Phone } from "lucide-react"
import type { Enquiry, EnquiryRole } from "@/lib/data"
import { copy } from "@/lib/copy"
import { removeDoc, saveDoc, useCollection } from "@/lib/collections"
import { byNewest, cn, formatDate } from "@/lib/utils"
import { AdminPage, ConfirmDelete, EmptyState, LoadingBlock } from "@/components/admin/ui"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type Status = Enquiry["status"]
const FILTERS: [Status | "open", string][] = [
  ["open", "Open"],
  ["new", "New"],
  ["read", "Read"],
  ["replied", "Replied"],
  ["archived", "Archived"],
]

export default function EnquiriesAdmin() {
  const { items, loading } = useCollection<Enquiry>("enquiries", byNewest)
  const [filter, setFilter] = useState<Status | "open">("open")
  const [role, setRole] = useState<EnquiryRole | "all">("all")
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      items.filter(
        (e) => (filter === "open" ? e.status !== "archived" : e.status === filter) && (role === "all" || e.role === role)
      ),
    [items, filter, role]
  )
  const active = items.find((e) => e.id === openId) ?? null

  const setStatus = (id: string, status: Status) => saveDoc("enquiries", id, { status })

  const open = (e: Enquiry) => {
    setOpenId(e.id)
    if (e.status === "new") setStatus(e.id, "read")
  }

  return (
    <AdminPage title="Enquiries" description="Messages from scouts, parents, players, partners and media via the Contact page.">
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn("h-9 rounded-full border px-4 text-xs font-semibold", filter === key ? "border-signal bg-signal text-signal-foreground" : "border-line/15 text-mist/80")}
          >
            {label}
            {key === "new" && ` (${items.filter((e) => e.status === "new").length})`}
          </button>
        ))}
        <select value={role} onChange={(e) => setRole(e.target.value as EnquiryRole | "all")} className="h-9 rounded-full border border-input bg-paper px-3 text-xs text-ivory">
          <option value="all">All roles</option>
          {Object.entries(copy.contact.roles).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState icon={Inbox} title="Inbox zero" body="New enquiries appear here the moment they're sent." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <ul className="overflow-hidden rounded-2xl border border-line/10">
            {rows.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => open(e)}
                  className={cn("flex w-full items-start gap-3 border-b border-line/5 p-4 text-left hover:bg-line/5", openId === e.id && "bg-line/5")}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", e.status === "new" ? "bg-signal" : "bg-transparent")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate", e.status === "new" && "font-semibold")}>{e.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{formatDate(e.createdAt, { day: "numeric", month: "short" })}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {copy.contact.roles[e.role]}
                      </Badge>
                      {e.playerName && <span className="truncate text-xs text-signal-soft">re: {e.playerName}</span>}
                    </span>
                    <span className="mt-1 line-clamp-1 block text-sm text-muted-foreground">{e.message}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-line/10 p-5 lg:sticky lg:top-20 lg:self-start">
            {!active ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Select an enquiry to read it.</p>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-2xl font-extrabold">{active.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {copy.contact.roles[active.role]}
                      {active.organisation ? ` · ${active.organisation}` : ""} · {formatDate(active.createdAt, { dateStyle: "medium", timeStyle: "short" } as Intl.DateTimeFormatOptions)}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {active.status}
                  </Badge>
                </div>
                {active.playerId && (
                  <Link href={`/players/${active.playerId}`} target="_blank" className="block rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm">
                    About player: <span className="font-semibold">{active.playerName ?? active.playerId}</span>
                  </Link>
                )}
                <p className="whitespace-pre-line leading-relaxed">{active.message}</p>
                <div className="flex flex-wrap gap-2 border-t border-line/10 pt-4">
                  <Button asChild>
                    <a
                      href={`mailto:${active.email}?subject=${encodeURIComponent("Capital City FC: your enquiry")}`}
                      onClick={() => setStatus(active.id, "replied")}
                    >
                      <Mail /> Reply by email
                    </a>
                  </Button>
                  {active.phone && (
                    <Button variant="outline" asChild>
                      <a href={`tel:${active.phone}`}>
                        <Phone /> {active.phone}
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setStatus(active.id, "replied")}>
                    <MailCheck /> Mark replied
                  </Button>
                  <Button variant="ghost" onClick={() => setStatus(active.id, "archived")}>
                    <Archive /> Archive
                  </Button>
                  <ConfirmDelete
                    what="this enquiry"
                    onConfirm={async () => {
                      await removeDoc("enquiries", active.id)
                      setOpenId(null)
                    }}
                  />
                </div>
                <p className="font-mono text-xs text-muted-foreground">{active.email}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminPage>
  )
}
