"""
Capital City FC — Direction A letterhead (refined)
Ultra-minimal institutional · A4
"""

from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = Path(r"C:\Users\User\Desktop\Projects\Capital-City-Fc\assets\brand")
CREST = ROOT / "capital-city-fc-crest-transparent.png"
OUT_PDF = ROOT / "CCFC-Letterhead-Direction-A.pdf"
OUT_PNG = ROOT / "CCFC-Letterhead-Direction-A-preview.png"
OUT_BLANK_PDF = ROOT / "CCFC-Letterhead-Direction-A-blank.pdf"

PAGE_W, PAGE_H = A4

# Brand colours as RGB 0–1 for ReportLab
NAVY = (0.043, 0.122, 0.302)  # #0B1F4D
INK = (0.039, 0.086, 0.157)  # #0A1628
MUTED = (0.353, 0.396, 0.467)  # #5A6577
HAIR = (0.843, 0.863, 0.898)  # #D7DCE5


def find_font_paths():
    windir = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"
    candidates = {
        "regular": ["segoeui.ttf", "arial.ttf", "calibri.ttf"],
        "bold": ["segoeuib.ttf", "arialbd.ttf", "calibrib.ttf"],
        "light": ["segoeuil.ttf", "segoeui.ttf", "arial.ttf"],
    }
    found = {}
    for role, names in candidates.items():
        for name in names:
            p = windir / name
            if p.exists():
                found[role] = str(p)
                break
    return found


def register_fonts(fonts):
    mapping = {}
    pdfmetrics.registerFont(TTFont("CCFC-Reg", fonts["regular"]))
    pdfmetrics.registerFont(TTFont("CCFC-Bold", fonts["bold"]))
    pdfmetrics.registerFont(TTFont("CCFC-Light", fonts["light"]))
    return {"reg": "CCFC-Reg", "bold": "CCFC-Bold", "light": "CCFC-Light"}


