"""
Capital City FC — Letterhead v3
Agency-grade rebuild. No Word-template DNA.
"""

from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\User\Desktop\Projects\Capital-City-Fc\assets\brand")
FONTS = ROOT / "fonts"
CREST = ROOT / "capital-city-fc-crest-transparent.png"

OUT_PDF = ROOT / "CCFC-Letterhead.pdf"
OUT_BLANK = ROOT / "CCFC-Letterhead-blank.pdf"
OUT_PNG = ROOT / "CCFC-Letterhead-preview.png"
OUT_HTML = ROOT / "CCFC-Letterhead.html"

PAGE_W, PAGE_H = A4

NAVY = (0.039, 0.086, 0.188)   # #0A1630
INK = (0.086, 0.110, 0.153)    # #161C27
MUTED = (0.400, 0.435, 0.490)  # #666F7D
RULE = (0.860, 0.870, 0.885)   # #DBDEE2
RED = (0.890, 0.024, 0.075)    # #E30613


def register_fonts():
    files = {
        "outfit-light": "Outfit-Light.ttf",
        "outfit-reg": "Outfit-Regular.ttf",
        "outfit-med": "Outfit-Medium.ttf",
        "outfit-semi": "Outfit-SemiBold.ttf",
        "outfit-bold": "Outfit-Bold.ttf",
        "news-reg": "Newsreader-Regular.ttf",
        "news-med": "Newsreader-Medium.ttf",
        "news-italic": "Newsreader-Italic.ttf",
    }
    names = {}
    for key, filename in files.items():
        name = key
        pdfmetrics.registerFont(TTFont(name, str(FONTS / filename)))
        names[key] = name
    return names


def spaced(c, text, x, y, font, size, color, tracking, align="left"):
    c.setFont(font, size)
    c.setFillColorRGB(*color)
    gap = size * tracking
    widths = [c.stringWidth(ch, font, size) for ch in text]
    total = sum(widths) + gap * max(0, len(text) - 1)
    cursor = x if align == "left" else (x - total if align == "right" else x - total / 2)
    for ch, w in zip(text, widths):
        c.drawString(cursor, y, ch)
        cursor += w + gap
    return total


