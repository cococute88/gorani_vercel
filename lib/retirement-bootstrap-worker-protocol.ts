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
  result: RetirementBootstrapResult;
  timing: RetirementBootstrapWorkerTiming;
};

export type RetirementBootstrapWorkerFailureResponse = {
  type: "error";
  requestId: string;
  error: RetirementBootstrapWorkerError;
};

export type RetirementBootstrapWorkerResponse =
  | RetirementBootstrapWorkerReadyResponse
  | RetirementBootstrapWorkerSuccessResponse
  | RetirementBootstrapWorkerFailureResponse;
