import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type {
  AnnualMarketPatternObservation,
  MarketPatternDatasetSource,
  MarketPatternDatasetV1,
} from "../lib/retirement-bootstrap-types.ts";
import {
  ALL_RETIREMENT_BOOTSTRAP_ASSET_CLASSES,
  validateMarketPatternDataset,
} from "../lib/retirement-bootstrap-data.ts";

const START_YEAR = 1971;
const END_YEAR = 2025;
const UPDATED_AT = "2026-07-18T00:00:00.000Z";
const OUTPUT_PATH = resolve("data/retirement-bootstrap/market-pattern-production-v1.json");
const USER_AGENT = "GoraniFinanceDataBuilder/1.0 (https://github.com/cococute88/gorani_vercel)";
const WIKIMEDIA_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";
const BLS_LICENSE_URL = "https://www.bls.gov/opub/copyright-information.htm";

type WikiSourceConfig = {
  sourceId: string;
  title: string;
  revisionId: number;
  revisionTimestamp: string;
  proxy: "sp500" | "nasdaq" | "djia";
};

const WIKI_SOURCES: readonly WikiSourceConfig[] = [
  {
    sourceId: "wikimedia-sp500-annual-returns",
    title: "S&P 500",
    revisionId: 1364524301,
    revisionTimestamp: "2026-07-17T02:01:10Z",
    proxy: "sp500",
  },
  {
    sourceId: "wikimedia-nasdaq-composite-annual-returns",
    title: "Nasdaq Composite",
    revisionId: 1354212898,
    revisionTimestamp: "2026-05-15T00:46:02Z",
    proxy: "nasdaq",
  },
  {
    sourceId: "wikimedia-djia-annual-returns",
    title: "Dow Jones Industrial Average",
    revisionId: 1364611421,
    revisionTimestamp: "2026-07-17T14:46:04Z",
    proxy: "djia",
  },
];

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableSeriesHash(series: ReadonlyMap<number, number | { price: number; total: number }>): string {
  return sha256(JSON.stringify(Array.from(series.entries()).sort(([left], [right]) => left - right)));
}

function parseLastPercent(cell: string, label: string): number {
  const normalized = cell.replaceAll("−", "-").replaceAll(",", "");
  const matches = Array.from(normalized.matchAll(/([+-]?\d+(?:\.\d+)?)\s*%?/g));
  const match = matches.at(-1);
  if (!match) throw new Error(`${label} 퍼센트 값을 읽을 수 없습니다: ${cell}`);
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= -100) throw new Error(`${label} 값이 올바르지 않습니다.`);
  return value;
}

function rowsInRange<T>(rows: Map<number, T>, label: string): Map<number, T> {
  const selected = new Map(Array.from(rows.entries()).filter(([year]) => year >= START_YEAR && year <= END_YEAR));
  assert.equal(selected.size, END_YEAR - START_YEAR + 1, `${label} 관측 수`);
  for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    assert.ok(selected.has(year), `${label} ${year}년 누락`);
  }
  return selected;
}

function parseSp500(wikitext: string): Map<number, { price: number; total: number }> {
  const rows = new Map<number, { price: number; total: number }>();
  const rowPattern = /\|-\s*\n\|(\d{4})\s*\n([\s\S]*?)(?=\n\|-\s*\n|\n\|\})/g;
  for (const match of wikitext.matchAll(rowPattern)) {
    const year = Number(match[1]);
    if (year < START_YEAR || year > END_YEAR) continue;
    const cells = match[2].split("\n").filter((line) => line.trimStart().startsWith("|"));
    if (cells.length < 2) continue;
    rows.set(year, {
      price: parseLastPercent(cells[0], `S&P 500 ${year} 가격수익률`),
      total: parseLastPercent(cells[1], `S&P 500 ${year} 총수익률`),
    });
  }
  return rowsInRange(rows, "S&P 500");
}

