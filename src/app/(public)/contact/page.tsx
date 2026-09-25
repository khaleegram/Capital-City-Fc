import type { Metadata } from "next"
import { Suspense } from "react"
import { Mail, MapPin, Phone } from "lucide-react"
import { copy } from "@/lib/copy"
import { PAGE_SEO, pageGraph, pageMetadata } from "@/lib/seo"
import { JsonLd } from "@/components/seo/json-ld"
import { PageHero } from "@/components/site/page-hero"
import { EnquiryForm } from "./enquiry-form"

export const metadata: Metadata = pageMetadata("contact", "/contact")

export default function ContactPage() {
  return (
    <>
      <JsonLd data={pageGraph({ path: "/contact", name: PAGE_SEO.contact.title, description: PAGE_SEO.contact.description, type: "ContactPage" })} />
      <PageHero eyebrow={copy.contact.eyebrow} title={copy.contact.title} body={copy.contact.body} />
      <div className="container grid gap-12 py-10 md:py-16 lg:grid-cols-[1.4fr_1fr]">
        <Suspense>
          <EnquiryForm />
        </Suspense>
        <aside className="space-y-3">
          {[
            { icon: Mail, label: "Email", value: copy.brand.email, href: `mailto:${copy.brand.email}` },
            { icon: Phone, label: "Phone / WhatsApp", value: copy.brand.phone, href: `tel:${copy.brand.phone.replace(/\s/g, "")}` },
            { icon: MapPin, label: "Office", value: copy.brand.address },
          ].map(({ icon: Icon, label, value, href }) => {
            const body = (
              <div className="flex items-start gap-4 rounded-2xl border border-line/10 p-4">
                <Icon className="mt-0.5 h-5 w-5 text-signal" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist/75">{label}</p>
                  <p className="mt-0.5 font-semibold">{value}</p>
                </div>
              </div>
            )
            return href ? (
              <a key={label} href={href} className="block hover:opacity-90">
                {body}
              </a>
            ) : (
              <div key={label}>{body}</div>
            )
          })}
          <p className="pt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mist/72">{copy.brand.legal}</p>
        </aside>
      </div>
    </>
  )
}
