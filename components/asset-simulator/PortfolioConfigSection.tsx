"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildDefaultPortfolioConfig,
  normalizePortfolioTicker,
  validatePortfolioConfig,
} from "@/lib/asset-simulator-portfolio";
import {
  buildAppliedPortfolioAssumptions,
  doPortfolioAssumptionsMatchConfig,
  isPortfolioAssumptionsStale,
  resolveEffectivePortfolioProjectionAssumptions,
} from "@/lib/asset-simulator-portfolio-assumptions";
import { resolvePortfolioHoldingMetricsClient } from "@/lib/asset-simulator-portfolio-client";
import {
  describeAccountWeight,
  formatPct,
  resolutionKey,
  resolutionNeedsManualFallback,
  type PortfolioApplyState,
  type UiTone,
} from "@/lib/asset-simulator-portfolio-ui";
import { formatManwonMoney } from "@/lib/format";
import type {
  AccountPortfolioConfig,
  AppliedPortfolioAssumptionsV1,
  AssetSimulatorPortfolioConfigV1,
  PortfolioAccountType,
  PortfolioHoldingInput,
  PortfolioHoldingResolution,
  PortfolioManualMetrics,
  PortfolioValidationIssue,
  SimulatorInputs,
} from "@/lib/asset-simulator-types";

type Props = {
  config: AssetSimulatorPortfolioConfigV1 | null;
  onConfigChange: (config: AssetSimulatorPortfolioConfigV1) => void;
  appliedAssumptions: AppliedPortfolioAssumptionsV1 | null;
  onApply: (assumptions: AppliedPortfolioAssumptionsV1) => void;
  inputs: SimulatorInputs;
  onInputsChange: (inputs: SimulatorInputs) => void;
  taxMonthlySupply: number | null;
  brokerageMonthlySupply: number | null;
  onSave: () => void;
  saving: boolean;
  saveMessage: string | null;
  saveError: string | null;
};

const ACCOUNT_ORDER: PortfolioAccountType[] = ["taxSaving", "brokerage"];

const ACCOUNT_COPY: Record<PortfolioAccountType, {
  title: string;
  subtitle: string;
  accent: "emerald" | "orange";
}> = {
  taxSaving: { title: "절세계좌 · 인출 기반", subtitle: "잔고와 연 인출률을 기준으로 월 현금을 계산합니다.", accent: "emerald" },
  brokerage: { title: "위탁계좌 · 배당 현금흐름 기반", subtitle: "원금 매도 없이 세후 배당 현금흐름을 중심으로 봅니다.", accent: "orange" },
};

const MANUAL_FIELDS: Record<PortfolioAccountType, Array<{ key: keyof PortfolioManualMetrics; label: string }>> = {
  taxSaving: [{ key: "totalReturnCagrPct", label: "예상 CAGR" }],
  brokerage: [
    { key: "dividendYieldPct", label: "배당률" },
    { key: "dividendGrowthPct", label: "배당성장률" },
    { key: "priceCagrPct", label: "주가성장률" },
  ],
};

const BADGE_TONE: Record<UiTone, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  neutral: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  caution: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  warning: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  muted: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

function generateHoldingId(accountType: PortfolioAccountType): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${accountType}-${suffix}`;
}

function StatusBadge({ tone, children }: { tone: UiTone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BADGE_TONE[tone]}`}>{children}</span>;
}

