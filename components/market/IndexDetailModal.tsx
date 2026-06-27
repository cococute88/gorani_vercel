"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
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
  type DetailLinePoint,
  type DetailLineSeries,
  type DetailLineTab,
  type IndexCandle,
  type IndexDef,
  type IndexQuote,
  type MaPeriod,
} from "@/lib/market-index";

interface Props {
  def: IndexDef;
  initialRange: string;
  onClose: () => void;
  /**
   * Optional extra line-metric tabs (e.g. Dividend / US10Y / Spread).
   * When provided, a tab bar appears with the candlestick "Price" view
   * first, followed by these line tabs. The shared range selection and
   * modal layout are reused; only the rendered data changes. When omitted
   * the modal behaves exactly as before (Price candlestick only, no tabs).
   */
  lineTabs?: DetailLineTab[];
  /** Label for the candlestick tab. Defaults to "Price". */
  priceLabel?: string;
}

const PRICE_TAB_KEY = "price";

const UP = "#16a34a";
const DOWN = "#dc2626";
const FLAT = "#6b7280";

// 상단 OHLC 등락 색상: 양수 녹색 / 음수 적색 / 0·미산정 회색.
function pctColor(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return FLAT;
  if (pct > 0) return UP;
  if (pct < 0) return DOWN;
  return FLAT;
}

// 차트 상단에 표시할 OHLC 한 줄 (기준 봉 + 직전 종가).
type OhlcView = { open: number; high: number; low: number; close: number; prevClose: number | null };

function ohlcFromCandle(candles: IndexCandle[], index: number): OhlcView | null {
  const bar = candles[index];
  if (!bar) return null;
  return {
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    prevClose: index > 0 ? candles[index - 1].close : null,
  };
}

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

// Yahoo ignores interval=1d for range=max and returns monthly candles.
// Map the UI range to a fetch range that guarantees daily candles.
function dataRangeForView(viewRange: string): string {
  if (viewRange === "1d" || viewRange === "5d") return viewRange;
  return "5y";
}

const DAY_MS = 86_400_000;

// Start timestamp (UTC ms) for a UI range relative to the latest data point.
// Used to slice line-metric history to the selected period (the candlestick
// view uses applyVisibleRange instead). "max" returns -Infinity (show all).
function lineRangeStartMs(lastMs: number, range: string): number {
  const last = new Date(lastMs);
  switch (range) {
    case "1d":
      return lastMs - 1 * DAY_MS;
    case "5d":
      return lastMs - 7 * DAY_MS;
    case "1m":
      return lastMs - 31 * DAY_MS;
    case "3m":
      return lastMs - 92 * DAY_MS;
    case "6m":
      return lastMs - 183 * DAY_MS;
    case "ytd":
      return Date.UTC(last.getUTCFullYear(), 0, 1);
    case "1y":
      return lastMs - 365 * DAY_MS;
    case "3y":
      return lastMs - 3 * 365 * DAY_MS;
    case "5y":
      return lastMs - 5 * 365 * DAY_MS;
    case "max":
      return -Infinity;
    default:
      return lastMs - 183 * DAY_MS;
  }
}

function parseIsoMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

// Filter an ascending daily line series down to the selected range.
function filterLineByRange(points: DetailLinePoint[], range: string): DetailLinePoint[] {
  if (points.length === 0) return points;
  const lastMs = parseIsoMs(points[points.length - 1].date);
  if (!Number.isFinite(lastMs)) return points;
  const startMs = lineRangeStartMs(lastMs, range);
  return points.filter((point) => parseIsoMs(point.date) >= startMs);
}

// A multi-series view: each series range-filtered and (optionally) re-based to
// 100 at its first in-range point so the Compare lines share a 100 start.
type ViewSeries = { key: string; label: string; color: string; points: DetailLinePoint[] };

