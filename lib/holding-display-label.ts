import { KOREAN_ETF_MAPPINGS } from "./korean-etf-registry";

// 6자리 숫자 단독 또는 005930 / 005930.KS / 005930.KQ 형태의 KRX 코드 티커.
const NUMERIC_KRX_TICKER = /^\d{6}(\.(KS|KQ))?$/;

// KRX 숫자 티커(예: 360200, 360200.KS)인지 판단한다.
export function isNumericKrxTicker(value: string | null | undefined): boolean {
  if (!value) return false;
  return NUMERIC_KRX_TICKER.test(value.trim().toUpperCase());
}

// KRX 6자리 코드 → 한글 상품명(레지스트리 displayName) 조회용 맵.
const KRX_CODE_TO_NAME = new Map<string, string>();
for (const mapping of KOREAN_ETF_MAPPINGS) {
  if (mapping.krxCode) KRX_CODE_TO_NAME.set(mapping.krxCode, mapping.displayName);
  const quote = mapping.quoteTicker?.match(/^(\d{6})\.(KS|KQ)$/);
  if (quote) KRX_CODE_TO_NAME.set(quote[1], mapping.displayName);
}

function krxCodeOf(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.trim().toUpperCase().match(/^(\d{6})(\.(KS|KQ))?$/);
  return match ? match[1] : undefined;
}

export type HoldingLabelInput = {
  name?: string | null;
  ticker?: string | null;
  cleanName?: string | null;
  productName?: string | null;
};

// 트리맵/도넛에서 공유하는 종목 표시 라벨 helper.
// 우선순위: cleanName → productName → (숫자가 아닌) name → registry 한글명 → ticker.
// KRX 숫자 티커(360200.KS 등)가 단독으로 노출되지 않도록 한글 상품명으로 치환한다.
export function holdingDisplayLabel(input: HoldingLabelInput): string {
  const clean = input.cleanName?.trim();
  if (clean && !isNumericKrxTicker(clean)) return clean;

  const product = input.productName?.trim();
  if (product && !isNumericKrxTicker(product)) return product;

  const name = input.name?.trim();
  if (name && !isNumericKrxTicker(name)) return name;

  const code = krxCodeOf(input.ticker) ?? krxCodeOf(name);
  if (code) {
    const registryName = KRX_CODE_TO_NAME.get(code);
    if (registryName) return registryName;
  }

  return name || input.ticker?.trim() || "미분류";
}