function parseNasdaq(wikitext: string): Map<number, number> {
  const rows = new Map<number, number>();
  const section = wikitext.slice(wikitext.indexOf("Returns by year==="));
  const rowPattern = /\|-\s*\n\|\s*(\d{4})\s*\|\|([^\n]+)/g;
  for (const match of section.matchAll(rowPattern)) {
    const year = Number(match[1]);
    if (year < START_YEAR || year > END_YEAR) continue;
    rows.set(year, parseLastPercent(match[2].split("||").at(-1) ?? "", `Nasdaq Composite ${year} 가격수익률`));
  }
  return rowsInRange(rows, "Nasdaq Composite");
}

function parseDjia(wikitext: string): Map<number, number> {
  const rows = new Map<number, number>();
  const rowPattern = /\|-\s*\n!(?:scope="row"\|)?\s*(\d{4})\s*\n([\s\S]*?)(?=\n\|-\s*\n|\n\|\})/g;
  for (const match of wikitext.matchAll(rowPattern)) {
    const year = Number(match[1]);
    if (year < START_YEAR || year > END_YEAR) continue;
    rows.set(year, parseLastPercent(match[2], `DJIA ${year} 가격수익률`));
  }
  return rowsInRange(rows, "DJIA");
}

async function loadPinnedWikitext(config: WikiSourceConfig): Promise<string> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "parse",
    prop: "wikitext|revid",
    format: "json",
    formatversion: "2",
    oldid: String(config.revisionId),
  }).toString();
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${config.title} 고정 revision 요청 실패: ${response.status}`);
  const payload = await response.json() as { parse?: { revid?: number; wikitext?: string } };
  if (payload.parse?.revid !== config.revisionId || typeof payload.parse.wikitext !== "string") {
    throw new Error(`${config.title} 고정 revision 응답이 올바르지 않습니다.`);
  }
  return payload.parse.wikitext;
}

async function loadBlsAnnualAverageCpi(): Promise<Map<number, number>> {
  const annualAverages = new Map<number, number>();
  const ranges = [
    [1970, 1979],
    [1980, 1989],
    [1990, 1999],
    [2000, 2009],
    [2010, 2019],
    [2020, END_YEAR],
  ] as const;
  for (const [startYear, endYear] of ranges) {
    const response = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify({
        seriesid: ["CUUR0000SA0"],
        startyear: String(startYear),
        endyear: String(endYear),
        annualaverage: true,
      }),
    });
    if (!response.ok) throw new Error(`BLS CPI-U 요청 실패: ${response.status}`);
    const payload = await response.json() as {
      status?: string;
      Results?: { series?: Array<{ seriesID?: string; data?: Array<{ year: string; period: string; value: string }> }> };
    };
    if (payload.status !== "REQUEST_SUCCEEDED") throw new Error("BLS CPI-U 응답 상태가 성공이 아닙니다.");
    const series = payload.Results?.series?.[0];
    if (series?.seriesID !== "CUUR0000SA0") throw new Error("BLS CPI-U series ID가 일치하지 않습니다.");
    for (const row of series.data ?? []) {
      if (row.period !== "M13") continue;
      const year = Number(row.year);
      const value = Number(row.value);
      if (!Number.isInteger(year) || !Number.isFinite(value) || value <= 0) {
        throw new Error("BLS CPI-U 연평균 관측치가 올바르지 않습니다.");
      }
      if (annualAverages.has(year)) throw new Error(`BLS CPI-U ${year}년 중복 관측치입니다.`);
      annualAverages.set(year, value);
    }
  }
  for (let year = START_YEAR - 1; year <= END_YEAR; year += 1) {
    assert.ok(annualAverages.has(year), `BLS CPI-U ${year}년 연평균 누락`);
  }
  return annualAverages;
}

function buildInflationRates(cpi: ReadonlyMap<number, number>): Map<number, number> {
  const rates = new Map<number, number>();
  for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    const previous = cpi.get(year - 1)!;
    const current = cpi.get(year)!;
    rates.set(year, Number((((current / previous) - 1) * 100).toFixed(6)));
  }
  return rates;
}

function wikiSourceMetadata(config: WikiSourceConfig, contentSha256: string): MarketPatternDatasetSource {
  return {
    sourceId: config.sourceId,
    name: `${config.title} 연간 수익률 표 (Wikimedia contributors)`,
    url: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(config.title.replaceAll(" ", "_"))}&oldid=${config.revisionId}`,
    role: "market_pattern",
    license: "Creative Commons Attribution-ShareAlike 4.0 International",
    licenseUrl: WIKIMEDIA_LICENSE_URL,
    retrievedAt: UPDATED_AT,
    revision: `${config.revisionId} @ ${config.revisionTimestamp}`,
    contentSha256,
  };
}