function filterAndNormalizeMulti(series: DetailLineSeries[], range: string, normalize: boolean): ViewSeries[] {
  return series.map((s) => {
    const filtered = filterLineByRange(s.points, range);
    if (!normalize || filtered.length === 0) {
      return { key: s.key, label: s.label, color: s.color, points: filtered };
    }
    const base = filtered[0].value;
    const factor = base ? 100 / base : 1;
    return {
      key: s.key,
      label: s.label,
      color: s.color,
      points: filtered.map((p) => ({ date: p.date, value: Number((p.value * factor).toFixed(4)) })),
    };
  });
}

function formatMetricValue(value: number | null | undefined, digits: number, unit: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}${unit}`;
}

function formatSignedMetric(value: number | null | undefined, digits: number, unit: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}${unit}`;
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
// with selectable ranges. Optional line-metric tabs (Dividend / US10Y /
// Spread …) reuse the same chart and range selection. Rendered client-only
// (lightweight-charts).
export default function IndexDetailModal({ def, initialRange, onClose, lineTabs, priceLabel = "Price" }: Props) {
  const dark = useResolvedTheme() === "dark";
  const [range, setRange] = useState(initialRange || DEFAULT_DETAIL_RANGE);
  const [quote, setQuote] = useState<IndexQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visibleMa, setVisibleMa] = useState<Record<MaPeriod, boolean>>({ 20: true, 60: true, 120: true, 200: true });
  // Top OHLC row: defaults to the latest bar, syncs to the hovered candle.
  const [ohlc, setOhlc] = useState<OhlcView | null>(null);

  // Tabs: Price (candlestick) first, then optional line metrics.
  const tabs = useMemo(
    () => [{ key: PRICE_TAB_KEY, label: priceLabel }, ...(lineTabs ?? []).map((t) => ({ key: t.key, label: t.label }))],
    [lineTabs, priceLabel],
  );
  const hasTabs = (lineTabs?.length ?? 0) > 0;
  const [activeTab, setActiveTab] = useState<string>(PRICE_TAB_KEY);
  const isPriceTab = activeTab === PRICE_TAB_KEY;
  const activeLineTab = useMemo(
    () => (isPriceTab ? null : lineTabs?.find((t) => t.key === activeTab) ?? null),
    [activeTab, isPriceTab, lineTabs],
  );
  const isMultiTab = !!activeLineTab?.resolveMulti;

  // Line-metric data: full daily history per tab (range-filtered at render).
  const lineCacheRef = useRef<Record<string, DetailLinePoint[]>>({});
  const multiCacheRef = useRef<Record<string, DetailLineSeries[]>>({});
  const [lineData, setLineData] = useState<DetailLinePoint[] | null>(null);
  const [multiData, setMultiData] = useState<DetailLineSeries[] | null>(null);
  const [lineLoading, setLineLoading] = useState(false);
  const [lineError, setLineError] = useState(false);
  // Crosshair-synced value for the active single-line metric (null = use latest).
  const [hoverLineValue, setHoverLineValue] = useState<number | null>(null);
  // Crosshair-synced values per series for multi-line (Compare) tabs.
  const [hoverMulti, setHoverMulti] = useState<Record<string, number> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maRefs = useRef<Partial<Record<MaPeriod, ISeriesApi<"Line">>>>({});
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Reusable pool of line series for multi-line (Compare) tabs.
  const multiRefs = useRef<ISeriesApi<"Line">[]>([]);
  // Currently-bound multi series (key + api) so the crosshair handler can read
  // per-series hovered values without rebuilding the chart.
  const activeMultiRef = useRef<Array<{ key: string; series: ISeriesApi<"Line"> }>>([]);
  const zeroLineRef = useRef<IPriceLine | null>(null);
  // Latest candles kept in a ref so the crosshair handler (bound once) can resolve
  // the hovered bar's previous close without rebuilding the chart on every fetch.
  const candlesRef = useRef<IndexCandle[]>([]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Reset the visible range + active tab when the modal opens for a (new) symbol.
  useEffect(() => {
    setRange(initialRange || DEFAULT_DETAIL_RANGE);
    setActiveTab(PRICE_TAB_KEY);
    lineCacheRef.current = {};
    multiCacheRef.current = {};
  }, [def.symbol, initialRange]);

  // Fetch daily price data. Non-intraday ranges share a single "5y" request
  // (cached by fetchIndexQuote) so switching between 1M–5Y/MAX is instant.
  // Only intraday ranges (1D, 5D) trigger a separate fetch. The price quote is
  // always loaded so the default Price tab is ready and switching back is instant.
  const fetchRange = dataRangeForView(range);

  useEffect(() => {
    let active = true;
    setQuote(null);
    setLoading(true);
    setError(false);
    fetchIndexQuote(def.symbol, fetchRange)
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
  }, [def.symbol, fetchRange]);

  // Resolve the active line-metric history once per tab (cached). Range changes
  // only re-filter the cached series, so switching ranges/tabs adds no extra
  // network calls (US10Y + Spread also share fetchIndexQuote's ^TNX cache).
  useEffect(() => {
    if (!activeLineTab) return;
    const key = activeLineTab.key;

    // Multi-line (Compare) tab.
    if (activeLineTab.resolveMulti) {
      const cached = multiCacheRef.current[key];
      if (cached) {
        setMultiData(cached);
        setLineData(null);
        setLineLoading(false);
        setLineError(false);
        return;
      }
      let active = true;
      setMultiData(null);
      setLineData(null);
      setLineLoading(true);
      setLineError(false);
      activeLineTab
        .resolveMulti()
        .then((data) => {
          if (!active) return;
          multiCacheRef.current[key] = data;
          setMultiData(data);
          setLineLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setLineError(true);
          setLineLoading(false);
        });
      return () => {
        active = false;
      };
    }

    // Single-line metric tab.
    if (!activeLineTab.resolve) return;
    const cached = lineCacheRef.current[key];
    if (cached) {
      setLineData(cached);
      setMultiData(null);
      setLineLoading(false);
      setLineError(false);
      return;
    }
    let active = true;
    setLineData(null);
    setMultiData(null);
    setLineLoading(true);
    setLineError(false);
    activeLineTab
      .resolve()
      .then((data) => {
        if (!active) return;
        lineCacheRef.current[key] = data;
        setLineData(data);
        setLineLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLineError(true);
        setLineLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeLineTab]);

  // Range-filtered + normalized multi-series view (Compare). Shared by the
  // chart render and the header/info legend so both stay in sync.
  const viewMulti = useMemo<ViewSeries[]>(() => {
    if (!isMultiTab || !multiData) return [];
    return filterAndNormalizeMulti(multiData, range, !!activeLineTab?.normalizeToStart);
  }, [isMultiTab, multiData, range, activeLineTab]);

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

    // Single reusable line series for single-metric line tabs. Hidden until a
    // line tab is active; its color/data are set per active tab.
    const line = chart.addLineSeries({
      color: "#f2994a",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      visible: false,
    });

    // Reusable pool of line series for multi-line (Compare) tabs. Hidden until
    // a multi tab is active; color/data/visibility set per active series.
    const MAX_MULTI_LINES = 4;
    const multiSeries: ISeriesApi<"Line">[] = [];
    for (let i = 0; i < MAX_MULTI_LINES; i += 1) {
      multiSeries.push(
        chart.addLineSeries({
          color: "#3b82f6",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          visible: false,
        }),
      );
    }

    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volume;
    maRefs.current = maSeries;
    lineRef.current = line;
    multiRefs.current = multiSeries;

    // Sync the top OHLC row with the hovered candle and the line metric value
    // with the hovered point; fall back to the latest bar when the pointer
    // leaves the chart.
    chart.subscribeCrosshairMove((param) => {
      // Single line metric hover value.
      const lineBar = param.time !== undefined ? (param.seriesData.get(line) as { value?: number } | undefined) : undefined;
      setHoverLineValue(lineBar && typeof lineBar.value === "number" ? lineBar.value : null);

      // Multi-line (Compare) hover values, keyed by series.
      if (activeMultiRef.current.length) {
        const map: Record<string, number> = {};
        for (const { key, series } of activeMultiRef.current) {
          const bar = param.time !== undefined ? (param.seriesData.get(series) as { value?: number } | undefined) : undefined;
          if (bar && typeof bar.value === "number") map[key] = bar.value;
        }
        setHoverMulti(Object.keys(map).length ? map : null);
      } else {
        setHoverMulti(null);
      }

      const candles = candlesRef.current;
      if (candles.length === 0) return;
      const bar = param.time !== undefined ? param.seriesData.get(candle) as { open?: number; high?: number; low?: number; close?: number } | undefined : undefined;
      if (bar && typeof bar.open === "number" && typeof bar.high === "number" && typeof bar.low === "number" && typeof bar.close === "number") {
        const index = candles.findIndex((c) => c.time === param.time);
        setOhlc({
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          prevClose: index > 0 ? candles[index - 1].close : null,
        });
        return;
      }
      setOhlc(ohlcFromCandle(candles, candles.length - 1));
    });

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
      lineRef.current = null;
      multiRefs.current = [];
      activeMultiRef.current = [];
      zeroLineRef.current = null;
    };
  }, [dark]);

  // Push price data into the chart whenever the quote changes.
  useEffect(() => {
    const candle = candleRef.current;
    const volume = volumeRef.current;
    const chart = chartRef.current;
    if (!candle || !volume || !chart || !quote) return;

    // Keep the OHLC row source in sync and reset it to the latest bar.
    candlesRef.current = quote.candles;
    setOhlc(ohlcFromCandle(quote.candles, quote.candles.length - 1));

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
    // Only drive the visible range / time axis from price data on the Price tab.
    if (isPriceTab) {
      chart.applyOptions({ timeScale: { timeVisible: quote.intraday, secondsVisible: false } });
      applyVisibleRange(chart, quote, range);
    }
  }, [quote, range, isPriceTab]);

  // Push line-metric data into the chart (filtered by the shared range).
  useEffect(() => {
    const line = lineRef.current;
    const multi = multiRefs.current;
    const chart = chartRef.current;
    if (!line || !chart) return;

    // Clear any previous zero baseline.
    if (zeroLineRef.current) {
      line.removePriceLine(zeroLineRef.current);
      zeroLineRef.current = null;
    }

    // Drive the visible time range from the line's OWN [first,last] dates so
    // the selected period fills the X-axis. fitContent() would also include
    // the hidden candlestick series' wider span and squeeze the line to the
    // right edge (the reported "data clustered on the right" bug).
    const setLineVisibleRange = (firstDate?: string, lastDate?: string) => {
      if (firstDate && lastDate && firstDate < lastDate) {
        chart.timeScale().setVisibleRange({ from: firstDate as never, to: lastDate as never });
      } else {
        chart.timeScale().fitContent();
      }
    };

    chart.applyOptions({ timeScale: { timeVisible: false, secondsVisible: false } });

    // Multi-line (Compare) tab: render each normalized series on the pool.
    if (isMultiTab) {
      line.setData([]);
      activeMultiRef.current = [];
      const span: { first?: string; last?: string } = {};
      multi.forEach((series, i) => {
        const view = viewMulti[i];
        if (view && view.points.length) {
          series.applyOptions({ color: view.color, visible: true });
          series.setData(view.points.map((p) => ({ time: p.date as never, value: p.value })));
          activeMultiRef.current.push({ key: view.key, series });
          if (!span.first) span.first = view.points[0].date;
          span.last = view.points[view.points.length - 1].date;
        } else {
          series.setData([]);
          series.applyOptions({ visible: false });
        }
      });
      setLineVisibleRange(span.first, span.last);
      return;
    }

    // Single-line metric tab.
    activeMultiRef.current = [];
    multi.forEach((s) => {
      s.setData([]);
      s.applyOptions({ visible: false });
    });
    if (!activeLineTab || !lineData) {
      line.setData([]);
      return;
    }
    line.applyOptions({ color: activeLineTab.color });
    const filtered = filterLineByRange(lineData, range);
    line.setData(filtered.map((p) => ({ time: p.date as never, value: p.value })));

    if (activeLineTab.zeroBaseline) {
      zeroLineRef.current = line.createPriceLine({
        price: 0,
        color: dark ? "#64748b" : "#94a3b8",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "0",
      });
    }

    setLineVisibleRange(filtered[0]?.date, filtered[filtered.length - 1]?.date);
  }, [activeLineTab, isMultiTab, lineData, viewMulti, range, dark]);

  // Toggle series visibility per active tab (and MA toggles on the Price tab).
  useEffect(() => {
    candleRef.current?.applyOptions({ visible: isPriceTab });
    volumeRef.current?.applyOptions({ visible: isPriceTab });
    MA_PERIODS.forEach((period) => {
      maRefs.current[period]?.applyOptions({ visible: isPriceTab && visibleMa[period] });
    });
    // Single line only on single-metric tabs; the multi pool is driven by the
    // line-render effect but force-hidden on the Price tab.
    lineRef.current?.applyOptions({ visible: !isPriceTab && !isMultiTab });
    if (isPriceTab || !isMultiTab) {
      multiRefs.current.forEach((s) => s.applyOptions({ visible: false }));
    }
  }, [isPriceTab, isMultiTab, visibleMa, quote, lineData, viewMulti]);

  const toggleMa = useCallback((period: MaPeriod) => {
    setVisibleMa((prev) => ({ ...prev, [period]: !prev[period] }));
  }, []);

  // Header figures: Price tab uses the live quote; single-line tabs use the
  // metric's latest value; multi-line (Compare) tabs show a per-series legend.
  const lineLatest = lineData && lineData.length ? lineData[lineData.length - 1] : null;
  const linePrev = lineData && lineData.length >= 2 ? lineData[lineData.length - 2] : null;
  const lineDigits = activeLineTab?.digits ?? 2;
  const lineUnit = activeLineTab?.unit ?? "%";
  const lineChange = lineLatest && linePrev ? lineLatest.value - linePrev.value : null;

  // Normalized latest value per Compare series (100 = start of range).
  const multiLatest = useMemo(
    () =>
      viewMulti.map((s) => ({
        key: s.key,
        label: s.label,
        color: s.color,
        value: s.points.length ? s.points[s.points.length - 1].value : null,
      })),
    [viewMulti],
  );

  const priceUp = (quote?.change ?? 0) >= 0;
  const lineUp = (lineChange ?? 0) >= 0;
  const changeColor = (isPriceTab ? priceUp : lineUp)
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";

  const showLoading = isPriceTab ? loading : lineLoading;
  const showError = isPriceTab ? error : lineError;
  const emptyLine =
    !isPriceTab &&
    !lineLoading &&
    !lineError &&
    (isMultiTab ? viewMulti.every((s) => s.points.length === 0) : (lineData?.length ?? 0) === 0);

  // "100 → 142.3" growth, signed, for the Compare legend.
  const fmtGrowth = (value: number | null | undefined): string => {
    if (value == null || !Number.isFinite(value)) return "—";
    const g = value - 100;
    const sign = g > 0 ? "+" : g < 0 ? "−" : "";
    return `${sign}${Math.abs(g).toFixed(1)}%`;
  };

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
              {isPriceTab ? (
                <>
                  <span className="num text-[22px] font-extrabold text-slate-900 dark:text-white">
                    {quote ? formatUsd(quote.price) : "—"}
                  </span>
                  <span className={`num text-[13px] font-semibold ${changeColor}`}>
                    {quote ? `${formatSignedUsd(quote.change)} (${formatSignedPct(quote.changePct)})` : ""}
                  </span>
                </>
              ) : isMultiTab ? (
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {multiLatest.map((s) => (
                    <span key={s.key} className="inline-flex items-baseline gap-1.5">
                      <span className="inline-block h-2 w-2 self-center rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{s.label}</span>
                      <span className="num text-[18px] font-extrabold text-slate-900 dark:text-white">
                        {s.value != null ? s.value.toFixed(1) : "—"}
                      </span>
                      <span
                        className={`num text-[12px] font-semibold ${
                          s.value != null && s.value >= 100
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {fmtGrowth(s.value)}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <>
                  <span className="num text-[22px] font-extrabold text-slate-900 dark:text-white">
                    {formatMetricValue(lineLatest?.value, lineDigits, lineUnit)}
                  </span>
                  <span className={`num text-[13px] font-semibold ${changeColor}`}>
                    {lineChange != null ? formatSignedMetric(lineChange, lineDigits, `${lineUnit}p`) : ""}
                  </span>
                  <span className="text-[12px] font-semibold text-slate-400">{activeLineTab?.label}</span>
                </>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {isMultiTab
                ? "세후(미국 배당세 15%) 배당 재투자 Total Return · 선택 기간 시작 = 100"
                : quote?.source === "sample"
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

        {/* Metric tabs (Price | Compare | US10Y | Spread …). Only rendered when
            line tabs are supplied; otherwise the modal stays Price-only. */}
        {hasTabs && (
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-4 py-2 dark:border-[#2a3336] sm:px-5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                aria-pressed={activeTab === tab.key}
                className={`rounded-md px-3 py-1 text-[12px] font-bold transition-colors ${
                  activeTab === tab.key
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

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
          {/* MA toggles only apply to the candlestick Price view. */}
          {isPriceTab && (
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
          )}
        </div>

        {/* Info row. Price tab: TradingView-style OHLC (시작/고가/저가/종가 + 직전
            종가 대비 등락%). Line tabs: metric label + current/hovered value.
            기본은 최신 봉/값, hover/tap 시 해당 지점으로 동기화된다. */}
        <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap border-b border-slate-200 px-4 py-2 text-[12px] dark:border-[#2a3336] sm:px-5 sm:text-[13px]">
          {isPriceTab ? (
            ohlc ? (
              ([
                { label: "시작", value: ohlc.open },
                { label: "고가", value: ohlc.high },
                { label: "저가", value: ohlc.low },
                { label: "종가", value: ohlc.close },
              ] as const).map((field) => {
                const pct =
                  ohlc.prevClose && ohlc.prevClose !== 0
                    ? ((field.value - ohlc.prevClose) / ohlc.prevClose) * 100
                    : null;
                return (
                  <span key={field.label} className="inline-flex shrink-0 items-baseline gap-1">
                    <span className="font-bold text-slate-500 dark:text-slate-400">{field.label}</span>
                    <span className="num font-semibold text-slate-900 dark:text-white">{formatUsd(field.value)}</span>
                    <span className="num" style={{ color: pctColor(pct) }}>
                      ({formatSignedPct(pct)})
                    </span>
                  </span>
                );
              })
            ) : (
              <span className="text-[12px] text-slate-400">—</span>
            )
          ) : isMultiTab ? (
            <div className="flex items-center gap-4">
              {multiLatest.map((s) => {
                const shown = (hoverMulti && hoverMulti[s.key] != null ? hoverMulti[s.key] : s.value) ?? null;
                return (
                  <span key={s.key} className="inline-flex shrink-0 items-baseline gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 self-center rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="font-bold text-slate-500 dark:text-slate-400">{s.label}</span>
                    <span className="num font-semibold text-slate-900 dark:text-white">
                      {shown != null ? shown.toFixed(1) : "—"}
                    </span>
                    <span
                      className="num text-[11px] font-semibold"
                      style={{ color: shown != null && shown < 100 ? "#dc2626" : "#16a34a" }}
                    >
                      ({fmtGrowth(shown)})
                    </span>
                  </span>
                );
              })}
            </div>
          ) : (
            <span className="inline-flex shrink-0 items-baseline gap-1.5">
              <span className="font-bold text-slate-500 dark:text-slate-400">{activeLineTab?.label}</span>
              <span className="num font-semibold text-slate-900 dark:text-white">
                {formatMetricValue(hoverLineValue ?? lineLatest?.value, lineDigits, lineUnit)}
              </span>
            </span>
          )}
        </div>

        {/* Chart */}
        <div className="relative min-h-0 flex-1">
          <div ref={containerRef} className="absolute inset-0" />
          {showLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 text-[13px] text-slate-500 dark:bg-black/30 dark:text-slate-400">
              차트 데이터를 불러오는 중…
            </div>
          )}
          {showError && !showLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-red-500">
              차트 데이터를 불러오지 못했습니다.
            </div>
          )}
          {emptyLine && !showError && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-slate-400">
              표시할 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
