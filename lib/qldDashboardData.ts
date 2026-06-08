// =============================================================
// QLD 대시보드 전용 MOCK 데이터. 컴포넌트는 전부 이 파일에서 가져온다.
// 외부 API 호출 없음. 모든 수치는 스크린샷 기반 mock.
// 결정론적(deterministic) 데이터만 사용해 SSR/CSR hydration 불일치를 방지한다.
// =============================================================

// --- 종목/항목 색상 팔레트 (스크린샷 색감 기준) ---
export const QLD_COLORS = {
  qld: "#5b7cff", // 메인 블루
  t418660: "#10c7bd", // teal
  t381170: "#9b7cf6", // purple
  t0008S0: "#fb923c", // orange
  t490590: "#34d399", // emerald
  t491620: "#fb4668", // rose
  krwCash: "#64748b", // slate (원화예수금)
  tqqq: "#38bdf8", // sky
  schd: "#f5b945", // amber
  usdCash: "#94a3b8", // gray (달러예수금)
  fxLine: "#8b93b8", // 보조 환율 라인
} as const;

// --- 상단 요약(헤드라인) 수치 ---
export const QLD_SUMMARY = {
  totalValue: 1_072_010_070,
  dayChange: 12_654_487,
  dayChangeRate: 1.19,
  high: 1_076_911_793,
  low: 1_059_355_583,
  mdd: -1.28,
  currentOverHigh: 99.54,
  currentOverLow: 101.19,
  highAt: "06/05 11:00",
  lowAt: "06/04 23:00",
  mddRange: "06/04 22:31 → 06/04 23:00",
  mddAmount: -13_773_709,
} as const;

// --- 보유 종목 (왼쪽 카드 / 자산 구성) ---
export type QldHolding = {
  ticker: string;
  name: string;
  color: string;
  weight: number; // %
  value: number; // 평가금액(원)
};

export const QLD_HOLDINGS: QldHolding[] = [
  { ticker: "QLD", name: "ProShares Ultra QQQ ETF", color: QLD_COLORS.qld, weight: 48.3, value: 516_338_894 },
  { ticker: "418660", name: "TIGER 미국나스닥100레버리지(합성)", color: QLD_COLORS.t418660, weight: 21.6, value: 230_609_610 },
  { ticker: "381170", name: "TIGER 미국테크TOP10 INDXX", color: QLD_COLORS.t381170, weight: 11.5, value: 123_125_520 },
  { ticker: "0008S0", name: "TIGER 미국배당다우존스타겟데일리커버드콜", color: QLD_COLORS.t0008S0, weight: 6.6, value: 70_957_875 },
  { ticker: "490590", name: "RISE 미국AI밸류체인데일리고정커버드콜", color: QLD_COLORS.t490590, weight: 5.2, value: 55_872_430 },
  { ticker: "491620", name: "RISE 미국테크100데일리고정커버드콜", color: QLD_COLORS.t491620, weight: 4.1, value: 43_570_430 },
  { ticker: "원화예수금", name: "원화 예수금", color: QLD_COLORS.krwCash, weight: 1.2, value: 12_766_000 },
  { ticker: "TQQQ", name: "ProShares UltraPro QQQ", color: QLD_COLORS.tqqq, weight: 0.8, value: 8_664_404 },
  { ticker: "SCHD", name: "Schwab US Dividend Equity ETF", color: QLD_COLORS.schd, weight: 0.7, value: 7_630_995 },
  { ticker: "달러예수금", name: "달러 예수금", color: QLD_COLORS.usdCash, weight: 0.0, value: 57_506 },
];

// --- 평가금액 / 환율 복합 차트 시계열 ---
export type QldValueFxPoint = {
  label: string; // x축 라벨
  value: number; // 총 평가금액
  fx: number; // 환율(USD/KRW)
};

