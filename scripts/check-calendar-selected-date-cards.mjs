#!/usr/bin/env node

// CALENDAR-UX-POLISH-6 — selected-date card guards.
//
// The "선택 날짜 일정" cards (components/watchlist/CalendarEventList.tsx, rendered
// via SelectedDateList) must, in light mode:
//   1. use a WHITE base (not the gray `--muted` remap of a bare dark hex),
//   2. tint hover/focus a faint sky/blue (never the near-black dark surface),
//   3. show "date · 만달러당 절세액 · 확정/예상" on the date line,
//   4. be able to surface a ticker memo on desktop (right of the badge) and on
//      mobile (below the badge), and hide it cleanly when absent (no placeholder).
//
// These are source-level structural assertions (the UX-rules script style) — no
// DOM/render is involved.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}

function assertSelectedDateCardSource() {
  const source = read("components/watchlist/CalendarEventList.tsx");

  // 1. Light-mode base is white, not a bare dark hex (which the global remap
  //    would turn into gray `--muted`).
  assert.ok(/\bbg-white\b/.test(source), "card base background is white in light mode");

  // 2. Hover/focus tint is a faint sky/blue, and the dark surface is gated behind
  //    dark: so it can never flash near-black in light mode.
  assert.ok(source.includes("hover:bg-sky-50"), "card hover is a faint sky tint");
  assert.ok(/focus-visible:bg-sky-50/.test(source), "card focus-visible is a faint sky tint");
  assert.ok(/focus-visible:ring/.test(source), "card exposes a focus-visible ring");
  assert.equal(/(?<!dark:)hover:bg-\[#1d2527\]/.test(source), false, "no bare dark hover that shows black in light mode");
  assert.equal(/(?<!dark:)hover:bg-black/.test(source), false, "no black hover on the selected-date card");
  assert.ok(source.includes("dark:bg-[#141a1b]"), "dark mode keeps the dark card surface");
  assert.ok(source.includes("dark:hover:bg-[#1d2527]"), "dark hover surface is gated behind dark:");

  // 3. Date line shows date · tax · status.
  assert.ok(source.includes("eventStatusShortLabel"), "card uses the 확정/예상 short status label");
  assert.ok(source.includes("formatTaxSavingPer10k") || source.includes("resolveTaxSavingLabel"), "card formats the per-$10k tax saving");
  assert.ok(source.includes("taxSavingByTicker"), "card takes per-ticker tax saving estimates");
  assert.ok(/\{event\.date\}\s*·\s*\{taxLabel\}\s*·\s*\{statusLabel\}/.test(source), "date line renders 'date · tax · status'");

  // 4. Memo is wired (ticker memo prop) and shown on both desktop + mobile, but
  //    only when present (no "메모 없음" placeholder spam).
  assert.ok(source.includes("tickerMemos"), "card accepts a tickerMemos prop");
  assert.ok(source.includes("lookupTickerMemo"), "card resolves memos via the shared matcher (read-only)");
  assert.ok(/memo &&/.test(source), "memo blocks are conditionally rendered (hidden when empty)");
  assert.ok(/sm:hidden/.test(source), "mobile memo block exists (sm:hidden)");
  assert.ok(/hidden[^"]*sm:block/.test(source), "desktop memo block exists (hidden … sm:block)");
  assert.ok(source.includes("line-clamp-2"), "memo clamps to two lines");
  assert.equal(source.includes("메모 없음"), false, "no '메모 없음' placeholder is rendered");

  return { ok: true };
}

function assertWiring() {
  const selected = read("components/watchlist/SelectedDateList.tsx");
  assert.ok(selected.includes("taxSavingByTicker"), "SelectedDateList forwards taxSavingByTicker");
  assert.ok(selected.includes("tickerMemos"), "SelectedDateList forwards tickerMemos");

  const page = read("components/watchlist/DividendCalendarPage.tsx");
  assert.ok(page.includes("taxSavingByTicker"), "page builds a per-ticker tax saving map");
  assert.ok(/taxSavingByTicker=\{taxSavingByTicker\}/.test(page), "page passes the tax saving map to the selected-date list");
  assert.ok(page.includes("tickerMemos"), "page threads tickerMemos to the selected-date list");

  const watchlist = read("components/watchlist/WatchlistPage.tsx");
  assert.ok(/tickerMemos=\{memos\}/.test(watchlist), "WatchlistPage passes the loaded memos down as tickerMemos");

  return { ok: true };
}

function main() {
  const card = assertSelectedDateCardSource();
  const wiring = assertWiring();
  console.log("Calendar selected-date card rules passed.");
  console.table([{ ...card, ...wiring }]);
}

main();
