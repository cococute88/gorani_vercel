# ASSET-ALLOCATION-DONUT-GROUPED-CATEGORY-FIX2

## 1. Root cause

`ASSET-ALLOCATION-DONUT-STREAMLIT-RESTORE-1`에서 `/portfolio` 중앙 도넛을 자산군 도넛으로 교체했지만, pure helper가 최종 자산군이 아니라 `holdingDisplayLabel` 결과를 집계 키로 사용했다. 그 결과 `키움TQQQ1`, `키움TQQQ3`, `키움QLD`, `토스SPYM`처럼 계좌/브로커 접두어가 붙은 개별 보유종목명이 그대로 슬라이스와 legend 라벨이 되었다.

## 2. Files read

- `lib/asset-allocation-donut.ts`
- `components/portfolio/AssetAllocationDonut.tsx`
- `components/DonutChartCard.tsx`
- `app/portfolio/page.tsx`
- `components/portfolio/PortfolioPage.tsx`
- `scripts/check-asset-allocation-donut.mjs`
- `original/logic/tracker.py`
- `original/pages_app/2_asset_tracker.py`
- `docs/ASSET_ALLOCATION_DONUT_STREAMLIT_RESTORE1.md`
- `docs/AUDIT.md`
- `package.json`

## 3. Changed files

- `lib/asset-allocation-donut.ts`
- `scripts/check-asset-allocation-donut.mjs`
- `docs/ASSET_ALLOCATION_DONUT_GROUPED_CATEGORY_FIX2.md`
- `docs/AUDIT.md`

## 4. Grouping rules

`buildAssetAllocationDonut` now groups valid positive KRW values by the final normalized `AssetTypeKey`, not by raw holding display labels. The public slice keeps chart compatibility through `name`/`value` while also exposing category-oriented fields:

- `key`
- `label`
- `valueKRW`
- `percent`
- `assetType`
- `assetTypeLabel`
- `superGroup`
- `sourceHoldingCount`

Unknown holdings are aggregated into `기타`; they are not emitted as product-name slices.

## 5. Relation to Streamlit original

The helper still follows the original Streamlit classification order from `get_asset_type` and grouping adjacency from `get_super_group` / `sort_tags_by_super_group`:

1. dollar
2. cash
3. leverage
4. nasdaq
5. spy
6. dividend
7. other

The fix preserves the Streamlit-style super group sorting idea: super group total descending, then asset category total descending, then a stable category-label fallback.

## 6. Regression tests

`check:asset-allocation-donut` now covers the reported bug directly:

- `키움TQQQ1`, `키움TQQQ3`, `키움QLD`, `토스QLD` aggregate into one `나스닥 레버리지` slice.
- `QQQ`, `ACE미국나스닥100`, `RISE미국나스닥100` aggregate into one `나스닥` slice.
- `SPY`, `VOO`, `SPYM`, `ACE미국S&P500`, `RISE미국S&P500` aggregate into one `S&P500` slice.
- Mixed portfolios preserve total KRW and approximately 100% rounded percentages.
- Korean ETF wrapper names do not appear as slice labels.
- The exact user complaint example emits only `나스닥 레버리지`, `S&P500`, and `배당` category labels.

## 7. Visual verification

The UI component already renders whatever category slices the helper returns. Because the data contract remains compatible with `DonutChartCard` (`name`, `value`, `color`, `amountKRW`), no layout or theme changes were needed. The expected visual outcome is that the middle `자산군 비중` donut legend shows category names such as `나스닥 레버리지`, `나스닥`, `S&P500`, `배당`, `달러`, `현금`, and `기타`, not raw product/account names. Local dev verification reached `/portfolio` with HTTP 200; screenshot-based desktop/mobile/light/dark inspection was not captured in this container because Playwright is not installed.

## 8. Remaining limitations

- This is not ETF look-through decomposition. ETF TOP100 exposure logic remains separate.
- Classification remains keyword-based and intentionally conservative.
- Rounded displayed percentages can differ from 100.0 by a small decimal rounding amount.

## 9. Next recommendation

If users add new wrapper naming patterns, extend only the category keyword tests first, then add the minimal corresponding classification keyword. Do not reintroduce raw holding labels into the asset allocation donut.