async function buildDataset(): Promise<MarketPatternDatasetV1> {
  const wikiTexts = await Promise.all(WIKI_SOURCES.map(loadPinnedWikitext));
  const sp500 = parseSp500(wikiTexts[0]);
  const nasdaq = parseNasdaq(wikiTexts[1]);
  const djia = parseDjia(wikiTexts[2]);
  const cpi = await loadBlsAnnualAverageCpi();
  const inflation = buildInflationRates(cpi);

  const observations: AnnualMarketPatternObservation[] = [];
  for (let year = START_YEAR; year <= END_YEAR; year += 1) {
    const largeCap = sp500.get(year)!;
    const largeGrowthPrice = nasdaq.get(year)!;
    const dividendValuePrice = djia.get(year)!;
    observations.push({
      year,
      inflationPct: inflation.get(year)!,
      assetClasses: {
        us_large_cap: {
          priceReturnPct: largeCap.price,
          totalReturnPct: largeCap.total,
        },
        us_large_growth: {
          priceReturnPct: largeGrowthPrice,
          totalReturnPct: largeGrowthPrice,
        },
        us_dividend_value: {
          priceReturnPct: dividendValuePrice,
          totalReturnPct: dividendValuePrice,
        },
      },
    });
  }

  const sources: MarketPatternDatasetSource[] = WIKI_SOURCES.map((config, index) => {
    const series = config.proxy === "sp500" ? sp500 : config.proxy === "nasdaq" ? nasdaq : djia;
    return wikiSourceMetadata(config, stableSeriesHash(series));
  });
  sources.push({
    sourceId: "bls-cpi-u-all-items-annual-average",
    name: "BLS CPI-U, U.S. city average, All items, not seasonally adjusted, annual average (CUUR0000SA0)",
    url: "https://data.bls.gov/timeseries/CUUR0000SA0",
    role: "inflation",
    license: "U.S. federal government public domain",
    licenseUrl: BLS_LICENSE_URL,
    retrievedAt: UPDATED_AT,
    revision: "1970-2025 annual averages retrieved via BLS Public Data API v2",
    contentSha256: stableSeriesHash(cpi),
  });

  return {
    schemaVersion: 1,
    datasetId: "gorani-us-asset-class-market-patterns",
    datasetVersion: "2026.07.18-wikimedia-bls-v1",
    usage: "production",
    updatedAt: UPDATED_AT,
    periodStartYear: START_YEAR,
    periodEndYear: END_YEAR,
    license: {
      name: "Creative Commons Attribution-ShareAlike 4.0 International",
      spdxId: "CC-BY-SA-4.0",
      url: WIKIMEDIA_LICENSE_URL,
      attribution: "Market return tables adapted from Wikipedia contributors; CPI-U from the U.S. Bureau of Labor Statistics.",
      repositoryRedistribution: "allowed_with_attribution_and_share_alike",
    },
    sources,
    assetClassMethodology: {
      us_large_cap: {
        proxyName: "S&P 500",
        sourceReturnType: "price_and_total_return",
        totalReturnPolicy: "source_total_return",
        dividendGrowthPolicy: "user_assumption_only",
        notes: "가격수익률은 위탁 가격 편차, 총수익률은 절세계좌 총수익 편차에 사용합니다.",
      },
      us_large_growth: {
        proxyName: "Nasdaq Composite",
        sourceReturnType: "price_return_proxy",
        totalReturnPolicy: "price_pattern_recentered_to_user_total_return_cagr",
        dividendGrowthPolicy: "user_assumption_only",
        notes: "Nasdaq Composite 가격 변동 proxy입니다. QQQ·JEPQ 실제 역사가 아니며, 가격 패턴을 사용자 CAGR에 재중심화하고 역사 배당을 추가하지 않습니다. JEPQ 옵션 overlay의 낮은 변동성은 재현하지 않습니다.",
      },
      us_dividend_value: {
        proxyName: "Dow Jones Industrial Average",
        sourceReturnType: "price_return_proxy",
        totalReturnPolicy: "price_pattern_recentered_to_user_total_return_cagr",
        dividendGrowthPolicy: "user_assumption_only",
        notes: "SCHD의 장기 가격 충격·회복 순서를 근사하는 DJIA 30개 우량 대형주 가격 변동 proxy입니다. SCHD 실제 역사나 배당·가치 지수가 아니며 사용자 배당 가정만 유지합니다.",
      },
    },
    integrity: {
      algorithm: "SHA-256",
      canonicalization: "JSON.stringify(observations)",
      observationsSha256: sha256(JSON.stringify(observations)),
    },
    observations,
  };
}

