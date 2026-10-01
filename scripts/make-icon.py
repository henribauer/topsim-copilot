"""Draws the TOPSIM Copilot app icon (1024 px PNG + .icns via iconutil).
Accent #3b5bdb from src/styles.css (D10). Motif: rising bars (controlling) with a trend line.
Run: python3 scripts/make-icon.py  ->  assets/icon.png, assets/icon.icns
"""
import os, shutil, subprocess
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")
S = 1024 * 4  # draw large, downscale for smooth edges


def draw() -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # macOS icon grid: 824 px body on a 1024 canvas, corner radius ~185.
    m, r = 100 * 4, 185 * 4
    top, bottom = (76, 110, 245), (54, 79, 199)  # lighter -> #3b5bdb-ish
    body = Image.new("RGBA", (S, S))
    bd = ImageDraw.Draw(body)
    for y in range(S):
        t = y / S
        bd.line([(0, y), (S, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)) + (255,))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([m, m, S - m, S - m], r, fill=255)
    img.paste(body, (0, 0), mask)

    # Four rising bars.
    base, w, gap = 736 * 4, 104 * 4, 52 * 4
    heights = [190, 290, 390, 500]
    x0 = (S - (4 * w + 3 * gap)) // 2
    for i, h in enumerate(heights):
        x = x0 + i * (w + gap)
        d.rounded_rectangle([x, base - h * 4, x + w, base], 22 * 4, fill=(255, 255, 255, 255 if i == 3 else 215))
    # Baseline.
    d.rounded_rectangle([x0 - 30 * 4, base + 30 * 4, S - x0 + 30 * 4, base + 52 * 4], 11 * 4, fill=(255, 255, 255, 255))
    return img.resize((1024, 1024), Image.LANCZOS)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    icon = draw()
    icon.save(os.path.join(OUT, "icon.png"))
    iconset = os.path.join(OUT, "icon.iconset")
    os.makedirs(iconset, exist_ok=True)
    for size in (16, 32, 128, 256, 512):
        icon.resize((size, size), Image.LANCZOS).save(f"{iconset}/icon_{size}x{size}.png")
        icon.resize((size * 2, size * 2), Image.LANCZOS).save(f"{iconset}/icon_{size}x{size}@2x.png")
    subprocess.run(["iconutil", "-c", "icns", iconset, "-o", os.path.join(OUT, "icon.icns")], check=True)
    shutil.rmtree(iconset)
    print("wrote", os.path.join(OUT, "icon.png"), "and icon.icns")


if __name__ == "__main__":
    main()
