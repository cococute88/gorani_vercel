# ASSET-ALLOCATION-DONUT-STREAMLIT-RESTORE-1

기존 Streamlit "자산군 도넛 그래프" 로직을 Next/Vercel 로 복원하고,
`/portfolio` · `/portfolio-manager` · 스냅샷 히스토리 상세에서 같은 공통
helper/component 로 재사용한다.

작업일: 2026-06-15

---

## 1. 참고한 Streamlit Python 파일

| 파일 | 역할 |
| --- | --- |
| `original/logic/tracker.py` | **정본(canonical) 자산군 분류 로직.** `get_asset_type` / `get_super_group` / `get_color_for_tag` / `assign_colors` / `sort_tags_by_super_group` + 토스 톤다운 색상 팔레트 |
| `original/pages_app/2_asset_tracker.py` | 같은 분류 로직의 인라인 버전 + 실제 도넛(`go.Pie(hole=0.5, sort=False, textinfo='label+percent')`) 렌더와 누적 추이/성과 분석 |

키워드 검색(`자산군`, `도넛`, `pie`, `donut`, `TQQQ`, `QLD`, `QQQ`, `SPY`,
`SCHD`, `MSFT`, `달러`, `현금`, `예적금`, `기타`, `asset`, `allocation`,
`portfolio`) 결과 자산군 도넛 로직은 위 두 파일에만 존재했다. 추가로
`original/modules/dividend_calendar.py` 도 확인했으나 자산군 분류와는 무관했다.

---

## 2. 원본 Streamlit 자산군 분류/정렬 기준

### 2.1 자산군(타입) 분류 — `get_asset_type(tag)`

위에서부터 먼저 매칭(우선순위 고정). 영문 ticker 는 **정확 일치**, 한글/기호
키워드는 **부분 문자열**로 매칭한다(원본 `lo in (...)` vs `"..." in lo`).

| 타입 | 원본 키워드 |
| --- | --- |
| `dollar` | `달러`, `usd`, `dollar` |
| `cash` | `현금`, `예금`, `적금`, `예적금`, `채권`, `rp`, `저축`, `cma`, `mmf`, `파킹`, `입출금` |
| `leverage` | `tqqq`, `qld`, `upro`, `soxl`, `tecl`, `fngu`, `bulz`, `sso`, `레버리지`, `3x`, `2x` |
| `nasdaq` | `qqq`, `qqqm`, `나스닥` |
| `spy` | `spy`, `voo`, `ivv`, `splg`, `s&p`, `sp500`, `snp` |
| `dividend` | `msft`, `schd`, `vym`, `dgro`, `aapl`, `ko`, `jnj`, `pg`, `vti`, `vtv`, `vug`, `dia`, `배당`, `dividend` |
| `other` | 위 어디에도 안 걸리는 나머지 |

요청한 대표 종목의 실제 분류 결과:
- **TQQQ / QLD → `leverage`**, **QQQ → `nasdaq`** (둘 다 슈퍼그룹 `lev_nas` = "나스닥성")
- **SPY / VOO → `spy`**, **SCHD → `dividend`** (둘 다 슈퍼그룹 `spy_div`)
- **MSFT → `dividend`** (원본 기준. 작업 예시에서는 "개별주/기타"로 적었지만 지시대로 **원본 우선**)
- **현금 / 예적금 / MMF → `cash`**, **달러 → `dollar`** (둘 다 슈퍼그룹 `cash_dol`)
- **GOOGL / NFLX → `other`** (슈퍼그룹 `other_grp`)

### 2.2 슈퍼그룹 — `get_super_group(type)`

| 슈퍼그룹 | 포함 타입 | 의미 |
| --- | --- | --- |
| `lev_nas` | leverage, nasdaq | 나스닥성 |
| `spy_div` | spy, dividend | S&P·배당 |
| `cash_dol` | cash, dollar | 현금·달러 |
| `other_grp` | other | 기타 |

### 2.3 정렬/인접 배치 — `sort_tags_by_super_group`

`key = (-슈퍼그룹합계, -타입합계, -개별금액)` 으로 정렬한다. 즉:
1. 합계가 큰 **슈퍼그룹**이 먼저 → 같은 슈퍼그룹이 연속(인접) 배치
2. 같은 슈퍼그룹 안에서 합계가 큰 **타입**이 먼저 (leverage/nasdaq 끼리 뭉침)
3. 같은 타입 안에서 **금액**이 큰 종목 먼저

→ 단순 value descending 이 아니라, 유사 자산군이 도넛에서 이웃하게 배열된다.

### 2.4 색상

