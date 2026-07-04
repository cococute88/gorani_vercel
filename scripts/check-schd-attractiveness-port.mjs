import fs from 'node:fs';

const checks = [];
const read = (p) => fs.readFileSync(p, 'utf8');
const assertIncludes = (name, file, needle) => checks.push({ name, ok: read(file).includes(needle), detail: `${file} includes ${needle}` });
const assertRegex = (name, file, regex) => checks.push({ name, ok: regex.test(read(file)), detail: `${file} matches ${regex}` });

assertIncludes('original Streamlit reference documented', 'docs/SCHD_ATTRACTIVENESS_PORT1.md', 'original/pages_app/8_attractiveness_score.py');
assertIncludes('/dividends overview tab exists', 'components/dividend/DividendPage.tsx', '배당현황');
assertIncludes('/dividends SCHD tab exists', 'components/dividend/DividendPage.tsx', 'SCHD 매력도');
assertIncludes('nav dividend overview submenu exists', 'components/nav/DividendMenu.tsx', '배당현황');
assertIncludes('nav dividend SCHD submenu exists', 'components/nav/DividendMenu.tsx', 'SCHD 매력도');
assertIncludes('SCHD component exists', 'components/dividend/SchdAttractivenessSection.tsx', 'SCHD Dividend Yield TTM');
assertRegex('no sample fallback display in SCHD component', 'components/dividend/SchdAttractivenessSection.tsx', /샘플 데이터로 대체 표시하지 않습니다/);
assertRegex('latest four dividend TTM exists', 'lib/schd-attractiveness.ts', /latest four dividend|최신 4개|right < 4/);
assertRegex('52-week high drawdown exists', 'lib/schd-attractiveness.ts', /52w|365 \* 24|drawdownFrom52wHighPct/);
assertRegex('5-year average yield exists', 'lib/schd-attractiveness.ts', /fiveYearAverageYield|5 \* 365\.25/);
for (const [label, value] of [['3.4%', '0.034'], ['3.5%', '0.035'], ['3.6%', '0.036'], ['3.7%', '0.037'], ['3.8%', '0.038']]) {
  assertIncludes(`target row ${label}`, 'lib/schd-attractiveness.ts', value);
}
assertIncludes('Seeking Alpha link exists', 'lib/schd-attractiveness.ts', 'seekingalpha.com/symbol/SCHD/dividends/yield');
assertRegex('YY.MM formatter exists', 'components/dividend/SchdAttractivenessSection.tsx', /slice\(2\).*padStart\(2, "0"\)/s);
assertRegex('reference lines exist', 'components/dividend/SchdAttractivenessSection.tsx', /ReferenceLine[\s\S]*5년평균[\s\S]*y=\{3\.5\}[\s\S]*y=\{3\.6\}[\s\S]*y=\{3\.7\}[\s\S]*y=\{3\.8\}/);
assertIncludes('unavailable state exists', 'components/dividend/SchdAttractivenessSection.tsx', '조회 불가');
assertIncludes('overview import intact', 'components/dividend/DividendPage.tsx', 'DividendSummaryCards');

const failed = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? '✅' : '❌'} ${c.name}`);
if (failed.length) {
  console.error(failed.map((c) => c.detail).join('\n'));
  process.exit(1);
}
