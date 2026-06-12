# Gorani Finance 기능 복원/이식 메타 구현 계획서

> 통합본: Fable 1차 산출물(접근 검증~Step 2 초반)과 2차 이어쓰기 산출물(Step 2 나머지~Step 8, 최종 요약)을 하나로 합친 완결판입니다.
> 실제 저장소 경로는 `original/` = 원본 Streamlit/Python 프로젝트, `target/` = 수정대상 Next.js/TypeScript/Tailwind 프로젝트 기준입니다.


## 1. 접근 검증 결과
중요 경로 정정: 요청에서는 origin/으로 지칭했지만, 실제 저장소 루트 폴더명은 original/ 입니다. ZIP은 풀려 있고 한 단계 더 들어간 경로(original/cococute88-...)는 없습니다. 이하 모든 경로와 Codex 프롬프트는 실제 경로인 original/...과 target/... 기준으로 작성합니다.
읽기 방식: GitLab 저장소 API로 main 브랜치 HEAD의 파일 원문을 직접 읽었습니다. ZIP/diff/파일명 추정 없음.



구분
요청 경로
실제 확인 경로
파일 존재
원문 직접 읽기
결과
비고



원본
origin/app.py
original/app.py
O
전체
OK
OAuth+쿠키+st.navigation+즐겨찾기


원본
origin/core/sync.py
original/core/sync.py
O
전체
OK
키 sanitize, load_all_data, 캘린더 저장


원본
origin/core/auth.py
original/core/auth.py
O
전체
OK
레거시(미사용 추정) 로그인


원본
origin/core/firebase.py
original/core/firebase.py
O
전체
OK
RTDB users/{uid}/{path}


원본
origin/logic/simulator.py
original/logic/simulator.py
O
전체
OK
자산시뮬 핵심 계산 전부


원본
origin/logic/tracker.py
original/logic/tracker.py
O
전체
OK
뱅샐 파싱·분류·정렬


원본
origin/logic/tracker_performance.py
original/logic/tracker_performance.py
O
전체
OK
가상 성과 백테스트


원본
origin/logic/market.py
original/logic/market.py
O
전체
OK
RSI/MDD/시장온도 v1·v2


원본
origin/logic/dividend_ledger.py
original/logic/dividend_ledger.py
O
전체
OK
배당장부 계산 전부


원본
origin/logic/dividend_performance.py
original/logic/dividend_performance.py
O
전체
OK
장부 성과/벤치마크


원본
origin/modules/dividend_calendar.py
original/modules/dividend_calendar.py
O
전체
OK
캘린더 이벤트 생성/추론/절세


원본
origin/pages_app/1_asset_simulator.py
original/pages_app/1_asset_simulator.py
O
일부(0–119/357행)
OK
설정 저장/복원 로직 확인


원본
origin/pages_app/2_asset_tracker.py
original/pages_app/2_asset_tracker.py
O
일부(0–149/430행)
OK
입력/삭제/색상 로직 확인


원본
origin/pages_app/3_dividend_sim.py
original/pages_app/3_dividend_sim.py
O
전체
OK
양도세치기 백테스트 전체


원본
origin/pages_app/4_conversion_analysis.py
original/pages_app/4_conversion_analysis.py
O
일부(0–249/292행)
OK
전환비 계산 핵심 확인


원본
origin/pages_app/5_dividend_calendar.py
original/pages_app/5_dividend_calendar.py
O
전체
OK
modules 위임 래퍼


원본
origin/pages_app/6_market_temperature.py
original/pages_app/6_market_temperature.py
O
일부(0–119/1023행)
OK
워치리스트/지표 정의 확인


원본
origin/pages_app/7_mdd_calculator.py
original/pages_app/7_mdd_calculator.py
O
일부(0–199/510행)
OK
데이터 폴백/환산 확인


원본
origin/pages_app/8_attractiveness_score.py
original/pages_app/8_attractiveness_score.py
O
일부(0–299/733행)
OK
SCHD TTM 배당률 핵심 확인


원본
origin/pages_app/9_dividend_ledger.py
original/pages_app/9_dividend_ledger.py
O
일부(0–149/816행)
OK
저장 경로/시세 조회 확인


원본
origin/data/
original/data/economic_calendar_us_high.json
O
목록만
OK
GitHub Actions 생성 정적 JSON


원본
origin/docs/
original/docs/ (NAVIGATION_MAP.md 등)
O
목록만
OK
내용 미열람


원본
(요청외)
original/pages_app/pages_app/*
O
목록만
주의
1~4페이지 구버전 중복 폴더. 무시 대상


대상
target/package.json
target/package.json
O
전체
OK
build/lint만 있음, typecheck 없음


대상
target/app/
target/app/* (11개 라우트)
O
목록 전체
OK



대상
target/components/* (8개 도메인)
동일
O
목록 전체 + 핵심 2개 원문
OK
DividendPage, DividendCalendarPage 원문


대상
target/lib/firebase/
auth.ts, client.ts, firestore-repositories.ts
O
전체
OK



대상
target/lib/mockData.ts
동일
O
일부(0–79/795행)
OK
NAV_ITEMS/PIN_TICKERS 확인


대상
target/lib/mock-portfolio-data.ts 외 mock-* 5종
동일
O
존재 확인(원문 미열람)
부분
사용처는 호출부에서 확인됨


대상
target/lib/asset-simulator.ts
동일
O
일부(0–119/727행)
OK
원본 로직 TS 이식 이미 존재


대상
target/lib/portfolio-aggregate.ts
동일
O
일부(0–69/179행)
OK



대상
target/lib/portfolio-store.ts
동일
O
거의 전체(0–199/213행)
OK
localStorage store


대상
target/lib/conversion-calculator.ts
동일
O
전체
OK
mock 데이터 기반


대상
target/lib/dividend-capture-calculator.ts
동일
O
전체
OK
mock 데이터 기반


대상
target/lib/mdd-calculator.ts
동일
O
거의 전체(0–119/123행)
OK
mock 데이터 기반


대상
target/lib/banksalad-parser.ts
동일
O
일부(0–119/539행)
OK
xlsx 실파서 (원본보다 고도화)


대상
(추가) lib/calculator-data-provider.ts
동일
O
전체
OK
합성(사인파) mock 시세 생성기


대상
(추가) lib/market-data.ts
동일
O
거의 전체
OK
전부 MOCK 반환, fetch 교체 지점 명시됨


추정 없이 확정 가능한 범위: 원본의 모든 계산 로직(logic/, modules/)과 저장 구조, 대상의 저장 구조·mock 경계는 원문으로 확정. 일부 페이지 파일 후반부(차트 렌더링 위주)와 target mock-* 파일 내부 수치는 미열람이므로, 해당 부분 서술에는 "추정" 표기를 붙였습니다. 전체 설계를 멈출 수준의 미열람 파일은 없습니다.

## 2. 최종 목표 선언
target/(Next.js 14 + TS + Tailwind + Recharts)을 예쁜 데모에서 실사용 가능한 Gorani Finance 앱으로 끌어올린다.

UI는 target 유지: 다크 테마, 카드형 레이아웃, TopNav, Recharts 차트, 컴포넌트 구조와 라우팅을 그대로 유지한다. 원본 Streamlit UI를 복사하지 않는다.
기능/로직/흐름은 original 수준 이상: 원본에서 실제로 동작하는 계산식(자산시뮬 인출 이분탐색, 양도세치기 백테스트, 전환비, MDD, 시장온도, 배당 추정, 배당장부)과 저장/복원(사용자별 클라우드 + 새로고침 복원)을 target 구조(localStorage + Firebase Auth + Firestore + 정적 JSON + 무료 시세 API)로 재구현한다.
단순 마이그레이션이 아니다. Streamlit의 session_state/RTDB 모델을 Next.js의 store/repository 모델로 재설계해 이식하는 작업이다.
target에만 있는 기능(포트폴리오 관리, 엑셀 파서, QLD 대시보드, asset-map, 계산기 프리셋 등)은 삭제하지 않고 보존·정리한다.


## 3. 두 프로젝트의 역할 정의
### 3-1. original/ 원본 프로젝트의 역할
기능/로직/사용 흐름의 기준. 실제 작동 확인된 핵심 기능:



기능
원본 파일
비고



Google OAuth 로그인 + 쿠키 자동로그인
original/app.py
streamlit_oauth + EncryptedCookieManager


즐겨찾기 링크(최대 10개) 관리
original/app.py (load_favorite_links/save_favorite_links)
RTDB favorite_links


자산 시뮬레이터 (적립/은퇴/인출, ISA·연금 한도, 이분탐색 인출 최적화)
original/logic/simulator.py, pages_app/1_asset_simulator.py
설정은 sim_config로 저장/복원


자산 트래커 (뱅샐 텍스트 붙여넣기 → 월별 스냅샷, 슈퍼그룹 정렬/색상, 월별 추이)
original/logic/tracker.py, pages_app/2_asset_tracker.py
tracker, tracker_config


트래커 가상 성과 (보유 태그→티커 매핑, KOSPI/S&P/QQQ 벤치마크, 월별 손익)
original/logic/tracker_performance.py
yfinance+Stooq 폴백


양도세치기 배당시뮬 (배당락 백테스트: 승률/손익비/회복일)
original/pages_app/3_dividend_sim.py
실데이터(yfinance max)


매도전환계산 (Sell/Buy 전환비 추이·평균, 공통 시작일 자동)
original/pages_app/4_conversion_analysis.py



배당캘린더 (다중 포트폴리오, 실제 배당 선언 + 패턴 추론 이벤트 투영, 메모/마크/커스텀 일정, 절세액, 경제일정)
original/modules/dividend_calendar.py
dividend_calendar 노드에 전부 저장


시장온도 (QQQ/SCHD/SPY RSI·드로다운, CNN F&G, 고라니 온도 v1/v2)
original/pages_app/6_market_temperature.py, logic/market.py



MDD계산 (실데이터 MDD/고점·저점·회복일, KRW 환산)
original/pages_app/7_mdd_calculator.py, logic/market.py



SCHD매력도 (TTM 배당률, 분할 보정, 52주 고점 대비, 목표수익률 3.5~3.8% 매수가)
original/pages_app/8_attractiveness_score.py



배당금가계부 (거래 등록→보유 집계, 가격 폴백 3단, 월별 예상배당, 목표 달성률, 성과 벤치마크)
original/logic/dividend_ledger.py, logic/dividend_performance.py, pages_app/9_dividend_ledger.py
dividend_ledger


저장/복원 방식(확정): Firebase RTDB users/{safe_uid}/{path}. safe_uid는 이메일의 @/.→_ 치환(core/sync.py::_safe_uid). 노드: tracker, tracker_config, sim_config, dividend_calendar(portfolios/memos/marks/custom_ce/cached_events + _last_sync), favorite_links, dividend_ledger(transactions/targets/settings). 빈 컬렉션 삭제 방지용 더미 토큰(_EMPTY_, _EMPTY_DICT_, _EMPTY_PF_)과 금지문자 치환(sanitize_firebase_keys)이 존재. 앱 진입 시 load_all_data()가 전부 일괄 로드.
메뉴 구조(확정): 상단 st.navigation 9개 — 자산시뮬 / 자산트래커 / 양도세치기 / 매도전환계산 / 배당캘린더(기본) / 시장온도 / MDD계산 / SCHD매력도 / 배당금가계부. 사이드바: 사용자 표시, 로그아웃, 즐겨찾기 링크, (캘린더 페이지에서) 포트폴리오 선택/절세액 표.
핵심 데이터 구조(확정):

트래커: { "YYYY-MM": { tag: amountKRW } }
시뮬 설정: {start_year, sim_years, return_rate, inflation_rate, init_isa, init_pension, init_general, withdraw_rate, withdraw_increase, withdraw_delay, plan_data[]}
캘린더: DividendEvent{ticker, event_type(ex_div|buy|payment|earnings), event_date, ex_div_date, buy_deadline, payment_date, dividend_amount, current_price, annual_yield, estimated, is_etf}
장부: transaction{id, date, asset_class(US|KR|COIN), ticker, fetch_ticker, side(BUY|SELL), quantity, price, currency, exchange_rate, memo}

### 3-2. target/ 수정대상 프로젝트의 역할
UI/구조/디자인 기반. 보존할 좋은 구조:

라우팅: /portfolio, /dividends, /performance, /watchlist(배당캘린더), /market, /calculator, /asset-simulator, /portfolio-manager, /asset-map, /qld-dashboard, /(홈)
이미 재사용 가능한 TS 로직:
lib/asset-simulator.ts — 원본 logic/simulator.py가 이미 거의 그대로 이식돼 있음 (assign_statuses, ISA/연금 한도 1800/2000/3800, 2051 세율 0.099/0.055 상수 일치). 검증만 하면 됨.
lib/banksalad-parser.ts — 원본 텍스트 파서보다 고도화된 xlsx 엑셀 파서(헤더 탐색, 합계행 제외, 태그 파싱).
lib/portfolio-store.ts — localStorage + useSyncExternalStore 스냅샷 store. replaceSnapshots()로 외부 저장소 주입 지점도 마련됨.
lib/firebase/* — Firebase Auth(Google popup) + Firestore repository (portfolioSnapshots, calendarTickers, calendarEvents, calendarSettings, assetSimulatorConfigs, calculatorPresets) + warnFirestoreFallback 패턴.
lib/portfolio-aggregate.ts, use-portfolio-view.ts, portfolio-summary-row.ts, ticker-mapper.ts, portfolio-tags.ts


원본보다 나은 기능 후보: 포트폴리오 관리 페이지(+엑셀 업로드/미리보기/스냅샷 히스토리), QLD 대시보드, asset-map, TradingView treemap, 계산기 프리셋(CalculatorPresetControls + Firestore), StorageModeBadge, 인증 UI(AuthStatus, LoginButton).
mock/dummy/preview인 부분(확정):
lib/calculator-data-provider.ts — 사인파 합성 시세 생성기. 계산기 3종이 전부 이걸 사용 → 결과가 실데이터가 아님.
lib/market-data.ts — 전 함수가 MOCK_* 반환 (TODO(codex) fetch 교체 주석 있음).
lib/mock-calendar-data.ts — buildMockCalendarEvents로 가짜 배당 일정 생성.
lib/mock-dividend-data.ts — 배당 페이지 수익률/배당 시리즈, MOCK_SHARE_PRICE_KRW 하드코딩.
lib/mockData.ts — NAV_ITEMS(보존) + PIN_TICKERS 등 홈 mock.
components/*/PreviewNotice.tsx, SimulatorPreviewNotice.tsx, PortfolioSelectorMock.tsx, TreemapMock.tsx.




