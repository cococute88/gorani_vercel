"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { fetchMarketPayload, type BriefingItem, type MarketPayload } from "@/lib/market-data";
import { DEFAULT_DETAIL_RANGE, INDEX_DETAIL_DEFS, type IndexDef } from "@/lib/market-index";

// 시장현황 페이지와 동일한 세부 캔들 차트 모달을 재사용한다 (lightweight-charts).
const IndexDetailModal = dynamic(() => import("@/components/market/IndexDetailModal"), { ssr: false });

// PORTFOLIO-OVERVIEW-CLEANUP-1-FOLLOWUP (+ FOLLOWUP-2)
// /portfolio 상단 compact 시장지표 strip.
// - 정적 더미값을 쓰지 않고 /api/market live briefing 을 재사용한다.
// - 각 카드 오른쪽에 briefing.sparkline(실데이터 daily close) 기반 mini chart 를 그린다.
// - build time fetch 가 없도록 client useEffect 에서만 조회한다.
// - live/partial/unavailable 상태를 작은 문구로만 표시하고 장황한 박스는 만들지 않는다.

type Props = { theme?: "dark" | "light" };

// 상단을 과하게 차지하지 않도록 compact 하게 핵심 지표만 노출한다.
const SHOWN_KEYS = ["sp500", "nasdaq", "dow", "schd", "usdkrw", "vix", "wti", "gld"] as const;

// 국내 관습: 상승 빨강 / 하락 파랑
const UP = "#e5484d";
const DOWN = "#3b82f6";

function formatChange(item: BriefingItem): string {
  if (item.changePct === null) return "조회 불가";
  const sign = item.changePct >= 0 ? "+" : "";
  return `${sign}${item.changePct.toFixed(2)}%`;
}

// 실데이터 daily close 배열을 작은 선 그래프로 그린다 (이미지/random 미사용).
function Sparkline({ data, color, w = 56, h = 26 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const id = `pf-spark-${color.replace("#", "")}-${data.length}-${Math.round(data[0])}-${Math.round(data[data.length - 1])}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
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
  const [active, setActive] = useState<IndexDef | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // 짧은 range 로 충분하다 (strip 은 briefing 값/스파크라인만 사용).
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

  const cardCls = isLight ? "border-slate-200 bg-white" : "border-[#2a3336] bg-[#171c1d]";
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
            const sparkValues = (item.sparkline ?? [])
              .map((p) => p.value)
              .filter((v) => Number.isFinite(v));
            const def = INDEX_DETAIL_DEFS[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => def && setActive(def)}
                disabled={!def}
                className={`flex w-[168px] shrink-0 items-end justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${cardCls} ${def ? "cursor-pointer hover:border-blue-400 dark:hover:border-blue-500/60" : "cursor-default"}`}
              >
                <div className="min-w-0">
                  <span className={`block truncate text-[11px] font-medium ${labelCls}`}>{item.label}</span>
                  <span className={`num block text-[14px] font-bold ${valueCls}`}>{item.value}</span>
                  <span className="num block text-[11.5px] font-semibold" style={color ? { color } : undefined}>
                    {formatChange(item)}
                  </span>
                </div>
                {color && sparkValues.length >= 2 ? (
                  <Sparkline data={sparkValues} color={color} />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {active && (
        <IndexDetailModal def={active} initialRange={DEFAULT_DETAIL_RANGE} onClose={() => setActive(null)} />
      )}
    </div>
  );
}
