"""Supplement the runtime review with exact 300% roof/fire/lower-edge crops."""
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'art-review/money-level/tax-safe-frame-v2'
parts=[]
for name in ['current','small-white','largest-white','colored','max-fallback']:
 for detail,box in [('roof',(.1,0,.9,.45)),('fire',(0,.4,.5,.9)),('lower',(.05,.7,.95,1))]:
  pair=[]
  for mode in ['old','fixed']:
   image=Image.open(OUT/f'{name}-day-asset-{mode}.png');w,h=image.size
   crop=image.crop(tuple(round(v*(w if i%2==0 else h)) for i,v in enumerate(box)))
   filename=f'{name}-{detail}-{mode}-300.png';crop.resize((crop.width*3,crop.height*3),Image.Resampling.NEAREST).save(OUT/filename)
   pair.append(f'<figure><img src="{filename}"><figcaption>{mode} / 300%</figcaption></figure>')
  parts.append(f'<h2>{name} / {detail}</h2><div class="pair">'+''.join(pair)+'</div>')
source='<h2>Original opaque source vs alpha safe frame</h2>'+''.join(f'<div class="pair"><img src="safe-frame-{i}-source.jpg"><img src="safe-frame-{i}.jpg"></div>' for i in range(4))
responsive='<h2>All tent silhouettes at six viewports</h2>'+''.join(f'<h3>{w}px</h3><div class="pair">'+''.join(f'<figure><img src="{name}-viewport-{w}.png"><figcaption>{name}</figcaption></figure>' for name in ['small-white','largest-white','max-fallback'])+'</div>' for w in [1440,1320,1100,980,768,390])
html=(OUT/'review.html').read_text(encoding='utf-8').split('<!-- details -->')[0]
(OUT/'review.html').write_text(html+'<!-- details -->'+source+responsive+''.join(parts),encoding='utf-8')
print('30 detailed crops at 300%; four source/fixed safe-bound pairs added')
