# Step 3D Portfolio Real Sample Validation

Update date: 2026-06-12

## Real Sample Location

Private sample workbook:

- `docs/fixtures/portfolio-parser/private/2025-06-12~2026-06-12.xlsx`

This file contains real financial data and is not committed.

## Private Fixture Gitignore

Added to `.gitignore`:

```gitignore
docs/fixtures/**/private/
```

`git status --short` does not list the private XLSX file.

## Workbook And Sheet Structure

Workbook sheets:

| Sheet | Rows | Non-empty rows | Merged cells | Parser use |
| --- | ---: | ---: | ---: | --- |
| `뱅샐현황` | 206 | 196 | 281 | Used |
| `가계부 내역` | 632 | 632 | 0 | Not used |

Relevant target sections on `뱅샐현황`:

- `3.재무현황`
- `4.보험현황`
- `5.투자현황`
- `6.대출현황`

The sheet has many merged cells, but the current parser still finds the section and header rows through text content.

## Header Summary

Finance section header pattern:

- Asset side: `항목`, `상품명`, `금액`
- Debt side: `항목`, `상품명`, `금액`

Investment section header pattern:

- `투자상품종류`
- `금융사`
- `상품명`
- `투자원금`
- `평가금액`
- `수익률`
- `가입일자`
- `만기일자`

No explicit quantity/currency/ticker/current-price headers were present in the private sample.

## Parser Extraction Summary

The private workbook parses successfully with the existing `parseBanksaladWorkbook` path.

| Metric | Count |
| --- | ---: |
| Holdings | 33 |
| Finance assets | 50 |
| Positive investment value rows | 33 |
| Explicit small exclusions | 37 |
| Below-minimum exclusions | 0 |
| Parser errors | 0 |
| Parser warnings | 0 |

Existing field behavior checked:

- `valueKRW` is populated from `평가금액`.
- `principalKRW` is populated from `투자원금`.
- `broker` is populated from `금융사`.
- `assetType` is populated from `투자상품종류`.
- `productName` is populated from `상품명`.
- Finance asset `amountKRW` is populated from `금액`.
- Summary rows are not included as holdings.

## Optional Field Summary

| Optional field | Count |
| --- | ---: |
| `quantity` | 0 |
| `currency` | 0 |
| `ticker` | 33 |
| `currentPrice` | 0 |
| `valueOriginalCurrency` | 0 |

The ticker count is produced by the existing explicit-tag and ticker-guess path. The private sample itself does not contain a dedicated ticker/code column.

Because `quantity` and `currentPrice` are absent, `valueOriginalCurrency` is not computed for the private sample.

## Quote Eligibility Summary

| Metric | Count |
| --- | ---: |
| Quote-eligible holdings | 27 |
| Unique quote tickers | 10 |
| Revaluable holdings | 0 |

Quote lookup can show reference prices for eligible tickers, but no holdings can be revalued because the sample has no positive parsed `quantity`.

## Script Changes

Updated:

- `scripts/check-portfolio-parser.mjs`
- `package.json`

New command:

```powershell
npm.cmd run check:portfolio-parser:private
```

The private command:

- Keeps the synthetic Step 3C regression checks.
- Reads the private workbook only when present.
- Skips without failure if the private workbook is missing.
- Prints sanitized workbook/parser counts.
- Does not print product names, account names, or raw balances.

## Anonymized Fixture

Added:

- `docs/fixtures/portfolio-parser/anonymized-real-sample.md`

This document records only safe workbook structure, headers, and aggregate parser counts. It does not include real account names, product names, or balances.

## Parser Patch Result

No parser code patch was needed in Step 3D.

The current parser already handles:

- Real workbook sheet selection by `뱅샐현황`.
- Merged-cell-heavy target sheet.
- Finance section header detection.
- Investment section header detection.
- Summary/small-row exclusion.
- Existing KRW value extraction.

## Current Limits

- The private sample has no explicit quantity, currency, ticker/code, or current-price columns.
- `ticker` values are inferred from product tags/names, not read from a dedicated workbook column.
- Live quote revaluation remains disabled for this sample.
- Browser upload of the private XLSX was not automated to avoid pushing real workbook content through UI/log paths.

## Recommended Next Steps

1. If another export includes quantity/currency/current-price columns, add it privately and run the same command.
2. Keep exact live portfolio revaluation disabled until quantity, currency, FX, and quote basis are available in real exports.
3. Promote the lightweight script to a formal test runner only if more real formats or workbook variants are added.
