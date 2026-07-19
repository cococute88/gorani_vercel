"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PRODUCTION_MARKET_PATTERN_DATASET_VERSION } from "@/lib/retirement-bootstrap-config";
import {
  DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH,
  DEFAULT_RETIREMENT_BOOTSTRAP_ITERATIONS,
  RETIREMENT_BOOTSTRAP_ANALYSIS_SCOPES,
  RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION,
  type RetirementBootstrapAnalysisScope,
  type RetirementBootstrapInput,
  type RetirementBootstrapResult,
} from "@/lib/retirement-bootstrap-types";
import {
  buildRetirementBootstrapCalculationIdentity,
  getRetirementBootstrapMemoryCache,
  setRetirementBootstrapMemoryCache,
  type RetirementBootstrapCalculationIdentity,
} from "@/lib/retirement-bootstrap-ui";
import type {
  RetirementBootstrapWorkerError,
  RetirementBootstrapWorkerResponse,
  RetirementBootstrapWorkerTiming,
} from "@/lib/retirement-bootstrap-worker-protocol";

const CALCULATION_DEBOUNCE_MS = 250;
const PREFETCH_SCOPE_ORDER: RetirementBootstrapAnalysisScope[] = ["combined", "brokerage", "tax"];

export type RetirementBootstrapBrowserTiming = RetirementBootstrapWorkerTiming & {
  workerInitializationMs: number;
  resultTransferMs: number;
  resultReceivedAtPerfMs: number;
  source: "worker" | "memory-cache";
};

type ScopedResult = {
  result: RetirementBootstrapResult;
  timing: RetirementBootstrapBrowserTiming;
};

type AnalysisState = {
  calculationKey: string | null;
  resultsByScope: Partial<Record<RetirementBootstrapAnalysisScope, ScopedResult>>;
  pendingScopes: RetirementBootstrapAnalysisScope[];
  errorsByScope: Partial<Record<RetirementBootstrapAnalysisScope, RetirementBootstrapWorkerError>>;
};

const INITIAL_STATE: AnalysisState = {
  calculationKey: null,
  resultsByScope: {},
  pendingScopes: [],
  errorsByScope: {},
};

function buildScopeIdentities(input: RetirementBootstrapInput | null): Record<RetirementBootstrapAnalysisScope, RetirementBootstrapCalculationIdentity> | null {
  if (!input) return null;
  return Object.fromEntries(RETIREMENT_BOOTSTRAP_ANALYSIS_SCOPES.map((scope) => [
    scope,
    buildRetirementBootstrapCalculationIdentity(
      input,
      PRODUCTION_MARKET_PATTERN_DATASET_VERSION,
      DEFAULT_RETIREMENT_BOOTSTRAP_ITERATIONS,
      DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH,
      scope,
    ),
  ])) as Record<RetirementBootstrapAnalysisScope, RetirementBootstrapCalculationIdentity>;
}

function browserTiming(
  timing: RetirementBootstrapWorkerTiming,
  workerInitializationMs: number,
): RetirementBootstrapBrowserTiming {
  return {
    ...timing,
    workerInitializationMs,
    resultTransferMs: Math.max(0, Date.now() - timing.completedAtEpochMs),
    resultReceivedAtPerfMs: performance.now(),
    source: "worker",
  };
}

/**
 * 입력이 같은 동안에는 하나의 Worker 요청으로 세 scope를 순차 prefetch한다.
 * scope selector는 결과 선택만 바꾸며, 이미 시작한 10,000회 계산을 취소·재시작하지 않는다.
 */
