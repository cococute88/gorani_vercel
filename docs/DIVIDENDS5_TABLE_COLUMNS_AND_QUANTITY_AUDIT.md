# DIVIDENDS-5 Table Columns And Quantity Audit

Date: 2026-06-14

## 1. Read Files

- `components/dividend/DividendHoldingsTable.tsx`
- `components/dividend/DividendPage.tsx`
- `components/dividend/DividendSummaryCards.tsx`
- `components/dividend/MonthlyDividendChart.tsx`
- `lib/dividend-holdings-from-portfolio.ts`
- `lib/mock-dividend-data.ts`
- `lib/portfolio-types.ts`
- `lib/portfolio-store.ts`
- `lib/banksalad-parser.ts`
- `lib/holding-ticker-normalizer.ts`
- `lib/quote-client.ts`
- `lib/quote-types.ts`
- `lib/format.ts`
- `lib/portfolio-live-quotes.ts`
- `components/portfolio/PortfolioPage.tsx`
- `components/portfolio/PortfolioParsePreview.tsx`
- `components/portfolio/PortfolioQuoteStatusPanel.tsx`
- `scripts/check-dividend-holdings-groups.mjs`
- `scripts/check-portfolio-parser.mjs`
- `docs/fixtures/portfolio-parser/README.md`
- `docs/fixtures/portfolio-parser/anonymized-real-sample.md`
- `docs/DIVIDENDS4_ROW_PRESERVING_CLASSIFICATION_FIX.md`
- `docs/AUDIT.md`

Note: `scripts/check-portfolio-parser-private.mjs` is not present in this repository. The package script `check:portfolio-parser:private` runs `scripts/check-portfolio-parser.mjs --private ...`.

## 2. Current Quantity/Average-Cost Availability

| Field | Status | Evidence |
| --- | --- | --- |
| `quantity` | available and parsed when source column exists | `Holding.quantity?` exists. Parser aliases include `수량`, `보유수량`, `보유 수량`, `quantity`, `qty`, `shares`. Generated parser fixtures populate it. |
| `averageCost` | not stored in snapshot | `Holding` has no official average-cost field and the Banksalad parser does not populate it. Dividend display only preserves an already stored extra numeric field if one exists. |
| `averageCostKRW` | not stored in snapshot | No official `Holding` field and no parser population. Display can format it only if an existing stored object already contains this extra field. |
| `averageCostUSD` | not stored in snapshot | No official `Holding` field and no parser population. Display can format it only if an existing stored object already contains this extra field. |
| `currentPrice` | available and parsed when source column exists | `Holding.currentPrice?` exists. Parser aliases include `현재가`, `평가단가`, `단가`, `price`, `current price`. |
| `currentPriceKRW` | not stored in snapshot | No official `Holding` field and no parser population. Display can format it only if an existing stored object already contains this extra field. |
| `currentPriceUSD` | not stored in snapshot | No official `Holding` field and no parser population. Display can format it only if an existing stored object already contains this extra field. |
| `currency` | available and parsed when source column exists | `Holding.currency?` exists. Parser aliases include `통화`, `화폐`, `currency`, `ccy`. |

The uploaded/private fixture has no explicit quantity, currency, ticker/code, current-price, or average-cost columns. Its private parser run reported `quantity: 0`, `currency: 0`, `currentPrice: 0`, `valueOriginalCurrency: 0`, and `canRevalue: 0`.

## 3. Parser Audit Result

No parser core behavior was changed. The current parser can populate quantity/currency/current price from explicit columns, but the private Banksalad workbook header pattern is:

- `투자상품종류`
- `금융사`
- `상품명`
- `투자원금`
- `평가금액`
- `수익률`
- `가입일자`
- `만기일자`

Because the private source lacks quantity and average-cost columns, the parser cannot create those values without estimating them. This step intentionally does not reverse-calculate quantity or average cost from valuation/current price.

## 4. Column Order Change

Both `/dividends` holding tables now render desktop columns in this order:

```txt
티커 / 종목명 / 수량 / 평균단가 / 현재가 / 내 배당률 / 비중 / 평가금액 / 예상 연배당
```

The mobile card view was also updated to show the same new fields in compact card form.

## 5. Current Price Display Rule

Display priority:

1. already stored `currentPriceUSD` or `currentPriceKRW` extra field, if present;
2. parsed/stored `Holding.currentPrice`, if present;
3. `—`.

No new quote API route or new quote-fetching path was added to `/dividends`. The existing `/portfolio-manager` quote status path remains separate and reference-only.

## 6. Quantity/Average-Cost Display Rule

- `quantity` displays only from the stored parsed value.
- `averageCost`, `averageCostUSD`, `averageCostKRW`, or `avgPrice` displays only if such a real stored numeric field already exists on the holding object.
- Missing quantity or average cost displays `—`.
- No estimated quantity or estimated average cost is shown.

## 7. Weight Calculation Rule

`비중` is calculated per visible table:

```txt
row.valueKRW / tableTotalKRW * 100
```

The taxable table uses `taxableTotalKRW`; the tax-advantaged table uses `taxAdvantagedTotalKRW`. A zero/invalid denominator displays `—`.

## 8. Tests Added

`scripts/check-dividend-holdings-groups.mjs` now covers:

- quantity, average cost, current price, and currency preservation when provided;
- missing quantity/average cost remaining unavailable for `—` display;
- table weight calculation at 75% / 25% and zero-denominator handling;
- duplicate SPY rows remaining separate.

## 9. Visual Verification

Dev server: `http://localhost:3135`.

Verified by browser inspection:

- `/dividends` renders both tables with the requested header order.
- `/dividends` has no page-level horizontal overflow at the current desktop viewport.
- `/dividends` showed no visible ticker `—` and no cash-like/MMF row in the available browser state.
- `/portfolio-manager` renders without page-level horizontal overflow.
- `/portfolio-manager` still renders the snapshot/parse area and Korean ETF quoteTicker text.

The in-app browser had no persisted portfolio snapshot rows, so exact visible SPY row examples could not be confirmed from localStorage state. Browser policy also blocked temporary `javascript:` storage injection. The row-specific checks are therefore covered by the added regression tests rather than a live persisted snapshot visual.

## 10. Remaining Limitations

- The private Banksalad sample still has no quantity, currency, current-price, or average-cost source columns.
- `averageCost*` fields are not official `Holding` schema fields and are not parsed by `banksalad-parser.ts`.
- `/dividends` does not fetch live quotes in this step, so current price appears only when already stored on the holding row.
- The display table no longer shows the previous `예상 배당률` and `태그` desktop columns because the requested original-like order does not include them.

## 11. Next Recommendation

If a future Banksalad/broker export contains explicit quantity and average-cost columns, add a private fixture first, then extend parser aliases only for observed headers such as `잔고수량`, `평단`, `매입단가`, or `취득단가` without estimating missing values.
