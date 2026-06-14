#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = require("typescript");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
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
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { buildTaxSavingRows } = require("../lib/mock-calendar-data.ts");
const {
  splitEconomicEventsByWeek,
  STATIC_US_ECONOMIC_EVENTS,
  formatEconomicEventDate,
} = require("../lib/economic-calendar-data.ts");

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}

// ---------------------------------------------------------------------------
// 1. Tax table: buy-this-month tickers sorted first + highlight flag
// ---------------------------------------------------------------------------
function assertTaxSavingSortAndHighlight() {
  const events = [
    { ticker: "BUYHI", type: "ex_div", date: "2026-06-20", dividendAmount: 0.5, sourceKind: "declared" },
    { ticker: "BUYHI", type: "buy_by", date: "2026-06-19", dividendAmount: 0.5, sourceKind: "declared" },
    { ticker: "BUYLO", type: "ex_div", date: "2026-06-21", dividendAmount: 0.1, sourceKind: "declared" },
    { ticker: "BUYLO", type: "buy_by", date: "2026-06-20", dividendAmount: 0.1, sourceKind: "declared" },
    { ticker: "NOBUY", type: "ex_div", date: "2026-06-22", dividendAmount: 0.9, sourceKind: "declared" },
  ];
  const rows = buildTaxSavingRows(events, {
    todayIso: "2026-06-13",
    quoteByTicker: {
      BUYHI: { price: 100, source: "live" },
      BUYLO: { price: 100, source: "live" },
      NOBUY: { price: 100, source: "live" },
    },
  });

  assert.equal(rows.length, 3, "one row per ticker");
  // NOBUY has the highest tax saving but no buy event, so it must sink below both buy tickers.
  assert.deepEqual(rows.map((row) => row.ticker), ["BUYHI", "BUYLO", "NOBUY"], "buy tickers sort above non-buy even with lower tax");
  assert.equal(rows[0].shouldBuyThisMonth, true, "BUYHI is flagged for highlight");
  assert.equal(rows[1].shouldBuyThisMonth, true, "BUYLO is flagged for highlight");
  assert.equal(rows[2].shouldBuyThisMonth, false, "NOBUY is not highlighted");
  assert.ok(rows[0].taxSavingUsd > rows[1].taxSavingUsd, "within the buy group, higher tax sorts first");
  assert.ok(rows[2].taxSavingUsd > rows[0].taxSavingUsd, "fixture: NOBUY genuinely has the highest tax saving");

  return { order: rows.map((row) => row.ticker), highlighted: rows.filter((row) => row.shouldBuyThisMonth).length };
}

// ---------------------------------------------------------------------------
// 2. Economic calendar: this-week / next-week split, not dividend events
// ---------------------------------------------------------------------------
function assertEconomicWeekSplit() {
  const today = new Date("2026-06-14T00:00:00");
  const weeks = splitEconomicEventsByWeek(today, STATIC_US_ECONOMIC_EVENTS);

  assert.equal(weeks.thisWeek.label, "이번주");
  assert.equal(weeks.nextWeek.label, "다음주");
  assert.equal(weeks.source, "static");
  assert.ok(weeks.thisWeek.events.length > 0, "this week has events");
  assert.ok(weeks.nextWeek.events.length > 0, "next week has events");

  // Boundaries: this week = today..+6, next week = today+7..+13, disjoint.
  for (const event of weeks.thisWeek.events) {
    assert.ok(event.date >= weeks.thisWeek.startIso && event.date <= weeks.thisWeek.endIso, "this-week event within range");
  }
  for (const event of weeks.nextWeek.events) {
    assert.ok(event.date >= weeks.nextWeek.startIso && event.date <= weeks.nextWeek.endIso, "next-week event within range");
  }
  const thisDates = new Set(weeks.thisWeek.events.map((event) => event.date));
  for (const event of weeks.nextWeek.events) {
    assert.equal(thisDates.has(event.date), false, "this/next week dates are disjoint");
  }

  // Known fixtures: FOMC week (6/18) in this week, PCE/GDP (6/25) in next week.
  assert.ok(weeks.thisWeek.events.some((event) => event.date === "2026-06-18"), "FOMC day lands in this week");
  assert.ok(weeks.nextWeek.events.some((event) => event.date === "2026-06-25"), "PCE day lands in next week");

  // Economic events must NOT be dividend events.
  for (const event of [...weeks.thisWeek.events, ...weeks.nextWeek.events]) {
    assert.ok(typeof event.name === "string" && event.name.length > 0, "event has a name");
    assert.ok(typeof event.time === "string", "event has a time");
    assert.ok(["high", "medium", "low"].includes(event.importance), "event has importance");
    assert.equal("ticker" in event, false, "economic event has no ticker (not a dividend event)");
    assert.equal("dividendAmount" in event, false, "economic event has no dividendAmount");
  }

  // Sorted by date then time.
  const flat = weeks.thisWeek.events;
  for (let i = 1; i < flat.length; i += 1) {
    assert.ok(`${flat[i - 1].date} ${flat[i - 1].time}` <= `${flat[i].date} ${flat[i].time}`, "this week sorted by date/time");
  }

  assert.equal(formatEconomicEventDate("2026-06-18"), "6/18(목)", "date label includes weekday");

  return {
    thisWeek: weeks.thisWeek.events.length,
    nextWeek: weeks.nextWeek.events.length,
    range: [weeks.thisWeek.rangeLabel, weeks.nextWeek.rangeLabel],
  };
}

