# Full Requirements Replay UTF-8 Audit

Update date: 2026-06-13

## 1. 작업 전 구조 확인

- Current root: `C:\gv\gorani_vercel`
- `original/`: exists and was not modified by this audit.
- `target/`: does not exist and was not created.
- Root app folders (`app/`, `components/`, `lib/`, `public/`, `docs/`) remain in place.
- Private workbook exists locally at `docs/fixtures/portfolio-parser/private/2025-06-12~2026-06-12.xlsx`.

## 2. UTF-8로 재해석한 이전 요구사항 요약

The pasted requirement file was first read normally and Korean text appeared mojibake. It was then re-read with:

```powershell
Get-Content -LiteralPath <attachment> -Raw -Encoding UTF8
```

The clean UTF-8 contract was used for this replay audit. The audit scope was limited to small safety, mojibake, import/type, guard, and documentation fixes. No new product feature or broad UI redesign was performed.

## 3. 감사한 문서/파일 목록

Docs read as UTF-8:

- `docs/AUDIT.md`
- `docs/STEP1_NAVIGATION_AUDIT.md`
- `docs/STEP2_COMPLETION_AUDIT.md`
- `docs/STEP3A_PORTFOLIO_DATA_FOUNDATION.md`
- `docs/STEP3B_PORTFOLIO_PARSER_FIELDS.md`
- `docs/STEP3C_PORTFOLIO_PARSER_FIXTURES.md`
- `docs/STEP3D_PORTFOLIO_REAL_SAMPLE_VALIDATION.md`
- `docs/STEP4A_MDD_LIVE_DATA.md`
- `docs/STEP4B_CONVERSION_LIVE_DATA.md`
- `docs/STEP4C_DIVIDEND_CAPTURE_LIVE_DATA.md`
- `docs/STEP4D_CALCULATOR_UI_POLISH.md`
- `docs/STEP5A0_CALENDAR_EVENT_ID_CACHE_SCHEMA.md`
- `docs/STEP5A1_CALENDAR_CANONICAL_ID_APPLY.md`
- `docs/STEP5A2_CALENDAR_CACHE_PROVIDER_BOUNDARY.md`
- `docs/STEP5A3_CALENDAR_REAL_DIVIDEND_PROVIDER.md`

Implementation areas audited:

- Quote API routes and server/client import boundary
- Calculator data provider and calculator logic/components
- Banksalad parser, ticker mapper, portfolio quote status
- Calendar event identity, cache, provider, watchlist meta flow
- `.gitignore`, package scripts, private fixture tracking state

## 4. 누락된 문서

None. All requested step documents are present.

## 5. mojibake 검색 방법

Command used: `rg -n` over `*.ts`, `*.tsx`, `*.js`, `*.mjs`, `*.md`, and `*.json`, excluding `node_modules`, `.next`, `.git`, and private fixture folders.

Pattern set checked: replacement character `U+FFFD`, common Latin-1 mojibake code points `U+00C3`, `U+00EC`, `U+00EB`, `U+00ED`, `U+00EA`, the common Korean replacement phrase beginning with `U+C810`, double square placeholders, and the duplicated word `undefined` separated by a space.

The step docs were also read with `Get-Content -Raw -Encoding UTF8` and checked for the same suspicious pattern set.

## 6. 발견된 깨진 문자열/의심 문자열

- Repository source/docs scan: no matches.
- Required step docs UTF-8 read: no matches.
- Browser visible-text checks on `/calculator`, `/portfolio`, `/portfolio-manager`, and `/watchlist`: no mojibake markers found.

## 7. 수정한 항목

- Stopped `guessTicker(...)` from assigning the `CASH_LIKE` pseudo ticker to cash/deposit/pension/annuity keyword matches. These rows remain non-quote via classification, but the parser no longer guesses a ticker for them.
- Added parser fixture assertions that cash-like product names do not receive guessed pseudo tickers.
- Updated sanitized private-sample documentation counts after the guard change: private sample ticker count is now 27, quote-eligible count remains 27, and `canRevalue` remains 0.
- Removed the private XLSX from Git tracking with `git rm --cached`; the local file remains on disk and is ignored by `.gitignore`.
- Created this audit document and added one audit index line to `docs/AUDIT.md`.

## 8. 수정하지 않은 항목과 이유

- Existing Recharts `defaultProps` dev-console warnings were not fixed because they require dependency or chart-library remediation outside this audit-only scope.
- No large UI redesign, calculator formula change, Firestore migration, custom/economic calendar UI, or TaxSavingTable real calculation was attempted.
- No broad rewrite was performed for older docs whose historical notes describe prior-step status.

## 9. repository safety 결과

