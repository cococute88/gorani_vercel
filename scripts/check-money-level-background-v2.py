"""Read-only cumulative audit against the starting main; no image regeneration."""
from pathlib import Path
import io, json, subprocess
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'art-review/money-level/world-settings-v2'
START = '471d7866e5817e9a1691f6f6e33ea698f3dda428'
left = np.asarray(Image.open(OUT / 'grass-mask.png')) > 0
right = np.asarray(Image.open(OUT / 'RIGHT_CORRIDOR_FENCE_MASK.png')) > 0
assert left.shape == right.shape == (935, 1683)
assert not np.any(left & right), 'Removal masks must be independent'
union = left | right
assert np.array_equal(union, np.asarray(Image.open(OUT / 'combined-removal-mask.png')) > 0)
assert right[550, 1205] and right[465, 1500], 'Both blocking fence sections must be removed'
assert not right[560, 1470], 'Right pedestal must remain outside mask'
records = json.loads((OUT / 'right-fence-audit.json').read_text())['variants']
assert len(records) == 33
for record in records:
    path = record['path']
    before = np.asarray(Image.open(io.BytesIO(subprocess.check_output(
        ['git', 'show', f'{START}:{path}'], cwd=ROOT))).convert('RGB'))
    after = np.asarray(Image.open(ROOT / path).convert('RGB'))
    assert before.shape == after.shape == (935, 1683, 3), path
    assert np.array_equal(before[~union], after[~union]), f'Outside-mask mutation: {path}'
    assert np.any(before[right] != after[right]), f'Fence removal missing: {path}'
print('PASS: 16 production + 16 hybrid + master; independent masks; outside BOTH masks diff = 0')
