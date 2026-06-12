# Step 3B Portfolio Parser Fields

Update date: 2026-06-12

## Files Read

Original reference, read only:

- `original/pages_app/2_asset_tracker.py`
- `original/logic/tracker.py`
- `original/logic/tracker_performance.py`

Current Next.js files:

- `app/portfolio-manager/page.tsx`
- `app/portfolio/page.tsx`
- `components/portfolio/ExcelUploadCard.tsx`
- `components/portfolio/PortfolioParsePreview.tsx`
- `components/portfolio/SnapshotHistory.tsx`
- `components/portfolio/PortfolioQuoteStatusPanel.tsx`
- `lib/banksalad-parser.ts`
- `lib/portfolio-store.ts`
- `lib/portfolio-aggregate.ts`
- `lib/use-portfolio-view.ts`
- `lib/ticker-mapper.ts`
- `lib/portfolio-tags.ts`
- `lib/portfolio-live-quotes.ts`
- `lib/mock-portfolio-data.ts`
- `lib/portfolio-types.ts`

No `target/` directory was present or created. Files under `original/` were not modified.

## Original Tracker Logic

The original Streamlit asset tracker is value-based:

- Pasted Banksalad text is parsed into product names and KRW amounts.
- Monthly snapshots are stored as `{ "YYYY-MM": { tag: amountKRW } }`.
- Tags are classified into cash, dollar, leverage, Nasdaq, SPY, dividend, and other groups.
- Small or untagged rows are grouped into `기타`.
- Performance analysis maps tags to tickers only for a virtual backtest. It infers quantities from the latest KRW valuation and current market prices, so it is not exact holding accounting.

## Parser Audit

`lib/banksalad-parser.ts` currently parses:

- Finance section: `3.재무현황`
- Investment section: `5.투자현황`
- Finance fields: product name, amount, asset/debt side, group name, inferred tag, category
- Investment fields before this step: broker, asset type, product name, principal KRW, value KRW, return percent, join date, maturity date, ticker guess, tag groups
- Summary exclusion: aggregate rows are skipped through `isInvestmentSummaryRow(...)`; finance totals are read separately and not converted into holdings.
- Small exclusion: `#소액` and rows below 10,000 KRW are excluded from holdings/assets and tracked in parser metadata.
- Account/tag extraction: `portfolio-tags.ts` decorates holdings with symbol/account/purpose/status groups from product-name tags.

Before Step 3B, `Holding.quantity?` and `Holding.currency?` existed in the type but were not populated by the parser. Row-level price and original-currency value did not exist in the type.

## Storage Model Audit

The current snapshot model can safely accept optional enrichment:

- Existing required fields were not changed.
- `ticker?`, `quantity?`, and `currency?` remain optional.
- Added optional fields:
  - `Holding.currentPrice?`
  - `Holding.valueOriginalCurrency?`
- Existing localStorage and Firestore snapshot records remain compatible because the new fields are optional.
- No migration was added or required.
- Snapshot totals still use uploaded KRW values. Live quotes do not mutate stored valuation.

## Header Hints Added

The investment parser now recognizes additional explicit headers when present:

- Quantity: `수량`, `보유수량`, `보유 수량`, `quantity`, `qty`, `shares`
- Currency: `통화`, `화폐`, `currency`, `ccy`
- Ticker: `티커`, `종목코드`, `코드`, `symbol`, `ticker`
- Current price: `현재가`, `평가단가`, `단가`, `price`, `current price`
- Value: existing `평가금액`, plus `평가 금액`, `금액`, `총액`, `value`, `market value`, `amount`
- Principal/account/type/date headers also accept conservative English aliases.

The parser only fills these fields when a matching header exists. It does not invent quantity, currency, or price from product names.

## Extraction Behavior

