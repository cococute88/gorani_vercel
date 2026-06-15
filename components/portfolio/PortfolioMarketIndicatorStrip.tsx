"use client";

import { useEffect, useState } from "react";
import { fetchMarketPayload, type BriefingItem, type MarketPayload } from "@/lib/market-data";

// PORTFOLIO-OVERVIEW-CLEANUP-1-FOLLOWUP
// /portfolio 상단 compact 시장지표 strip.
// - 정적 더미값을 쓰지 않고 /api/market live briefing 을 재사용한다.
// - build time fetch 가 없도록 client useEffect 에서만 조회한다.
// - live/partial/unavailable 상태를 작은 문구로만 표시하고 장황한 박스는 만들지 않는다.

type Props = { theme?: "dark" | "light" };

// 상단을 과하게 차지하지 않도록 compact 하게 핵심 지표만 노출한다.
const SHOWN_KEYS = ["sp500", "nasdaq", "usdkrw", "vix", "wti"] as const;

// 국내 관습: 상승 빨강 / 하락 파랑
const UP = "#e5484d";
const DOWN = "#3b82f6";

function formatChange(item: BriefingItem): string {
  if (item.changePct === null) return "조회 불가";
  const sign = item.changePct >= 0 ? "+" : "";
  return `${sign}${item.changePct.toFixed(2)}%`;
}

function StatusText({ payload, loading }: { payload: MarketPayload | null; loading: boolean }) {
  if (loading) {
    return <span className="text-[11px] text-slate-400 dark:text-slate-500">불러오는 중…</span>;
  }
  if (!payload || payload.source === "unavailable") {
    return <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">시장 데이터 조회 불가</span>;
  }
  if (payload.source === "partial") {
    return <span className="text-[11px] font-medium text-amber-500">시장 데이터 일부 조회 불가</span>;
  }
  return <span className="text-[11px] font-medium text-emerald-500">시장 데이터 Live</span>;
}

export default function PortfolioMarketIndicatorStrip({ theme = "light" }: Props) {
  const isLight = theme === "light";
  const [payload, setPayload] = useState<MarketPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // 짧은 range 로 충분하다 (strip 은 briefing 값만 사용).
    fetchMarketPayload("6개월")
      .then((next) => {
        if (!cancelled) setPayload(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items =
    payload?.briefing.filter((b) => (SHOWN_KEYS as readonly string[]).includes(b.key)) ?? [];
  // 화면 순서를 SHOWN_KEYS 기준으로 고정한다.
  const ordered = SHOWN_KEYS
    .map((key) => items.find((b) => b.key === key))
    .filter((b): b is BriefingItem => Boolean(b));

  const cardCls = isLight
    ? "border-slate-200 bg-white"
    : "border-[#2a3336] bg-[#171c1d]";
  const labelCls = isLight ? "text-slate-500" : "text-slate-400";
  const valueCls = isLight ? "text-slate-900" : "text-slate-100";

  const showCards = !loading && payload && payload.source !== "unavailable" && ordered.length > 0;

  return (
    <div className="mb-4 min-w-0">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[11.5px] font-medium text-slate-400 dark:text-slate-500">시장 지표</span>
        <StatusText payload={payload} loading={loading} />
      </div>
      {showCards ? (
        <div className="no-scrollbar -mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {ordered.map((item) => {
            const unavailable = item.changePct === null;
            const color = unavailable ? undefined : item.up ? UP : DOWN;
            return (
              <div
                key={item.key}
                className={`flex w-[140px] shrink-0 flex-col gap-0.5 rounded-xl border px-3 py-2 ${cardCls}`}
              >
                <span className={`truncate text-[11px] font-medium ${labelCls}`}>{item.label}</span>
                <span className={`num text-[14px] font-bold ${valueCls}`}>{item.value}</span>
                <span
                  className="num text-[11.5px] font-semibold"
                  style={color ? { color } : undefined}
                >
                  {formatChange(item)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
