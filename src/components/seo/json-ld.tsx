import type { JsonLdNode } from "@/lib/seo"

/**
 * Renders a schema.org graph as JSON-LD for crawlers.
 *
 * The payload is always built from trusted app data (never raw user input), and
 * `<` is escaped defensively so a stray character can never break out of the
 * script tag.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
}
