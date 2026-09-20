# Temporary house lighting recalibration

House time-of-day grades were interpolated approximately halfway toward identity. Day/Sunny remains identity, weather differences remain active, and statue values are unchanged. The temporary WebPs, visual frames, ground anchors, camera, and background CSS are unchanged.

## Browser QA

- 92 Desktop/Mobile scenarios
- 6 background projection measurements
- failed house/background requests: 0
- console/page errors: 0
- Fall Evening BEFORE/AFTER, four-time contact sheets, material contact sheet, and weather stress board are stored beside this report.

## Background Y projection

All measured backgrounds use uniform `cover` scale. Vertical position is 50%, so top and bottom crop are equal. Desktop crops the tall seasonal source symmetrically; Mobile shows nearly or completely the full source height. No CSS/background change was necessary.

| Layout | Season | Source | Container | Cover | Rendered | Top crop | Bottom crop | Visible source Y |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| desktop | spring | 1672×941 | 1280.00×572.00 | 0.765550 | 1280.00×720.38 | 74.19px | 74.19px | 96.91–844.09 |
| desktop | fall | 1672×941 | 1280.00×572.00 | 0.765550 | 1280.00×720.38 | 74.19px | 74.19px | 96.91–844.09 |
| desktop | winter | 1683×934 | 1280.00×572.00 | 0.760547 | 1280.00×710.35 | 69.18px | 69.18px | 90.95–843.05 |
| mobile | spring | 1672×941 | 914.39×508.00 | 0.546884 | 914.39×514.62 | 3.31px | 3.31px | 6.05–934.95 |
| mobile | fall | 1672×941 | 914.39×508.00 | 0.546884 | 914.39×514.62 | 3.31px | 3.31px | 6.05–934.95 |
| mobile | winter | 1683×934 | 914.39×508.00 | 0.543897 | 915.38×508.00 | 0.00px | 0.00px | 0.00–934.00 |
