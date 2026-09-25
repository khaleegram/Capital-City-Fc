import type { Metadata } from "next"
import Link from "next/link"
import { ClipboardCheck, Eye, UploadCloud } from "lucide-react"
import { copy } from "@/lib/copy"
import { pageMetadata } from "@/lib/seo"
import { PageHero } from "@/components/site/page-hero"
import { JoinForm } from "./join-form"

export const metadata: Metadata = {
  ...pageMetadata("join", "/join"),
  // Shared privately with players, so keep it out of search results.
  robots: { index: false, follow: false },
}

const STEPS = [
  {
    icon: ClipboardCheck,
    title: "1. You fill this in",
    body: "Once, from your phone. Name, position, bio, strengths, plus your photo and any footage you have.",
  },
  {
    icon: UploadCloud,
    title: "2. Staff review it",
    body: "We check the details, confirm your squad number and publish it. If we can't use your submission, the files you uploaded are deleted.",
  },
  {
    icon: Eye,
    title: "3. Your profile goes live",
    body: "It appears on the Players page — the page scouts, clubs and parents actually look at.",
  },
]

export default function JoinPage() {
  return (
    <>
      <PageHero
        eyebrow="Player Sign-Up"
        title="Join the Squad."
        body="One form. Everything you enter here becomes your Capital City FC player profile — the same one scouts and clubs see when they open the site."
      />
      <div className="container grid gap-10 py-10 md:py-16 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
        <JoinForm />

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-line/10 p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-stamp text-mist/70">What happens next</h2>
            <ol className="mt-4 space-y-4">
              {STEPS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-signal" />
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-mist/75">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-3xl border border-line/10 p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-stamp text-mist/70">Need a hand?</h2>
            <p className="mt-3 text-sm leading-relaxed text-mist/80">
              Stuck on a question, or want to change something after submitting? Talk to the club and we&apos;ll sort it.
            </p>
            <p className="mt-3 text-sm font-semibold">{copy.brand.phone}</p>
            <p className="text-sm text-mist/75">{copy.brand.email}</p>
            <Link href="/contact" className="mt-4 inline-flex text-sm font-semibold text-ivory underline decoration-signal decoration-2 underline-offset-4">
              Send us a message
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}
