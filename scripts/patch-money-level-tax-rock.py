"""Local Tax plot rock patch on top of completed LEFT/RIGHT work, exact outside-mask equality."""
from pathlib import Path
import argparse, json, subprocess, io, hashlib, importlib.util, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'art-review/money-level/tax-safe-frame-v2'
BASE='372425e43ca49ce50651ebbed4563180621fdc77';CROP=(975,400,1190,585)
POLYGON=[(1049,485),(1057,476),(1071,474),(1087,475),(1100,484),(1105,495),(1103,511),(1097,520),(1074,517),(1059,516),(1043,511),(1041,499)]
def baseline(path):return Image.open(io.BytesIO(subprocess.check_output(['git','show',f'{BASE}:{path.relative_to(ROOT).as_posix()}'],cwd=ROOT))).convert('RGB')
def main():
 p=argparse.ArgumentParser();p.add_argument('--candidate',required=True,type=Path);args=p.parse_args();OUT.mkdir(parents=True,exist_ok=True)
 names=[f'{t}-{w}' for t in ['morning','day','evening','night'] for w in ['sunny','cloudy','rain','storm']]
 paths=[ROOT/'reference/new_reference-clean-edges.png']+[ROOT/f'art-review/money-level/new-layout/hybrid/forest-{n}.png' for n in names]+[ROOT/f'public/money-level/art/background/forest-{n}-docked.webp' for n in names]
 master=baseline(paths[0]);donor=master.copy();crop=Image.open(args.candidate).convert('RGB').resize((215,185),Image.Resampling.LANCZOS);crop.save(OUT/'tax-rock-donor.png');donor.paste(crop,CROP[:2])
 mask=Image.new('L',master.size);ImageDraw.Draw(mask).polygon(POLYGON,fill=255);mask.save(OUT/'TAX_PLOT_ROCK_REMOVAL_MASK.png');support=np.asarray(mask)>0
 for previous in ['grass-mask.png','RIGHT_CORRIDOR_FENCE_MASK.png']:
  assert not np.any(support&(np.asarray(Image.open(ROOT/'art-review/money-level/world-settings-v2'/previous))>0))
 alpha=np.asarray(mask.filter(ImageFilter.GaussianBlur(1)),dtype=float)/255*support
 spec=importlib.util.spec_from_file_location('color',ROOT/'scripts/build-money-level-new-layout.py');color=importlib.util.module_from_spec(spec);spec.loader.exec_module(color)
 base_lab=color.srgb_to_lab(np.asarray(master).astype(np.float32)/255);donor_lab=color.srgb_to_lab(np.asarray(donor).astype(np.float32)/255);records=[]
 for path in paths:
  before=np.asarray(baseline(path));field=gaussian_filter(color.srgb_to_lab(before.astype(np.float32)/255)-base_lab,(14,14,0));corrected=color.lab_to_srgb(donor_lab+field)
  after=before.copy();blend=np.clip(before*(1-alpha[...,None])+corrected*255*alpha[...,None]+.5,0,255).astype('uint8');after[support]=blend[support]
  result=Image.fromarray(after);temp=path.with_name(path.stem+'.replacement'+path.suffix)
  result.save(temp,**({'lossless':True,'method':6} if path.suffix=='.webp' else {'optimize':True}));os.replace(temp,path)
  decoded=np.asarray(Image.open(path).convert('RGB'));assert np.array_equal(decoded[~support],before[~support]),path
  records.append({'path':path.relative_to(ROOT).as_posix(),'size':[1683,935],'outsideMaskDiff':0,'outsideSHA256':hashlib.sha256(decoded[~support].tobytes()).hexdigest()})
  if path.name=='forest-day-sunny-docked.webp':
   for label,pixels in [('before',before),('after',decoded)]:Image.fromarray(pixels).crop(CROP).resize((860,740)).save(OUT/f'tax-rock-{label}.png')
 (OUT/'tax-rock-audit.json').write_text(json.dumps({'baseline':BASE,'polygon':POLYGON,'bounds':mask.getbbox(),'files':records,'leftRightMasksPreserved':True},indent=2),encoding='utf-8')
 print('PASS 33 files: TAX mask only; outside new mask = 0; completed LEFT/RIGHT exact')
if __name__=='__main__':main()
