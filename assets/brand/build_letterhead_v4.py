"""
Capital City FC — Letterhead v4
Navy masthead system. Built for an illustrated crest, not a flat tech mark.
"""

from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path(r"C:\Users\User\Desktop\Projects\Capital-City-Fc\assets\brand")
FONTS = ROOT / "fonts"
CREST = ROOT / "capital-city-fc-crest-transparent.png"

OUT_PDF = ROOT / "CCFC-Letterhead.pdf"
OUT_BLANK = ROOT / "CCFC-Letterhead-blank.pdf"
OUT_PNG = ROOT / "CCFC-Letterhead-preview.png"
OUT_HTML = ROOT / "CCFC-Letterhead.html"

PAGE_W, PAGE_H = A4

NAVY = (0.039, 0.086, 0.188)
NAVY2 = (0.055, 0.110, 0.235)
INK = (0.086, 0.110, 0.153)
MUTED = (0.400, 0.435, 0.490)
RULE = (0.855, 0.865, 0.880)
RED = (0.890, 0.024, 0.075)
WHITE = (1, 1, 1)
MIST = (0.78, 0.82, 0.88)


def register_fonts():
    files = {
        "ol": "Outfit-Light.ttf",
        "or": "Outfit-Regular.ttf",
        "om": "Outfit-Medium.ttf",
        "os": "Outfit-SemiBold.ttf",
        "ob": "Outfit-Bold.ttf",
        "nr": "Newsreader-Regular.ttf",
        "nm": "Newsreader-Medium.ttf",
        "ni": "Newsreader-Italic.ttf",
    }
    out = {}
    for k, f in files.items():
        pdfmetrics.registerFont(TTFont(k, str(FONTS / f)))
        out[k] = k
    return out


def spaced(c, text, x, y, font, size, color, tracking, align="left"):
    c.setFont(font, size)
    c.setFillColorRGB(*color)
    gap = size * tracking
    widths = [c.stringWidth(ch, font, size) for ch in text]
    total = sum(widths) + gap * max(0, len(text) - 1)
    if align == "right":
        cursor = x - total
    elif align == "center":
        cursor = x - total / 2
    else:
        cursor = x
    for ch, w in zip(text, widths):
        c.drawString(cursor, y, ch)
        cursor += w + gap


