export type KrxMetadataStatus = "found" | "not_found" | "unavailable";

export function resolveKrxSeriesError(input: {
  requestedTicker: string;
  metadataStatus: KrxMetadataStatus;
  provider?: string;
}): { status: 404 | 422 | 502; error: string } {
  const provider = input.provider ?? "Yahoo Finance";
  if (input.metadataStatus === "not_found") {
    return { status: 404, error: `${input.requestedTicker} 종목을 한국 시장에서 찾을 수 없습니다.` };
  }
  if (input.metadataStatus === "found") {
    return { status: 422, error: `${input.requestedTicker} 종목은 확인되지만 해당 종목의 가격 데이터를 현재 제공자(${provider})에서 조회할 수 없습니다.` };
  }
  return { status: 502, error: `${input.requestedTicker} 종목의 시장 정보와 가격 데이터를 현재 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.` };
}