async function checkStoredDataset(): Promise<void> {
  const existing = await readFile(OUTPUT_PATH, "utf8");
  const dataset = JSON.parse(existing) as MarketPatternDatasetV1;
  validateMarketPatternDataset(dataset, ALL_RETIREMENT_BOOTSTRAP_ASSET_CLASSES, 5);
  assert.equal(dataset.datasetId, "gorani-us-asset-class-market-patterns");
  assert.equal(dataset.datasetVersion, "2026.07.18-wikimedia-bls-v1");
  assert.equal(dataset.updatedAt, UPDATED_AT);
  assert.equal(dataset.periodStartYear, START_YEAR);
  assert.equal(dataset.periodEndYear, END_YEAR);
  assert.equal(dataset.observations.length, END_YEAR - START_YEAR + 1);
  assert.equal(dataset.integrity.observationsSha256, sha256(JSON.stringify(dataset.observations)));
  for (const config of WIKI_SOURCES) {
    const source = dataset.sources.find((candidate) => candidate.sourceId === config.sourceId);
    assert.ok(source, `${config.sourceId} source metadata 누락`);
    assert.equal(source.revision, `${config.revisionId} @ ${config.revisionTimestamp}`);
  }
  assert.ok(dataset.sources.some((source) => source.sourceId === "bls-cpi-u-all-items-annual-average"));
  console.log(`production dataset integrity check passed: ${dataset.datasetVersion}`);
}

if (process.argv.includes("--check")) {
  await checkStoredDataset();
} else {
  const dataset = await buildDataset();
  const serialized = `${JSON.stringify(dataset, null, 2)}\n`;
  const existing = await readFile(OUTPUT_PATH, "utf8").catch(() => "");
  if (existing) {
    assert.equal(
      JSON.parse(existing).schemaVersion,
      dataset.schemaVersion,
      "기존 artifact schemaVersion과 생성기 schemaVersion이 다릅니다.",
    );
  }
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, serialized, "utf8");
  console.log(JSON.stringify({
    output: OUTPUT_PATH,
    datasetVersion: dataset.datasetVersion,
    startYear: dataset.periodStartYear,
    endYear: dataset.periodEndYear,
    observations: dataset.observations.length,
    overlappingFiveYearBlocks: dataset.observations.length - 5 + 1,
    observationsSha256: dataset.integrity.observationsSha256,
  }));
}
