# PORTFOLIO-UX-POLISH-1 — /portfolio UI/모바일/문구 정밀 개선

Date: 2026-06-14

## Purpose

PORTFOLIO-DATA-1로 `/portfolio`가 실데이터 기반으로 전환된 이후, 화면의 시각 품질·모바일 안정성·정보 위계·empty/warning 문구를 polish 했다. 기능 추가나 데이터/계산 로직 변경은 하지 않았고, 기존 Vercel/Next.js 카드 톤과 다크모드 톤을 유지했다.

스코프 밖(변경 안 함): 외부 API, Firebase, OAuth, 신규 의존성, 데이터 helper 계산식, 트리맵 알고리즘, `/market`·`/dividends`·`/calendar`·`/performance` 리디자인. 상단 시장 지표 strip(`PIN_TICKERS`)은 여전히 샘플이며 제거하지 않았다(MARKET-DATA-1 예정).

## 수정한 UI 요소

### 1. warning/empty/sample 문구 (개발자 키 → 사용자 친화 한국어)
`lib/portfolio-from-snapshots.ts`의 warning **코드(code)는 그대로 두고 message만** 사용자 문구로 교체(검증 스크립트는 code로만 매칭하므로 안전).

| code | before (발췌) | after |
| --- | --- | --- |
| `finance_assets_empty` | "...financeAssets가 없어 계좌 그래프는 holdings 기반..." | "스냅샷에 계좌별 잔액 정보가 없어 보유종목 기준으로 계좌 비중을 계산했습니다." |
| `ticker_name_map_applied` | "저장된 KRX 상품명 매핑 N개를 표시 단계에..." | "직접 입력한 KRX 종목코드 N개를 종목 표시에 반영했습니다." |
| `treemap_excluded_invalid_value` | "...유효하지 않은 보유종목 N개..." | "평가금액이 확인되지 않은 종목 N개는 트리맵에서 제외했습니다." |
| `treemap_value_unavailable` | "평가금액 필드가 없어..." | "평가금액 정보가 없어 트리맵을 표시하지 않습니다." |
| `account_allocation_unavailable` | "financeAssets.amountKRW 또는 holdings.valueKRW 계좌 필드가..." | "계좌별 평가금액 정보가 없어 계좌 비중을 표시하지 않습니다." |
| `account_allocation_holdings_fallback` | "financeAssets에서...holdings의 계좌/금융사 필드로..." | "계좌별 잔액 정보가 없어 보유종목의 계좌·금융사 기준으로 계좌 비중을 계산했습니다." |
| `asset_allocation_unavailable` | "holdings.assetType 또는 financeAssets.category 금액이..." | "자산 종류 정보가 없어 자산 구성을 표시하지 않습니다." |
| `purpose_tags_unavailable` | "목적/태그 필드가 없어..." | "목적·태그 정보가 없어 태그 구성은 표시하지 않습니다." |

`app/portfolio/page.tsx`의 donut `emptyMessage`, `components/AssetAccountCards.tsx`/`PortfolioTreemap.tsx`/`PortfolioSummary.tsx`의 empty 문구도 `financeAssets.amountKRW`·`holdings.valueKRW`·`필드` 같은 내부 용어를 제거하고 "정보가 없어 ~표시할 수 없습니다" 형태로 통일.

### 2. warning vs info 분리
`page.tsx`에서 `portfolioView.warnings`를 severity로 나눠 렌더링:
- `severity === "warning"` → 호박(amber) "확인이 필요한 항목" 박스 (실제 조치가 필요한 항목만).
- `severity === "info"` → 별도의 muted 슬레이트 안내 박스 (단순 안내).
- `no_snapshot` info는 전용 empty 배너가 따로 있으므로 info 목록에서 제외.

기존에는 info(예: 매핑 적용 안내)도 "데이터 확인 필요" 박스에 섞여 불필요하게 경고처럼 보였다.

### 3. 상단 배너 정리
- 스냅샷 존재 시 떴던 emerald "실데이터를 표시하고 있습니다. sample fallback은 사용하지 않습니다." 배너 제거(헤더의 "{날짜} 스냅샷 기준"과 중복되는 reassurance 노이즈).
- 스냅샷 없음 배너는 light/dark 모두 대비가 맞는 색으로 바꾸고 "포트폴리오 관리에서 엑셀을 등록하면 자산 구성과 보유종목이 여기에 표시됩니다."로 행동 유도형 문구.

### 4. sample badge 위치/위계
- `시장 지표 샘플` 배지를 H1 제목 옆(전체 페이지가 샘플처럼 보임)에서 **시장 지표 strip 바로 위 "시장 지표 [샘플]"** 로 이동. 본문 실데이터 섹션과 혼동되지 않도록 strip에 귀속.
- 트리맵이 비었을 때 쓰던 `SampleBadge label="empty"`(호박색=샘플 오해)를 중립 회색 "표시할 데이터 없음" 칩으로 교체.

### 5. light/dark 대비 수정 (실제 버그)
- `PortfolioSummary`의 `RatioRow`(투자/현금 비중 바)가 다크 전용 색(`text-slate-300`/`text-white`/`bg-[#2a3336]`)을 라이트 모드 흰 카드 위에도 그대로 써서 가독성이 낮았음 → `isLight` 분기 추가.
- summary 카드의 컬럼 구분선 `xl:divide-[#2a3336]`(다크색)이 라이트에도 적용되던 것을 `isLight ? xl:divide-slate-200 : xl:divide-[#2a3336]`로 분기.

