import { runRetirementBootstrap } from "./retirement-bootstrap-engine";
import { PRODUCTION_MARKET_PATTERN_DATA_ADAPTER } from "./retirement-bootstrap-production-adapter";
import {
  RETIREMENT_BOOTSTRAP_ANALYSIS_SCOPES,
  RETIREMENT_BOOTSTRAP_PERIODS,
  RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION,
} from "./retirement-bootstrap-types";
import type {
  RetirementBootstrapWorkerError,
  RetirementBootstrapWorkerFailureResponse,
  RetirementBootstrapWorkerRunRequest,
  RetirementBootstrapWorkerSuccessResponse,
} from "./retirement-bootstrap-worker-protocol";

function datasetError(error: unknown): RetirementBootstrapWorkerError {
  const message = error instanceof Error ? error.message : "production 시장 패턴 데이터를 불러오지 못했습니다.";
  const integrityFailure = /checksum|무결성|스키마|schemaVersion|metadata|artifact|용도|기간|관측|라이선스|연속 연도/i.test(message);
  return {
    code: integrityFailure ? "dataset_integrity_failed" : "production_dataset_load_failed",
    message,
    retryable: !integrityFailure,
  };
}

function calculationError(error: unknown): RetirementBootstrapWorkerError {
  const message = error instanceof Error ? error.message : "장기 경로 계산 중 알 수 없는 오류가 발생했습니다.";
  const invalidInput = /초기|인출|비중|CAGR|배당률|배당성장|인플레이션|유한한 숫자|0보다|범위/.test(message);
  return {
    code: invalidInput ? "invalid_user_input" : "calculation_failed",
    message,
    retryable: !invalidInput,
  };
}

/** Worker 본문과 Node 회귀 테스트가 같은 production 실행 계약을 공유한다. */
export async function executeRetirementBootstrapWorkerRequest(
  request: RetirementBootstrapWorkerRunRequest,
): Promise<RetirementBootstrapWorkerSuccessResponse | RetirementBootstrapWorkerFailureResponse> {
  const workerStartedAt = performance.now();
  if (!RETIREMENT_BOOTSTRAP_ANALYSIS_SCOPES.includes(request.analysisScope)) {
    return {
      type: "error",
      requestId: request.requestId,
      analysisScope: request.analysisScope,
      prefetch: request.prefetch,
      error: {
        code: "invalid_user_input",
        message: `지원하지 않는 장기 분석 scope입니다: ${String(request.analysisScope)}`,
        retryable: false,
      },
    };
  }
  const datasetStartedAt = performance.now();
  let dataset;
  try {
    if (request.resultSchemaVersion !== RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION) {
      throw new Error(
        `요청 resultSchemaVersion(${request.resultSchemaVersion})과 runtime(${RETIREMENT_BOOTSTRAP_RESULT_SCHEMA_VERSION})이 일치하지 않습니다.`,
      );
    }
    dataset = await PRODUCTION_MARKET_PATTERN_DATA_ADAPTER.loadDataset();
    if (dataset.datasetVersion !== request.datasetVersion) {
      throw new Error(
        `요청 datasetVersion(${request.datasetVersion})과 production artifact(${dataset.datasetVersion})가 일치하지 않습니다.`,
      );
    }
  } catch (error) {
    return { type: "error", requestId: request.requestId, analysisScope: request.analysisScope, prefetch: request.prefetch, error: datasetError(error) };
  }
  const datasetLoadMs = performance.now() - datasetStartedAt;

  const calculationStartedAt = performance.now();
  try {
    const result = runRetirementBootstrap(request.input, dataset, {
      iterations: request.simulationCount,
      blockLength: request.blockLength,
      periods: RETIREMENT_BOOTSTRAP_PERIODS,
      seed: request.seed,
      analysisScope: request.analysisScope,
    });
    const calculationMs = performance.now() - calculationStartedAt;
    return {
      type: "success",
      requestId: request.requestId,
      analysisScope: request.analysisScope,
      prefetch: request.prefetch,
      result,
      timing: {
        datasetLoadMs,
        calculationMs,
        workerTotalMs: performance.now() - workerStartedAt,
        completedAtEpochMs: Date.now(),
      },
    };
  } catch (error) {
    return { type: "error", requestId: request.requestId, analysisScope: request.analysisScope, prefetch: request.prefetch, error: calculationError(error) };
  }
}
