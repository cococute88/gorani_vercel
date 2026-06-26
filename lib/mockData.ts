// =============================================================
// 모든 MOCK 데이터는 이 파일에 분리한다. 화면 컴포넌트는 여기서 가져온다.
// =============================================================

export type NavItem = { icon: string; label: string; href: string };

// --- 네비게이션 메뉴 ---
export const NAV_ITEMS: NavItem[] = [
  { icon: "📋", label: "투자현황", href: "/portfolio" },
  { icon: "💰", label: "배당", href: "/dividends" },
  { icon: "📈", label: "투자성과", href: "/performance" },
  { icon: "🗓️", label: "캘린더", href: "/calendar" },
  { icon: "🧙", label: "시장 현황", href: "/market" },
  { icon: "🧮", label: "계산기", href: "/calculator" },
  { icon: "🧭", label: "자산시뮬", href: "/asset-simulator" },
  { icon: "⚙️", label: "포트폴리오 관리", href: "/portfolio-manager" },
];

// --- 핀 차트 티커 ---
export type Ticker = {
  name: string;
  value: string;
  change: string;
  up: boolean; // 상승(빨강) / 하락(파랑)
  spark: number[];
};

export const PIN_TICKERS: Ticker[] = [
  {
    name: "S&P 500",
    value: "7,143.00",
    change: "+0.82%",
    up: true,
    spark: [30, 32, 31, 34, 36, 35, 38, 41, 43, 47],
  },
  {
    name: "KOSPI",
    value: "6,475.81",
    change: "+1.21%",
    up: true,
    spark: [40, 41, 39, 42, 44, 46, 45, 49, 52, 55],
  },
  {
    name: "달러 인덱스",
    value: "98.58",
    change: "-0.34%",
    up: false,
    spark: [55, 53, 54, 51, 49, 48, 46, 45, 43, 41],
  },
  {
    name: "비트코인",
    value: "78,238.57",
    change: "+2.45%",
    up: true,
    spark: [20, 24, 23, 28, 30, 33, 37, 40, 44, 49],
  },
  {
    name: "WTI 원유",
    value: "93.44",
    change: "-1.02%",
    up: false,
    spark: [52, 50, 51, 48, 47, 45, 44, 42, 40, 38],
  },
  {
    name: "USD/KRW",
    value: "1,477.63",
    change: "-0.21%",
    up: false,
    spark: [50, 49, 50, 48, 47, 47, 45, 44, 43, 42],
  },
  {
    name: "CNN 공포/탐욕",
    value: "68.51",
    change: "+3.10%",
    up: true,
    spark: [35, 37, 39, 41, 40, 44, 47, 50, 53, 57],
  },
  {
    name: "NASDAQ",
    value: "24,625.95",
    change: "+1.05%",
    up: true,
    spark: [33, 35, 34, 38, 40, 42, 45, 47, 50, 54],
  },
  {
    name: "금",
    value: "4,749.30",
    change: "+0.64%",
    up: true,
    spark: [42, 44, 43, 46, 48, 47, 50, 52, 54, 57],
  },
];

// --- 포트폴리오 요약 (라이트 대시보드) ---
export const PORTFOLIO_SUMMARY = {
  totalValue: 943200787,
  totalProfit: 211669647,
  totalProfitRate: 28.94,
  annualDividend: 29973420,
  monthlyAvgDividend: 2497785,
  taxable: 18752354,
  nonTaxable: 11221067,
  cumPrincipal: 621000000,
  cumPerformance: 295000000,
  cumReturnRate: 47.59,
  accounts: 7,
  holdings: 32,
  tagTargets: [
    { name: "배당", current: 62.1, target: 60 },
    { name: "성장", current: 37.9, target: 40 },
  ],
};

