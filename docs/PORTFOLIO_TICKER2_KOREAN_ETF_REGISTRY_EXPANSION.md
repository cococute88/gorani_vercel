# PORTFOLIO-TICKER-2 Korean ETF Registry Expansion

Date: 2026-06-14

## 1. Read Files

- `lib/korean-etf-registry.ts`
- `lib/holding-ticker-normalizer.ts`
- `lib/dividend-holdings-from-portfolio.ts`
- `lib/asset-map-exposure.ts`
- `lib/ticker-mapper.ts`
- `scripts/check-korean-etf-registry.mjs`
- `scripts/check-dividend-holdings-groups.mjs`
- `scripts/check-asset-map-exposure.mjs`
- `docs/AUDIT.md`

## 2. Why PORTFOLIO-TICKER-1 Was Insufficient

PORTFOLIO-TICKER-1 only mapped `ACE/KINDEX 미국S&P500` to `360200.KS`. Real imported snapshots include account-prefixed Korean ETF names such as `미래연금ACE미국S&P500`, `KBISA ACE미국나스닥100`, `미래연금RISE미국S&P500`, and `ISA TIGER미국S&P500`. Those rows need actual Korean quote tickers when known, while still using US proxy buckets for dividend and exposure logic.

## 3. Added Mappings

Added verified mappings:

- `ACE 미국S&P500`: `360200.KS`, bucket/proxy `SPY`
- `ACE 미국나스닥100`: `367380.KS`, bucket/proxy `QQQ`
- `RISE 미국S&P500`: `379780.KS`, bucket/proxy `SPY`
- `RISE 미국나스닥100`: `368590.KS`, bucket/proxy `QQQ`
- `TIGER 미국S&P500`: `360750.KS`, bucket/proxy `SPY`

RISE mappings include KBSTAR aliases because RISE was formerly KBSTAR.

## 4. Alias Matching Rules

Matching normalizes whitespace and compares compact uppercase text. It also removes only obvious account prefixes for matching:

- `미래연금`
- `KBISA`
- `ISA`

Issuer/product names such as `ACE`, `RISE`, `KBSTAR`, and `TIGER` are preserved and must still be present for a registry match.

## 5. Cash-Like/MMF Exclusion Rules

The holding ticker normalizer now returns `isCashLike: true` and `cash_like` warning for MMF/cash-like rows. Covered examples include:

- `미래연금저축원MMF`
- `미래연금국채혼합MMF`
- `국채혼합MMF`
- `원MMF`
- `MMF`
- `머니마켓`
- `현금`
- `예수금`
- `CMA`
- exact `KRW`, `USD`, `원`
- `달러`

Cash-like rows do not receive `SPY`/`QQQ` bucket or exposure proxy and are excluded from dividend holdings and asset-map ETF look-through.

## 6. Identifier Examples

`ACE미국S&P500`:

- `quoteTicker = 360200.KS`
- `dividendBucket = SPY`
- `exposureProxy = SPY`

`ACE미국나스닥100`:

- `quoteTicker = 367380.KS`
- `dividendBucket = QQQ`
- `exposureProxy = QQQ`

`미래연금저축원MMF`:

- `quoteTicker = undefined`
- `isCashLike = true`
- `exposureProxy = undefined`

## 7. Regression Tests

Extended:

- `scripts/check-korean-etf-registry.mjs`
- `scripts/check-dividend-holdings-groups.mjs`
- `scripts/check-asset-map-exposure.mjs`

The tests cover all required ACE, RISE, TIGER, fallback S&P500/Nasdaq100, manual ticker preservation, dividend bucket behavior, cash-like exclusion, and asset-map proxy behavior.

## 8. Remaining Limitations

- The registry includes only explicitly provided KRX codes.
- Unknown Korean ETF KRX codes are still not inferred.
- Fallback S&P500/Nasdaq100 matching remains heuristic and only fills bucket/proxy, not quoteTicker.

## 9. Next Recommendation

Keep expanding `KOREAN_ETF_MAPPINGS` only from verified KRX codes, and add one regression group per issuer/index family before relying on those products in quote, dividend, or asset-map workflows.