- `ticker` prefers an explicit ticker/code column.
- If no explicit ticker column exists, the existing `ticker-mapper` remains the auxiliary fallback.
- Cash/deposit/pension/insurance-like rows are not force-assigned market tickers.
- `quantity` is parsed only from explicit quantity-like columns.
- `currency` is normalized for common KRW/USD labels and otherwise preserved as an uppercase compact value.
- `currentPrice` is parsed only from explicit price-like columns.
- `valueOriginalCurrency` is computed only when both `quantity` and `currentPrice` are present.
- `valueKRW` remains the uploaded valuation field and is not recalculated from quote data.

## Quote Rules

Quote lookup remains reference-only:

- Eligible for quote lookup: US-style ticker classified by `classifyPortfolioAsset(...)`.
- Not eligible: cash-like, deposit/pension, Korean equities, crypto, and unmapped rows.
- `getQuoteTickerForHolding(...)` still returns a quote ticker only for US-style quote targets.
- `isQuoteEligibleHolding(...)` remains a quote lookup eligibility check.
- `canRevalueHoldingWithQuote(...)` was added for stricter revaluation eligibility and requires both a quote ticker and positive quantity.
- `fetchPortfolioQuoteStatuses(...)` now uses that shared revaluation rule when setting `canRevalue`.

Ticker plus missing quantity is therefore still allowed to show a reference quote, but it cannot enable valuation recalculation.

## Screen Connection

UI changes were intentionally minimal:

- `PortfolioParsePreview` now shows a compact enrichment count for quantity, currency, ticker, and price fields.
- No portfolio page layout, cards, charts, or quote status strip redesign was performed.
- `/portfolio` and `/portfolio-manager` still preserve uploaded snapshot totals.

## Modified Files

- `lib/banksalad-parser.ts`
- `lib/portfolio-types.ts`
- `lib/ticker-mapper.ts`
- `lib/portfolio-live-quotes.ts`
- `components/portfolio/PortfolioParsePreview.tsx`
- `docs/STEP3B_PORTFOLIO_PARSER_FIELDS.md`
- `docs/AUDIT.md`

## Manual Verification Scenarios

No project test framework is configured for parser unit tests, so no new test runner was added. Recommended fixture checks:

- A `5.투자현황` sheet with headers `상품명`, `수량`, `통화`, `티커`, `현재가`, `평가금액` should populate the optional holding fields.
- A sheet with `quantity`, `ccy`, `symbol`, `current price`, `market value` should produce the same enrichment fields.
- A sheet without quantity/currency/price headers should behave as before and leave those fields undefined.
- Summary rows after investment totals should remain excluded.
- Cash/deposit rows should not become quote-revaluation candidates even if their names include cash-like keywords.
- US ticker rows with missing quantity should show quote reference status but `canRevalue` should remain false.

## Verification Results

Commands run:

| Command | Result | Notes |
| --- | --- | --- |
| `npm.cmd run build` | Passed | Next.js production build completed. |
| `npm.cmd run lint` | Passed | No ESLint warnings or errors. |
| `npm.cmd run typecheck` | Passed | `tsc --noEmit` completed. |

Fresh dev server:

- Started on `http://localhost:3111`.
- `/portfolio-manager` rendered main content with no captured console errors.
- `/portfolio` rendered main content. The dev console still reports existing Recharts `defaultProps` deprecation warnings at error level; no parser-related runtime failure was observed.

## Still Deferred

- Exact live portfolio valuation from quotes.
- Quantity inference from value and price.
- Original tracker's virtual performance backtest behavior in the Next.js portfolio model.
- Firestore schema migration or large storage redesign.
- Dividend calendar, dividend ledger, market temperature, QLD dashboard, and asset-map work.
- Broader UI redesign or table/card layout changes.

## Recommended Next Steps

1. Add a lightweight parser fixture test setup if future steps will keep expanding upload formats.
2. Collect real Banksalad exports that include quantity/currency columns and verify their exact header names.
3. Decide whether `valueOriginalCurrency` should be displayed or used only as parser metadata.
4. Keep live quote revaluation disabled until quantity, currency, FX, and price basis are reliable across uploads.
