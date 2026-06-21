#!/usr/bin/env node
/**
 * Empirical verification harness for the ticker MDD calculator data path.
 *
 * It drives the REAL production code (lib/server/quote-fetchers.ts ->
 * getQuoteHistory -> parseYahooPrices -> daily-density guard, and
 * lib/mdd-calculator.ts -> computeDrawdownEpisodes / calculateMddFromPrices).
 *
 * Two modes:
 *   - default (offline): mocks the Yahoo HTTP transport so the harness runs in
 *     a network-restricted sandbox. It (a) reproduces the month-start root cause
 *     by feeding a MONTHLY payload, and (b) proves the fix by feeding a DAILY
 *     payload and confirming the pipeline preserves daily trading-day dates.
 *   - LIVE=1 (needs open egress to query1.finance.yahoo.com): performs a real
 *     fetch for SPY/QQQ/SCHD at range=max and prints the actual measured counts,
 *     first/last dates, max MDD, and peak/trough/recovery dates.
 *
 * Usage:
 *   node scripts/verify-mdd-daily-density.mjs            # offline structural proof
 *   LIVE=1 node scripts/verify-mdd-daily-density.mjs     # real Yahoo measurement
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = require("typescript");

// Provide a no-op stub for the "server-only" import so the server module loads
// in this plain node harness.
const stubPath = path.join(rootDir, "scripts", ".server-only-stub.js");
fs.writeFileSync(stubPath, "module.exports = {};\n");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request === "server-only") return stubPath;
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(rootDir, request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { getQuoteHistory, fetchYahooChart } = require("../lib/server/quote-fetchers.ts");
const { computeDrawdownEpisodes, calculateMddFromPrices, defaultMddInput } = require("../lib/mdd-calculator.ts");

const DAY_MS = 86_400_000;

function iso(d) {
  return new Date(d).toISOString().slice(0, 10);
}
function isMonthStartHeavy(dates) {
  const monthStart = dates.filter((d) => /\d{4}-\d{2}-01$/.test(d)).length;
  return { monthStart, ratio: dates.length ? monthStart / dates.length : 0 };
}
function medianGap(dates) {
  const gaps = [];
  for (let i = 1; i < dates.length; i += 1) {
    gaps.push((Date.parse(`${dates[i]}T00:00:00Z`) - Date.parse(`${dates[i - 1]}T00:00:00Z`)) / DAY_MS);
  }
  gaps.sort((a, b) => a - b);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
}

function reportSeries(label, prices) {
  const dates = prices.map((p) => p.date);
  const ms = isMonthStartHeavy(dates);
  const episodes = computeDrawdownEpisodes(prices, { limit: 8 });
  const worst = episodes[0];
  const full = calculateMddFromPrices({ ...defaultMddInput, ticker: label }, prices, { source: "yahoo" });
  console.log(`\n===== ${label} =====`);
  console.log("data count        :", prices.length);
  console.log("first date        :", dates[0]);
  console.log("last date         :", dates.at(-1));
  console.log("median gap (days) :", medianGap(dates));
  console.log("YYYY-MM-01 dates  :", `${ms.monthStart} (${(ms.ratio * 100).toFixed(1)}%)`);
  console.log("max MDD           :", `${full.maxDrawdown}%`);
  console.log("  peak/high date  :", full.highDate);
  console.log("  trough/low date :", full.lowDate);
  console.log("  recovery date   :", full.recoveryDate ?? "(unrecovered)");
  if (worst) {
    console.log("worst episode     :", `${worst.mdd}%  peak ${worst.peakDate} -> trough ${worst.troughDate} -> recovery ${worst.recoveryDate ?? "(none)"}`);
  }
  console.log("top-8 episode dates (peak / trough / recovery):");
  episodes.forEach((e) => console.log(`   #${e.rank} ${e.mdd}%  ${e.peakDate} / ${e.troughDate} / ${e.recoveryDate ?? "-"}`));
  return { count: prices.length, first: dates[0], last: dates.at(-1), medianGap: medianGap(dates), monthStart: ms, episodes };
}

// ---------------------------------------------------------------------------
// Synthetic Yahoo payload builders (used only in offline mode).
// Values are a deterministic walk with an embedded 2007-2009 style crash so MDD
// is meaningful; the DATE STRUCTURE (daily weekday vs monthly 1st) is the thing
// under test, exercised through the real parser + density guard.
// ---------------------------------------------------------------------------
function walkClose(i, seed) {
  // smooth uptrend + a deep drawdown around the 40-55% progress mark
  const base = 50 * Math.pow(1.00018, i);
  const crash = Math.max(0, Math.sin(((i % 4000) / 4000) * Math.PI)) ; // 0..1
  const dip = i > 3600 && i < 4200 ? -0.45 * Math.sin(((i - 3600) / 600) * Math.PI) : 0;
  return Number((base * (1 + 0.04 * Math.sin(i / 23 + seed) + dip)).toFixed(4));
}

function buildDailyYahooPayload(startISO, endISO, seed = 1) {
  const timestamps = [];
  const close = [];
  const open = [];
  const high = [];
  const low = [];
  const volume = [];
  const d = new Date(`${startISO}T00:00:00.000Z`);
  const last = new Date(`${endISO}T00:00:00.000Z`);
  let i = 0;
  while (d <= last) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) {
      const c = walkClose(i, seed);
      timestamps.push(Math.floor(d.getTime() / 1000));
      close.push(c);
      open.push(Number((c * 0.999).toFixed(4)));
      high.push(Number((c * 1.004).toFixed(4)));
      low.push(Number((c * 0.996).toFixed(4)));
      volume.push(1_000_000 + (i % 500) * 1000);
      i += 1;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return { chart: { result: [{ timestamp: timestamps, indicators: { quote: [{ open, high, low, close, volume }] } }], error: null } };
}

function buildMonthlyYahooPayload(startISO, endISO, seed = 1) {
  // Mimics Yahoo range=max monthly candles: one point per month stamped on the 1st.
  const timestamps = [];
  const close = [];
  const open = [];
  const high = [];
  const low = [];
  const volume = [];
  const d = new Date(`${startISO.slice(0, 7)}-01T00:00:00.000Z`);
  const last = new Date(`${endISO}T00:00:00.000Z`);
  let i = 0;
  while (d <= last) {
    const c = walkClose(i * 21, seed); // ~21 trading days per month
    timestamps.push(Math.floor(d.getTime() / 1000));
    close.push(c);
    open.push(Number((c * 0.99).toFixed(4)));
    high.push(Number((c * 1.03).toFixed(4)));
    low.push(Number((c * 0.97).toFixed(4)));
    volume.push(20_000_000);
    i += 1;
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return { chart: { result: [{ timestamp: timestamps, indicators: { quote: [{ open, high, low, close, volume }] } }], error: null } };
}

async function runLive() {
  console.log("MODE: LIVE (real Yahoo fetch via getQuoteHistory, range=max)\n");
  const out = {};
  for (const ticker of ["SPY", "QQQ", "SCHD"]) {
    const res = await getQuoteHistory({ ticker, range: "max" });
    console.log(`fetch ${ticker}: source=${res.source}`);
    if (res.warnings?.length) console.log("  warnings:", res.warnings.join(" | "));
    out[ticker] = reportSeries(ticker, res.prices.map((p) => ({ date: p.date, close: p.close })));
  }
  fs.writeFileSync(path.join(rootDir, "mdd-live-measurement.json"), JSON.stringify(out, null, 2));
  console.log("\nWrote mdd-live-measurement.json");
}

async function runOffline() {
  console.log("MODE: OFFLINE (mocked Yahoo transport — sandbox egress blocks query1.finance.yahoo.com)");
  console.log("This proves the REAL code path's behavior; price values are synthetic, date STRUCTURE is the test.\n");

  // 1) Capture the actual URL the fixed fetcher sends to Yahoo, and feed a DAILY payload.
  const captured = [];
  const dailyPayload = buildDailyYahooPayload("1993-01-29", "2026-06-19", 0.3);
  global.fetch = async (url) => {
    captured.push(String(url));
    return { ok: true, status: 200, json: async () => dailyPayload, text: async () => JSON.stringify(dailyPayload) };
  };

  await fetchYahooChart({ ticker: "SPY", range: "max", events: "history" });
  const sentUrl = new URL(captured.at(-1));
  console.log("[URL CHECK] request the fixed code sends for range=max:");
  console.log("   ", sentUrl.toString());
  assert.equal(sentUrl.searchParams.get("interval"), "1d", "interval must be 1d");
  assert.equal(sentUrl.searchParams.get("period1"), "0", "period1 must be 0 (inception) for full history");
  assert.ok(sentUrl.searchParams.get("period2"), "period2 must be set");
  assert.equal(sentUrl.searchParams.get("range"), null, "range=max must NOT be sent (it triggers monthly candles)");
  console.log("    -> interval=1d, period1=0, period2 set, NO range=max  ✓\n");

  // 2) End-to-end through getQuoteHistory with the DAILY payload (real parser + density guard).
  const daily = await getQuoteHistory({ ticker: "SPY", range: "max" });
  console.log("[DAILY PAYLOAD] getQuoteHistory source =", daily.source);
  assert.equal(daily.source, "yahoo", "daily payload must be accepted as yahoo");
  const dailyReport = reportSeries("SPY (daily payload, fixed path)", daily.prices.map((p) => ({ date: p.date, close: p.close })));
  assert.ok(dailyReport.count > 7000, `expected >7000 daily points for 1993-2026, got ${dailyReport.count}`);
  assert.ok(dailyReport.medianGap <= 4, `daily median gap should be small, got ${dailyReport.medianGap}`);
  assert.ok(dailyReport.monthStart.ratio < 0.1, "daily series must NOT be month-start heavy");
  assert.ok(!/-01$/.test(dailyReport.episodes[0].troughDate) || dailyReport.episodes[0].troughDate.endsWith("-01") === false,
    "trough should be a real trading day");

  // 3) Root-cause reproduction: feed a MONTHLY payload (old range=max behavior).
  const monthlyPayload = buildMonthlyYahooPayload("1993-01-29", "2026-06-19", 0.3);
  global.fetch = async () => ({ ok: true, status: 200, json: async () => monthlyPayload, text: async () => JSON.stringify(monthlyPayload) });
  const monthly = await getQuoteHistory({ ticker: "SPY", range: "max" });
  console.log("\n[MONTHLY PAYLOAD] getQuoteHistory source =", monthly.source, "(density guard should reject yahoo)");
  console.log("  warnings:", monthly.warnings.join(" | "));
  assert.notEqual(monthly.source, "yahoo", "monthly candles must be rejected by the daily-density guard");

  // Show the symptom directly: monthly prices -> month-start episode dates.
  const monthlyPrices = monthlyPayload.chart.result[0].timestamp.map((t, i) => ({ date: iso(t * 1000), close: monthlyPayload.chart.result[0].indicators.quote[0].close[i] }));
  const symptom = reportSeries("SPY (monthly payload — REPRODUCES the bug)", monthlyPrices);
  console.log("\n[SYMPTOM] month-start ratio of monthly episodes:", `${(symptom.monthStart.ratio * 100).toFixed(1)}% of points are YYYY-MM-01`);
  assert.ok(symptom.monthStart.ratio > 0.9, "monthly payload should be ~100% month-start (the reported symptom)");

  console.log("\nALL OFFLINE ASSERTIONS PASSED ✓");
  console.log("- Fixed fetcher requests daily candles (interval=1d, period1/period2, no range=max).");
  console.log("- Real pipeline preserves >7000 daily trading-day points; episode dates are real trading days.");
  console.log("- Monthly candles (old behavior) reproduce the YYYY-MM-01 symptom AND are now rejected by the density guard.");
}

(process.env.LIVE === "1" ? runLive() : runOffline()).catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
