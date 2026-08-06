"""
Capital City FC — Letterhead v2
Institutional premium rebuild. Not a Word template.
"""

from __future__ import annotations

from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

ROOT = Path(r"C:\Users\User\Desktop\Projects\Capital-City-Fc\assets\brand")
FONTS = ROOT / "fonts"
CREST = ROOT / "capital-city-fc-crest-transparent.png"

OUT_PDF = ROOT / "CCFC-Letterhead.pdf"
OUT_BLANK = ROOT / "CCFC-Letterhead-blank.pdf"
OUT_PNG = ROOT / "CCFC-Letterhead-preview.png"
OUT_HTML = ROOT / "CCFC-Letterhead.html"

PAGE_W, PAGE_H = A4

# Palette — pulled from crest, refined for print
NAVY = (0.067, 0.145, 0.322)       # #112452
NAVY_DEEP = (0.039, 0.086, 0.188)  # #0A1630
INK = (0.086, 0.110, 0.153)        # #161C27
MUTED = (0.420, 0.455, 0.510)      # #6B7482
RULE = (0.820, 0.835, 0.855)       # #D1D5DA
RED = (0.890, 0.024, 0.075)        # #E30613
PAPER = (1, 1, 1)


def register_fonts():
    mapping = {
        "outfit": ("Outfit", {
            "light": "Outfit-Light.ttf",
            "reg": "Outfit-Regular.ttf",
            "med": "Outfit-Medium.ttf",
            "semi": "Outfit-SemiBold.ttf",
            "bold": "Outfit-Bold.ttf",
        }),
        "news": ("Newsreader", {
            "reg": "Newsreader-Regular.ttf",
            "med": "Newsreader-Medium.ttf",
            "italic": "Newsreader-Italic.ttf",
        }),
    }
    names = {}
    for family, (prefix, files) in mapping.items():
        for weight, filename in files.items():
            path = FONTS / filename
            font_name = f"{prefix}-{weight}"
            pdfmetrics.registerFont(TTFont(font_name, str(path)))
            names[f"{family}-{weight}"] = font_name
    return names


def draw_spaced_string(c, text, x, y, font, size, color, tracking=0.0, align="left"):
    """Draw text with letter-spacing (tracking in em-ish fraction of size)."""
    c.setFont(font, size)
    c.setFillColorRGB(*color)
    gap = size * tracking
    widths = [c.stringWidth(ch, font, size) for ch in text]
    total = sum(widths) + gap * (len(text) - 1 if len(text) > 1 else 0)
    if align == "right":
        cursor = x - total
    elif align == "center":
        cursor = x - total / 2
    else:
        cursor = x
    for ch, w in zip(text, widths):
        c.drawString(cursor, y, ch)
        cursor += w + gap
    return total


