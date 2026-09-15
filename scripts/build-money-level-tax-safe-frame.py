"""Tax-only deterministic alpha extraction; original RGB artwork is never repainted."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import label, binary_closing, binary_fill_holes, distance_transform_edt

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'art-review/money-level/tax-safe-frame-v2'
NAMES=['tax-stage-10-15-camp-plus','tax-stage-15-20-small-white-tent',
       'tax-stage-20-25-large-white-tent','tax-stage-25-30-colored-tent']
# Ground blending is confined to the lower footprint. Tall roofs, flames,
# poles, rug and props are extracted at full alpha independently of this field.
GROUND=[
 [(180,630),(225,590),(340,555),(400,450),(620,365),(715,405),(1100,405),(1170,510),(1280,615),(1250,700),(1040,800),(900,865),(855,935),(635,935),(585,890),(230,880),(180,805)],
 [(180,660),(330,630),(425,600),(485,445),(560,420),(580,530),(1120,500),(1230,605),(1230,700),(1150,805),(945,820),(870,945),(630,945),(580,900),(205,915)],
 [(180,650),(260,550),(295,480),(350,485),(480,520),(1110,520),(1400,660),(1350,760),(980,850),(850,945),(650,940),(560,900),(180,910)],
 [(80,650),(100,590),(270,520),(300,425),(350,330),(445,345),(500,470),(520,610),(1030,540),(1230,530),(1460,560),(1440,780),(1300,840),(940,890),(860,945),(640,945),(530,915),(195,915),(155,800),(80,760)],
]

def main():
 OUT.mkdir(parents=True,exist_ok=True);records=[]
 for index,name in enumerate(NAMES):
  source=ROOT/f'public/money-level/art/houses/{name}.webp'
  original=Image.open(source).convert('RGB');rgb=np.asarray(original)
  # All four sources have uniform green grass behind warm/neutral artwork.
  warm=rgb[...,0].astype(int)-rgb[...,1].astype(int)>=-5
  components,count=label(binary_closing(warm,iterations=3))
  areas=np.bincount(components.ravel());keep=np.flatnonzero(areas>=300);keep=keep[keep!=0]
  core=binary_fill_holes(np.isin(components,keep))
  if index==3:
   # Green sleeping roll is an actual prop, not removable green background.
   protected=Image.new('L',original.size)
   ImageDraw.Draw(protected).polygon([(228,478),(233,450),(250,438),(320,435),(351,451),(358,490),(328,508),(248,505)],fill=255)
   core |= np.asarray(protected)>0
  silhouette=np.clip(1-distance_transform_edt(~core)/3,0,1)
  ground=Image.new('L',original.size);ImageDraw.Draw(ground).polygon(GROUND[index],fill=255)
  ground_alpha=np.asarray(ground.filter(ImageFilter.GaussianBlur(12)),dtype=float)/255
  alpha=np.rint(np.maximum(silhouette,ground_alpha)*255).astype('uint8')
  # No frame-edge grass, shadow or opaque rectangle survives extraction.
  assert not np.any(alpha[0]) and not np.any(alpha[-1]) and not np.any(alpha[:,0]) and not np.any(alpha[:,-1])
  result=original.convert('RGBA');result.putalpha(Image.fromarray(alpha))
  destination=ROOT/f'public/money-level/art/houses/{name}-alpha-v2.webp'
  result.save(destination,lossless=True,method=6)
  decoded=np.asarray(Image.open(destination).convert('RGBA'))
  assert np.array_equal(decoded[alpha>0,:3],rgb[alpha>0]),'Visible original RGB must be exact'
  Image.fromarray(alpha).save(OUT/f'{name}-alpha-mask.png')
  bbox=Image.fromarray(alpha).getbbox();core_bounds=Image.fromarray(core.astype('uint8')*255).getbbox()
  old_y,old_x=np.mgrid[:1024,:1536];radius=np.sqrt(((old_x/1536-.5)/.39)**2+((old_y/1024-.61)/.35)**2)
  old_alpha=np.clip((1-radius)/(1-.58),0,1)
  generic_radius=np.sqrt(((old_x/1536-.5)/.49)**2+((old_y/1024-.55)/.47)**2)
  generic_alpha=np.clip((1-generic_radius)/(1-.67),0,1)
  records.append({'name':name,'sourceMode':Image.open(source).mode,'oldCanvas':[1536,1024],'newCanvas':list(result.size),
   'sourceAlphaBounds':[0,0,1536,1024],'objectCoreBounds':list(core_bounds),'visibleAlphaBounds':list(bbox),
   'margins':{'top':bbox[1],'bottom':1024-bbox[3],'left':bbox[0],'right':1536-bbox[2]},
   'ground':[768,900],'groundCorrection':[0,0],'visibleRgbDiff':0,
   'oldCampMaskCorePixelsAtZeroAlpha':int(np.sum(core&(old_alpha==0))),
   'oldCampMaskCorePixelsBelowFullAlpha':int(np.sum(core&(old_alpha<1))),
   'oldCottageMaskCorePixelsAtZeroAlpha':int(np.sum(core&(generic_alpha==0))),
   'oldCottageMaskCorePixelsBelowFullAlpha':int(np.sum(core&(generic_alpha<1)))})
  yy,xx=np.indices((1024,1536));tiles=((xx//32+yy//32)%2)*35+165
  neutral=Image.fromarray(np.repeat(tiles[:,:,None],3,axis=2).astype('uint8')).convert('RGBA')
  review=Image.alpha_composite(neutral,result);d=ImageDraw.Draw(review)
  d.rectangle((0,0,1535,1023),outline='red',width=5);d.rectangle(bbox,outline='cyan',width=3)
  d.line((748,900,788,900),fill='magenta',width=4);d.line((768,880,768,920),fill='magenta',width=4)
  review.resize((768,512)).convert('RGB').save(OUT/f'safe-frame-{index}.jpg',quality=96)
  old_review=original.copy();old_draw=ImageDraw.Draw(old_review)
  old_draw.rectangle((0,0,1535,1023),outline='red',width=5)
  old_draw.rectangle(core_bounds,outline='cyan',width=3)
  old_draw.line((748,900,788,900),fill='magenta',width=4);old_draw.line((768,880,768,920),fill='magenta',width=4)
  old_review.resize((768,512)).save(OUT/f'safe-frame-{index}-source.jpg',quality=96)
 (OUT/'safe-frame-audit.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
 print(json.dumps(records,indent=2))
if __name__=='__main__':main()
