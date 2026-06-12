# Anonymized Real Banksalad Sample Pattern

Update date: 2026-06-12

Source workbook, not committed:

- `docs/fixtures/portfolio-parser/private/2025-06-12~2026-06-12.xlsx`

The private workbook contains real financial data and must remain ignored by Git.
This document keeps only structural information that is safe to commit.

## Workbook Shape

| Sheet | Rows | Merged cells | Notes |
| --- | ---: | ---: | --- |
| `뱅샐현황` | 206 | 281 | Parser target sheet |
| `가계부 내역` | 632 | 0 | Not used by portfolio parser |

## Parser Target Sections

The target sheet contains these relevant sections:

- `3.재무현황`
- `4.보험현황`
- `5.투자현황`
- `6.대출현황`

## Header Pattern

Finance section header pattern:

| Field group | Headers |
| --- | --- |
| Assets | `항목`, `상품명`, `금액` |
| Debts | `항목`, `상품명`, `금액` |

Investment section header pattern:

| Column role | Header |
| --- | --- |
| Asset type | `투자상품종류` |
| Broker/account source | `금융사` |
| Product | `상품명` |
| Principal | `투자원금` |
| KRW value | `평가금액` |
| Return | `수익률` |
| Join date | `가입일자` |
| Maturity date | `만기일자` |

The private sample does not include explicit `수량`, `통화`, `티커`, or `현재가` columns.

## Sanitized Parser Summary

Current parser result from the private workbook:

| Metric | Count |
| --- | ---: |
| Holdings | 33 |
| Finance assets | 50 |
| Positive investment value rows | 33 |
| Explicit small exclusions | 37 |
| Below-minimum exclusions | 0 |
| Parsed/guessed ticker fields | 33 |
| Quantity fields | 0 |
| Currency fields | 0 |
| Current price fields | 0 |
| Original-currency value fields | 0 |
| Quote-eligible holdings | 27 |
| Holdings revaluable with quote | 0 |

Because the workbook lacks quantity and current-price columns, live quote revaluation remains disabled for the real sample.
