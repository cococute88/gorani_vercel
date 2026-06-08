// =============================================================
// 상품명 → 티커 추정 (초안).
// 1) 상품명에 #tqqq, #qld 처럼 해시태그가 있으면 티커로 우선 인식
// 2) 없으면 매핑 사전(키워드)으로 추정
// 3) 신뢰도가 낮으면 "확인 필요" 로 표시되도록 confidence 를 낮게 반환
// TODO(codex): 정식 심볼 마스터/검색 API 로 교체.
// =============================================================
import type { TickerConfidence } from "./portfolio-types";

export interface TickerGuess {
  ticker: string | null;
  confidence: TickerConfidence;
  matchedBy: "hashtag" | "exact" | "keyword" | "cash" | "none";
}

// 정확 토큰 매칭용 (상품명 전체가 티커일 때)
const KNOWN_TICKERS = [
  "TQQQ",
  "QLD",
  "QQQ",
  "SPY",
  "VOO",
  "SCHD",
  "MSFT",
  "GOOGL",
  "AAPL",
  "TSLA",
  "NFLX",
  "NVDA",
  "JEPI",
  "SGOV",
  "BIL",
];

interface KeywordRule {
  ticker: string;
  confidence: TickerConfidence;
  keywords: string[]; // 소문자 비교
}

const KEYWORD_RULES: KeywordRule[] = [
  { ticker: "TQQQ", confidence: "high", keywords: ["tqqq", "proshares qqq 3", "qqq 레버리지 3", "qqq 3배"] },
  { ticker: "QLD", confidence: "high", keywords: ["qld", "qqq 2배", "proshares ultra qqq", "qqq 레버리지 2"] },
  { ticker: "QQQ", confidence: "high", keywords: ["invesco qqq", "나스닥 100 인베스코", "나스닥100 인베스코"] },
  { ticker: "SPY", confidence: "high", keywords: ["spdr s&p 500", "spdr sp500", "spdr s&p500"] },
  { ticker: "VOO", confidence: "high", keywords: ["voo", "vanguard s&p 500", "vanguard sp500"] },
  { ticker: "SCHD", confidence: "medium", keywords: ["schd", "schwab 미국 배당", "schwab us dividend", "미국배당다우존", "미국배당다우존스"] },
  { ticker: "MSFT", confidence: "high", keywords: ["msft", "마이크로소프트", "microsoft"] },
  { ticker: "GOOGL", confidence: "high", keywords: ["googl", "알파벳", "alphabet", "구글"] },
  { ticker: "AAPL", confidence: "high", keywords: ["aapl", "애플", "apple"] },
  { ticker: "TSLA", confidence: "high", keywords: ["tsla", "테슬라", "tesla"] },
  { ticker: "NFLX", confidence: "high", keywords: ["nflx", "넷플릭스", "netflix"] },
  { ticker: "NVDA", confidence: "high", keywords: ["nvda", "엔비디아", "nvidia"] },
  { ticker: "JEPI", confidence: "high", keywords: ["jepi"] },
  { ticker: "QQQ", confidence: "medium", keywords: ["qqq"] },
  { ticker: "SPY", confidence: "medium", keywords: ["spy"] },
];

// 현금/현금성 자산 키워드
const CASH_KEYWORDS = [
  "현금",
  "cma",
  "cd금리",
  "머니마켓",
  "mmf",
  "money market",
  "파킹",
  "통장",
  "예수금",
  "예금",
  "적금",
  "저금통",
  "세이프박스",
  "플러스박스",
  "머니",
  "sgov",
  "bil",
  "box",
  "treasury bond",
  "초단기채",
  "rp",
];

/** 상품명에서 티커를 추정한다. */
export function guessTicker(productNameRaw: string): TickerGuess {
  const product = (productNameRaw || "").trim();
  if (!product) return { ticker: null, confidence: "none", matchedBy: "none" };

  const lower = product.toLowerCase();

  // 1) 해시태그 (#tqqq 등) — 영문 해시태그만 티커로 인식
  const hash = product.match(/#([A-Za-z][A-Za-z0-9.]{0,5})/);
  if (hash) {
    return { ticker: hash[1].toUpperCase(), confidence: "high", matchedBy: "hashtag" };
  }

  // 2) 현금/현금성
  if (CASH_KEYWORDS.some((k) => lower.includes(k))) {
    return { ticker: "CASH_LIKE", confidence: "medium", matchedBy: "cash" };
  }

  // 3) 상품명 전체가 티커 토큰일 때
  const token = product.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (token.length >= 1 && KNOWN_TICKERS.includes(token)) {
    return { ticker: token, confidence: "high", matchedBy: "exact" };
  }

  // 4) 키워드 사전
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) {
      return { ticker: rule.ticker, confidence: rule.confidence, matchedBy: "keyword" };
    }
  }

  return { ticker: null, confidence: "none", matchedBy: "none" };
}

/** 상품명에서 #태그 추출 (예: "정기적금 #예적금" -> "예적금") */
export function extractTag(productNameRaw: string): string | undefined {
  const m = (productNameRaw || "").match(/#(\S+)/);
  return m ? m[1] : undefined;
}

/** confidence 가 낮아 사용자 확인이 필요한지 */
export function needsTickerReview(confidence: TickerConfidence | undefined): boolean {
  return confidence === "none" || confidence === "low";
}
