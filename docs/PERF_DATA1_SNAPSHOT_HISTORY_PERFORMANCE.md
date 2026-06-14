# PERF-DATA-1 — `/performance` 스냅샷 히스토리 연결

작업일: 2026-06-14

## 1. 읽은 파일

- `app/performance/page.tsx`
- `components/PerformanceChart.tsx`
- `components/MetricCard.tsx`
- `components/qld/QldValueFxChart.tsx`
- `components/qld/QldAssetSummaryCard.tsx`
- `components/qld/QldHoldingsRankTable.tsx`
- `components/portfolio/PortfolioPerformanceChart.tsx`
- `lib/portfolio-store.ts`
- `lib/portfolio-types.ts`
- `lib/portfolio-aggregate.ts`
- `lib/use-portfolio-view.ts`
- `lib/mockData.ts`
- `lib/qldDashboardData.ts`
- `lib/format.ts`
- `lib/storage-keys.ts`
- `docs/REALDATA0_MOCK_STATIC_DATA_AUDIT.md`
- `docs/PORTFOLIO_PERFORMANCE_UI1_RESTRUCTURE.md`
- `docs/AUDIT.md`
- `package.json`

## 2. 기존 mock source findings

- `/performance` KPI 카드는 `PERFORMANCE_KPIS` from `lib/mockData.ts`를 직접 렌더링하고 있었다.
- 메인 성과 차트는 `components/PerformanceChart.tsx` 내부에서 `PERFORMANCE_SERIES` from `lib/mockData.ts`를 직접 가져왔다.
- `PERFORMANCE_SERIES`는 2021.03~2026.05 구간을 결정론적 난수로 만든 static series이며 실사용자 스냅샷과 무관했다.
- 하단 QLD 영역은 `lib/qldDashboardData.ts`의 `QLD_SUMMARY`, `QLD_VALUE_FX_SERIES`, `QLD_HOLDINGS`, `QLD_RANK_ROWS`를 사용한다. 이번 단계에서는 유지하되 페이지 섹션의 `샘플 데이터` 배지와 설명을 남겼다.

## 3. PortfolioSnapshot field availability

사용 가능한 필드:

- 날짜: `snapshotDate`
- 총 금융자산: `totalAssetKRW`
- 순자산/부채: `netAssetKRW`, `totalDebtKRW`
- 투자 평가금액: `investmentValueKRW`
- 투자원금: `investmentPrincipalKRW`
- 손익: `returnAmountKRW`
- 수익률: `returnPct`
- 보유종목/자산: `holdings`, `financeAssets`
- 보유종목별 값: `Holding.valueKRW`, `Holding.principalKRW`, 선택 필드 `quantity`, `currency`, `currentPrice`, `valueOriginalCurrency`

없는 필드:

- 스냅샷별 배당금 또는 누적 배당금 공식 필드
- 스냅샷 사이 입출금/현금흐름 히스토리
- 정확한 시간가중 수익률을 만들 수 있는 기간별 외부 현금흐름

## 4. helper design

신규 순수 helper:

- `lib/performance-from-snapshots.ts`
- export: `buildPerformanceFromSnapshots(snapshots)`
- 입력: `PortfolioSnapshot[]`
- 출력: `metrics`, `series`, `source: "snapshot-history"`, `canCalculateTrend`, `warnings`

특징:

- 스냅샷 날짜를 검증하고 날짜 오름차순으로 정렬한다.
- 금액은 finite number 및 0 이상만 유효값으로 인정한다.
- invalid 날짜 row는 제외하고, invalid 금액은 row를 유지하되 `null`로 둔다.
- 배당/CAGR처럼 현재 스냅샷 schema로 정확히 만들 수 없는 값은 `null`과 warning으로 남긴다.

## 5. KPI mapping

`/performance` 상단 KPI는 더 이상 `PERFORMANCE_KPIS`를 사용하지 않는다.

| KPI | 새 매핑 |
| --- | --- |
| 현재 평가액 | 최신 유효 스냅샷의 `investmentValueKRW` |
| 누적투자원금 | 최신 유효 스냅샷의 `investmentPrincipalKRW` |
| 누적 손익 | `investmentValueKRW - investmentPrincipalKRW` |
| 누적 수익률 | `누적 손익 / investmentPrincipalKRW * 100` |
| CAGR (자금가중) | 현재 `null`, 화면은 `—` |
| CAGR (시간가중) | 현재 `null`, 화면은 `—` |