def build_pdf(path: Path, fonts: dict, sample: bool):
    c = canvas.Canvas(str(path), pagesize=A4)

    header_h = 58 * mm
    # Deep navy masthead
    c.setFillColorRGB(*NAVY)
    c.rect(0, PAGE_H - header_h, PAGE_W, header_h, stroke=0, fill=1)

    # Subtle second tone panel on right third
    c.setFillColorRGB(*NAVY2)
    c.rect(PAGE_W * 0.62, PAGE_H - header_h, PAGE_W * 0.38, header_h, stroke=0, fill=1)

    # Red under-rail
    c.setFillColorRGB(*RED)
    c.rect(0, PAGE_H - header_h - 1.2 * mm, PAGE_W, 1.2 * mm, stroke=0, fill=1)

    mx = 18 * mm
    crest = 36 * mm
    crest_x = mx
    crest_y = PAGE_H - 11 * mm - crest

    c.drawImage(
        ImageReader(str(CREST)),
        crest_x, crest_y,
        width=crest, height=crest,
        mask="auto", preserveAspectRatio=True,
    )

    # Wordmark in masthead — white on navy
    lx = crest_x + crest + 6.5 * mm
    spaced(c, "CAPITAL CITY", lx, crest_y + crest * 0.55, fonts["os"], 15, WHITE, 0.20)
    spaced(c, "FOOTBALL CLUB", lx, crest_y + crest * 0.55 - 5.8 * mm, fonts["om"], 7.2, MIST, 0.36)

    # White thin rule under wordmark
    c.setStrokeColorRGB(1, 1, 1)
    c.setLineWidth(0.5)
    c.setStrokeAlpha(0.35)
    wy = crest_y + crest * 0.55 - 9 * mm
    c.line(lx, wy, lx + 28 * mm, wy)
    c.setStrokeAlpha(1)

    c.setFillColorRGB(*MIST)
    c.setFont(fonts["or"], 6.3)
    c.drawString(lx, wy - 4.2 * mm, "Capital City FC Ltd  ·  RC 1838954")

    # Contact in right panel — no fake section labels
    rx = PAGE_W - mx
    cy = PAGE_H - 18 * mm
    for text, weight, size in [
        ("Suite 33.2, Moshood Abiola Way", fonts["ol"], 7.2),
        ("National Stadium, Abuja", fonts["ol"], 7.2),
        ("Nigeria", fonts["ol"], 7.2),
        ("", None, None),
        ("0807 600 2414", fonts["om"], 8.2),
        ("info@capitalcityfc.ng", fonts["om"], 8.2),
    ]:
        if not text:
            cy -= 2.4 * mm
            continue
        c.setFont(weight, size)
        c.setFillColorRGB(*(WHITE if weight == fonts["om"] else MIST))
        c.drawRightString(rx, cy, text)
        cy -= 3.55 * mm

    # Body zone
    body_top = PAGE_H - header_h - 1.2 * mm - 14 * mm
    measure = PAGE_W - 2 * mx

    if sample:
        c.setFont(fonts["or"], 8)
        c.setFillColorRGB(*MUTED)
        c.drawString(mx, body_top, "5 August 2026")

        y = body_top - 9 * mm
        c.setFont(fonts["nr"], 10.5)
        c.setFillColorRGB(*INK)
        for line in [
            "The Honourable Minister",
            "Federal Ministry of Youth & Sports Development",
            "Federal Secretariat Complex",
            "Abuja, FCT",
        ]:
            c.drawString(mx, y, line)
            y -= 4.6 * mm

        y -= 6 * mm
        c.setFont(fonts["ni"], 10.5)
        c.drawString(mx, y, "Dear Honourable Minister,")

        y -= 8 * mm
        c.setFont(fonts["nr"], 10.5)
        paras = [
            "Capital City Football Club writes with respect to our continued development programme within the Federal Capital Territory. We remain committed to building a professionally run club that reflects the standards of Abuja as Nigeria’s capital.",
            "We would welcome the opportunity to brief your office on our community outreach, academy pathway, and plans for competitive participation in the coming season. Our Director stands ready to provide any further information required.",
        ]
        leading = 5.3 * mm
        for para in paras:
            cur = ""
            for w in para.split():
                trial = (cur + " " + w).strip()
                if c.stringWidth(trial, fonts["nr"], 10.5) <= measure:
                    cur = trial
                else:
                    c.drawString(mx, y, cur)
                    y -= leading
                    cur = w
            if cur:
                c.drawString(mx, y, cur)
                y -= leading
            y -= 3.2 * mm

        y -= 2 * mm
        c.setFont(fonts["nr"], 10.5)
        c.drawString(mx, y, "Yours faithfully,")
        y -= 14 * mm
        c.setFont(fonts["os"], 9.5)
        c.setFillColorRGB(*NAVY)
        c.drawString(mx, y, "Abdulrahaman Umar Baba")
        c.setFont(fonts["or"], 7.5)
        c.setFillColorRGB(*MUTED)
        c.drawString(mx, y - 4 * mm, "Director, Capital City Football Club")
    else:
        c.setFillColorRGB(0.9, 0.91, 0.92)
        c.setFont(fonts["or"], 8)
        c.drawString(mx, body_top, "Date")
        c.drawString(mx, body_top - 12 * mm, "Recipient")
        c.drawString(mx, body_top - 30 * mm, "Body")

    # Quiet footer
    fy = 11 * mm
    c.setStrokeColorRGB(*RULE)
    c.setLineWidth(0.35)
    c.line(mx, fy + 4.5 * mm, PAGE_W - mx, fy + 4.5 * mm)
    c.setFillColorRGB(*RED)
    c.rect(mx, fy + 0.2 * mm, 1.3 * mm, 1.3 * mm, stroke=0, fill=1)
    c.setFillColorRGB(*MUTED)
    c.setFont(fonts["or"], 6)
    c.drawString(mx + 3 * mm, fy + 0.3 * mm, "Capital City FC Ltd  ·  RC 1838954  ·  National Stadium, Abuja")
    c.drawRightString(PAGE_W - mx, fy + 0.3 * mm, "info@capitalcityfc.ng")

    c.showPage()
    c.save()


