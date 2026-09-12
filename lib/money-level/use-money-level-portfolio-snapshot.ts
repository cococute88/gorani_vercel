"use client";

import { useMemo } from "react";
import { usePortfolioFirestoreSnapshot } from "../portfolio-firestore-snapshot-sync";
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
export function useMoneyLevelPortfolioSnapshot(): MoneyLevelPortfolioSelection {
  usePortfolioFirestoreSnapshot();
  const portfolioPageModel = usePortfolioView();

  return useMemo(
    () => selectMoneyLevelPortfolioSnapshotWithDiagnostics(portfolioPageModel),
    [portfolioPageModel],
  );
}