`original/logic/tracker.py` 의 토스 톤다운 팔레트(라이트/다크 가독성 양호)를
채택했다. 자산군별 고정색, `other` 는 팔레트 순환.

| 타입 | 색상 |
| --- | --- |
| cash | `#7CB342` |
| dollar | `#2E7D32` |
| leverage | `#8D2A1F` |
| nasdaq | `#E53935` |
| spy | `#FB8C00` |
| dividend | `#FDD835` |
| other | `#3182F6` → `#7E57C2` → `#26A69A` → `#EC407A` → `#5C6BC0` → `#42A5F5` → `#5E35B1` → `#00897B` (순환) |

(`2_asset_tracker.py` 의 더 밝은 팔레트 대신 polished 버전을 사용. 차이는 의도된 deviation.)

### 2.5 현재 Next 구현과 원본의 차이(이번 작업 전)

이번 작업 전 `/portfolio` 의 중앙 도넛은 `lib/portfolio-from-snapshots.ts`
`groupSlices(..., 15)` 가 만든 **단순 종목별 평가금액 상위 15개** (value
descending, 16번째부터 "기타")였다. 자산군 분류/슈퍼그룹 인접 배치/자산군
고정색이 전혀 반영돼 있지 않았다. 이번 작업으로 자산군 도넛으로 교체했다.

---

## 3. TypeScript 로 옮긴 helper 구조

`lib/asset-allocation-donut.ts` (pure, 외부 API/의존성 없음):

- `getAssetType(input)` — 원본 `get_asset_type` 포팅. 영문 ticker 는 토큰
  정확 일치(`ticker` base + 이름 토큰), 한글/기호는 부분 문자열로 매칭한다.
  이 덕분에 `KODEX` 의 `ko` 가 `dividend` 로 오분류되지 않는다.
- `getSuperGroup(type)` — 원본 `get_super_group` 포팅.
- `buildAssetAllocationDonut(items)` — 라벨별 집계 → 슈퍼그룹/타입 합계 →
  원본 3단 정렬 → 자산군 색 부여. `AssetAllocationSlice[]`(= `Slice` 확장,
  `name/value/color/amountKRW` + `assetType/assetTypeLabel/superGroup`) 반환.
- `assetAllocationItemsFromHoldings` / `assetAllocationItemsFromFinanceAssets`
  — Holding/FinanceAsset → 분류 입력 변환.
- `buildAssetAllocationFromSnapshotLike({holdings, financeAssets})` — 세 화면
  공용 진입점. 라벨은 `holdingDisplayLabel`(KRX 숫자 ticker→한글 상품명) 사용.

공통 컴포넌트 `components/portfolio/AssetAllocationDonut.tsx` 는 helper 를
호출해 슬라이스를 만들고 기존 `DonutChartCard`(라이트/다크 대응, KRW+% 범례)에
그린다. `DonutChartCard` 에는 레이아웃용 `className` prop 만 추가했다.

