import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const schdPath = 'lib/schd-attractiveness.ts';
const componentPath = 'components/dividend/SchdAttractivenessSection.tsx';
const quoteFetcherPath = 'lib/server/quote-fetchers.ts';
const packagePath = 'package.json';

const schdSource = fs.readFileSync(schdPath, 'utf8');
const componentSource = fs.readFileSync(componentPath, 'utf8');
const fetcherSource = fs.readFileSync(quoteFetcherPath, 'utf8');

function loadTsModule(filename) {
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/^import type[^;]+;\n/gm, '')
    .replace(/^import [^;]+;\n/gm, '');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  }).outputText;
  const sandbox = { exports: {}, module: { exports: {} }, require, console };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(output, sandbox, { filename });
  return sandbox.module.exports;
}

const mod = loadTsModule(schdPath);

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error });
  }
}

function makeHistory(days, start = '2026-05-01') {
  const startDate = new Date(`${start}T00:00:00Z`);
  const prices = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(startDate);
    d.setUTCDate(startDate.getUTCDate() + i);
    const day = d.getUTCDay();
    if (day === 0 || day === 6) continue;
    const close = 72 + Math.sin(i / 3) * 1.5 + i * 0.015;
    prices.push({ date: d.toISOString().slice(0, 10), open: close - 0.2, high: close + 0.5, low: close - 0.6, close, volume: 1_000_000 });
  }
  return { ticker: 'SCHD', normalizedTicker: 'SCHD', source: 'yahoo', updatedAt: 'fixture', warnings: [], prices };
}

const dividends = {
  ticker: 'SCHD', normalizedTicker: 'SCHD', source: 'yahoo', updatedAt: 'fixture', warnings: [],
  dividends: [
    { date: '2025-06-25', amount: 0.82 },
    { date: '2025-09-25', amount: 0.84 },
    { date: '2025-12-24', amount: 0.86 },
    { date: '2026-03-25', amount: 0.88 },
    { date: '2026-06-25', amount: 0.9 },
  ],
};

check('1) no forced monthly-only interval or monthly bucket in SCHD implementation', () => {
  assert.doesNotMatch(`${schdSource}\n${componentSource}`, /interval\s*[:=]\s*["']1mo["']|month(?:ly)?\s+(?:start|bucket|only)|월별\s*1개/i);
});

check('2) quote fetcher requests Yahoo 1d daily history', () => {
  assert.match(fetcherSource, /url\.searchParams\.set\("interval", "1d"\)/);
});

check('3) TTM yield points are built from price dates, not dividend event dates only', () => {
  assert.match(schdSource, /const priceDates = prices\.map/);
  assert.match(schdSource, /prices\.map\(\(price, index\)/);
});

check('4) 1M fixture produces at least 10 chart points', () => {
  const metrics = mod.calculateSchdAttractiveness(makeHistory(45), dividends);
  const month = mod.filterSchdRange(metrics.points, '1M').filter((p) => Number.isFinite(p.ttmYield));
  assert.ok(month.length >= 10, `got ${month.length}`);
});

check('5) 1Y fixture is not reduced to monthly-only density', () => {
  const metrics = mod.calculateSchdAttractiveness(makeHistory(410, '2025-05-01'), dividends);
  const year = mod.filterSchdRange(metrics.points, '1Y').filter((p) => Number.isFinite(p.ttmYield));
  assert.ok(year.length > 52, `got ${year.length}`);
});

check('6) y-value uses ttmDividend / price.close * 100', () => {
  const metrics = mod.calculateSchdAttractiveness(makeHistory(45), dividends);
  const p = metrics.points.find((point) => Number.isFinite(point.ttmDividend) && Number.isFinite(point.ttmYield));
  assert.ok(p);
  assert.equal(Number(p.ttmYield.toFixed(8)), Number(((p.ttmDividend / p.price) * 100).toFixed(8)));
});

check('7) chart x-axis formatter keeps YY.MM labels', () => {
  assert.match(componentSource, /slice\(2\).*getUTCMonth\(\) \+ 1[\s\S]*padStart\(2, "0"\)/);
  assert.match(componentSource, /tickFormatter=\{fmtDateTick\}/);
});

check('8) target price table logic remains latest TTM dividend / target yield', () => {
  assert.match(schdSource, /latest\.ttmDividend \/ targetYield/);
  assert.match(schdSource, /recentQuarterDividend \* 4\) \/ targetYield/);
});

check('9) no mock/sample fallback is displayed for SCHD attractiveness', () => {
  assert.match(schdSource, /source === "sample"/);
  assert.match(componentSource, /샘플 데이터로 대체 표시하지 않습니다/);
});

check('10) npm script is registered', () => {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  assert.equal(pkg.scripts['check:schd-attractiveness-dense-data'], 'node scripts/check-schd-attractiveness-dense-data.mjs');
});

check('11) target-yield rows include 3.4% without removing existing rows', () => {
  assert.deepEqual(Array.from(mod.SCHD_TARGET_YIELDS), [0.034, 0.035, 0.036, 0.037, 0.038]);
});

check('12) completion uses occupied quarters, not duplicate payment count', () => {
  const history = mod.buildSchdDividendHistories([
    { date: '2021-03-24', amount: 0.5 },
    { date: '2021-06-23', amount: 0.5 },
    { date: '2021-09-22', amount: 0.5 },
    { date: '2021-12-08', amount: 0.5 },
    { date: '2022-03-23', amount: 0.5 },
    { date: '2022-06-22', amount: 0.5 },
    { date: '2022-06-29', amount: 0.1 },
    { date: '2022-09-21', amount: 0.5 },
    { date: '2022-12-07', amount: 0.5 },
    { date: '2023-03-22', amount: 0.5 },
    { date: '2023-06-21', amount: 0.5 },
  ], []);
  assert.equal(history.growth.find((row) => row.year === 2021)?.complete, true);
  assert.equal(history.growth.find((row) => row.year === 2023)?.complete, false);
});

for (const c of checks) console.log(`${c.ok ? '✅' : '❌'} ${c.name}`);
const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  for (const c of failed) console.error(c.error?.stack || c.error);
  process.exit(1);
}
console.log('SCHD attractiveness dense data checks passed.');
