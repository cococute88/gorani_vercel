import type {
  RetirementBootstrapAnalysisScope,
  RetirementBootstrapInput,
  RetirementBootstrapResult,
} from "./retirement-bootstrap-types";

export type RetirementBootstrapWorkerErrorCode =
  | "unsupported_etf"
  | "production_dataset_load_failed"
  | "dataset_integrity_failed"
  | "worker_initialization_failed"
  | "calculation_failed"
  | "invalid_user_input";

export type RetirementBootstrapWorkerError = {
  code: RetirementBootstrapWorkerErrorCode;
  message: string;
  retryable: boolean;
};

export type RetirementBootstrapWorkerRunRequest = {
  type: "run";
  requestId: string;
  input: RetirementBootstrapInput;
  analysisScope: RetirementBootstrapAnalysisScope;
  /** 현재 화면 결과 뒤에 같은 입력으로 미리 준비할 다른 분석 범위다. */
  prefetchScopes?: RetirementBootstrapAnalysisScope[];
  /** Worker가 후속 scope 결과임을 UI에 알린다. */
  prefetch?: boolean;
  datasetVersion: string;
  resultSchemaVersion: number;
  simulationCount: number;
  blockLength: number;
  seed: number;
};

export type RetirementBootstrapWorkerRequest = RetirementBootstrapWorkerRunRequest;

export type RetirementBootstrapWorkerTiming = {
  datasetLoadMs: number;
  calculationMs: number;
  workerTotalMs: number;
  completedAtEpochMs: number;
};

export type RetirementBootstrapWorkerReadyResponse = {
  type: "ready";
};

export type RetirementBootstrapWorkerSuccessResponse = {
  type: "success";
  requestId: string;
  analysisScope: RetirementBootstrapAnalysisScope;
  result: RetirementBootstrapResult;
  timing: RetirementBootstrapWorkerTiming;
  prefetch?: boolean;
};

export type RetirementBootstrapWorkerFailureResponse = {
  type: "error";
  requestId: string;
  analysisScope: RetirementBootstrapAnalysisScope;
  error: RetirementBootstrapWorkerError;
  prefetch?: boolean;
};

export type RetirementBootstrapWorkerResponse =
  | RetirementBootstrapWorkerReadyResponse
  | RetirementBootstrapWorkerSuccessResponse
  | RetirementBootstrapWorkerFailureResponse;
