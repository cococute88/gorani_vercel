import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const marketIndexPath = "lib/market-index.ts";
const tabsPath = "lib/schd-detail-tabs.ts";
const modalPath = "components/market/IndexDetailModal.tsx";
const sectionPath = "components/dividend/SchdAttractivenessSection.tsx";
const packagePath = "package.json";

const read = (p) => fs.readFileSync(p, "utf8");

// Load a TS module in a sandbox, stubbing out "@/lib/market-index" so the
// spread/tab logic can be tested without the Next.js bundler.
function loadTabsModule() {
  const source = read(tabsPath)
    .replace(/^import type[^;]+;\n/gm, "")
    .replace(/^import\s+\{[^}]*\}\s+from\s+"@\/lib\/market-index";\n/gm, "");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: tabsPath,
  }).outputText;
  // Provide a fake fetchIndexQuote (^TNX) so resolve() paths are exercised.
  const fetchIndexQuote = async (symbol, range) => ({
    symbol,
    range,
    candles: [
      { time: "2026-06-23", open: 4.4, high: 4.5, low: 4.3, close: 4.4, volume: 0 },
      { time: "2026-06-24", open: 4.45, high: 4.5, low: 4.4, close: 4.45, volume: 0 },
      { time: "2026-06-25", open: 4.5, high: 4.6, low: 4.4, close: 4.5, volume: 0 },
    ],
  });
  const sandbox = { exports: {}, module: { exports: {} }, require, console, fetchIndexQuote };
  sandbox.exports = sandbox.module.exports;
  // After stripping the import, fetchIndexQuote resolves to this sandbox global.
  vm.runInNewContext(output, sandbox, { filename: tabsPath });
  return sandbox.module.exports;
}

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error });
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error });
  }
}

const mod = loadTabsModule();

// ---- Static source assertions -------------------------------------------------

check("1) market-index exposes DetailLineTab type", () => {
  assert.match(read(marketIndexPath), /export type DetailLineTab/);
  assert.match(read(marketIndexPath), /export type DetailLinePoint/);
});

check("2) US10Y uses ^TNX via fetchIndexQuote (no scaling)", () => {
  const src = read(tabsPath);
  assert.match(src, /US10Y_SYMBOL\s*=\s*"\^TNX"/);
  assert.match(src, /fetchIndexQuote\(US10Y_SYMBOL/);
});

check("3) tab builder defines Dividend / US10Y / Spread keys", () => {
  const src = read(tabsPath);
  for (const key of ['key: "dividend"', 'key: "us10y"', 'key: "spread"']) {
    assert.ok(src.includes(key), `missing ${key}`);
  }
});

check("4) Spread tab uses a zero baseline", () => {
  assert.match(read(tabsPath), /key: "spread"[\s\S]*zeroBaseline: true/);
});

check("5) tab colors use project tokens (dividend #f2994a, us10y blue, spread purple)", () => {
  const src = read(tabsPath);
  assert.match(src, /#f2994a/);
  assert.match(src, /#3b82f6/);
  assert.match(src, /#8b5cf6/);
});

check("6) modal accepts opt-in lineTabs and renders a tab bar only when provided", () => {
  const src = read(modalPath);
  assert.match(src, /lineTabs\?:\s*DetailLineTab\[\]/);
  assert.match(src, /hasTabs\s*&&/);
});

check("7) modal keeps candlestick Price behavior (MA toggles + applyVisibleRange on price tab)", () => {
  const src = read(modalPath);
  assert.match(src, /isPriceTab\s*&&\s*\(/); // MA toggles gated to price tab
  assert.match(src, /if \(isPriceTab\) \{[\s\S]*applyVisibleRange/);
});

check("8) modal does not re-resolve line data on range change (cache by tab key)", () => {
  const src = read(modalPath);
  assert.match(src, /lineCacheRef/);
  // resolve effect depends only on activeLineTab, not range
  assert.match(src, /\}, \[activeLineTab\]\);/);
});

check("9) section passes lineTabs and reuses the main TTM yield series", () => {
  const src = read(sectionPath);
  assert.match(src, /buildSchdDetailLineTabs/);
  assert.match(src, /lineTabs=\{detailLineTabs\}/);
  assert.match(src, /dividendYieldSeries[\s\S]*ttmYield/);
});

check("10) npm script registered", () => {
  const pkg = JSON.parse(read(packagePath));
  assert.equal(pkg.scripts["check:schd-detail-chart-tabs"], "node scripts/check-schd-detail-chart-tabs.mjs");
});

// ---- Behavioral assertions on the tab/spread logic ----------------------------

check("11) computeSpreadSeries = dividend - us10y, forward-filled and signed", () => {
  const dividend = [
    { date: "2026-06-24", value: 3.6 },
    { date: "2026-06-25", value: 3.5 },
  ];
  const us10y = [
    { date: "2026-06-24", value: 4.45 },
    { date: "2026-06-25", value: 4.5 },
  ];
  const spread = mod.computeSpreadSeries(dividend, us10y);
  assert.equal(spread.length, 2);
  assert.equal(Number(spread[0].value.toFixed(2)), -0.85); // 3.6 - 4.45
  assert.equal(Number(spread[1].value.toFixed(2)), -1.0); // 3.5 - 4.5 (negative allowed)
});

check("12) computeSpreadSeries forward-fills US10Y on missing trading days", () => {
  const dividend = [
    { date: "2026-06-24", value: 3.6 },
    { date: "2026-06-26", value: 3.4 }, // no us10y on the 26th -> use the 25th
  ];
  const us10y = [
    { date: "2026-06-24", value: 4.4 },
    { date: "2026-06-25", value: 4.5 },
  ];
  const spread = mod.computeSpreadSeries(dividend, us10y);
  assert.equal(spread.length, 2);
  assert.equal(Number(spread[1].value.toFixed(2)), -1.1); // 3.4 - 4.5 (carried forward)
});

await checkAsync("13) buildSchdDetailLineTabs resolves dividend (passthrough) + us10y (^TNX)", async () => {
  const dividend = [
    { date: "2026-06-24", value: 3.6 },
    { date: "2026-06-25", value: 3.5 },
  ];
  const tabs = mod.buildSchdDetailLineTabs(dividend);
  assert.equal(tabs.map((t) => t.key).join(","), "dividend,us10y,spread");
  const dividendData = await tabs[0].resolve();
  assert.equal(JSON.stringify(dividendData), JSON.stringify(dividend)); // exact same source as the main chart
  const us10yData = await tabs[1].resolve();
  assert.ok(us10yData.length >= 3 && us10yData[0].value === 4.4);
  const spreadData = await tabs[2].resolve();
  assert.equal(spreadData.length, 2);
});

for (const c of checks) console.log(`${c.ok ? "✅" : "❌"} ${c.name}`);
const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  for (const c of failed) console.error(c.error?.stack || c.error);
  process.exit(1);
}
console.log("SCHD detail chart tabs checks passed.");
