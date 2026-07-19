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
  const scopes = Array.from(new Set([
    request.analysisScope,
    ...(request.prefetchScopes ?? []),
  ]));
  for (let index = 0; index < scopes.length; index += 1) {
    const analysisScope = scopes[index];
    post(await executeRetirementBootstrapWorkerRequest({
      ...request,
      analysisScope,
      prefetch: index > 0,
    }));
  }
};

post({ type: "ready" });
