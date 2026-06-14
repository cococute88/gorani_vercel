# TICKER-4 KRX Ticker Name Map

Date: 2026-06-14

## Why

Banksalad snapshot rows can contain Korean ETF or Korean stock product names without a quote-ready ticker. Before this step, a user could type a KRX ticker in `/portfolio-manager`, but the correction only lived in the current preview holding state unless the snapshot was saved. Similar product names in later imports could require repeated manual correction.

TICKER-4 adds a browser-local, product-name-based map so a manual KRX ticker correction can be reused for later snapshot/holding rows with the same conservative normalized product name.

## Storage Key

The map is stored in `localStorage` under:

```ts
STORAGE_KEYS.krxTickerNameMap // "gorani.krx-ticker-name-map.v1"
```

Storage shape:

```json
{
  "KODEX200": {
    "ticker": "069500",
    "displayTicker": "069500.KS",
    "rawProductName": "KBISA KODEX 200 ETF (위탁)",
    "updatedAt": "2026-06-14T00:00:00.000Z"
  }
}
```

`ticker` is the canonical six-digit KRX code. `displayTicker` is the quote/display value used by existing portfolio quote conventions.

## Normalized Product Name Policy

Helper: `normalizeProductNameForTickerMap()` in `lib/krx-ticker-name-map.ts`.

The policy is conservative:

- Unicode NFKC normalization.
- Remove portfolio tag markers such as `①`, `#①`, and simple hash tags.
- Remove common account wrappers/prefixes such as `KBISA`, `ISA`, `IRP`, `미래연금`, `연금저축`, `위탁`.
- Remove broad product-type words such as `ETF`, `ETN`, `상장지수펀드`, `펀드`.
- Normalize common index spellings such as `S&P`/`SNP` to `SP`.
- Collapse whitespace, brackets, and punctuation.
- Preserve meaningful product differentiators like `(H)`, `TR`, `합성`, and issuer/product names.

No broad fuzzy matching is used. Unknown similar names are not automatically matched unless they normalize to the same deterministic key.

## Ticker Normalize And Validate Policy

Helper: `normalizeKrxTickerForTickerMap()`.

Accepted input:

- `069500`
- `005930`
- `005930.KS`
- `123456.KQ`

Rejected input:

- Non-six-digit codes.
- Alphabetic symbols such as `A005930`.
- Arbitrary quote symbols.

For no-suffix six-digit input, `ticker` is stored as `069500` and `displayTicker` defaults to `069500.KS`, matching the existing Korean ETF quote ticker convention. `.KQ` is preserved only when the user explicitly enters `.KQ`; the app does not infer KOSDAQ automatically.

## Application Priority

When applying mappings to holdings:

1. If `holding.ticker` is already non-empty, keep it.
2. If `holding.ticker` is empty and the normalized product name exists in the map, apply `entry.displayTicker`.
3. A new manual KRX input updates the existing normalized-name mapping.
4. Application is non-destructive: source snapshot arrays are not mutated by the helper.

The existing Korean ETF registry still handles known products. User name-map entries are treated as manual corrections for rows without an explicit ticker.

## UI Connection

Connected UI: `/portfolio-manager` -> `components/portfolio/HoldingsTable.tsx`.

User flow:

1. Parse or load a snapshot in portfolio manager.
2. Type a six-digit KRX ticker or `.KS`/`.KQ` ticker in the existing holding ticker input.
3. The holding updates immediately.
4. The normalized product name mapping is saved to localStorage.
5. Other currently displayed empty-ticker holdings with the same normalized product name receive the saved ticker.
6. A compact status badge appears above the holdings list.

Read-only snapshot preview does not write mappings.

## Tests

Primary regression:

```bash
npm run check:krx-ticker-name-map
```

Related checks:

```bash
npm run check:portfolio-parser
npm run check:portfolio-parser:private
npm run check:korean-etf
npm run lint
npm run typecheck
```

## Remaining Limits

- The map is browser-local only; no Firebase/server sync is added.
- `.KQ` is not inferred from the six-digit code.
- Normalization intentionally avoids fuzzy matching, so some genuinely equivalent but unusually written product names may still need one manual correction each.
- Existing snapshot source data is not rewritten just because a display-stage mapping exists.