// --- 포트폴리오 요약 (다크 /portfolio) ---
export const PORTFOLIO_SUMMARY_DARK = {
  totalValue: 1001100320,
  totalProfit: 257419260,
  totalProfitRate: 34.61,
  todayProfit: 6201312,
  todayProfitRate: 0.62,
  annualIncome: 49586057,
  dividendYield: 2.96,
  investDividendYield: 3.99,
  monthlyIncome: 4132171,
  monthlyDividend: 2472171,
  yearlyDividend: 29666057,
  rentIncome: 19920000,
  taxable: 17587668,
  nonTaxable: 12078389,
  taxLimitRemaining: 2412332,
  taxLimitUsedRate: 88,
  annualDividendWithdrawalEstimates: [
    { name: "SCHD 절세(ISA) 인출 예상", value: 29666057 },
    { name: "VOO 절세(연금) 인출 예상", value: 19920000 },
  ],
  schdGoal: {
    target: 10000000,
    achieved: 7630995,
  },
  stockCashTargets: [
    { name: "주식", current: 64.3, target: 60 },
    { name: "현금", current: 35.7, target: 40 },
  ],
  cumPrincipal: 624000000,
  cumPerformance: 337000000,
  cumReturnRate: 53.99,
  accounts: 7,
  holdings: 37,
  fxUsd: 1493,
  fxJpy: 940,
  tagTargets: [
    { name: "배당", current: 64.3, target: 60 },
    { name: "성장", current: 35.7, target: 40 },
  ],
};

export type Slice = { name: string; value: number; color: string; amountKRW?: number };

// 목업 비중 슬라이스에 표시용 원화 금액(amountKRW)을 부여한다.
// value(%)는 그대로 두고, 총자산(totalKRW) 기준 금액만 파생한다 (display only).
function withMockAmounts(slices: Slice[], totalKRW: number): Slice[] {
  return slices.map((s) => ({ ...s, amountKRW: Math.round((s.value / 100) * totalKRW) }));
}

// --- 계좌별 비중 ---
export const ACCOUNT_ALLOCATION: Slice[] = withMockAmounts(
  [
    { name: "미국주식", value: 38.2, color: "#2563eb" },
    { name: "국내주식", value: 21.4, color: "#22c55e" },
    { name: "연금저축", value: 13.1, color: "#f59e0b" },
    { name: "ISA", value: 9.8, color: "#a855f7" },
    { name: "퇴직연금", value: 7.7, color: "#ec4899" },
    { name: "일본주식", value: 5.9, color: "#14b8a6" },
    { name: "현금", value: 3.9, color: "#94a3b8" },
  ],
  980000000,
);

// --- 종목별 비중 상위 15개 ---
export const STOCK_ALLOCATION: Slice[] = withMockAmounts(
  [
    { name: "삼성전자", value: 11.2, color: "#2563eb" },
    { name: "NVIDIA", value: 9.4, color: "#22c55e" },
    { name: "Apple", value: 8.1, color: "#f59e0b" },
    { name: "Microsoft", value: 7.3, color: "#a855f7" },
    { name: "SK하이닉스", value: 6.5, color: "#ec4899" },
    { name: "리얼티 인컴", value: 5.8, color: "#14b8a6" },
    { name: "JEPI", value: 5.1, color: "#ef4444" },
    { name: "TSLA", value: 4.6, color: "#f97316" },
    { name: "카카오", value: 4.0, color: "#06b6d4" },
    { name: "SCHD", value: 3.7, color: "#84cc16" },
    { name: "Google", value: 3.3, color: "#6366f1" },
    { name: "Amazon", value: 3.0, color: "#d946ef" },
    { name: "현대차", value: 2.7, color: "#0ea5e9" },
    { name: "QQQ", value: 2.4, color: "#eab308" },
    { name: "기타", value: 22.9, color: "#64748b" },
  ],
  980000000,
);

// --- 태그별 비중 ---
export const TAG_ALLOCATION: Slice[] = [
  { name: "배당", value: 62.1, color: "#2563eb" },
  { name: "성장", value: 37.9, color: "#22c55e" },
];

