import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const nav = read("lib/mockData.ts");
const topNav = read("components/TopNav.tsx");
const calendarPage = read("app/calendar/page.tsx");
const legacyPage = read("app/watchlist/page.tsx");
const provider = read("scripts/check-calendar-provider.mjs");

assert.ok(existsSync("app/calendar/page.tsx"), "canonical /calendar page exists");
assert.ok(existsSync("app/watchlist/page.tsx"), "legacy /watchlist page exists so bookmarks do not 404");

assert.match(nav, /label:\s*"배당캘린더",\s*href:\s*"\/calendar"/, "navbar 배당캘린더 href is /calendar");
assert.doesNotMatch(nav, /label:\s*"배당캘린더",\s*href:\s*"\/watchlist"/, "navbar has no direct /watchlist calendar link");

assert.match(legacyPage, /redirect\(\s*["']\/calendar["']\s*\)/, "/watchlist redirects to /calendar");
assert.doesNotMatch(legacyPage, /<WatchlistPage\s*\/>/, "legacy page does not render canonical UI in-place");

assert.match(calendarPage, /title:\s*"배당캘린더"/, "/calendar metadata title is 배당캘린더");
assert.match(calendarPage, /description:\s*"배당락, 매수마감, 지급, 실적 일정을 확인하는 페이지"/, "/calendar metadata description is calendar-specific");
assert.match(calendarPage, /canonical:\s*"\/calendar"/, "/calendar declares canonical metadata");
const metadataBlock = calendarPage.slice(calendarPage.indexOf("export const metadata"), calendarPage.indexOf("export default"));
assert.doesNotMatch(metadataBlock, /watchlist/i, "canonical page metadata has no user-facing watchlist string");

assert.match(topNav, /normalizeActivePath/, "TopNav normalizes legacy routes for active state");
assert.match(topNav, /path === "\/watchlist" \|\| path\?\.startsWith\("\/watchlist\/"\)/, "legacy /watchlist active state maps to calendar");
assert.match(topNav, /activePathname === href \|\| activePathname\?\.startsWith/, "active nav uses normalized pathname");

assert.match(provider, /mergeGeneratedAndCustomCalendarEvents/, "calendar provider/custom event regression check remains present");
assert.match(provider, /buildCalendarTickerCacheFromEvents/, "calendar cache regression check remains present");

const firestoreFiles = [
  "lib/firebase/calendar-events.ts",
  "lib/firebase/calendar-meta.ts",
  "lib/firebase/calendar-manual-tickers.ts",
].filter(existsSync).map(read).join("\n");
assert.doesNotMatch(firestoreFiles, /watchlist/i, "Firestore calendar helpers do not introduce route-based watchlist schema names");

console.log("route naming legacy audit checks passed");
