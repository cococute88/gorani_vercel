import { performance } from "node:perf_hooks";

import { runRetirementBootstrap } from "../lib/retirement-bootstrap-engine.ts";
import { PRODUCTION_MARKET_PATTERN_DATA_ADAPTER } from "../lib/retirement-bootstrap-production-adapter.ts";
import { buildRetirementBootstrapProductionRepresentativeInput } from "./fixtures/retirement-bootstrap-production-representative.ts";

const dataset = await PRODUCTION_MARKET_PATTERN_DATA_ADAPTER.loadDataset();
const input = buildRetirementBootstrapProductionRepresentativeInput();
const ITERATIONS = 10_000;
const SEED = 730_401;

for (const years of [30, 60, 70]) {
  if (global.gc) global.gc();
  const heapBefore = process.memoryUsage().heapUsed;
  const startedAt = performance.now();
  const result = runRetirementBootstrap(input, dataset, {
    iterations: ITERATIONS,
    blockLength: 5,
    periods: [years],
    seed: SEED,
  });
  const elapsedMs = performance.now() - startedAt;
  const heapAfter = process.memoryUsage().heapUsed;
  console.log(JSON.stringify({
    years,
    iterations: ITERATIONS,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    heapDeltaMiB: Number(((heapAfter - heapBefore) / 1024 / 1024).toFixed(2)),
    successRate: result.periods[0].successRate,
    datasetVersion: result.datasetVersion,
    seed: result.seed,
    productionData: true,
  }));
}