def build_pdf(path: Path, fonts: dict, sample: bool):
    c = canvas.Canvas(str(path), pagesize=A4)

    # ---- Top brand edge (full bleed) ----
    c.setFillColorRGB(*NAVY_DEEP)
    c.rect(0, PAGE_H - 2.2 * mm, PAGE_W, 2.2 * mm, stroke=0, fill=1)
    # Micro red tick under the navy edge — crest ring echo
    c.setFillColorRGB(*RED)
    c.rect(22 * mm, PAGE_H - 2.8 * mm, 14 * mm, 0.6 * mm, stroke=0, fill=1)

    margin_x = 22 * mm
    top = PAGE_H - 14 * mm

    # ---- Crest ----
    crest_size = 34 * mm
    crest_x = margin_x
    crest_y = top - crest_size
    c.drawImage(
        ImageReader(str(CREST)),
        crest_x,
        crest_y,
        width=crest_size,
        height=crest_size,
        mask="auto",
        preserveAspectRatio=True,
    )

    # ---- Wordmark lockup (right of crest) ----
    lock_x = crest_x + crest_size + 7 * mm
    # Optical vertical center of crest for primary line
    primary_y = crest_y + crest_size * 0.58
    secondary_y = primary_y - 5.2 * mm

    draw_spaced_string(
        c, "CAPITAL CITY", lock_x, primary_y,
        fonts["outfit-semi"], 13.5, NAVY_DEEP, tracking=0.22, align="left",
    )
    draw_spaced_string(
        c, "FOOTBALL CLUB", lock_x, secondary_y,
        fonts["outfit-med"], 7.5, MUTED, tracking=0.38, align="left",
    )

    # Red accent rule under wordmark
    rule_y = secondary_y - 3.2 * mm
    c.setStrokeColorRGB(*RED)
    c.setLineWidth(0.9)
    c.line(lock_x, rule_y, lock_x + 18 * mm, rule_y)

    # Legal line under accent
    c.setFont(fonts["outfit-reg"], 6.5)
    c.setFillColorRGB(*MUTED)
    c.drawString(lock_x, rule_y - 4.2 * mm, "Capital City FC Ltd  ·  RC 1838954")

    # ---- Contact column (far right) ----
    right = PAGE_W - margin_x
    contact_top = crest_y + crest_size - 2 * mm
    c.setFont(fonts["outfit-med"], 6.2)
    c.setFillColorRGB(*NAVY_DEEP)
    draw_spaced_string(
        c, "CORRESPONDENCE", right, contact_top,
        fonts["outfit-med"], 6.0, NAVY_DEEP, tracking=0.28, align="right",
    )

    c.setStrokeColorRGB(*RULE)
    c.setLineWidth(0.4)
    c.line(right - 42 * mm, contact_top - 2.2 * mm, right, contact_top - 2.2 * mm)

    lines = [
        "Suite 33.2, Moshood Abiola Way",
        "National Stadium, Abuja",
        "Nigeria",
        "",
        "0807 600 2414",
        "info@capitalcityfc.ng",
    ]
    y = contact_top - 5.5 * mm
    for i, line in enumerate(lines):
        if not line:
            y -= 1.8 * mm
            continue
        weight = fonts["outfit-med"] if i >= 4 else fonts["outfit-reg"]
        size = 7.4 if i >= 4 else 7.2
        color = INK if i >= 4 else MUTED
        c.setFont(weight, size)
        c.setFillColorRGB(*color)
        c.drawRightString(right, y, line)
        y -= 3.4 * mm

    # ---- Header baseline ----
    header_base = min(crest_y, y) - 8 * mm
    c.setStrokeColorRGB(*RULE)
    c.setLineWidth(0.35)
    c.line(margin_x, header_base, PAGE_W - margin_x, header_base)

    # ---- Body ----
    body_top = header_base - 12 * mm
    left = margin_x
    measure = PAGE_W - 2 * margin_x

    if sample:
        c.setFont(fonts["outfit-reg"], 8.5)
        c.setFillColorRGB(*MUTED)
        c.drawString(left, body_top, "5 August 2026")

        y = body_top - 10 * mm
        c.setFont(fonts["news-reg"], 11)
        c.setFillColorRGB(*INK)
        for line in [
            "The Honourable Minister",
            "Federal Ministry of Youth & Sports Development",
            "Federal Secretariat Complex",
            "Abuja, FCT",
        ]:
            c.drawString(left, y, line)
            y -= 4.8 * mm

        y -= 7 * mm
        c.setFont(fonts["news-italic"], 11)
        c.drawString(left, y, "Dear Honourable Minister,")

        y -= 8.5 * mm
        c.setFont(fonts["news-reg"], 11)
        paragraphs = [
            (
                "Capital City Football Club writes with respect to our continued development "
                "programme within the Federal Capital Territory. We remain committed to "
                "building a professionally run club that reflects the standards of Abuja "
                "as Nigeria’s capital."
            ),
            (
                "We would welcome the opportunity to brief your office on our community "
                "outreach, academy pathway, and plans for competitive participation in the "
                "coming season. Our Director stands ready to provide any further information "
                "required."
            ),
        ]
        leading = 5.6 * mm
        for para in paragraphs:
            words = para.split()
            cur = ""
            for w in words:
                trial = (cur + " " + w).strip()
                if c.stringWidth(trial, fonts["news-reg"], 11) <= measure:
                    cur = trial
                else:
                    c.drawString(left, y, cur)
                    y -= leading
                    cur = w
            if cur:
                c.drawString(left, y, cur)
                y -= leading
            y -= 3.5 * mm

        y -= 4 * mm
        c.setFont(fonts["news-reg"], 11)
        c.drawString(left, y, "Yours faithfully,")

        y -= 16 * mm
        # Signature flourish line
        c.setStrokeColorRGB(*RULE)
        c.setLineWidth(0.45)
        c.line(left, y + 3 * mm, left + 28 * mm, y + 3 * mm)

        c.setFont(fonts["outfit-semi"], 10)
        c.setFillColorRGB(*NAVY_DEEP)
        c.drawString(left, y - 2 * mm, "Abdulrahaman Umar Baba")
        c.setFont(fonts["outfit-reg"], 8)
        c.setFillColorRGB(*MUTED)
        c.drawString(left, y - 6.2 * mm, "Director")
        c.drawString(left, y - 9.6 * mm, "Capital City Football Club")
    else:
        c.setFillColorRGB(0.88, 0.89, 0.91)
        c.setFont(fonts["outfit-reg"], 8)
        c.drawString(left, body_top, "Date")
        c.drawString(left, body_top - 12 * mm, "Recipient")
        c.drawString(left, body_top - 32 * mm, "Letter body")

    # ---- Footer band ----
    band_h = 12 * mm
    c.setFillColorRGB(*NAVY_DEEP)
    c.rect(0, 0, PAGE_W, band_h, stroke=0, fill=1)
    # Red micro accent on footer
    c.setFillColorRGB(*RED)
    c.rect(0, band_h, PAGE_W, 0.55 * mm, stroke=0, fill=1)

    c.setFillColorRGB(0.78, 0.82, 0.88)
    c.setFont(fonts["outfit-reg"], 6.2)
    footer = "CAPITAL CITY FC LTD    ·    RC 1838954    ·    ABUJA, NIGERIA    ·    INFO@CAPITALCITYFC.NG"
    c.drawCentredString(PAGE_W / 2, 4.8 * mm, footer)

    c.showPage()
    c.save()


