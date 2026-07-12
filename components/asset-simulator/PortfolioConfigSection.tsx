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
} from "@/lib/asset-simulator-portfolio-assumptions";
import { resolvePortfolioHoldingMetricsClient } from "@/lib/asset-simulator-portfolio-client";
import {
  ACCOUNT_LABELS,
  APPLY_BLOCKED_HINT,
  APPLY_WHILE_LOADING_HINT,
  AUTO_NOT_APPLIED_HINT,
  AUTO_RESULT_STALE_HINT,
  MANUAL_FALLBACK_HINTS,
  describeApplyState,
  describeMetricStatus,
  formatPct,
  formatYears,
  isAutoResultStale,
  isWeightTotalValid,
  resolutionHasInsufficientHistory,
  resolutionKey,
  resolutionNeedsManualFallback,
  sumWeightPct,
  type PortfolioApplyState,
  type UiTone,
} from "@/lib/asset-simulator-portfolio-ui";
import type {
  AccountPortfolioConfig,
  AppliedPortfolioAssumptionsV1,
  AssetSimulatorPortfolioConfigV1,
  PortfolioAccountType,
  PortfolioHoldingInput,
  PortfolioHoldingResolution,
  PortfolioManualMetrics,
  PortfolioProjectionSummary,
  PortfolioValidationIssue,
  ResolvedPortfolioMetric,
} from "@/lib/asset-simulator-types";

type Props = {
  config: AssetSimulatorPortfolioConfigV1 | null;
  onConfigChange: (config: AssetSimulatorPortfolioConfigV1) => void;
  appliedAssumptions: AppliedPortfolioAssumptionsV1 | null;
  onApply: (assumptions: AppliedPortfolioAssumptionsV1) => void;
  portfolioSummary?: PortfolioProjectionSummary;
};

const ACCOUNT_ORDER: PortfolioAccountType[] = ["taxSaving", "brokerage"];

const MANUAL_FIELDS: Record<PortfolioAccountType, Array<{ key: keyof PortfolioManualMetrics; label: string }>> = {
  taxSaving: [{ key: "totalReturnCagrPct", label: "총수익 CAGR" }],
  brokerage: [
    { key: "priceCagrPct", label: "가격 CAGR" },
    { key: "dividendYieldPct", label: "배당률(TTM)" },
    { key: "dividendGrowthPct", label: "배당성장률" },
  ],
};

const TONE_TEXT: Record<UiTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-slate-600 dark:text-slate-300",
  caution: "text-amber-600 dark:text-amber-400",
  warning: "text-rose-600 dark:text-rose-400",
  muted: "text-slate-400 dark:text-slate-500",
};

const TONE_BADGE: Record<UiTone, string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30",
  caution: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  warning: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
  muted: "bg-slate-100 text-slate-400 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-500 dark:ring-slate-500/20",
};

function generateHoldingId(accountType: PortfolioAccountType): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${accountType}-${suffix}`;
}

function StatusBadge({ tone, children }: { tone: UiTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex max-w-full items-center break-words rounded-full px-2 py-0.5 text-center text-[11px] font-semibold leading-4 ring-1 ring-inset ${TONE_BADGE[tone]}`}>
      {children}
    </span>
  );
}