def build_pdf(path: Path, fonts: dict, sample_body: bool):
    c = canvas.Canvas(str(path), pagesize=A4)
    margin_x = 22 * mm
    margin_top = 20 * mm

    # Crest — left. Brand signal lives here only (no duplicate wordmark).
    crest_size = 28 * mm
    crest_x = margin_x
    crest_y = PAGE_H - margin_top - crest_size
    c.drawImage(
        ImageReader(str(CREST)),
        crest_x,
        crest_y,
        width=crest_size,
        height=crest_size,
        mask="auto",
        preserveAspectRatio=True,
    )

    # Contact — right, optically aligned to crest vertical center band
    right = PAGE_W - margin_x
    line_h = 3.35 * mm
    block_h = 4 * line_h
    # Vertically center contact block against crest
    y = crest_y + (crest_size + block_h) / 2 - line_h

    contacts = [
        ("Suite 33.2, Moshood Abiola Way, National Stadium, Abuja", fonts["reg"], 8, MUTED),
        ("0807 600 2414", fonts["reg"], 8, MUTED),
        ("info@capitalcityfc.ng", fonts["reg"], 8, MUTED),
        ("capitalcityfc.ng", fonts["light"], 7.5, MUTED),
    ]
    # Drop website if it feels invented — user didn't give website domain beyond email.
    # Keep only verified fields.
    contacts = [
        ("Suite 33.2, Moshood Abiola Way", fonts["reg"], 8, MUTED),
        ("National Stadium, Abuja", fonts["reg"], 8, MUTED),
        ("T  0807 600 2414", fonts["reg"], 8, MUTED),
        ("E  info@capitalcityfc.ng", fonts["reg"], 8, MUTED),
    ]

    for text, font, size, color in contacts:
        c.setFillColorRGB(*color)
        c.setFont(font, size)
        c.drawRightString(right, y, text)
        y -= line_h

    # Body — generous air, no header rule (Direction A)
    body_top = crest_y - 16 * mm
    left = margin_x

    if sample_body:
        c.setFillColorRGB(*MUTED)
        c.setFont(fonts["reg"], 9)
        c.drawString(left, body_top, "5 August 2026")

        y = body_top - 11 * mm
        c.setFillColorRGB(*INK)
        c.setFont(fonts["reg"], 10.5)
        for line in [
            "The Director",
            "[Recipient Organisation]",
            "[Address Line]",
            "Abuja",
        ]:
            c.drawString(left, y, line)
            y -= 4.4 * mm

        y -= 7 * mm
        c.drawString(left, y, "Dear Sir/Madam,")

        y -= 9 * mm
        body = (
            "This letterhead is Capital City Football Club’s official stationery system. "
            "Replace this sample copy with your correspondence. The layout keeps generous "
            "margins, a crest-led header, and a quiet legal footer for federation, sponsor, "
            "and institutional communication."
        )
        max_w = PAGE_W - 2 * margin_x
        words = body.split()
        lines, cur = [], ""
        for w in words:
            trial = (cur + " " + w).strip()
            if c.stringWidth(trial, fonts["reg"], 10.5) <= max_w:
                cur = trial
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        leading = 5.4 * mm
        for line in lines:
            c.drawString(left, y, line)
            y -= leading

        y -= 10 * mm
        c.drawString(left, y, "Yours faithfully,")
        y -= 18 * mm
        c.setFont(fonts["bold"], 10.5)
        c.drawString(left, y, "Abdulrahaman Umar Baba")
        y -= 4.5 * mm
        c.setFont(fonts["reg"], 9)
        c.setFillColorRGB(*MUTED)
        c.drawString(left, y, "Director, Capital City FC Ltd")
    else:
        c.setFillColorRGB(0.90, 0.91, 0.93)
        c.setFont(fonts["reg"], 8)
        c.drawString(left, body_top, "Date")
        c.drawString(left, body_top - 12 * mm, "Recipient")
        c.drawString(left, body_top - 30 * mm, "Body")

    # Footer — single quiet legal line + whisper hairline
    footer_y = 13 * mm
    c.setStrokeColorRGB(*HAIR)
    c.setLineWidth(0.3)
    c.line(margin_x, footer_y + 5.5 * mm, PAGE_W - margin_x, footer_y + 5.5 * mm)

    c.setFillColorRGB(*MUTED)
    c.setFont(fonts["reg"], 6.4)
    footer = (
        "Capital City FC Ltd    RC 1838954    "
        "Suite 33.2, Moshood Abiola Way, National Stadium, Abuja    "
        "0807 600 2414    info@capitalcityfc.ng"
    )
    c.drawCentredString(PAGE_W / 2, footer_y, footer)

    c.showPage()
    c.save()


