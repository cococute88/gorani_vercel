# PORTFOLIO-ACCOUNT-RETURNS-RECONCILE-1

## 문제 원인

`/portfolio` 계좌 현황 카드는 평가금액 행을 우선 `financeAssets.amountKRW`에서 만들고, `financeAssets`에 계좌 잔액이 있으면 `holdings` fallback을 사용하지 않았다. 하지만 `financeAssets` 기본 타입에는 계좌별 투자원금 필드가 없어서 기존 `PortfolioAccountRow.profit/rate`가 `null`로 남았고 UI에는 `수익 —`, `수익률 —`로 표시됐다.

## 데이터 흐름

1. `app/portfolio/page.tsx`가 `usePortfolioView()` 결과를 화면 섹션에 전달한다.
2. `lib/use-portfolio-view.ts`는 최신 스냅샷을 `buildPortfolioPageFromSnapshots`로 변환한다.
3. `lib/portfolio-from-snapshots.ts`는 snapshot의 `holdings`와 `financeAssets`를 정규화하고 계좌 카드 모델을 만든다.
4. `components/AssetAccountCards.tsx`는 `accountCards`를 위탁/절세/미확인으로 다시 분류해 렌더링한다.

## 계산 정책

### 평가금액

계좌별 평가금액은 기존 화면의 합계를 유지하기 위해 다음 순서를 사용한다.

1. `financeAssets`에 유효한 비부채 계좌 금액이 있으면 `financeAssets.amountKRW` 합계
2. 없으면 `holdings.valueKRW` 합계
3. 둘 다 없으면 표시하지 않음

20만원 미만 계좌 숨김 정책은 기존과 동일하게 계좌 카드/계좌 비중 표시에서만 적용한다.

### 원금

계좌별 원금은 가짜 배분을 하지 않는다.

1. 같은 계좌명으로 매칭되는 `holdings.principalKRW` 합계
2. 없으면 `financeAssets`의 원금 유사 필드(`principalKRW`, `investmentPrincipalKRW`, `principalAmountKRW`, `purchaseAmountKRW`) 합계
3. 그래도 없거나 0 이하이면 계산 불가

전체 snapshot의 `investmentPrincipalKRW`는 계좌별로 임의 배분하지 않는다.

### 수익/수익률

- 수익 = 평가금액 - 원금
- 수익률 = 수익 / 원금 × 100
- 원금이 없거나 0이면 수익/수익률은 `null`로 둔다.
- NaN/Infinity/invalid number는 무시한다.

## 계산 불가 처리

원금이 없는 계좌는 `원금 —`, `수익 —`, `수익률 —`로 표시하고, 계좌 카드 위에 사용자용 안내문을 표시한다.

> 일부 계좌는 원금 정보가 없어 수익률을 계산하지 않습니다.

카드 내부에는 `원금 정보 없음`을 표시한다. UI에는 `principalKRW`, `financeAssets`, `holdings` 같은 개발자 필드명을 노출하지 않는다.

## 계좌 그룹 분류

기존 `classifyAccountStatusGroup` 기준을 유지한다.

- 절세: ISA, IRP, 연금, 절세, 비과세 등
- 위탁: 위탁, 일반, 해외주식, 국내주식, 예수금, 현금, 과세 등
- 미확인: 위 신호가 없는 계좌

## 계좌별 총합과 상단 총액 관계

- 계좌 카드 평가금액 합계는 `financeAssets`가 있으면 비부채 `financeAssets.amountKRW` 표시 계좌 합계와 일치한다.
- `financeAssets`가 없으면 표시 가능한 `holdings.valueKRW` 계좌 합계와 일치한다.
- 상단 `총 금융자산`은 `portfolio-totals-reconcile` 정책에 따라 snapshot 총액, financeAssets 합계, 투자 평가금액, holdings 합계 순서로 결정된다.
- 따라서 계좌 카드 합계는 20만원 미만 숨김, 비부채 필터, source 차이 때문에 headline 총 금융자산과 다를 수 있다. 임의 보정은 하지 않는다.

## 테스트 명령어

- `npm run check:portfolio-account-returns`
- `npm run check:portfolio-realdata`
- `npm run check:portfolio-ux-rules`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 남은 한계

- `financeAssets`와 `holdings`의 계좌명이 서로 다르면 원금 매칭이 불가능하다.
- `financeAssets`에 원금 유사 필드가 없는 실제 데이터에서는 평가금액만 표시하고 수익률은 계산하지 않는다.
- 20만원 미만 숨김 정책 때문에 계좌 카드 합계는 headline KPI와 완전 일치하지 않을 수 있다.
