export const STORAGE_KEYS = {
  portfolioSnapshots: "qld2.portfolio.snapshots.v1",
  // 사용자가 히스토리에서 삭제한 스냅샷 날짜(YYYY-MM-DD)의 영구 묘비(tombstone).
  // 읽기 전용 파이프라인 오버레이(/api/portfolio/latest-snapshot)나 계약 어댑터에서
  // 다시 불러와도 삭제 상태가 새로고침 후에도 유지되도록 한다.
  deletedPortfolioSnapshotDates: "gorani.portfolio.deleted-snapshot-dates.v1",
  // 사용자가 히스토리에서 숨긴 스냅샷 날짜(YYYY-MM-DD). 삭제와 달리 데이터는 보존하되
  // 기본 조회에서만 제외한다. Firestore 와 동기화되어 모든 기기에서 동일하게 적용된다.
  hiddenPortfolioSnapshotDates: "gorani.portfolio.hidden-snapshot-dates.v1",
  portfolioCloudSyncTime: "gorani.portfolio.cloud-sync-time.v1",
  assetSimulatorConfigs: "gorani.asset-simulator.preview",
  assetSimulatorMemo: "gorani.asset-simulator.memo.v1",
  assetSimulatorMemos: "gorani.asset-simulator.memos.v1",
  assetSimulatorMemoCurrent: "gorani.asset-simulator.memo-current.v1",
  calendarTickers: "gorani.dividend-calendar.tickers.v1",
  calendarEventMeta: "gorani.dividend-calendar.event-meta.v1",
  calendarCustomEvents: "gorani.dividend-calendar.custom-events.v1",
  calendarMemos: "gorani.dividend-calendar.memos.v1",
  calendarSettings: "gorani.dividend-calendar.settings.v1",
  calculatorPresets: "gorani.calculator.presets.v1",
  dividendLedger: "gorani.dividend-ledger.v1",
  favoriteLinks: "gorani.favorite-links.v1",
  navFavorites: "gorani.favorites.v1",
  calendarCache: "gorani.dividend-calendar.cache.v1",
  calendarActivePortfolio: "calendar:activePortfolio",
  quoteCache: "gorani.quote.cache.v1",
  marketCache: "gorani.market.cache.v1",
  uiPreferences: "gorani.ui-preferences.v1",
  trackerConfig: "gorani.tracker-config.v1",
  krxTickerNameMap: "gorani.krx-ticker-name-map.v1",
  // 배당 목표 설정(목표 티커·목표 주수). 배당현황과 투자현황이 공유하는 단일 소스.
  dividendGoal: "gorani.dividend.goal.v1",
} as const;

export type StorageKeyName = keyof typeof STORAGE_KEYS;
