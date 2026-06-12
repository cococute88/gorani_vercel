# Portfolio Parser Fixtures

Update date: 2026-06-12

These fixtures are generated in code by `scripts/check-portfolio-parser.mjs`.
No real Banksalad export is stored in the repository.

## Why Generated Fixtures

- The project does not currently include a real Banksalad sample workbook.
- The parser reads XLSX workbook objects, so the script builds an in-memory workbook with `xlsx.utils.aoa_to_sheet`.
- The generated workbook keeps the same high-level shape as a Banksalad export:
  - `3.재무현황`
  - `5.투자현황`
  - Korean required section headers
  - Investment rows with optional quantity/currency/ticker/current-price columns

## Header Alias Cases

The regression script runs the same workbook shape with these alias sets:

| Case | Quantity | Currency | Ticker | Current price | Value |
| --- | --- | --- | --- | --- | --- |
| `korean-default` | `수량` | `통화` | `티커` | `현재가` | `평가금액` |
| `korean-expanded` | `보유수량` | `currency` | `종목코드` | `평가단가` | `금액` |
| `english-short` | `qty` | `ccy` | `symbol` | `current price` | `market value` |
| `english-common` | `shares` | `currency` | `ticker` | `price` | `value` |

## Checked Behavior

- Existing `valueKRW`, broker, asset type, product name, principal, and finance asset parsing still works.
- Optional fields `quantity`, `currency`, `ticker`, `currentPrice`, and `valueOriginalCurrency` are populated when matching headers exist.
- `valueOriginalCurrency` is computed only from parsed quantity and current price.
- Aggregate rows after `total` are excluded.
- Explicit small rows and below-minimum finance rows are excluded and counted.
- Cash/deposit-like rows can retain a parsed ticker value without becoming quote-revaluation candidates.

## Command

```powershell
npm.cmd run check:portfolio-parser
```