function formatEokInput(manwon: number): string {
  const value = manwon / 10_000;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatAutoAmount(totalManwon: number, weightPct: number): string {
  return formatManwonMoney(totalManwon * (weightPct / 100));
}

function metricValue(metric: { valuePct: number | null } | undefined): string {
  return metric && typeof metric.valuePct === "number" ? formatPct(metric.valuePct, 1) : "계산 대기";
}

function metricTone(metric: { valuePct: number | null } | undefined): UiTone {
  return metric && typeof metric.valuePct === "number" ? "positive" : "muted";
}

function resolutionToManual(accountType: PortfolioAccountType, resolution?: PortfolioHoldingResolution): PortfolioManualMetrics {
  if (!resolution) return {};
  if (accountType === "taxSaving") {
    return typeof resolution.totalReturnCagr.valuePct === "number"
      ? { totalReturnCagrPct: resolution.totalReturnCagr.valuePct }
      : {};
  }
  return {
    ...(typeof resolution.dividendYield.valuePct === "number" ? { dividendYieldPct: resolution.dividendYield.valuePct } : {}),
    ...(typeof resolution.dividendGrowth.valuePct === "number" ? { dividendGrowthPct: resolution.dividendGrowth.valuePct } : {}),
    ...(typeof resolution.priceCagr.valuePct === "number" ? { priceCagrPct: resolution.priceCagr.valuePct } : {}),
  };
}

export default function PortfolioConfigSection({
  config,
  onConfigChange,
  appliedAssumptions,
  onApply,
  inputs,
  onInputsChange,
  taxMonthlySupply,
  brokerageMonthlySupply,
  onSave,
  saving,
  saveMessage,
  saveError,
}: Props) {
  const [resolutions, setResolutions] = useState<Record<string, PortfolioHoldingResolution>>({});
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});
  const [fetchErrors, setFetchErrors] = useState<Record<string, string>>({});
  const [openAssumptions, setOpenAssumptions] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const resolveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const draftKey = (holdingId: string, field: string) => `${holdingId}:${field}`;
  const taxTotalManwon = inputs.initialIsa + inputs.initialPension;
  const brokerageTotalManwon = inputs.initialTaxableDividend;

  useEffect(() => () => {
    controllersRef.current.forEach((controller) => controller.abort());
    resolveTimersRef.current.forEach((timer) => clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (!config) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const accountType of ACCOUNT_ORDER) {
        for (const holding of config[accountType].holdings) {
          const weightKey = draftKey(holding.id, "weightPct");
          if (focusedKey !== weightKey) next[weightKey] = String(holding.weightPct ?? "");
          for (const field of MANUAL_FIELDS[accountType]) {
            const key = draftKey(holding.id, field.key);
            if (focusedKey !== key) next[key] = holding.manual?.[field.key] === undefined ? "" : String(holding.manual[field.key]);
          }
        }
      }
      return next;
    });
  }, [config, focusedKey]);

  const validationIssues = useMemo(() => config ? validatePortfolioConfig(config) : [], [config]);
  const anyLoading = useMemo(() => Object.values(loadingKeys).some(Boolean), [loadingKeys]);
  const applyPreview = useMemo(
    () => config ? buildAppliedPortfolioAssumptions(config, Object.values(resolutions)) : { assumptions: null, issues: [] },
    [config, resolutions],
  );
  const canApply = Boolean(applyPreview.assumptions) && !anyLoading;
  const currentPortfolioSummary = useMemo(
    () => applyPreview.assumptions
      ? resolveEffectivePortfolioProjectionAssumptions(applyPreview.assumptions).portfolioSummary
      : null,
    [applyPreview.assumptions],
  );
  const applyState: PortfolioApplyState = useMemo(() => {
    if (!config || !appliedAssumptions) return "none";
    if (!doPortfolioAssumptionsMatchConfig(config, appliedAssumptions)) return "config_changed";
    return isPortfolioAssumptionsStale(appliedAssumptions) ? "stale" : "clean";
  }, [config, appliedAssumptions]);

  const updateAccount = (accountType: PortfolioAccountType, holdings: PortfolioHoldingInput[]) => {
    const base = config ?? buildDefaultPortfolioConfig();
    const nextAccount: AccountPortfolioConfig = { accountType, holdings };
    const nextConfig = { ...base, [accountType]: nextAccount };
    const activeResolutionKeys = new Set(
      ACCOUNT_ORDER.flatMap((type) => nextConfig[type].holdings
        .filter((holding) => holding.metricMode === "auto")
        .map((holding) => {
          const ticker = normalizePortfolioTicker(holding.ticker);
          return ticker ? resolutionKey(type, ticker) : null;
        })
        .filter((key): key is string => key !== null)),
    );
    const activeTimerKeys = new Set(
      ACCOUNT_ORDER.flatMap((type) => nextConfig[type].holdings.map((holding) => `${type}:${holding.id}`)),
    );

    // 삭제하거나 티커를 바꾼 종목의 조회값은 남겨 두지 않는다. 적용 스냅샷뿐 아니라
    // 화면용 자동 계산값도 현재 holdings만 참조하게 한다.
    controllersRef.current.forEach((controller, key) => {
      if (!activeResolutionKeys.has(key)) {
        controller.abort();
        controllersRef.current.delete(key);
      }
    });
    resolveTimersRef.current.forEach((timer, key) => {
      if (!activeTimerKeys.has(key)) {
        clearTimeout(timer);
        resolveTimersRef.current.delete(key);
      }
    });
    const keepActive = <T,>(current: Record<string, T>) => Object.fromEntries(
      Object.entries(current).filter(([key]) => activeResolutionKeys.has(key)),
    ) as Record<string, T>;
    setResolutions(keepActive);
    setLoadingKeys(keepActive);
    setFetchErrors(keepActive);
    onConfigChange(nextConfig);
  };

  const updateHolding = (accountType: PortfolioAccountType, holdingId: string, patch: Partial<PortfolioHoldingInput>) => {
    if (!config) return;
    updateAccount(accountType, config[accountType].holdings.map((holding) => holding.id === holdingId ? { ...holding, ...patch } : holding));
  };

  const resolveHolding = async (accountType: PortfolioAccountType, holding: PortfolioHoldingInput) => {
    const ticker = normalizePortfolioTicker(holding.ticker);
    if (!ticker || holding.metricMode === "manual") return;
    const key = resolutionKey(accountType, ticker);
    controllersRef.current.get(key)?.abort();
    const controller = new AbortController();
    controllersRef.current.set(key, controller);
    setLoadingKeys((current) => ({ ...current, [key]: true }));
    setFetchErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    try {
      const result = await resolvePortfolioHoldingMetricsClient(ticker, accountType, controller.signal);
      if (controllersRef.current.get(key) !== controller) return;
      setResolutions((current) => ({ ...current, [key]: result.resolution }));
      if (!result.ok) setFetchErrors((current) => ({ ...current, [key]: result.message ?? "자동 계산에 실패했습니다." }));
    } catch (error) {
      if ((error as { name?: string }).name !== "AbortError" && controllersRef.current.get(key) === controller) {
        setFetchErrors((current) => ({ ...current, [key]: "자동 계산에 실패했습니다." }));
      }
    } finally {
      if (controllersRef.current.get(key) === controller) {
        controllersRef.current.delete(key);
        setLoadingKeys((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
    }
  };

  const scheduleResolve = (accountType: PortfolioAccountType, holding: PortfolioHoldingInput) => {
    const ticker = normalizePortfolioTicker(holding.ticker);
    if (!ticker) return;
    const key = `${accountType}:${holding.id}`;
    const existing = resolveTimersRef.current.get(key);
    if (existing) clearTimeout(existing);
    resolveTimersRef.current.set(key, setTimeout(() => {
      resolveTimersRef.current.delete(key);
      void resolveHolding(accountType, holding);
    }, 450));
  };

  useEffect(() => {
    if (!config) return;
    for (const accountType of ACCOUNT_ORDER) {
      for (const holding of config[accountType].holdings) {
        const ticker = normalizePortfolioTicker(holding.ticker);
        const key = ticker ? resolutionKey(accountType, ticker) : "";
        if (ticker && holding.metricMode === "auto" && !resolutions[key] && !loadingKeys[key]) scheduleResolve(accountType, holding);
      }
    }
    // Resolution is deliberately omitted: this effect only schedules a missing automatic lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, resolutions, loadingKeys]);

  const updateTicker = (accountType: PortfolioAccountType, holding: PortfolioHoldingInput, rawTicker: string) => {
    const ticker = normalizePortfolioTicker(rawTicker);
    const next = { ...holding, ticker, metricMode: "auto" as const, manual: undefined };
    updateHolding(accountType, holding.id, { ticker, metricMode: "auto", manual: undefined });
    scheduleResolve(accountType, next);
  };

  const updateWeight = (accountType: PortfolioAccountType, holding: PortfolioHoldingInput, raw: string) => {
    setDrafts((current) => ({ ...current, [draftKey(holding.id, "weightPct")]: raw }));
    const value = Number(raw);
    updateHolding(accountType, holding.id, { weightPct: Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0 });
  };

  const updateManual = (accountType: PortfolioAccountType, holding: PortfolioHoldingInput, field: keyof PortfolioManualMetrics, raw: string) => {
    setDrafts((current) => ({ ...current, [draftKey(holding.id, field)]: raw }));
    const value = Number(raw);
    const manual = { ...holding.manual };
    if (raw.trim() === "" || !Number.isFinite(value)) delete manual[field];
    else manual[field] = value;
    updateHolding(accountType, holding.id, { metricMode: "manual", manual });
  };

  const openManualEditor = (accountType: PortfolioAccountType, holding: PortfolioHoldingInput, resolution?: PortfolioHoldingResolution) => {
    const manual = Object.keys(holding.manual ?? {}).length > 0 ? holding.manual : resolutionToManual(accountType, resolution);
    updateHolding(accountType, holding.id, { metricMode: "manual", manual });
    setOpenAssumptions((current) => ({ ...current, [holding.id]: true }));
  };

  const restoreAutomatic = (accountType: PortfolioAccountType, holding: PortfolioHoldingInput) => {
    const next = { ...holding, metricMode: "auto" as const, manual: undefined };
    updateHolding(accountType, holding.id, { metricMode: "auto", manual: undefined });
    setOpenAssumptions((current) => ({ ...current, [holding.id]: false }));
    scheduleResolve(accountType, next);
  };

  const updateAccountTotal = (accountType: PortfolioAccountType, raw: string) => {
    const eok = Number(raw);
    if (!Number.isFinite(eok)) return;
    const total = Math.max(0, eok * 10_000);
    if (accountType === "taxSaving") {
      onInputsChange({ ...inputs, initialPension: Math.max(0, total - inputs.initialIsa) });
    } else {
      onInputsChange({ ...inputs, initialTaxableDividend: total });
    }
  };

  const handleApply = () => {
    if (!applyPreview.assumptions) return;
    onApply(applyPreview.assumptions);
    setApplyMessage("결과가 최신 입력값으로 갱신되었습니다.");
    document.getElementById("safety-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!config) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#273032] dark:bg-[#171d1e]">
        <h2 className="text-[17px] font-bold text-slate-900 dark:text-white">2. 계좌 입력</h2>
        <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-300">절세계좌 인출과 위탁계좌 배당 현금흐름을 입력합니다.</p>
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center dark:border-[#2c3638] dark:bg-[#12181a]">
          <p className="text-[13px] text-slate-700 dark:text-slate-200">티커와 비중만 입력하면 자동 가정을 불러옵니다.</p>
          <button type="button" onClick={() => onConfigChange(buildDefaultPortfolioConfig())} className="mt-3 rounded-lg bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-blue-500">예시 포트폴리오로 시작</button>
        </div>
      </section>
    );
  }

  const calculationStatus: { label: string; tone: UiTone } = anyLoading
    ? { label: "자동 계산 중", tone: "neutral" }
    : validationIssues.length > 0
      ? { label: "비중 또는 입력 확인 필요", tone: "caution" }
    : Object.keys(fetchErrors).length > 0
      ? { label: "가정 일부 확인 필요", tone: "caution" }
      : { label: applyState === "clean" ? "결과가 최신입니다" : "자동 계산 완료", tone: "positive" };

  return (
    <section aria-labelledby="portfolio-config-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="portfolio-config-heading" className="text-[17px] font-bold text-slate-900 dark:text-white">2. 계좌 입력</h2>
          <p className="mt-1 text-[12.5px] text-slate-600 dark:text-slate-300">티커와 비중은 직접 입력하고, 환산 금액과 기초 가정은 자동으로 표시됩니다.</p>
        </div>
        <StatusBadge tone={calculationStatus.tone}>{calculationStatus.label}</StatusBadge>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        {ACCOUNT_ORDER.map((accountType) => {
          const account = config[accountType];
          const copy = ACCOUNT_COPY[accountType];
          const isTaxSaving = accountType === "taxSaving";
          const totalManwon = isTaxSaving ? taxTotalManwon : brokerageTotalManwon;
          const monthlyCash = isTaxSaving ? taxMonthlySupply : brokerageMonthlySupply;
          const summaryValue = isTaxSaving
            ? currentPortfolioSummary?.taxSaving.effectiveTotalReturnPct
            : currentPortfolioSummary?.brokerage.effectiveDividendYieldPct;
          const canShowCurrentMetrics = currentPortfolioSummary !== null && canApply;
          const canShowProjectedCash = applyState === "clean";
          const weight = describeAccountWeight(account.holdings);
          const accent = copy.accent === "emerald"
            ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-500/40 dark:bg-emerald-500/[0.03]"
            : "border-orange-300 bg-orange-50/30 dark:border-orange-500/40 dark:bg-orange-500/[0.03]";
          const accentText = copy.accent === "emerald" ? "text-emerald-700 dark:text-emerald-300" : "text-orange-700 dark:text-orange-300";
          return (
            <section key={accountType} aria-label={copy.title} className={`min-w-0 rounded-xl border p-3 sm:p-4 ${accent}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className={`text-[15px] font-bold ${accentText}`}>{copy.title}</h3>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400">{copy.subtitle}</p>
                </div>
                <StatusBadge tone={weight.tone}>{weight.label}</StatusBadge>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="grid grid-cols-2 gap-2">
                  <label className="min-w-0">
                    <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">총자산</span>
                    <span className="mt-1 flex overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-[#334044] dark:bg-[#101618]">
                      <input type="number" min={0} step={0.1} value={formatEokInput(totalManwon)} onChange={(event) => updateAccountTotal(accountType, event.target.value)} className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-right text-[14px] font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 dark:text-white dark:focus:ring-blue-500/20" aria-label={`${copy.title} 총자산 억원`} />
                      <span className="flex items-center pr-2 text-[11px] font-semibold text-slate-500">억원</span>
                    </span>
                  </label>
                  {isTaxSaving && (
                    <label className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">연 인출률</span>
                      <span className="mt-1 flex overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-[#334044] dark:bg-[#101618]">
                        <input type="number" min={0} max={100} step={0.1} value={inputs.withdrawalRate} onChange={(event) => onInputsChange({ ...inputs, withdrawalRate: Number(event.target.value) || 0 })} className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-right text-[14px] font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 dark:text-white dark:focus:ring-blue-500/20" aria-label="절세계좌 연 인출률" />
                        <span className="flex items-center pr-2 text-[11px] font-semibold text-slate-500">%</span>
                      </span>
                    </label>
                  )}
                </div>
                <div className="rounded-lg border border-white/80 bg-white/80 p-2.5 shadow-sm dark:border-white/10 dark:bg-black/10">
                  <p className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span>자동 계산</span>
                    <span className={canShowCurrentMetrics ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                      {canShowCurrentMetrics ? "● 완료" : "● 확인 필요"}
                    </span>
                  </p>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">{isTaxSaving ? "예상 CAGR" : "예상 세후 배당률"}</p>
                      <p className="text-[19px] font-extrabold text-slate-900 dark:text-white">
                        {canShowCurrentMetrics && typeof summaryValue === "number" ? formatPct(summaryValue, 1) : "확인 필요"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">예상 월 현금</p>
                      <p className="text-[19px] font-extrabold text-slate-900 dark:text-white">
                        {canShowProjectedCash && monthlyCash !== null ? formatManwonMoney(monthlyCash) : "결과 확인 후"}
                      </p>
                    </div>
                  </div>
                  {!canShowCurrentMetrics && <p className="mt-1.5 text-[10.5px] text-amber-700 dark:text-amber-300">비중 100% 입력 후 계산</p>}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {account.holdings.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-[12px] text-slate-600 dark:border-[#2c3638] dark:text-slate-400">종목을 추가해 주세요.</p> : account.holdings.map((holding) => {
                  const ticker = normalizePortfolioTicker(holding.ticker);
                  const resolution = ticker ? resolutions[resolutionKey(accountType, ticker)] : undefined;
                  const loading = ticker ? Boolean(loadingKeys[resolutionKey(accountType, ticker)]) : false;
                  const error = ticker ? fetchErrors[resolutionKey(accountType, ticker)] : undefined;
                  return <HoldingRow key={holding.id} accountType={accountType} holding={holding} resolution={resolution} loading={loading} error={error} totalManwon={totalManwon} issues={validationIssues.filter((issue) => issue.accountType === accountType && issue.holdingId === holding.id)} drafts={drafts} open={Boolean(openAssumptions[holding.id])} onFocus={(key) => setFocusedKey(key)} onBlur={() => setFocusedKey(null)} onTickerChange={(value) => updateTicker(accountType, holding, value)} onWeightChange={(value) => updateWeight(accountType, holding, value)} onOpenManual={() => openManualEditor(accountType, holding, resolution)} onCloseManual={() => setOpenAssumptions((current) => ({ ...current, [holding.id]: false }))} onRestoreAuto={() => restoreAutomatic(accountType, holding)} onManualChange={(field, value) => updateManual(accountType, holding, field, value)} onRemove={() => updateAccount(accountType, account.holdings.filter((item) => item.id !== holding.id))} />;
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => updateAccount(accountType, [...account.holdings, { id: generateHoldingId(accountType), ticker: "", weightPct: 0, metricMode: "auto" }])} className="rounded-lg border border-dashed border-slate-400 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#171d1e] dark:text-slate-200">+ 종목 추가</button>
                <div className="flex flex-wrap items-center justify-end gap-2"><span className="text-[11px] text-slate-500 dark:text-slate-400">비중을 수정하면 나머지 종목 비중이 자동 조정됩니다.</span><StatusBadge tone={weight.tone}>{weight.label}</StatusBadge></div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-[#2c3638] dark:bg-[#12181a] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-slate-600 dark:text-slate-300" role="status">{saveError ?? saveMessage ?? applyMessage ?? (anyLoading ? "종목 가정을 자동으로 계산하고 있습니다." : "자동 계산 결과는 입력값을 바꾸면 다시 갱신됩니다.")}</p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onSave} disabled={saving} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#465456] dark:bg-[#171d1e] dark:text-slate-200 dark:hover:bg-[#222b2d]">{saving ? "저장 중" : "저장"}</button>
          <button type="button" onClick={handleApply} disabled={!canApply} className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700">결과 확인</button>
        </div>
      </div>
      {!canApply && !anyLoading && applyPreview.issues.length > 0 && <ul className="mt-2 space-y-1 text-[11.5px] text-rose-600 dark:text-rose-400">{applyPreview.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>• {issue.message}</li>)}</ul>}
    </section>
  );
}

type HoldingRowProps = {
  accountType: PortfolioAccountType;
  holding: PortfolioHoldingInput;
  resolution?: PortfolioHoldingResolution;
  loading: boolean;
  error?: string;
  totalManwon: number;
  issues: PortfolioValidationIssue[];
  drafts: Record<string, string>;
  open: boolean;
  onFocus: (key: string) => void;
  onBlur: () => void;
  onTickerChange: (value: string) => void;
  onWeightChange: (value: string) => void;
  onOpenManual: () => void;
  onCloseManual: () => void;
  onRestoreAuto: () => void;
  onManualChange: (field: keyof PortfolioManualMetrics, value: string) => void;
  onRemove: () => void;
};

function HoldingRow({ accountType, holding, resolution, loading, error, totalManwon, issues, drafts, open, onFocus, onBlur, onTickerChange, onWeightChange, onOpenManual, onCloseManual, onRestoreAuto, onManualChange, onRemove }: HoldingRowProps) {
  const isManual = holding.metricMode === "manual";
  const key = (field: string) => `${holding.id}:${field}`;
  const taxMetric = isManual ? holding.manual?.totalReturnCagrPct : resolution?.totalReturnCagr.valuePct;
  const dividendYield = isManual ? holding.manual?.dividendYieldPct : resolution?.dividendYield.valuePct;
  const dividendGrowth = isManual ? holding.manual?.dividendGrowthPct : resolution?.dividendGrowth.valuePct;
  const priceCagr = isManual ? holding.manual?.priceCagrPct : resolution?.priceCagr.valuePct;
  const needsAttention = Boolean(error) || (!isManual && resolution && resolutionNeedsManualFallback(resolution, accountType));
  return (
    <div aria-busy={loading} className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-[#2c3638] dark:bg-[#171d1e]">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px_34px] gap-2 sm:grid-cols-[minmax(160px,1fr)_92px_36px]">
        <label className="min-w-0"><span className="sr-only">티커</span><input type="text" value={holding.ticker} onChange={(event) => onTickerChange(event.target.value)} placeholder="예: SCHD" aria-label={`${accountType === "taxSaving" ? "절세계좌" : "위탁계좌"} 티커`} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold uppercase text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-[#334044] dark:bg-[#101618] dark:text-white dark:focus:ring-blue-500/20" /></label>
        <label className="min-w-0"><span className="sr-only">비중 퍼센트</span><span className="flex overflow-hidden rounded-md border border-slate-300 bg-white dark:border-[#334044] dark:bg-[#101618]"><input type="number" min={0} max={100} step={1} value={drafts[key("weightPct")] ?? String(holding.weightPct)} onFocus={() => onFocus(key("weightPct"))} onBlur={onBlur} onChange={(event) => onWeightChange(event.target.value)} className="min-w-0 flex-1 bg-transparent px-2 py-2 text-right text-[13px] font-semibold text-slate-900 outline-none dark:text-white" /><span className="flex items-center pr-2 text-[11px] text-slate-500">%</span></span></label>
        <button type="button" onClick={onRemove} aria-label={`${holding.ticker || "빈"} 종목 삭제`} className="rounded-md border border-slate-300 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-[#334044] dark:text-slate-300">⌫</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px]">
        <span className="text-slate-500 dark:text-slate-400">자동 환산 <b className="font-semibold text-slate-800 dark:text-slate-100">{formatAutoAmount(totalManwon, holding.weightPct)}</b></span>
        {accountType === "taxSaving" ? <StatusBadge tone={typeof taxMetric === "number" ? "positive" : "muted"}>CAGR {typeof taxMetric === "number" ? formatPct(taxMetric, 1) : loading ? "계산 중" : "대기"}</StatusBadge> : <><StatusBadge tone={typeof dividendYield === "number" ? "positive" : "muted"}>배당률 {typeof dividendYield === "number" ? formatPct(dividendYield, 1) : loading ? "계산 중" : "대기"}</StatusBadge><StatusBadge tone={metricTone({ valuePct: dividendGrowth ?? null })}>배당성장 {typeof dividendGrowth === "number" ? formatPct(dividendGrowth, 1) : "—"}</StatusBadge><StatusBadge tone={metricTone({ valuePct: priceCagr ?? null })}>주가성장 {typeof priceCagr === "number" ? formatPct(priceCagr, 1) : "—"}</StatusBadge></>}
        <button type="button" onClick={isManual && open ? onCloseManual : onOpenManual} className="ml-auto rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#334044] dark:text-slate-200">{isManual && open ? "수정 닫기" : "가정 수정"}</button>
      </div>
      {issues.length > 0 && <ul className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">{issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>}
      {needsAttention && <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300">{error ?? "자동 가정에 필요한 데이터가 부족합니다. 가정 수정에서 직접 보완해 주세요."}</p>}
      {isManual && open && <div className="mt-2 rounded-md border border-blue-100 bg-blue-50/60 p-2.5 dark:border-blue-500/20 dark:bg-blue-500/[0.05]"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">수동 보정값 <span className="font-normal text-slate-500">· 저장 시 기존 가정 구조를 사용합니다</span></p><button type="button" onClick={onRestoreAuto} className="text-[11px] font-semibold text-blue-700 underline underline-offset-2 dark:text-blue-300">자동값으로 되돌리기</button></div><div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">{MANUAL_FIELDS[accountType].map((field) => <label key={field.key} className="min-w-0"><span className="text-[10.5px] text-slate-600 dark:text-slate-300">{field.label}</span><span className="mt-1 flex overflow-hidden rounded-md border border-slate-300 bg-white dark:border-[#334044] dark:bg-[#101618]"><input type="number" step={0.1} value={drafts[key(field.key)] ?? ""} onFocus={() => onFocus(key(field.key))} onBlur={onBlur} onChange={(event) => onManualChange(field.key, event.target.value)} className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-right text-[12px] text-slate-900 outline-none dark:text-white" /><span className="flex items-center pr-2 text-[10px] text-slate-500">%</span></span></label>)}</div></div>}
    </div>
  );
}
