// =============================================================
// 구성종목 기여도 분해.
//
// total-return.ts 의 선형 인덱스 분해를 그대로 사용한다.
//   trPct = commonContribPct + uniqueContribPct  (정확히 가산적)
//
//   I(T)      = 1 + trPct/100          (ETF 원본 TR 인덱스)
//   uniqueIdx = 1 + trExPct/100        (중복 제거 인덱스)
//   uniqueContribPct = (1 − wFund) · trExPct
//   commonContribPct = trPct − uniqueContribPct
//
// 한계: top-holdings fixture(상위 보유 비중표)와 선형 분해 가정에 의존하므로
// 리밸런싱·복리 교차항은 무시한다. 정확한 귀속이 아니라 "이해를 돕는 근사"다.
// =============================================================

import type { ContributionBreakdown } from "@/lib/stock-compare/types";

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

export function computeContribution(args: {
  trPct: number | null;
  trExPct: number | null;
  wFund: number; // 펀드 내 공통 종목 비중(0~1)
  available: boolean;
}): ContributionBreakdown {
  const { trPct, trExPct, wFund, available } = args;

  if (!available || trPct == null || trExPct == null || !(wFund > 0 && wFund < 1)) {
    return {
      available: false,
      trPct,
      commonWeightPct: round(wFund * 100),
      uniqueWeightPct: round((1 - wFund) * 100),
      commonContribPct: null,
      uniqueContribPct: null,
    };
  }

  const uniqueContribPct = round((1 - wFund) * trExPct);
  const commonContribPct = round(trPct - uniqueContribPct);

  return {
    available: true,
    trPct: round(trPct),
    commonWeightPct: round(wFund * 100),
    uniqueWeightPct: round((1 - wFund) * 100),
    commonContribPct,
    uniqueContribPct,
  };
}
