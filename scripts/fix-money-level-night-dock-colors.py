"""Color-only patch of four pinned approved runtime rasters. No resampling.

Apply with --apply; otherwise audit checked-in runtime files against f3919fd.
Lossless WebP encoding makes decoded pixels outside the wood mask exact.
"""
import argparse
import hashlib
import importlib.util
import io
import json
import os
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt

ROOT = Path(__file__).resolve().parents[1]
BASE = "f3919fdac7bf34624283854bcdbc2daea6b78363"
REVIEW = ROOT / "art-review/money-level/night-dock"
BACKGROUND = ROOT / "public/money-level/art/background"
WEATHER = {"sunny": (7., 10., 0), "cloudy": (6., 8., 0), "rain": (5.5, 7., 0), "storm": (5., 6., 1.5)}
# One immutable source silhouette search area: connector/deck/front fascias and
# six posts. Material selection below excludes all water, greenery and rocks.
POLYGONS = [
    [(950,706),(1039,675),(1057,678),(1161,718),(1174,716),(1180,729),(1276,765),(1280,783),(1206,816),(994,738),(951,718)],
    [(963,690),(970,683),(984,683),(990,690),(990,742),(982,750),(970,750),(963,744)],
    [(1043,653),(1051,648),(1061,648),(1065,653),(1065,681),(1043,679)],
    [(1075,734),(1083,725),(1094,725),(1100,730),(1100,789),(1093,797),(1082,798),(1075,792)],
    [(1157,691),(1162,685),(1173,685),(1179,690),(1179,730),(1157,722)],
    [(1183,787),(1189,780),(1200,780),(1207,786),(1207,840),(1200,848),(1189,848),(1183,842)],
    [(1272,748),(1278,740),(1289,740),(1296,746),(1296,800),(1288,808),(1279,808),(1272,802)],
]

def pinned(relative):
    return subprocess.check_output(["git", "show", f"{BASE}:{relative}"], cwd=ROOT)

def read(data):
    return np.asarray(Image.open(io.BytesIO(data)).convert("RGB"))