export default function PortfolioConfigSection({
  config,
  onConfigChange,
  appliedAssumptions,
  onApply,
  portfolioSummary,
}: Props) {
  const [resolutions, setResolutions] = useState<Record<string, PortfolioHoldingResolution>>({});
  const [resolvedAt, setResolvedAt] = useState<Record<string, string>>({});
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});
  const [fetchErrors, setFetchErrors] = useState<Record<string, string>>({});
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  // 진행 중인 자동 계산 요청을 티커 키별로 추적한다. 같은 키의 새 요청이 시작되면
  // 이전 요청을 abort 해 최신 요청만 반영하고, 언마운트 시 모두 취소한다.
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  // 편집 중인 숫자 입력만 사용자의 입력 텍스트를 보존하고, 나머지는 항상 config 값을 표시한다.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const draftKey = (holdingId: string, field: string) => `${holdingId}:${field}`;

  useEffect(() => {
    if (!config) {
      setDrafts({});
      return;
    }
    setDrafts((current) => {
      const next: Record<string, string> = {};
      for (const accountType of ACCOUNT_ORDER) {
        for (const holding of config[accountType].holdings) {
          const weightK = draftKey(holding.id, "weightPct");
          next[weightK] = focusedKey === weightK && weightK in current
            ? current[weightK]
            : String(holding.weightPct ?? "");
          for (const field of MANUAL_FIELDS[accountType]) {
            const k = draftKey(holding.id, field.key);
            const value = holding.manual?.[field.key];
            next[k] = focusedKey === k && k in current
              ? current[k]
              : value === undefined || value === null ? "" : String(value);
          }
        }
      }
      return next;
    });
  }, [config, focusedKey]);

  const validationIssues = useMemo(
    () => (config ? validatePortfolioConfig(config) : []),
    [config],
  );

  const applyState: PortfolioApplyState = useMemo(() => {
    if (!appliedAssumptions) return "none";
    if (!config) return "none";
    if (!doPortfolioAssumptionsMatchConfig(config, appliedAssumptions)) return "config_changed";
    if (isPortfolioAssumptionsStale(appliedAssumptions)) return "stale";
    return "clean";
  }, [appliedAssumptions, config]);

  const hasAutoResults = useMemo(() => Object.keys(resolutions).length > 0, [resolutions]);

  // 적용 게이트를 실시간으로 미리 계산한다. 이 계산은 시뮬레이션에 반영되지 않고,
  // 적용 가능 여부와 남은 이슈 안내에만 쓴다(appliedAt 은 실제 적용 시 다시 찍는다).
  const applyPreview = useMemo(() => {
    if (!config) {
      return { assumptions: null as AppliedPortfolioAssumptionsV1 | null, issues: [] as PortfolioValidationIssue[] };
    }
    return buildAppliedPortfolioAssumptions(config, Object.values(resolutions));
  }, [config, resolutions]);

  const anyLoading = useMemo(() => Object.values(loadingKeys).some(Boolean), [loadingKeys]);
  const canApply = Boolean(config) && Boolean(applyPreview.assumptions) && !anyLoading;

  const updateAccount = (accountType: PortfolioAccountType, holdings: PortfolioHoldingInput[]) => {
    const base = config ?? buildDefaultPortfolioConfig();
    const nextAccount: AccountPortfolioConfig = { accountType, holdings };
    onConfigChange({ ...base, [accountType]: nextAccount });
  };

  const updateHolding = (
    accountType: PortfolioAccountType,
    holdingId: string,
    patch: Partial<PortfolioHoldingInput>,
  ) => {
    if (!config) return;
    const holdings = config[accountType].holdings.map((holding) =>
      holding.id === holdingId ? { ...holding, ...patch } : holding,
    );
    updateAccount(accountType, holdings);
  };

  const updateManual = (
    accountType: PortfolioAccountType,
    holdingId: string,
    field: keyof PortfolioManualMetrics,
    value: number | undefined,
  ) => {
    if (!config) return;
    const holdings = config[accountType].holdings.map((holding) => {
      if (holding.id !== holdingId) return holding;
      const manual: PortfolioManualMetrics = { ...holding.manual };
      if (value === undefined) delete manual[field];
      else manual[field] = value;
      return { ...holding, manual };
    });
    updateAccount(accountType, holdings);
  };

  const addHolding = (accountType: PortfolioAccountType) => {
    const base = config ?? buildDefaultPortfolioConfig();
    const holdings = [
      ...base[accountType].holdings,
      { id: generateHoldingId(accountType), ticker: "", weightPct: 0, metricMode: "auto" as const },
    ];
    onConfigChange({ ...base, [accountType]: { accountType, holdings } });
  };

  const removeHolding = (accountType: PortfolioAccountType, holdingId: string) => {
    if (!config) return;
    updateAccount(accountType, config[accountType].holdings.filter((holding) => holding.id !== holdingId));
  };

  const commitNumberDraft = (
    holdingId: string,
    field: "weightPct" | keyof PortfolioManualMetrics,
    rawValue: string,
    accountType: PortfolioAccountType,
  ) => {
    setDrafts((current) => ({ ...current, [draftKey(holdingId, field)]: rawValue }));
    const trimmed = rawValue.trim();
    const parsed = Number(trimmed);
    if (field === "weightPct") {
      updateHolding(accountType, holdingId, { weightPct: trimmed === "" || !Number.isFinite(parsed) ? 0 : parsed });
      return;
    }
    updateManual(accountType, holdingId, field, trimmed === "" || !Number.isFinite(parsed) ? undefined : parsed);
  };

  const runResolve = async (accountType: PortfolioAccountType, holding: PortfolioHoldingInput) => {
    const ticker = normalizePortfolioTicker(holding.ticker);
    if (!ticker) return;
    const key = resolutionKey(accountType, ticker);

    // 최신 요청만 반영: 같은 티커의 진행 중 요청은 취소한다.
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
      // 이 응답이 여전히 최신 요청인지 확인(그 사이 새 요청이 시작되면 무시).
      if (controllersRef.current.get(key) !== controller) return;
      // 성공/실패 모두 resolution(성공값 또는 실패 fallback)을 보관해 UI 상태를 유지한다.
      setResolutions((current) => ({ ...current, [key]: result.resolution }));
      setResolvedAt((current) => ({ ...current, [key]: new Date().toISOString() }));
      if (!result.ok) {
        setFetchErrors((current) => ({ ...current, [key]: result.message ?? "자동 계산에 실패했습니다." }));
      }
    } catch (error) {
      // AbortError = 최신 요청으로 대체되었거나 언마운트됨 → 조용히 무시한다.
      if ((error as { name?: string })?.name === "AbortError") return;
      if (controllersRef.current.get(key) !== controller) return;
      setFetchErrors((current) => ({ ...current, [key]: "자동 계산에 실패했습니다." }));
    } finally {
      // 이 요청이 여전히 소유자일 때만 로딩을 해제한다(대체된 요청은 새 소유자가 관리).
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

  const autoHoldingsWithTicker = (accountType: PortfolioAccountType): PortfolioHoldingInput[] =>
    config
      ? config[accountType].holdings.filter(
          (holding) => holding.metricMode === "auto" && normalizePortfolioTicker(holding.ticker),
        )
      : [];

  // 실패했거나(fetchError) 수동 보완이 필요한 자동 계산 티커만 골라낸다.
  const failedAutoHoldings = (accountType: PortfolioAccountType): PortfolioHoldingInput[] =>
    autoHoldingsWithTicker(accountType).filter((holding) => {
      const key = resolutionKey(accountType, normalizePortfolioTicker(holding.ticker));
      if (fetchErrors[key]) return true;
      const resolution = resolutions[key];
      return resolution ? resolutionNeedsManualFallback(resolution, accountType) : false;
    });

  const runResolveAll = async (accountType: PortfolioAccountType) => {
    await Promise.all(autoHoldingsWithTicker(accountType).map((holding) => runResolve(accountType, holding)));
  };

  const runResolveFailed = async (accountType: PortfolioAccountType) => {
    await Promise.all(failedAutoHoldings(accountType).map((holding) => runResolve(accountType, holding)));
  };

  const handleApply = () => {
    if (!config) return;
    setApplyMessage(null);
    // 클릭 시점 기준으로 다시 계산해 appliedAt 을 정확히 찍는다.
    const { assumptions } = buildAppliedPortfolioAssumptions(config, Object.values(resolutions));
    if (!assumptions) {
      // 버튼이 disabled 이므로 정상 흐름에선 도달하지 않지만, 방어적으로 처리한다.
      setApplyMessage("적용할 수 없는 항목이 있어 시뮬레이션에 반영하지 않았습니다.");
      return;
    }
    onApply(assumptions);
    setApplyMessage("포트폴리오 가정을 적용해 시뮬레이션에 반영했습니다.");
  };

  const issuesForHolding = (accountType: PortfolioAccountType, holdingId: string) =>
    validationIssues.filter((issue) => issue.accountType === accountType && issue.holdingId === holdingId);

  const accountLevelIssues = (accountType: PortfolioAccountType) =>
    validationIssues.filter((issue) => issue.accountType === accountType && !issue.holdingId);

  const applyStateBanner = describeApplyState(applyState);

  return (
    <section
      aria-labelledby="portfolio-config-heading"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="portfolio-config-heading" className="text-[17px] font-bold text-slate-900 dark:text-white">
            포트폴리오 설정
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-600 dark:text-slate-300">1. 티커·비중 입력 → 2. 자동 계산 또는 수동 보완 → 3. 가정 적용</span>
            <span className="block text-[12px] text-slate-400 dark:text-slate-500">적용 전의 계산 결과는 시뮬레이션에 반영되지 않습니다.</span>
          </p>
        </div>
      </div>

      {!config ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center dark:border-[#2c3638] dark:bg-[#12181a]">
          <p className="text-[13.5px] text-slate-600 dark:text-slate-300">
            아직 포트폴리오 설정이 없습니다. 예시 포트폴리오를 불러오거나 빈 설정으로 시작할 수 있습니다.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onConfigChange(buildDefaultPortfolioConfig())}
              className="rounded-lg bg-slate-900 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              예시 포트폴리오 불러오기
            </button>
            <button
              type="button"
              onClick={() => onConfigChange({
                version: 1,
                taxSaving: { accountType: "taxSaving", holdings: [] },
                brokerage: { accountType: "brokerage", holdings: [] },
              })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-[#2c3638] dark:text-slate-200 dark:hover:bg-[#1c2426]"
            >
              빈 포트폴리오로 시작
            </button>
          </div>
          <p className="mt-2 text-[12px] text-slate-400 dark:text-slate-500">
            예시 값(절세: SCHD/QLD, 위탁: SCHD/JEPQ)은 참고용이며 투자 권유가 아닙니다.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {ACCOUNT_ORDER.map((accountType) => {
              const account = config[accountType];
              const weightPct = sumWeightPct(account.holdings);
              const weightValid = isWeightTotalValid(account.holdings);
              const accountIssues = accountLevelIssues(accountType);
              const hasAutoTicker = autoHoldingsWithTicker(accountType).length > 0;
              const accountLoading = account.holdings.some(
                (holding) => loadingKeys[resolutionKey(accountType, normalizePortfolioTicker(holding.ticker))],
              );
              const failedCount = failedAutoHoldings(accountType).length;
              return (
                <div
                  key={accountType}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-[#2c3638] dark:bg-[#12181a] sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[14.5px] font-bold text-slate-800 dark:text-slate-100">
                      {ACCOUNT_LABELS[accountType]}
                    </h3>
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="text-slate-500 dark:text-slate-400">비중 합계</span>
                      <StatusBadge tone={weightValid ? "positive" : "warning"}>
                        {weightPct}%
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    {account.holdings.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-[12.5px] text-slate-400 dark:border-[#2c3638] dark:text-slate-500">
                        아직 티커가 없습니다. 아래 “행 추가”로 종목을 넣어 주세요.
                      </p>
                    ) : (
                      account.holdings.map((holding) => (
                        <HoldingRow
                          key={holding.id}
                          accountType={accountType}
                          holding={holding}
                          issues={issuesForHolding(accountType, holding.id)}
                          resolution={resolutions[resolutionKey(accountType, normalizePortfolioTicker(holding.ticker))]}
                          loading={Boolean(loadingKeys[resolutionKey(accountType, normalizePortfolioTicker(holding.ticker))])}
                          fetchError={fetchErrors[resolutionKey(accountType, normalizePortfolioTicker(holding.ticker))]}
                          resolvedAt={resolvedAt[resolutionKey(accountType, normalizePortfolioTicker(holding.ticker))]}
                          drafts={drafts}
                          onFocusField={setFocusedKey}
                          onBlurField={() => setFocusedKey(null)}
                          onTickerChange={(value) => updateHolding(accountType, holding.id, { ticker: normalizePortfolioTicker(value) })}
                          onWeightChange={(value) => commitNumberDraft(holding.id, "weightPct", value, accountType)}
                          onModeChange={(mode) => updateHolding(accountType, holding.id, { metricMode: mode })}
                          onManualChange={(field, value) => commitNumberDraft(holding.id, field, value, accountType)}
                          onRecalculate={() => runResolve(accountType, holding)}
                          onRemove={() => removeHolding(accountType, holding.id)}
                        />
                      ))
                    )}
                  </div>

                  {accountIssues.length > 0 && (
                    <ul className="mt-2 space-y-1" role="alert">
                      {accountIssues.map((issue, index) => (
                        <li key={`${issue.code}-${index}`} className="text-[12px] text-rose-600 dark:text-rose-400">
                          • {issue.message}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addHolding(accountType)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-[#2c3638] dark:text-slate-200 dark:hover:bg-[#1c2426]"
                    >
                      + 행 추가
                    </button>
                    <button
                      type="button"
                      onClick={() => void runResolveAll(accountType)}
                      disabled={!hasAutoTicker || accountLoading}
                      aria-busy={accountLoading || undefined}
                      className="rounded-lg border border-sky-300 px-2.5 py-1.5 text-[12.5px] font-semibold text-sky-700 transition hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-500/40 dark:text-sky-300 dark:hover:bg-sky-500/10"
                    >
                      {accountLoading ? "자동 계산 중…" : "전체 자동 계산"}
                    </button>
                    {failedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void runResolveFailed(accountType)}
                        disabled={accountLoading}
                        aria-busy={accountLoading || undefined}
                        className="rounded-lg border border-amber-300 px-2.5 py-1.5 text-[12.5px] font-semibold text-amber-700 transition hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10"
                      >
                        실패한 티커만 다시 계산 ({failedCount})
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 적용 흐름 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-[#2c3638] dark:bg-[#12181a] sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApply}
                disabled={!canApply}
                aria-disabled={!canApply || undefined}
                className="rounded-lg bg-sky-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-sky-600"
              >
                포트폴리오 가정 적용
              </button>
              {applyState === "clean" && (
                <StatusBadge tone="positive">적용된 가정으로 시뮬레이션 반영됨</StatusBadge>
              )}
            </div>

            {anyLoading && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
                {APPLY_WHILE_LOADING_HINT}
              </p>
            )}
            {applyStateBanner && (
              <p className={`mt-2 text-[12.5px] leading-relaxed ${TONE_TEXT[applyStateBanner.tone]}`} role="status">{applyStateBanner.label}</p>
            )}
            {hasAutoResults && applyState !== "clean" && (
              <p className="mt-1 text-[12px] leading-relaxed text-amber-600 dark:text-amber-400">{AUTO_NOT_APPLIED_HINT}</p>
            )}
            {!anyLoading && !applyPreview.assumptions && (
              <div className="mt-2">
                <p className="text-[12.5px] leading-relaxed text-amber-600 dark:text-amber-400" role="status">
                  {APPLY_BLOCKED_HINT}
                </p>
                {applyPreview.issues.length > 0 && (
                  <ul className="mt-1 space-y-1" role="alert">
                    {applyPreview.issues.map((issue, index) => (
                      <li key={`${issue.code}-${index}`} className="text-[12px] text-rose-600 dark:text-rose-400">
                        • [{issue.accountType === "taxSaving" ? "절세" : "위탁"}] {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {applyMessage && (
              <p className={`mt-2 text-[12.5px] ${TONE_TEXT.positive}`} role="status">
                {applyMessage}
              </p>
            )}
          </div>

          {portfolioSummary && appliedAssumptions && (
            <PortfolioSummaryCard summary={portfolioSummary} />
          )}
        </div>
      )}
    </section>
  );
}

type HoldingRowProps = {
  accountType: PortfolioAccountType;
  holding: PortfolioHoldingInput;
  issues: PortfolioValidationIssue[];
  resolution?: PortfolioHoldingResolution;
  loading: boolean;
  fetchError?: string;
  resolvedAt?: string;
  drafts: Record<string, string>;
  onFocusField: (key: string) => void;
  onBlurField: () => void;
  onTickerChange: (value: string) => void;
  onWeightChange: (value: string) => void;
  onModeChange: (mode: "auto" | "manual") => void;
  onManualChange: (field: keyof PortfolioManualMetrics, value: string) => void;
  onRecalculate: () => void;
  onRemove: () => void;
};

function HoldingRow({
  accountType,
  holding,
  issues,
  resolution,
  loading,
  fetchError,
  resolvedAt,
  drafts,
  onFocusField,
  onBlurField,
  onTickerChange,
  onWeightChange,
  onModeChange,
  onManualChange,
  onRecalculate,
  onRemove,
}: HoldingRowProps) {
  const draftKey = (field: string) => `${holding.id}:${field}`;
  const isManual = holding.metricMode === "manual";

  // 자동 계산 모드에서만 노출하는 수동 fallback 안내/전환 조건을 계산한다.
  const needsFallback = !isManual && !loading && (
    Boolean(fetchError) || (resolution ? resolutionNeedsManualFallback(resolution, accountType) : false)
  );
  const fallbackMessage = fetchError
    ? MANUAL_FALLBACK_HINTS.fetchFailed
    : resolution && resolutionHasInsufficientHistory(resolution, accountType)
      ? MANUAL_FALLBACK_HINTS.shortHistory
      : MANUAL_FALLBACK_HINTS.general;
  const showStaleHint = !isManual && !loading && !fetchError && Boolean(resolution) && isAutoResultStale(resolvedAt);

  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-[#2c3638] dark:bg-[#171d1e]">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">티커</span>
          <input
            type="text"
            value={holding.ticker}
            onChange={(event) => onTickerChange(event.target.value)}
            placeholder="예: SCHD"
            aria-label={`${accountType === "taxSaving" ? "절세계좌" : "위탁계좌"} 티커`}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[13px] uppercase text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-[#2c3638] dark:bg-[#12181a] dark:text-slate-100 dark:focus:ring-sky-500/30"
          />
        </label>
        <label className="flex w-20 flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">비중 %</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={1}
            value={drafts[draftKey("weightPct")] ?? String(holding.weightPct ?? "")}
            onFocus={() => onFocusField(draftKey("weightPct"))}
            onBlur={onBlurField}
            onChange={(event) => onWeightChange(event.target.value)}
            aria-label="비중 퍼센트"
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-[#2c3638] dark:bg-[#12181a] dark:text-slate-100 dark:focus:ring-sky-500/30"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">계산 방식</span>
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300 dark:border-[#2c3638]" role="group" aria-label="계산 방식 선택">
            {(["auto", "manual"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onModeChange(mode)}
                aria-pressed={holding.metricMode === mode}
                className={`px-2.5 py-1.5 text-[12px] font-semibold transition ${
                  holding.metricMode === mode
                    ? "bg-sky-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-[#12181a] dark:text-slate-300 dark:hover:bg-[#1c2426]"
                }`}
              >
                {mode === "auto" ? "자동 계산" : "수동 입력"}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${holding.ticker || "빈"} 행 삭제`}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-[12px] font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 dark:border-[#2c3638] dark:text-slate-400 dark:hover:bg-rose-500/10"
        >
          삭제
        </button>
      </div>

      {issues.length > 0 && (
        <ul className="mt-1.5 space-y-0.5" role="alert">
          {issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`} className="text-[11.5px] text-rose-600 dark:text-rose-400">
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      {isManual ? (
        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-[#2c3638] dark:bg-[#12181a]">
          <p className="mb-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            수동 입력값 (단위 %)
          </p>
          <div className="flex flex-wrap gap-2">
            {MANUAL_FIELDS[accountType].map((field) => (
              <label key={field.key} className="flex w-28 flex-col gap-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{field.label}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.1}
                  value={drafts[draftKey(field.key)] ?? ""}
                  onFocus={() => onFocusField(draftKey(field.key))}
                  onBlur={onBlurField}
                  onChange={(event) => onManualChange(field.key, event.target.value)}
                  aria-label={`${field.label} 수동 입력 (%)`}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-[#2c3638] dark:bg-[#171d1e] dark:text-slate-100 dark:focus:ring-sky-500/30"
                />
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">자동 계산 결과</p>
            <button
              type="button"
              onClick={onRecalculate}
              disabled={loading || !normalizePortfolioTicker(holding.ticker)}
              className="rounded-md border border-sky-300 px-2 py-1 text-[11.5px] font-semibold text-sky-700 transition hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50 dark:border-sky-500/40 dark:text-sky-300 dark:hover:bg-sky-500/10"
            >
              {loading ? "계산 중…" : "이 티커 다시 계산"}
            </button>
          </div>
          <AutoMetrics accountType={accountType} resolution={resolution} loading={loading} fetchError={fetchError} />
          {showStaleHint && (
            <p className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400" role="status">
              {AUTO_RESULT_STALE_HINT}
            </p>
          )}
          {needsFallback && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-2 py-1.5 dark:bg-amber-500/10">
              <span className="min-w-0 text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-300">
                {fallbackMessage}
              </span>
              <button
                type="button"
                onClick={() => onModeChange("manual")}
                className="shrink-0 rounded-md border border-amber-300 px-2 py-1 text-[11.5px] font-semibold text-amber-700 transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/20"
              >
                수동 입력으로 전환
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricLine({
  label,
  metric,
  isDividendMetric = false,
  showValue = true,
}: {
  label: string;
  metric: ResolvedPortfolioMetric | undefined;
  isDividendMetric?: boolean;
  showValue?: boolean;
}) {
  if (!metric) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <span className="min-w-0 text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-slate-400 dark:text-slate-500">—</span>
      </div>
    );
  }
  const descriptor = describeMetricStatus(metric, { isDividendMetric });
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
      <span className="min-w-0 text-slate-500 dark:text-slate-400">{label}</span>
      <span className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        {showValue && <span className="font-semibold text-slate-800 dark:text-slate-100">{formatPct(metric.valuePct)}</span>}
        <StatusBadge tone={descriptor.tone}>{descriptor.label}</StatusBadge>
      </span>
    </div>
  );
}

function AutoMetrics({
  accountType,
  resolution,
  loading,
  fetchError,
}: {
  accountType: PortfolioAccountType;
  resolution?: PortfolioHoldingResolution;
  loading: boolean;
  fetchError?: string;
}) {
  if (fetchError) {
    return <p className="text-[12px] text-rose-600 dark:text-rose-400" role="alert">조회 실패: {fetchError}</p>;
  }
  if (!resolution) {
    return (
      <p className="text-[12px] text-slate-400 dark:text-slate-500">
        {loading ? "자동 계산 중입니다…" : "아직 결과가 없습니다. “이 티커 다시 계산”을 눌러 주세요."}
      </p>
    );
  }

  const observationYears = accountType === "taxSaving"
    ? resolution.totalReturnCagr.observationYears
    : resolution.priceCagr.observationYears;
  const warnings = accountType === "taxSaving"
    ? resolution.totalReturnCagr.warnings
    : Array.from(new Set([
        ...resolution.priceCagr.warnings,
        ...resolution.dividendYield.warnings,
        ...resolution.dividendGrowth.warnings,
      ]));

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-[#2c3638] dark:bg-[#12181a]">
      <div className="space-y-1">
        {accountType === "taxSaving" ? (
          <MetricLine label="총수익 CAGR" metric={resolution.totalReturnCagr} />
        ) : (
          <>
            <MetricLine label="가격 CAGR" metric={resolution.priceCagr} />
            <MetricLine label="배당률(TTM)" metric={resolution.dividendYield} isDividendMetric />
            <MetricLine label="배당성장률" metric={resolution.dividendGrowth} isDividendMetric />
          </>
        )}
        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className="text-slate-500 dark:text-slate-400">관측 기간</span>
          <span className="text-slate-600 dark:text-slate-300">{formatYears(observationYears)}</span>
        </div>
      </div>
      {warnings.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {warnings.map((warning, index) => (
            <li key={index} className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
              ⚠ {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PortfolioSummaryCard({ summary }: { summary: PortfolioProjectionSummary }) {
  const appliedAtLabel = (() => {
    const ms = Date.parse(summary.appliedAt);
    if (!Number.isFinite(ms)) return summary.appliedAt;
    return new Date(ms).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
  })();

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-500/30 dark:bg-sky-500/5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold text-slate-800 dark:text-slate-100">적용된 포트폴리오 가정</h3>
        <span className="text-[11.5px] text-slate-500 dark:text-slate-400">적용 시각 {appliedAtLabel}</span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-[#2c3638] dark:bg-[#171d1e]">
          <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">절세계좌</p>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            적용 티커: <span className="break-all">{summary.taxSaving.tickers.join(", ") || "—"}</span>
          </p>
          <p className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-300">
            유효 총수익률: <span className="font-semibold">{formatPct(summary.taxSaving.effectiveTotalReturnPct)}</span>
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-[#2c3638] dark:bg-[#171d1e]">
          <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">위탁계좌</p>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            적용 티커: <span className="break-all">{summary.brokerage.tickers.join(", ") || "—"}</span>
          </p>
          <div className="mt-0.5 grid grid-cols-1 gap-1 text-[12px] text-slate-600 dark:text-slate-300 sm:grid-cols-3">
            <span>가격수익 <span className="font-semibold">{formatPct(summary.brokerage.effectivePriceReturnPct)}</span></span>
            <span>배당률 <span className="font-semibold">{formatPct(summary.brokerage.effectiveDividendYieldPct)}</span></span>
            <span>배당성장 <span className="font-semibold">{formatPct(summary.brokerage.effectiveDividendGrowthPct)}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