## 6. chart series mapping

`PerformanceChart`는 mock import를 제거하고 props로 받은 series만 렌더링한다.

| 차트 series | 새 매핑 |
| --- | --- |
| 평가액 | `PerformanceSnapshotPoint.evaluationKRW` = `PortfolioSnapshot.investmentValueKRW` |
| 누적투자원금 | `PerformanceSnapshotPoint.principalKRW` = `PortfolioSnapshot.investmentPrincipalKRW` |
| 배당금 | `PerformanceSnapshotPoint.dividendKRW` = 공식 필드 없음 → `null` |

`임대소득`은 다시 추가하지 않았다.

## 7. unavailable field policy

- 스냅샷이 없으면 KPI는 fake 값 없이 `—`를 표시한다.
- 스냅샷이 없으면 차트 empty state는 `저장된 스냅샷이 없어 성과 데이터를 계산할 수 없습니다. /portfolio-manager에서 스냅샷을 등록하세요.`를 표시한다.
- 배당금 히스토리는 schema에 없으므로 mock dividend bar를 넣지 않는다.
- 차트 제목은 유지하되 `PortfolioSnapshot에 배당금 히스토리 필드가 없어 배당 막대는 표시하지 않습니다.` 안내를 붙였다.

## 8. CAGR policy

- 스냅샷 2개 미만이면 CAGR 카드 sub text는 `스냅샷 2개 이상 필요`이다.
- 스냅샷 2개 이상이어도 입출금/현금흐름 히스토리가 없어 자금가중 CAGR과 시간가중 CAGR은 계산하지 않는다.
- 화면에는 `—`를 표시하고 sub text는 `입출금 데이터 없음`으로 둔다.
- 단순 연환산을 CAGR처럼 표시하지 않는다.

## 9. UI integration

- `app/performance/page.tsx`가 `usePortfolioSnapshots()`를 구독하고 `buildPerformanceFromSnapshots()` 결과를 `useMemo`로 만든다.
- 페이지 상단 `샘플 데이터` 배지는 제거했다. 상단 KPI와 메인 차트는 스냅샷 히스토리 기준이기 때문이다.
- `PerformanceChart` 우측에 `스냅샷 히스토리 기준` 또는 `스냅샷 데이터 없음` source label을 표시한다.
- 하단 QLD/sample 영역은 기존 섹션을 유지하고 `샘플 데이터` 배지를 계속 노출한다.

## 10. tests added

신규 회귀 스크립트:

- `scripts/check-performance-snapshots.mjs`
- `package.json`: `check:performance-snapshots`

커버 케이스:

- no snapshots
- one snapshot
- two snapshots sorted ascending
- invalid/missing values
- dividend unavailable

## 11. visual verification

시각 검증 대상:

- `/performance` no snapshot empty state
- `/performance` seeded snapshot history state
- light mode
- dark mode
- 320px
- 390px
- desktop
- spot-check: `/portfolio`, `/dividends`, `/portfolio-manager`

결과는 최종 작업 보고에 기록한다.

## 12. remaining limitations

- 배당금 history는 현재 `PortfolioSnapshot` schema에 없어 실제 배당 series를 표시할 수 없다.
- 정확한 자금가중/시간가중 CAGR은 입출금/현금흐름 데이터가 없어 계산하지 않는다.
- 하단 QLD 평가금액/환율/랭킹 영역은 여전히 sample data이다.
- `현재 평가액`은 전체 금융자산(`totalAssetKRW`)이 아니라 투자 평가금액 합계(`investmentValueKRW`) 기준이다. 기존 `/portfolio-manager` 성과 차트와 같은 의미를 유지하기 위한 결정이다.

## 13. next recommended step

다음 단계는 하단 QLD/sample 영역을 실제 스냅샷 히스토리와 최신 보유종목 랭킹으로 대체하는 별도 `PERF-DATA-2`가 적절하다. 배당금/정확한 CAGR은 스냅샷 schema 또는 별도 거래/입출금/배당 ledger가 생긴 뒤 연결하는 것이 안전하다.

