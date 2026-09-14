"""Assemble review screenshots and geometry overlays, not runtime edits."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'art-review/money-level/world-settings-v2'
def pts(points): return [(p['x'],p['y']) for p in points]
def sheet(file,frames,columns,size=(660,400)):
    image=Image.new('RGB',(columns*size[0],((len(frames)+columns-1)//columns)*size[1]),'#152124')
    d=ImageDraw.Draw(image)
    for i,(label,path) in enumerate(frames):
        x,y=i%columns*size[0],i//columns*size[1]
        frame=Image.open(path).convert('RGB');frame.thumbnail((size[0],size[1]-28))
        image.paste(frame,(x,y+28));d.text((x+6,y+6),label,fill='white')
    image.save(OUT/file,quality=95)

def main():
    geometry=json.loads((OUT/'world-geometry.json').read_text())
    bg=Image.open(ROOT/'public/money-level/art/background/forest-day-sunny-docked.webp').convert('RGBA')
    for mode in ['navigation','ceremony']:
        overlay=Image.new('RGBA',bg.size);d=ImageDraw.Draw(overlay)
        if mode=='navigation':
            d.polygon(pts(geometry['pond']),fill=(240,50,70,35),outline=(240,50,70,255))
            for region in geometry['legacy']:d.polygon(pts(region['points']),fill=(60,150,170,40),outline=(60,200,220,200))
            for name,polygon in geometry['opened'].items():
                d.polygon(pts(polygon),fill=(20,250,180,80),outline=(20,250,180,255));d.text(pts(polygon)[0],name,fill='white')
            for rect in geometry['obstacles']:
                x,y=rect['x'],rect['y'];d.rectangle((x,y,x+rect['width'],y+rect['height']),fill=(240,50,70,60),outline=(240,50,70,255))
            for a,neighbors in geometry['graph'].items():
                if a not in geometry['waypoints']:continue
                for b in neighbors:
                    if b in geometry['waypoints']:d.line([pts([geometry['waypoints'][a]])[0],pts([geometry['waypoints'][b]])[0]],fill=(255,240,30,230),width=3)
            route=['path_center','tax_front','tax_corridor','fence_opening','right_grass','ceremony_right']
            d.line(pts([geometry['waypoints'][name] for name in route]),fill=(255,255,255,255),width=7)
            for name in route:
                x,y=pts([geometry['waypoints'][name]])[0]
                d.ellipse((x-6,y-6,x+6,y+6),fill=(255,225,30,255))
                d.text((x-45,y+13),name,fill='white')
        for name,slot in geometry['ceremony'].items():
            d.polygon(pts(slot['polygon']),fill=(200,30,240,60),outline=(240,80,255,255))
            x,y=pts([slot['anchor']])[0];d.ellipse((x-7,y-7,x+7,y+7),fill=(255,255,255,255));d.text((x-65,y+14),name,fill='white')
            x,y=pts([slot['exit']])[0];d.rectangle((x-5,y-5,x+5,y+5),fill=(50,250,80,255))
        Image.alpha_composite(bg,overlay).save(OUT/f'{mode}-overlay.png')
    sheet('background-before-after.jpg',[(f'{area} {label}',OUT/f'{area}-{label}.png') for area in ['left-grass','tax-obstacle'] for label in ['before','after']],2,(645,490))
    sheet('tax-old-up-final.jpg',[(f'{asset} {mode}',OUT/f'tax-{asset}-{mode}.png') for asset in [0,2,3] for mode in ['old','up-35','final']],3,(555,418))
    sheet('tax-all-stages.jpg',[(f'Tax stage {stage}',OUT/f'tax-stage-{stage}.png') for stage in range(20)],4,(480,285))
    sheet('responsive-review.jpg',[(f'{width}px {mode}',OUT/f'viewport-{width}-{mode}.png') for width in [1320,980,768,390] for mode in ['default','custom']],2,(660,430))
    sheet('tax-banner-old-new.jpg',[(mode,OUT/f'tax-banner-{mode}.png') for mode in ['old','new']],2,(660,430))
    sheet('right-corridor-before-after.jpg',[(f'{scene} {label}',OUT/f'right-corridor-forest-{scene}-docked-{label}.png') for scene in ['day-sunny','evening-sunny','night-sunny','day-rain'] for label in ['before','after']],2,(1260,718))
    sheet('day-sunny-world-before-after.jpg',[(label,OUT/f'day-sunny-world-{label}.png') for label in ['before','after']],1,(1683,963))
    sheet('background-16-matrix.jpg',[(f'{t} {w}',ROOT/f'public/money-level/art/background/forest-{t}-{w}-docked.webp') for t in ['morning','day','evening','night'] for w in ['sunny','cloudy','rain','storm']],4,(560,340))
    files=[('LEFT stump/rock local repair; retained right stump','background-before-after.jpg'),
      ('RIGHT foreground fence removal: 300% crops in four appearances','right-corridor-before-after.jpg'),
      ('Day Sunny source scene before / after RIGHT patch (LEFT WIP retained)','day-sunny-world-before-after.jpg'),('16 appearances (outside both masks exact)','background-16-matrix.jpg'),
      ('Tax current / largest white / largest shipped artwork: old, Y-up, final','tax-old-up-final.jpg'),('All 20 Tax stage mappings','tax-all-stages.jpg'),
      ('Tax banner before / after','tax-banner-old-new.jpg'),('Navigation source map: cyan regions / yellow graph / red obstacles','navigation-overlay.png'),
      ('Three Ceremony zones / white anchors / green exits','ceremony-overlay.png'),('1320 / 980 / 768 / 390 DEFAULT + CUSTOM','responsive-review.jpg'),
      ('390 actual browser simulated touch to right','390-touch-right-gorani.png')]
    (OUT/'review.html').write_text('<!doctype html><meta charset="utf-8"><title>Money Level World Settings v2 review</title><style>body{background:#152124;color:#eee;font:15px system-ui;margin:24px}img{max-width:100%}a{color:#bce8de}</style><h1>Money Level World Settings v2</h1><p>Live Firebase login and real Android device QA not run. LEFT stump/rock and RIGHT foreground fence are intentionally removed in separate masks. Stump and rear fences remain. Outside both masks, decoded pixels equal starting main exactly. The white navigation route passes through the removed fence opening.</p>'+''.join(f'<h2>{title}</h2><a href="{file}"><img src="{file}"></a>' for title,file in files),encoding='utf-8')
    print(OUT/'review.html')

if __name__=='__main__':main()
