# PORTFOLIO-TOTALS-RECONCILE-1

## 문제 원인

`/portfolio` 상단 요약은 큰 KPI를 `총 평가금액`으로 표시하면서 실제 값은 `investmentValueKRW`를 우선 사용했다. 같은 카드 하단에는 `totalAssetKRW` 기반의 `총 금융자산`도 함께 표시되어, 두 값이 모두 대표 총액처럼 보였다.

예시 데이터에서 `총 금융자산` 657,130,417원과 `투자 평가금액` 588,134,175원의 차이 68,996,242원은 보유종목 평가금액에 포함되지 않은 예적금·CMA·현금성 잔액 또는 기타 금융자산에서 발생할 가능성이 높다.

## 용어 정의

- **총 금융자산**: 포트폴리오 대표 headline 총액. 예적금·현금성 자산을 포함한다.
- **투자 평가금액**: 주식/ETF/MMF 등 보유종목 평가금액.
- **현금성/기타 자산**: `총 금융자산 - 투자 평가금액`으로 계산한 차액.
- **투자원금**: 기존 `investmentPrincipalKRW` 기준.
- **누적 손익/수익률**: `투자 평가금액 - 투자원금`, `누적 손익 / 투자원금` 기준.

## helper source priority

`lib/portfolio-totals-reconcile.ts`의 `reconcilePortfolioTotals`가 총액 기준을 한 곳에서 계산한다.

### 총 금융자산

1. `snapshot.totalAssetKRW`
2. `financeAssets`의 비부채 자산 합계
3. 유효한 `snapshot.investmentValueKRW`
4. holdings 평가금액 합계
5. unavailable

### 투자 평가금액

1. `snapshot.investmentValueKRW`
2. holdings 평가금액 합계
3. unavailable

## 차액 계산 정책

- `cashAndOtherKRW = totalFinancialAssetKRW - investmentValueKRW`
- 음수이면 `total_less_than_investment` warning을 남기고 UI 표시용 차액은 0원으로 안전 처리한다.
- NaN/Infinity 등 invalid number는 무시하고 `invalid_numeric_field_ignored` warning을 남긴다.
- financeAssets 합계와 holdings 합계가 의미 있게 다르면 `financeAssets_holdings_mismatch` warning으로 기록한다.

## UI 라벨 변경

- `/portfolio` 상단 headline을 `총 금융자산`으로 변경했다.
- headline 값은 reconciliation helper의 `totalFinancialAssetKRW`를 사용한다.
- 보조 지표에는 `투자 평가금액`, `현금성/기타 자산`, `투자원금`, `누적 손익`을 분리해 표시한다.
- 사용자 UI에는 `investmentValueKRW`, `financeAssets`, `snapshot.totalAssetKRW` 같은 개발자 필드명을 노출하지 않는다.

## 테스트 명령어

- `npm run check:portfolio-totals-reconcile`
- `npm run check:portfolio-realdata`
- `npm run check:portfolio-ux-rules`
- `npm run lint`
- `npm run typecheck`
- 가능하면 `npm run build`

## 남은 한계

- 실제 브라우저/preview에서 light/dark 및 320px/390px 모바일 캡처 검증은 배포 preview가 제공될 때 추가 확인이 필요하다.
- 과거 스냅샷에 `totalAssetKRW` 자체가 잘못 저장된 경우 helper는 source priority에 따라 fallback하지만 원본 데이터 보정은 하지 않는다.
- `snapshot.investmentValueKRW`가 invalid이고 holdings 합계로 투자 평가금액을 보정한 경우, 총 금융자산 source는 `investmentValueKRW`가 아니라 `holdings.sum`으로 남겨 원본 필드와 fallback 출처를 구분한다.
