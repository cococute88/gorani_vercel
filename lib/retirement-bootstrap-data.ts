import type {
  AnnualMarketPatternObservation,
  AssetClassPatternId,
  MarketPatternDatasetV1,
  SampledMarketPath,
} from "./retirement-bootstrap-types";

export const MIN_CENTERED_ANNUAL_RETURN_PCT = -99;
export const MAX_CENTERED_ANNUAL_RETURN_PCT = 300;
export const ALL_RETIREMENT_BOOTSTRAP_ASSET_CLASSES = [
  "us_large_cap",
  "us_large_growth",
  "us_dividend_value",
] as const satisfies readonly AssetClassPatternId[];

const MIN_LOG_GROSS = Math.log1p(MIN_CENTERED_ANNUAL_RETURN_PCT / 100);
const MAX_LOG_GROSS = Math.log1p(MAX_CENTERED_ANNUAL_RETURN_PCT / 100);
const BISECTION_STEPS = 80;
const RECENTERING_LOG_TOLERANCE = 1e-12;

export type RecenteredRateSeries = {
  ratesPct: number[];
  targetGeometricRatePct: number;
  resultingGeometricRatePct: number;
  observationCount: number;
  clippedLowCount: number;
  clippedHighCount: number;
  logStandardDeviationBefore: number;
  logStandardDeviationAfter: number;
};

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} 값이 유한한 숫자가 아닙니다.`);
}

function ratePctToLogGross(ratePct: number, label: string): number {
  assertFinite(ratePct, label);
  if (ratePct <= -100) throw new Error(`${label} 값은 -100%보다 커야 합니다.`);
  return Math.log1p(ratePct / 100);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error("평균을 계산할 관측치가 없습니다.");
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function standardDeviation(values: readonly number[]): number {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

export async function computeMarketPatternObservationsSha256(
  observations: readonly AnnualMarketPatternObservation[],
): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(observations));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * 역사적 log gross return의 평균 대비 편차를 사용자 CAGR 중심에 옮긴다.
 * 상·하한에서 일부 값이 잘리더라도 전체 관측치의 기하평균이 사용자 중심값과
 * 일치하도록 shift를 이분법으로 다시 보정한다.
 */
export function recenterHistoricalRatesPctWithDiagnostics(
  historicalRatesPct: readonly number[],
  targetGeometricRatePct: number,
): RecenteredRateSeries {
  if (historicalRatesPct.length === 0) throw new Error("재중심화할 역사 관측치가 없습니다.");
  const historicalLogs = historicalRatesPct.map((value, index) => ratePctToLogGross(value, `역사 관측치 ${index + 1}`));
  const historicalMean = mean(historicalLogs);
  const deviations = historicalLogs.map((value) => value - historicalMean);
  const targetLog = ratePctToLogGross(targetGeometricRatePct, "사용자 장기 중심값");
  if (targetLog < MIN_LOG_GROSS || targetLog > MAX_LOG_GROSS) {
    throw new Error(
      `사용자 장기 중심값은 ${MIN_CENTERED_ANNUAL_RETURN_PCT}%~${MAX_CENTERED_ANNUAL_RETURN_PCT}% 범위여야 합니다.`,
    );
  }
  if (deviations.every((deviation) => Math.abs(deviation) <= Number.EPSILON)) {
    const ratesPct = historicalRatesPct.map(() => targetGeometricRatePct);
    return {
      ratesPct,
      targetGeometricRatePct,
      resultingGeometricRatePct: targetGeometricRatePct,
      observationCount: ratesPct.length,
      clippedLowCount: 0,
      clippedHighCount: 0,
      logStandardDeviationBefore: 0,
      logStandardDeviationAfter: 0,
    };
  }

  const centeredMeanAt = (shift: number): number => mean(
    deviations.map((deviation) => clamp(shift + deviation, MIN_LOG_GROSS, MAX_LOG_GROSS)),
  );

  let low = MIN_LOG_GROSS - Math.max(...deviations);
  let high = MAX_LOG_GROSS - Math.min(...deviations);
  for (let step = 0; step < BISECTION_STEPS; step += 1) {
    const midpoint = (low + high) / 2;
    if (centeredMeanAt(midpoint) < targetLog) low = midpoint;
    else high = midpoint;
  }
  const calibratedShift = (low + high) / 2;
  if (Math.abs(centeredMeanAt(calibratedShift) - targetLog) > RECENTERING_LOG_TOLERANCE) {
    throw new Error("재중심화 보정이 허용 오차 안에 수렴하지 않았습니다.");
  }

  const centeredLogs = deviations.map((deviation) => clamp(calibratedShift + deviation, MIN_LOG_GROSS, MAX_LOG_GROSS));
  const ratesPct = centeredLogs.map((centeredLog) => {
    return Math.expm1(centeredLog) * 100;
  });
  return {
    ratesPct,
    targetGeometricRatePct,
    resultingGeometricRatePct: Math.expm1(mean(centeredLogs)) * 100,
    observationCount: ratesPct.length,
    clippedLowCount: centeredLogs.filter((value) => value === MIN_LOG_GROSS).length,
    clippedHighCount: centeredLogs.filter((value) => value === MAX_LOG_GROSS).length,
    logStandardDeviationBefore: standardDeviation(historicalLogs),
    logStandardDeviationAfter: standardDeviation(centeredLogs),
  };
}

export function recenterHistoricalRatesPct(
  historicalRatesPct: readonly number[],
  targetGeometricRatePct: number,
): number[] {
  return recenterHistoricalRatesPctWithDiagnostics(historicalRatesPct, targetGeometricRatePct).ratesPct;
}

export function geometricMeanRatePct(ratesPct: readonly number[]): number {
  return Math.expm1(mean(ratesPct.map((rate, index) => ratePctToLogGross(rate, `관측치 ${index + 1}`)))) * 100;
}

export function createSeededPrng(seed: number): () => number {
  assertFinite(seed, "난수 시드");
  let state = (Math.trunc(seed) >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

export function validateMarketPatternDataset(
  dataset: MarketPatternDatasetV1 | null | undefined,
  requiredClasses: readonly AssetClassPatternId[],
  blockLength: number,
  allowTestFixture = false,
): asserts dataset is MarketPatternDatasetV1 {
  if (!dataset) throw new Error("production 시장 패턴 데이터가 연결되지 않았습니다.");
  if (dataset.schemaVersion !== 1) throw new Error("지원하지 않는 시장 패턴 데이터 스키마입니다.");
  if (!dataset.datasetId.trim() || !dataset.datasetVersion.trim()) {
    throw new Error("시장 패턴 dataset ID 또는 version이 비어 있습니다.");
  }
  if (dataset.usage !== "production" && dataset.usage !== "test_fixture") {
    throw new Error("시장 패턴 데이터 용도가 올바르지 않습니다.");
  }
  if (dataset.usage === "test_fixture" && !allowTestFixture) {
    throw new Error("테스트 전용 synthetic fixture는 production 시뮬레이션에 사용할 수 없습니다.");
  }
  if (!Number.isFinite(Date.parse(dataset.updatedAt))) throw new Error("시장 패턴 updatedAt이 올바르지 않습니다.");
  if (dataset.integrity.algorithm !== "SHA-256" || !/^[a-f0-9]{64}$/.test(dataset.integrity.observationsSha256)) {
    throw new Error("시장 패턴 데이터 무결성 metadata가 올바르지 않습니다.");
  }
  if (dataset.integrity.canonicalization !== "JSON.stringify(observations)") {
    throw new Error("지원하지 않는 시장 패턴 checksum canonicalization입니다.");
  }
  if (
    !dataset.license.name.trim()
    || !dataset.license.spdxId.trim()
    || !dataset.license.url.trim()
    || !dataset.license.attribution.trim()
    || !["allowed_with_attribution_and_share_alike", "test_fixture_only"].includes(
      dataset.license.repositoryRedistribution,
    )
  ) {
    throw new Error("시장 패턴 데이터 라이선스 metadata가 올바르지 않습니다.");
  }
  if (
    dataset.usage === "production"
    && dataset.license.repositoryRedistribution !== "allowed_with_attribution_and_share_alike"
  ) {
    throw new Error("production 시장 패턴 데이터는 repository 재배포가 허용된 라이선스여야 합니다.");
  }
  if (!Array.isArray(dataset.sources) || dataset.sources.length === 0) {
    throw new Error("시장 패턴 데이터 출처가 없습니다.");
  }
  for (const source of dataset.sources) {
    if (
      !source.sourceId.trim()
      || !source.name.trim()
      || !source.url.trim()
      || !source.license.trim()
      || !source.licenseUrl.trim()
      || !["market_pattern", "inflation", "license"].includes(source.role)
      || !Number.isFinite(Date.parse(source.retrievedAt))
      || !/^[a-f0-9]{64}$/.test(source.contentSha256)
    ) {
      throw new Error(`${source.sourceId || "알 수 없는 출처"} metadata가 올바르지 않습니다.`);
    }
  }
  if (!Number.isInteger(blockLength) || blockLength <= 0) throw new Error("블록 길이는 양의 정수여야 합니다.");
  if (dataset.observations.length < blockLength) {
    throw new Error(`${blockLength}년 블록을 만들 수 있는 연속 역사 데이터가 없습니다.`);
  }
  const first = dataset.observations[0];
  const last = dataset.observations.at(-1)!;
  if (first.year !== dataset.periodStartYear || last.year !== dataset.periodEndYear) {
    throw new Error("데이터 기간 메타정보와 실제 관측 연도가 일치하지 않습니다.");
  }

  for (const assetClass of requiredClasses) {
    const methodology = dataset.assetClassMethodology[assetClass];
    if (!methodology) {
      throw new Error(`${assetClass} 자산군 methodology metadata가 없습니다.`);
    }
    if (
      !methodology.proxyName.trim()
      || !methodology.notes.trim()
      || !["price_and_total_return", "price_return_proxy"].includes(methodology.sourceReturnType)
      || !["source_total_return", "price_pattern_recentered_to_user_total_return_cagr"].includes(
        methodology.totalReturnPolicy,
      )
      || !["source_pattern", "user_assumption_only"].includes(methodology.dividendGrowthPolicy)
    ) {
      throw new Error(`${assetClass} 자산군 methodology metadata가 올바르지 않습니다.`);
    }
  }

  for (let index = 0; index < dataset.observations.length; index += 1) {
    const observation = dataset.observations[index];
    if (!Number.isInteger(observation.year)) throw new Error(`관측치 ${index + 1}의 연도가 올바르지 않습니다.`);
    if (index > 0 && observation.year !== dataset.observations[index - 1].year + 1) {
      throw new Error("시장 패턴 데이터는 누락 없는 연속 연도여야 합니다.");
    }
    ratePctToLogGross(observation.inflationPct, `${observation.year}년 인플레이션`);
    for (const assetClass of requiredClasses) {
      const pattern = observation.assetClasses[assetClass];
      if (!pattern) throw new Error(`${observation.year}년 ${assetClass} 자산군 패턴이 없습니다.`);
      ratePctToLogGross(pattern.totalReturnPct, `${observation.year}년 ${assetClass} 총수익률`);
      ratePctToLogGross(pattern.priceReturnPct, `${observation.year}년 ${assetClass} 가격수익률`);
      if (pattern.dividendGrowthPct !== undefined) {
        ratePctToLogGross(pattern.dividendGrowthPct, `${observation.year}년 ${assetClass} 배당성장률`);
      }
    }
  }

  for (const assetClass of requiredClasses) {
    const dividendObservationCount = dataset.observations.filter(
      (row) => row.assetClasses[assetClass]?.dividendGrowthPct !== undefined,
    ).length;
    if (dividendObservationCount !== 0 && dividendObservationCount !== dataset.observations.length) {
      throw new Error(`${assetClass} 배당성장 패턴은 전체 연도에 있거나 전부 없어야 합니다.`);
    }
  }
}

export function sampleMarketPatternBlocks(
  dataset: MarketPatternDatasetV1,
  pathYears: number,
  blockLength: number,
  random: () => number,
): SampledMarketPath {
  if (!Number.isInteger(pathYears) || pathYears <= 0) throw new Error("경로 기간은 양의 정수여야 합니다.");
  const maximumStart = dataset.observations.length - blockLength;
  if (maximumStart < 0) throw new Error(`${blockLength}년 블록을 생성할 수 없습니다.`);

  const observations: AnnualMarketPatternObservation[] = [];
  const observationIndices: number[] = [];
  const blockStarts: number[] = [];
  while (observations.length < pathYears) {
    const blockStart = Math.floor(random() * (maximumStart + 1));
    blockStarts.push(blockStart);
    for (let offset = 0; offset < blockLength && observations.length < pathYears; offset += 1) {
      const index = blockStart + offset;
      observations.push(dataset.observations[index]);
      observationIndices.push(index);
    }
  }
  return { observations, observationIndices, blockStarts };
}