export const TAG_ALLOCATION_DARK: Slice[] = withMockAmounts(
  [
    { name: "배당", value: 56.9, color: "#3b82f6" },
    { name: "성장", value: 31.6, color: "#f59e0b" },
    { name: "현금", value: 8.8, color: "#22c55e" },
    { name: "개별주", value: 1.8, color: "#14b8a6" },
    { name: "채권", value: 0.6, color: "#a855f7" },
    { name: "금", value: 0.3, color: "#eab308" },
  ],
  980000000,
);

// --- 월별 소득 (배당 + 임대) ---
export type MonthlyIncome = { month: string; dividend: number; rent: number };
export const MONTHLY_INCOME: MonthlyIncome[] = [
  { month: "1월", dividend: 1820000, rent: 1660000 },
  { month: "2월", dividend: 2100000, rent: 1660000 },
  { month: "3월", dividend: 3450000, rent: 1660000 },
  { month: "4월", dividend: 1950000, rent: 1660000 },
  { month: "5월", dividend: 2380000, rent: 1660000 },
  { month: "6월", dividend: 3680000, rent: 1660000 },
  { month: "7월", dividend: 2050000, rent: 1660000 },
  { month: "8월", dividend: 2420000, rent: 1660000 },
  { month: "9월", dividend: 3720000, rent: 1660000 },
  { month: "10월", dividend: 2180000, rent: 1660000 },
  { month: "11월", dividend: 2510000, rent: 1660000 },
  { month: "12월", dividend: 3890000, rent: 1660000 },
];
export const MONTHLY_INCOME_TOTAL = 30477092;
export const MONTHLY_INCOME_TOTAL_DARK = 49586057;

// --- 투자 성과 월별 데이터 (라인+막대) ---
export type PerfPoint = {
  date: string;
  value: number; // 평가액 (억)
  principal: number; // 누적투자원금 (억)
  dividend: number; // 배당금 (만)
  rent: number; // 임대소득 (만)
};

function buildPerfSeries(): PerfPoint[] {
  const out: PerfPoint[] = [];
  // 2021.03 ~ 2026.05 (시드 고정 의사난수로 SSR/CSR 동일)
  let year = 21;
  let month = 3;
  let principal = 1.2;
  let value = 1.25;
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 63; i++) {
    const label = `${String(year).padStart(2, "0")}.${String(month).padStart(2, "0")}`;
    principal += 0.085 + rnd() * 0.015;
    const noise = Math.sin(i / 4) * 0.18 + (rnd() - 0.4) * 0.12;
    value = Math.max(principal * (1.0 + i * 0.012) + noise, principal * 0.96);
    const dividend = 60 + i * 3 + Math.round(rnd() * 40);
    const rent = i > 18 ? 160 + Math.round(rnd() * 20) : 0;
    out.push({
      date: label,
      value: Number(value.toFixed(2)),
      principal: Number(principal.toFixed(2)),
      dividend,
      rent,
    });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  const last = out[out.length - 1];
  last.value = 9.8;
  last.principal = 6.24;
  return out;
}

export const PERFORMANCE_SERIES: PerfPoint[] = buildPerfSeries();

export type PerfKpi = {
  label: string;
  value: string;
  sub?: string;
  tone: "gray" | "green" | "orange";
};
export const PERFORMANCE_KPIS: PerfKpi[] = [
  { label: "현재 평가액", value: "9억 8,011만원", tone: "gray" },
  { label: "누적투자원금", value: "6억 2,445만원", tone: "green" },
  { label: "누적 손익", value: "+3억 5,566만원", tone: "orange" },
  { label: "누적 수익률", value: "+56.96%", tone: "green" },
  {
    label: "CAGR (자금가중)",
    value: "+8.97%/년",
    sub: "637개월 기준",
    tone: "green",
  },
  {
    label: "CAGR (시간가중)",
    value: "+11.95%/년",
    sub: "637개월 기준",
    tone: "green",
  },
];

