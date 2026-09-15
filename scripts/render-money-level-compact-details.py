from pathlib import Path
from PIL import Image
OUT=Path(__file__).resolve().parents[1]/'art-review/money-level/compact-finish-v3'
parts=[]
for kind in ['brokerage','tax']:
 for detail in ['card','header','body']:
  pair=[]
  for mode in ['before','after']:
   im=Image.open(OUT/f'1440-day-CUSTOM-{kind}-{mode}.png')
   if detail=='header': im=im.crop((0,0,im.width,24))
   if detail=='body': im=im.crop((0,20,im.width,im.height))
   name=f'{kind}-{detail}-{mode}-300.png';im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST).save(OUT/name);pair.append(f'<img src="{name}">')
  parts.append(f'<h2>{kind} / {detail} / 300%</h2><div class="pair">'+''.join(pair)+'</div>')
html=(OUT/'review.html').read_text(encoding='utf8').split('<!-- details -->')[0]
for area,box in [('brokerage-ground',(450,525,645,690)),('tax-fire-front',(985,440,1260,615))]:
 pair=[]
 for mode in ['before','after']:
  im=Image.open(OUT/f'1440-day-CUSTOM-{mode}.png');scale=max(im.width/1683,im.height/935);cx=(1683*scale-im.width)/2;cy=(935*scale-im.height)/2
  crop=im.crop(tuple(round(v*scale-(cx if i%2==0 else cy)) for i,v in enumerate(box)))
  name=f'{area}-{mode}-300.png';crop.resize((crop.width*3,crop.height*3),Image.Resampling.NEAREST).save(OUT/name);pair.append(f'<img src="{name}">')
 parts.append(f'<h2>{area} / scene composite / 300%</h2><div class="pair">'+''.join(pair)+'</div>')
(OUT/'review.html').write_text(html+'<!-- details -->'+''.join(parts),encoding='utf8')
print('12 card/header/body crops at 300% added')
