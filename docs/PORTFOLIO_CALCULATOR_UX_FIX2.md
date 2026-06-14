# PORTFOLIO-CALCULATOR-UX-FIX-2

`/portfolio`, `/performance`, `/calculator`에서 사용자가 직접 점검하며 발견한 화면 문제를
실데이터 연결 결과를 되돌리지 않고 정밀 수정한 작업.

기존 단계(PERF-DATA-1/2, TICKER-4, PORTFOLIO-DATA-1, PORTFOLIO-UX-POLISH-1) 결과는 유지한다.
외부 API/Firebase/OAuth/신규 의존성 추가 없음. localStorage 전체 삭제 없음.

## 1. 소액 계좌 20만원 미만 숨김 (#2)

- `lib/portfolio-from-snapshots.ts`에 상수 `MIN_VISIBLE_ACCOUNT_AMOUNT_KRW = 200_000` 추가.
- `buildAccountRowsFromFinanceAssets` / `buildAccountRowsFromHoldings`에서 **집계 후** 그룹 평가금액이
  20만원 미만인 계좌 행을 제외한다.
- 계좌 카드, 계좌별 비중 도넛은 표시되는 계좌 행만 사용하므로 비율이 표시 항목 기준으로 자동 재계산된다.
- 총자산/평가금액 KPI 등 합계 지표는 스냅샷 원본 값을 쓰므로 줄어들지 않는다 — 숨김은 "표시용 계좌 항목"에만 적용.
- UI에 "소액 제외됨" 문구를 크게 띄우지 않는다. 정책은 본 문서와 회귀 테스트로만 남긴다.

## 2. 자산 구성 도넛: 성장 / 배당 / 현금 (#3)

- `buildAssetAllocation`을 재작성해 항상 `성장 / 배당 / 현금` 3개 그룹만 만든다(`기타` 생성 금지).
- 분류 정책:
  - **현금**: `category === "현금"` 또는 현금성 신호(예수금/CMA/MMF/파킹/예적금/RP 등). 현금/예적금 등
    비투자성 금융자산은 현금으로 집계.
  - **배당**: 목적 태그(`③배당`/purposeGroup)가 배당 계열이거나 대표 배당 ETF(SCHD/JEPI/SPYM/O/ARCC 등).
  - **성장**: 위 둘에 해당하지 않는 투자 종목 기본값.
- 색상/순서 고정: 성장(녹색) → 배당(파랑) → 현금(주황). `주식/예적금/현금` 라벨은 더 이상 노출되지 않는다.

## 3. 보유종목 트리맵: 위탁 / 절세 2그룹 (#4)

- 트리맵 group을 종목 목적 대신 **계좌 분류**로 바꿈. `classifyHoldingTreemapGroup`이
  기존 `lib/account-status-group.ts`의 `classifyAccountStatusGroup`을 재사용하고, 결과를 위탁/절세로만 매핑한다.
  - **절세**: ISA / 연금 / 연금저축 / IRP / 퇴직연금 등.
  - **위탁**: 일반 위탁·달러·원화 등 그 외 계좌. 신호가 불명확하면 기본 위탁(별도 `분류 미확인` 그룹 없음).
- 평가금액 기준 타일 크기 계산은 그대로 유지. 트리맵 최상위 라벨은 `위탁`, `절세`만 나온다.

## 4. 금액 줄바꿈 방지 (#5)

- 근본 원인: `formatWon`/`formatWonSigned`가 `₩`와 숫자 사이에 **일반 공백**을 써서 좁은 카드에서
  `₩`와 금액이 다른 줄로 분리됨.
- `lib/format.ts`에서 해당 공백을 **줄바꿈 불가 공백(NBSP, U+00A0)**으로 교체 → `₩`와 숫자가 항상 같은 줄.
- `app/globals.css`의 `.num` 유틸에 `white-space: nowrap` 추가(금액/숫자/단위가 분리되지 않도록 보강).
- 공통 컴포넌트 `components/common/MoneyText.tsx` 추가: nowrap + tabular-nums + 선택적 `shrink`(clamp 폰트).
  `/portfolio` 총 평가금액(가장 큰 KPI)에 `shrink` 적용 — 320px에서 가로 overflow 없이 자동 축소(≈16.6px).
- 검증: 178,000,000 / 492,431,052 / 583,108,674 / 1,234,567,890 모두 한 줄 표시, 320px overflow 없음.