## 4. 전체 메뉴/라우팅 매핑표
원본 기능/페이지
원본 파일
수정대상 대응 라우트
수정대상 관련 파일
현재 상태
이식 필요도
비고



자산시뮬
original/pages_app/1_asset_simulator.py, logic/simulator.py
/asset-simulator
lib/asset-simulator.ts, components/asset-simulator/*
일부 구현
중
계산 로직은 이식 완료 추정, 저장/복원 검증 필요


자산트래커(월별 스냅샷)
pages_app/2_asset_tracker.py, logic/tracker.py
/portfolio-manager + /portfolio
lib/banksalad-parser.ts, portfolio-store.ts, components/portfolio/*
일부 구현
높음
입력은 엑셀로 진화. 월별 추이/슈퍼그룹 정렬 누락


트래커 가상 성과
logic/tracker_performance.py
/performance
app/performance/page.tsx, PerformanceChart.tsx
mock 데이터
P0
실시세/벤치마크 미연결


양도세치기 배당시뮬
pages_app/3_dividend_sim.py
/calculator (배당치기 탭)
lib/dividend-capture-calculator.ts
mock 데이터
P0
로직 구조는 충실, 시세가 합성


매도전환계산
pages_app/4_conversion_analysis.py
/calculator (전환 탭)
lib/conversion-calculator.ts
mock 데이터
P0
동일


배당캘린더
modules/dividend_calendar.py
/watchlist
components/watchlist/*, lib/mock-calendar-data.ts
mock 데이터(메타 저장만 실동작)
P0
이벤트 생성이 mock. 메모/마크는 localStorage+Firestore 동작


시장온도
pages_app/6_market_temperature.py, logic/market.py
/market
components/market/*, lib/market-data.ts
mock 데이터
P1
RSI/F&G/온도 전부 mock


MDD계산
pages_app/7_mdd_calculator.py
/calculator (MDD 탭)
lib/mdd-calculator.ts
mock 데이터
P1
입력값으로 mock 시세를 변형하는 기형 구조


SCHD매력도
pages_app/8_attractiveness_score.py
대응 라우트 없음
(없음)
미구현
P1
/market 하위 섹션 또는 신규 탭으로 이식


배당금가계부
pages_app/9_dividend_ledger.py, logic/dividend_ledger.py, logic/dividend_performance.py
/dividends (부분)
components/dividend/*, lib/mock-dividend-data.ts
일부 구현+mock
P0
거래 등록 개념 자체가 없음. 스냅샷 기반으로만 동작


즐겨찾기 링크
app.py
대응 없음
(없음)
미구현
P2
TopNav 또는 홈에 추가


경제 일정(미국)
modules/dividend_calendar.py + data/economic_calendar_us_high.json
/watchlist
EconomicCalendarMini.tsx
mock 데이터(추정)
P1
정적 JSON 복사로 즉시 해결 가능


로그인/사용자별 저장
app.py, core/*
전역
lib/firebase/*, components/auth/*
일부 구현
높음
Auth/Firestore 골격 존재, 전 도메인 연결 미완


(원본에 없음) 포트폴리오 관리+엑셀 업로드
-
/portfolio-manager
ExcelUploadCard, PortfolioParsePreview, SnapshotHistory
원본에는 없지만 수정대상에 있음
Preserve
원본 텍스트 붙여넣기의 상위 호환


(원본에 없음) QLD 대시보드
-
/qld-dashboard
components/qld/*, lib/qldDashboardData.ts
원본에는 없지만 수정대상에 있음
Preserve
스냅샷 데이터 연결로 개선 가능


(원본에 없음) 자산 맵
-
/asset-map
AssetMapSection, TradingViewTreemap
원본에는 없지만 수정대상에 있음
Preserve



(원본에 없음) 홈 대시보드
-
/
app/page.tsx, mockData.ts
mock 데이터
원본보다 개선 가능
실데이터 요약으로 승격



## 5. 기능 차이 상세 비교표
영역
원본에서 실제로 되는 것
수정대상 현재 상태
문제점
필요한 조치
우선순위



시세 데이터
yfinance(history/dividends/fast_info) + Stooq CSV 폴백 + USDKRW 환율
calculator-data-provider.ts가 사인파 합성
모든 계산기/차트 결과가 가짜
Next API route(/api/quote/history 등)로 Yahoo chart JSON + Stooq CSV 폴백 구현, provider 교체
P0


배당캘린더 이벤트
선언 배당(yfinance/Finnhub/Polygon) + 빈도 추론(infer_frequency_months) + 패턴 투영(get_pattern_date) + 거래일 보정(미 연방 공휴일)
buildMockCalendarEvents 가짜 일정
일정 자체가 허구라 사용 불가
lib/dividend-events.ts로 원본 알고리즘 이식, 티커별 캐시(localStorage+Firestore calendarTickers)
P0


절세액 계산
calc_tax_savings: shares=⌊10000/price⌋, savings=shares×div×0.85×0.22 + 과거 5년 백테스트 절세액
buildTaxSavingRows(mock 추정)
수치 무의미
원본 식 그대로 이식 (상수 TAX_RETENTION_RATE=0.85, DIVIDEND_TAX_RATE=0.22, INVESTMENT_BUDGET=10000)
P0


양도세치기
전체 배당 이력 백테스트, D-1/D-2 시가/종가, BEP=매수가−세후배당, 회복불가 표기, 승률/손익비/기대수익률/절세예상액
TS 로직은 거의 동일 구조이나 데이터가 mock + 16회 제한
실데이터 미연결
provider 교체 + recent5yOnly/전체기간 지원, 행 제한 제거
P0


전환계산
두 티커 전체 히스토리, 공통 시작일 자동 추천, 전환비 시계열+평균
18개 샘플링 mock
실데이터 미연결, 공통 시작일 자동화 없음
provider 교체 + computeCommonStart 이식
P0


MDD
compute_mdd_details: 고점/저점/회복일/현재 낙폭, KRW 환산(align_and_convert_to_krw)
입력 high/low로 mock 시계열을 강제로 구부림
실측이 아님
원본 순수함수 이식(이식 난이도 낮음), 입력 가격 강제 변형 제거
P1


시장온도
Wilder RSI(ewm alpha=1/14), 드로다운, CNN F&G 실페치, 고라니온도 v1(가중평균)·v2(7요소 percentile)
전부 MOCK_*
시장 페이지 전체가 장식
lib/market-calc.ts에 RSI/drawdown/온도 이식 + API route 시세 연결, CNN F&G는 서버 프록시
P1


트래커 성과
최신 스냅샷 태그→티커 매핑, 수량 역산(amount/현재가), 벤치마크 스케일링, 월별 손익 12개월
/performance는 mock 시리즈
성과 페이지 무의미
lib/tracker-performance.ts 이식, 스냅샷 store 연결
P0


배당장부(거래)
BUY/SELL 평균단가, 가격 3단 폴백(current→last_trade→avg_cost), 월별 예상배당(과거 24개월 월별 합), 목표 달성률(USD 기준)
거래 입력 UI 없음. 스냅샷 보유종목 + mock 단가로 유사 표시
핵심 사용 흐름(거래 기록) 부재
lib/dividend-ledger.ts 이식 + /dividends에 거래 등록 UI 추가, MOCK_SHARE_PRICE_KRW 제거
P0


SCHD매력도
TTM 4회 배당합/종가, 분할 이상치 보정, 목표 배당률(3.5~3.8%)별 매수가, 52주 고점 낙폭
없음
기능 누락
lib/schd-attractiveness.ts 신규 이식, /market 내 섹션 배치
P1


저장/복원
로그인 시 전 데이터 일괄 로드, 변경 즉시 클라우드 저장, 새로고침 복원
포트폴리오 스냅샷·캘린더 메타·시뮬 설정만 부분 연결
도메인별 일관성 없음
통합 repository 패턴(9장)으로 전 도메인 정렬
P0


즐겨찾기 링크
이름+URL 10개, URL 정규화, 클라우드 동기화
없음
기능 누락
favoriteLinks Firestore 컬렉션 + localStorage, TopNav 드롭다운
P2


경제 일정
정적 JSON 30일 내 고중요도 일정, stale 경고
mock 추정
데이터 없음
original/data/economic_calendar_us_high.json → target/public/data/로 복사 + 파서 이식
P1


메뉴 사용감
배당캘린더가 기본 페이지
/ 홈이 mock 대시보드
진입 동선 다름
홈을 실데이터 요약으로, 주요 CTA 정렬 (홈 유지 자체는 개선으로 인정)
P2


(target 전용) 엑셀 업로드/스냅샷/QLD/asset-map/프리셋
-
동작 또는 부분 동작
-
보존 + 실데이터 연결
Preserve



## 6. 원본 핵심 로직 추출 목록
6-1. 자산 시뮬레이터 계산

원본 위치: original/logic/simulator.py
근거: simulate_deposits, apply_returns, _find_optimal(이분탐색 50회), simulate_tax_account_withdraw, simulate_total_withdraw 전체 원문 확인
하는 일: 연도별 적립 계획(월적립액, ISA/연금 체크, ISA→연금 이전)으로 잔고를 시뮬레이션하고, 은퇴 후 절세계좌 인출액을 이분탐색으로 최적화
입력: SimConfig(만원 단위), YearPlan[]
출력: YearResult[], WithdrawPlan, TotalWithdrawRow[]
핵심 계산식/분기: 연 1,000만원 미만 적립 해 = 은퇴; ISA 한도 2000, 연금 1800(이전 시 3800); 2050 ISA 누적한도 10000; 2051 세율 ISA 9.9%/연금 5.5%; 인출 제약 ①잔고≥인출 ②누적≤한도 ③비감소 ④withdraw_rate 상한
예외 처리: withdraw_delay 1~15 클램프, retire 없으면 None
대응 위치: target/lib/asset-simulator.ts — 이미 이식돼 있음(상수 일치 확인)
필요 타입: lib/asset-simulator-types.ts 기존 사용
테스트: 기본값(init_isa=2000, init_pension=11897, 6%/3%) 입력 시 원본과 연도별 total_nominal 일치 비교
난이도: 낮음(검증만) / 우선순위: P1(검증), 저장 연결은 P0

6-2. 자산 트래커 집계

원본 위치: original/logic/tracker.py
근거: parse_data, extract_tag, process_data(20만원 미만→기타), get_asset_type, sort_tags_by_super_group, aggregate_for_trend 원문
하는 일: 뱅샐 텍스트 파싱→#태그 추출→태그별 합산, 자산군 분류(cash/dollar/leverage/nasdaq/spy/dividend/other)와 슈퍼그룹 3단 정렬, 월별 추이 시리즈 생성
입력: { "YYYY-MM": {tag: amount} } / 출력: 정렬된 엔트리, (labels, series)
대응 위치: target은 엑셀 파서로 진화했으므로 get_asset_type/sort_tags_by_super_group/aggregate_for_trend만 lib/asset-classification.ts로 이식해 /portfolio 도넛·추이 차트에 적용
테스트: TQQQ→leverage, 예금→cash, SCHD→dividend; 슈퍼그룹 합계 내림차순 정렬 확인
난이도: 낮음 / 우선순위: P1

6-3. 투자 성과(트래커 가상 백테스트)

원본 위치: original/logic/tracker_performance.py
근거: build_tracker_performance, map_tracker_tag_to_asset, _scale_index_to_initial, _monthly_profit_frame 원문
하는 일: 최신 스냅샷 평가액으로 수량을 역산(amount÷현재가)해 과거 구간 포트폴리오 가치 시계열을 재구성, KOSPI/S&P500/QQQ를 동일 초기자본으로 스케일링해 비교, 최근 12개월 월별 손익 계산
핵심 분기: 현금성 키워드 제외, US_TICKERS/한국 6자리(.KS→.KQ 폴백)/BTC-KRW 매핑; effective_start = 모든 자산 시작일의 max
예외: FX 실패 시 USD 자산 제외+경고, 데이터 부족 시 경고 누적(앱은 안 죽음)
대응 위치: target/lib/tracker-performance.ts 신규 + /performance 페이지 연결 (스냅샷은 portfolio-store에서)
필요 타입: PerformancePoint{date, portfolio, initialCapital, kospi?, sp500?, qqq?}, MonthlyProfit{label, profit}
테스트: 단일 자산 SPY 100만원, 1년 전 시작 → SPY 수익률과 포트폴리오 수익률 일치
난이도: 높음(시세 API 의존) / 우선순위: P0

6-4. 배당 시뮬레이션(양도세치기)

원본 위치: original/pages_app/3_dividend_sim.py (전체 원문)
핵심: 배당락일 idx 기준 매수가(D-1/D-2 × 시가/종가), after_tax_div = div × (1−taxRate/100), bep = buy − after_tax_div, sell_window 내 High≥bep → 성공(수익률 = after_tax_div/buy), 실패 시 마지막 종가 매도 수익률 + 원금 회복일(거래일/달력일, 불가 시 "회복불가"); 요약 = 승률·성공/실패 평균·손익비·기대수익률·절세예상액(avg_profit%×자본×0.22)
대응 위치: target/lib/dividend-capture-calculator.ts — 구조 이미 유사. 데이터 provider만 실데이터로 교체 + .slice(-16) 제한 제거 + 전체기간/5년 토글
테스트: ARCC 최근 5년, 세율 15%, window 0 → 원본과 회차 수/승률 일치
난이도: 중 / 우선순위: P0

6-5. 매도전환 계산

원본 위치: original/pages_app/4_conversion_analysis.py
핵심: Conversion_Ratio = Sell_Close / Buy_Close (inner-join 후 구간 슬라이스), latest_ratio, average_ratio; 공통 시작일 = 두 티커 첫 거래일의 max(티커 변경 시 자동 갱신)
대응 위치: target/lib/conversion-calculator.ts — 평균/편차/신호 로직 유지, 데이터 교체 + computeCommonStart() 추가. target의 수수료/매수가능주수 계산은 원본에 없는 개선이므로 보존
테스트: TQQQ/SCHD 3년 → 평균 전환비가 원본과 ±0.1% 이내
난이도: 중 / 우선순위: P0

6-6. 배당 캘린더 이벤트 생성/추론

원본 위치: original/modules/dividend_calendar.py
근거: fetch_ticker_bundle, infer_frequency_months(median 간격: ≤45일=월배당, ≤120=분기, ≤210=반기, 그 외=연), get_pattern_date(같은 요일·n번째 주 투영), get_next_trading_day/get_prev_trading_day(주말+미 연방 공휴일 회피), _project_future_dividends_cached(선언 이벤트 + 20일 내 중복 제거 후 추정 이벤트 투영, 1년 horizon), calc_tax_savings
출력: ex_div/buy/payment/earnings 4종 이벤트, estimated 플래그
대응 위치: target/lib/dividend-events.ts 신규 + /api/quote/dividends route. 공휴일은 2020~2035 미 연방 공휴일 정적 배열로 대체
필요 타입: 원본 DividendEvent.to_dict() 그대로 interface화
테스트: SCHD → 분기(3개월) 추론; ex-div가 주말이면 다음 거래일로 이동; buy_deadline = ex-div 전 거래일
난이도: 높음 / 우선순위: P0

6-7. 시장 온도/RSI/MDD 계산

원본 위치: original/logic/market.py (전체 원문)
핵심: compute_rsi(Wilder, ewm alpha=1/period, 손실0→100, 완전횡보→50), compute_drawdown_series(close/cummax−1), compute_mdd_details(고점/저점/회복일), compute_gorani_market_temperature(v1: RSI/하락률(100+dd×200)/200일선(50+dist×250)/VIX(100−(vix−10)×100/30) 평균), v2(7요소 rolling percentile, min 5요소), align_and_convert_to_krw(union 인덱스 ffill)
대응 위치: target/lib/market-calc.ts 신규. /market의 MarketRsiChart, RsiDrawdownChart, FearGreedCard, MarketTemperatureSection과 /calculator MDD 탭이 공유
테스트: 단조상승 시계열 RSI=100; 100→50 하락 MDD=−50%; v1 컴포넌트 없으면 score=null
난이도: 중 / 우선순위: P1 (MDD는 계산기와 묶어 P0~P1)

6-8. 배당 장부/배당 실적 계산

원본 위치: original/logic/dividend_ledger.py, original/logic/dividend_performance.py
핵심: normalize_ticker(KR 6자리→.KS, COIN→BTC-KRW 강제), summarize_holdings(BUY 누적/SELL 평균단가 차감), build_price_map(가격 폴백: fetched→last_trade→avg_cost, 0원 금지), estimate_monthly_dividends(과거 24개월 배당을 월별 그룹→다음 12개월 추정, 세율 US 15%/KR 15.4%/COIN 0), compute_goal_achievement(USD 기준 환산 달성률), build_performance_result(월말 평가액, 현금흐름 기반 벤치마크 가상 매수, 월별손익 = 평가증감 − 순투입)
대응 위치: target/lib/dividend-ledger.ts + lib/dividend-ledger-performance.ts 신규, /dividends 페이지에 거래 등록 UI 추가, Firestore dividendLedger 컬렉션
테스트: BUY 10@100 + BUY 10@200 → avg 150; SELL 5 → qty 15, avg 150 유지; 가격 조회 실패 시 last_trade 사용
난이도: 높음 / 우선순위: P0

6-9. SCHD 배당률/매력도

원본 위치: original/pages_app/8_attractiveness_score.py
핵심: _calculate_latest_four_dividend_sum(최근 4회 배당 합 = TTM, 5회 혼입 방지), _normalize_dividends_to_close_basis(분할 전 배당 보정: before/after median 비율 > max(1.8, ratio×0.65)면 분할비로 나눔), ttm_yield = ttm_div/price×100(1%~8% 밖 이상치 NaN), 목표수익률 [3.5, 3.6, 3.7, 3.8]% 대응 매수가 = ttm_div/target, 52주 고점 낙폭
대응 위치: target/lib/schd-attractiveness.ts 신규 + /market 내 "SCHD 매력도" 섹션(또는 별도 카드)
테스트: ttm_div=1.05, price=28 → 3.75%; 목표 3.5% 매수가 = 30.0
난이도: 중 / 우선순위: P1

6-10. 저장/로드/동기화

원본 위치: original/core/sync.py, core/firebase.py
핵심: _safe_uid, sanitize_firebase_keys, load_all_data(1회 일괄 로드 플래그), auto_save_calendar_data(3회 재시도+0.4s 백오프, _last_sync 기록, 실패 사유 노출)
대응 위치: target은 Firestore라 키 sanitize/더미 토큰 불필요. 대신 9장의 repository 패턴으로: 로그인 시 일괄 로드→store 주입, 변경 시 localStorage 즉시 + Firestore 비동기(warnFirestoreFallback 기존 패턴), _last_sync→updatedAt serverTimestamp
우선순위: P0

6-11. 즐겨찾기 링크

원본 위치: original/app.py (normalize_url, load/save_favorite_links, 최대 10개)
대응 위치: target/lib/favorite-links.ts + Firestore users/{uid}/favoriteLinks + TopNav 드롭다운/홈 카드
테스트: naver.com 입력 → https://naver.com 저장; 11번째 추가 거부
난이도: 낮음 / 우선순위: P2

6-12. Firebase 사용자별 데이터 경로

원본: RTDB users/{이메일치환uid}/{node} / 대상: Firestore users/{auth.uid}/{collection} — target 방식이 우월하므로 target 방식 채택. 원본 노드 ↔ Firestore 컬렉션 매핑: tracker→portfolioSnapshots(이미 존재), sim_config→assetSimulatorConfigs(존재), dividend_calendar→calendarTickers+calendarEvents+calendarSettings(존재)+calendarCache(신규), dividend_ledger→dividendLedger(신규), favorite_links→favoriteLinks(신규), tracker_config→uiPreferences(신규)
우선순위: P0


## 7. 수정대상 mock/dummy/preview 제거 계획
원칙: mock 삭제 금지. 사용자 데이터/실데이터 우선, mock은 sample/fallback으로 격하하고 배지로 표기(기존 usingMock 배지 패턴 재사용).



파일/컴포넌트
현재 mock 내용
원본에서 대체 가능한 실제 로직
필요한 데이터 구조
구현 방향
우선순위



lib/calculator-data-provider.ts
사인파 합성 OHLC/배당
yfinance/Stooq 폴백 패턴 (7_mdd_calculator.py::fetch_close_series)
PricePoint, OhlcPoint, DividendPoint (기존 유지)
/api/quote/history, /api/quote/dividends API route 신설 후 provider를 async fetch로 교체. 실패 시 기존 합성 데이터 fallback + 경고 플래그 반환
P0


lib/market-data.ts
MOCK_BRIEFING/F&G/ETF온도/RSI/VIX
6_market_temperature.py + logic/market.py
SeriesPoint, FearGreedData (기존)
TODO(codex) 주석 위치 그대로 /api/market/* 연결. CNN F&G는 서버 프록시(production.dataviz.cnn.io), 실패 시 compute_gorani_market_temperature v1 자체 점수로 대체 후 mock 최후 fallback
P1


lib/mock-calendar-data.ts
buildMockCalendarEvents 가짜 일정
6-6 이벤트 생성 알고리즘
DividendEvent (원본 to_dict 기반)
lib/dividend-events.ts 신규. 티커 미등록 시 mock 일정 = 데모 sample로 유지
P0


lib/mock-dividend-data.ts + MOCK_SHARE_PRICE_KRW
보유종목 배당 시리즈/주가 하드코딩
estimate_monthly_dividends + 실시세
MonthlyDividendEstimate{month, grossKRW, netKRW}
실배당 이력 기반 추정으로 교체. 스냅샷 없으면 MOCK_HOLDINGS 유지(현행 fallback 패턴 그대로)
P0


lib/mockData.ts PIN_TICKERS 등
홈 지수/티커 카드
MARKET_BRIEFING_TICKERS (^GSPC, ^DJI, ^IXIC, KRW=X, CL=F, GC=F, ^VIX)
BriefingItem
/api/market/briefing 연결. NAV_ITEMS는 mock 아님 — 절대 삭제 금지
P1


components/watchlist/PortfolioSelectorMock.tsx
가짜 포트폴리오 선택
원본 다중 포트폴리오(portfolios{name: tickers[]})
CalendarPortfolio{name, tickers[]}
실 포트폴리오 CRUD로 승격, Firestore calendarSettings에 저장
P1


components/calculator/PreviewNotice.tsx, SimulatorPreviewNotice.tsx
"샘플 데이터 기준" 경고
-
-
실데이터 연결 후 문구를 데이터 출처/갱신시각 표기로 변경. 컴포넌트 삭제 금지
P2


components/TreemapMock.tsx
가짜 트리맵
-
스냅샷 보유종목 비중
스냅샷 데이터 연결, 없으면 mock 유지
P2


/performance mock 시리즈 (추정)
가짜 성과 곡선
6-3 트래커 성과
PerformancePoint
실계산 연결, 스냅샷 없으면 sample+배지
P0


lib/qldDashboardData.ts (추정)
QLD 정적 데이터
- (원본에 없음)
-
Preserve. 가능하면 스냅샷 연동
P2



## 8. 수정대상에만 있는 기능 보존/개선 목록
수정대상 기능
관련 파일
원본에는 없는 이유/차이
보존 여부
개선 제안
원본 의도와 연결하는 방법



포트폴리오 관리 페이지 + 스냅샷 히스토리
app/portfolio-manager, components/portfolio/*
원본은 텍스트 붙여넣기뿐
보존
월별 스냅샷 개념(원본 YYYY-MM 키)과 정합: snapshotDate 기준 월별 뷰 추가
원본 트래커의 "월별 자산 기록" 사용 흐름의 상위 호환


뱅크샐러드 엑셀 파서
lib/banksalad-parser.ts
원본은 정규식 텍스트 파싱
보존(우선 채택)
원본 텍스트 붙여넣기 입력도 보조 입력으로 추가(파서 함수만 이식)
동일 데이터 소스, 더 견고한 입력


Firestore repository 구조
lib/firebase/firestore-repositories.ts
원본은 RTDB+admin SDK
보존(표준 채택)
누락 컬렉션(dividendLedger, favoriteLinks, calendarCache) 추가
원본 노드 1:1 매핑(6-12)


계산기 프리셋
CalculatorPresetControls.tsx, calculatorPresets 컬렉션
원본은 매번 입력
보존
원본 기본값(ARCC/15%/window0, TQQQ/SCHD)을 기본 프리셋으로 시드
원본 기본값 = 첫 프리셋


QLD 대시보드
components/qld/*
원본에 없음
보존
스냅샷 store의 QLD 보유분 연동
트래커 데이터의 종목별 심화 뷰로 위치 부여


자산 맵 / TradingView treemap
app/asset-map, TradingViewTreemap.tsx
원본에 없음
보존
슈퍼그룹 분류(6-2) 색상 체계 적용
원본 도넛 차트 의도(자산군 한눈에)와 동일 목적


인증 UI
AuthStatus.tsx, LoginButton.tsx
원본은 Streamlit OAuth 버튼
보존
비로그인 시 "로컬 저장 모드" 안내 강화
원본 "☁️ 자동저장 켜짐" 표시 ↔ StorageModeBadge


StorageModeBadge
components/common/StorageModeBadge.tsx
원본은 텍스트 캡션
보존
모든 저장 대상 페이지에 일관 배치, 마지막 동기화 시각 표시(원본 _last_sync 대응)
동기화 상태 디버그 패널의 경량화 버전


모바일 네비/더보기 (추정: TopNav 내)
components/TopNav.tsx
원본은 Streamlit 자동
보존
9개+α 메뉴 우선순위 정렬
원본 메뉴 순서 참고해 정렬


홈 대시보드
app/page.tsx
원본은 홈 없음(캘린더가 기본)
보존
실데이터 요약(총자산/이번 달 배당 이벤트/시장온도)으로 승격
각 카드에서 해당 페이지로 CTA 연결


전환계산기의 수수료/매수가능주수
conversion-calculator.ts
원본은 비율 분석만
보존
실데이터 평균과 결합
원본 평균 전환비 + target 실행 계산의 결합



## 9. 데이터 모델/상태 관리 통합 설계
저장 단위(도메인별):



도메인
localStorage 키
Firestore 경로
TS 타입



포트폴리오 스냅샷
qld2.portfolio.snapshots.v1 (기존)
users/{uid}/portfolioSnapshots/{id} (기존)
PortfolioSnapshot


시뮬 설정
gorani.asset-simulator.v1
users/{uid}/assetSimulatorConfigs/default (기존)
StoredSimulatorPreview


캘린더 포트폴리오/티커
gorani.dividend-calendar.portfolios.v1
users/{uid}/calendarTickers/*, calendarSettings/default (기존)
CalendarPortfolio


캘린더 메모/마크
gorani.dividend-calendar.event-meta.v1 (기존)
users/{uid}/calendarEvents/{eventId} (기존)
CalendarEventMeta


캘린더 이벤트 캐시
gorani.dividend-calendar.cache.v1
users/{uid}/calendarCache/{ticker} (신규)
DividendEvent[] + fetchedAt


배당장부
gorani.dividend-ledger.v1
users/{uid}/dividendLedger/{txId} + dividendLedgerMeta/default(targets/settings) (신규)
LedgerTransaction, LedgerTarget


즐겨찾기 링크
gorani.favorite-links.v1
users/{uid}/favoriteLinks/default (신규, 배열 1문서)
FavoriteLink{name,url} (max 10)


계산기 프리셋
(없음→추가 가능)
users/{uid}/calculatorPresets/* (기존)
CalculatorPreset


규칙:

비로그인: localStorage만. StorageModeBadge = "로컬 저장".
로그인: 로그인 직후 도메인별 Firestore 일괄 로드 → store replace*() 주입(원본 load_all_data 대응). 단, 로컬에 데이터가 있고 클라우드가 비어 있으면 업로드 머지(최초 로그인 마이그레이션). 충돌 시 updatedAt 최신 우선.
쓰기: localStorage 동기 즉시 + Firestore 비동기, 실패 시 warnFirestoreFallback (기존 패턴 유지).
새로고침 복원: store가 localStorage에서 자동 복원(현행 portfolio-store 패턴을 전 도메인에 복제).
sample vs 사용자 데이터: 각 페이지는 usingMock: boolean을 계산해 배지 표시(현행 DividendPage 패턴). 사용자 데이터가 1건이라도 있으면 mock 미사용.
versioning/migration: 키에 .v1 suffix(현행 유지). 파싱 실패 시 키 삭제 후 빈 상태(현행 DividendCalendarPage 패턴). asset-simulator.ts의 maybeMigrateWonToManwon 같은 레거시 마이그레이션 함수 패턴 재사용.
Python→TS 타입 변환: dataclass → interface 1:1 (예: DividendEvent.to_dict() 키 그대로 camelCase interface). date → ISO string YYYY-MM-DD. pandas Series → {date: string, value: number}[].
실패 fallback UI: 로드 실패 시 빈 상태 + "다시 시도" 버튼; 시세 API 실패 시 합성 sample + 경고 배지(앱은 절대 깨지지 않음 — 원본 warnings[] 누적 패턴을 DataResult<T> = {data, warnings, source: "live"|"cache"|"sample"}로 표준화).
구조 제안: lib/stores/(useSyncExternalStore 기반 도메인 store) + lib/repositories/(Firestore I/O) + lib/calc/(순수 계산 함수, 테스트 대상) 3층. 화면 컴포넌트는 store/calc만 호출.


## 10. 페이지별 상세 구현 설계
전체 종목 / 포트폴리오 — /portfolio

현재 파일: target/app/portfolio/page.tsx, components/portfolio/PortfolioPage.tsx, lib/use-portfolio-view.ts, portfolio-aggregate.ts
원본 참고: original/pages_app/2_asset_tracker.py, logic/tracker.py
최종 목적: 최신 스냅샷 기반 보유 현황 + 자산군 비중 + 월별 자산 추이
원본에서 되는 기능: 슈퍼그룹 정렬/색상, 월 선택/삭제, 월별 누적영역 추이
수정대상 현재: 스냅샷 기반 집계/도넛/표 (mock fallback)
누락: 슈퍼그룹 분류 체계, 월별(스냅샷 간) 추이 차트, 월 삭제 UI
보존: 계좌/목적별 비중 도넛(원본보다 다양), filterAggregateHoldings
필요 데이터: PortfolioSnapshot[] / 계산: get_asset_type, sort_tags_by_super_group, aggregate_for_trend 이식분
저장/복원: portfolioSnapshots (기존)
구현 지시: lib/asset-classification.ts 신규 후 도넛 색상·정렬 적용, SnapshotHistory를 추이 차트로 확장
완료 기준: 스냅샷 2개 이상 등록 시 추이 차트가 실데이터로 그려짐
테스트: 스냅샷 등록→새로고침→유지; 삭제→차트 갱신

배당 — /dividends

현재 파일: components/dividend/DividendPage.tsx 외 4개
원본 참고: original/pages_app/9_dividend_ledger.py, logic/dividend_ledger.py
최종 목적: 거래 기록 기반 배당 가계부 (현 스냅샷 추정 뷰는 보조로 유지)
원본에서 되는 기능: 거래 CRUD, 평균단가, 3단 가격 폴백, 월별 예상배당(세전/세후), 목표 달성률(USD 기준), 종목별 진행률
수정대상 현재: 스냅샷 보유종목 + mock 단가/배당 시리즈, 목표 티커/수량 입력(저장 안 됨 추정)
누락: 거래 입력, 실배당 이력, 실시세, 목표 저장
보존: 세전/세후 토글, 요약 카드 UI, mock fallback 배지
필요 데이터: LedgerTransaction[], 시세/배당 API / 계산: lib/dividend-ledger.ts (6-8)
저장/복원: dividendLedger 컬렉션 + localStorage
구현 지시: 거래 입력 폼(자산구분 US/KR/COIN, 매수/매도, 수량, 단가, 환율, 메모) + 거래 테이블 추가. MOCK_SHARE_PRICE_KRW 제거하고 /api/quote/last 사용
완료 기준: 거래 입력→보유표/월별차트/달성률이 즉시 갱신되고 새로고침 후 복원
테스트: 6-8 테스트 케이스 + 시세 실패 시 last_trade 폴백 확인

투자 성과 — /performance

현재 파일: app/performance/page.tsx, components/PerformanceChart.tsx
원본 참고: original/logic/tracker_performance.py, logic/dividend_performance.py
최종 목적: 스냅샷(또는 장부) 기반 실성과 + KOSPI/S&P500/QQQ 비교 + 12개월 월별 손익
누락: 전부 (현재 mock)
필요 계산: lib/tracker-performance.ts (6-3); 장부 거래가 있으면 build_performance_result 방식(현금흐름 기반) 우선
UI 상태: 시작일 선택(기본 2년 전), 제외 종목/경고 목록 표시(원본 warnings 패턴)
완료 기준: 실보유 스냅샷으로 벤치마크 3종 비교 곡선과 월별 손익 막대가 그려짐
테스트: 6-3 테스트 케이스

배당캘린더 — /watchlist

현재 파일: components/watchlist/* (13개), lib/mock-calendar-data.ts, calendar-grid.ts
원본 참고: original/modules/dividend_calendar.py
최종 목적: 실배당 일정 캘린더 + 다중 포트폴리오 + 메모/마크/커스텀 일정 + 절세액 + 경제일정
원본에서 되는 기능: 6-6 전부 + 종목별 절세액 표(당월 buy deadline 강조) + 과거 5년 절세 백테스트 + 캐시(cached_events)로 재방문 시 API 절약
수정대상 현재: 캘린더 그리드/다이얼로그/필터 UI 완성, 메모·마크 저장 동작(localStorage+Firestore), 이벤트는 mock
누락: 실이벤트 생성, 다중 포트폴리오, 이벤트 캐시, 커스텀 일정(날짜+기호 ⚠/※/ⓔ), 절세액 실계산, 경제일정 JSON
보존: CalendarGrid/CalendarEventDialog UI, 메타 저장 구조, 필터
필요 데이터: /api/quote/dividends, /api/quote/last, 공휴일 정적 배열, public/data/economic_calendar_us_high.json
저장/복원: calendarTickers/calendarSettings/calendarEvents(기존) + calendarCache(신규)
구현 지시: lib/dividend-events.ts 이식 → buildMockCalendarEvents 호출부 교체(미등록 시 sample 유지). PortfolioSelectorMock → 실 포트폴리오 CRUD. TaxSavingTable에 calc_tax_savings 적용
완료 기준: SCHD 등록 시 실제 다음 분기 ex-div가 추정 표기와 함께 표시, 메모/별/하트가 새로고침·재로그인 후 유지
테스트: 6-6 테스트 + 캐시 동작(두 번째 방문 시 API 미호출)

시장 현황 — /market

현재 파일: components/market/* (11개), lib/market-data.ts, mock-market-data.ts
원본 참고: original/pages_app/6_market_temperature.py, logic/market.py
최종 목적: 실데이터 브리핑/F&G/고라니온도/RSI·낙폭 차트 + SCHD 매력도 섹션
누락: 전부 실데이터, 고라니온도 v1/v2, SCHD 매력도
보존: 카드/차트 컴포넌트 전부, asset-map 섹션, TradingView treemap
필요 계산: lib/market-calc.ts(6-7), lib/schd-attractiveness.ts(6-9)
구현 지시: market-data.ts의 TODO(codex) 지점만 /api/market/*로 교체(인터페이스 불변). WATCHLIST = QQQ/SCHD/SPY, 기간 옵션 6M/1Y/3Y/5Y/전체 유지
완료 기준: RSI 차트가 실제 Wilder RSI와 일치, F&G 실패 시 자체 온도 fallback
테스트: 6-7, 6-9 테스트 케이스

계산기 — /calculator

현재 파일: components/calculator/*, lib/dividend-capture-calculator.ts, conversion-calculator.ts, mdd-calculator.ts
원본 참고: pages_app/3, 4, 7
최종 목적: 3개 계산기 모두 실데이터 백테스트
보존: 탭 UI, 프리셋, 수수료/슬리피지 입력(원본보다 개선), PreviewNotice(문구 변경)
구현 지시: provider 비동기 교체(계산 함수 시그니처에 history 주입 형태 권장 — calculateMdd(input, externalPrices) 패턴이 이미 있으므로 동일 패턴 적용). MDD의 입력가격 강제 변형 코드 제거, compute_mdd_details 결과로 대체. 전환계산에 공통 시작일 자동 추천 추가
완료 기준: 12장 기준 + 원본 결과 대조
테스트: 6-4, 6-5, 6-7

자산 시뮬레이터 — /asset-simulator

현재 파일: components/asset-simulator/*, lib/asset-simulator.ts
원본 참고: logic/simulator.py, pages_app/1_asset_simulator.py
최종 목적: 입력→재계산→저장/복원 완결
원본에서 되는 기능: 연도별 계획 표 편집, 적립/인출/실질가치 표·차트, 절세계좌 인출 플랜, 설정 즉시 저장(save_to_firebase)+페이지 이동 복구
구현 지시: 계산 로직은 검증만(원본과 수치 대조). YearPlanTable 편집→재계산→assetSimulatorConfigs 저장 + localStorage 미러 확인. SimulatorPreviewNotice 문구 갱신
완료 기준: 새로고침/재로그인 후 입력값과 연도별 계획 복원
테스트: 6-1 케이스

포트폴리오 관리 — /portfolio-manager

현재 파일: components/portfolio/ExcelUploadCard.tsx, PortfolioParsePreview.tsx, SnapshotHistory.tsx, lib/banksalad-parser.ts
원본 참고: pages_app/2_asset_tracker.py (입력/삭제 흐름)
최종 목적: 엑셀 업로드(주) + 텍스트 붙여넣기(보조) 입력, 스냅샷 관리
구현 지시: 원본 parse_data/extract_tag/process_data를 lib/banksalad-text-parser.ts로 이식해 보조 입력 추가. 월 단위 삭제/전체 삭제 확인 다이얼로그(원본 흐름) 추가. 로그인 시 Firestore 동기화 확인
완료 기준: 두 입력 방식 모두 스냅샷 생성, 전 페이지 반영

자산 맵 — /asset-map

현재 파일: app/asset-map/page.tsx, components/market/AssetMapSection.tsx
원본 참고: 없음 (target 고유)
구현 지시: Preserve. 스냅샷 보유 비중으로 treemap 데이터 연결(없으면 mock 유지), 슈퍼그룹 색상 적용
완료 기준: 스냅샷 존재 시 실비중 표시

QLD 대시보드 — /qld-dashboard

현재 파일: components/qld/*, lib/qldDashboardData.ts
원본 참고: 없음 (target 고유, MERGE_NOTE.md로 병합 이력 확인)
구현 지시: Preserve. 후순위로 스냅샷의 QLD 보유분/시세 연동 검토
완료 기준: 기존 화면 회귀 없음

SCHD 배당률/매력도 — /market 내 신규 섹션

원본 참고: pages_app/8_attractiveness_score.py
구현 지시: lib/schd-attractiveness.ts + components/market/SchdAttractivenessCard.tsx 신규. TTM 배당률 추이 차트, 목표수익률(3.5~3.8%)별 매수가 표, 52주 고점 낙폭 카드. NAV 추가 없이 /market 하단 배치(메뉴 과밀 방지)
완료 기준: 실 SCHD 데이터로 TTM 곡선과 목표 매수가 표시


## 11. 단계별 구현 로드맵
의존성: Step 0 → 1 → 2 → (3, 4 병렬 가능) → 5 → 6 → 7 → 8. Step 2의 시세 API가 4·5·6의 전제.
Step 0. 현황 감사와 안전장치

목표: 빌드 가능 상태 확정, 회귀 기준선 확보, 잡파일 정리
왜: 이후 단계의 검증 기준이 필요
원본 참고: 없음 / 수정 파일: target/.gitignore, target/package.json
범위: npm install/npm run build/npm run lint 통과 확인, tsc --noEmit을 typecheck 스크립트로 추가, .next-dev-*.log·*.zip gitignore 처리, 각 라우트 수동 스모크 체크리스트 작성
제외: 기능 변경 일체
완료 기준: build/lint/typecheck 3종 통과 기록
검증: 11개 라우트 렌더 확인

Step 1. 메뉴/라우팅/사용자 흐름 정렬

목표: NAV에 누락 진입점 정리, 인증 상태 전역 노출
원본 참고: original/app.py 메뉴 순서, original/docs/NAVIGATION_MAP.md
수정 파일: lib/mockData.ts(NAV_ITEMS), components/TopNav.tsx, components/common/StorageModeBadge.tsx
범위: StorageModeBadge를 저장 대상 페이지에 일괄 배치, 로그인 버튼 노출 일관화, 홈 카드→각 페이지 CTA 연결
제외: 페이지 내부 기능
완료 기준: 모바일/데스크톱에서 전 메뉴 이동 가능

Step 2. 데이터 모델·저장/복원·시세 API 기반 구축

목표: ①도메인 store/repository 3층 구조 ②/api/quote/*, /api/market/* route ③로그인 시 일괄 로드/마이그레이션
원본 참고: core/sync.py, core/firebase.py, 7_mdd_calculator.py(fetch 폴백 패턴)
수정 파일: lib/stores/*(신규), lib/repositories/*(신규), app/api/quote/history/route.ts 등(신규), lib/calculator-data-provider.ts, lib/firebase/firestore-repositories.ts(컬렉션 추가)
범위: 9장 설계 전체. Yahoo chart API(query1.finance.yahoo.com/v8/finance/chart) + Stooq CSV 폴백, 서버측 캐시(revalidate)
제외: 화면 변경 최소화
완료 기준: /api/quote/history?ticker=SPY&range=1y가 실 종가 반환, 실패 시 sample 폴백 플래그
검증: build/typecheck + API 수동 호출

Step 3. 포트폴리오/자산 트래커 핵심 이식

원본 참고: logic/tracker.py, pages_app/2_asset_tracker.py
수정 파일: lib/asset-classification.ts(신규), lib/banksalad-text-parser.ts(신규), components/portfolio/*
범위: 10장 /portfolio + /portfolio-manager 지시 사항
완료 기준: 텍스트/엑셀 입력 모두 동작, 슈퍼그룹 정렬·월별 추이 표시, 새로고침 복원

Step 4. 계산기 묶음 완성

원본 참고: pages_app/3, 4, 7, logic/market.py
수정 파일: 계산기 lib 3종 + lib/market-calc.ts(신규) + components/calculator/*
범위: 실데이터 연결, MDD 재작성, 전환 공통시작일, 양도세치기 전체기간
완료 기준: 원본과 결과 대조(6-4/6-5/6-7 테스트), 프리셋 저장 동작 유지

Step 5. 배당/배당캘린더/배당장부 복원

원본 참고: modules/dividend_calendar.py, logic/dividend_ledger.py, logic/dividend_performance.py, pages_app/9
수정 파일: lib/dividend-events.ts(신규), lib/dividend-ledger.ts(신규), components/watchlist/*, components/dividend/*
범위: 10장 /watchlist + /dividends 지시 사항. 가장 큰 단계이므로 5a(캘린더)/5b(장부)로 분할 PR 권장
완료 기준: 실배당 일정 + 거래 기반 가계부 + 클라우드 복원

Step 6. 시장 현황/시장온도/SCHD 매력도

원본 참고: pages_app/6, pages_app/8, logic/market.py
수정 파일: lib/market-data.ts, lib/schd-attractiveness.ts(신규), components/market/*
범위: 10장 /market 지시 + /performance 실계산(lib/tracker-performance.ts)도 이 단계에 포함 가능(또는 5와 4 사이 별도 PR)
완료 기준: F&G/RSI/온도/SCHD 실데이터, 성과 페이지 벤치마크 비교

Step 7. target 고유 기능 보존/고도화

범위: QLD/asset-map/홈 대시보드 실데이터 연동, 즐겨찾기 링크 추가, 캘린더 mock 선택기→실 포트폴리오 승격 잔여분
완료 기준: target 전용 기능 전부 회귀 없이 동작 + 가능한 부분 실데이터화

Step 8. 전체 회귀 테스트와 사용성 보정

범위: 12장 판정 기준 전 항목 체크, 빈 데이터/API 실패/모바일 시나리오, 문구 정리(PreviewNotice→데이터 출처 표기)
완료 기준: 12장 체크리스트 전부 통과


## 12. 기능 완성도 판정 기준
사용자가 값을 입력하면 결과가 실제로 바뀐다 (계산기 3종, 시뮬레이터, 장부, 캘린더 티커).
새로고침 후 복원: 스냅샷, 시뮬 설정, 캘린더 포트폴리오/메모/마크, 장부 거래, 즐겨찾기, 프리셋.
mock은 fallback/sample로만: 사용자 데이터 존재 시 mock 미사용 + 배지로 구분 표시.
원본 계산식과 합리적 일치: 6장 각 테스트 케이스(자산시뮬 잔고, RSI, MDD, TTM 배당률, 평균단가, 전환비 평균, 양도세치기 승률).
같은 데이터 원천: /portfolio, /dividends, /performance, 홈 요약이 모두 동일 스냅샷/장부 store를 읽는다.
빈 데이터/잘못된 입력/로드 실패 시 깨지지 않음: warnings 누적 + sample 폴백 (원본 방어 패턴).
모바일/데스크톱 전 메뉴 이동 가능.
원본 핵심 여정 재현: "월간 자산 기록→비중/추이 확인", "배당 티커 등록→이번 달 buy deadline 확인→절세액 확인", "거래 기록→월 배당 추정→목표 달성률", "은퇴 계획 입력→인출 플랜 확인".
target 고유 기능(포트폴리오 관리/QLD/asset-map/프리셋/홈) 미삭제.
npm run build, npm run lint, npx tsc --noEmit 통과.
기능별 수동 검증 시나리오 문서화(각 PR 설명에 포함).

---

## 13. 최종 Codex 작업 패키지
공통 조건(모든 프롬프트에 적용, 각 프롬프트에도 반복 명시함):

original/은 읽기 전용 참고. 실제 수정은 target/만.
target/의 UI 스타일·컴포넌트 구조·라우팅 유지. 원본 Streamlit UI 복사 금지.
target/에만 있는 기능 삭제 금지 (특히 NAV_ITEMS 항목, QLD, asset-map, 프리셋, 엑셀 파서).
작업 전 관련 파일을 먼저 읽고 요약 → 작업 → 종료 시 변경 파일 목록/구현 내용/제외 내용/남은 작업/테스트 결과 보고.
검증: target/package.json 기준 npm run build, npm run lint 실행. typecheck 스크립트가 있으면 실행, 없으면 npx tsc --noEmit.


### [Codex Prompt — Step 0: 현황 감사와 안전장치]

저장소에는 original/(Streamlit 원본, 읽기 전용 참고)과 target/(Next.js 14 + TS + Tailwind 수정대상)이 있다.
목표: target/을 안전하게 개조하기 위한 기준선 구축. 기능 변경 금지.

작업 전: target/package.json, target/tsconfig.json, target/next.config.mjs, target/app/ 전체 라우트 목록을 읽고 요약하라.

작업:
1. target/package.json scripts에 "typecheck": "tsc --noEmit" 추가.
2. target/.gitignore에 .next-dev-*.log, *.zip 추가 (기존 zip 파일 삭제는 하지 마라).
3. npm install 후 npm run build / npm run lint / npm run typecheck 실행, 실패 시 원인을 최소 수정으로 해결 (기능 변경 금지).
4. 11개 라우트(/, /portfolio, /dividends, /performance, /watchlist, /market, /calculator, /asset-simulator, /portfolio-manager, /asset-map, /qld-dashboard) 렌더 확인 결과를 표로 정리해 target/docs/AUDIT.md로 저장.

조건: original/은 읽기 전용. target/만 수정. UI 변경 금지. target 고유 기능 삭제 금지.
보고: 변경 파일 목록, 빌드/린트/타입체크 결과, 라우트별 상태, 발견된 문제 목록.


### [Codex Prompt — Step 1: 메뉴/네비/저장상태 표시 정렬]

배경: original/(Streamlit 원본)의 사용 흐름을 target/(Next.js)에 이식하는 프로젝트. original/app.py의 메뉴는
자산시뮬/자산트래커/양도세치기/매도전환계산/배당캘린더(기본)/시장온도/MDD계산/SCHD매력도/배당금가계부이고,
사이드바에 사용자 표시·자동저장 상태·즐겨찾기 링크가 있다.

작업 전 읽기: original/app.py, target/lib/mockData.ts(NAV_ITEMS), target/components/TopNav.tsx,
target/components/common/StorageModeBadge.tsx, target/components/auth/AuthStatus.tsx.

작업 (target/만 수정):
1. TopNav에 로그인 상태(AuthStatus/LoginButton)가 모든 페이지에서 일관되게 보이도록 정리.
2. StorageModeBadge를 저장이 일어나는 페이지(/portfolio-manager, /asset-simulator, /watchlist, /dividends)에 일관 배치.
   배지 의미: 비로그인=로컬 저장, 로그인=클라우드 동기화. 원본의 "☁️ 자동저장 켜짐" 의도를 반영.
3. 홈(app/page.tsx)의 카드들이 해당 기능 페이지로 이동하는 CTA 링크를 갖도록 연결(디자인 변경 최소화).
4. NAV_ITEMS는 항목 삭제 금지. QLD 대시보드 항목 유지.

조건: original/ 읽기 전용, target/ UI 스타일 유지, 원본 UI 복사 금지, target 고유 기능 삭제 금지.
검증: npm run build / lint / typecheck. 모바일 뷰포트에서 메뉴 이동 확인.
보고: 변경 파일, 구현/제외 내용, 남은 작업, 테스트 결과.

### [Codex Prompt — Step 2: 시세 API + store/repository 기반 구축]

배경: original/(Streamlit)은 yfinance+Stooq 폴백으로 실시세를 쓰고, Firebase RTDB users/{uid}/{path}에
tracker/sim_config/dividend_calendar/dividend_ledger/favorite_links를 저장한다(원문: original/core/sync.py,
original/core/firebase.py, original/pages_app/7_mdd_calculator.py의 fetch_close_series 폴백 패턴 참고).
target/은 localStorage(lib/portfolio-store.ts) + Firebase Auth/Firestore(lib/firebase/*)가 이미 있으나,
시세는 lib/calculator-data-provider.ts의 사인파 합성 mock이다.

작업 전 읽기: original/core/sync.py, original/core/firebase.py, original/pages_app/7_mdd_calculator.py(0~200행),
target/lib/calculator-data-provider.ts, target/lib/firebase/firestore-repositories.ts, target/lib/portfolio-store.ts.

작업 (target/만 수정):
1. Next API route 신설:
   - app/api/quote/history/route.ts (ticker, range 또는 start/end → 일별 종가 OHLC). Yahoo chart API
     (query1.finance.yahoo.com/v8/finance/chart/{ticker}) 1차, Stooq CSV(stooq.com/q/d/l/?s={ticker}.us&i=d) 2차 폴백.
   - app/api/quote/dividends/route.ts (배당 이력), app/api/quote/last/route.ts (현재가),
     app/api/quote/fx/route.ts (USDKRW: KRW=X→USDKRW=X, 700~3000 범위 검증 — 원본 fetch_usdkrw_series 규칙).
- 모든 quote route에 서버 캐시(revalidate 6시간 수준) 적용, 외부 호출 실패 시
     {source:"sample"} 플래그와 함께 기존 합성 데이터로 폴백해 절대 500으로 죽지 않게 하라.
2. target/lib/calculator-data-provider.ts를 위 API를 호출하는 async 버전으로 교체하되,
   기존 동기 합성 생성 함수(getTickerOhlcHistory 등)는 삭제하지 말고 sample fallback으로 유지하라.
   반환 타입에 source: "live" | "sample" 을 포함시켜 화면에서 데이터 출처를 표시할 수 있게 하라.
3. target/lib/firebase/firestore-repositories.ts에 컬렉션 추가:
   - users/{uid}/dividendLedger/{txId} (배당장부 거래)
   - users/{uid}/dividendLedgerMeta/default (targets/settings)
   - users/{uid}/favoriteLinks/default (이름+URL 최대 10개 배열)
   - users/{uid}/calendarCache/{ticker} (배당 이벤트 캐시 + fetchedAt)
   기존 패턴(setDoc + serverTimestamp, warnFirestoreFallback)을 그대로 따를 것.
4. target/lib/stores/ 디렉터리 신설:
   - lib/portfolio-store.ts의 패턴(useSyncExternalStore + localStorage 키 + cache + listeners)을
     일반화한 createLocalStore 헬퍼를 만들고,
   - 로그인 시 Firestore 일괄 로드 → store 주입(replace), 로컬에만 데이터가 있고 클라우드가
     비어 있으면 업로드 머지하는 syncOnLogin 유틸을 추가하라 (original/core/sync.py의
     load_all_data 일괄 로드 의도를 Firestore 방식으로 재해석).
   - localStorage 키는 "gorani.{domain}.v1" 규칙, JSON 파싱 실패 시 키 제거 후 빈 상태로 시작.

조건: original/은 읽기 전용 참고. 실제 수정은 target/만. target/의 UI 스타일·컴포넌트 구조·라우팅 유지.
원본 Streamlit UI 복사 금지. target에만 있는 기능 삭제 금지. 유료 API/서버 인프라 추가 금지.
작업 전 위 "읽기" 목록 파일들을 먼저 읽고 요약부터 보고하라.
검증: target/package.json 기준 npm run build / npm run lint / npm run typecheck (없으면 npx tsc --noEmit).
/api/quote/history?ticker=SPY&range=1y 수동 호출로 실데이터·폴백 동작 모두 확인.
보고: 변경 파일 목록, 구현 내용, 제외 내용, 남은 작업, 테스트 결과(API 응답 샘플 포함).

### [Codex Prompt — Step 3: 포트폴리오/자산 트래커 핵심 이식]

배경: 이 저장소에는 original/(Streamlit 원본, 읽기 전용 참고)과 target/(Next.js 14 + TS + Tailwind 수정대상)이 있다.
original/logic/tracker.py에는 자산 분류(get_asset_type: cash/dollar/leverage/nasdaq/spy/dividend/other),
슈퍼그룹 3단 정렬(sort_tags_by_super_group: 슈퍼그룹 합계→자산군 합계→개별 금액 내림차순),
뱅크샐러드 텍스트 파싱(parse_data: 탭/공백 분리, extract_tag: #태그 추출·비트코인 특례,
process_data: 태그 없음 또는 20만원 미만은 '기타'로 합산), 월별 추이(aggregate_for_trend)가 있다.
target/은 엑셀 파서(lib/banksalad-parser.ts)와 스냅샷 store(lib/portfolio-store.ts,
localStorage 키 qld2.portfolio.snapshots.v1 + Firestore portfolioSnapshots)가 이미 동작한다.
엑셀 파서는 원본 텍스트 파서보다 우수하므로 그대로 유지하고, 원본의 분류/정렬/추이/텍스트 입력만 추가 이식한다.

작업 전 읽기(요약 보고): original/logic/tracker.py 전체, original/pages_app/2_asset_tracker.py(0~250행),
target/lib/banksalad-parser.ts, target/lib/portfolio-store.ts, target/lib/portfolio-aggregate.ts,
target/lib/use-portfolio-view.ts, target/components/portfolio/PortfolioPage.tsx,
target/components/portfolio/SnapshotHistory.tsx, target/components/portfolio/ExcelUploadCard.tsx.

작업 (target/만 수정):
1. lib/asset-classification.ts 신규: getAssetType / getSuperGroup / sortTagsBySuperGroup / assignColors를
   원본 규칙 그대로 TS로 이식. 분류 키워드와 정렬 규칙은 변경 금지. 색상 값만 target 다크 테마 톤으로 조정 가능.
2. lib/banksalad-text-parser.ts 신규: parse_data / extract_tag / process_data(etc_threshold=200000)를 이식하고
   결과를 기존 PortfolioSnapshot/Holding 형태로 변환하는 어댑터를 포함하라.
3. /portfolio-manager(components/portfolio/)에 "뱅크샐러드 텍스트 붙여넣기" 보조 입력 카드를 추가하라.
   기존 ExcelUploadCard와 PortfolioParsePreview는 삭제·변경 금지(보조 입력은 별도 카드).
4. /portfolio의 비중 도넛·보유 표에 슈퍼그룹 정렬과 분류 색상을 적용하고,
   스냅샷이 2개 이상이면 월별 자산 추이 차트(누적 영역 또는 스택, Recharts)를 추가하라.
5. 스냅샷 개별 삭제 / 전체 삭제에 확인 다이얼로그를 추가하라
   (original/pages_app/2_asset_tracker.py의 confirm_delete_dialog / delete_month_dialog 흐름 참고, UI는 target 스타일).
6. 로그인 상태에서 스냅샷 변경이 Firestore에 반영되고 재로그인 시 복원되는지 확인하라
   (Step 2의 syncOnLogin 유틸 사용).

조건: original/은 읽기 전용 참고. 실제 수정은 target/만. target/의 UI 스타일·컴포넌트 구조·라우팅 유지.
원본 Streamlit UI 복사 금지. target에만 있는 기능(엑셀 업로드, 파스 미리보기, 스냅샷 히스토리 등) 삭제 금지.
검증: npm run build / lint / typecheck. 수동: 텍스트 입력 1건 + 엑셀 1건으로 스냅샷 생성 →
/portfolio 도넛·추이 갱신 → 새로고침 복원 → 삭제 후 차트 갱신.
보고: 변경 파일 목록, 구현 내용, 제외 내용, 남은 작업, 테스트 결과.


### [Codex Prompt — Step 4: 계산기 묶음(양도세치기/전환/MDD) 실데이터 완성]

배경: 이 저장소에는 original/(Streamlit 원본, 읽기 전용 참고)과 target/(Next.js 수정대상)이 있다.
target/의 /calculator 3개 탭은 로직 구조는 원본과 유사하지만 lib/calculator-data-provider.ts의
합성(mock) 시세를 사용한다. Step 2에서 /api/quote/* 실시세 route와 async provider가 준비되어 있다.

원본 기준 로직:
- 양도세치기(original/pages_app/3_dividend_sim.py): 배당락일 기준 매수가(D-1/D-2 × 시가/종가),
  세후배당 = 배당 × (1 − taxRate/100), BEP = 매수가 − 세후배당, 매도허용기간 내 High ≥ BEP면 성공
  (수익률 = 세후배당/매수가), 실패 시 기간 마지막 종가 매도 수익률 + 원금 회복일(거래일/달력일,
  영구 미회복 시 "회복불가"). 요약: 승률, 성공/실패 평균수익률, 손익비, 1회 기대수익률,
  절세예상액 = (성공평균수익률/100) × 투자금 × 0.22. "최근 5년만 보기" 옵션.
- 전환계산(original/pages_app/4_conversion_analysis.py): 두 티커 종가 inner-join,
  Conversion_Ratio = Sell/Buy, 구간 평균과 최신값, 공통 시작일 = 두 티커 첫 거래일의 max를
  티커 변경 시 자동 추천.
- MDD(original/pages_app/7_mdd_calculator.py + original/logic/market.py): compute_mdd_details —
  현재가/기간고점/현재낙폭(close/cummax−1), MDD·고점일·저점일·회복일(저점 이후 고점가 이상 첫 날),
  USD/KRW 환산(align_and_convert_to_krw: union 인덱스에 환율 ffill 후 곱, bfill 금지).

작업 전 읽기(요약 보고): original/pages_app/3_dividend_sim.py 전체,
original/pages_app/4_conversion_analysis.py 전체, original/pages_app/7_mdd_calculator.py(0~300행),
original/logic/market.py의 compute_drawdown_series/compute_mdd/compute_mdd_details/align_and_convert_to_krw,
target/lib/dividend-capture-calculator.ts, target/lib/conversion-calculator.ts, target/lib/mdd-calculator.ts,
target/lib/calculator-data-provider.ts, target/components/calculator/ 전체.

작업 (target/만 수정):
1. lib/market-calc.ts 신규: computeDrawdownSeries, computeMdd, computeMddDetails, computeRecoveryDate,
   alignAndConvertToKrw를 원본 그대로 TS 이식 (순수 함수, {date, close}[] 입력).
2. dividend-capture-calculator.ts: 실시세/실배당 이력 사용으로 전환(async). .slice(-16) 행 제한 제거,
   전체 기간 / 최근 5년 토글 지원. BEP·성공 판정·회복일 로직을 원본과 일치시켜라.
   target에만 있는 수수료/슬리피지 입력은 삭제하지 말고 0일 때 원본과 동일 결과가 되게 유지.
3. conversion-calculator.ts: 실시세 사용으로 전환. computeCommonStart(sell, buy) 추가 후
   ConversionCalculator.tsx에서 티커 변경 시 시작일 자동 추천을 표시하라.
   target 고유의 매도금액/매수가능주수/잔여현금 계산은 보존.
4. mdd-calculator.ts: 입력 high/low로 시계열을 강제로 변형하는 현재 코드를 제거하고,
   실시세 + computeMddDetails 결과로 교체. USD/KRW 통화 전환 옵션 지원(/api/quote/fx 사용).
5. 모든 탭에서 데이터 출처(live/sample)와 조회 구간을 표시. PreviewNotice 컴포넌트는 삭제하지 말고
   sample 폴백일 때만 노출되도록 변경.
6. 계산기 프리셋(CalculatorPresetControls, calculatorPresets 컬렉션)은 그대로 유지하고,
   원본 기본값(ARCC/세율15%/window0, TQQQ→SCHD)이 기본 입력값이 되게 하라.

조건: original/은 읽기 전용 참고. 실제 수정은 target/만. target/의 UI 스타일·컴포넌트 구조·라우팅 유지.
원본 Streamlit UI 복사 금지. target에만 있는 기능(프리셋, 수수료 입력 등) 삭제 금지.
검증: npm run build / lint / typecheck. 수동: ARCC 최근5년/세율15%/window0 백테스트가 회차별 표와
승률을 출력하고 입력 변경 시 결과가 바뀌는지, TQQQ/SCHD 평균 전환비, QQQ 1년 MDD 고점·저점·회복일 확인.
보고: 변경 파일 목록, 구현 내용, 제외 내용, 남은 작업, 테스트 결과(원본 식 대비 검산 1건 포함).


### [Codex Prompt — Step 5a: 배당캘린더 실이벤트 복원]

배경: 이 저장소에는 original/(Streamlit 원본, 읽기 전용 참고)과 target/(Next.js 수정대상)이 있다.
target/의 /watchlist(배당캘린더)는 CalendarGrid/다이얼로그/필터/메모·마크 저장(localStorage
gorani.dividend-calendar.event-meta.v1 + Firestore calendarEvents)이 동작하지만, 이벤트 자체는
lib/mock-calendar-data.ts의 buildMockCalendarEvents가 만든 가짜다.

원본 기준(original/modules/dividend_calendar.py):
- 이벤트 4종: ex_div / buy(= ex_div 전 거래일 마감) / payment / earnings. estimated 플래그로 추정 표기.
- 거래일 보정: 주말 + 미국 연방 공휴일 회피(get_next_trading_day / get_prev_trading_day).
- 배당 빈도 추론(infer_frequency_months): 최근 8회 ex-div 간격의 median이 ≤45일=1개월,
  ≤120=3개월, ≤210=6개월, 그 외 12개월.
- 미래 투영(get_pattern_date): 마지막 ex-div의 "n번째 주 같은 요일" 패턴을 다음 주기 월에 투영,
  기존 선언 이벤트와 20일 이내 중복이면 생략, horizon은 오늘+1년.
- payment 기본값 = ex_div + 14일 후 다음 거래일. annual_yield = 마지막 배당 × 연지급횟수 / 현재가 × 100.
- 절세액(calc_tax_savings): shares = floor(10000/현재가), savings = shares × 배당 × 0.85 × 0.22.
- 다중 포트폴리오 {이름: 티커[]} (포트폴리오당 최대 80티커), 티커별 이벤트 캐시(cached_events),
  날짜별 커스텀 일정 {date: {symbol(⚠/※/ⓔ), name}}.

작업 전 읽기(요약 보고): original/modules/dividend_calendar.py 전체,
target/components/watchlist/DividendCalendarPage.tsx, CalendarGrid.tsx, CalendarEventDialog.tsx,
TaxSavingTable.tsx, PortfolioSelectorMock.tsx, TickerManager.tsx,
target/lib/mock-calendar-data.ts, target/lib/calendar-grid.ts, target/lib/firebase/firestore-repositories.ts.

작업 (target/만 수정):
1. lib/dividend-events.ts 신규: 위 원본 알고리즘(빈도 추론, 패턴 투영, 거래일 보정, 절세액)을 TS로 이식.
   미국 연방 공휴일은 2020~2035 정적 배열로 포함. 배당 이력/현재가는 Step 2의
   /api/quote/dividends, /api/quote/last 사용.
2. DividendCalendarPage가 buildMockCalendarEvents 대신 실이벤트를 사용하도록 교체.
   단, 등록된 티커가 0개일 때는 기존 mock 일정을 sample로 표시하고 "샘플 일정" 배지를 붙여라(mock 삭제 금지).
3. 다중 포트폴리오 지원: PortfolioSelectorMock을 실제 CRUD(생성/선택/삭제)로 승격.
   저장: localStorage gorani.dividend-calendar.portfolios.v1 + Firestore calendarSettings/default.
4. 티커별 이벤트 캐시: 조회 결과를 localStorage gorani.dividend-calendar.cache.v1 +
   Firestore calendarCache/{ticker}에 저장하고, "일정 최신화" 버튼으로만 강제 재조회(원본 흐름).
5. 날짜 클릭 시 커스텀 일정(기호 ⚠/※/ⓔ + 일정명) 등록/삭제 다이얼로그 추가, 캘린더 셀에 표시.
6. TaxSavingTable을 calc_tax_savings 실계산으로 교체, 현재 표시 월에 buy deadline이 있는 종목 강조(원본 동일).
7. 기존 메모/마크(⭐/💗) 저장 구조는 그대로 유지.

조건: original/은 읽기 전용 참고. 실제 수정은 target/만. target/의 UI 스타일·컴포넌트 구조·라우팅 유지.
원본 Streamlit UI 복사 금지. target에만 있는 기능 삭제 금지(mock은 sample로 격하만).
검증: npm run build / lint / typecheck. 수동: SCHD 등록 → 분기 배당으로 추론되고 ex-div/buy/pay가
거래일에 배치되는지, estimated 표기, 새로고침·재로그인 후 포트폴리오/메모/마크/캐시 복원 확인.
보고: 변경 파일 목록, 구현 내용, 제외 내용, 남은 작업, 테스트 결과.


### [Codex Prompt — Step 5b: 배당금가계부(거래 기반) 복원]

배경: 이 저장소에는 original/(Streamlit 원본, 읽기 전용 참고)과 target/(Next.js 수정대상)이 있다.
target/의 /dividends는 스냅샷 보유종목 + lib/mock-dividend-data.ts의 mock 배당 시리즈와
MOCK_SHARE_PRICE_KRW 하드코딩 단가로만 동작한다. 원본의 핵심인 "거래 기록 기반 가계부"가 없다.

원본 기준:
- original/logic/dividend_ledger.py: normalize_ticker(KR 6자리→.KS 조회/표시는 6자리, COIN BTC는
  항상 BTC-KRW), normalize_transaction(BUY/SELL, 수량≤0 제외, date는 매수/매도 기준일),
  summarize_holdings(BUY 누적·평균단가, SELL은 평균단가로 원가 차감), build_price_map(가격 폴백:
  실시세→마지막 거래단가→평균단가, 절대 0원 금지), estimate_monthly_dividends(과거 24개월 배당을
  월별 합산해 다음 12개월 추정, 세율 US 15%/KR 15.4%/COIN 0%), compute_goal_achievement(목표 티커
  수량×현재가를 USD 기준 목표금액으로, 분자는 전체 보유 USD 평가액, 달성률 최대 100%),
  calculate_target_progress(종목별 목표수량 진행률).
- original/logic/dividend_performance.py: 거래 현금흐름 기반 월말 평가액, KOSPI/S&P500 가상 매수
  벤치마크, 월별손익 = 평가증감 − 순투입, 경고는 누적만 하고 렌더링은 깨지지 않음.
- 저장(원본): users/{uid}/dividend_ledger {transactions, targets, settings{display_basis}, _last_sync}.

작업 전 읽기(요약 보고): original/logic/dividend_ledger.py 전체, original/logic/dividend_performance.py 전체,
original/pages_app/9_dividend_ledger.py(0~300행), target/components/dividend/ 전체,
target/lib/mock-dividend-data.ts, target/lib/firebase/firestore-repositories.ts(dividendLedger 컬렉션).

작업 (target/만 수정):
1. lib/dividend-ledger.ts 신규: 위 dividend_ledger.py 함수들을 순수 TS로 이식
   (LedgerTransaction/LedgerTarget/HoldingPosition 타입 포함).
2. lib/dividend-ledger-performance.ts 신규: build_performance_result 상당을 이식
   (시세/환율은 /api/quote/* 사용, 실패 시 warnings 누적 + 해당 구간 제외).
3. /dividends에 거래 입력 폼(자산구분 US/KR/COIN, 티커, 매수/매도, 수량, 단가, 환율, 메모, 기준일)과
   거래 내역 테이블(수정/삭제)을 target 카드 스타일로 추가하라.
4. 저장: localStorage gorani.dividend-ledger.v1 + Firestore dividendLedger/{txId},
   dividendLedgerMeta/default(targets, settings). 세전/세후 토글 값도 settings에 저장.
5. 요약 카드/월별 배당 차트/목표 달성률을 장부 실계산으로 교체. MOCK_SHARE_PRICE_KRW 사용 제거.
   거래가 0건이면 기존 스냅샷+mock 추정 뷰를 sample로 유지하고 배지 표시(현행 usingMock 패턴 확장).
6. 배당 성과 섹션(DividendPerformanceSection)을 2의 결과(월별 평가액·벤치마크·월별손익)로 교체.

조건: original/은 읽기 전용 참고. 실제 수정은 target/만. target/의 UI 스타일·컴포넌트 구조·라우팅 유지.
원본 Streamlit UI 복사 금지. target에만 있는 기능 삭제 금지(스냅샷 기반 추정 뷰는 sample로 보존).
검증: npm run build / lint / typecheck. 수동: BUY 10@100 + BUY 10@200 → 평균 150,
SELL 5 → 수량 15·평균 150 유지, 시세 실패 시 last_trade 폴백, 새로고침·재로그인 복원,
월별 예상배당이 세후 토글에 반응하는지 확인.
보고: 변경 파일 목록, 구현 내용, 제외 내용, 남은 작업, 테스트 결과.


### [Codex Prompt — Step 6: 시장 현황/시장온도/SCHD 매력도/투자 성과]

배경: 이 저장소에는 original/(Streamlit 원본, 읽기 전용 참고)과 target/(Next.js 수정대상)이 있다.
target/의 /market은 lib/market-data.ts가 전부 MOCK_*을 반환하고(TODO(codex) fetch 교체 주석 있음),
/performance도 mock 시리즈다. 원본의 SCHD 매력도 페이지는 target에 아예 없다.

원본 기준:
- original/logic/market.py: compute_rsi(Wilder, ewm alpha=1/period, 손실평균 0→RSI 100, 완전 횡보→50),
  compute_drawdown_series, compute_gorani_market_temperature v1(QQQ/SPY RSI, 하락률 점수=100+dd×200,
  SPY 200일선 점수=50+dist×250, VIX 점수=100−(vix−10)×100/30, 유효 요소 평균),
  compute_gorani_market_temperature_v2(7요소 rolling percentile rank, 최소 5요소),
  classify_fear_greed_score(<25 극단적 공포, <45 공포, <55 중립, <75 탐욕, 그 외 극단적 탐욕).
- original/pages_app/6_market_temperature.py: WATCHLIST=QQQ/SCHD/SPY, 기간 6개월/1년/3년/5년/전체,
  브리핑 티커(^GSPC, ^DJI, ^IXIC, KRW=X, CL=F, GC=F, ^VIX), CNN Fear&Greed
  (production.dataviz.cnn.io/index/fearandgreed/graphdata) 실페치 + 실패 시 자체 온도로 대체.
- original/pages_app/8_attractiveness_score.py: SCHD TTM 배당률 = 최근 4회 배당 합 / 종가 × 100
  (1%~8% 밖 이상치는 차트/평균에서 제외), 분할 보정(before/after median 비율 > max(1.8, 분할비×0.65)면
  과거 배당을 분할비로 나눔), 목표 배당률 3.5/3.6/3.7/3.8%별 매수가 = TTM배당/목표율, 52주 고점 대비 낙폭.
- original/logic/tracker_performance.py: 최신 스냅샷 태그→티커 매핑(현금성 키워드 제외, 미국 티커/
  한국 6자리 .KS→.KQ 폴백/BTC-KRW), 수량 = 평가액/현재가 역산, effective start = 자산별 시작일 max,
  초기자본 동일 스케일로 KOSPI/S&P500(KRW 환산)/QQQ(KRW 환산) 비교, 최근 12개월 월별손익.

작업 전 읽기(요약 보고): original/logic/market.py 전체, original/pages_app/6_market_temperature.py(0~300행),
original/pages_app/8_attractiveness_score.py(0~400행), original/logic/tracker_performance.py 전체,
target/lib/market-data.ts, target/lib/mock-market-data.ts, target/components/market/ 전체,
target/app/performance/page.tsx, target/components/PerformanceChart.tsx.

작업 (target/만 수정):
1. app/api/market/ route 신설: briefing(7개 지표 현재가/등락), fear-greed(CNN 프록시, 실패 시 null),
   rsi-drawdown, vix, temperature(v1 점수+구성요소). 계산은 lib/market-calc.ts(Step 4에서 생성)에
   compute_rsi와 고라니온도 v1을 추가 이식해 사용. v2는 후순위(선택).
2. lib/market-data.ts의 각 함수 내부 TODO(codex) 지점을 위 API 호출로 교체.
   인터페이스(함수명/반환 타입)는 변경 금지. 실패 시 기존 MOCK_* fallback 유지 + source 플래그 추가.
3. /market 화면: FearGreedCard에 CNN 실패 시 "고라니 시장온도" 자체 점수 표시(원본 fallback 흐름),
   MarketRsiChart/RsiDrawdownChart/VixChart는 QQQ/SCHD/SPY + 기간 옵션으로 실데이터 연결.
4. lib/schd-attractiveness.ts 신규(위 8번 페이지 로직 이식) +
   components/market/SchdAttractivenessCard.tsx 신규: TTM 배당률 추이 차트, 현재 TTM 배당률,
   목표수익률별 매수가 표(3.5~3.8%), 52주 고점 낙폭. /market 페이지 하단에 섹션으로 배치(새 라우트 금지).
5. lib/tracker-performance.ts 신규(위 tracker_performance.py 이식) 후 /performance를 실계산으로 교체:
   포트폴리오 스냅샷 store에서 최신 스냅샷을 읽고, 시작일 선택(기본 2년 전), 벤치마크 3종 비교 곡선,
   최근 12개월 월별손익 막대, 제외 종목/경고 목록 표시. 스냅샷이 없으면 기존 mock을 sample 배지와 함께 유지.

조건: original/은 읽기 전용 참고. 실제 수정은 target/만. target/의 UI 스타일·컴포넌트 구조·라우팅 유지.
원본 Streamlit UI 복사 금지. target에만 있는 기능(asset-map 섹션, TradingView treemap 등) 삭제 금지.
검증: npm run build / lint / typecheck. 수동: 단조 상승 시계열 RSI=100 단위 검산,
SCHD TTM 배당률이 1~8% 범위인지, 스냅샷 1개 등록 후 /performance에 벤치마크 곡선이 그려지는지 확인.
보고: 변경 파일 목록, 구현 내용, 제외 내용, 남은 작업, 테스트 결과.


### [Codex Prompt — Step 7: target 고유 기능 보존/고도화 + 즐겨찾기/경제일정]

배경: 이 저장소에는 original/(Streamlit 원본, 읽기 전용 참고)과 target/(Next.js 수정대상)이 있다.
Step 2~6으로 핵심 기능은 실데이터화되었다. 이 단계는 target에만 있는 기능을 보존·연결하고,
원본에만 있던 부가 기능 2개(즐겨찾기 링크, 미국 경제일정)를 추가한다.

원본 기준:
- 즐겨찾기 링크(original/app.py): {name, url} 최대 10개, normalize_url(http/https 없으면 https:// 접두),
  이름·URL 둘 다 있어야 저장, 클라우드 동기화.
- 경제일정(original/modules/dividend_calendar.py + original/data/economic_calendar_us_high.json):
  GitHub Actions가 생성한 정적 JSON({status, updated_at, events[]} 또는 legacy list)을 읽어
  오늘~30일 내 일정만 날짜·시간 정렬로 표시, updated_at 48시간 초과 시 stale 경고.

작업 전 읽기(요약 보고): original/app.py의 즐겨찾기 함수들,
original/modules/dividend_calendar.py의 load_us_high_importance_economic_calendar와 정규화 헬퍼,
original/data/economic_calendar_us_high.json, target/components/watchlist/EconomicCalendarMini.tsx,
target/components/TopNav.tsx, target/app/page.tsx, target/lib/mockData.ts,
target/components/qld/QldDashboardPage.tsx, target/lib/qldDashboardData.ts,
target/app/asset-map/page.tsx, target/components/market/AssetMapSection.tsx, target/components/TreemapMock.tsx.

작업 (target/만 수정):
1. 즐겨찾기 링크: lib/favorite-links.ts(normalizeUrl + 최대 10개 검증) +
   localStorage gorani.favorite-links.v1 + Firestore favoriteLinks/default 저장.
   TopNav에 ⭐ 드롭다운(목록 + 관리 다이얼로그: 추가/수정/삭제)으로 노출. target 다크 스타일 유지.
2. 경제일정: original/data/economic_calendar_us_high.json을 target/public/data/로 복사하고,
   lib/economic-calendar.ts에 원본 정규화/30일 필터/stale 판정 로직을 이식해
   EconomicCalendarMini를 실데이터로 교체. 파일이 비거나 stale이면 안내 문구 표시(앱은 깨지지 않음).
3. 홈(app/page.tsx): PIN_TICKERS 등 mock 카드를 /api/market/briefing 실데이터로 교체하고,
   총자산(최신 스냅샷)·이번 달 배당 이벤트 수(캘린더 캐시)·시장온도 요약 카드를 추가.
   데이터 없으면 기존 mock을 sample 배지와 함께 유지. NAV_ITEMS는 변경 금지.
4. asset-map / TreemapMock: 최신 스냅샷 보유 비중으로 treemap 데이터를 연결하고
   Step 3의 슈퍼그룹 색상을 적용. 스냅샷 없으면 기존 mock 유지.
5. QLD 대시보드: 기존 화면 회귀 없는지 확인만 하고, 가능하면 스냅샷의 QLD 보유분을
   요약 카드에 표시(작게, 기존 레이아웃 변경 금지). 무리하면 "남은 작업"으로 보고만.

조건: original/은 읽기 전용 참고. 실제 수정은 target/만. target/의 UI 스타일·컴포넌트 구조·라우팅 유지.
원본 Streamlit UI 복사 금지. target에만 있는 기능 삭제 금지.
검증: npm run build / lint / typecheck. 수동: 링크 10개 제한·URL 정규화, 경제일정 30일 필터,
홈 카드 실데이터 표시, 비로그인 새로고침 후 즐겨찾기 복원.
보고: 변경 파일 목록, 구현 내용, 제외 내용, 남은 작업, 테스트 결과.


### [Codex Prompt — Step 8: 전체 회귀 테스트와 사용성 보정]

배경: 이 저장소에는 original/(Streamlit 원본, 읽기 전용 참고)과 target/(Next.js 수정대상)이 있다.
Step 0~7로 기능 이식이 끝났다. 이 단계는 기능 추가 없이 회귀 검증과 마감 보정만 수행한다.

작업 전 읽기(요약 보고): target/docs/AUDIT.md(Step 0 산출물), target/app/ 전체 라우트,
target/components/calculator/PreviewNotice.tsx, target/components/asset-simulator/SimulatorPreviewNotice.tsx,
target/components/common/StorageModeBadge.tsx.

작업 (target/만 수정):
1. 아래 판정 기준을 라우트별로 점검하고 결과를 target/docs/RELEASE_CHECK.md로 작성:
   - 입력 → 결과 변경 (계산기 3종, 시뮬레이터, 장부, 캘린더 티커)
   - 새로고침/재로그인 복원 (스냅샷, 시뮬 설정, 캘린더 포트폴리오/메모/마크/캐시, 장부, 즐겨찾기, 프리셋)
   - mock은 sample/fallback로만 사용 + 배지 표시
   - 빈 데이터/시세 API 실패/잘못된 입력에서 페이지가 깨지지 않음 (개발자도구 네트워크 차단으로 확인)
   - 모바일 뷰포트(375px)에서 전 메뉴 이동·핵심 조작 가능
   - /portfolio, /dividends, /performance, 홈 요약이 동일 store 데이터를 표시
2. 점검 중 발견된 버그를 수정하라. 단, 새 기능 추가 금지.
3. 문구 보정: PreviewNotice/SimulatorPreviewNotice는 live 데이터일 때 숨기거나
   "데이터 출처: Yahoo/Stooq, 마지막 갱신 시각"으로 변경. StorageModeBadge에 마지막 동기화 시각 표시.
4. 콘솔 경고/타입 오류/미사용 import 정리.

조건: original/은 읽기 전용 참고. 실제 수정은 target/만. target/의 UI 스타일·컴포넌트 구조·라우팅 유지.
원본 Streamlit UI 복사 금지. target에만 있는 기능 삭제 금지.
검증: npm run build / npm run lint / npm run typecheck 전부 통과가 완료 조건.
보고: RELEASE_CHECK.md 요약, 수정한 버그 목록, 변경 파일 목록, 제외 내용, 남은 작업(있다면), 테스트 결과.


## 14. 최종 요약
가장 먼저 해야 할 핵심 작업: Step 2의 실시세 API route + 통합 store/repository 구축. target/의 모든 mock 문제(계산기 3종, 시장 현황, 캘린더, 성과)는 lib/calculator-data-provider.ts와 lib/market-data.ts의 합성 데이터 하나로 수렴한다. 이 기반이 없으면 Step 3~6 전부가 막힌다. 다행히 두 파일 모두 "교체 지점"이 TODO(codex) 주석으로 이미 설계돼 있어 화면 코드 변경 없이 교체 가능하다.

가장 위험한 구현 리스크: ① 배당캘린더 이벤트 생성 이식(Step 5a) — 원본은 yfinance/Finnhub/Polygon 3중 소스 + 거래일 보정 + 패턴 투영이 얽힌 가장 복잡한 모듈이며, 브라우저/서버리스 환경에서는 Yahoo 비공식 API 한 곳에 의존하게 되어 레이트리밋·차단 리스크가 있다(캐시 전략 필수). ② Yahoo 비공식 chart API의 안정성 — 실패 시 Stooq 폴백과 sample 폴백을 끝까지 유지해야 앱이 깨지지 않는다. ③ 수치 검증 — 자산시뮬 인출 이분탐색과 SCHD 분할 보정처럼 미묘한 분기는 원본 결과와 직접 대조하지 않으면 조용히 틀린다(6장 테스트 케이스를 각 PR에서 강제).

완료 시 최종 상태: target/은 다크 테마 Next.js UI를 그대로 유지한 채 — 로그인하면 Firestore로, 비로그인이면 localStorage로 모든 데이터(스냅샷·시뮬 설정·캘린더 포트폴리오/메모/캐시·배당장부·즐겨찾기·프리셋)가 저장/복원되고, 실시세 기반으로 양도세치기 백테스트·전환비·MDD·시장온도·SCHD 매력도·배당 일정 추론·투자 성과 벤치마크가 원본과 동일한 계산식으로 동작하며, 원본에 없던 엑셀 업로드·포트폴리오 관리·QLD 대시보드·자산 맵·계산기 프리셋까지 보존된 — 즉 원본 Streamlit 앱의 실사용성을 전부 흡수하고 그 이상으로 확장한 단일 Gorani Finance 앱이 된다.