"""Reviewed local ImageGen donor; preserve every decoded outside-mask pixel.

Production WEBPs are written losslessly, including the approved night dock.
The clean geometry derivative and hybrid appearances are patched independently.
"""
from pathlib import Path
import argparse
import importlib.util
import json
import hashlib
import io
import subprocess
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'art-review/money-level/world-settings-v2'
# Excludes bench/lantern (x<=383), upper stump, pedestal and foreground fence.
POLYGON = [(388,556),(456,552),(485,578),(523,592),(539,618),
           (538,659),(506,676),(433,660),(388,639),(386,590)]

def digest(a):
    return hashlib.sha256(a.tobytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate', type=Path, required=True)
    parser.add_argument('--rebuild-left-first', action='store_true', help='Explicitly rebuild LEFT before reapplying RIGHT; never use to resume WIP')
    args = parser.parse_args()
    if (OUT / 'RIGHT_CORRIDOR_FENCE_MASK.png').exists() and not args.rebuild_left_first:
        raise SystemExit('RIGHT patch already exists. Use the read-only background audit; do not overwrite resumed WIP with the LEFT writer.')
    OUT.mkdir(parents=True, exist_ok=True)
    def baseline(path):
        source = subprocess.check_output(['git','show',f'471d7866e5817e9a1691f6f6e33ea698f3dda428:{path.relative_to(ROOT).as_posix()}'],cwd=ROOT)
        return Image.open(io.BytesIO(source)).convert('RGB')
    master = baseline(ROOT / 'reference/new_reference-clean-edges.png')
    donor = Image.open(args.candidate).convert('RGB').resize(master.size, Image.Resampling.LANCZOS)
    donor.save(OUT / 'grass-donor.png')
    mask = Image.new('L', master.size)
    ImageDraw.Draw(mask).polygon(POLYGON, fill=255)
    support = np.asarray(mask) > 0
    alpha = np.asarray(mask.filter(ImageFilter.GaussianBlur(3)), dtype=np.float32)/255 * support
    mask.save(OUT / 'grass-mask.png')
    spec = importlib.util.spec_from_file_location('appearance', ROOT / 'scripts/build-money-level-new-layout.py')
    color = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(color)
    original = np.asarray(master).copy()
    base_lab = color.srgb_to_lab(original.astype(np.float32)/255)
    donor_lab = color.srgb_to_lab(np.asarray(donor).astype(np.float32)/255)
    names = [f'{t}-{w}' for t in ('morning','day','evening','night') for w in ('sunny','cloudy','rain','storm')]
    paths = [ROOT / 'reference/new_reference-clean-edges.png']
    paths += [ROOT / f'art-review/money-level/new-layout/hybrid/forest-{n}.png' for n in names]
    paths += [ROOT / f'public/money-level/art/background/forest-{n}-docked.webp' for n in names]
    records = []
    for path in paths:
        image = baseline(path)
        assert image.size == (1683,935)
        before = np.asarray(image).copy()
        field = gaussian_filter(color.srgb_to_lab(before.astype(np.float32)/255)-base_lab, (14,14,0))
        corrected = color.lab_to_srgb(donor_lab + field)
        after = before.copy()
        blended = np.clip(before*(1-alpha[...,None])+corrected*255*alpha[...,None]+.5,0,255).astype(np.uint8)
        after[support] = blended[support]
        result = Image.fromarray(after)
        temporary = path.with_name(path.stem + '.replacement' + path.suffix)
        if path.suffix == '.webp':
            result.save(temporary, lossless=True, method=6)
        else:
            result.save(temporary, optimize=True)
        os.replace(temporary,path)
        decoded = np.asarray(Image.open(path).convert('RGB'))
        changed = int(np.count_nonzero(np.any(decoded[~support] != before[~support],axis=1)))
        assert changed == 0, path
        records.append({'path':path.relative_to(ROOT).as_posix(),'size':list(image.size),
                        'outsideChangedPixels':changed,'outsideBeforeSHA256':digest(before[~support]),
                        'outsideAfterSHA256':digest(decoded[~support])})
        if path.name == 'forest-day-sunny-docked.webp':
            for label,pixels in [('before',before),('after',decoded)]:
                Image.fromarray(pixels).crop((355,530,570,685)).resize((645,465)).save(OUT / f'left-grass-{label}.png')
                Image.fromarray(pixels).crop((1325,460,1505,610)).resize((540,450)).save(OUT / f'tax-obstacle-{label}.png')
    sheet = Image.new('RGB',(1680,1036),'#11202b')
    draw = ImageDraw.Draw(sheet)
    for i,n in enumerate(names):
        image = Image.open(ROOT / f'public/money-level/art/background/forest-{n}-docked.webp')
        x,y=i%4*420,i//4*259
        sheet.paste(image.resize((420,234)),(x,y+25)); draw.text((x+6,y+5),n,fill='white')
    sheet.save(OUT / 'background-16-matrix.jpg',quality=94)
    (OUT / 'background-audit.json').write_text(json.dumps({'polygon':POLYGON,'variants':records,
      'geometryAudit':'All dock, shoreline, pedestals, path, fence, bench, sky and mountain pixels are outside the mask and identical.',
      'taxObstacle':'Retained: right stump/fence; corridor runs in front of the fence.'},indent=2))
    print('16 production + 16 hybrid assets + clean master: exact outside-mask equality')

if __name__ == '__main__': main()
