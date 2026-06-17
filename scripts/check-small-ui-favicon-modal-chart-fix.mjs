import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const expect = (condition, message) => {
  if (!condition) fail(message);
  else console.log(`PASS: ${message}`);
};

const loginButton = read("components/auth/LoginButton.tsx");
const dividendCapture = read("components/calculator/DividendCaptureSimulator.tsx");
const layout = read("app/layout.tsx");
const calculator = read("lib/dividend-capture-calculator.ts");

expect(/bg-(white|slate-50)/.test(loginButton), "display-name modal input has a light background class");
expect(/dark:bg-slate-(900|950)/.test(loginButton), "display-name modal input keeps an explicit dark background class");
expect(/text-slate-900/.test(loginButton) && /dark:text-slate-100/.test(loginButton), "display-name modal input declares readable light/dark text colors");
expect(/placeholder:text-slate-400/.test(loginButton) && /dark:placeholder:text-slate-500/.test(loginButton), "display-name modal input declares light/dark placeholder colors");
expect(/focus-visible:ring-2/.test(loginButton) && /focus-visible:ring-blue-500/.test(loginButton), "display-name modal input exposes a visible focus ring");

expect(/buildDividendCaptureAxisTicks/.test(dividendCapture), "dividend-capture chart uses dedicated axis tick builder");
expect(/SIX_MONTHS\s*=\s*6/.test(dividendCapture) && /addUtcMonths\(cursor, SIX_MONTHS\)/.test(dividendCapture), "dividend-capture chart builds semiannual tick candidates");
expect(/nearestDividendCaptureTick/.test(dividendCapture), "dividend-capture chart maps tick candidates to real sorted row dates");
expect(/\.sort\(\(a, b\) => a\.exDate\.localeCompare\(b\.exDate\)\)/.test(dividendCapture), "dividend-capture chart rows are sorted by exDate ascending");
expect(/tickFormatter=\{formatDividendCaptureAxisTick\}/.test(dividendCapture), "dividend-capture XAxis uses the dedicated date formatter");
expect(/interval=\{0\}/.test(dividendCapture) && /minTickGap=\{16\}/.test(dividendCapture) && /ticks=\{chartTicks\}/.test(dividendCapture), "dividend-capture XAxis explicitly controls tick density");
expect(/slice\(2\)/.test(dividendCapture) && /padStart\(2, "0"\)/.test(dividendCapture) && /return `\$\{String\(date\.getUTCFullYear\(\)\)\.slice\(2\)\}\.\$\{String\(date\.getUTCMonth\(\) \+ 1\)\.padStart\(2, "0"\)\}`;/.test(dividendCapture), "dividend-capture axis formatter emits YY.MM labels");

expect(/icons:\s*\{[\s\S]*icon:\s*"\/gorani-logo\.png"[\s\S]*shortcut:\s*"\/gorani-logo\.png"[\s\S]*apple:\s*"\/gorani-logo\.png"[\s\S]*\}/.test(layout), "metadata icons point to public/gorani-logo.png");
expect(fs.existsSync("public/gorani-logo.png"), "public/gorani-logo.png exists");

expect(/buildDividendCaptureRowsFromStreamlitLogic/.test(calculator) && /summarizeDividendCaptureRows/.test(calculator), "dividend-capture calculator parity anchors are still present");

if (process.exitCode) process.exit(process.exitCode);
