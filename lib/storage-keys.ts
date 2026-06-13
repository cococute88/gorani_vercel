export const STORAGE_KEYS = {
  portfolioSnapshots: "qld2.portfolio.snapshots.v1",
  assetSimulatorConfigs: "gorani.asset-simulator.preview",
  calendarTickers: "gorani.dividend-calendar.tickers.v1",
  calendarEventMeta: "gorani.dividend-calendar.event-meta.v1",
  calendarCustomEvents: "gorani.dividend-calendar.custom-events.v1",
  calendarSettings: "gorani.dividend-calendar.settings.v1",
  calculatorPresets: "gorani.calculator.presets.v1",
  dividendLedger: "gorani.dividend-ledger.v1",
  favoriteLinks: "gorani.favorite-links.v1",
  calendarCache: "gorani.dividend-calendar.cache.v1",
  quoteCache: "gorani.quote.cache.v1",
  marketCache: "gorani.market.cache.v1",
  uiPreferences: "gorani.ui-preferences.v1",
  trackerConfig: "gorani.tracker-config.v1",
} as const;

export type StorageKeyName = keyof typeof STORAGE_KEYS;
