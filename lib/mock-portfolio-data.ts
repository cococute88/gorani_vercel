// =============================================================
// 포트폴리오 목업 데이터.
// store 가 비어있을 때 화면이 "빈 껍데기"로 보이지 않도록 폴백으로 사용.
// 첨부 엑셀(뤅샐러드) 구조를 단순화한 예시 값이다.
// =============================================================
import type {
  FinanceAsset,
  Holding,
  PortfolioSnapshot,
} from "./portfolio-types";

let seq = 0;
function mid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

interface BaseHolding {
  broker: string;
  assetType: string;
  productName: string;
  ticker: string;
  principalKRW: number;
  valueKRW: number;
  returnPct: number;
  tag?: string;
}

// 최신 시점 기준 보유종목 (예시)
const BASE_HOLDINGS: BaseHolding[] = [
  { broker: "키움증권", assetType: "해외주식", productName: "#tqqq", ticker: "TQQQ", principalKRW: 66_608_000, valueKRW: 211_973_000, returnPct: 218.2, tag: "tqqq" },
  { broker: "키움증권", assetType: "해외주식", productName: "#qld", ticker: "QLD", principalKRW: 12_798_000, valueKRW: 40_690_000, returnPct: 217.9, tag: "qld" },
  { broker: "미래에셋증권", assetType: "해외주식", productName: "#qqq", ticker: "QQQ", principalKRW: 47_212_000, valueKRW: 65_342_000, returnPct: 38.4, tag: "qqq" },
  { broker: "미래에셋증권", assetType: "해외주식", productName: "#spy", ticker: "SPY", principalKRW: 59_712_000, valueKRW: 74_374_000, returnPct: 24.6, tag: "spy" },
  { broker: "삼성증권", assetType: "해외주식", productName: "SCHD #schd", ticker: "SCHD", principalKRW: 13_231_000, valueKRW: 16_029_000, returnPct: 21.1, tag: "schd" },
  { broker: "키움증권", assetType: "해외주식", productName: "마이크로소프트 #msft", ticker: "MSFT", principalKRW: 9_477_000, valueKRW: 12_903_000, returnPct: 36.1, tag: "msft" },
  { broker: "미래에셋증권", assetType: "해외주식", productName: "알파벳 #googl", ticker: "GOOGL", principalKRW: 7_408_000, valueKRW: 15_581_000, returnPct: 110.3, tag: "googl" },
  { broker: "메리츠증권", assetType: "해외채권", productName: "ISHARES 0-3M TREASURY BOND", ticker: "CASH_LIKE", principalKRW: 69_282_000, valueKRW: 69_390_000, returnPct: 0.15 },
];

const BASE_FINANCE: Omit<FinanceAsset, "id">[] = [
  { groupName: "자유입출금 자산", productName: "KB able Plus통장 #현금", amountKRW: 532_695, inferredTag: "현금", category: "현금" },
  { groupName: "자유입출금 자산", productName: "모니모 매일이자 #현금", amountKRW: 1_416_217, inferredTag: "현금", category: "현금" },
  { groupName: "저축성 자산", productName: "정기적금 #예적금", amountKRW: 15_000_000, inferredTag: "예적금", category: "예적금" },
  { groupName: "저축성 자산", productName: "청년플랜적금 #예적금", amountKRW: 6_000_000, inferredTag: "예적금", category: "예적금" },
  { groupName: "전자금융 자산", productName: "토스머니", amountKRW: 1_250_000, category: "현금" },
];

function buildSnapshot(
  snapshotDate: string,
  valueFactor: number,
  principalFactor: number,
): PortfolioSnapshot {
  const holdings: Holding[] = BASE_HOLDINGS.map((b) => {
    const principalKRW = Math.round(b.principalKRW * principalFactor);
    const valueKRW = Math.round(b.valueKRW * valueFactor);
    const returnPct = principalKRW > 0 ? ((valueKRW - principalKRW) / principalKRW) * 100 : 0;
    return {
      id: mid("h"),
      broker: b.broker,
      assetType: b.assetType,
      productName: b.productName,
      ticker: b.ticker,
      tag: b.tag,
      principalKRW,
      valueKRW,
      returnPct: Math.round(returnPct * 10) / 10,
      tickerConfidence: "high",
      needsReview: false,
    };
  });

  const financeAssets: FinanceAsset[] = BASE_FINANCE.map((f) => ({ id: mid("f"), ...f }));

  const investmentPrincipalKRW = holdings.reduce((s, h) => s + h.principalKRW, 0);
  const investmentValueKRW = holdings.reduce((s, h) => s + h.valueKRW, 0);
  const financeTotal = financeAssets.reduce((s, f) => s + f.amountKRW, 0);
  const totalAssetKRW = investmentValueKRW + financeTotal;
  const returnAmountKRW = investmentValueKRW - investmentPrincipalKRW;
  const returnPct = investmentPrincipalKRW > 0 ? (returnAmountKRW / investmentPrincipalKRW) * 100 : 0;

  return {
    id: mid("snap"),
    snapshotDate,
    sourceFileName: `mock-${snapshotDate}.xlsx`,
    totalAssetKRW,
    totalDebtKRW: 0,
    netAssetKRW: totalAssetKRW,
    investmentPrincipalKRW,
    investmentValueKRW,
    returnAmountKRW,
    returnPct: Math.round(returnPct * 10) / 10,
    holdings,
    financeAssets,
    createdAt: new Date().toISOString(),
  };
}

// 누적 추이를 보여주기 위한 3개 시점
export const MOCK_SNAPSHOTS: PortfolioSnapshot[] = [
  buildSnapshot("2024-12-28", 0.62, 0.78),
  buildSnapshot("2025-05-31", 0.82, 0.9),
  buildSnapshot("2026-05-31", 1, 1),
];

// 최신 시점 보유종목 (store 가 비었을 때 폴백용)
export const MOCK_HOLDINGS: Holding[] = MOCK_SNAPSHOTS[MOCK_SNAPSHOTS.length - 1].holdings;
export const MOCK_FINANCE_ASSETS: FinanceAsset[] =
  MOCK_SNAPSHOTS[MOCK_SNAPSHOTS.length - 1].financeAssets;
export const MOCK_LATEST_SNAPSHOT: PortfolioSnapshot =
  MOCK_SNAPSHOTS[MOCK_SNAPSHOTS.length - 1];