def build_png_preview(png_path: Path):
    dpi = 160
    scale = dpi / 72.0
    w, h = int(PAGE_W * scale), int(PAGE_H * scale)
    img = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    fonts = find_font_paths()

    def fnt(role, size_pt):
        path = fonts.get(role) or fonts.get("regular")
        return ImageFont.truetype(path, int(size_pt * scale))

    margin_x = int(22 * mm * scale)
    margin_top = int(20 * mm * scale)
    crest_size = int(28 * mm * scale)

    crest = Image.open(CREST).convert("RGBA")
    crest = crest.resize((crest_size, crest_size), Image.Resampling.LANCZOS)
    img.paste(crest, (margin_x, margin_top), crest)

    muted = (90, 101, 119)
    ink = (10, 22, 40)
    hair = (215, 220, 229)
    right = w - margin_x

    tr = fnt("regular", 8)
    line_h = int(3.35 * mm * scale)
    block_h = 4 * line_h
    y = margin_top + (crest_size - block_h) // 2

    for line in [
        "Suite 33.2, Moshood Abiola Way",
        "National Stadium, Abuja",
        "T  0807 600 2414",
        "E  info@capitalcityfc.ng",
    ]:
        bbox = draw.textbbox((0, 0), line, font=tr)
        draw.text((right - (bbox[2] - bbox[0]), y), line, fill=muted, font=tr)
        y += line_h

    body_top = margin_top + crest_size + int(16 * mm * scale)
    body_font = fnt("regular", 10.5)
    bold_font = fnt("bold", 10.5)
    small = fnt("regular", 9)

    draw.text((margin_x, body_top), "5 August 2026", fill=muted, font=small)

    y = body_top + int(11 * mm * scale)
    for line in [
        "The Director",
        "[Recipient Organisation]",
        "[Address Line]",
        "Abuja",
    ]:
        draw.text((margin_x, y), line, fill=ink, font=body_font)
        y += int(4.4 * mm * scale)

    y += int(7 * mm * scale)
    draw.text((margin_x, y), "Dear Sir/Madam,", fill=ink, font=body_font)
    y += int(9 * mm * scale)

    body = (
        "This letterhead is Capital City Football Club’s official stationery system. "
        "Replace this sample copy with your correspondence. The layout keeps generous "
        "margins, a crest-led header, and a quiet legal footer for federation, sponsor, "
        "and institutional communication."
    )
    max_w = w - 2 * margin_x
    words = body.split()
    cur, lines = "", []
    for word in words:
        trial = (cur + " " + word).strip()
        if draw.textbbox((0, 0), trial, font=body_font)[2] <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    for line in lines:
        draw.text((margin_x, y), line, fill=ink, font=body_font)
        y += int(5.4 * mm * scale)

    y += int(10 * mm * scale)
    draw.text((margin_x, y), "Yours faithfully,", fill=ink, font=body_font)
    y += int(18 * mm * scale)
    draw.text((margin_x, y), "Abdulrahaman Umar Baba", fill=ink, font=bold_font)
    y += int(4.5 * mm * scale)
    draw.text((margin_x, y), "Director, Capital City FC Ltd", fill=muted, font=small)

    footer_y = h - int(13 * mm * scale)
    draw.line(
        [
            (margin_x, footer_y - int(5.5 * mm * scale)),
            (right, footer_y - int(5.5 * mm * scale)),
        ],
        fill=hair,
        width=max(1, int(0.3 * scale)),
    )
    footer = (
        "Capital City FC Ltd    RC 1838954    "
        "Suite 33.2, Moshood Abiola Way, National Stadium, Abuja    "
        "0807 600 2414    info@capitalcityfc.ng"
    )
    ff = fnt("regular", 6.4)
    bbox = draw.textbbox((0, 0), footer, font=ff)
    draw.text(((w - (bbox[2] - bbox[0])) / 2, footer_y), footer, fill=muted, font=ff)

    img.save(png_path, "PNG", dpi=(dpi, dpi))


def write_html():
    html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Capital City FC — Letterhead Direction A</title>
<style>
  @page { size: A4; margin: 0; }
  :root {
    --navy: #0B1F4D;
    --ink: #0A1628;
    --muted: #5A6577;
    --hair: #D7DCE5;
    --page: #fff;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #e8eaee;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: var(--ink);
  }
  .sheet {
    width: 210mm;
    min-height: 297mm;
    margin: 24px auto;
    background: var(--page);
    padding: 20mm 22mm 18mm;
    position: relative;
    box-shadow: 0 12px 40px rgba(10, 22, 40, 0.12);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16mm;
  }
  .crest { width: 28mm; height: 28mm; object-fit: contain; }
  .contact {
    text-align: right;
    font-size: 8.5pt;
    line-height: 1.55;
    color: var(--muted);
    font-weight: 400;
  }
  .meta { color: var(--muted); font-size: 9pt; margin-bottom: 11mm; }
  .recipient { font-size: 10.5pt; line-height: 1.45; margin-bottom: 7mm; }
  .salutation { font-size: 10.5pt; margin-bottom: 9mm; }
  .body { font-size: 10.5pt; line-height: 1.55; max-width: 100%; margin-bottom: 10mm; }
  .closing { font-size: 10.5pt; margin-bottom: 18mm; }
  .sign .name { font-weight: 700; font-size: 10.5pt; }
  .sign .role { color: var(--muted); font-size: 9pt; margin-top: 2mm; }
  footer {
    position: absolute;
    left: 22mm; right: 22mm; bottom: 13mm;
    border-top: 0.3pt solid var(--hair);
    padding-top: 3.5mm;
    text-align: center;
    font-size: 6.4pt;
    color: var(--muted);
    letter-spacing: 0.01em;
  }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <img class="crest" src="capital-city-fc-crest-transparent.png" alt="Capital City Football Club" />
      <div class="contact">
        Suite 33.2, Moshood Abiola Way<br />
        National Stadium, Abuja<br />
        T&nbsp;&nbsp;0807 600 2414<br />
        E&nbsp;&nbsp;info@capitalcityfc.ng
      </div>
    </header>

    <div class="meta">5 August 2026</div>
    <div class="recipient">
      The Director<br />
      [Recipient Organisation]<br />
      [Address Line]<br />
      Abuja
    </div>
    <div class="salutation">Dear Sir/Madam,</div>
    <p class="body">
      This letterhead is Capital City Football Club’s official stationery system.
      Replace this sample copy with your correspondence. The layout keeps generous
      margins, a crest-led header, and a quiet legal footer for federation, sponsor,
      and institutional communication.
    </p>
    <div class="closing">Yours faithfully,</div>
    <div class="sign">
      <div class="name">Abdulrahaman Umar Baba</div>
      <div class="role">Director, Capital City FC Ltd</div>
    </div>

    <footer>
      Capital City FC Ltd&nbsp;&nbsp;&nbsp;RC 1838954&nbsp;&nbsp;&nbsp;
      Suite 33.2, Moshood Abiola Way, National Stadium, Abuja&nbsp;&nbsp;&nbsp;
      0807 600 2414&nbsp;&nbsp;&nbsp;info@capitalcityfc.ng
    </footer>
  </div>
