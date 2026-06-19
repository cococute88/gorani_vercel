# 고라니 자산관리 — 포트폴리오 대시보드 (MOCK 클론)

Next.js (App Router) + TypeScript + Tailwind CSS + Recharts + lucide-react 기반의
**MOCK 데이터 전용** 포트폴리오 대시보드 UI 클론입니다. 외부 API/유료 서비스를 사용하지 않습니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 열기. (1440px 이상 데스크톱 기준 최적화)

## 페이지

| 경로 | 설명 | 테마 |
| --- | --- | --- |
| `/` | 대시보드 / 포트폴리오 현황 | 라이트 |
| `/asset-map` | 자산 맵 / ETF 투시 (섹터 도넛 + TOP100) | 다크 |
| `/performance` | 투자 성과 (KPI + 라인/막대 차트) | 다크 |
| `/portfolio` | 포트폴리오 현황 + 트리맵 | 다크 |

## 구조

```txt
app/
  layout.tsx
  globals.css
  page.tsx            # 대시보드 (라이트)
  asset-map/page.tsx
  performance/page.tsx
  portfolio/page.tsx
components/
  TopNav.tsx MetricCard.tsx DonutChartCard.tsx MiniTickerCard.tsx
  PortfolioSummary.tsx HoldingsTable.tsx MonthlyIncomeChart.tsx
  PerformanceChart.tsx AssetAccountCards.tsx WatchlistRow.tsx TreemapMock.tsx
lib/
  mockData.ts         # 모든 MOCK 데이터
  format.ts           # 원화/퍼센트 포맷 유틸
```

모든 수치는 `lib/mockData.ts`에서 가져옵니다. 차트는 Recharts/SVG/CSS로 실제 렌더링되며 placeholder 박스는 없습니다.