### 6. summary 4번째 "데이터 상태" 칼럼 다듬기
- 라벨을 친화적으로: `소스` → `불러온 파일`, `사용 금액` → `평가 기준`.
- 상태 문구 `실데이터 스냅샷`/`empty state` → `최신 스냅샷 실데이터`/`스냅샷 등록 전`.
- 긴 파일명은 `break-all` 대신 `truncate` + `title` 툴팁으로 한 줄 유지.
- 1번째 칼럼 보조문구 `sample fallback 없이 최신 스냅샷만 사용` → `최신 스냅샷 실데이터 기준`.

### 7. 실시간 시세 패널(PortfolioQuoteStatusPanel)
- 전체 영어 개발자 문구 → 한국어("실시간 시세 (참고용)", "미국 종목 N개", "외 N개", "시세는 참고용이며, 평가금액은 등록한 스냅샷 기준으로 유지됩니다.").
- 하드코딩 다크색(`bg-[#171d1e]`) → `useResolvedTheme()` 기반 light/dark muted 톤으로 위계 하향.
- 조회 가능한 미국 종목이 없을 때의 영어 안내 패널은 정보 가치가 없어 **숨김(return null)**.
- 경고 카운트 문구가 본문 "확인이 필요한 항목"과 중복되고 환경 의존적(프리뷰 네트워크 차단 시 과다)이라, 숫자 노출 대신 "일부 종목 시세는 불러오지 못했습니다."로 변경.

## 문구 정책 요약
- 내부 필드명/코드(`financeAssets.amountKRW`, `holdings.valueKRW`, `필드`, `empty state`, `sample fallback`)는 UI에 노출하지 않는다.
- 같은 경고는 `addWarning`의 code 중복 제거로 한 번만 표시.
- empty 상태는 "무엇을 하면 데이터가 보이는지"(엑셀/스냅샷 등록)를 함께 안내.
- 조치가 필요한 항목(warning)과 단순 안내(info)를 시각적으로 분리.
- 샘플 배지는 상단 시장 지표 strip에만 명확히 붙이고, 본문 실데이터 섹션엔 붙이지 않는다.

## 모바일/시각 확인 결과
프리뷰 dev server로 `/portfolio`를 직접 확인(`clientWidth`/`scrollWidth` 측정, 스크롤 컨테이너 제외 overflow 탐지 포함).

| 폭 | 테마 | clientW | scrollW | 가로 overflow |
| --- | --- | --- | --- | --- |
| 1280 | light | 1265 | 1265 | 없음 |
| 1280 | dark | 1265 | 1265 | 없음 |
| 390 | light | 390 | 390 | 없음 |
| 320 | light | 320 | 320 | 없음 (스크롤 strip 외 culprit 0) |

- 긴 종목명("PROSHARES ULTRA QQQ (QLD)" 등)·계좌명·파일명: 카드/리스트에서 `truncate`로 한 줄 처리, 트리맵 타일도 truncate.
- 시장 지표 strip은 의도된 가로 스크롤(`overflow-x-auto`)이며 페이지 가로 스크롤을 만들지 않음.
- empty(스냅샷 없음)·populated(holdings + financeAssets) 두 상태 모두 확인.
- light/dark 모두 경고/안내/샘플 박스 대비 양호, 콘솔 에러 없음.

### 회귀 스팟체크 (390px)
- `/portfolio-manager`: overflow 없음, 레이아웃·TICKER-4 입력 영역 정상.
- `/performance`: overflow 없음, PERF-DATA-1/2 KPI·차트가 주입 스냅샷 실데이터로 정상 렌더.
- `/dividends`: overflow 없음(미수정 컴포넌트).

## 검증 명령 결과
- `npm.cmd run check:portfolio-realdata` — 통과
- `npm.cmd run check:krx-ticker-name-map` — 통과
- `npm.cmd run typecheck` — 통과
- `npm.cmd run lint` — 경고/에러 없음
- `npm.cmd run build` — 보류. 작업 중 dev server(외부 3000 + 프리뷰)가 떠 있어 `.next` 충돌 위험이 있고, 작업 지침상 build 전 dev server off가 필수 조건이라 미실행. typecheck/lint/regression으로 대체 검증.

## 변경 파일
- `app/portfolio/page.tsx`
- `components/PortfolioSummary.tsx`
- `components/AssetAccountCards.tsx`
- `components/PortfolioTreemap.tsx`
- `components/portfolio/PortfolioQuoteStatusPanel.tsx`
- `lib/portfolio-from-snapshots.ts`
- `docs/PORTFOLIO_UX_POLISH1.md`
- `docs/AUDIT.md`

`DonutChartCard.tsx`는 호출부(page.tsx)에서 `emptyMessage`만 바꿔 적용했고 컴포넌트 자체는 수정하지 않았다.

## 남은 한계
- 상단 시장 지표 strip은 여전히 샘플(`PIN_TICKERS`). 실데이터화는 MARKET-DATA-1에서.
- 실시간 시세 패널은 참고용이며, 네트워크 불가 환경에서는 시세를 못 불러올 수 있다(문구로 안내).
- 섹터/배당 예측/SCHD 목표/환율 추세 등은 현재 스냅샷 스키마로 안전하게 도출 불가 → 표시하지 않음(PORTFOLIO-DATA-1 정책 유지).
- 트리맵은 Top N/“기타” 압축 없이 전 종목을 표시(알고리즘 변경은 스코프 밖). 종목 수가 매우 많아지면 별도 단계에서 재검토 필요.

## next step 권장
- MARKET-DATA-1: 상단 시장 지표 strip 실데이터 연결 및 샘플 배지 제거.
- 보유종목 수가 큰 스냅샷에 대한 트리맵 Top N/기타 묶음(가독성) 별도 단계.