def write_html():
    OUT_HTML.write_text(r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Capital City FC — Official Letterhead</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 0; }
  :root {
    --navy: #0A1630;
    --navy2: #0E1C3C;
    --ink: #161C27;
    --muted: #666F7D;
    --rule: #DADDE1;
    --red: #E30613;
    --mist: #C7D1E0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #9aa3b0; font-family: Outfit, sans-serif; -webkit-font-smoothing: antialiased; }
  .stage { padding: 48px 16px 72px; }
  .sheet {
    width: 210mm; height: 297mm; margin: 0 auto; background: #fff; position: relative; overflow: hidden;
    box-shadow: 0 50px 120px rgba(5,12,30,.45);
  }
  .mast {
    height: 58mm;
    background: linear-gradient(90deg, var(--navy) 0%, var(--navy) 62%, var(--navy2) 62%, var(--navy2) 100%);
    color: #fff;
    display: grid;
    grid-template-columns: 1fr 46mm;
    gap: 8mm;
    padding: 10mm 18mm 0;
    position: relative;
  }
  .mast::after {
    content: "";
    position: absolute; left: 0; right: 0; bottom: -1.2mm;
    height: 1.2mm; background: var(--red);
  }
  .brand-row { display: flex; gap: 6.5mm; align-items: center; }
  .crest {
    width: 36mm; height: 36mm; object-fit: contain; flex-shrink: 0;
    filter: drop-shadow(0 8px 18px rgba(0,0,0,.35));
  }
  .lock { padding-top: 1mm; }
  .lock .p {
    font-weight: 600; font-size: 15pt; letter-spacing: 0.20em; line-height: 1;
    margin-left: -0.05em;
  }
  .lock .s {
    margin-top: 3.2mm; font-weight: 500; font-size: 7.2pt; letter-spacing: 0.36em;
    color: var(--mist); line-height: 1;
  }
  .lock .rule {
    width: 28mm; height: 0.5pt; background: rgba(255,255,255,.35);
    margin: 4mm 0 2.8mm; border: 0;
  }
  .lock .legal { font-size: 6.3pt; color: var(--mist); font-weight: 400; }
  .contact { text-align: right; padding-top: 4mm; }
  .contact address {
    font-style: normal; font-weight: 300; font-size: 7.2pt; line-height: 1.55; color: var(--mist);
  }
  .contact .reach {
    margin-top: 4mm; font-weight: 500; font-size: 8.2pt; line-height: 1.55; color: #fff;
  }
  .body-wrap { padding: 14mm 18mm 16mm; }
  .date { font-size: 8pt; color: var(--muted); margin-bottom: 9mm; }
  .recipient, .salutation, .copy, .closing {
    font-family: Newsreader, Georgia, serif; font-size: 10.5pt; color: var(--ink); line-height: 1.5;
  }
  .recipient { margin-bottom: 6mm; }
  .salutation { font-style: italic; margin-bottom: 8mm; }
  .copy p { margin-bottom: 3.2mm; }
  .closing { margin: 5mm 0 13mm; }
  .name { font-weight: 600; font-size: 9.5pt; color: var(--navy); }
  .role { font-size: 7.5pt; color: var(--muted); margin-top: 1.5mm; }
  footer {
    position: absolute; left: 18mm; right: 18mm; bottom: 11mm;
    border-top: 0.35pt solid var(--rule); padding-top: 3mm;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 6pt; color: var(--muted);
  }
  footer i {
    width: 1.3mm; height: 1.3mm; background: var(--red); display: inline-block;
    margin-right: 2mm; vertical-align: middle; font-style: normal;
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
  <header class="mast">
    <div class="brand-row">
      <img class="crest" src="capital-city-fc-crest-transparent.png" alt="Capital City FC crest" />
      <div class="lock">
        <div class="p">CAPITAL CITY</div>
        <div class="s">FOOTBALL CLUB</div>
        <div class="rule"></div>
        <div class="legal">Capital City FC Ltd  ·  RC 1838954</div>
      </div>
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

  <div class="body-wrap">
    <div class="date">5 August 2026</div>
    <div class="recipient">
      The Honourable Minister<br />
      Federal Ministry of Youth &amp; Sports Development<br />
      Federal Secretariat Complex<br />
      Abuja, FCT
    </div>
    <div class="salutation">Dear Honourable Minister,</div>
    <div class="copy">
      <p>Capital City Football Club writes with respect to our continued development programme within the Federal Capital Territory. We remain committed to building a professionally run club that reflects the standards of Abuja as Nigeria’s capital.</p>
      <p>We would welcome the opportunity to brief your office on our community outreach, academy pathway, and plans for competitive participation in the coming season. Our Director stands ready to provide any further information required.</p>
    </div>
    <div class="closing">Yours faithfully,</div>
    <div class="name">Abdulrahaman Umar Baba</div>
    <div class="role">Director, Capital City Football Club</div>
  </div>

  <footer>
    <span><i></i>Capital City FC Ltd  ·  RC 1838954  ·  National Stadium, Abuja</span>
    <span>info@capitalcityfc.ng</span>
  </footer>
</article>
</div>
</body>
</html>
""", encoding="utf-8")


def main():
    fonts = register_fonts()
    build_pdf(OUT_PDF, fonts, True)
    build_pdf(OUT_BLANK, fonts, False)
    write_html()

    # Playwright render = best preview
    from playwright.sync_api import sync_playwright
    html = OUT_HTML.as_uri()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1000, "height": 1450}, device_scale_factor=2)
        page.goto(html, wait_until="networkidle")
        page.wait_for_timeout(1500)
        page.locator(".sheet").screenshot(path=str(OUT_PNG), type="png")
        browser.close()
    print("done")
    print(OUT_PDF)
    print(OUT_PNG)
    print(OUT_HTML)


if __name__ == "__main__":
    main()
