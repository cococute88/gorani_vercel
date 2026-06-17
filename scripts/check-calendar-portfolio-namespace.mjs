import fs from "node:fs";

const checks = [
  ["activePortfolio settings", "lib/firebase/firestore-repositories.ts", /calendarSettings"?,\s*"default|activePortfolioId/],
  ["portfolio namespace", "lib/firebase/firestore-repositories.ts", /calendarPortfolios/],
  ["activePortfolio state", "components/watchlist/WatchlistPage.tsx", /activePortfolioId/],
  ["new portfolio button", "components/watchlist/DividendCalendarPage.tsx", /포트폴리오 관리/],
  ["ticker button renamed", "components/watchlist/DividendCalendarPage.tsx", /종목 관리/],
  ["current portfolio label", "components/watchlist/DividendCalendarPage.tsx", /현재 포트폴리오:/],
  ["legacy label removed", "components/watchlist/TickerManager.tsx", /^(?![\s\S]*배당캘린더 티커 · legacy 메모 연동)[\s\S]*$/],
  ["default-only fallback", "components/watchlist/WatchlistPage.tsx", /activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID/],
  ["empty new portfolio", "components/watchlist/WatchlistPage.tsx", /fallbackTickers: activePortfolioId === DEFAULT_CALENDAR_PORTFOLIO_ID \? DEFAULT_WATCHLIST_TICKERS : \[\]/],
  ["refresh active tickers", "components/watchlist/DividendCalendarPage.tsx", /const uniqueTickers = Array\.from\(new Set\(tickers/],
  ["filter cache tickers", "components/watchlist/DividendCalendarPage.tsx", /activeTickerSet\.has\(event\.ticker\)/],
  ["custom namespace", "lib/firebase/firestore-repositories.ts", /calendarCustomEvents/],
  ["meta namespace", "lib/firebase/firestore-repositories.ts", /calendarEventMetas/],
  ["sanitize undefined", "lib/firebase/firestore-repositories.ts", /sanitizeFirestorePayload/],
  ["display profile repo", "lib/firebase/firestore-repositories.ts", /users", uid, "profile", "display/],
  ["nav displayName priority", "components/auth/LoginButton.tsx", /profile\?\.displayName \|\| fallbackName/],
];

let failed = 0;
for (const [name, file, pattern] of checks) {
  const text = fs.readFileSync(file, "utf8");
  if (!pattern.test(text)) { console.error(`FAIL ${name}`); failed += 1; }
  else console.log(`PASS ${name}`);
}
process.exit(failed ? 1 : 0);
