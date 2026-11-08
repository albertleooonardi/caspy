"""Rebuild the README banner, screenshots and video poster from tracked app assets.

Usage: .venv/bin/python scripts/build_readme_assets.py
Output: docs/assets/readme/ (small, GitHub-friendly files). Uses only Pillow.
Inputs are the app's own artwork and its labelled tutorial screenshots, which
use fictional data and show no real transaction.
"""
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'frontend/public'
OUT = ROOT / 'docs/assets/readme'
OUT.mkdir(parents=True, exist_ok=True)

INK, PAPER, ORANGE, LAVENDER = (255, 255, 255), (247, 245, 250), (247, 125, 67), (200, 170, 230)


def font(name, size, weight=None):
    face = ImageFont.truetype(str(PUBLIC / 'fonts' / name), size)
    if weight:
        try:  # set the weight axis by name; other axes (e.g. optical size) keep sensible values
            values = []
            for axis in face.get_variation_axes():
                label = axis['name'].decode() if isinstance(axis['name'], bytes) else str(axis['name'])
                values.append(min(max(weight, axis['minimum']), axis['maximum']) if 'eight' in label else min(max(size, axis['minimum']), axis['maximum']) if 'ptical' in label else axis['default'])
            face.set_variation_by_axes(values)
        except Exception:
            pass
    return face


def cutout(path):
    """Return Caspy with a transparent background, cropped to the character."""
    image = Image.open(path).convert('RGBA')
    alpha = image.getchannel('A')
    if alpha.getextrema()[0] == 255:  # opaque white background: remove the outside region only
        flood = image.convert('RGB')
        marker = (255, 0, 255)
        for corner in ((0, 0), (flood.width - 1, 0), (0, flood.height - 1), (flood.width - 1, flood.height - 1)):
            ImageDraw.floodfill(flood, corner, marker, thresh=40)
        outside = ImageChops.difference(flood, Image.new('RGB', flood.size, marker)).convert('L').point(lambda v: 0 if v else 255)
        outside = outside.filter(ImageFilter.MaxFilter(5))  # swallow the pale fringe around the outline
        alpha = ImageChops.invert(outside).filter(ImageFilter.GaussianBlur(1.2))
        image.putalpha(alpha)
    return image.crop(image.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())


def banner():
    width, height = 1600, 520
    base = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(base)
    for y in range(height):  # vertical gradient
        mix = y / (height - 1)
        draw.line([(0, y), (width, y)], fill=(int(42 - 19 * mix), int(24 - 10 * mix), int(64 - 28 * mix)))
    glow = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((1010, 20, 1560, 570), fill=(116, 81, 143, 150))
    base = Image.alpha_composite(base.convert('RGBA'), glow.filter(ImageFilter.GaussianBlur(40)))
    ring = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((1040, 40, 1530, 530), outline=(200, 170, 230, 70), width=2)
    base = Image.alpha_composite(base, ring)
    sparkle = ImageDraw.Draw(base)
    random.seed(7)
    for _ in range(46):  # stars
        x, y, r = random.randint(20, width - 20), random.randint(15, height - 15), random.choice((1, 1, 2, 3))
        sparkle.ellipse((x - r, y - r, x + r, y + r), fill=(220, 200, 245, random.randint(60, 170)))

    ghost = cutout(PUBLIC / 'images/caspy.png')
    scale = 430 / ghost.height
    ghost = ghost.resize((round(ghost.width * scale), 430), Image.LANCZOS)
    shadow = Image.new('RGBA', base.size, (0, 0, 0, 0))
    shadow.paste((10, 4, 24, 150), (1285 - ghost.width // 2 + 10, 62 + 14), ghost.getchannel('A'))
    base = Image.alpha_composite(base, shadow.filter(ImageFilter.GaussianBlur(14)))
    base.alpha_composite(ghost, (1285 - ghost.width // 2, 62))

    text = ImageDraw.Draw(base)
    word = font('space-grotesk.ttf', 120, 700)
    text.text((84, 70), 'caspy', font=word, fill=INK)
    text.ellipse((84 + text.textlength('caspy', font=word) + 8, 72 + 96, 84 + text.textlength('caspy', font=word) + 34, 72 + 122), fill=ORANGE)
    text.text((88, 232), 'Three prompts. One stubborn ghost.', font=font('space-grotesk.ttf', 44, 700), fill=ORANGE)
    text.text((88, 296), 'A prompt-persuasion game and AI evaluation platform.', font=font('dm-sans.ttf', 26, 500), fill=(230, 220, 244))
    chip_font, x = font('dm-sans.ttf', 20, 700), 88
    for label in ('3 PROMPTS', 'WIN THE CANDY', 'NO LUCK DRAWS'):
        w = text.textlength(label, font=chip_font)
        text.rounded_rectangle((x, 384, x + w + 40, 432), radius=24, fill=(60, 38, 88), outline=(116, 81, 143), width=2)
        text.text((x + 20, 396), label, font=chip_font, fill=LAVENDER)
        x += w + 58
    base.convert('RGB').save(OUT / 'banner.png', optimize=True)


def screenshots():
    sources = {'chat': 'prompt-typing', 'grade': 'earned', 'generating': 'generating', 'minted': 'minted'}
    for name, stem in sources.items():
        image = Image.open(PUBLIC / f'images/tutorial/website/{stem}.png').convert('RGB')
        top = 0
        while top < image.height // 4 and sum(image.getpixel((6, top))) < 3 * 120:  # dark browser band
            top += 1
        image = image.crop((0, top, image.width, image.height))
        image = image.resize((1400, round(image.height * 1400 / image.width)), Image.LANCZOS)
        image.save(OUT / f'screen-{name}.jpg', quality=82, optimize=True, progressive=True)


def poster():
    image = Image.open(PUBLIC / 'videos/caspy-showcase-poster.jpg').convert('RGBA')
    layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cx, cy, r = 925, 528, 58
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(247, 125, 67, 235), outline=(255, 255, 255, 255), width=5)
    draw.polygon([(cx - 17, cy - 30), (cx - 17, cy + 30), (cx + 33, cy)], fill=(255, 255, 255, 255))
    Image.alpha_composite(image, layer).convert('RGB').save(OUT / 'video-poster.jpg', quality=86, optimize=True)


if __name__ == '__main__':
    banner()
    screenshots()
    poster()
    for item in sorted(OUT.iterdir()):
        print(f'{item.name:24} {item.stat().st_size // 1024:>5} KB')
