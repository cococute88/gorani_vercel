export const dividendCaptureInput = {
  ticker: "SCHD",
  shares: 120,
  dividendPerShare: 0.824,
  taxRate: 15.4,
  expectedDropPct: 0.82,
  currentPrice: 78.4,
};

export const dividendCaptureMetrics = [
  { label: "예상 배당금", value: "$98.88", sub: "120주 × $0.824", tone: "blue" as const },
  { label: "세후 배당금", value: "$83.65", sub: "배당세 15.4% 가정", tone: "green" as const },
  { label: "예상 배당락", value: "-$0.64", sub: "현재가 대비 -0.82%", tone: "orange" as const },
  { label: "회복 필요 수익률", value: "+0.83%", sub: "배당락 회복 기준", tone: "gray" as const },
  { label: "최근 성공률", value: "67%", sub: "최근 12회 mock", tone: "green" as const },
  { label: "손익분기 가격", value: "$77.70", sub: "세후 배당 반영", tone: "blue" as const },
];

export const dividendCaptureScatter = [
  { round: "23.03", recoveryDays: 5, profitPct: 0.7, result: "성공" },
  { round: "23.06", recoveryDays: 9, profitPct: 0.2, result: "성공" },
  { round: "23.09", recoveryDays: 18, profitPct: -0.4, result: "실패" },
  { round: "23.12", recoveryDays: 7, profitPct: 0.5, result: "성공" },
  { round: "24.03", recoveryDays: 22, profitPct: -0.8, result: "실패" },
  { round: "24.06", recoveryDays: 6, profitPct: 0.9, result: "성공" },
  { round: "24.09", recoveryDays: 14, profitPct: 0.1, result: "성공" },
  { round: "24.12", recoveryDays: 20, profitPct: -0.3, result: "실패" },
  { round: "25.03", recoveryDays: 8, profitPct: 0.4, result: "성공" },
  { round: "25.06", recoveryDays: 11, profitPct: 0.3, result: "성공" },
  { round: "25.09", recoveryDays: 16, profitPct: -0.1, result: "실패" },
  { round: "25.12", recoveryDays: 4, profitPct: 1.1, result: "성공" },
];

export const dividendCaptureRows = dividendCaptureScatter.map((row, index) => ({
  ...row,
  exDate: `20${row.round.replace(".", "-")}-21`,
  dividend: index % 3 === 0 ? "$0.88" : "$0.82",
  breakeven: row.result === "성공" ? "달성" : "미달",
}));

export const conversionInput = {
  sellTicker: "QLD",
  buyTicker: "SCHD",
  sellShares: 40,
  sellPrice: 105.4,
  buyPrice: 78.4,
};

export const conversionMetrics = [
  { label: "현재 전환비", value: "1.34x", sub: "QLD 1주 → SCHD 1.34주", tone: "blue" as const },
  { label: "평균 전환비", value: "1.28x", sub: "최근 12개월 mock 평균", tone: "gray" as const },
  { label: "평균 대비 괴리율", value: "+4.7%", sub: "전환 매력도 보통", tone: "green" as const },
  { label: "예상 매수 가능 수량", value: "53주", sub: "매도금액 $4,216 기준", tone: "orange" as const },
];

export const conversionSeries = [
  { month: "1월", ratio: 1.16, average: 1.28 },
  { month: "2월", ratio: 1.18, average: 1.28 },
  { month: "3월", ratio: 1.22, average: 1.28 },
  { month: "4월", ratio: 1.26, average: 1.28 },
  { month: "5월", ratio: 1.31, average: 1.28 },
  { month: "6월", ratio: 1.29, average: 1.28 },
  { month: "7월", ratio: 1.25, average: 1.28 },
  { month: "8월", ratio: 1.27, average: 1.28 },
  { month: "9월", ratio: 1.33, average: 1.28 },
  { month: "10월", ratio: 1.36, average: 1.28 },
  { month: "11월", ratio: 1.32, average: 1.28 },
  { month: "12월", ratio: 1.34, average: 1.28 },
];

export const conversionRows = conversionSeries.map((row) => ({
  month: row.month,
  sellPrice: `$${(99 + row.ratio * 4).toFixed(1)}`,
  buyPrice: `$${(78 + (row.ratio - 1.28) * 6).toFixed(1)}`,
  ratio: `${row.ratio.toFixed(2)}x`,
  signal: row.ratio >= row.average ? "전환 우위" : "대기",
}));

export const mddInput = {
  ticker: "QQQ",
  currentPrice: 485.2,
  high52w: 512.8,
  low52w: 417.6,
};

export const mddMetrics = [
  { label: "현재가", value: "$485.20", sub: "mock 기준가", tone: "blue" as const },
  { label: "52주 최고가", value: "$512.80", sub: "2026-05-14", tone: "green" as const },
  { label: "현재 낙폭", value: "-5.4%", sub: "52주 고점 대비", tone: "orange" as const },
  { label: "최대 낙폭 MDD", value: "-18.6%", sub: "최근 1년 mock", tone: "gray" as const },
  { label: "고점일", value: "2026-05-14", sub: "계산 기준 고점", tone: "blue" as const },
  { label: "저점일", value: "2026-02-21", sub: "MDD 구간 저점", tone: "orange" as const },
];

export const mddSeries = [
  { date: "1월", drawdown: -4.2 },
  { date: "2월", drawdown: -18.6 },
  { date: "3월", drawdown: -13.4 },
  { date: "4월", drawdown: -8.8 },
  { date: "5월", drawdown: -1.2 },
  { date: "6월", drawdown: -5.4 },
  { date: "7월", drawdown: -7.1 },
  { date: "8월", drawdown: -3.9 },
  { date: "9월", drawdown: -10.6 },
  { date: "10월", drawdown: -6.8 },
  { date: "11월", drawdown: -2.4 },
  { date: "12월", drawdown: -5.4 },
];

export const mddRows = [
  { period: "2026-01 ~ 2026-02", highDate: "2026-01-08", lowDate: "2026-02-21", mdd: "-18.6%", recovery: "42일" },
  { period: "2026-03 ~ 2026-04", highDate: "2026-03-11", lowDate: "2026-04-06", mdd: "-9.8%", recovery: "18일" },
  { period: "2026-06 ~ 2026-09", highDate: "2026-06-03", lowDate: "2026-09-17", mdd: "-10.6%", recovery: "31일" },
  { period: "2026-10 ~ 2026-12", highDate: "2026-10-22", lowDate: "2026-12-04", mdd: "-6.8%", recovery: "진행중" },
];