| Check | Result |
| --- | --- |
| `original/` modified? | No |
| `target/` exists? | No |
| Private XLSX ignored? | Yes, confirmed by `git check-ignore -v --no-index` / `git check-ignore -v` after untracking |
| Private XLSX tracked? | Was tracked before audit; fixed with `git rm --cached` |
| New UI libraries added? | No |
| Root structure moved? | No |

## 10. calculator compliance 결과

- MDD calculator uses `fetchQuoteHistory(...)` and falls back safely to sample data when live history is missing/invalid.
- Conversion calculator fetches both sell/buy histories and calculates ratios only on common trading dates.
- Dividend capture calculator fetches quote history plus dividend events and uses dividend rows as the event driver. The calculator does not generate future dividends.
- Shared UI polish components exist: `CalculatorDataStatus`, `CalculatorWarningPanel`, and `CalculatorInputField`.
- Korean calculator labels were readable in browser checks.

## 11. portfolio compliance 결과

- Banksalad parser aliases for quantity, currency, ticker, current price, and value are intact.
- Optional parser fields remain optional; localStorage/Firestore snapshot compatibility is preserved.
- `canRevalueHoldingWithQuote(...)` requires both quote eligibility and positive quantity.
- Portfolio totals and `valueKRW` remain based on uploaded KRW values; live quotes are informational only when quantity is missing.
- Private sample has no quantity/currency/currentPrice/valueOriginalCurrency columns; `canRevalue` remains 0.
- Sanitized real-sample docs do not include account/product names or real balances.

## 12. calendar compliance 결과

- Canonical generated ID rule is implemented as `dividend:{TICKER}:{EVENT_TYPE}:{EVENT_DATE}`.
- `buy_by` canonical-normalizes to `buy`; `pay` canonical-normalizes to `payment`.
- Mock/generated events preserve `legacyEventId`.
- Watchlist meta lookup order is canonical -> legacy -> id.
- New meta saves under canonical ID.
- Calendar cache and user event meta are separated; cache entries store generated events and warnings, not memo/star/heart.
- Cache TTL is 24 hours by default and localStorage helpers are SSR-safe.
- Real dividend provider uses `/api/quote/dividends` via the quote client/provider path and falls back in this order: fresh cache, real provider, stale cache, mock.
- Empty/API-failure dividend cases fall back without crashing.
- No custom/economic UI implementation or TaxSavingTable real calculation was added.

## 13. 변경 파일 목록

- `.git/index`: private XLSX removed from tracking only; local file remains.
- `lib/ticker-mapper.ts`
- `lib/portfolio-types.ts`
- `scripts/check-portfolio-parser.mjs`
- `docs/STEP3D_PORTFOLIO_REAL_SAMPLE_VALIDATION.md`
- `docs/fixtures/portfolio-parser/anonymized-real-sample.md`
- `docs/FULL_REQUIREMENTS_REPLAY_UTF8_AUDIT.md`
- `docs/AUDIT.md`

## 14. 검증 명령 결과

| Command | Result | Notes |
| --- | --- | --- |
| `npm.cmd run check:portfolio-parser` | Passed | Synthetic fixtures and quote eligibility checks passed. |
| `npm.cmd run check:portfolio-parser:private` | Passed | Private workbook present; sanitized check passed. Ticker fields: 27, canRevalue: 0. |
| `npm.cmd run build` | Passed | Next.js production build completed. |
| `npm.cmd run lint` | Passed | No ESLint warnings or errors. |
| `npm.cmd run typecheck` | Passed | `tsc --noEmit` completed. |

## 15. 화면 확인 결과

Dev server used: `http://localhost:3131`.

| Route | Result |
| --- | --- |
| `/calculator` | Rendered; Korean labels readable; no mojibake markers. Existing Recharts defaultProps warnings appeared at console error level. |
| `/portfolio` | Rendered; Korean labels readable; no mojibake markers. Existing Recharts defaultProps warnings appeared at console error level. |
| `/portfolio-manager` | Rendered; Korean labels readable; no mojibake markers; no recent console errors. |
| `/watchlist` | Rendered; Korean labels readable; no mojibake markers; no recent console errors. Event dialog opened; memo/star/heart survived close and reopen in page state. |

## 16. 남은 문제

- The private workbook was tracked before this audit. It has now been removed from tracking, but the deletion from the Git index must be included in the next commit to keep the workbook out of the repository.
- Recharts dev warnings remain on chart-heavy pages. They are not new and were intentionally left for a dependency-maintenance step.
- Live quote revaluation remains intentionally disabled for real Banksalad sample rows without quantity/current-price fields.

## 17. 다음 단계 추천

Commit the audit/safety fixes, including the `git rm --cached` removal of the private workbook, then continue with the next functional step only after confirming no private binary appears in the staged diff.