def build_pdf(path: Path, fonts: dict, sample: bool):
    c = canvas.Canvas(str(path), pagesize=A4)

    # Hairline navy edge — not a chunky bar
    c.setFillColorRGB(*NAVY)
    c.rect(0, PAGE_H - 1.1 * mm, PAGE_W, 1.1 * mm, stroke=0, fill=1)

    mx = 20 * mm
    top = PAGE_H - 16 * mm

    # LEFT: crest
    crest = 38 * mm
    c.drawImage(
        ImageReader(str(CREST)),
        mx, top - crest,
        width=crest, height=crest,
        mask="auto", preserveAspectRatio=True,
    )

    # Wordmark directly under crest — one lockup unit
    mark_x = mx
    mark_y = top - crest - 7 * mm
    spaced(c, "CAPITAL CITY", mark_x, mark_y, fonts["outfit-semi"], 11, NAVY, 0.26)
    spaced(c, "FOOTBALL CLUB", mark_x, mark_y - 4.4 * mm, fonts["outfit-med"], 6.8, MUTED, 0.42)

    # Red tick — crest ring echo, short and decisive
    c.setStrokeColorRGB(*RED)
    c.setLineWidth(1.1)
    tick_y = mark_y - 7.2 * mm
    c.line(mark_x, tick_y, mark_x + 16 * mm, tick_y)

    c.setFont(fonts["outfit-reg"], 6.2)
    c.setFillColorRGB(*MUTED)
    c.drawString(mark_x, tick_y - 4 * mm, "Capital City FC Ltd  ·  RC 1838954")

    # RIGHT: contact — quiet, no fake section labels
    rx = PAGE_W - mx
    cy = top - 1 * mm
    contact = [
        (fonts["outfit-light"], 7.5, MUTED, "Suite 33.2, Moshood Abiola Way"),
        (fonts["outfit-light"], 7.5, MUTED, "National Stadium, Abuja"),
        (fonts["outfit-light"], 7.5, MUTED, "Nigeria"),
        None,
        (fonts["outfit-med"], 8, INK, "0807 600 2414"),
        (fonts["outfit-med"], 8, INK, "info@capitalcityfc.ng"),
    ]
    for item in contact:
        if item is None:
            cy -= 2.4 * mm
            continue
        font, size, color, text = item
        c.setFont(font, size)
        c.setFillColorRGB(*color)
        c.drawRightString(rx, cy, text)
        cy -= 3.55 * mm

    # Structural hairline — full measure, very light
    base = min(tick_y - 8 * mm, cy - 4 * mm)
    c.setStrokeColorRGB(*RULE)
    c.setLineWidth(0.4)
    c.line(mx, base, rx, base)

    # BODY
    body_top = base - 11 * mm
    measure = PAGE_W - 2 * mx

    if sample:
        c.setFont(fonts["outfit-reg"], 8)
        c.setFillColorRGB(*MUTED)
        c.drawString(mx, body_top, "5 August 2026")

        y = body_top - 9 * mm
        c.setFont(fonts["news-reg"], 10.5)
        c.setFillColorRGB(*INK)
        for line in [
            "The Honourable Minister",
            "Federal Ministry of Youth & Sports Development",
            "Federal Secretariat Complex",
            "Abuja, FCT",
        ]:
            c.drawString(mx, y, line)
            y -= 4.6 * mm

        y -= 6.5 * mm
        c.setFont(fonts["news-italic"], 10.5)
        c.drawString(mx, y, "Dear Honourable Minister,")

        y -= 8 * mm
        c.setFont(fonts["news-reg"], 10.5)
        paras = [
            "Capital City Football Club writes with respect to our continued development programme within the Federal Capital Territory. We remain committed to building a professionally run club that reflects the standards of Abuja as Nigeria’s capital.",
            "We would welcome the opportunity to brief your office on our community outreach, academy pathway, and plans for competitive participation in the coming season. Our Director stands ready to provide any further information required.",
        ]
        leading = 5.3 * mm
        for para in paras:
            cur = ""
            for w in para.split():
                trial = (cur + " " + w).strip()
                if c.stringWidth(trial, fonts["news-reg"], 10.5) <= measure:
                    cur = trial
                else:
                    c.drawString(mx, y, cur)
                    y -= leading
                    cur = w
            if cur:
                c.drawString(mx, y, cur)
                y -= leading
            y -= 3.2 * mm

        y -= 3 * mm
        c.setFont(fonts["news-reg"], 10.5)
        c.drawString(mx, y, "Yours faithfully,")

        y -= 15 * mm
        c.setFont(fonts["outfit-semi"], 9.5)
        c.setFillColorRGB(*NAVY)
        c.drawString(mx, y, "Abdulrahaman Umar Baba")
        c.setFont(fonts["outfit-reg"], 7.5)
        c.setFillColorRGB(*MUTED)
        c.drawString(mx, y - 4 * mm, "Director, Capital City Football Club")
    else:
        c.setFillColorRGB(0.9, 0.91, 0.92)
        c.setFont(fonts["outfit-reg"], 8)
        c.drawString(mx, body_top, "Date")
        c.drawString(mx, body_top - 12 * mm, "Recipient")
        c.drawString(mx, body_top - 30 * mm, "Body")

    # FOOTER — quiet, no heavy band
    fy = 12 * mm
    c.setStrokeColorRGB(*RULE)
    c.setLineWidth(0.35)
    c.line(mx, fy + 5 * mm, rx, fy + 5 * mm)

    # Tiny red square mark — brand punctuation
    c.setFillColorRGB(*RED)
    c.rect(mx, fy + 0.4 * mm, 1.4 * mm, 1.4 * mm, stroke=0, fill=1)

    c.setFont(fonts["outfit-reg"], 6)
    c.setFillColorRGB(*MUTED)
    c.drawString(mx + 3.2 * mm, fy + 0.5 * mm, "Official correspondence  ·  Capital City FC Ltd  ·  RC 1838954")
    c.drawRightString(rx, fy + 0.5 * mm, "Abuja, Nigeria")

    c.showPage()
    c.save()


