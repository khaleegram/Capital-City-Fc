import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Award, Flag, Trophy } from "lucide-react"
import { copy } from "@/lib/copy"
import type { StaffGroup } from "@/lib/data"
import { TEAM_LOGO_URL } from "@/lib/brand"
import { getAchievements, getJourneys, getProofStats, getStaff } from "@/lib/server/queries"
import { PageHero } from "@/components/site/page-hero"
import { ProofStrip } from "@/components/site/proof-strip"
import { SectionHeading } from "@/components/brand/section-heading"
import { Reveal } from "@/components/brand/reveal"
import { CoordStamp } from "@/components/brand/coord-stamp"
import { Button } from "@/components/ui/button"

export const revalidate = 60

export const metadata: Metadata = { title: copy.club.eyebrow, description: copy.club.body }

const GROUP_LABEL: Record<StaffGroup, string> = {
  management: "Management",
  coaching: "Coaching",
  operations: "Operations",
  medical: "Medical & Performance",
}

export default async function ClubPage() {
  const [staff, achievements, proof, journeys] = await Promise.all([getStaff(), getAchievements(), getProofStats(), getJourneys()])
  const groups = (Object.keys(GROUP_LABEL) as StaffGroup[])
    .map((g) => ({ g, people: staff.filter((s) => s.group === g) }))
    .filter((x) => x.people.length)
  const journeySlug = new Map(journeys.map((j) => [j.id, j.slug]))
  const hasProof = Object.values(proof).some((n) => n > 0)

  return (
    <>
      <PageHero eyebrow={copy.club.eyebrow} title={copy.club.title} body={copy.club.body}>
        <CoordStamp code={copy.brand.origin.code} lat={copy.brand.origin.lat} lng={copy.brand.origin.lng} />
      </PageHero>

      {/* Model */}
      <section className="container grid gap-10 py-14 md:grid-cols-[1fr_1.2fr] md:items-center md:py-20">
        <Reveal>
          <div className="relative mx-auto aspect-square w-full max-w-sm">
            <div className="absolute inset-0 rounded-full border border-line/10" />
            <div className="absolute inset-8 rounded-full border border-dashed border-line/15" />
            <div className="absolute inset-16 rounded-full border border-signal/40" />
            <Image src={TEAM_LOGO_URL} alt={copy.brand.name} fill sizes="384px" className="object-contain p-24" />
            {["Identify", "Develop", "Expose", "Place"].map((w, i) => {
              const angle = (i / 4) * Math.PI * 2 - Math.PI / 2
              return (
                <span
                  key={w}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper px-2 font-mono text-[10px] uppercase tracking-stamp text-mist"
                  style={{ left: `${50 + Math.cos(angle) * 50}%`, top: `${50 + Math.sin(angle) * 50}%` }}
                >
                  {w}
                </span>
              )
            })}
          </div>
        </Reveal>
        <Reveal>
          <SectionHeading eyebrow="The model" title="Developed Here. Competing Everywhere." body={copy.home.pathwayBody} />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {copy.club.values.map((v) => (
              <li key={v.title} className="rounded-2xl border border-line/10 p-4">
                <p className="font-display text-xl font-extrabold uppercase font-condensed">{v.title}</p>
                <p className="mt-1 text-sm text-mist/80">{v.body}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* Seven-month cycle */}
      <section className="border-y border-line/10 bg-paper py-14 md:py-20">
        <div className="container">
          <Reveal>
            <SectionHeading eyebrow="Seven months" title={copy.club.cycleTitle} />
          </Reveal>
          <ol className="mt-10 grid gap-3 md:grid-cols-5">
            {copy.club.cycle.map((c, i) => (
              <li key={c.month}>
                <Reveal delay={i * 0.04} className="h-full">
                  <div className="relative h-full overflow-hidden rounded-2xl border border-line/10 bg-paper p-5">
                    <div className="absolute inset-x-0 top-0 h-1 bg-line/10">
                      <div className="h-full bg-signal" style={{ width: `${((i + 1) / copy.club.cycle.length) * 100}%` }} />
                    </div>
                    <p className="font-mono text-xs font-bold tracking-[0.2em] text-signal">{c.month}</p>
                    <p className="mt-3 font-display text-2xl font-black uppercase leading-none font-condensed">{c.title}</p>
                    <p className="mt-2 text-sm text-mist/80">{c.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {hasProof && (
        <section className="container py-14">
          <ProofStrip stats={proof} />
        </section>
      )}

      {/* Management & staff */}
      {groups.length > 0 && (
        <section className="container py-14 md:py-20">
          <Reveal>
            <SectionHeading eyebrow="People" title={copy.club.management} />
          </Reveal>
          <div className="mt-10 space-y-10">
            {groups.map(({ g, people }) => (
              <div key={g}>
                <h3 className="mb-4 font-mono text-[11px] uppercase tracking-stamp text-mist/70">{GROUP_LABEL[g]}</h3>
                <ul className={g === "management" ? "grid gap-4 md:grid-cols-2" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"}>
                  {people.map((s) =>
                    g === "management" ? (
                      <li key={s.id} className="flex gap-4 rounded-3xl border border-line/10 bg-paper p-4">
                        <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-navy-soft">
                          {s.imageUrl && <Image src={s.imageUrl} alt={s.name} fill sizes="96px" className="object-cover object-top" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">{s.role}</p>
                          <p className="mt-1 font-display text-2xl font-black uppercase leading-none font-condensed">{s.name}</p>
                          {s.quote ? (
                            <p className="mt-2 text-sm italic text-mist/85">&ldquo;{s.quote}&rdquo;</p>
                          ) : (
                            s.bio && <p className="mt-2 line-clamp-3 text-sm text-mist/80">{s.bio}</p>
                          )}
                          {s.licences && s.licences.length > 0 && (
                            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mist/75">{s.licences.join(" · ")}</p>
                          )}
                        </div>
                      </li>
                    ) : (
                      <li key={s.id} className="overflow-hidden rounded-2xl border border-line/10 bg-paper">
                        <div className="relative aspect-[4/5] bg-navy-soft">
                          {s.imageUrl && <Image src={s.imageUrl} alt={s.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover object-top" />}
                        </div>
                        <div className="p-3">
                          <p className="font-semibold leading-tight">{s.name}</p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist/75">{s.role}</p>
                        </div>
                      </li>
                    )
                  )}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Honours */}
      {achievements.length > 0 && (
        <section className="container py-14 md:py-20">
          <Reveal>
            <SectionHeading eyebrow="Record" title={copy.club.achievements} />
          </Reveal>
          <ol className="mt-10 divide-y divide-white/10 overflow-hidden rounded-3xl border border-line/10">
            {achievements.map((a) => {
              const Icon = a.kind === "trophy" ? Trophy : a.kind === "unbeaten" ? Flag : Award
              const slug = a.journeyId ? journeySlug.get(a.journeyId) : undefined
              const inner = (
                <div className="flex items-center gap-4 p-4 sm:p-5">
                  <span className="font-display text-3xl font-black tabular-nums text-mist/70 font-condensed">{a.year}</span>
                  <Icon className="h-5 w-5 shrink-0 text-signal" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.title}</p>
                    {(a.competition || a.detail) && <p className="text-sm text-mist/75">{[a.competition, a.detail].filter(Boolean).join(" · ")}</p>}
                  </div>
                  {slug && <ArrowUpRight className="h-4 w-4 shrink-0 text-signal" />}
                </div>
              )
              return <li key={a.id}>{slug ? <Link href={`/journeys/${slug}`} className="block hover:bg-line/[0.03]">{inner}</Link> : inner}</li>
            })}
          </ol>
        </section>
      )}

      <section className="container py-10">
        <div className="flex flex-col items-start gap-4 rounded-3xl border border-line/10 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-2xl font-black uppercase font-condensed">Partner with the next journey.</p>
            <p className="text-sm text-mist/80">Sponsors, clubs and academies. Let&apos;s build the route together.</p>
          </div>
          <Button asChild size="lg">
            <Link href="/contact?role=partner">Talk to us</Link>
          </Button>
        </div>
      </section>
    </>
  )
}
