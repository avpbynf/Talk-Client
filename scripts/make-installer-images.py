"""Regenerate the two bitmaps the NSIS installer displays.

NSIS reads them as plain 24-bit BMP at fixed sizes, so they cannot be produced by
the build: they are committed next to the icons and rebuilt by hand whenever the
mark or the wordmark changes.

    python scripts/make-installer-images.py

Needs Pillow, and the Outfit font that `bun install` puts in node_modules, which
is the same face the application draws its own headings with.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "src-tauri" / "icons"
FONTS = ROOT / "node_modules" / "@fontsource" / "outfit" / "files"

WORDMARK = "Talk"
TAGLINE = "Speech-to-Text"

# The dark theme tokens of the application, so the installer and the window it
# installs are recognisably the same product. --color-background at the top,
# --color-card at the bottom, --color-border on the edge.
TOP = (22, 23, 28)
BOTTOM = (27, 28, 35)
BORDER = (11, 12, 14)
FOREGROUND = (238, 239, 244)
MUTED = (138, 140, 152)


def canvas(width: int, height: int) -> Image.Image:
    """A vertical gradient between the two background tokens, with a hairline edge."""
    image = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / max(height - 1, 1)
        draw.line(
            [(0, y), (width, y)],
            fill=tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)),
        )
    draw.rectangle([0, 0, width - 1, height - 1], outline=BORDER)
    return image


def mark(size: int) -> Image.Image:
    """The application icon, resized and still carrying its alpha."""
    return Image.open(ICONS / "icon.png").convert("RGBA").resize(
        (size, size), Image.LANCZOS
    )


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"outfit-latin-{weight}-normal.woff"), size)


def centered(draw: ImageDraw.ImageDraw, text, y, face, fill, width) -> None:
    left, top, right, bottom = draw.textbbox((0, 0), text, font=face)
    draw.text(((width - (right - left)) / 2 - left, y - top), text, font=face, fill=fill)


def sidebar() -> Image.Image:
    """164x314, shown on the welcome and finish pages."""
    width, height = 164, 314
    image = canvas(width, height)
    icon = mark(84)
    image.paste(icon, ((width - 84) // 2, 56), icon)
    draw = ImageDraw.Draw(image)
    centered(draw, WORDMARK, 163, font("600", 30), FOREGROUND, width)
    centered(draw, TAGLINE, 202, font("400", 11), MUTED, width)
    return image


def header() -> Image.Image:
    """150x57, shown on every other page of the wizard."""
    width, height = 150, 57
    image = canvas(width, height)
    icon = mark(30)
    image.paste(icon, (14, (height - 30) // 2), icon)
    draw = ImageDraw.Draw(image)
    face = font("600", 20)
    _, top, _, bottom = draw.textbbox((0, 0), WORDMARK, font=face)
    draw.text((54, (height - (bottom - top)) / 2 - top), WORDMARK, font=face, fill=FOREGROUND)
    return image


def main() -> None:
    for name, image in (("nsis-sidebar", sidebar()), ("nsis-header", header())):
        path = ICONS / f"{name}.bmp"
        image.save(path, "BMP")
        print(f"{path.relative_to(ROOT)}  {image.width}x{image.height}")


if __name__ == "__main__":
    main()
