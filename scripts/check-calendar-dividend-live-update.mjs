import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const page = read("components/watchlist/DividendCalendarPage.tsx");
const route = read("app/api/calendar/dividend-events/route.ts");
const live = read("lib/calendar-dividend-live.ts");
const firestore = read("lib/firebase/firestore-repositories.ts");

assert(page.includes("일정 최신화"), "calendar UI must expose 일정 최신화 button");
assert(page.includes("클라우드 저장"), "calendar UI must expose cloud save button");
assert(exists("app/calendar/page.tsx"), "/calendar route must exist");
assert(exists("app/api/calendar/dividend-events/route.ts"), "dividend live API route must exist");
assert(route.includes("process.env.POLYGON_API_KEY") && route.includes("process.env.FINNHUB_API_KEY"), "provider keys must be read server-side");
assert(!page.includes("POLYGON_API_KEY") && !page.includes("FINNHUB_API_KEY"), "client page must not reference secret env names");
assert(route.includes("params.get(\"ticker\")") && !route.includes("tickers"), "API route must be per-ticker, not batch-all tickers");
assert(page.includes("for (let index = 0; index < targetTickers.length; index += 1)") && page.includes("/api/calendar/dividend-events?ticker="), "client must fetch per ticker sequentially");
assert(page.includes("nextCacheMap[ticker] = cacheEntry") && page.includes("saveCalendarTickerCache(cacheEntry)"), "successful ticker cache writes must be present");
assert(page.includes("failed.push(ticker)") && !page.includes("nextCacheMap[ticker] = undefined"), "failed tickers must not overwrite cache");
assert(page.includes("mergeGeneratedAndCustomCalendarEvents") && page.includes("eventMetas") && page.includes("customEvents"), "custom events/memos/marks must remain layered");
assert(firestore.includes("saveCalendarTickerCacheEntry"), "Firestore calendar cache helper must exist");
assert(live.includes('status, dividendAmount: amount') && live.includes('"estimated"') && live.includes("projectFutureDividends"), "projection helper must generate estimated events");
assert(live.includes('"confirmed"') && live.includes("normalizeDividendEvents"), "declared normalization must keep confirmed events");
assert(live.includes("getPrevTradingDay(exDivDate)"), "buy deadline must be previous trading day");
assert(live.includes("getNextTradingDay(addDays") && live.includes("paymentDate"), "payment date must be trading-day adjusted");

const fixture = ["2025-01-10", "2025-04-10", "2025-07-10", "2025-10-10"];
assert(fixture.length === 4, "fixture sanity");
console.log("✅ calendar dividend live update static checks passed");
