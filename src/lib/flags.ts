/**
 * Country flags, used as a stand-in crest for opponents with no published badge.
 *
 * Served by flagcdn, which keys flags by ISO 3166-1 alpha-2 (`ng`, `se`, `dk`). PNG only —
 * `next/image` refuses SVG here (see `images.remotePatterns`), and the flagcdn host is allowed
 * as an image source in `next.config.ts`.
 *
 * The UK is the exception flagcdn makes for football: England, Scotland, Wales and Northern
 * Ireland have their own flags, keyed `gb-eng`, `gb-sct`, `gb-wls` and `gb-nir`.
 */

/** Every ISO 3166-1 alpha-2 code. The single source of truth for what `flagUrl` accepts. */
const ISO_ALPHA2 =
  'ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ' +
  'ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo ' +
  'fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je ' +
  'jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo ' +
  'mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw ' +
  'py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm ' +
  'tn to tr tt tv tw tz ua ug um us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw';

const ALPHA2 = new Set(ISO_ALPHA2.split(' '));

/**
 * The four football nations that exist as flagcdn subdivisions rather than countries.
 *
 * Named explicitly because `Intl.DisplayNames` only understands region codes: asked for
 * `gb-eng` it returns undefined, and a bare `gb` would give the Union Jack, which is not the
 * flag an England fixture should fly.
 */
const UK_HOME_NATIONS: Record<string, string> = {
  'gb-eng': 'England',
  'gb-sct': 'Scotland',
  'gb-wls': 'Wales',
  'gb-nir': 'Northern Ireland',
};

export type Country = { code: string; name: string };

/**
 * English names come from `Intl.DisplayNames` rather than a hand-kept table: it ships with the
 * runtime, so there is no list to drift out of date, and no 250-line data file to maintain
 * alongside the code list above.
 */
const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

function englishName(code: string): string {
  const upper = code.toUpperCase();
  return regionNames?.of(upper) ?? upper;
}

/** Every place a fixture can be flagged as, sorted for the admin picker. */
export const COUNTRIES: readonly Country[] = [
  ...[...ALPHA2].map((code) => ({ code, name: englishName(code) })),
  ...Object.entries(UK_HOME_NATIONS).map(([code, name]) => ({ code, name })),
].sort((a, b) => a.name.localeCompare(b.name));

const CODE = /^[a-z]{2}(-[a-z]{3})?$/;

/** The one host flags are served from — see the note at the top of this file. */
const FLAG_HOST = 'flagcdn.com';

/**
 * True when a stored logo URL is a country flag rather than a club's own crest.
 *
 * A flag is a stand-in, so the two have to be tellable apart: a fixture showing a real crest
 * must never have it overwritten by a flag, while one showing a flag — possibly the wrong one —
 * should be correctable by picking another. The host is the whole test, and it is what
 * `.fixtures-flags.mts` relies on too.
 */
export function isFlagUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.includes(FLAG_HOST));
}

/**
 * Reads the country code back out of a flag URL.
 *
 * The inverse of `flagUrl`, and the only way to name a flag that is already stored on a
 * fixture: the URL is all there is, with no country name kept alongside it.
 */
export function flagCodeIn(url: string | null | undefined): string | null {
  if (!isFlagUrl(url)) return null;
  return url!.match(/\/([a-z]{2}(?:-[a-z]{3})?)\.png$/)?.[1] ?? null;
}

/**
 * Public flag URL for an ISO code, or null when the code isn't one flagcdn can serve.
 *
 * `width` selects flagcdn's size variant. The picker asks for the 40px file for its 253 row
 * thumbnails — pulling a 320px flag per row would be several megabytes for a list nobody
 * scrolls to the end of.
 *
 * Rejecting unknown codes matters: a hallucinated code from the model would 404 inside
 * `<Image>` and read as a broken image, where returning null keeps the monogram instead.
 */
export function flagUrl(code: string | null | undefined, width = 320): string | null {
  const c = (code ?? '').trim().toLowerCase();
  if (!CODE.test(c)) return null;
  if (c.length === 2 ? !ALPHA2.has(c) : !(c in UK_HOME_NATIONS)) return null;
  return `https://${FLAG_HOST}/w${width}/${c}.png`;
}