def build_png(fonts_paths: dict):
    """High-res preview matching the PDF system."""
    dpi = 180
    scale = dpi / 72.0
    w, h = int(PAGE_W * scale), int(PAGE_H * scale)
    img = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    def font(file, size_pt):
        return ImageFont.truetype(str(FONTS / file), int(size_pt * scale))

    def spaced(text, x, y, f, fill, tracking, align="left"):
        gap = f.size * tracking
        widths = []
        for ch in text:
            widths.append(draw.textbbox((0, 0), ch, font=f)[2])
        total = sum(widths) + gap * max(0, len(text) - 1)
        if align == "right":
            cursor = x - total
        elif align == "center":
            cursor = x - total / 2
        else:
            cursor = x
        for ch, cw in zip(text, widths):
            draw.text((cursor, y), ch, font=f, fill=fill)
            cursor += cw + gap

    navy = (10, 22, 48)
    muted = (107, 116, 130)
    ink = (22, 28, 39)
    red = (227, 6, 19)
    rule = (209, 213, 218)

    # Top edge
    draw.rectangle([0, 0, w, int(2.2 * mm * scale)], fill=navy)
    draw.rectangle(
        [int(22 * mm * scale), int(2.2 * mm * scale), int(36 * mm * scale), int(2.8 * mm * scale)],
        fill=red,
    )

    margin_x = int(22 * mm * scale)
    top = int(14 * mm * scale)
    crest_size = int(34 * mm * scale)
    crest = Image.open(CREST).convert("RGBA").resize((crest_size, crest_size), Image.Resampling.LANCZOS)
    img.paste(crest, (margin_x, top), crest)

    lock_x = margin_x + crest_size + int(7 * mm * scale)
    primary_y = top + int(crest_size * 0.28)
    secondary_y = primary_y + int(5.4 * mm * scale)

    spaced("CAPITAL CITY", lock_x, primary_y, font("Outfit-SemiBold.ttf", 13.5), navy, 0.22)
    spaced("FOOTBALL CLUB", lock_x, secondary_y, font("Outfit-Medium.ttf", 7.5), muted, 0.38)

    rule_y = secondary_y + int(4.5 * mm * scale)
    draw.line([(lock_x, rule_y), (lock_x + int(18 * mm * scale), rule_y)], fill=red, width=max(2, int(0.9 * scale)))
    draw.text(
        (lock_x, rule_y + int(2.2 * mm * scale)),
        "Capital City FC Ltd  ·  RC 1838954",
        font=font("Outfit-Regular.ttf", 6.5),
        fill=muted,
    )

    right = w - margin_x
    contact_top = top + int(2 * mm * scale)
    spaced("CORRESPONDENCE", right, contact_top, font("Outfit-Medium.ttf", 6.0), navy, 0.28, align="right")
    draw.line(
        [(right - int(42 * mm * scale), contact_top + int(3.5 * mm * scale)), (right, contact_top + int(3.5 * mm * scale))],
        fill=rule,
        width=max(1, int(0.4 * scale)),
    )

    y = contact_top + int(6.5 * mm * scale)
    contact_lines = [
        ("Suite 33.2, Moshood Abiola Way", "Outfit-Regular.ttf", 7.2, muted),
        ("National Stadium, Abuja", "Outfit-Regular.ttf", 7.2, muted),
        ("Nigeria", "Outfit-Regular.ttf", 7.2, muted),
        None,
        ("0807 600 2414", "Outfit-Medium.ttf", 7.4, ink),
        ("info@capitalcityfc.ng", "Outfit-Medium.ttf", 7.4, ink),
    ]
    for item in contact_lines:
        if item is None:
            y += int(1.8 * mm * scale)
            continue
        text, ff, sz, col = item
        f = font(ff, sz)
        bbox = draw.textbbox((0, 0), text, font=f)
        draw.text((right - (bbox[2] - bbox[0]), y), text, font=f, fill=col)
        y += int(3.4 * mm * scale)

    header_base = top + crest_size + int(8 * mm * scale)
    draw.line([(margin_x, header_base), (right, header_base)], fill=rule, width=max(1, int(0.35 * scale)))

    body_top = header_base + int(12 * mm * scale)
    left = margin_x
    measure = w - 2 * margin_x

    draw.text((left, body_top), "5 August 2026", font=font("Outfit-Regular.ttf", 8.5), fill=muted)

    y = body_top + int(10 * mm * scale)
    news = font("Newsreader-Regular.ttf", 11)
    for line in [
        "The Honourable Minister",
        "Federal Ministry of Youth & Sports Development",
        "Federal Secretariat Complex",
        "Abuja, FCT",
    ]:
        draw.text((left, y), line, font=news, fill=ink)
        y += int(4.8 * mm * scale)

    y += int(7 * mm * scale)
    draw.text((left, y), "Dear Honourable Minister,", font=font("Newsreader-Italic.ttf", 11), fill=ink)
    y += int(8.5 * mm * scale)

    paragraphs = [
        "Capital City Football Club writes with respect to our continued development programme within the Federal Capital Territory. We remain committed to building a professionally run club that reflects the standards of Abuja as Nigeria’s capital.",
        "We would welcome the opportunity to brief your office on our community outreach, academy pathway, and plans for competitive participation in the coming season. Our Director stands ready to provide any further information required.",
    ]
    leading = int(5.6 * mm * scale)
    for para in paragraphs:
        words = para.split()
        cur = ""
        for word in words:
            trial = (cur + " " + word).strip()
            if draw.textbbox((0, 0), trial, font=news)[2] <= measure:
                cur = trial
            else:
                draw.text((left, y), cur, font=news, fill=ink)
                y += leading
                cur = word
        if cur:
            draw.text((left, y), cur, font=news, fill=ink)
            y += leading
        y += int(3.5 * mm * scale)

    y += int(4 * mm * scale)
    draw.text((left, y), "Yours faithfully,", font=news, fill=ink)
    y += int(16 * mm * scale)
    draw.line([(left, y), (left + int(28 * mm * scale), y)], fill=rule, width=max(1, int(0.45 * scale)))
    y += int(3 * mm * scale)
    draw.text((left, y), "Abdulrahaman Umar Baba", font=font("Outfit-SemiBold.ttf", 10), fill=navy)
    y += int(4.5 * mm * scale)
    draw.text((left, y), "Director", font=font("Outfit-Regular.ttf", 8), fill=muted)
    y += int(3.4 * mm * scale)
    draw.text((left, y), "Capital City Football Club", font=font("Outfit-Regular.ttf", 8), fill=muted)

    band_h = int(12 * mm * scale)
    draw.rectangle([0, h - band_h, w, h], fill=navy)
    draw.rectangle([0, h - band_h - int(0.55 * mm * scale), w, h - band_h], fill=red)
    footer = "CAPITAL CITY FC LTD    ·    RC 1838954    ·    ABUJA, NIGERIA    ·    INFO@CAPITALCITYFC.NG"
    ff = font("Outfit-Regular.ttf", 6.2)
    bbox = draw.textbbox((0, 0), footer, font=ff)
    draw.text(((w - (bbox[2] - bbox[0])) / 2, h - band_h + int(4.2 * mm * scale)), footer, font=ff, fill=(198, 208, 224))

    img.save(OUT_PNG, "PNG", dpi=(dpi, dpi))
    print("png", OUT_PNG)