## 5. `/performance` 종목 랭킹 전체 표시 + 위탁/연금/ISA 필터 (#6)

- `lib/performance-qld-from-snapshots.ts`:
  - `buildRankings`에서 `.slice(0, 8)` 제거 → 전체 종목을 평가금액순으로 반환.
  - 각 랭킹 행에 계좌 유형별 분해(`valueByAccountType` / `principalByAccountType`) 추가.
  - `classifyPerformanceAccountType(holding)`: 계좌명/그룹 신호로 `위탁` / `연금` / `ISA` 분류(불명확 → 위탁).
  - `filterQldRankings(rows, enabled)`: 선택된 계좌 유형만 합산·재정렬하고 비중/손익/수익률을 재계산.
    동일 티커가 위탁·ISA 양쪽에 있으면 필터에 따라 평가금액이 정확히 분해된다.
- `components/qld/QldHoldingsRankTable.tsx`:
  - `위탁`/`연금`/`ISA` 체크 버튼 추가(기본 전부 체크, 최소 1개 유지).
  - 데스크톱 표는 헤더 sticky + `max-h-[460px]` 내부 세로 스크롤, 모바일 카드도 동일 내부 스크롤.
  - `Top 8` 라벨 → `전체 N개` / `평가금액순`.

## 6. 계산기 3종 입력항목 간소화 (#7)

원본 Streamlit(`original/pages_app/3_dividend_sim.py`, `4_conversion_analysis.py`, `7_mdd_calculator.py`)
입력 흐름만 메인에 남기고, Next.js에서 추가된 고급 입력과 프리셋 저장/선택/불러오기 UI를 제거.
계산 로직과 결과 영역은 유지하며, 숨긴 값은 기존 기본값으로 내부 처리한다.

- **배당치기 시뮬레이터**: 티커 / 투자자금(달러) / 매수가 기준 / 매도허용기간(N거래일) / 배당소득세율(%) /
  최근 5년 데이터만 보기 / 백테스트 실행. (기준 매수가·배당락 기준가·주당 배당·수수료·슬리피지·분석기간 입력 숨김)
- **매도전환 계산기**: 매도 티커(Sell) / 매수 티커(Buy) / 시작일 / 종료일 / 분석 실행 / 캐시 초기화 +
  공통 시작일 자동 추천 안내. (수량·현재가·평균기간·괴리율·수수료 입력 숨김)
- **MDD 계산기**: 티커 / 시작일 / 종료일 / 분석 실행 + 분석 기간 안내. (기간 모드·통화·금액·샘플가격 입력 숨김,
  `defaultMddInput.analysisPeriod`를 `custom`으로 고정해 시작/종료일이 그대로 적용됨)
- `CalculatorPage`에서 `CalculatorPresetControls` 제거. 탭 구조는 유지.

## 7. 테스트

- 신규 `scripts/check-portfolio-ux-rules.mjs` (`npm run check:portfolio-ux-rules`):
  20만원 미만 계좌 숨김, 자산 구성 성장/배당/현금만, 트리맵 위탁/절세만, 금액 formatter NBSP.
- 신규 `scripts/check-performance-ranking-filters.mjs` (`npm run check:performance-ranking-filters`):
  Top 8 제한 제거(전체 rows), 위탁/연금/ISA 계좌 분류, 필터 재집계 정확도.
- 기존 회귀(`check:portfolio-realdata`, `check:performance-qld-snapshots`, `check:krx-ticker-name-map` 등)
  모두 통과.

## 8. 남은 한계

- 상단 시장 지표(ticker strip)는 여전히 static sample이며 `샘플` 배지가 붙어 있다(본 작업 범위 외).
- 계좌 유형(위탁/연금/ISA) 및 성장/배당/현금 분류는 계좌명·태그 신호 기반이라 데이터 태깅이 불완전하면
  기본값(위탁/성장)으로 떨어질 수 있다. 임의 fuzzy matching은 의도적으로 하지 않았다.
- 매도전환의 `캐시 초기화`는 현재 quote 재요청(재분석) 트리거로 동작한다(서버측 캐시 무효화 아님).
- `components/calculator/CalculatorPresetControls.tsx`는 메인 UI에서 제거됐지만 파일은 남겨 둠(향후 재사용 여지).