</body>
</html>
"""
    (ROOT / "CCFC-Letterhead-Direction-A.html").write_text(html, encoding="utf-8")


def write_specs():
    specs = """# Capital City FC — Letterhead Direction A (Final Specs)

## Verdict
Winner: **Ultra-minimal institutional**. Crest is the only brand hero. Contact is secondary and right-aligned. No header rules. Maximum air.

## Page
- Size: A4 (210 × 297 mm)
- Side margins: 22 mm
- Top margin: 20 mm
- Bottom margin to footer baseline: 13 mm

## Header
- Crest: 28 mm diameter, top-left
- Clearspace: ≥ 3 mm around crest
- No duplicate wordmark (crest already carries the name)
- Contact block: right-aligned, optically centered to crest
  - Address (2 lines)
  - T  0807 600 2414
  - E  info@capitalcityfc.ng
- Type: Segoe UI / Helvetica Neue, 8 pt, colour `#5A6577`
- Divider: none in header

## Body
- Start: 16 mm below crest
- Date: 9 pt muted
- Body: 10.5 pt ink `#0A1628`, leading ~5.4 mm
- Signature name: 10.5 pt bold
- Role: 9 pt muted — “Director, Capital City FC Ltd”

## Footer
- Whisper hairline `#D7DCE5` at 0.3 pt
- Centered legal line, 6.4 pt muted:
  Capital City FC Ltd · RC 1838954 · address · phone · email

## Colour roles
| Role | Hex |
|------|-----|
| Navy (crest) | #0B1F4D |
| Ink | #0A1628 |
| Muted | #5A6577 |
| Hairline | #D7DCE5 |
| Red | crest only — not used in stationery chrome |

## Files
- `CCFC-Letterhead-Direction-A.pdf` — sample letter
- `CCFC-Letterhead-Direction-A-blank.pdf` — blank template
- `CCFC-Letterhead-Direction-A-preview.png` — preview
- `CCFC-Letterhead-Direction-A.html` — print-from-browser version
- `capital-city-fc-crest-transparent.png` — master crest

## Multi-page note
Page 2+: crest at 18 mm, contact omitted, folio bottom-right (e.g. 2), same footer.
"""
    (ROOT / "CCFC-Letterhead-Direction-A-SPECS.md").write_text(specs, encoding="utf-8")


def main():
    fonts = register_fonts(find_font_paths())
    build_pdf(OUT_PDF, fonts, sample_body=True)
    build_pdf(OUT_BLANK_PDF, fonts, sample_body=False)
    build_png_preview(OUT_PNG)
    write_html()
    write_specs()
    print("done")
    print(OUT_PDF)
    print(OUT_BLANK_PDF)
    print(OUT_PNG)


if __name__ == "__main__":
    main()
