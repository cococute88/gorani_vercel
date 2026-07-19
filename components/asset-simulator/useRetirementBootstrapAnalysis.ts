"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PRODUCTION_MARKET_PATTERN_DATASET_VERSION } from "@/lib/retirement-bootstrap-config";
import {
  DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH,
  DEFAULT_RETIREMENT_BOOTSTRAP_ITERATIONS,
  RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION,
  type RetirementBootstrapAnalysisScope,
  type RetirementBootstrapInput,
  type RetirementBootstrapResult,
} from "@/lib/retirement-bootstrap-types";
import {
  buildRetirementBootstrapCalculationIdentity,
  getRetirementBootstrapMemoryCache,
  setRetirementBootstrapMemoryCache,
} from "@/lib/retirement-bootstrap-ui";
import type {
  RetirementBootstrapWorkerError,
  RetirementBootstrapWorkerResponse,
  RetirementBootstrapWorkerTiming,
} from "@/lib/retirement-bootstrap-worker-protocol";

const CALCULATION_DEBOUNCE_MS = 250;

export type RetirementBootstrapBrowserTiming = RetirementBootstrapWorkerTiming & {
  workerInitializationMs: number;
  resultTransferMs: number;
  resultReceivedAtPerfMs: number;
  source: "worker" | "memory-cache";
};

type AnalysisState = {
  status: "idle" | "loading" | "success" | "error";
  result: RetirementBootstrapResult | null;
  error: RetirementBootstrapWorkerError | null;
  refreshing: boolean;
  timing: RetirementBootstrapBrowserTiming | null;
};

const INITIAL_STATE: AnalysisState = {
  status: "idle",
  result: null,
  error: null,
  refreshing: false,
  timing: null,
};

export function useRetirementBootstrapAnalysis(
  input: RetirementBootstrapInput | null,
  active: boolean,
  retryToken: number,
  analysisScope: RetirementBootstrapAnalysisScope,
): AnalysisState & { seed: number | null; cacheKey: string | null } {
  const requestSequenceRef = useRef(0);
  const [state, setState] = useState<AnalysisState>(INITIAL_STATE);
  const identity = useMemo(
    () => input
      ? buildRetirementBootstrapCalculationIdentity(
        input,
        PRODUCTION_MARKET_PATTERN_DATASET_VERSION,
        DEFAULT_RETIREMENT_BOOTSTRAP_ITERATIONS,
        DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH,
        analysisScope,
      )
      : null,
    [analysisScope, input],
  );
  const requestRef = useRef({ input, identity });
  requestRef.current = { input, identity };

  useEffect(() => {
    const pending = requestRef.current;
    if (!active || !pending.input || !pending.identity) return;
    const requestInput = pending.input;
    const requestIdentity = pending.identity;

    const cacheLookupStartedAt = performance.now();
    const cached = getRetirementBootstrapMemoryCache(requestIdentity.cacheKey);
    if (cached) {
      setState({
        status: "success",
        result: cached.result,
        error: null,
        refreshing: false,
        timing: {
          datasetLoadMs: 0,
          calculationMs: 0,
          workerTotalMs: 0,
          completedAtEpochMs: Date.now(),
          workerInitializationMs: 0,
          resultTransferMs: performance.now() - cacheLookupStartedAt,
          resultReceivedAtPerfMs: performance.now(),
          source: "memory-cache",
        },
      });
      return;
    }

    let cancelled = false;
    let worker: Worker | null = null;
    let workerReady = false;
    let workerCreatedAt = 0;
    let workerInitializationMs = 0;
    const requestId = `retirement-bootstrap-${++requestSequenceRef.current}`;

    setState((current) => ({
      status: "loading",
      result: current.result,
      error: null,
      refreshing: current.result !== null,
      timing: current.timing,
    }));

    const fail = (error: RetirementBootstrapWorkerError) => {
      if (cancelled) return;
      worker?.terminate();
      worker = null;
      setState({ status: "error", result: null, error, refreshing: false, timing: null });
    };

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        workerCreatedAt = performance.now();
        worker = new Worker(new URL("./retirement-bootstrap.worker.ts", import.meta.url), {
          type: "module",
          name: "gorani-retirement-bootstrap",
        });
      } catch (error) {
        fail({
          code: "worker_initialization_failed",
          message: error instanceof Error ? error.message : "장기 분석 Worker를 시작하지 못했습니다.",
          retryable: true,
        });
        return;
      }

      worker.onerror = (event) => {
        event.preventDefault();
        fail({
          code: workerReady ? "calculation_failed" : "worker_initialization_failed",
          message: workerReady ? "Worker 계산 중 오류가 발생했습니다." : "장기 분석 Worker를 초기화하지 못했습니다.",
          retryable: true,
        });
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
            analysisScope,
            datasetVersion: PRODUCTION_MARKET_PATTERN_DATASET_VERSION,
            resultSchemaVersion: RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION,
            simulationCount: DEFAULT_RETIREMENT_BOOTSTRAP_ITERATIONS,
            blockLength: DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH,
            seed: requestIdentity.seed,
          });
          return;
        }
        if (response.requestId !== requestId) return;
        if (response.type === "error") {
          fail(response.error);
          return;
        }

        const resultTransferMs = Math.max(0, Date.now() - response.timing.completedAtEpochMs);
        const resultReceivedAtPerfMs = performance.now();
        setRetirementBootstrapMemoryCache(requestIdentity.cacheKey, {
          result: response.result,
          timing: response.timing,
          cachedAtEpochMs: Date.now(),
        });
        worker.terminate();
        worker = null;
        setState({
          status: "success",
          result: response.result,
          error: null,
          refreshing: false,
          timing: {
            ...response.timing,
            workerInitializationMs,
            resultTransferMs,
            resultReceivedAtPerfMs,
            source: "worker",
          },
        });
      };
    }, CALCULATION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      worker?.terminate();
    };
  }, [active, analysisScope, identity?.cacheKey, retryToken]);

  const result = state.result?.analysisScope === analysisScope ? state.result : null;
  return {
    ...state,
    result,
    refreshing: result !== null && state.refreshing,
    seed: identity?.seed ?? null,
    cacheKey: identity?.cacheKey ?? null,
  };
}
