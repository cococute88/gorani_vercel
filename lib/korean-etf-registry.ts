export type KoreanEtfMapping = {
  aliases: string[];
  krxCode?: string;
  quoteTicker?: string;
  dividendBucket?: string;
  exposureProxy?: string;
  displayName: string;
  notes?: string;
};

export type KoreanEtfMatch = {
  displayName: string;
  krxCode?: string;
  quoteTicker?: string;
  dividendBucket?: string;
  exposureProxy?: string;
  matchedAlias: string;
};

export const KOREAN_ETF_MAPPINGS: KoreanEtfMapping[] = [
  {
    displayName: "ACE 미국S&P500",
    aliases: [
      "ACE미국S&P500",
      "ACE 미국S&P500",
      "ACE미국 S&P500",
      "ACE 미국 S&P500",
      "KINDEX미국S&P500",
      "KINDEX 미국S&P500",
      "미래연금ACE미국S&P500",
      "KBISAACE미국S&P500",
      "KBISA ACE미국S&P500",
    ],
    krxCode: "360200",
    quoteTicker: "360200.KS",
    dividendBucket: "SPY",
    exposureProxy: "SPY",
  },
  {
    displayName: "ACE 미국나스닥100",
    aliases: [
      "ACE미국나스닥100",
      "ACE 미국나스닥100",
      "ACE미국 나스닥100",
      "ACE 미국 나스닥100",
      "미래연금ACE미국나스닥100",
      "KBISAACE미국나스닥100",
      "KBISA ACE미국나스닥100",
    ],
    krxCode: "367380",
    quoteTicker: "367380.KS",
    dividendBucket: "QQQ",
    exposureProxy: "QQQ",
  },
  {
    displayName: "RISE 미국S&P500",
    aliases: [
      "RISE미국S&P500",
      "RISE 미국S&P500",
      "KBSTAR미국S&P500",
      "KBSTAR 미국S&P500",
      "미래연금RISE미국S&P500",
      "KBISA RISE미국S&P500",
      "KBISARISE미국S&P500",
    ],
    krxCode: "379780",
    quoteTicker: "379780.KS",
    dividendBucket: "SPY",
    exposureProxy: "SPY",
    notes: "RISE was formerly KBSTAR.",
  },
  {
    displayName: "RISE 미국나스닥100",
    aliases: [
      "RISE미국나스닥100",
      "RISE 미국나스닥100",
      "KBSTAR미국나스닥100",
      "KBSTAR 미국나스닥100",
      "KBISARISE미국나스닥100",
      "KBISA RISE미국나스닥100",
      "미래연금RISE미국나스닥100",
    ],
    krxCode: "368590",
    quoteTicker: "368590.KS",
    dividendBucket: "QQQ",
    exposureProxy: "QQQ",
    notes: "RISE was formerly KBSTAR.",
  },
  {
    displayName: "TIGER 미국S&P500",
    aliases: [
      "TIGER미국S&P500",
      "TIGER 미국S&P500",
      "TIGER미국 S&P500",
      "TIGER 미국 S&P500",
      "ISA TIGER미국S&P500",
      "ISATIGER미국S&P500",
      "KB위탁TIGER에센피",
      "TIGER에센피",
    ],
    krxCode: "360750",
    quoteTicker: "360750.KS",
    dividendBucket: "SPY",
    exposureProxy: "SPY",
  },
];

function normalizeSearchText(value: string): string {
  return value
    .replace(/＆/g, "&")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function removeAccountPrefixesForMatching(value: string): string {
  return value.replace(/^(미래연금|KBISA|ISA)+/i, "");
}

export function findKoreanEtfMapping(text: string): KoreanEtfMatch | null {
  const normalizedText = normalizeSearchText(text ?? "");
  if (!normalizedText) return null;
  const normalizedTextWithoutAccountPrefix = removeAccountPrefixesForMatching(normalizedText);

  for (const mapping of KOREAN_ETF_MAPPINGS) {
    for (const alias of mapping.aliases) {
      const normalizedAlias = normalizeSearchText(alias);
      const normalizedAliasWithoutAccountPrefix = removeAccountPrefixesForMatching(normalizedAlias);
      if (
        normalizedText.includes(normalizedAlias) ||
        normalizedTextWithoutAccountPrefix.includes(normalizedAliasWithoutAccountPrefix)
      ) {
        return {
          displayName: mapping.displayName,
          krxCode: mapping.krxCode,
          quoteTicker: mapping.quoteTicker,
          dividendBucket: mapping.dividendBucket,
          exposureProxy: mapping.exposureProxy,
          matchedAlias: alias,
        };
      }
    }
  }

  return null;
}

export function inferKoreanEtfFallbackBucket(text: string): Pick<
  KoreanEtfMatch,
  "dividendBucket" | "exposureProxy"
> | null {
  const normalizedText = normalizeSearchText(text ?? "");
  if (!normalizedText) return null;

  if (
    /S&P500/.test(normalizedText) ||
    /SNP500/.test(normalizedText) ||
    normalizedText.includes("에스앤피500") ||
    normalizedText.includes("에센피500") ||
    normalizedText.includes("스탠더드앤푸어스500")
  ) {
    return { dividendBucket: "SPY", exposureProxy: "SPY" };
  }

  if (
    normalizedText.includes("미국나스닥100") ||
    normalizedText.includes("나스닥100") ||
    normalizedText.includes("NASDAQ100")
  ) {
    return { dividendBucket: "QQQ", exposureProxy: "QQQ" };
  }

  return null;
}
