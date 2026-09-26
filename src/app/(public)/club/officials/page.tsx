import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { copy } from "@/lib/copy"
import type { StaffMember } from "@/lib/data"
import { PAGE_SEO, pageGraph, pageMetadata } from "@/lib/seo"
import { getStaff } from "@/lib/server/queries"
import { JsonLd } from "@/components/seo/json-ld"
import { PageHero } from "@/components/site/page-hero"
import { EmptyNote } from "@/components/site/cards"
import { Reveal } from "@/components/brand/reveal"

export const revalidate = 60

export const metadata: Metadata = pageMetadata("officials", "/club/officials")

/**
 * Initials for an official with no portrait uploaded.
 *
 * Two letters, not three: this monogram sits in a 4:5 frame at display size, so it is a graphic
 * mark rather than a fallback badge, and two letters read as a crest where three read as an
 * abbreviation. An official without a photo is a normal state here — most of the roster will
 * arrive before the portraits do.
 */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

/**
 * One official, minus the `<li>` wrapper.
 *
 * The portrait is the only thing that changes shape across breakpoints: full width on a phone,
 * a fixed 11rem column above `sm`. `aspect-[4/5]` matches the frame the admin uploader already
 * crops to, so portraits upload without needing a second crop here.
 */
function Official({ member, index }: { member: StaffMember; index: number }) {
  return (
    <>
      <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-2xl border border-line/10 bg-horizon sm:w-44">
        {member.imageUrl ? (
          <Image
            src={member.imageUrl}
            alt={member.name}
            fill
            sizes="(min-width: 640px) 11rem, 100vw"
            className="object-cover object-top"
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center font-display text-6xl font-black tracking-tight text-mist/30 font-condensed"
          >
            {initials(member.name)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tabular-nums text-mist/40">{String(index + 1).padStart(2, "0")}</span>
          <span aria-hidden className="h-px w-5 bg-signal" />
          <span className="font-mono text-[10px] uppercase tracking-stamp text-signal">{member.role}</span>
        </div>

        <h3 className="mt-2 font-display text-3xl font-black uppercase leading-[0.9] tracking-tight font-condensed sm:text-4xl">
          {member.name}
        </h3>

        {member.quote ? (
          <p className="mt-3 text-base italic leading-relaxed text-mist/85">&ldquo;{member.quote}&rdquo;</p>
        ) : member.bio ? (
          <p className="mt-3 text-base leading-relaxed text-mist/80">{member.bio}</p>
        ) : null}

        {member.licences && member.licences.length > 0 && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-mist/70">{member.licences.join(" · ")}</p>
        )}
      </div>
    </>
  )
}

export default async function OfficialsPage() {
  const staff = await getStaff()
  const officials = staff.filter((s) => s.group === "management" && s.published)

  return (
    <>
      <JsonLd
        data={pageGraph({
          path: "/club/officials",
          name: PAGE_SEO.officials.title,
          description: PAGE_SEO.officials.description,
          type: "AboutPage",
          trail: [{ name: copy.officials.eyebrow, path: "/club" }],
        })}
      />
      <PageHero eyebrow={copy.officials.eyebrow} title={copy.officials.title} body={copy.officials.body} />

      <section className="container max-w-3xl py-10 md:py-16">
        {officials.length === 0 ? (
          <EmptyNote>{copy.officials.empty}</EmptyNote>
        ) : (
          <>
            {/* Same counted rule as the fixtures page, so the two rosters read as one system. */}
            <h2 className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-stamp text-mist/70">
              <span>{copy.officials.roster}</span>
              <span aria-hidden className="h-px flex-1 bg-line/10" />
              <span className="tabular-nums text-mist/45">{officials.length}</span>
            </h2>

            {/*
              `Reveal` renders a div, so it goes *inside* each li rather than wrapping it —
              a div between a ul and its li is invalid and breaks the `divide-y` hairlines.
            */}
            <ul className="mt-8 divide-y divide-line/10 border-y border-line/10">
              {officials.map((m, i) => (
                <li key={m.id} className="py-8 first:pt-0 last:pb-0">
                  <Reveal delay={i * 0.04} className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
                    <Official member={m} index={i} />
                  </Reveal>
                </li>
              ))}
            </ul>
          </>
        )}

        <Link href="/club" className="group mt-12 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ivory">
          <ArrowLeft className="h-4 w-4 text-signal transition-transform group-hover:-translate-x-0.5" />
          {copy.officials.back}
        </Link>
      </section>
    </>
  )
}
