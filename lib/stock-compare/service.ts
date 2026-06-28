// =============================================================
// 종목 성과 비교 데이터 오케스트레이션 + 캐싱.
//
// 데이터 소스
//   - 가격/TR: /api/market/long-series (fetchLongSeries) — 전체 일별 종가 +
//     adjClose(배당+분할 조정) + 배당 이벤트. fetchLongSeries 자체가 심볼 단위
//     in-memory 캐시(5분)를 가진다.
//   - 구성종목: lib/asset-map-etf-constituents.ts top-holdings fixture.
//
// 캐싱 전략(무료 운영 우선)
//   1) fetchLongSeries 의 심볼 단위 캐시 → 동일 티커는 네트워크 1회.
//   2) 본 모듈의 페어 단위 캐시(A|B|range) → 같은 쌍 재조회 시 0 호출.
//   3) 기간/옵션(TR·비중·중복) 변경은 클라이언트에서 재계산만 → API 호출 없음.
// =============================================================

import { fetchLongSeries, type LongSeriesPoint } from "@/lib/market-series";
import { analyzeOverlap } from "@/lib/stock-compare/holdings";
import { normalizeCompareTicker } from "@/lib/stock-compare/constants";
import type { OverlapResult } from "@/lib/stock-compare/types";

// 전체 일별 히스토리 요청 시작일(요청 URL 안정화를 위해 이른 바닥값 고정).
const HISTORY_START_ISO = "2007-01-01";
const PAIR_CACHE_TTL_MS = 5 * 60_000;
const MAX_COMMON_FETCH = 20; // 무료 운영 보호: 공통 종목 조회 상한.

export type CompareData = {
  tickerA: string;
  tickerB: string;
  identical: boolean;
  sourceA: "yahoo" | "empty";
  sourceB: "yahoo" | "empty";
  pointsA: LongSeriesPoint[];
  pointsB: LongSeriesPoint[];
  dividendsA: number; // 배당 이벤트 수(데이터 출처 표기용)
  dividendsB: number;
  overlap: OverlapResult;
  // 공통 종목 티커 → 일별 시계열(중복 제거 계산용).
  commonPoints: Map<string, LongSeriesPoint[]>;
  warnings: string[];
};

type CacheEntry = { at: number; promise: Promise<CompareData> };
const pairCache = new Map<string, CacheEntry>();

function pairKey(a: string, b: string): string {
  return `${a}__${b}`;
}

async function safeFetch(symbol: string) {
  try {
    return await fetchLongSeries(symbol, HISTORY_START_ISO);
  } catch (error) {
    return {
      symbol,
      source: "empty" as const,
      updatedAt: new Date().toISOString(),
      start: HISTORY_START_ISO,
      points: [] as LongSeriesPoint[],
      dividends: [],
      warnings: [error instanceof Error ? error.message : String(error)],
    };
  }
}

async function loadCompareData(rawA: string, rawB: string): Promise<CompareData> {
  const tickerA = normalizeCompareTicker(rawA);
  const tickerB = normalizeCompareTicker(rawB);
  const identical = tickerA === tickerB;

  const overlap = analyzeOverlap(tickerA, tickerB);

  // A·B 본체와 공통 종목을 병렬 조회(중복 심볼은 fetchLongSeries 캐시로 합쳐짐).
  const commonToFetch = overlap.commonTickers.slice(0, MAX_COMMON_FETCH);
  const warnings: string[] = [];
  if (overlap.commonTickers.length > MAX_COMMON_FETCH) {
    warnings.push(`공통 종목이 많아 상위 ${MAX_COMMON_FETCH}개만 중복 제거 계산에 사용했습니다.`);
  }

  const [resA, resB, commonResults] = await Promise.all([
    safeFetch(tickerA),
    identical ? Promise.resolve(null) : safeFetch(tickerB),
    Promise.all(commonToFetch.map((t) => safeFetch(t).then((res) => ({ t, res })))),
  ]);

  const resBFinal = resB ?? resA;

  const commonPoints = new Map<string, LongSeriesPoint[]>();
  for (const { t, res } of commonResults) {
    if (res.points.length > 0) commonPoints.set(t, res.points);
  }

  resA.warnings?.forEach((w) => warnings.push(`${tickerA}: ${w}`));
  if (!identical) resBFinal.warnings?.forEach((w) => warnings.push(`${tickerB}: ${w}`));

  return {
    tickerA,
    tickerB,
    identical,
    sourceA: resA.source,
    sourceB: resBFinal.source,
    pointsA: resA.points,
    pointsB: resBFinal.points,
    dividendsA: resA.dividends?.length ?? 0,
    dividendsB: resBFinal.dividends?.length ?? 0,
    overlap,
    commonPoints,
    warnings,
  };
}

export function fetchCompareData(rawA: string, rawB: string): Promise<CompareData> {
  const tickerA = normalizeCompareTicker(rawA);
  const tickerB = normalizeCompareTicker(rawB);
  const key = pairKey(tickerA, tickerB);

  const cached = pairCache.get(key);
  if (cached && Date.now() - cached.at < PAIR_CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = loadCompareData(tickerA, tickerB);
  // 실패한 조회는 캐시에서 제거해 재시도가 가능하게 한다.
  promise.catch(() => pairCache.delete(key));
  pairCache.set(key, { at: Date.now(), promise });
  return promise;
}
