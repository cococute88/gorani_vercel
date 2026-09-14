"""Assemble captured browser screenshots; never modifies runtime artwork."""
from pathlib import Path
import json, shutil, sys, tempfile
from PIL import Image, ImageDraw

raw = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.gettempdir()) / "money-level-night-final-raw"
out = Path("art-review/money-level/night-final")
out.mkdir(parents=True, exist_ok=True)

def sheet(filename, frames, cols, tile=(480, 360)):
    rows = (len(frames) + cols - 1) // cols
    c = Image.new("RGB", (cols * tile[0], rows * tile[1]), "#19211f")
    d = ImageDraw.Draw(c)
    for i, (label, source) in enumerate(frames):
        x, y = i % cols * tile[0], i // cols * tile[1]
        im = Image.open(source).convert("RGB")
        im.thumbnail((tile[0], tile[1] - 28))
        c.paste(im, (x, y + 28))
        d.text((x + 5, y + 7), label, fill="white")
    c.save(out / filename, quality=95, subsampling=0)

for kind in ["brokerage", "tax"]:
    sheet(f"night-{kind}.jpg", [(f"{stage} / {mode} / Night {weather}", raw / "final" / f"{stage}-{weather}-{mode}-{kind}.png")
        for stage in ["current", "max"] for mode in ["off", "old-crisp", "new-tuned"] for weather in ["sunny", "rain", "thunderstorm"]], 3)
sheet("geometry-source-250-percent.jpg", [(f"{art}: {label}", raw / "experiments" / file)
    for art in ["small", "expanded", "proper", "fallback-camp"]
    for label, file in [("House OFF", "geometry-house-off.png"), ("Old anchor", f"geometry-{art}-0-0.png"), ("New anchor +36/-44", f"geometry-{art}-36--44.png")]], 3, (900, 628))
sheet("geometry-viewports.jpg", [(f"{w}x{h} / {mode}", raw / "final" / f"geometry-{w}-{h}-{mode}.png")
    for w in [1440,1320,1100,980,768] for h in [760,1100] for mode in ["house-off","old-anchor","new-anchor"]], 3, (450,328))
sheet("brokerage-stages.jpg", [(f"Brokerage level {level} / ambient OFF", raw / "final" / f"stage-{level}-ambient-off.png") for level in [2,7,8,9,10,11,19]], 2, (660,328))
sheet("night-blend-modes.jpg", [(f"{stage} / {weather} / {mode}", raw / "blends" / f"{stage}-{weather}-{mode}-brokerage.png")
    for stage in ["current","max"] for weather in ["sunny","rain","thunderstorm"]
    for mode in ["off","current-crisp","multiply","soft-light","overlay","hard-light"]], 6, (360,268))
shutil.copyfile(raw / "experiments" / "geometry-candidates.json", out / "geometry-candidates.json")
shutil.copyfile(raw / "final" / "results.json", out / "results.json")
(out / "review.html").write_text("""<!doctype html><meta charset="utf-8"><title>PR #232 final visual review</title>
<style>body{background:#19211f;color:#eee;font:15px system-ui;margin:20px}img{width:100%}a{color:#a9cddd}h2{font-size:20px}</style>
<h1>PR #232 — Night integration / Brokerage stump clearance</h1>
<p>Night panels use the same new world anchor. Rows: ambient OFF / historical 6d0ff93 crisp / new tuned.
Columns: Night Sunny / Rain / Storm. Current and max stage, followed by Tax. Click images to inspect original sheet resolution.</p>
""" + "\n".join(f'<h2>{title}</h2><a href="{file}"><img src="{file}"></a>' for title,file in [
    ("A. Current/max Brokerage Night", "night-brokerage.jpg"),
    ("Tax current/max Night", "night-tax.jpg"),
    ("Native SVG blend experiments (1.10 contrast, before final practical-light protection)", "night-blend-modes.jpg"),
    ("B. Stump at 250% — all four resolved Brokerage artwork silhouettes", "geometry-source-250-percent.jpg"),
    ("1440 / 1320 / 1100 / 980 / 768 × two heights — ambient OFF", "geometry-viewports.jpg"),
    ("Existing stage artwork and unchanged max fallback mapping", "brokerage-stages.jpg")]) +
    '<p>Final: multiply 18–22%, hard-light 15%, contrast 1.12; Night saturation .88/.84/.82/.80. SourceAlpha restored once. '
    'All 20 Brokerage stage mappings and 10 viewport ratios verified. Actual Android regression NOT RUN.</p>', encoding="utf-8")
print(out.resolve())