// --- 관심종목 ---
export type Watchlist = {
  name: string;
  price: string;
  change: string;
  up: boolean;
};
export const WATCHLIST: Watchlist[] = [
  {
    name: "ProShares Ultra Bitcoin ETF",
    price: "$58.21",
    change: "+3.42%",
    up: true,
  },
  { name: "KODEX 원자력SMR", price: "24,310", change: "+1.85%", up: true },
  {
    name: "KODEX 신재생에너지액티브",
    price: "12,640",
    change: "-0.74%",
    up: false,
  },
  { name: "TIGER K방산&우주", price: "18,920", change: "+2.10%", up: true },
  {
    name: "JPMorgan S&P 500 커버드콜 월배당 ETF",
    price: "$54.83",
    change: "+0.46%",
    up: true,
  },
  { name: "리얼티 인컴", price: "$61.27", change: "-0.31%", up: false },
  { name: "화이자", price: "$28.04", change: "+0.92%", up: true },
];

// --- 계좌 카드 ---
export type AccountCard = {
  name: string;
  type: string;
  tax: "과세" | "비과세";
  value: number;
  profit: number;
  rate: number;
};
export const ACCOUNT_CARDS: AccountCard[] = [
  {
    name: "미국주식",
    type: "위탁투자",
    tax: "과세",
    value: 382400000,
    profit: 112800000,
    rate: 41.8,
  },
  {
    name: "일본주식",
    type: "위탁투자",
    tax: "과세",
    value: 59200000,
    profit: 9700000,
    rate: 19.6,
  },
  {
    name: "국내주식",
    type: "위탁투자",
    tax: "과세",
    value: 214300000,
    profit: 38500000,
    rate: 21.9,
  },
  {
    name: "연금저축",
    type: "연금",
    tax: "비과세",
    value: 131200000,
    profit: 28100000,
    rate: 27.3,
  },
  {
    name: "ISA",
    type: "절세",
    tax: "비과세",
    value: 98300000,
    profit: 14600000,
    rate: 17.4,
  },
  {
    name: "퇴직연금",
    type: "연금",
    tax: "비과세",
    value: 77100000,
    profit: 9200000,
    rate: 13.5,
  },
  {
    name: "현금",
    type: "예수금",
    tax: "과세",
    value: 38900000,
    profit: 0,
    rate: 0,
  },
];

// --- ETF 섹터 비중 (자산 맵) ---
export const SECTOR_ALLOCATION: Slice[] = [
  { name: "기술", value: 37.4, color: "#2563eb" },
  { name: "금융", value: 27.1, color: "#22c55e" },
  { name: "경기소비재", value: 9.1, color: "#f59e0b" },
  { name: "산업재", value: 8.4, color: "#a855f7" },
  { name: "커뮤니케이션", value: 4.3, color: "#ec4899" },
  { name: "소재", value: 3.6, color: "#14b8a6" },
  { name: "헬스케어", value: 3.3, color: "#ef4444" },
  { name: "필수소비재", value: 2.5, color: "#f97316" },
  { name: "에너지", value: 1.6, color: "#06b6d4" },
  { name: "기타", value: 1.1, color: "#84cc16" },
  { name: "유틸리티", value: 0.5, color: "#6366f1" },
  { name: "부동산", value: 0.5, color: "#d946ef" },
  { name: "화장품", value: 0.2, color: "#0ea5e9" },
  { name: "전자제품", value: 0.2, color: "#eab308" },
  { name: "에너지장비및서비스", value: 0.1, color: "#fb7185" },
  { name: "다각화통신서비스", value: 0.1, color: "#34d399" },
];

