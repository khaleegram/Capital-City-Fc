import { getImageProps } from "next/image"
import { ART_MOBILE_MAX, type ArtDirection, type ArtSlot } from "@/lib/art-direction"

/**
 * Art direction: serving a different photo to phones than to desktops.
 *
 * `next/image` cannot switch files on a media query — it renders one `<img>`. The supported
 * way to do it is a `<picture>` element, and `getImageProps` is what turns a Next image into
 * the props that element needs.
 *
 * The mobile photo is always optional. When it is absent the desktop photo is served to
 * every screen size, so a hero only ever *has* to upload one image.
 */

type SlotOptions = {
  sizes: string
  width: number
  /** Only affects the intrinsic box; the crop is driven by `object-cover` in CSS. */
  height: number
  priority?: boolean
}

/**
 * Builds one slot. Kept as a plain function (rather than inline JSX) so the same maths can run
 * on the server for the client-rendered hero.
 */
export function artSlot(url: string, { sizes, width, height, priority = false }: SlotOptions): ArtSlot {
  const { props } = getImageProps({ src: url, alt: "", sizes, width, height, priority })

  return {
    src: props.src,
    srcSet: props.srcSet,
    sizes: props.sizes,
    loading: props.loading,
    fetchPriority: props.fetchPriority,
  }
}

type ArtImageProps = {
  desktop: string
  /** Omit for a single-image hero. Phones then get `desktop`. */
  mobile?: string
  alt: string
  sizes?: string
  width?: number
  height?: number
  /** Mobile art is usually portrait, so it gets its own intrinsic box. */
  mobileWidth?: number
  mobileHeight?: number
  /** The phone frame is often a different width, which changes the `sizes` hint. */
  mobileSizes?: string
  priority?: boolean
  /** Classes for the `<picture>` wrapper, which is what sits in the layout. */
  className?: string
  imgClassName?: string
}

/**
 * Renders a hero image, serving the mobile file to phones when one exists.
 *
 * Only one of the two images is fetched: the browser evaluates the `<source media>` and
 * ignores the other. The `<img>` is always last, as `<picture>` requires.
 */
export function ArtImage({
  desktop,
  mobile,
  alt,
  sizes = "100vw",
  width = 1920,
  height = 1080,
  mobileWidth = 1080,
  mobileHeight = 1920,
  mobileSizes,
  priority = false,
  className,
  imgClassName,
}: ArtImageProps) {
  const main = artSlot(desktop, { sizes, width, height, priority })
  const phone = mobile
    ? artSlot(mobile, { sizes: mobileSizes ?? sizes, width: mobileWidth, height: mobileHeight, priority })
    : null

  return (
    <>
      {/* Mirrors `<Image priority>`: only above-the-fold images get the hint. */}
      {priority && <ArtImagePreload art={{ desktop: main, mobile: phone ?? undefined }} sizes={mobileSizes ?? sizes} />}
      <picture className={className}>
        {phone && <source media={`(max-width: ${ART_MOBILE_MAX}px)`} srcSet={phone.srcSet} sizes={mobileSizes ?? sizes} />}
        <img {...main} alt={alt} className={imgClassName} />
      </picture>
    </>
  )
}

/**
 * Renders a `<picture>` from slots that were computed on the server.
 *
 * Needed because the homepage hero is a client component, so it cannot call `getImageProps`
 * itself.
 */
export function ArtImageFromSlots({
  art,
  alt,
  className,
  imgClassName,
}: {
  art: ArtDirection
  alt: string
  className?: string
  imgClassName?: string
}) {
  return (
    <picture className={className}>
      {art.mobile && (
        <source media={`(max-width: ${ART_MOBILE_MAX}px)`} srcSet={art.mobile.srcSet} sizes={art.mobile.sizes} />
      )}
      <img {...art.desktop} alt={alt} className={imgClassName} />
    </picture>
  )
}

/**
 * Restores the preload hint that `<Image priority>` emits.
 *
 * `next/image` calls React's preload during render, which is why the hero image used to be
 * requested from `<head>` before the body was parsed. A hand-built `<picture>` gets no such
 * hint, so the browser would not find the LCP image until it reached it in the body.
 *
 * Both slots are offered with complementary media queries: a phone must not be told to
 * preload the desktop file. With no mobile slot there is a single unrestricted hint, since
 * every screen is getting the same file.
 *
 * Render this from a Server Component so the links are hoisted into `<head>`.
 */
export function ArtImagePreload({ art, sizes }: { art: ArtDirection; sizes?: string }) {
  if (!art.mobile) {
    return (
      <link
        rel="preload"
        as="image"
        imageSrcSet={art.desktop.srcSet}
        imageSizes={sizes ?? art.desktop.sizes}
        fetchPriority="high"
      />
    )
  }

  return (
    <>
      <link
        rel="preload"
        as="image"
        imageSrcSet={art.desktop.srcSet}
        imageSizes={sizes ?? art.desktop.sizes}
        fetchPriority="high"
        media={`(min-width: ${ART_MOBILE_MAX + 1}px)`}
      />
      <link
        rel="preload"
        as="image"
        imageSrcSet={art.mobile.srcSet}
        imageSizes={sizes ?? art.mobile.sizes}
        fetchPriority="high"
        media={`(max-width: ${ART_MOBILE_MAX}px)`}
      />
    </>
  )
}

export { ART_MOBILE_MAX, type ArtDirection, type ArtSlot }
