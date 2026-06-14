// =============================================================
// 포트폴리오 공통 데이터 타입.
// 포트폴리오 관리(엑셀 업로드) → store → 배당/워치리스트/시장/전체종목/QLD 에서 공유한다.
// 백엔드는 아직 없음. 우선 localStorage 기반으로 동작한다.
// =============================================================

// 티커 추정 신뢰도. "none"/"low" 는 "확인 필요" 로 취급한다.
export type TickerConfidence = "high" | "medium" | "low" | "none";

// 자산 분류 (3.재무현황 자산 표 기준)
export type AssetCategory = "현금" | "예적금" | "투자성" | "기타";

// 보유 종목 (5.투자현황 한 줄에 대응)
export interface Holding {
  id: string;
  broker: string; // 금융사
  accountName?: string; // 계좌명 (옵션)
  assetType: string; // 투자상품종류 (주식/펀드 등)
  productName: string; // 상품명 (원본)
  cleanName?: string; // 태그를 제거한 표시명
  ticker?: string; // 명시/추정 티커 (대문자). 현금성 행은 파서가 새 티커를 추정하지 않는다.
  tag?: string; // 상품명에서 추출한 #태그
  principalKRW: number; // 투자원금
  valueKRW: number; // 평가금액
  returnPct?: number; // 수익률(%)
  quantity?: number; // 수량 (옵션)
  averagePrice?: number; // 평단/평균매입가 (옵션)
  currency?: string; // 통화 (옵션)
  currentPrice?: number; // 현재가/평가단가 (옵션)
  valueOriginalCurrency?: number; // 원통화 평가금액 (옵션)
  category?: string; // 분류 (옵션)
  symbolGroup?: string; // ①종목 태그 그룹
  accountGroup?: string; // ②계좌 태그 그룹
  purposeGroup?: string; // ③목적 태그 그룹
  statusGroup?: string; // ④현황 태그 그룹
  parsedTags?: import("./portfolio-tags").PortfolioTags;
  // --- 파서 보조 필드 (Codex 가 로직 이어붙이기 쉽게 분리) ---
  tickerConfidence?: TickerConfidence;
  needsReview?: boolean; // 확인 필요 여부
  joinDate?: string; // 가입일자 (YYYY-MM-DD)
  maturityDate?: string; // 만기일자 (YYYY-MM-DD)
}

// 자산/부채 (3.재무현황 표에 대응)
export interface FinanceAsset {
  id: string;
  groupName: string; // 자산 영역 (예: 자유입출금 자산)
  productName: string; // 상품명
  cleanName?: string; // 태그를 제거한 표시명
  amountKRW: number; // 금액
  inferredTag?: string; // 상품명에서 추출한 태그 (#현금, #예적금 등)
  category?: AssetCategory; // 현금/예적금/투자성/기타
  isDebt?: boolean; // 부채 영역 여부
  symbolGroup?: string; // ①종목 태그 그룹
  accountGroup?: string; // ②계좌 태그 그룹
  purposeGroup?: string; // ③목적 태그 그룹
  statusGroup?: string; // ④현황 태그 그룹
  parsedTags?: import("./portfolio-tags").PortfolioTags;
}

// 한 시점의 포트폴리오 스냅샷 (엑셀 1개 = 스냅샷 1개)
export interface PortfolioSnapshot {
  id: string;
  snapshotDate: string; // YYYY-MM-DD (파일명 뒤쪽 날짜 우선)
  sourceFileName: string;
  totalAssetKRW: number; // 총 금융자산
  totalDebtKRW: number; // 총 부채
  netAssetKRW: number; // 순자산
  investmentPrincipalKRW: number; // 투자원금 합계
  investmentValueKRW: number; // 평가금액 합계
  returnAmountKRW: number; // 수익금
  returnPct: number; // 수익률(%)
  holdings: Holding[];
  financeAssets: FinanceAsset[];
  createdAt: string; // ISO
  metadata?: {
    parserVersion: string;
    excludedSmallCount: number;
    excludedBelowMinimumCount: number;
    excludedHoldingValueKRW: number;
    liveViewVersion?: string;
  };
}

// store 요약 (getPortfolioSummary 반환)
export interface PortfolioSummary {
  snapshotDate: string | null;
  totalAssetKRW: number;
  totalDebtKRW: number;
  netAssetKRW: number;
  investmentPrincipalKRW: number;
  investmentValueKRW: number;
  returnAmountKRW: number;
  returnPct: number;
  holdingCount: number;
}

// 스냅샷 히스토리 행 (등록된 스냅샷 히스토리 / 성과 그래프용)
export interface SnapshotHistoryRow {
  id: string;
  snapshotDate: string;
  totalAssetKRW: number;
  investmentValueKRW: number;
  investmentPrincipalKRW: number;
  returnPct: number;
}
