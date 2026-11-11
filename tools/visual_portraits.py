"""Web copies of the character illustrations: inputs/visual-overhaul/portraits/*.png (the sources, 140-190 KB each)
-> inputs/visual-overhaul/portraits-web/*.webp (about a fifth of the size, same 475 px). The build deploys the WebP
copies only. Re-run after adding or replacing a portrait. Usage: python3 -I tools/visual_portraits.py"""
import glob, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(ROOT, 'inputs', 'visual-overhaul', 'portraits')
out = os.path.join(ROOT, 'inputs', 'visual-overhaul', 'portraits-web')
os.makedirs(out, exist_ok=True)
a = b = 0
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    im = Image.open(f).convert('RGBA')
    o = os.path.join(out, os.path.basename(f)[:-4] + '.webp')
    im.save(o, 'WEBP', quality=90, alpha_quality=100, method=6)
    a += os.path.getsize(f); b += os.path.getsize(o)
print(f'{len(glob.glob(os.path.join(out, "*.webp")))} portraits: {a // 1024} KB png -> {b // 1024} KB webp')