def write_html():
    html = r"""<!DOCTYPE html>
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
    --ink: #161C27;
    --muted: #6B7482;
    --rule: #D1D5DA;
    --red: #E30613;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #c5CAD3;
    font-family: Outfit, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .stage { padding: 40px 0 60px; }
  .sheet {
    width: 210mm;
    height: 297mm;
    margin: 0 auto;
    background: #fff;
    position: relative;
    overflow: hidden;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.6) inset,
      0 30px 80px rgba(10, 22, 48, 0.28);
  }
  .edge {
    height: 2.2mm;
    background: var(--navy);
    position: relative;
  }
  .edge::after {
    content: "";
    position: absolute;
    left: 22mm; top: 100%;
    width: 14mm; height: 0.6mm;
    background: var(--red);
  }
  .content { padding: 12mm 22mm 20mm; }
  header.mast {
    display: grid;
    grid-template-columns: 34mm 1fr 48mm;
    gap: 7mm;
    align-items: start;
    padding-bottom: 8mm;
    border-bottom: 0.35pt solid var(--rule);
    margin-bottom: 12mm;
  }
  .crest { width: 34mm; height: 34mm; object-fit: contain; display: block; }
  .lockup { padding-top: 7mm; }
  .lockup .primary {
    font-weight: 600;
    font-size: 13.5pt;
    letter-spacing: 0.22em;
    color: var(--navy);
    line-height: 1;
    margin-left: -0.05em;
  }
  .lockup .secondary {
    margin-top: 3.5mm;
    font-weight: 500;
    font-size: 7.5pt;
    letter-spacing: 0.38em;
    color: var(--muted);
    line-height: 1;
  }
  .lockup .accent {
    width: 18mm; height: 0.9pt;
    background: var(--red);
    margin: 3.2mm 0 2.8mm;
    border: 0;
  }
  .lockup .legal {
    font-size: 6.5pt;
    color: var(--muted);
    letter-spacing: 0.02em;
  }
  .contact { text-align: right; padding-top: 1mm; }
  .contact .label {
    font-size: 6pt;
    font-weight: 500;
    letter-spacing: 0.28em;
    color: var(--navy);
    margin-bottom: 2.2mm;
  }
  .contact .rule {
    width: 42mm; height: 0.4pt;
    background: var(--rule);
    margin: 0 0 3mm auto;
  }
  .contact address {
    font-style: normal;
    font-size: 7.2pt;
    line-height: 1.55;
    color: var(--muted);
    font-weight: 400;
  }
  .contact .reach {
    margin-top: 3mm;
    font-size: 7.4pt;
    font-weight: 500;
    color: var(--ink);
    line-height: 1.55;
  }
  .date {
    font-size: 8.5pt;
    color: var(--muted);
    margin-bottom: 10mm;
  }
  .recipient {
    font-family: Newsreader, Georgia, serif;
    font-size: 11pt;
    line-height: 1.45;
    color: var(--ink);
    margin-bottom: 7mm;
  }
  .salutation {
    font-family: Newsreader, Georgia, serif;
    font-size: 11pt;
    font-style: italic;
    margin-bottom: 8.5mm;
  }
  .body {
    font-family: Newsreader, Georgia, serif;
    font-size: 11pt;
    line-height: 1.55;
    color: var(--ink);
    max-width: 100%;
  }
  .body p { margin-bottom: 3.5mm; }
  .closing {
    font-family: Newsreader, Georgia, serif;
    font-size: 11pt;
    margin: 8mm 0 14mm;
  }
  .sign .line {
    width: 28mm; height: 0.45pt;
    background: var(--rule);
    margin-bottom: 3mm;
  }
  .sign .name {
    font-weight: 600;
    font-size: 10pt;
    color: var(--navy);
  }
  .sign .role {
    margin-top: 1.5mm;
    font-size: 8pt;
    color: var(--muted);
    line-height: 1.45;
  }
  footer.band {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 12mm;
    background: var(--navy);
    color: #C6D0E0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 6.2pt;
    letter-spacing: 0.08em;
    font-weight: 400;
  }
  footer.band::before {
    content: "";
    position: absolute;
    left: 0; right: 0; top: -0.55mm;
    height: 0.55mm;
    background: var(--red);
  }
  @media print {
    body, .stage { background: #fff; padding: 0; }
    .sheet { box-shadow: none; margin: 0; }
  }
</style>
</head>
<body>
  <div class="stage">
    <article class="sheet">
      <div class="edge"></div>
      <div class="content">
        <header class="mast">
          <img class="crest" src="capital-city-fc-crest-transparent.png" alt="Capital City Football Club crest" />
          <div class="lockup">
            <div class="primary">CAPITAL CITY</div>
            <div class="secondary">FOOTBALL CLUB</div>
            <div class="accent"></div>
            <div class="legal">Capital City FC Ltd  ·  RC 1838954</div>
          </div>
          <div class="contact">
            <div class="label">CORRESPONDENCE</div>
            <div class="rule"></div>
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
        <div class="sign">
          <div class="line"></div>
          <div class="name">Abdulrahaman Umar Baba</div>
          <div class="role">Director<br />Capital City Football Club</div>
        </div>
      </div>
      <footer class="band">CAPITAL CITY FC LTD&nbsp;&nbsp;·&nbsp;&nbsp;RC 1838954&nbsp;&nbsp;·&nbsp;&nbsp;ABUJA, NIGERIA&nbsp;&nbsp;·&nbsp;&nbsp;INFO@CAPITALCITYFC.NG</footer>
    </article>
  </div>
</body>
</html>
"""
    OUT_HTML.write_text(html, encoding="utf-8")
    print("html", OUT_HTML)


def main():
    fonts = register_fonts()
    build_pdf(OUT_PDF, fonts, sample=True)
    build_pdf(OUT_BLANK, fonts, sample=False)
    build_png({})
    write_html()
    print("pdf", OUT_PDF)
    print("blank", OUT_BLANK)


if __name__ == "__main__":
    main()