// ---------------------------------------------------------------------------
// 3. UI source rules
// ---------------------------------------------------------------------------
function assertTaxTableSource() {
  const source = read("components/watchlist/TaxSavingTable.tsx");
  const colCount = (source.match(/<col\s/g) ?? []).length;
  assert.equal(colCount, 2, "tax table has exactly two columns (Buy column removed)");
  assert.equal(/>Buy</.test(source), false, "no Buy button/label remains");
  assert.equal(source.includes("overflow-y-auto"), true, "tax table body scrolls internally");
  assert.equal(/max-h-\[\d+px\]/.test(source), true, "tax table caps its height");
  assert.equal(source.includes("bg-blue-500/10"), true, "highlight uses a light blue row tint");
  assert.equal(source.includes("shouldBuyThisMonth"), true, "highlight is driven by shouldBuyThisMonth");

  return { colCount };
}

function assertEconomicSectionSource() {
  const source = read("components/watchlist/EconomicCalendarSection.tsx");
  assert.equal(source.includes("splitEconomicEventsByWeek"), true, "economic section uses the week splitter");
  assert.equal(source.includes("lg:grid-cols-2"), true, "economic section is a 2-column grid on desktop");
  assert.equal(source.includes("overflow-y-auto"), true, "long week table scrolls internally");
  assert.equal(source.includes("주요 미국 경제 일정"), true, "section keeps the original Streamlit title");
  assert.equal(source.includes("mock-calendar-data"), false, "economic section does not reuse dividend event data");

  return { ok: true };
}