def build_png():
    dpi = 200
    s = dpi / 72.0
    w, h = int(PAGE_W * s), int(PAGE_H * s)
    img = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(img)

    def F(name, pt):
        return ImageFont.truetype(str(FONTS / name), int(pt * s))

    def spaced_pil(text, x, y, font, fill, tracking, align="left"):
        gap = font.size * tracking
        widths = [d.textbbox((0, 0), ch, font=font)[2] for ch in text]
        total = sum(widths) + gap * max(0, len(text) - 1)
        cursor = x if align == "left" else x - total
        for ch, cw in zip(text, widths):
            d.text((cursor, y), ch, font=font, fill=fill)
            cursor += cw + gap

    navy, muted, ink, red, rule = (10, 22, 48), (102, 111, 125), (22, 28, 39), (227, 6, 19), (219, 222, 226)

    d.rectangle([0, 0, w, int(1.1 * mm * s)], fill=navy)

    mx = int(20 * mm * s)
    top = int(16 * mm * s)
    crest_s = int(38 * mm * s)
    crest = Image.open(CREST).convert("RGBA").resize((crest_s, crest_s), Image.Resampling.LANCZOS)
    img.paste(crest, (mx, top), crest)

    mark_y = top + crest_s + int(5 * mm * s)
    spaced_pil("CAPITAL CITY", mx, mark_y, F("Outfit-SemiBold.ttf", 11), navy, 0.26)
    spaced_pil("FOOTBALL CLUB", mx, mark_y + int(4.4 * mm * s), F("Outfit-Medium.ttf", 6.8), muted, 0.42)

    tick_y = mark_y + int(8.2 * mm * s)
    d.line([(mx, tick_y), (mx + int(16 * mm * s), tick_y)], fill=red, width=max(2, int(1.1 * s)))
    d.text((mx, tick_y + int(2.2 * mm * s)), "Capital City FC Ltd  ·  RC 1838954", font=F("Outfit-Regular.ttf", 6.2), fill=muted)

    rx = w - mx
    cy = top
    for item in [
        ("Suite 33.2, Moshood Abiola Way", "Outfit-Light.ttf", 7.5, muted),
        ("National Stadium, Abuja", "Outfit-Light.ttf", 7.5, muted),
        ("Nigeria", "Outfit-Light.ttf", 7.5, muted),
        None,
        ("0807 600 2414", "Outfit-Medium.ttf", 8, ink),
        ("info@capitalcityfc.ng", "Outfit-Medium.ttf", 8, ink),
    ]:
        if item is None:
            cy += int(2.4 * mm * s)
            continue
        text, ff, sz, col = item
        f = F(ff, sz)
        bb = d.textbbox((0, 0), text, font=f)
        d.text((rx - (bb[2] - bb[0]), cy), text, font=f, fill=col)
        cy += int(3.55 * mm * s)

    base = tick_y + int(8 * mm * s)
    d.line([(mx, base), (rx, base)], fill=rule, width=max(1, int(0.4 * s)))

    body_top = base + int(11 * mm * s)
    d.text((mx, body_top), "5 August 2026", font=F("Outfit-Regular.ttf", 8), fill=muted)

    y = body_top + int(9 * mm * s)
    news = F("Newsreader-Regular.ttf", 10.5)
    for line in [
        "The Honourable Minister",
        "Federal Ministry of Youth & Sports Development",
        "Federal Secretariat Complex",
        "Abuja, FCT",
    ]:
        d.text((mx, y), line, font=news, fill=ink)
        y += int(4.6 * mm * s)

    y += int(6.5 * mm * s)
    d.text((mx, y), "Dear Honourable Minister,", font=F("Newsreader-Italic.ttf", 10.5), fill=ink)
    y += int(8 * mm * s)

    measure = w - 2 * mx
    for para in [
        "Capital City Football Club writes with respect to our continued development programme within the Federal Capital Territory. We remain committed to building a professionally run club that reflects the standards of Abuja as Nigeria’s capital.",
        "We would welcome the opportunity to brief your office on our community outreach, academy pathway, and plans for competitive participation in the coming season. Our Director stands ready to provide any further information required.",
    ]:
        cur = ""
        for word in para.split():
            trial = (cur + " " + word).strip()
            if d.textbbox((0, 0), trial, font=news)[2] <= measure:
                cur = trial
            else:
                d.text((mx, y), cur, font=news, fill=ink)
                y += int(5.3 * mm * s)
                cur = word
        if cur:
            d.text((mx, y), cur, font=news, fill=ink)
            y += int(5.3 * mm * s)
        y += int(3.2 * mm * s)

    y += int(3 * mm * s)
    d.text((mx, y), "Yours faithfully,", font=news, fill=ink)
    y += int(15 * mm * s)
    d.text((mx, y), "Abdulrahaman Umar Baba", font=F("Outfit-SemiBold.ttf", 9.5), fill=navy)
    y += int(4 * mm * s)
    d.text((mx, y), "Director, Capital City Football Club", font=F("Outfit-Regular.ttf", 7.5), fill=muted)

    fy = h - int(12 * mm * s)
    d.line([(mx, fy - int(5 * mm * s)), (rx, fy - int(5 * mm * s))], fill=rule, width=max(1, int(0.35 * s)))
    sq = int(1.4 * mm * s)
    d.rectangle([mx, fy - sq, mx + sq, fy], fill=red)
    d.text((mx + int(3.2 * mm * s), fy - sq), "Official correspondence  ·  Capital City FC Ltd  ·  RC 1838954", font=F("Outfit-Regular.ttf", 6), fill=muted)
    foot_r = "Abuja, Nigeria"
    fr = F("Outfit-Regular.ttf", 6)
    bb = d.textbbox((0, 0), foot_r, font=fr)
    d.text((rx - (bb[2] - bb[0]), fy - sq), foot_r, font=fr, fill=muted)

    img.save(OUT_PNG, "PNG", dpi=(dpi, dpi))