// 결정론적 piecewise 선형 보간으로 32개 스냅샷 시계열 생성
function buildValueFxSeries(): QldValueFxPoint[] {
  const N = 33;
  // [index, value] keypoints
  const valueKeys: Array<[number, number]> = [
    [0, 1_068_000_000],
    [5, 1_073_128_000], // MDD 시작
    [7, 1_059_355_583], // 저점
    [12, 1_067_200_000],
    [18, 1_071_500_000],
    [24, 1_076_911_793], // 고점
    [28, 1_073_200_000],
    [32, 1_072_010_070], // 현재
  ];
  const fxKeys: Array<[number, number]> = [
    [0, 1546],
    [8, 1531],
    [16, 1539],
    [24, 1548],
    [32, 1541],
  ];

  const interp = (keys: Array<[number, number]>, i: number): number => {
    for (let k = 0; k < keys.length - 1; k++) {
      const [x0, y0] = keys[k];
      const [x1, y1] = keys[k + 1];
      if (i >= x0 && i <= x1) {
        const ratio = x1 === x0 ? 0 : (i - x0) / (x1 - x0);
        return y0 + (y1 - y0) * ratio;
      }
    }
    return keys[keys.length - 1][1];
  };

  // 06/04 22:00 시작, 30분 간격 라벨
  const startHour = 22;
  const startDay = 4;
  const series: QldValueFxPoint[] = [];
  for (let i = 0; i < N; i++) {
    const totalMin = startHour * 60 + i * 30;
    const dayOffset = Math.floor(totalMin / (24 * 60));
    const dayMin = totalMin % (24 * 60);
    const hh = Math.floor(dayMin / 60);
    const mm = dayMin % 60;
    const day = startDay + dayOffset;
    const label = `06/${String(day).padStart(2, "0")} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    series.push({
      label,
      value: Math.round(interp(valueKeys, i)),
      fx: Math.round(interp(fxKeys, i) * 100) / 100,
    });
  }
  return series;
}

export const QLD_VALUE_FX_SERIES: QldValueFxPoint[] = buildValueFxSeries();

// 차트 annotation 위치(인덱스 → 라벨)
export const QLD_CHART_ANNOTATIONS = {
  mddStartIndex: 5,
  lowIndex: 7,
  highIndex: 24,
} as const;

// 기간 버튼
export const QLD_PERIOD_BUTTONS = [
  "1일",
  "7일",
  "1개월",
  "6개월",
  "연중",
  "1년",
  "5년",
  "최대",
  "32개 스냅샷",
] as const;

// --- 계좌별 평가금액 (stacked bar) ---
// 각 계좌의 종목별 보유액(원). 차트는 ticker 키별로 stack.
export type QldAccountRow = {
  account: string;
} & Record<string, number | string>;

// stack에 사용할 종목 키 + 색상 + 표시명
export type QldStackKey = {
  key: string;
  color: string;
  label: string;
};

export const QLD_ACCOUNT_STACK_KEYS: QldStackKey[] = [
  { key: "QLD", color: QLD_COLORS.qld, label: "QLD" },
  { key: "418660", color: QLD_COLORS.t418660, label: "418660" },
  { key: "381170", color: QLD_COLORS.t381170, label: "381170" },
  { key: "0008S0", color: QLD_COLORS.t0008S0, label: "0008S0" },
  { key: "490590", color: QLD_COLORS.t490590, label: "490590" },
  { key: "491620", color: QLD_COLORS.t491620, label: "491620" },
  { key: "원화예수금", color: QLD_COLORS.krwCash, label: "원화예수금" },
  { key: "TQQQ", color: QLD_COLORS.tqqq, label: "TQQQ" },
  { key: "SCHD", color: QLD_COLORS.schd, label: "SCHD" },
  { key: "달러예수금", color: QLD_COLORS.usdCash, label: "달러예수금" },
];

export const QLD_ACCOUNT_ROWS: QldAccountRow[] = [
  { account: "위탁계좌", QLD: 430_000_000, "418660": 80_000_000, 원화예수금: 10_000_000, 달러예수금: 57_506 },
  { account: "연금계좌", "381170": 50_000_000, "0008S0": 20_000_000, "490590": 15_000_000 },
  { account: "연금계좌2", "490590": 25_000_000, "491620": 10_000_000 },
  { account: "퇴직연금", "0008S0": 15_000_000, SCHD: 5_000_000 },
  { account: "ISA1", "418660": 90_000_000, QLD: 50_000_000, "490590": 15_000_000 },
  { account: "ISA2", "381170": 60_000_000, "491620": 20_000_000 },
  { account: "비과세1", "0008S0": 35_000_000, TQQQ: 8_000_000 },
  { account: "ISA3", "491620": 13_000_000, QLD: 12_000_000 },
  { account: "비과세2", QLD: 30_000_000, SCHD: 2_630_995 },
];

// --- 종목 랭킹 테이블 (Top 8) ---
export type QldRankRow = {
  ticker: string;
  name: string;
  color: string;
  avgPrice: string; // 평균 매수가 (통화 혼용이라 문자열로 보관)
  weight: number; // 비중 %
  value: number; // 평가금액
  dayProfit: number; // 전일대비 수익금
  dayProfitRate: number; // 전일대비 수익률 %
  cumProfit: number; // 누적 수익금
  cumProfitRate: number; // 누적 수익률 %
};

export const QLD_RANK_ROWS: QldRankRow[] = [
  { ticker: "QLD", name: "ProShares Ultra QQQ ETF", color: QLD_COLORS.qld, avgPrice: "$38.81", weight: 48.27, value: 516_338_894, dayProfit: -1_775_976, dayProfitRate: -0.34, cumProfit: 343_338_452, cumProfitRate: 198.46 },
  { ticker: "418660", name: "TIGER 미국나스닥100레버리지(합성)", color: QLD_COLORS.t418660, avgPrice: "34,433", weight: 21.56, value: 230_609_610, dayProfit: -2_416_470, dayProfitRate: -1.04, cumProfit: 80_687_412, cumProfitRate: 53.82 },
  { ticker: "381170", name: "TIGER 미국테크TOP10 INDXX", color: QLD_COLORS.t381170, avgPrice: "30,630", weight: 11.51, value: 123_125_520, dayProfit: 688_740, dayProfitRate: 0.56, cumProfit: 14_939_729, cumProfitRate: 13.81 },
  { ticker: "0008S0", name: "TIGER 미국배당다우존스타겟데일리커버드콜", color: QLD_COLORS.t0008S0, avgPrice: "8,873", weight: 6.63, value: 70_957_875, dayProfit: 1_016_025, dayProfitRate: 1.45, cumProfit: 12_795_360, cumProfitRate: 22.0 },
  { ticker: "490590", name: "RISE 미국AI밸류체인데일리고정커버드콜", color: QLD_COLORS.t490590, avgPrice: "12,764", weight: 5.22, value: 55_872_430, dayProfit: 46_470, dayProfitRate: 0.08, cumProfit: 16_329_558, cumProfitRate: 41.3 },
  { ticker: "491620", name: "RISE 미국테크100데일리고정커버드콜", color: QLD_COLORS.t491620, avgPrice: "12,369", weight: 4.07, value: 43_570_430, dayProfit: 281_440, dayProfitRate: 0.65, cumProfit: 56_288, cumProfitRate: 0.13 },
  { ticker: "원화예수금", name: "원화 예수금", color: QLD_COLORS.krwCash, avgPrice: "1", weight: 1.19, value: 12_766_000, dayProfit: 0, dayProfitRate: 0.0, cumProfit: 0, cumProfitRate: 0.0 },
  { ticker: "TQQQ", name: "ProShares UltraPro QQQ", color: QLD_COLORS.tqqq, avgPrice: "$72.80", weight: 0.81, value: 8_664_404, dayProfit: -79_967, dayProfitRate: -0.91, cumProfit: 2_336_736, cumProfitRate: 36.93 },
];

// --- 월간 배당금 (stacked bar, 2026) ---
export type QldMonthlyDividendRow = {
  month: string;
} & Record<string, number | string>;

export const QLD_DIVIDEND_STACK_KEYS: QldStackKey[] = [
  { key: "0008S0", color: QLD_COLORS.t0008S0, label: "0008S0 TIGER 미국배당다우존스타겟..." },
  { key: "490590", color: QLD_COLORS.t490590, label: "490590 RISE 미국AI밸류체인데일리고정..." },
  { key: "491620", color: QLD_COLORS.t491620, label: "491620 RISE 미국테크100데일리고정커..." },
  { key: "381170", color: QLD_COLORS.t381170, label: "381170 TIGER 미국테크TOP10 INDXX" },
  { key: "QLD", color: QLD_COLORS.qld, label: "QLD ProShares Ultra QQQ ETF" },
  { key: "SCHD", color: QLD_COLORS.schd, label: "SCHD Schwab US Dividend Equity ETF" },
];

export const QLD_MONTHLY_DIVIDENDS: QldMonthlyDividendRow[] = [
  { month: "1월", "0008S0": 500_000, "490590": 350_000, "491620": 180_000, "381170": 60_000, QLD: 40_000, SCHD: 20_000 },
  { month: "2월", "0008S0": 420_000, "490590": 300_000, "491620": 130_000, "381170": 40_000, QLD: 20_000, SCHD: 10_000 },
  { month: "3월", "0008S0": 520_000, "490590": 380_000, "491620": 200_000, "381170": 90_000, QLD: 70_000, SCHD: 40_000 },
  { month: "4월", "0008S0": 600_000, "490590": 430_000, "491620": 230_000, "381170": 110_000, QLD: 90_000, SCHD: 60_000 },
  { month: "5월", "0008S0": 760_000, "490590": 560_000, "491620": 320_000, "381170": 160_000, QLD: 120_000, SCHD: 60_000 },
  { month: "6월", "0008S0": 560_000, "490590": 410_000, "491620": 230_000, "381170": 120_000, QLD: 71_799, SCHD: 40_000 },
  { month: "7월" },
  { month: "8월" },
  { month: "9월" },
  { month: "10월" },
  { month: "11월" },
  { month: "12월" },
];

export const QLD_DIVIDEND_SUMMARY = {
  year: "2026년",
  yearOptions: ["2026년", "2025년", "2024년"],
  total: 8_301_799,
  annualEstimate: 17_520_168,
} as const;
