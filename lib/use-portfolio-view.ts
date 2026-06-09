"use client";

import { useMemo } from "react";
import { latestOf, usePortfolioSnapshots } from "./portfolio-store";
import { buildPortfolioViewModel } from "./portfolio-aggregate";

export function usePortfolioView() {
  const snapshots = usePortfolioSnapshots();
  return useMemo(() => buildPortfolioViewModel(latestOf(snapshots)), [snapshots]);
}