// --- 실질 보유 TOP 100 테이블 ---
export type Holding = {
  rank: number;
  name: string;
  ticker: string;
  sector: string;
  weight: number;
};
export const TOP_HOLDINGS: Holding[] = [
  {
    rank: 1,
    name: "Texas Instruments Inc",
    ticker: "TXN",
    sector: "기술",
    weight: 3.23,
  },
  {
    rank: 2,
    name: "Qualcomm Inc",
    ticker: "QCOM",
    sector: "기술",
    weight: 3.2,
  },
  {
    rank: 3,
    name: "삼성전자",
    ticker: "005930.KS",
    sector: "기술",
    weight: 2.5,
  },
  {
    rank: 4,
    name: "SK하이닉스",
    ticker: "000660.KS",
    sector: "기술",
    weight: 2.31,
  },
  {
    rank: 5,
    name: "Accenture PLC",
    ticker: "ACN",
    sector: "기술",
    weight: 1.49,
  },
  {
    rank: 6,
    name: "Automatic Data Processing Inc",
    ticker: "ADP",
    sector: "기술",
    weight: 1.23,
  },
  {
    rank: 7,
    name: "NVIDIA Corp",
    ticker: "NVDA",
    sector: "기술",
    weight: 0.67,
  },
  {
    rank: 8,
    name: "샌디스크/Sandisk Corp/DE",
    ticker: "SNDK",
    sector: "기술",
    weight: 0.45,
  },
  {
    rank: 9,
    name: "PAYCHEX INC",
    ticker: "PAYX",
    sector: "기술",
    weight: 0.43,
  },
  {
    rank: 10,
    name: "Cisco Systems Inc",
    ticker: "CSCO",
    sector: "기술",
    weight: 0.39,
  },
  {
    rank: 11,
    name: "International Business Machines",
    ticker: "IBM",
    sector: "기술",
    weight: 0.37,
  },
  {
    rank: 12,
    name: "Oracle Corp",
    ticker: "ORCL",
    sector: "기술",
    weight: 0.34,
  },
  {
    rank: 13,
    name: "Intel Corp",
    ticker: "INTC",
    sector: "기술",
    weight: 0.31,
  },
  { rank: 14, name: "Adobe Inc", ticker: "ADBE", sector: "기술", weight: 0.29 },
  {
    rank: 15,
    name: "Micron Technology Inc",
    ticker: "MU",
    sector: "기술",
    weight: 0.26,
  },
  {
    rank: 16,
    name: "Applied Materials Inc",
    ticker: "AMAT",
    sector: "기술",
    weight: 0.24,
  },
  {
    rank: 17,
    name: "Analog Devices Inc",
    ticker: "ADI",
    sector: "기술",
    weight: 0.22,
  },
  {
    rank: 18,
    name: "Lam Research Corp",
    ticker: "LRCX",
    sector: "기술",
    weight: 0.21,
  },
  { rank: 19, name: "KLA Corp", ticker: "KLAC", sector: "기술", weight: 0.19 },
  {
    rank: 20,
    name: "Microchip Technology Inc",
    ticker: "MCHP",
    sector: "기술",
    weight: 0.17,
  },
  {
    rank: 21,
    name: "JPMorgan Chase & Co",
    ticker: "JPM",
    sector: "금융",
    weight: 2.85,
  },
  {
    rank: 22,
    name: "Bank of America",
    ticker: "BAC",
    sector: "금융",
    weight: 1.92,
  },
  { rank: 23, name: "Visa Inc", ticker: "V", sector: "금융", weight: 1.74 },
  {
    rank: 24,
    name: "Mastercard Inc",
    ticker: "MA",
    sector: "금융",
    weight: 1.51,
  },
  {
    rank: 25,
    name: "Amazon.com Inc",
    ticker: "AMZN",
    sector: "경기소비재",
    weight: 2.1,
  },
  {
    rank: 26,
    name: "Tesla Inc",
    ticker: "TSLA",
    sector: "경기소비재",
    weight: 1.66,
  },
  {
    rank: 27,
    name: "Home Depot Inc",
    ticker: "HD",
    sector: "경기소비재",
    weight: 1.18,
  },
  {
    rank: 28,
    name: "Caterpillar Inc",
    ticker: "CAT",
    sector: "산업재",
    weight: 1.34,
  },
  { rank: 29, name: "Boeing Co", ticker: "BA", sector: "산업재", weight: 0.98 },
  {
    rank: 30,
    name: "Netflix Inc",
    ticker: "NFLX",
    sector: "커뮤니케이션",
    weight: 1.12,
  },
  {
    rank: 31,
    name: "Walt Disney Co",
    ticker: "DIS",
    sector: "커뮤니케이션",
    weight: 0.81,
  },
  { rank: 32, name: "Linde PLC", ticker: "LIN", sector: "소재", weight: 0.74 },
  {
    rank: 33,
    name: "Johnson & Johnson",
    ticker: "JNJ",
    sector: "헬스케어",
    weight: 0.92,
  },
  {
    rank: 34,
    name: "Procter & Gamble",
    ticker: "PG",
    sector: "필수소비재",
    weight: 0.69,
  },
  {
    rank: 35,
    name: "Exxon Mobil Corp",
    ticker: "XOM",
    sector: "에너지",
    weight: 0.58,
  },
];