function assertPageWiring() {
  const source = read("components/watchlist/DividendCalendarPage.tsx");
  assert.equal(source.includes("EconomicCalendarSection"), true, "page renders the economic section");
  assert.equal(source.includes("이번 달 주요 일정"), false, "the dividend-event '이번 달 주요 일정' list is gone");
  assert.equal(source.includes("260px"), true, "right rail width is reduced");
  // Regression guards: import/calendar plumbing stays intact.
  assert.equal(source.includes("loadLegacyImportedCalendarEvents"), true, "legacy imported events still load");
  assert.equal(source.includes("mergeGeneratedAndCustomCalendarEvents"), true, "custom event merge still wired");
  assert.equal(source.includes("DividendSchedulePreview"), true, "full dividend schedule preview still present");

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 4. 전체 배당 일정 table: column order, sort, filter, earnings policy, 12-row scroll
// ---------------------------------------------------------------------------
function assertSchedulePreviewSource() {
  const source = read("components/watchlist/DividendSchedulePreview.tsx");

  // Korean column order: 종목 / 타입 / 상태 / 배당금 / 매수마감일 / 배당락일 / 지급일
  const order = ["종목", "타입", "상태", "배당금", "매수마감일", "배당락일", "지급일"];
  let cursor = -1;
  for (const label of order) {
    const next = source.indexOf(`label: "${label}"`);
    assert.ok(next > cursor, `column "${label}" appears in the requested order`);
    cursor = next;
  }

  // Sortable columns + arrow indicators.
  assert.ok(source.includes("toggleSort"), "columns are sortable via toggleSort");
  assert.ok(source.includes("▲") && source.includes("▼"), "asc/desc arrows present");

  // Event type filter defaults to all checked.
  assert.ok(/ex_div:\s*true/.test(source) && /buy_by:\s*true/.test(source) && /pay:\s*true/.test(source) && /earnings:\s*true/.test(source), "all event types default checked");

  // Earnings policy: dividend/buy/payment blanked, exDiv = event date.
  assert.ok(source.includes('type === "earnings"'), "earnings rows handled specially");

  // 12-row cap + internal scroll + sticky header.
  assert.ok(/max-h-\[\d+px\]/.test(source), "schedule body caps height (~12 rows)");
  assert.ok(source.includes("overflow-auto"), "schedule body scrolls internally");
  assert.ok(source.includes("sticky top-0"), "schedule header is sticky");

  // Custom events excluded from this master table (they live on the grid).
  assert.equal(source.includes('"custom"'), false, "custom type is not a table column/filter");

  return { columns: order.length };
}

// ---------------------------------------------------------------------------
// 5. Calendar grid: light hover, custom date-line text, muted (not grayscale) past
// ---------------------------------------------------------------------------
function assertGridSource() {
  const grid = read("components/watchlist/CalendarGrid.tsx");
  assert.ok(grid.includes("hover:bg-sky-50"), "light day hover is a faint sky tint");
  assert.ok(grid.includes("dark:hover:bg-[#1e2628]"), "the dark surface hover is gated behind dark:");
  assert.equal(/(?<!dark:)hover:bg-\[#1e2628\]/.test(grid), false, "no bare dark hover that would show black in light mode");
  assert.ok(grid.includes("customEvents"), "grid takes a separate always-on customEvents prop");
  assert.ok(grid.includes('event.type === "custom"') || grid.includes('type === "custom"'), "custom events are pulled out of chip slots");

  // CALENDAR-UX-POLISH-5: every day cell stacks its content from the very top.
  // The cell is a top-anchored flex column (justify-start): the date line is the
  // first normal-flow row and the chip block stacks directly beneath it. The old
  // "absolute top line + pt-7 chip flow" let the <button> UA layout vertically
  // center the in-flow chips, floating them to the middle of the cell with a big
  // gap — so it is now forbidden, along with any vertical centering of the stack.
  assert.ok(/relative flex min-h-\[72px\] flex-col justify-start[^"]*sm:min-h-\[100px\]/.test(grid), "day cell is a top-anchored flex column (justify-start)");
  assert.ok(/flex h-5 shrink-0 items-start gap-1[^"]*sm:h-6/.test(grid), "date line is the first top-anchored row with a fixed height");
  assert.ok(/mt-0\.5 flex min-h-0 min-w-0 flex-col justify-start gap-0\.5[^"]*overflow-hidden/.test(grid), "chip container stacks directly below the date line (justify-start, small gap)");
  assert.equal(/\bpt-7\b|\bpt-8\b/.test(grid), false, "no pt-7/pt-8 chip-clearing offset (old absolute-top-line approach removed)");
  assert.equal(/absolute inset-x-1 top-1/.test(grid), false, "day-cell top line is no longer absolutely pinned");
  // The day-cell vertical stack must never center its content. The only
  // legitimate centering left is the round day-number badge (items-center
  // justify-center inside an h-5 w-5 circle) and the month-nav header
  // (items-center justify-between), so check the stack containers specifically.
  const dayCellColumn = (grid.match(/"relative flex min-h-\[72px\][^"]*"/) ?? [""])[0];
  const chipContainer = (grid.match(/"mt-0\.5 flex min-h-0[^"]*"/) ?? [""])[0];
  for (const banned of ["justify-center", "justify-between", "place-content-center", "place-items-center", "items-center"]) {
    assert.equal(dayCellColumn.includes(banned), false, `day-cell column must not use "${banned}" (top-anchored only)`);
    assert.equal(chipContainer.includes(banned), false, `chip container must not use "${banned}" (top-anchored only)`);
  }
  // Unnecessary legend explanations are removed.
  assert.equal(grid.includes("사용자/경제 일정 = 날짜 옆 텍스트"), false, "redundant '사용자/경제 일정' legend text removed");
  assert.equal(grid.includes("점선 = 추정"), false, "redundant '점선 = 추정' legend text removed");

  const visuals = read("lib/event-visuals.ts");
  assert.equal(visuals.includes("grayscale"), false, "past events no longer fully grayscale (keep type color)");
  assert.ok(/isPast \? "opacity-/.test(visuals), "past events get a muted opacity veil");
  // Non-declared (estimated) events are faded (~30-40%) but past events keep a
  // lighter veil — the estimated opacity must be the strongest fade.
  assert.ok(/estimated \? "opacity-40"/.test(visuals), "estimated events get the strongest opacity fade (~40%)");
  assert.ok(visuals.includes("border-dashed"), "estimated events stay dashed");

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 6. Ticker manager + portfolio manage modal + memo dialog wiring
// ---------------------------------------------------------------------------
function assertTickerAndMemoWiring() {
  const tickerManager = read("components/watchlist/TickerManager.tsx");
  assert.ok(tickerManager.includes("onTickerClick"), "ticker chip click opens memo");
  assert.equal(tickerManager.includes("onRemove"), false, "lower ticker chips no longer expose delete");
  assert.equal(/<X\s/.test(tickerManager), false, "no X delete icon in lower ticker grid");
  // CALENDAR-UX-POLISH-3: misleading "포트폴리오 보유종목 연동됨" badge is gone.
  assert.equal(tickerManager.includes("포트폴리오 보유종목 연동됨"), false, "misleading portfolio-linked badge removed");
  assert.equal(tickerManager.includes("fromPortfolio"), false, "fromPortfolio prop removed");

  const manageModal = read("components/watchlist/PortfolioManageModal.tsx");
  assert.ok(manageModal.includes("기본 포트폴리오 관리"), "manage modal title present");
  assert.ok(manageModal.includes("onAdd") && manageModal.includes("onRemove"), "manage modal can add/remove tickers");

  const memoDialog = read("components/watchlist/TickerMemoDialog.tsx");
  assert.ok(memoDialog.includes("종목 메모"), "memo dialog present");
  assert.ok(memoDialog.includes("onSave"), "memo dialog saves");

  const page = read("components/watchlist/WatchlistPage.tsx");
  assert.ok(page.includes("loadLegacyDividendCalendarMemos"), "legacy memos load on the page");
  assert.ok(page.includes("PortfolioManageModal") && page.includes("TickerMemoDialog"), "page renders both new dialogs");
  assert.ok(page.includes("onManagePortfolio"), "manage button wired to modal");
  // CALENDAR-UX-POLISH-3: calendar tickers come from the legacy calendar source,
  // NOT from /portfolio snapshot holdings.
  assert.ok(page.includes("resolveCalendarTickers"), "page resolves tickers via the legacy calendar source");
  assert.ok(page.includes("loadLegacyDividendCalendarPortfolios"), "page loads legacy portfolios as a ticker source");
  assert.equal(page.includes("usePortfolioSnapshots"), false, "page no longer derives tickers from /portfolio snapshots");
  assert.equal(page.includes("applyKrxTickerMappingsToHoldings"), false, "page no longer maps portfolio holdings into tickers");

  return { ok: true };
}

function main() {
  const taxSort = assertTaxSavingSortAndHighlight();
  const econ = assertEconomicWeekSplit();
  const taxSource = assertTaxTableSource();
  const econSource = assertEconomicSectionSource();
  const pageWiring = assertPageWiring();
  const schedule = assertSchedulePreviewSource();
  const grid = assertGridSource();
  const tickerMemo = assertTickerAndMemoWiring();

  console.log("Calendar UX rules passed.");
  console.table([taxSort]);
  console.table([econ]);
  console.table([{ ...taxSource, ...econSource, ...pageWiring, ...schedule, ...grid, ...tickerMemo }]);
}

main();
