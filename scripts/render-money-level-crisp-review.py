"""Assemble read-only runtime screenshot comparisons; never edit game assets."""
import argparse
import shutil
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--input", type=Path, required=True)
args = parser.parse_args()
output = ROOT / "art-review/money-level/house-crisp-review"
output.mkdir(parents=True, exist_ok=True)
rows = [(stage, time, weather, kind) for stage in ("current", "max")
        for time, weather in (("evening", "sunny"), ("night", "sunny"), ("night", "thunderstorm"))
        for kind in ("brokerage", "tax")]
sheet = Image.new("RGB", (1440, len(rows) * 346), "#17201b")
draw = ImageDraw.Draw(sheet)
html = []
for i, (stage, time, weather, kind) in enumerate(rows):
    images = []
    stem = f"{stage}-{time}-{weather}"
    shutil.copyfile(args.input / f"{stem}-old-filter-{kind}.png", output / f"{stem}-old-filter-{kind}.png")
    for j, (mode, label) in enumerate((("off", "Ambient OFF"), ("washed", "Old washed WIP"), ("on", "New crisp"))):
        name = f"{stage}-{time}-{weather}-{mode}-{kind}.png"
        shutil.copyfile(args.input / name, output / name)
        image = Image.open(output / name).convert("RGB")
        sheet.paste(image.resize((480, 320)), (j * 480, i * 346 + 26))
        draw.text((j * 480 + 6, i * 346 + 5), f"{stage} {kind} {time}/{weather} / {label}", fill="white")
        images.append(f'<figure><img src="{name}"><figcaption>{label}</figcaption></figure>')
    html.append(f'<h2>{stage} {kind} {time}/{weather}</h2><section>{"".join(images)}</section>')
sheet.save(output / "comparison.jpg", quality=94)
(output / "review.html").write_text('<!doctype html><meta charset="utf-8"><title>Crisp ambient comparison</title><style>body{font:16px system-ui;background:#e9eddf;margin:20px}section{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0}img{width:100%}</style><h1>House ambient OFF / old washed WIP / new crisp</h1><p>Same world anchors. Old WIP captures use interrupted filters; OFF uses final base grade. Current and maximum stages retain existing fallback assets.</p>' + "".join(html), encoding="utf-8")
print(output)