export const SECTOR_FILTERS = [
  "전체",
  "기술",
  "금융",
  "경기소비재",
  "산업재",
  "커뮤니케이션",
  "소재",
  "헬스케어",
  "필수소비재",
  "에너지",
  "기타",
];

// --- 트리맵 데이터 ---
export type TreemapItem = {
  name: string;
  value: number; // 면적 비율
  rate: number; // 수익률
  amount: string; // 금액
  group: "배당" | "성장";
};
export const TREEMAP_DATA: TreemapItem[] = [
  { name: "JEPI", value: 14, rate: 12.4, amount: "₩ 84.2M", group: "배당" },
  { name: "SCHD", value: 11, rate: 18.7, amount: "₩ 66.1M", group: "배당" },
  { name: "리얼티인컴", value: 8, rate: 9.3, amount: "₩ 48.5M", group: "배당" },
  { name: "JPST", value: 6, rate: 4.1, amount: "₩ 35.8M", group: "배당" },
  { name: "SPYD", value: 5, rate: 7.6, amount: "₩ 29.2M", group: "배당" },
  { name: "O", value: 4, rate: -2.4, amount: "₩ 22.7M", group: "배당" },
  { name: "VYM", value: 4, rate: 11.2, amount: "₩ 21.4M", group: "배당" },
  { name: "KODEX배당", value: 3, rate: 5.8, amount: "₩ 18.0M", group: "배당" },
  { name: "NVDA", value: 9, rate: 142.3, amount: "₩ 54.6M", group: "성장" },
  { name: "삼성전자", value: 8, rate: 24.5, amount: "₩ 47.1M", group: "성장" },
  { name: "AAPL", value: 6, rate: 31.8, amount: "₩ 38.0M", group: "성장" },
  { name: "MSFT", value: 5, rate: 27.4, amount: "₩ 30.5M", group: "성장" },
  { name: "TSLA", value: 4, rate: -8.2, amount: "₩ 24.0M", group: "성장" },
  { name: "QQQ", value: 3, rate: 19.6, amount: "₩ 16.2M", group: "성장" },
];

export const PERIOD_BUTTONS = ["1분", "3분", "5분", "10분", "수동"];

// =============================================================
// 다크 대시보드(메인 /) 전용 데이터
// =============================================================

// 계좌별 비중 (다크)
export const ACCOUNT_ALLOCATION_DARK: Slice[] = [
  { name: "미국주식", value: 40.9, color: "#2563eb" },
  { name: "연금저축", value: 21.1, color: "#a855f7" },
  { name: "ISA", value: 11.8, color: "#f59e0b" },
  { name: "국내주식", value: 10.4, color: "#22c55e" },
  { name: "일본주식", value: 9.7, color: "#14b8a6" },
  { name: "퇴직연금", value: 4.1, color: "#ec4899" },
  { name: "현금", value: 2.0, color: "#94a3b8" },
];

