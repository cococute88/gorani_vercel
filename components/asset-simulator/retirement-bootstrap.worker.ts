/// <reference lib="webworker" />

import { executeRetirementBootstrapWorkerRequest } from "@/lib/retirement-bootstrap-worker-runner";
import type {
  RetirementBootstrapWorkerRequest,
  RetirementBootstrapWorkerResponse,
} from "@/lib/retirement-bootstrap-worker-protocol";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

function post(response: RetirementBootstrapWorkerResponse): void {
  workerScope.postMessage(response);
}

workerScope.onmessage = async (event: MessageEvent<RetirementBootstrapWorkerRequest>) => {
  const request = event.data;
  if (!request || request.type !== "run") return;
  post(await executeRetirementBootstrapWorkerRequest(request));
};

post({ type: "ready" });
