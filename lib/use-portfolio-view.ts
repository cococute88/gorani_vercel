"use client";

import { useMemo } from "react";
import { usePortfolioSnapshots } from "./portfolio-store";
import { buildPortfolioPageFromSnapshots } from "./portfolio-from-snapshots";

export function usePortfolioView() {
  const snapshots = usePortfolioSnapshots();
  return useMemo(() => buildPortfolioPageFromSnapshots(snapshots), [snapshots]);
}
