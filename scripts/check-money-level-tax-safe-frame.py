"""Read-only decoded-pixel audit against the completed PR before this follow-up."""
from pathlib import Path
import io,json,subprocess
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'art-review/money-level/tax-safe-frame-v2'
record=json.loads((OUT/'tax-rock-audit.json').read_text())
mask=np.asarray(Image.open(OUT/'TAX_PLOT_ROCK_REMOVAL_MASK.png'))>0
for name in ['LEFT_FINISH_MASK','TAX_FRONT_FINISH_MASK']:
 mask |= np.asarray(Image.open(ROOT/f'art-review/money-level/compact-finish-v3/{name}.png'))>0
for entry in record['files']:
 before=np.asarray(Image.open(io.BytesIO(subprocess.check_output(['git','show',f"{record['baseline']}:{entry['path']}"],cwd=ROOT))).convert('RGB'))
 after=np.asarray(Image.open(ROOT/entry['path']).convert('RGB'))
 assert before.shape==after.shape==(935,1683,3)
 assert np.array_equal(before[~mask],after[~mask]),entry['path']
 assert np.any(before[mask]!=after[mask]),entry['path']
for entry in json.loads((OUT/'safe-frame-audit.json').read_text()):
 source=np.asarray(Image.open(ROOT/f"public/money-level/art/houses/{entry['name']}.webp").convert('RGB'))
 fixed=Image.open(ROOT/f"public/money-level/art/houses/{entry['name']}-alpha-v2.webp").convert('RGBA')
 pixels=np.asarray(fixed);alpha=pixels[...,3];visible=alpha>0
 assert list(fixed.getbbox())==entry['visibleAlphaBounds']
 assert np.array_equal(source[visible],pixels[visible,:3])
 assert not np.any(alpha[0]) and not np.any(alpha[-1]) and not np.any(alpha[:,0]) and not np.any(alpha[:,-1])
 # The first occupied row of each subject core (roof peaks on tents) is full alpha.
 y=entry['objectCoreBounds'][1]
 assert np.any(alpha[y]==255)
print('PASS: four RGB silhouettes safe-framed; 33 backgrounds outside Tax + finishing masks exact; newest strict finishing audit is separate')
