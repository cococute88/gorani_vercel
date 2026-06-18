"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import {
  DEFAULT_DETAIL_RANGE,
  DETAIL_RANGES,
  MA_COLORS,
  MA_PERIODS,
  fetchIndexQuote,
  formatSignedPct,
  formatSignedUsd,
  formatUpdatedAt,
  formatUsd,
  movingAverage,
  type IndexDef,
  type IndexQuote,
  type MaPeriod,
} from "@/lib/market-index";

interface Props {
  def: IndexDef;
  initialRange: string;
  onClose: () => void;
}

const UP = "#16a34a";
const DOWN = "#dc2626";

type Palette = {
  text: string;
  grid: string;
  border: string;
  background: string;
};


function dateToBusinessDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function applyVisibleRange(chart: IChartApi, quote: IndexQuote, range: string) {
  const candles = quote.candles;
  if (candles.length === 0) {
    chart.timeScale().fitContent();
    return;
  }

  const last = candles[candles.length - 1]?.time;
  if (typeof last === "number" || range === "max") {
    chart.timeScale().fitContent();
    return;
  }

  const lastDate = new Date(`${last}T00:00:00Z`);
  if (Number.isNaN(lastDate.getTime())) {
    chart.timeScale().fitContent();
    return;
  }

  const fromDate = (() => {
    switch (range) {
      case "1d":
        return addMonths(lastDate, -0.05);
      case "5d": {
        const d = new Date(lastDate);
        d.setUTCDate(d.getUTCDate() - 7);
        return d;
      }
      case "1m":
        return addMonths(lastDate, -1);
      case "3m":
        return addMonths(lastDate, -3);
      case "6m":
        return addMonths(lastDate, -6);
      case "ytd":
        return new Date(Date.UTC(lastDate.getUTCFullYear(), 0, 1));
      case "1y":
        return addMonths(lastDate, -12);
      case "3y":
        return addMonths(lastDate, -36);
      case "5y":
        return addMonths(lastDate, -60);
      default:
        return addMonths(lastDate, -6);
    }
  })();

  chart.timeScale().setVisibleRange({
    from: dateToBusinessDayString(fromDate) as never,
    to: last as never,
  });
}

function palette(dark: boolean): Palette {
  return dark
    ? { text: "#94a3b8", grid: "rgba(148,163,184,0.12)", border: "#2a3336", background: "transparent" }
    : { text: "#64748b", grid: "rgba(100,116,139,0.12)", border: "#e2e8f0", background: "transparent" };
}

// TradingView-style detail chart: candlesticks + volume + MA overlays,
// with selectable ranges. Rendered client-only (lightweight-charts).
export default function IndexDetailModal({ def, initialRange, onClose }: Props) {
  const dark = useResolvedTheme() === "dark";
  const [range, setRange] = useState(initialRange || DEFAULT_DETAIL_RANGE);
  const [quote, setQuote] = useState<IndexQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visibleMa, setVisibleMa] = useState<Record<MaPeriod, boolean>>({ 20: true, 60: true, 120: true, 200: true });

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maRefs = useRef<Partial<Record<MaPeriod, ISeriesApi<"Line">>>>({});

  // Close on Escape.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fetch the complete available daily history once per symbol. The period buttons
  // only change the visible viewport, so zooming/panning can reveal older candles.
  useEffect(() => {
    let active = true;
    setRange(initialRange || DEFAULT_DETAIL_RANGE);
    setLoading(true);
    setError(false);
    fetchIndexQuote(def.symbol, "max")
      .then((data) => {
        if (!active) return;
        setQuote(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [def.symbol, initialRange]);

  // Build the chart (re-created when the theme changes).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const colors = palette(dark);

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: container.clientHeight || 480,
      layout: { background: { type: ColorType.Solid, color: colors.background }, textColor: colors.text, fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: colors.border, scaleMargins: { top: 0.08, bottom: 0.26 } },
      timeScale: { borderColor: colors.border, rightOffset: 4, timeVisible: false, secondsVisible: false },
    });

    const candle = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    const volume = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const maSeries: Partial<Record<MaPeriod, ISeriesApi<"Line">>> = {};
    MA_PERIODS.forEach((period) => {
      maSeries[period] = chart.addLineSeries({
        color: MA_COLORS[period],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
    });

    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volume;
    maRefs.current = maSeries;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) chart.applyOptions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      maRefs.current = {};
    };
  }, [dark]);

  // Push data into the chart whenever the quote changes.
  useEffect(() => {
    const candle = candleRef.current;
    const volume = volumeRef.current;
    const chart = chartRef.current;
    if (!candle || !volume || !chart || !quote) return;

    chart.applyOptions({ timeScale: { timeVisible: quote.intraday, secondsVisible: false } });

    candle.setData(
      quote.candles.map((c) => ({
        time: c.time as never,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    volume.setData(
      quote.candles.map((c) => ({
        time: c.time as never,
        value: c.volume ?? 0,
        color: c.close >= c.open ? "rgba(22,163,74,0.4)" : "rgba(220,38,38,0.4)",
      })),
    );
    MA_PERIODS.forEach((period) => {
      const series = maRefs.current[period];
      if (!series) return;
      series.setData(
        movingAverage(quote.candles, period).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
    });
    applyVisibleRange(chart, quote, range);
  }, [quote, range]);

  // Toggle MA visibility without rebuilding the chart.
  useEffect(() => {
    MA_PERIODS.forEach((period) => {
      maRefs.current[period]?.applyOptions({ visible: visibleMa[period] });
    });
  }, [visibleMa]);

  const toggleMa = useCallback((period: MaPeriod) => {
    setVisibleMa((prev) => ({ ...prev, [period]: !prev[period] }));
  }, []);

  const up = (quote?.change ?? 0) >= 0;
  const changeColor = up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2a3336] dark:bg-[#15191a]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-[#2a3336] sm:px-5">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[17px] font-extrabold text-slate-900 dark:text-white">{def.name}</h2>
              <span className="text-[12px] font-medium text-slate-400">{def.ticker}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="num text-[22px] font-extrabold text-slate-900 dark:text-white">
                {quote ? formatUsd(quote.price) : "—"}
              </span>
              <span className={`num text-[13px] font-semibold ${changeColor}`}>
                {quote ? `${formatSignedUsd(quote.change)} (${formatSignedPct(quote.changePct)})` : ""}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {quote?.source === "sample"
                ? "샘플 데이터 (실시간 조회 불가)"
                : quote
                  ? `Yahoo Finance · ${formatUpdatedAt(quote.updatedAt)}`
                  : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 dark:border-[#2a3336] sm:px-5">
          <div className="flex flex-wrap items-center gap-1">
            {DETAIL_RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`rounded-md px-2 py-1 text-[11.5px] font-semibold transition-colors ${
                  range === r.key
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {MA_PERIODS.map((period) => (
              <button
                key={period}
                onClick={() => toggleMa(period)}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                  visibleMa[period]
                    ? "border-transparent text-white"
                    : "border-slate-200 text-slate-400 dark:border-[#2a3336]"
                }`}
                style={visibleMa[period] ? { backgroundColor: MA_COLORS[period] } : undefined}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: visibleMa[period] ? "#fff" : MA_COLORS[period] }}
                />
                MA{period}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="relative min-h-0 flex-1">
          <div ref={containerRef} className="absolute inset-0" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 text-[13px] text-slate-500 dark:bg-black/30 dark:text-slate-400">
              차트 데이터를 불러오는 중…
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-red-500">
              차트 데이터를 불러오지 못했습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