### 원본과 달라진 부분(의도된 deviation)
- **SPYM → `spy`**: 원본 정확 일치에서는 bare `SPYM` 이 `other` 로 떨어지지만,
  요청(한국상장 S&P500 wrapper 를 S&P 계열로 묶기, 테스트 #2)에 맞춰 spy
  키워드에 `spym` 을 추가했다.
- **현금성 키워드 확장**: 원본 키워드에 `예수금`/`예치금`/`SGOV`/`MMW` 추가
  (요청 분류 예시 반영).
- 색상은 `2_asset_tracker.py` 밝은 팔레트 대신 `tracker.py` 톤다운 팔레트 사용.

---

## 4. `/portfolio` 적용

`app/portfolio/page.tsx` 중앙 도넛 `종목별 비중 상위 15개`(`DonutChartCard` +
`portfolioView.stockAllocation`)를 `AssetAllocationDonut`(`자산군 비중`,
`portfolioView.mappedHoldings` + `snapshot.financeAssets`)로 교체. 좌측
`계좌별 비중`, 우측 `자산 구성`(성장/배당/현금 목적 도넛)은 유지. 계산 기준은
최신 스냅샷(`usePortfolioView`). summary/treemap/계좌현황 realdata 연결은 그대로.

---

## 5. `/portfolio-manager` 적용 (3-card 한 줄)

`components/portfolio/PortfolioPage.tsx` 상단을 한 줄 3-카드로 재구성:

1. 엑셀 업로드 (`ExcelUploadCard`)
2. 자산군 도넛 (`AssetAllocationDonut`)
3. 파싱결과 요약 (`PortfolioParsePreview`)

- 레이아웃: `grid-cols-1` (mobile) → `md:grid-cols-2` (tablet, 요약이 한 줄
  차지) → `xl:grid-cols-3` (wide). `items-stretch` + 카드 `h-full` 로 높이 정렬,
  horizontal overflow 없음.
- 도넛 기준: **파싱 preview 우선 → 없으면 최신 스냅샷 → 둘 다 없으면 empty
  state**(`엑셀을 업로드하면 자산군 비중이 표시됩니다.`).
- 엑셀 업로드/파서/저장/스냅샷 생성/Firebase sync 로직은 변경하지 않음
  (카드 shell 에 `h-full` 클래스만 추가).

---

## 6. 스냅샷 히스토리 선택 시 도넛 표시

`SnapshotHistory` 날짜 클릭 → `previewSnapshotId` 설정 → 미리보기 배너 아래,
항목 리스트(`HoldingsTable`) 위에 해당 스냅샷 기준 `AssetAllocationDonut`
(`자산군 비중 · {날짜} 기준`)를 표시. 선택이 바뀌면 도넛도 갱신, 미선택 시
표시 안 함. 히스토리 삭제/선택/저장 로직은 그대로. 모바일은 세로 stack.

세 화면 모두 같은 helper/component 를 쓰므로 **같은 holdings/financeAssets →
같은 분류·비중·색상**이 보장된다(테스트 #7).

---

## 7. empty / invalid 방어

- `valueKRW` 가 NaN/0/음수/Infinity 인 항목은 집계에서 제외.
- 입력이 `[]`/`null`/`undefined` → `{ slices: [], totalKRW: 0 }`.
- 보유종목이 있을 때 `category === "투자성"` 재무자산은 보유종목과 중복되므로
  제외해 이중집계를 막음(`lib/portfolio-from-snapshots.ts` 와 동일 기준).
- KRX 숫자 ticker 는 `holdingDisplayLabel` 로 한글 상품명 치환, 라벨이 길면
  `DonutChartCard` 범례에서 `truncate`.

---

## 8. ETF look-through 제외 (이번 작업 범위 아님)

`토스SPYM` 같은 ETF wrapper 가 실질보유 TOP100 에 섞이는 문제, ETF 구성종목
look-through 분해는 이번 작업에서 **건드리지 않았다**. 후속 Codex 작업
**`ASSET-MAP-ETF-DECOMPOSITION-FIX-1`** 으로 분리한다.

---

## 9. 테스트

신규: `npm run check:asset-allocation-donut` (`scripts/check-asset-allocation-donut.mjs`)
1. TQQQ/QLD/QQQ → 나스닥성(lev_nas)
2. SPY/SPYM/VOO/S&P500 KR → spy(S&P/SNP 계열)
3. SCHD → 배당(dividend)
4. 현금/달러/예적금/MMF/SGOV → 현금성(cash_dol)
5. 기타 개별주 → other, MSFT → 원본 기준 dividend, KODEX 의 `ko` 오분류 방어
6. 같은 슈퍼그룹/타입 연속(인접) 배치
7. 같은 holdings/financeAssets → 항상 동일 결과(3 화면 일관성)
8. KRX 숫자 ticker → 한글 상품명 라벨
9. empty/누락 입력 → 빈 결과
10. invalid/0/NaN/음수 방어
11. 투자성 재무자산 이중집계 방지

회귀(통과 확인): `check:portfolio-realdata`, `check:portfolio-ux-rules`,
`check:krx-ticker-name-map`, `check:asset-map`, `check:portfolio-parser`,
`check:auth-firestore-persistence`, `check:calendar-provider`,
`check:dividend-estimates`, `check:dividends-data`, `lint`, `typecheck`, `build`.

---

## 10. 남은 한계 / 다음 단계

- 분류는 상품명/티커 키워드 기반이라 ETF 구성종목 look-through 는 반영하지
  못한다(예: `토스SPYM` 단일 슬라이스). → `ASSET-MAP-ETF-DECOMPOSITION-FIX-1`.
- 매우 작은 항목을 `기타`로 묶는 후처리는 원본에 없어 적용하지 않았다(원본
  충실성 우선, 범례는 내부 스크롤로 처리). 필요 시 후속에서 임계값 옵션 추가 가능.
- `/portfolio-manager` 의 형제 카드(업로드/요약)는 기존부터 다크 고정 스타일이라
  도넛도 `theme="dark"` 로 맞췄다(라이트 페이지 배경 위 다크 카드 정렬 유지).
  매니저 전체의 라이트 테마 대응은 이번 범위가 아니다.