export function useRetirementBootstrapAnalysis(
  input: RetirementBootstrapInput | null,
  active: boolean,
  retryToken: number,
  analysisScope: RetirementBootstrapAnalysisScope,
): {
  status: "idle" | "loading" | "success" | "error";
  result: RetirementBootstrapResult | null;
  error: RetirementBootstrapWorkerError | null;
  refreshing: boolean;
  scopeLoading: boolean;
  timing: RetirementBootstrapBrowserTiming | null;
  seed: number | null;
  cacheKey: string | null;
} {
  const requestSequenceRef = useRef(0);
  const analysisScopeRef = useRef(analysisScope);
  analysisScopeRef.current = analysisScope;
  const [state, setState] = useState<AnalysisState>(INITIAL_STATE);
  const identities = useMemo(() => buildScopeIdentities(input), [input]);
  // scope가 아닌 입력·dataset·seed 정책을 대표한다. scope 전환은 effect를 다시 실행하지 않는다.
  const calculationKey = identities?.combined.cacheKey ?? null;
  const requestRef = useRef({ input, identities, calculationKey });
  requestRef.current = { input, identities, calculationKey };

  useEffect(() => {
    const pending = requestRef.current;
    if (!active || !pending.input || !pending.identities || !pending.calculationKey) return;
    const requestInput = pending.input;
    const requestIdentities = pending.identities;
    const requestCalculationKey = pending.calculationKey;
    const cachedByScope = Object.fromEntries(RETIREMENT_BOOTSTRAP_ANALYSIS_SCOPES.flatMap((scope) => {
      const cached = getRetirementBootstrapMemoryCache(requestIdentities[scope].cacheKey);
      if (!cached) return [];
      const cacheLookupStartedAt = performance.now();
      return [[scope, {
        result: cached.result,
        timing: {
          datasetLoadMs: 0,
          calculationMs: 0,
          workerTotalMs: 0,
          completedAtEpochMs: Date.now(),
          workerInitializationMs: 0,
          resultTransferMs: performance.now() - cacheLookupStartedAt,
          resultReceivedAtPerfMs: performance.now(),
          source: "memory-cache" as const,
        },
      } satisfies ScopedResult]];
    })) as Partial<Record<RetirementBootstrapAnalysisScope, ScopedResult>>;
    const missingScopes = PREFETCH_SCOPE_ORDER.filter((scope) => !cachedByScope[scope]);

    if (missingScopes.length === 0) {
      setState({
        calculationKey: requestCalculationKey,
        resultsByScope: cachedByScope,
        pendingScopes: [],
        errorsByScope: {},
      });
      return;
    }

    const preferredScope = analysisScopeRef.current;
    const requestedScopes = [
      ...(missingScopes.includes(preferredScope) ? [preferredScope] : []),
      ...missingScopes.filter((scope) => scope !== preferredScope),
    ];
    let cancelled = false;
    let worker: Worker | null = null;
    let workerReady = false;
    let workerCreatedAt = 0;
    let workerInitializationMs = 0;
    const requestId = `retirement-bootstrap-${++requestSequenceRef.current}`;

    setState({
      calculationKey: requestCalculationKey,
      resultsByScope: cachedByScope,
      pendingScopes: requestedScopes,
      errorsByScope: {},
    });

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        workerCreatedAt = performance.now();
        worker = new Worker(new URL("./retirement-bootstrap.worker.ts", import.meta.url), {
          type: "module",
          name: "gorani-retirement-bootstrap",
        });
      } catch (error) {
        const workerError: RetirementBootstrapWorkerError = {
          code: "worker_initialization_failed",
          message: error instanceof Error ? error.message : "장기 분석 Worker를 시작하지 못했습니다.",
          retryable: true,
        };
        setState((current) => current.calculationKey === requestCalculationKey ? {
          ...current,
          pendingScopes: [],
          errorsByScope: Object.fromEntries(requestedScopes.map((scope) => [scope, workerError])),
        } : current);
        return;
      }

      worker.onerror = (event) => {
        event.preventDefault();
        const workerError: RetirementBootstrapWorkerError = {
          code: workerReady ? "calculation_failed" : "worker_initialization_failed",
          message: workerReady ? "Worker 계산 중 오류가 발생했습니다." : "장기 분석 Worker를 초기화하지 못했습니다.",
          retryable: true,
        };
        worker?.terminate();
        worker = null;
        setState((current) => current.calculationKey === requestCalculationKey ? {
          ...current,
          pendingScopes: [],
          errorsByScope: Object.fromEntries(requestedScopes.map((scope) => [scope, workerError])),
        } : current);
      };

      worker.onmessage = (event: MessageEvent<RetirementBootstrapWorkerResponse>) => {
        if (cancelled || !worker) return;
        const response = event.data;
        if (response.type === "ready") {
          workerReady = true;
          workerInitializationMs = performance.now() - workerCreatedAt;
          worker.postMessage({
            type: "run",
            requestId,
            input: requestInput,
            analysisScope: requestedScopes[0],
            prefetchScopes: requestedScopes.slice(1),
            datasetVersion: PRODUCTION_MARKET_PATTERN_DATASET_VERSION,
            resultSchemaVersion: RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION,
            simulationCount: DEFAULT_RETIREMENT_BOOTSTRAP_ITERATIONS,
            blockLength: DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH,
            seed: requestIdentities[requestedScopes[0]].seed,
          });
          return;
        }
        if (response.requestId !== requestId) return;
        const responseScope = response.analysisScope;
        if (response.type === "success") {
          const scope = response.result.analysisScope;
          const timing = browserTiming(response.timing, workerInitializationMs);
          setRetirementBootstrapMemoryCache(requestIdentities[scope].cacheKey, {
            result: response.result,
            timing: response.timing,
            cachedAtEpochMs: Date.now(),
          });
          setState((current) => current.calculationKey === requestCalculationKey ? {
            ...current,
            resultsByScope: { ...current.resultsByScope, [scope]: { result: response.result, timing } },
            pendingScopes: current.pendingScopes.filter((candidate) => candidate !== scope),
          } : current);
        } else {
          const scope = responseScope;
          setState((current) => current.calculationKey === requestCalculationKey ? {
            ...current,
            pendingScopes: current.pendingScopes.filter((candidate) => candidate !== scope),
            errorsByScope: { ...current.errorsByScope, [scope]: response.error },
          } : current);
        }
      };
    }, CALCULATION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      worker?.terminate();
    };
  }, [active, calculationKey, retryToken]);

  const current = state.calculationKey === calculationKey
    ? state.resultsByScope[analysisScope] ?? null
    : null;
  const error = state.calculationKey === calculationKey
    ? state.errorsByScope[analysisScope] ?? null
    : null;
  const scopeLoading = state.calculationKey === calculationKey
    && state.pendingScopes.includes(analysisScope)
    && current === null;
  const status = error ? "error" : current ? "success" : scopeLoading ? "loading" : "idle";
  return {
    status,
    result: current?.result ?? null,
    error,
    refreshing: false,
    scopeLoading,
    timing: current?.timing ?? null,
    seed: identities?.[analysisScope].seed ?? null,
    cacheKey: identities?.[analysisScope].cacheKey ?? null,
  };
}
