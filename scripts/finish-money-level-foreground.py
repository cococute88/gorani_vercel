"""Local grass finishing on the completed PR; no edits outside named masks."""
from pathlib import Path
import io,json,subprocess,importlib.util,os,sys
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from scipy.ndimage import gaussian_filter
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'art-review/money-level/compact-finish-v3'
BASE='620579cf1db39018182e4937e5ffca405e458514'
PATCHES=[('LEFT_FINISH_MASK',(380,535,595,685),[(468,560),(584,560),(584,649),(468,649)]),
 ('TAX_FRONT_FINISH_MASK',(985,440,1170,555),[(985,445),(1169,445),(1169,554),(985,554)])]
def base(path):return Image.open(io.BytesIO(subprocess.check_output(['git','show',f'{BASE}:{path}'],cwd=ROOT))).convert('RGB')
def paths():
 names=[f'{t}-{w}' for t in ['morning','day','evening','night'] for w in ['sunny','cloudy','rain','storm']]
 return ['reference/new_reference-clean-edges.png']+[f'art-review/money-level/new-layout/hybrid/forest-{n}.png' for n in names]+[f'public/money-level/art/background/forest-{n}-docked.webp' for n in names]
def main():
 OUT.mkdir(exist_ok=True);union=np.zeros((935,1683),bool)
 for name,crop,poly in PATCHES:
  mask=Image.new('L',(1683,935));ImageDraw.Draw(mask).polygon(poly,fill=255)
  if '--audit' in sys.argv:
   assert np.array_equal(np.asarray(mask),np.asarray(Image.open(OUT/f'{name}.png')))
  else: mask.save(OUT/f'{name}.png')
  union|=np.asarray(mask)>0
 if '--audit' in sys.argv:
  for path in paths():
   before=np.asarray(base(path));after=np.asarray(Image.open(ROOT/path).convert('RGB'))
   assert before.shape==after.shape==(935,1683,3)
   assert np.array_equal(before[~union],after[~union]),path
  print('PASS: 33 backgrounds outside finishing masks exact; dock/pond/pedestals/corridor preserved');return
 spec=importlib.util.spec_from_file_location('color',ROOT/'scripts/build-money-level-new-layout.py');color=importlib.util.module_from_spec(spec);spec.loader.exec_module(color)
 master=base(paths()[0]);donor=master.copy()
 for (name,crop,poly),input_path in zip(PATCHES,sys.argv[1:]):
  original_size=(215,150) if name.startswith('LEFT') else (185,115)
  pixels=np.asarray(Image.open(input_path).convert('RGB').resize(original_size,Image.Resampling.LANCZOS))
  width,height=crop[2]-crop[0],crop[3]-crop[1]
  pixels=np.pad(pixels,((0,height-pixels.shape[0]),(0,width-pixels.shape[1]),(0,0)),mode='edge')
  image=Image.fromarray(pixels);image.save(OUT/f'{name}-donor.png');donor.paste(image,crop[:2])
 alpha=np.asarray(Image.fromarray(union.astype('uint8')*255).filter(ImageFilter.GaussianBlur(1)),float)/255*union
 master_lab=color.srgb_to_lab(np.asarray(master).astype('float32')/255);donor_lab=color.srgb_to_lab(np.asarray(donor).astype('float32')/255);records=[]
 for path in paths():
  before=np.asarray(base(path));field=gaussian_filter(color.srgb_to_lab(before.astype('float32')/255)-master_lab,(14,14,0))
  corrected=color.lab_to_srgb(donor_lab+field);after=before.copy()
  blended=np.clip(before*(1-alpha[...,None])+corrected*255*alpha[...,None]+.5,0,255).astype('uint8');after[union]=blended[union]
  target=ROOT/path;temporary=target.with_name(target.stem+'.finish'+target.suffix)
  Image.fromarray(after).save(temporary,**({'lossless':True,'method':6} if target.suffix=='.webp' else {'optimize':True}));os.replace(temporary,target)
  decoded=np.asarray(Image.open(target).convert('RGB'));assert np.array_equal(decoded[~union],before[~union])
  records.append({'path':path,'outsideMaskDiff':0,'size':[1683,935]})
  if path.endswith('forest-day-sunny-docked.webp'):
   for name,crop,poly in PATCHES:
    for label,pixels in [('before',before),('after',decoded)]:
     im=Image.fromarray(pixels).crop(crop);im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST).save(OUT/f'{name}-{label}-300.png')
 (OUT/'foreground-audit.json').write_text(json.dumps({'baseline':BASE,'masks':[{'name':n,'bounds':Image.open(OUT/f'{n}.png').getbbox(),'polygon':p} for n,c,p in PATCHES],'files':records},indent=2),encoding='utf8')
 print('PASS: local grass finishing in 16 production +16 hybrid +master; outside masks=0')
if __name__=='__main__':main()
