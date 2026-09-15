"""Local fence donor applied on top of preserved LEFT-patch WIP.

Only RIGHT_CORRIDOR_FENCE_MASK can change; decoded production is lossless.
Baselines are archived under ignored private/ before any asset mutation.
"""
from pathlib import Path
import argparse, json, io, subprocess, os, hashlib, importlib.util
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'art-review/money-level/world-settings-v2'
BACKUP=ROOT/'private/money-level-world-v2-before-right-fence'
CROP=(1140,385,1560,615)
RIGHT_CORRIDOR_FENCE_POLYGONS=[
    [(1184,518),(1213,514),(1220,529),(1252,536),(1257,526),(1281,527),
     (1285,539),(1307,531),(1314,554),(1285,567),(1285,582),(1245,583),
     (1243,571),(1186,579)],
    [(1406,459),(1442,459),(1450,442),(1489,425),(1489,407),(1520,407),
     (1522,431),(1528,438),(1527,492),(1492,514),(1461,534),(1445,536),(1406,520)],
]
def digest(pixels):return hashlib.sha256(pixels.tobytes()).hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--candidate',type=Path,required=True);args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True);BACKUP.mkdir(parents=True,exist_ok=True)
    names=[f'{t}-{w}' for t in ('morning','day','evening','night') for w in ('sunny','cloudy','rain','storm')]
    paths=[ROOT/'reference/new_reference-clean-edges.png']
    paths += [ROOT/f'art-review/money-level/new-layout/hybrid/forest-{n}.png' for n in names]
    paths += [ROOT/f'public/money-level/art/background/forest-{n}-docked.webp' for n in names]
    for path in paths:
        backup=BACKUP/path.relative_to(ROOT);backup.parent.mkdir(parents=True,exist_ok=True)
        if not backup.exists():backup.write_bytes(path.read_bytes())
    master=Image.open(BACKUP/'reference/new_reference-clean-edges.png').convert('RGB')
    donor_crop=Image.open(args.candidate).convert('RGB').resize((CROP[2]-CROP[0],CROP[3]-CROP[1]),Image.Resampling.LANCZOS)
    donor_crop.save(OUT/'right-fence-donor.png')
    donor=master.copy();donor.paste(donor_crop,CROP[:2])
    mask=Image.new('L',master.size);draw=ImageDraw.Draw(mask)
    for polygon in RIGHT_CORRIDOR_FENCE_POLYGONS:draw.polygon(polygon,fill=255)
    # Occluded wood touches the stump cap. Preserve the stump silhouette
    # explicitly while erasing every visible fence post/rail behind it.
    draw.polygon([(1372,506),(1383,496),(1399,491),(1406,494),(1413,494),
      (1414,498),(1424,500),(1430,503),(1430,521),(1440,530),(1423,546),
      (1400,553),(1380,550),(1372,539)],fill=0)
    support=np.asarray(mask)>0
    alpha=np.asarray(mask.filter(ImageFilter.GaussianBlur(2)),dtype=np.float32)/255*support
    mask.save(OUT/'RIGHT_CORRIDOR_FENCE_MASK.png')
    left=np.asarray(Image.open(OUT/'grass-mask.png'))>0
    assert not np.any(left&support)
    union=left|support;Image.fromarray(union.astype(np.uint8)*255).save(OUT/'combined-removal-mask.png')
    spec=importlib.util.spec_from_file_location('color',ROOT/'scripts/build-money-level-new-layout.py')
    color=importlib.util.module_from_spec(spec);spec.loader.exec_module(color)
    base_lab=color.srgb_to_lab(np.asarray(master).astype(np.float32)/255)
    donor_lab=color.srgb_to_lab(np.asarray(donor).astype(np.float32)/255)
    records=[]
    for path in paths:
        image=Image.open(BACKUP/path.relative_to(ROOT)).convert('RGB');assert image.size==(1683,935)
        before=np.asarray(image).copy()
        field=gaussian_filter(color.srgb_to_lab(before.astype(np.float32)/255)-base_lab,(14,14,0))
        corrected=color.lab_to_srgb(donor_lab+field)
        after=before.copy()
        blended=np.clip(before*(1-alpha[...,None])+corrected*255*alpha[...,None]+.5,0,255).astype(np.uint8)
        after[support]=blended[support]
        result=Image.fromarray(after);temp=path.with_name(path.stem+'.replacement'+path.suffix)
        if path.suffix=='.webp':result.save(temp,lossless=True,method=6)
        else:result.save(temp,optimize=True)
        os.replace(temp,path)
        decoded=np.asarray(Image.open(path).convert('RGB'))
        assert np.array_equal(decoded[~support],before[~support]),path
        assert np.array_equal(decoded[left],before[left]),'LEFT WIP changed'
        # Cumulative equality against starting main, excluding only two masks.
        relative=path.relative_to(ROOT).as_posix()
        initial=np.asarray(Image.open(io.BytesIO(subprocess.check_output(['git','show',f'471d7866e5817e9a1691f6f6e33ea698f3dda428:{relative}'],cwd=ROOT))).convert('RGB'))
        assert np.array_equal(decoded[~union],initial[~union]),relative
        records.append({'path':relative,'size':list(image.size),'outsideRightMaskDiff':0,'outsideBothMasksDiff':0,
                        'leftPatchPreserved':True,'outsideBothBeforeSHA256':digest(initial[~union]),'outsideBothAfterSHA256':digest(decoded[~union])})
        if 'public/' in relative and any(n in relative for n in ['day-sunny','evening-sunny','night-sunny','day-rain']):
            for label,pixels in [('before',before),('after',decoded)]:
                Image.fromarray(pixels).crop(CROP).resize((1260,690)).save(OUT/f'right-corridor-{path.stem}-{label}.png')
                if path.stem=='forest-day-sunny-docked':Image.fromarray(pixels).save(OUT/f'day-sunny-world-{label}.png')
    (OUT/'right-fence-audit.json').write_text(json.dumps({'name':'RIGHT_CORRIDOR_FENCE_MASK','polygons':RIGHT_CORRIDOR_FENCE_POLYGONS,
       'leftMaskBounds':[386,552,540,677],'rightMaskBounds':list(mask.getbbox()),'rightSectionBounds':[[1184,514,1315,584],[1406,407,1529,537]],
       'variants':records,'retained':'Stump, rear fence, both pedestals, pond/shoreline/dock, path, trees and all pixels outside both masks.'},indent=2))
    print('33 files: RIGHT mask only; LEFT WIP exact; outside BOTH masks vs starting main = 0')
if __name__=='__main__':main()
