"""Source-coordinate Tax candidates using the production radial mask."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'art-review/money-level/world-settings-v2'
ASSETS=['tax-stage-10-15-camp-plus.webp','tax-stage-15-20-small-white-tent.webp',
        'tax-stage-20-25-large-white-tent.webp','tax-stage-25-30-colored-tent.webp']
CANDIDATES=[('old',0,1),('up-15',-15,1),('up-25',-25,1),('up-35',-35,1),('up-25-97',-25,.97),('final',-35,.95)]

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    bg=Image.open(ROOT/'public/money-level/art/background/forest-day-sunny-docked.webp').convert('RGBA')
    sheet=Image.new('RGB',(6*450,4*310),'#142322'); d=ImageDraw.Draw(sheet)
    records=[]
    for row,file in enumerate(ASSETS):
        art=Image.open(ROOT/'public/money-level/art/houses'/file).convert('RGBA')
        y,x=np.mgrid[:art.height,:art.width]
        radius=np.sqrt(((x/art.width-.5)/.39)**2+((y/art.height-.61)/.35)**2)
        mask=np.clip((1-radius)/(1-.58),0,1)
        alpha=np.asarray(art.getchannel('A'))*mask
        art.putalpha(Image.fromarray(alpha.astype(np.uint8)))
        for col,(name,dy,scale) in enumerate(CANDIDATES):
            width=521.73*scale; height=width*art.height/art.width
            layer=Image.new('RGBA',bg.size)
            sprite=art.resize((round(width),round(height)),Image.Resampling.LANCZOS)
            source_x=1246.884 if name=='final' else 1258.884
            pos=(round(source_x-width/2),round(449.905+dy-height/2))
            layer.alpha_composite(sprite,pos)
            result=Image.alpha_composite(bg,layer)
            crop=result.crop((995,340,1535,680)).resize((450,283))
            sheet.paste(crop,(col*450,row*310+27)); d.text((col*450+6,row*310+6),f'{row+1} {name}',fill='white')
            if name in ['old','up-35','final']:
                result.crop((990,300,1545,690)).save(OUT/f'tax-{row}-{name}.png')
            a=np.asarray(layer.getchannel('A'))
            # Right stump/fence corner remains; test the central brown stump core.
            records.append({'asset':file,'candidate':name,'anchor':[source_x,449.905+dy],
                            'width':width,'maxStumpAlpha':int(a[507:543,1388:1430].max()),
                            'maxCorridorAlpha':int(a[575:597,1150:1360].max())})
    sheet.save(OUT/'tax-candidates.jpg',quality=95)
    (OUT/'tax-candidates.json').write_text(json.dumps(records,indent=2))
    print(OUT/'tax-candidates.jpg')

if __name__=='__main__': main()