def wood_mask():
    master = read(pinned("reference/new_reference-clean-edges.png"))
    h,w = master.shape[:2]
    area = Image.new("L", (w,h));draw=ImageDraw.Draw(area)
    for polygon in POLYGONS: draw.polygon(polygon, fill=255)
    r,g,b = np.moveaxis(master.astype(np.float32),-1,0)
    # Painted brown material, including dark wood outlines; no blue water,
    # neutral rocks, green plants or foliage. Inward feather only, never expand.
    material = (r>g*1.035)&(g>b*1.035)&(r>15)
    support = (np.asarray(area)>0)&material
    return support.astype(np.float32)*np.clip(distance_transform_edt(support)/1.5,0,1), master

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--apply",action="store_true");args=parser.parse_args()
    spec=importlib.util.spec_from_file_location("appearance",ROOT/"scripts/build-money-level-new-layout.py")
    appearance=importlib.util.module_from_spec(spec);spec.loader.exec_module(appearance)
    mask,master=wood_mask();support=mask>0
    REVIEW.mkdir(parents=True,exist_ok=True)
    Image.fromarray(np.round(mask*255).astype(np.uint8)).save(REVIEW/"wood-mask.png")
    rows=[];sheet=Image.new("RGB",(3120,1036),"#151e21");d=ImageDraw.Draw(sheet)
    for i,(weather,(a,b,darken)) in enumerate(WEATHER.items()):
        relative=f"public/money-level/art/background/forest-night-{weather}-docked.webp"
        source=read(pinned(relative));lab=appearance.srgb_to_lab(source.astype(np.float32)/255)
        corrected=lab.copy()
        # Increase only missing warm chroma. Already-brown posts stay brown.
        # Retain source texture and plank separation; only Storm receives a tiny
        # midtone exposure reduction, keeping it darker than Rain.
        strength=mask*np.clip((lab[...,0]-6)/14,0,1)
        corrected[...,1]+=np.maximum(a-lab[...,1],0)*strength
        corrected[...,2]+=np.maximum(b-lab[...,2],0)*strength
        corrected[...,0]-=darken*strength
        rgb=np.clip(appearance.lab_to_srgb(corrected)*255+.5,0,255).astype(np.uint8)
        output=source.copy();output[support]=rgb[support]
        target=ROOT/relative
        if args.apply:
            temporary=target.with_suffix(".dock-tone.webp")
            Image.fromarray(output).save(temporary,format="WEBP",lossless=True,method=6,exact=True)
            os.replace(temporary,target)
        actual=np.asarray(Image.open(target).convert("RGB"))
        assert actual.shape==source.shape==(935,1683,3)
        assert np.array_equal(actual,output), "runtime patch differs from reproducible color-only output"
        diff=np.any(actual!=source,axis=-1)
        assert not np.any(diff&~support), "pixels outside wood mask changed"
        # Independent protected material classes and previous right-side cleanup.
        mr,mg,mb=np.moveaxis(master.astype(float),-1,0)
        water=(mb>mr*1.16)&(mb>mg*1.035)
        greenery=(mg>mr*1.10)
        assert not np.any(diff&(water|greenery)), "protected water or plants changed"
        assert np.array_equal(actual[:,1370:],source[:,1370:]), "right-side cleanup changed"
        final_lab=appearance.srgb_to_lab(actual.astype(np.float32)/255)
        delta_l=np.abs(final_lab[...,0]-lab[...,0])[support]
        assert float(delta_l.max())<darken+.5, "source luminance / illustration contrast must stay intact"
        before_edges=np.stack(np.gradient(lab[625:870,930:1320,0]),axis=-1)
        after_edges=np.stack(np.gradient(final_lab[625:870,930:1320,0]),axis=-1)
        edge_correlation=float(np.corrcoef(before_edges.ravel(),after_edges.ravel())[0,1])
        assert edge_correlation>.999, "dock edge/detail registration must remain intact"
        fixed=before_edges[2:-2,2:-2].ravel()
        shifts=[]
        for dy in range(-2,3):
            for dx in range(-2,3):
                moving=after_edges[2+dy:after_edges.shape[0]-2+dy,2+dx:after_edges.shape[1]-2+dx].ravel()
                shifts.append((float(np.corrcoef(fixed,moving)[0,1]),dx,dy))
        best=max(shifts)
        assert best[1:]==(0,0), "dock geometry shifted"
        core=mask==1
        rows.append({"weather":weather,"asset":relative,"sourceSize":[1683,935],"changedWoodPixels":int(diff.sum()),"outsideMaskChangedPixels":int((diff&~support).sum()),"waterOrGreeneryChangedPixels":int((diff&(water|greenery)).sum()),"rightCleanupChangedPixels":int(np.any(actual[:,1370:]!=source[:,1370:],axis=-1).sum()),"maxLuminanceDelta":round(float(delta_l.max()),4),"edgeCorrelation":round(edge_correlation,8),"geometryOffset":list(best[1:]),"midtoneDarkenLab":darken,"beforeMedianLab":[round(float(n),3) for n in np.median(lab[core],axis=0)],"afterMedianLab":[round(float(n),3) for n in np.median(final_lab[core],axis=0)],"encoding":"lossless WebP","bytes":target.stat().st_size})
        for row,pixels,label in [(0,source,"BEFORE"),(1,actual,"AFTER")]:
            crop=Image.fromarray(pixels).crop((930,625,1320,870)).resize((780,490),Image.Resampling.NEAREST)
            sheet.paste(crop,(i*780,row*518+28));d.text((i*780+8,row*518+8),f"Night {weather} / {label} / 200%",fill="white")
    unchanged=[]
    for time in ["morning","day","evening"]:
        for weather in WEATHER:
            relative=f"public/money-level/art/background/forest-{time}-{weather}-docked.webp"
            data=(ROOT/relative).read_bytes();assert data==pinned(relative)
            unchanged.append({"asset":relative,"sha256":hashlib.sha256(data).hexdigest()})
    sheet.save(REVIEW/"before-after-200-percent.jpg",quality=97,subsampling=0)
    preview=Image.fromarray(master.copy());overlay=np.asarray(preview).copy();overlay[support]=[255,50,80]
    Image.fromarray(overlay).crop((930,625,1320,870)).resize((780,490),Image.Resampling.NEAREST).save(REVIEW/"mask-overlay.png")
    audit={"sourceCommit":BASE,"method":"Lab chroma floor; source L* retained except Storm midtones -1.5; no resize/warp/drawing", "commonPolygons":POLYGONS,"maskBounds":list(Image.fromarray((support*255).astype(np.uint8)).getbbox()),"maskPixels":int(support.sum()),"variants":rows,"unchangedNonNightAssets":unchanged}
    (REVIEW/"audit.json").write_text(json.dumps(audit,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":"PASS","nightAssets":4,"unchangedNonNightAssets":12,"outsideMaskDiff":0,"maskPixels":int(support.sum()),"variants":rows},indent=2))

if __name__=="__main__":main()