// 종목별 비중 상위 15개 (다크, ETF 중심)
export const STOCK_ALLOCATION_DARK: Slice[] = [
  { name: "Schwab US Dividend Equity ETF", value: 23.7, color: "#2563eb" },
  { name: "SOL 미국배당다우존스", value: 16.2, color: "#22c55e" },
  { name: "Invesco QQQ Trust", value: 9.8, color: "#f59e0b" },
  { name: "ISHARES S&P 500", value: 9.1, color: "#a855f7" },
  { name: "TIGER 미국배당다우존스", value: 8.9, color: "#ec4899" },
  { name: "KODEX 머니마켓액티브", value: 3.1, color: "#14b8a6" },
  { name: "KODEX 미국나스닥100TR", value: 2.7, color: "#ef4444" },
  { name: "TIME 미국나스닥100", value: 2.5, color: "#f97316" },
  { name: "RISE 200위클리커버드콜", value: 2.3, color: "#06b6d4" },
  { name: "Invesco 미국 나스닥", value: 2.2, color: "#84cc16" },
  { name: "ProShares Ultra", value: 2.1, color: "#6366f1" },
  { name: "SOL 코리아고배당", value: 2.0, color: "#d946ef" },
  { name: "KODEX 금융고배당TOP10", value: 1.7, color: "#0ea5e9" },
  { name: "iShares 0-3 Month", value: 1.6, color: "#eab308" },
  { name: "기타", value: 10.5, color: "#64748b" },
];

// 월별 소득 (다크, 연도별 그룹 막대)
export type MonthlyIncomeDark = {
  month: string;
  y2021: number;
  y2022: number;
  y2023: number;
  y2024: number;
  y2025: number;
  y2026: number;
  y2026e: number;
  rent: number;
};

function buildMonthlyIncomeDark(): MonthlyIncomeDark[] {
  const months = [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const base = [0.5, 0.6, 1.4, 0.7, 1.1, 1.6, 0.8, 1.0, 1.5, 0.9, 1.1, 1.8];
  return months.map((m, i) => {
    const f = base[i];
    const mk = (mult: number) => Math.round((f * mult + rnd() * 0.2) * 1000000);
    return {
      month: m,
      y2021: mk(0.35),
      y2022: mk(0.5),
      y2023: mk(0.7),
      y2024: mk(0.9),
      y2025: mk(1.15),
      y2026: i <= 4 ? mk(1.35) : 0,
      y2026e: i > 4 ? mk(1.35) : 0,
      rent: 1660000,
    };
  });
}
export const MONTHLY_INCOME_DARK: MonthlyIncomeDark[] =
  buildMonthlyIncomeDark();

export const MONTHLY_INCOME_SERIES: {
  key: string;
  label: string;
  color: string;
}[] = [
  { key: "y2021", label: "2021배당", color: "#fde68a" },
  { key: "y2022", label: "2022배당", color: "#fcd34d" },
  { key: "y2023", label: "2023배당", color: "#fbbf24" },
  { key: "y2024", label: "2024배당", color: "#f59e0b" },
  { key: "y2025", label: "2025배당", color: "#fb923c" },
  { key: "y2026", label: "2026배당", color: "#3b82f6" },
  { key: "y2026e", label: "2026(예상)", color: "#93c5fd" },
  { key: "rent", label: "임대", color: "#22c55e" },
];

// 우측 연간 소득 도넛
export const ANNUAL_INCOME_TOTAL_DONUT = 29566127;
export const ANNUAL_INCOME_BREAKDOWN: Slice[] = [
  { name: "Schwab US Dividend Equity ETF", value: 31, color: "#3b82f6" },
  { name: "ProShares Ultra Bitcoin ETF", value: 22, color: "#22c55e" },
  { name: "SOL 미국배당다우존스", value: 18, color: "#f59e0b" },
  { name: "KODEX 금융고배당TOP10", value: 12, color: "#a855f7" },
  { name: "TIGER 미국배당다우존스", value: 9, color: "#ec4899" },
  { name: "기타", value: 8, color: "#64748b" },
];
