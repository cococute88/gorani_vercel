import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const watchlistPage = read("components/watchlist/WatchlistPage.tsx");
const page = read("components/watchlist/DividendCalendarPage.tsx");
const grid = read("components/watchlist/CalendarGrid.tsx");
const visuals = read("lib/event-visuals.ts");

// ---------------------------------------------------------------------------
// 1. Wide container — /calendar (watchlist) page uses the same wide max-width as
//    /portfolio (GORAFI logo → Logout edge), not the old narrow 1280 container.
// ---------------------------------------------------------------------------
assert.match(watchlistPage, /max-w-\[1640px\]/, "watchlist main uses the wide 1640px container");
assert.doesNotMatch(watchlistPage, /max-w-\[1280px\]/, "narrow 1280px container is gone");

// ---------------------------------------------------------------------------
// 2. Top 필터 card + 포트폴리오 selector card removed from the calendar page.
// ---------------------------------------------------------------------------
assert.doesNotMatch(page, /PortfolioSelectorMock/, "top 포트폴리오 selector card removed");
assert.doesNotMatch(page, /필터<\/h2>/, "top 필터 card heading removed");
assert.doesNotMatch(page, /FILTER_ORDER/, "top filter button loop removed");

// ---------------------------------------------------------------------------
// 3. Calendar bottom toolbar drives filter state + hosts the add button.
// ---------------------------------------------------------------------------
assert.match(grid, /onToggleFilter:\s*\(type: CalendarEventType\) => void/, "grid accepts a filter toggle handler");
assert.match(grid, /onClick=\{\(\) => onToggleFilter\(type\)\}/, "bottom legend buttons toggle the filter");
assert.match(grid, /aria-pressed=\{active\}/, "filter toggle exposes ON/OFF state");
assert.match(grid, /opacity-60/, "OFF filter toggles render faint");
assert.match(grid, /onClick=\{onAddEvent\}/, "add-event button lives on the calendar toolbar");
assert.match(grid, /\+ 일정 추가/, "add-event button keeps its label");
assert.match(
  page,
  /onToggleFilter=\{\(type\) => setFilters\(\(current\) => \(\{ \.\.\.current, \[type\]: !current\[type\] \}\)\)\}/,
  "page wires the existing filter state into the grid toggle",
);
assert.match(page, /onAddEvent=\{openCreateCustomEvent\}/, "page wires the existing custom-event creator into the grid");

// ---------------------------------------------------------------------------
// 4. Portfolio management merged into the 티커 관리 section header.
// ---------------------------------------------------------------------------
assert.match(page, /포트폴리오 관리/, "티커 관리 header hosts a 포트폴리오 관리 button");
assert.match(page, /onClick=\{onManagePortfolio\}/, "포트폴리오 관리 button opens the existing manage modal");

// ---------------------------------------------------------------------------
// 5. Calendar cell height increased + four chips before the +N pill.
// ---------------------------------------------------------------------------
assert.match(grid, /sm:min-h-\[140px\]/, "calendar day cell min-height increased for tablet+");
assert.match(grid, /lg:min-h-\[152px\]/, "calendar day cell min-height increased for desktop");
assert.match(grid, /dayEvents\.slice\(0, 4\)/, "up to four chips render before the +N pill");

// ---------------------------------------------------------------------------
// 6. Chip tax-saving amount reuses the real numeric tax value (no hardcoding).
// ---------------------------------------------------------------------------
assert.match(visuals, /export function formatTaxSavingChipAmount/, "chip tax-amount formatter exists");
assert.match(visuals, /value\.toFixed\(2\)/, "chip tax amount renders two decimals like the rail table");
assert.match(grid, /taxSavingByTicker\?\.\[event\.ticker\.trim\(\)\.toUpperCase\(\)\]/, "chip reads per-ticker tax saving");
assert.match(grid, /formatTaxSavingChipAmount\(taxRow\.taxSavingUsd\)/, "chip formats the real numeric tax value");
assert.match(page, /taxSavingByTicker=\{taxSavingByTicker\}/, "page passes the shared tax map into the grid");

// ---------------------------------------------------------------------------
// 7. Right 절세액 rail width stays narrow (not widened beyond a reasonable cap).
// ---------------------------------------------------------------------------
const railMatch = page.match(/xl:grid-cols-\[minmax\(0,1fr\)_(\d+)px\]/);
assert.ok(railMatch, "main content grid keeps a fixed-width right rail");
const railWidth = Number(railMatch[1]);
assert.ok(railWidth >= 240 && railWidth <= 320, `절세액 rail width stays in a reasonable band (got ${railWidth}px)`);

console.log("calendar wide layout polish checks passed");
