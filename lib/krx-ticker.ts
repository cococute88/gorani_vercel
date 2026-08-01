export type KrxYahooSuffix = "KS" | "KQ";

export type ParsedKrxTicker = {
  requestedTicker: string;
  code: string;
  suffix: KrxYahooSuffix | null;
};

export function normalizeTickerText(input: string): string {
  return input.trim().replace(/\s+/g, "").toUpperCase();
}

export function parseKrxTicker(input: string): ParsedKrxTicker | null {
  const requestedTicker = normalizeTickerText(input);
  const match = requestedTicker.match(/^([A-Z0-9]{6})(?:\.(KS|KQ))?$/);
  if (!match) return null;
  return {
    requestedTicker,
    code: match[1],
    suffix: (match[2] as KrxYahooSuffix | undefined) ?? null,
  };
}

export function isKrxTicker(input: string): boolean {
  return parseKrxTicker(input) !== null;
}

/**
 * Suffix-less market inference is intentionally conservative so a six-letter
 * US symbol is not reclassified. KRX short codes used without a suffix contain
 * at least one digit; all-letter KRX codes remain available with .KS/.KQ.
 */
export function isLikelySuffixlessKrxTicker(input: string): boolean {
  const parsed = parseKrxTicker(input);
  return Boolean(parsed && !parsed.suffix && /\d/.test(parsed.code));
}

export function krxYahooCandidates(input: string): string[] {
  const parsed = parseKrxTicker(input);
  if (!parsed) return [];
  if (parsed.suffix) return [`${parsed.code}.${parsed.suffix}`];
  return [`${parsed.code}.KS`, `${parsed.code}.KQ`];
}
