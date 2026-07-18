import productionDatasetJson from "../data/retirement-bootstrap/market-pattern-production-v1.json";
import { PRODUCTION_MARKET_PATTERN_DATASET_VERSION } from "./retirement-bootstrap-config";
import {
  ALL_RETIREMENT_BOOTSTRAP_ASSET_CLASSES,
  computeMarketPatternObservationsSha256,
  validateMarketPatternDataset,
} from "./retirement-bootstrap-data";
import {
  DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH,
  type MarketPatternDataAdapter,
  type MarketPatternDatasetV1,
} from "./retirement-bootstrap-types";

export { PRODUCTION_MARKET_PATTERN_DATASET_VERSION } from "./retirement-bootstrap-config";

export async function assertMarketPatternDatasetIntegrity(dataset: MarketPatternDatasetV1): Promise<void> {
  const actual = await computeMarketPatternObservationsSha256(dataset.observations);
  if (actual !== dataset.integrity.observationsSha256) {
    throw new Error(
      `production 시장 패턴 observations payload checksum이 일치하지 않습니다: expected=${dataset.integrity.observationsSha256}, actual=${actual}`,
    );
  }
}

export class StaticProductionMarketPatternDataAdapter implements MarketPatternDataAdapter {
  async loadDataset(): Promise<MarketPatternDatasetV1> {
    const dataset = structuredClone(productionDatasetJson) as MarketPatternDatasetV1;
    validateMarketPatternDataset(
      dataset,
      ALL_RETIREMENT_BOOTSTRAP_ASSET_CLASSES,
      DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH,
    );
    if (dataset.usage !== "production") {
      throw new Error("production adapter가 production 용도가 아닌 데이터셋을 반환했습니다.");
    }
    if (dataset.datasetVersion !== PRODUCTION_MARKET_PATTERN_DATASET_VERSION) {
      throw new Error("production adapter의 datasetVersion 계약이 artifact와 일치하지 않습니다.");
    }
    await assertMarketPatternDatasetIntegrity(dataset);
    return dataset;
  }
}

export const PRODUCTION_MARKET_PATTERN_DATA_ADAPTER: MarketPatternDataAdapter =
  new StaticProductionMarketPatternDataAdapter();