def write_html():
    OUT_HTML.write_text("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Capital City FC — Letterhead</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 0; }
  :root {
    --navy: #0A1630;
    --ink: #161C27;
    --muted: #666F7D;
    --rule: #DBDEE2;
    --red: #E30613;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #b8bec8; font-family: Outfit, sans-serif; -webkit-font-smoothing: antialiased; }
  .stage { padding: 48px 0 64px; }
  .sheet {
    width: 210mm; height: 297mm; margin: 0 auto; background: #fff; position: relative;
    box-shadow: 0 40px 100px rgba(10,22,48,.35);
  }
  .edge { height: 1.1mm; background: var(--navy); }
  .pad { padding: 14mm 20mm 16mm; height: calc(297mm - 1.1mm); position: relative; }
  .mast {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 16mm; padding-bottom: 9mm; border-bottom: 0.4pt solid var(--rule); margin-bottom: 11mm;
  }
  .brand { width: 52mm; }
  .crest { width: 38mm; height: 38mm; display: block; margin-bottom: 5mm; }
  .primary {
    font-weight: 600; font-size: 11pt; letter-spacing: 0.26em; color: var(--navy);
    line-height: 1; margin-left: -0.04em;
  }
  .secondary {
    margin-top: 2.8mm; font-weight: 500; font-size: 6.8pt; letter-spacing: 0.42em;
    color: var(--muted); line-height: 1;
  }
  .tick { width: 16mm; height: 1.1pt; background: var(--red); margin: 3.6mm 0 2.6mm; border: 0; }
  .legal { font-size: 6.2pt; color: var(--muted); }
  .contact { text-align: right; padding-top: 1mm; min-width: 52mm; }
  .contact address {
    font-style: normal; font-weight: 300; font-size: 7.5pt; line-height: 1.55; color: var(--muted);
  }
  .contact .reach {
    margin-top: 3.2mm; font-weight: 500; font-size: 8pt; line-height: 1.55; color: var(--ink);
  }
  .date { font-size: 8pt; color: var(--muted); margin-bottom: 9mm; }
  .recipient, .salutation, .body, .closing {
    font-family: Newsreader, Georgia, serif; font-size: 10.5pt; color: var(--ink); line-height: 1.5;
  }
  .recipient { margin-bottom: 6.5mm; }
  .salutation { font-style: italic; margin-bottom: 8mm; }
  .body p { margin-bottom: 3.2mm; }
  .closing { margin: 6mm 0 14mm; }
  .name { font-family: Outfit, sans-serif; font-weight: 600; font-size: 9.5pt; color: var(--navy); }
  .role { font-family: Outfit, sans-serif; font-size: 7.5pt; color: var(--muted); margin-top: 1.6mm; }
  footer {
    position: absolute; left: 20mm; right: 20mm; bottom: 12mm;
    border-top: 0.35pt solid var(--rule); padding-top: 3.2mm;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 6pt; color: var(--muted);
  }
  footer .mark {
    width: 1.4mm; height: 1.4mm; background: var(--red); display: inline-block;
    margin-right: 2.2mm; vertical-align: middle;
  }
  @media print {
    body, .stage { background: #fff; padding: 0; }
    .sheet { box-shadow: none; }
  }
</style>
</head>
<body>
<div class="stage">
  <article class="sheet">
    <div class="edge"></div>
    <div class="pad">
      <header class="mast">
        <div class="brand">
          <img class="crest" src="capital-city-fc-crest-transparent.png" alt="Capital City FC" />
          <div class="primary">CAPITAL CITY</div>
          <div class="secondary">FOOTBALL CLUB</div>
          <div class="tick"></div>
          <div class="legal">Capital City FC Ltd  ·  RC 1838954</div>
        </div>
        <div class="contact">
          <address>
            Suite 33.2, Moshood Abiola Way<br />
            National Stadium, Abuja<br />
            Nigeria
          </address>
          <div class="reach">
            0807 600 2414<br />
            info@capitalcityfc.ng
          </div>
        </div>
      </header>

      <div class="date">5 August 2026</div>
      <div class="recipient">
        The Honourable Minister<br />
        Federal Ministry of Youth &amp; Sports Development<br />
        Federal Secretariat Complex<br />
        Abuja, FCT
      </div>
      <div class="salutation">Dear Honourable Minister,</div>
      <div class="body">
        <p>Capital City Football Club writes with respect to our continued development programme within the Federal Capital Territory. We remain committed to building a professionally run club that reflects the standards of Abuja as Nigeria’s capital.</p>
        <p>We would welcome the opportunity to brief your office on our community outreach, academy pathway, and plans for competitive participation in the coming season. Our Director stands ready to provide any further information required.</p>
      </div>
      <div class="closing">Yours faithfully,</div>
      <div class="name">Abdulrahaman Umar Baba</div>
      <div class="role">Director, Capital City Football Club</div>

      <footer>
        <span><span class="mark"></span>Official correspondence  ·  Capital City FC Ltd  ·  RC 1838954</span>
        <span>Abuja, Nigeria</span>
      </footer>
    </div>
  </article>
</div>
</body>
</html>
""", encoding="utf-8")


def main():
    fonts = register_fonts()
    build_pdf(OUT_PDF, fonts, True)
    build_pdf(OUT_BLANK, fonts, False)
    build_png()
    write_html()
    print("done", OUT_PDF, OUT_PNG)


if __name__ == "__main__":
    main()
