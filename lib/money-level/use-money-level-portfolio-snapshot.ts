"use client";

import { useMemo } from "react";
import {
  usePortfolioFirestoreSnapshot,
  type FirestoreSnapshotSyncStatus,
} from "../portfolio-firestore-snapshot-sync";
import { usePortfolioView } from "../use-portfolio-view";
import {
  selectMoneyLevelPortfolioSnapshotWithDiagnostics,
  type MoneyLevelPortfolioSelection,
} from "./portfolio-selector";

/**
 * Client boundary for a future Money Level route. It deliberately reuses the
 * existing /portfolio synchronization and normalized page model instead of
 * starting another API/Firestore data pipeline.
 */
export type MoneyLevelPortfolioHookResult = MoneyLevelPortfolioSelection & {
  syncStatus: FirestoreSnapshotSyncStatus;
};

export function useMoneyLevelPortfolioSnapshot(): MoneyLevelPortfolioHookResult {
  const sync = usePortfolioFirestoreSnapshot();
  const portfolioPageModel = usePortfolioView();

  return useMemo(
    () => ({
      ...selectMoneyLevelPortfolioSnapshotWithDiagnostics(portfolioPageModel),
      syncStatus: sync.status,
    }),
    [portfolioPageModel, sync.status],
  );
}
