// =============================================================
// 월별 자산 추이(stacked area) helper.
//
// 원본 Streamlit 복원:
//   - original/pages_app/2_asset_tracker.py 의 "📈 월별 자산 추이" 섹션
//       tag_totals 집계 → sort_tags_by_super_group → assign_colors →
//       go.Scatter(stackgroup='one') 누적 영역 그래프.
//
// 원본은 월별로 입력한 (상품태그 → 금액) dict 를 누적 영역으로 쌓는다.
// Vercel 은 같은 화면의 자산군 도넛과 동일하게 자산군 타입(레버리지/나스닥/
// S&P500/배당/달러/현금/기타) 단위로 묶어 같은 색/분류/정렬을 공유한다.
// (lib/asset-allocation-donut.ts 의 buildAssetAllocationFromSnapshotLike 재사용)
//
// 월 키는 스냅샷 날짜(YYYY-MM-DD)의 YYYY-MM 으로 묶고, 한 달에 스냅샷이
// 여러 개면 가장 최근(날짜가 큰) 스냅샷을 그 달의 대표로 쓴다.
// =============================================================

import {
  buildAssetAllocationFromSnapshotLike,
  type AssetTypeKey,
} from "./asset-allocation-donut";
import type { PortfolioSnapshot } from "./portfolio-types";

// 한 자산군 시리즈(범례 1줄 = 누적 영역 1개).
export interface AssetTrendSeries {
  key: AssetTypeKey;
  label: string;
  color: string;
}

// x축 한 점(=한 달). 자산군 key 별 평가금액(원)을 갖는다.
export interface AssetTrendPoint {
  monthKey: string; // YYYY-MM
  label: string; // YY.MM (원본 `{k[2:4]}.{k[5:7]}`)
  [assetType: string]: string | number;
}

export interface AssetTrendResult {
  series: AssetTrendSeries[];
  points: AssetTrendPoint[];
}

// "2024-01-15" → "2024-01"
function monthKeyOf(snapshotDate: string): string | null {
  const m = snapshotDate.trim().match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

// "2024-01" → "24.01" (원본 라벨 포맷)
function monthLabelOf(monthKey: string): string {
  return `${monthKey.slice(2, 4)}.${monthKey.slice(5, 7)}`;
}

// 원본 sort_tags_by_super_group 의 결과 순서(=합계 내림차순)를 자산군 타입 단위로
// 재현하기 위해, 전체 기간 합계로 buildAssetAllocationDonut 를 한 번 돌려
// 전역 정렬/색상을 확정한다. 그 후 월별로 각 타입의 금액을 채운다.
export function buildPortfolioAssetTrend(
  snapshots: readonly PortfolioSnapshot[] | null | undefined,
): AssetTrendResult {
  // 1) 월별 대표 스냅샷 선정 (한 달에 여러 개면 최신 날짜 우선)
  const latestByMonth = new Map<string, PortfolioSnapshot>();
  for (const snap of snapshots ?? []) {
    const key = monthKeyOf(snap.snapshotDate);
    if (!key) continue;
    const prev = latestByMonth.get(key);
    if (!prev || snap.snapshotDate > prev.snapshotDate) {
      latestByMonth.set(key, snap);
    }
  }

  const monthKeys = Array.from(latestByMonth.keys()).sort();
  if (monthKeys.length === 0) return { series: [], points: [] };

  const representatives = monthKeys.map((k) => latestByMonth.get(k)!);

  // 권위 현금 합계 합산(있는 스냅샷만). 전역 정렬/색상 확정용 도넛에 reconcile 기준을 준다.
  const totalAuthoritativeCashKRW = representatives.reduce<number | null>((sum, snap) => {
    const cash = snap.authoritativeTotals?.totalCashKRW;
    if (typeof cash !== "number" || !Number.isFinite(cash)) return sum;
    return (sum ?? 0) + cash;
  }, null);

  // 2) 전역 정렬/색상 확정. 원본의 tag_totals(전체 기간 합계) → sort_tags_by_super_group
  //    → assign_colors 와 동일하게, 전체 기간의 보유종목/재무자산을 한 번에 도넛에
  //    통과시켜 자산군 순서와 색을 얻는다.
  const orderedSlices = buildAssetAllocationFromSnapshotLike({
    holdings: representatives.flatMap((s) => s.holdings),
    financeAssets: representatives.flatMap((s) => s.financeAssets),
  }, { authoritativeCashKRW: totalAuthoritativeCashKRW }).slices;

  if (orderedSlices.length === 0) return { series: [], points: [] };

  const series: AssetTrendSeries[] = orderedSlices.map((slice) => ({
    key: slice.assetType,
    label: slice.label,
    color: slice.color,
  }));

  // 3) 월별 자산군 합계 (도넛과 동일한 분류·집계). 없는 자산군은 0 (원본 .get(tag, 0)).
  const points: AssetTrendPoint[] = monthKeys.map((monthKey) => {
    const snap = latestByMonth.get(monthKey)!;
    const { slices } = buildAssetAllocationFromSnapshotLike({
      holdings: snap.holdings,
      financeAssets: snap.financeAssets,
    }, { authoritativeCashKRW: snap.authoritativeTotals?.totalCashKRW ?? null });
    const typeTotals = new Map<AssetTypeKey, number>();
    for (const slice of slices) typeTotals.set(slice.assetType, slice.valueKRW);

    const point: AssetTrendPoint = { monthKey, label: monthLabelOf(monthKey) };
    for (const s of series) point[s.key] = Math.round(typeTotals.get(s.key) ?? 0);
    return point;
  });

  return { series, points };
}
