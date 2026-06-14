// =============================================================
// 뱅크샐러드 엑셀 파서 (백엔드 없이 브라우저에서 xlsx 파싱).
//
// 설계 원칙:
// - 행 번호 고정 금지. 제목 텍스트("3.재무현황", "5.투자현황")을 찾아 그 아래 표를 파싱.
// - "3.재무현황" / "3. 재무현황" 둘 다 허용 (공백 제거 후 비교).
// - 열 위치가 바뀌어도 되도록 헤더 텍스트로 열 인덱스를 찾는다 (sparse 열 대응).
// - 빈 행/합계 행 제외, 숫자 콤마/빈값/null 방어.
// - 실패 시 화면이 깨지지 않도록 errors/warnings 를 반환.
// TODO(codex): 증권사별 양식 추가, 수량/통화 추출 고도화.
// =============================================================
import * as XLSX from "xlsx";
import { applyKnownQuoteTickerToHolding } from "./holding-ticker-normalizer";
import { isAggregateRowName } from "./portfolio-summary-row";
import { extractTag, guessTicker, needsTickerReview } from "./ticker-mapper";
import {
  decorateFinanceAssetWithTags,
  decorateHoldingWithTags,
  parsePortfolioTags,
} from "./portfolio-tags";
import type {
  AssetCategory,
  FinanceAsset,
  Holding,
} from "./portfolio-types";

export interface ParsePreview {
  financeHeader: string[];
  financeRows: string[][];
  investmentHeader: string[];
  investmentRows: string[][];
}

export interface ParseResult {
  ok: boolean;
  sheetName: string;
  snapshotDate: string;
  sourceFileName: string;
  totalAssetKRW: number;
  totalDebtKRW: number;
  netAssetKRW: number;
  investmentPrincipalKRW: number;
  investmentValueKRW: number;
  returnAmountKRW: number;
  returnPct: number;
  holdings: Holding[];
  financeAssets: FinanceAsset[];
  preview: ParsePreview;
  warnings: string[];
  errors: string[];
  excludedSmallCount: number;
  excludedBelowMinimumCount: number;
  excludedHoldingValueKRW: number;
}

let idSeq = 0;
function makeId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq}`;
}

type Cell = string | number | boolean | Date | null | undefined;
type Row = Cell[];

function norm(v: Cell): string {
  return String(v ?? "").replace(/\s+/g, "").trim();
}

function normHeader(v: Cell | string): string {
  return norm(v).toLowerCase().replace(/[()［］[\]{}]/g, "");
}

function txt(v: Cell): string {
  return String(v ?? "").trim();
}

/** 숫자 정규화 (콤마/원표/퍼센트 제거). 실패 시 null. */
export function normalizeNumber(v: Cell): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v === "boolean") return null;
  if (v instanceof Date) return null;
  const s = String(v)
    .replace(/[()]/g, "")
    .replace(/[,\s\u20a9%]/g, "")
    .replace(/[\uffe6\u0024]/g, "")
    .trim();
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function isInvestmentSummaryRow(row: Row, product: string, assetType: string): boolean {
  const flat = row.map(norm);
  const normalizedProduct = norm(product);
  const normalizedAssetType = norm(assetType);
  const summaryKeywords = [
    "총계",
    "합계",
    "보유상품개수",
    "총투자원금",
    "총평가금액",
    "총수익률",
  ];

  if (summaryKeywords.some((keyword) => normalizedProduct.includes(keyword))) return true;
  if (normalizedAssetType.includes("총계") || normalizedAssetType.includes("합계")) return true;
  if (isAggregateRowName(product)) return true;

  return flat.some((cell) => summaryKeywords.some((keyword) => cell.includes(keyword)));
}

function recordExcludedIfNeeded(result: ParseResult, product: string, amount: number): boolean {
  const parsedTags = parsePortfolioTags(product);
  if (parsedTags.isSmallExcluded) {
    result.excludedSmallCount += 1;
    result.excludedHoldingValueKRW += amount;
    return true;
  }
  if (Math.abs(amount) < 10000) {
    result.excludedBelowMinimumCount += 1;
    result.excludedHoldingValueKRW += amount;
    return true;
  }
  return false;
}

function formatDate(v: Cell): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const m = String(v).match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return undefined;
}

/** 파일명에서 snapshotDate 추정. 날짜가 여러 개면 가장 늦은(뒤쪽) 날짜 우선. */
export function inferSnapshotDateFromFileName(fileName: string): string | null {
  const matches = (fileName || "").match(/\d{4}-\d{2}-\d{2}/g);
  if (!matches || matches.length === 0) return null;
  return matches.sort()[matches.length - 1];
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 자산 분류 (그룹명/상품명/태그 기반 휴리스틱). */
function classifyAsset(group: string, product: string, tag?: string): AssetCategory {
  const g = group || "";
  const p = (product || "").toLowerCase();
  const t = tag || "";
  if (t.includes("예적금") || g.includes("저축성") || p.includes("적금") || p.includes("예금")) {
    return "예적금";
  }
  if (
    t.includes("현금") ||
    g.includes("자유입출금") ||
    g.includes("현금") ||
    g.includes("전자금융") ||
    p.includes("통장") ||
    p.includes("머니") ||
    p.includes("cma") ||
    p.includes("파킹")
  ) {
    return "현금";
  }
  if (g.includes("투자성") || g.includes("연금") || g.includes("신탁")) {
    return "투자성";
  }
  return "기타";
}

function toRows(ws: XLSX.WorkSheet): Row[] {
  return XLSX.utils.sheet_to_json<Row>(ws, {
    header: 1,
    defval: null,
    blankrows: true,
    raw: true,
  });
}

/** 제목 셀을 찾는다 (norm 기준 startsWith). */
function findSection(rows: Row[], prefixes: string[]): { row: number; col: number } | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const t = norm(row[c]);
      if (t && prefixes.some((p) => t.startsWith(p))) return { row: r, col: c };
    }
  }
  return null;
}

/** afterRow 이후 처음 등장하는 "N.한글" 섹션 행 인덱스 (구간 경계). */
function nextNumberedSection(rows: Row[], afterRow: number): number {
  for (let r = afterRow; r < rows.length; r++) {
    const row = rows[r] || [];
    for (const cell of row) {
      if (/^\d+\.[\uac00-\ud7a3]/.test(norm(cell))) return r;
    }
  }
  return rows.length;
}

function pickNumberAfter(row: Row, idx: number): number | null {
  for (let c = idx + 1; c < row.length; c++) {
    const n = normalizeNumber(row[c]);
    if (n !== null) return n;
  }
  return null;
}

function colByAliases(headers: string[], aliases: string[]): number {
  const normalizedAliases = aliases.map(normHeader).filter(Boolean);
  return headers.findIndex((header) => {
    const normalizedHeader = normHeader(header);
    return normalizedAliases.some((alias) => normalizedHeader.includes(alias));
  });
}

function colByPriorityAliases(headers: string[], aliases: string[], excludeAliases: string[] = []): number {
  const normalizedAliases = aliases.map(normHeader).filter(Boolean);
  const normalizedExcludes = excludeAliases.map(normHeader).filter(Boolean);
  const normalizedHeaders = headers.map(normHeader);

  for (const alias of normalizedAliases) {
    const index = normalizedHeaders.findIndex((header) => {
      if (!header.includes(alias)) return false;
      return !normalizedExcludes.some((exclude) => header.includes(exclude));
    });
    if (index >= 0) return index;
  }
  return -1;
}

function firstNumber(row: Row, index: number): number | undefined {
  if (index < 0) return undefined;
  const value = normalizeNumber(row[index]);
  return value !== null ? value : undefined;
}

function cleanTickerValue(value: Cell): string | undefined {
  const ticker = txt(value).trim().toUpperCase().replace(/\s+/g, "");
  return ticker || undefined;
}

function normalizeCurrencyValue(value: Cell): string | undefined {
  const raw = txt(value).trim();
  if (!raw) return undefined;
  const upper = raw.toUpperCase().replace(/\s+/g, "");
  if (upper === "$" || upper.includes("USD") || upper.includes("달러")) return "USD";
  if (upper === "₩" || upper.includes("KRW") || upper.includes("원화")) return "KRW";
  return upper;
}

// ---- 3.재무현황 파싱 ----
function parseFinance(
  rows: Row[],
  result: ParseResult,
): void {
  const sec = findSection(rows, ["3.재무현황"]);
  if (!sec) {
    result.errors.push("3.재무현황 섹션을 찾지 못했습니다.");
    return;
  }
  // 헤더 행: 제목 아래 몇 줄 안에서 "상품명" + "금액" 포함 행
  let headerRow = -1;
  for (let r = sec.row + 1; r < Math.min(sec.row + 8, rows.length); r++) {
    const cells = (rows[r] || []).map(norm);
    if (cells.includes("상품명") && cells.some((x) => x.includes("금액"))) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) {
    result.warnings.push("3.재무현황 표 헤더(상품명/금액)를 찾지 못했습니다.");
    return;
  }

  const hdr = (rows[headerRow] || []).map(norm);
  const productCols = hdr.map((v, i) => (v === "상품명" ? i : -1)).filter((i) => i >= 0);
  const amountCols = hdr.map((v, i) => (v.includes("금액") ? i : -1)).filter((i) => i >= 0);
  const itemCols = hdr.map((v, i) => (v === "항목" ? i : -1)).filter((i) => i >= 0);

  result.preview.financeHeader = (rows[headerRow] || []).map(txt);

  const end = nextNumberedSection(rows, headerRow + 1);

  // 자산 블록 / 부채 블록
  const assetItemCol = itemCols[0] ?? -1;
  const assetProductCol = productCols[0] ?? -1;
  const assetAmountCol = amountCols[0] ?? -1;
  const debtItemCol = itemCols[1] ?? -1;
  const debtProductCol = productCols[1] ?? -1;
  const debtAmountCol = amountCols[1] ?? -1;

  let assetGroup = "";
  let debtGroup = "";
  let totalAsset: number | null = null;
  let totalDebt: number | null = null;
  let netAsset: number | null = null;
  let excludedAssetKRW = 0;
  let excludedDebtKRW = 0;
  let prevWasNetLabel = false;

  for (let r = headerRow + 1; r < end; r++) {
    const row = rows[r] || [];
    const flat = row.map(norm);

    // 순자산 숫자가 다음 행에 올 경우
    if (prevWasNetLabel && netAsset === null) {
      const n = pickNumberAfter([null, ...row], 0);
      if (n !== null) netAsset = n;
    }
    prevWasNetLabel = false;

    // 합계 행 처리
    const totalAssetIdx = flat.findIndex((x) => x === "총자산");
    if (totalAssetIdx >= 0) totalAsset = pickNumberAfter(row, totalAssetIdx);
    const totalDebtIdx = flat.findIndex((x) => x === "총부채");
    if (totalDebtIdx >= 0) totalDebt = pickNumberAfter(row, totalDebtIdx);
    const netIdx = flat.findIndex((x) => x === "순자산");
    if (netIdx >= 0) {
      const n = pickNumberAfter(row, netIdx);
      if (n !== null) netAsset = n;
      else prevWasNetLabel = true;
    }
    const isTotalRow = totalAssetIdx >= 0 || totalDebtIdx >= 0 || netIdx >= 0;

    // preview (원본 샘플, 최대 80행)
    if (result.preview.financeRows.length < 80) {
      const hasContent = row.some((c) => txt(c) !== "");
      if (hasContent) result.preview.financeRows.push(row.map(txt));
    }

    if (isTotalRow) continue;

    // 자산 블록
    if (assetProductCol >= 0) {
      const itemText = assetItemCol >= 0 ? txt(row[assetItemCol]) : "";
      if (itemText && !itemText.includes("총") && !/^\d+\./.test(norm(itemText))) {
        assetGroup = itemText;
      }
      const product = txt(row[assetProductCol]);
      const amount = normalizeNumber(row[assetAmountCol]);
      if (product && amount !== null && amount > 0) {
        if (recordExcludedIfNeeded(result, product, amount)) {
          excludedAssetKRW += amount;
        } else {
          const tag = extractTag(product);
          result.financeAssets.push(decorateFinanceAssetWithTags({
            id: makeId("fa"),
            groupName: assetGroup,
            productName: product,
            amountKRW: amount,
            inferredTag: tag,
            category: classifyAsset(assetGroup, product, tag),
            isDebt: false,
          }));
        }
      }
    }

    // 부채 블록
    if (debtProductCol >= 0) {
      const itemText = debtItemCol >= 0 ? txt(row[debtItemCol]) : "";
      if (itemText && !itemText.includes("총") && !/^\d+\./.test(norm(itemText))) {
        debtGroup = itemText;
      }
      const product = txt(row[debtProductCol]);
      const amount = normalizeNumber(row[debtAmountCol]);
      if (product && amount !== null && amount > 0) {
        if (recordExcludedIfNeeded(result, product, amount)) {
          excludedDebtKRW += amount;
        } else {
          const tag = extractTag(product);
          result.financeAssets.push(decorateFinanceAssetWithTags({
            id: makeId("fa"),
            groupName: debtGroup,
            productName: product,
            amountKRW: amount,
            inferredTag: tag,
            category: "기타",
            isDebt: true,
          }));
        }
      }
    }
  }

  const sumAssets = result.financeAssets
    .filter((f) => !f.isDebt)
    .reduce((s, f) => s + f.amountKRW, 0);
  const sumDebts = result.financeAssets
    .filter((f) => f.isDebt)
    .reduce((s, f) => s + f.amountKRW, 0);

  result.totalAssetKRW = totalAsset !== null ? totalAsset - excludedAssetKRW : sumAssets;
  result.totalDebtKRW = totalDebt !== null ? totalDebt - excludedDebtKRW : sumDebts;
  result.netAssetKRW = result.totalAssetKRW - result.totalDebtKRW;
}

// ---- 5.투자현황 파싱 ----
function parseInvestment(rows: Row[], result: ParseResult): void {
  const sec = findSection(rows, ["5.투자현황"]);
  if (!sec) {
    result.errors.push("5.투자현황 섹션을 찾지 못했습니다.");
    return;
  }
  let headerRow = -1;
  for (let r = sec.row + 1; r < Math.min(sec.row + 8, rows.length); r++) {
    const cells = (rows[r] || []).map(norm);
    const normalizedHeaders = (rows[r] || []).map(normHeader);
    const hasProduct = cells.includes("상품명") || normalizedHeaders.some((x) => x.includes("productname"));
    const hasMoneyHeader = normalizedHeaders.some((x) =>
      [
        "투자원금",
        "매입금액",
        "원금",
        "평가금액",
        "잔고평가금액",
        "평가액",
        "principal",
        "costbasis",
        "marketvalue",
        "valuation",
        "currentvalue",
      ].some((alias) => x.includes(normHeader(alias))),
    );
    if (hasProduct && hasMoneyHeader) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) {
    result.warnings.push("5.투자현황 표 헤더(상품명/투자원금)를 찾지 못했습니다.");
    return;
  }

  const hdr = (rows[headerRow] || []).map(norm);
  const colOf = (names: string[]): number =>
    hdr.findIndex((h) => names.some((n) => h.includes(n)));
  const colOfAny = (names: string[]): number => {
    const existing = colOf(names);
    return existing >= 0 ? existing : colByAliases(hdr, names);
  };

  const cType = colOfAny(["투자상품종류", "상품종류", "asset type", "asset class", "type"]);
  const cBroker = colByPriorityAliases(hdr, ["금융사", "증권사", "운용사", "broker", "brokerage", "securities"]);
  const cAccountName = colByPriorityAliases(hdr, ["계좌명", "계좌 이름", "계좌구분", "계좌 유형", "account name", "account type", "account"]);
  const cProduct = colOfAny(["상품명", "상품 이름", "product name", "product"]);
  const cPrincipal = colByPriorityAliases(
    hdr,
    ["투자원금", "투자 원금", "매입금액", "매수금액", "취득금액", "원금", "principal", "cost basis", "purchase amount", "book cost"],
    ["평가금액", "평가액", "평균", "평단", "단가", "average", "avg"],
  );
  const cValue = colByPriorityAliases(
    hdr,
    ["평가금액", "평가 금액", "잔고평가금액", "잔고 평가금액", "평가액", "평가 총액", "market value", "valuation", "current value", "value", "금액", "총액", "amount"],
    ["매입금액", "매수금액", "취득금액", "투자원금", "원금", "평균", "평단", "단가", "수익률", "average", "avg"],
  );
  const cReturn = colOfAny(["수익률", "return", "return pct"]);
  const cJoin = colOfAny(["가입일자", "가입일", "join date"]);
  const cMaturity = colOfAny(["만기일자", "만기일", "maturity date"]);
  const cQuantity = colByPriorityAliases(hdr, ["수량", "보유수량", "잔고수량", "보유 주수", "보유주수", "주수", "quantity", "qty", "shares", "share quantity", "holding quantity"]);
  const cAveragePrice = colByPriorityAliases(
    hdr,
    ["평균단가", "평균 매입가", "평균매입가", "매입평균가", "매입 평균가", "평단", "매입단가", "취득단가", "평균취득가", "average price", "avg price", "average cost", "avg cost"],
    ["현재", "시장", "평가", "current", "market", "last"],
  );
  const cCurrency = colByPriorityAliases(hdr, ["통화", "거래통화", "결제통화", "화폐", "currency", "ccy"]);
  const cTicker = colByPriorityAliases(hdr, ["티커", "종목코드", "종목 코드", "주식코드", "단축코드", "symbol", "ticker"]);
  const cCurrentPrice = colByPriorityAliases(
    hdr,
    ["현재가", "현재가격", "현재 가격", "시장가", "현재단가", "평가단가", "current price", "market price", "last price", "price", "단가"],
    ["평균", "평단", "매입", "취득", "average", "avg"],
  );

  result.preview.investmentHeader = (rows[headerRow] || []).map(txt);

  const end = nextNumberedSection(rows, headerRow + 1);

  let inInvestmentSummaryBlock = false;

  for (let r = headerRow + 1; r < end; r++) {
    const row = rows[r] || [];
    const product = cProduct >= 0 ? txt(row[cProduct]) : "";
    const assetType = cType >= 0 ? txt(row[cType]) : "";

    if (inInvestmentSummaryBlock || isInvestmentSummaryRow(row, product, assetType)) {
      inInvestmentSummaryBlock = true;
      continue;
    }

    if (!product) continue;

    const principal = cPrincipal >= 0 ? normalizeNumber(row[cPrincipal]) : null;
    const value = cValue >= 0 ? normalizeNumber(row[cValue]) : null;
    // 원금·평가금액이 모두 없으면 의미 없는 행으로 간주
    if ((principal === null || principal === 0) && (value === null || value === 0)) continue;

    if (result.preview.investmentRows.length < 80) {
      result.preview.investmentRows.push(row.map(txt));
    }

    const amountForFilter = value ?? principal ?? 0;
    const parsedTags = parsePortfolioTags(product);
    if (recordExcludedIfNeeded(result, product, amountForFilter)) continue;

    const explicitTicker = cleanTickerValue(cTicker >= 0 ? row[cTicker] : undefined);
    const quantity = firstNumber(row, cQuantity);
    const averagePrice = firstNumber(row, cAveragePrice);
    const currency = normalizeCurrencyValue(cCurrency >= 0 ? row[cCurrency] : undefined);
    const currentPrice = firstNumber(row, cCurrentPrice);
    const guess = guessTicker(product);
    const normalizedGuess = explicitTicker ?? guess.ticker ?? (/(비트코인|bitcoin|btc|코인)/i.test(product) ? "BTC" : undefined);
    const normalizedConfidence = explicitTicker
      ? "high"
      : normalizedGuess === "BTC" && !guess.ticker
        ? "medium"
        : guess.confidence;
    const isIntentionalOther = parsedTags.symbolGroup?.startsWith("기타") ?? false;
    const ret = cReturn >= 0 ? normalizeNumber(row[cReturn]) : null;
    const valueOriginalCurrency =
      quantity !== undefined && currentPrice !== undefined ? quantity * currentPrice : undefined;
    const decoratedHolding = decorateHoldingWithTags({
      id: makeId("h"),
      broker: cBroker >= 0 ? txt(row[cBroker]) : "",
      accountName: cAccountName >= 0 ? txt(row[cAccountName]) || undefined : undefined,
      assetType: cType >= 0 ? txt(row[cType]) || "기타" : "기타",
      productName: product,
      ticker: normalizedGuess,
      tickerConfidence: normalizedConfidence,
      needsReview: isIntentionalOther ? false : needsTickerReview(normalizedConfidence),
      tag: extractTag(product),
      principalKRW: principal ?? 0,
      valueKRW: value ?? 0,
      returnPct: ret ?? undefined,
      quantity,
      averagePrice,
      currency,
      currentPrice,
      valueOriginalCurrency,
      joinDate: cJoin >= 0 ? formatDate(row[cJoin]) : undefined,
      maturityDate: cMaturity >= 0 ? formatDate(row[cMaturity]) : undefined,
    });
    result.holdings.push(applyKnownQuoteTickerToHolding(decoratedHolding));
  }

  result.investmentPrincipalKRW = result.holdings.reduce((s, h) => s + h.principalKRW, 0);
  result.investmentValueKRW = result.holdings.reduce((s, h) => s + h.valueKRW, 0);
  result.returnAmountKRW = result.investmentValueKRW - result.investmentPrincipalKRW;
  result.returnPct =
    result.investmentPrincipalKRW > 0
      ? (result.returnAmountKRW / result.investmentPrincipalKRW) * 100
      : 0;
}

/** 워크북을 파싱 (테스트/재사용용). */
export function parseBanksaladWorkbook(wb: XLSX.WorkBook, fileName: string): ParseResult {
  const result: ParseResult = {
    ok: false,
    sheetName: "",
    snapshotDate: inferSnapshotDateFromFileName(fileName) ?? todayISO(),
    sourceFileName: fileName,
    totalAssetKRW: 0,
    totalDebtKRW: 0,
    netAssetKRW: 0,
    investmentPrincipalKRW: 0,
    investmentValueKRW: 0,
    returnAmountKRW: 0,
    returnPct: 0,
    holdings: [],
    financeAssets: [],
    preview: {
      financeHeader: [],
      financeRows: [],
      investmentHeader: [],
      investmentRows: [],
    },
    warnings: [],
    errors: [],
    excludedSmallCount: 0,
    excludedBelowMinimumCount: 0,
    excludedHoldingValueKRW: 0,
  };

  try {
    const sheetName =
      wb.SheetNames.find((n) => norm(n).includes("뱅샐현황")) ?? wb.SheetNames[0];
    result.sheetName = sheetName || "";
    const ws = sheetName ? wb.Sheets[sheetName] : undefined;
    if (!ws) {
      result.errors.push("시트를 찾지 못했습니다.");
      return result;
    }
    const rows = toRows(ws);
    parseFinance(rows, result);
    parseInvestment(rows, result);
  } catch (e) {
    result.errors.push(`파싱 중 오류: ${e instanceof Error ? e.message : String(e)}`);
  }

  result.ok = result.errors.length === 0;
  return result;
}

/** File 입력을 받아 파싱. (브라우저) */
export async function parseBanksaladFile(file: File): Promise<ParseResult> {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    return parseBanksaladWorkbook(wb, file.name);
  } catch (e) {
    return {
      ok: false,
      sheetName: "",
      snapshotDate: inferSnapshotDateFromFileName(file.name) ?? todayISO(),
      sourceFileName: file.name,
      totalAssetKRW: 0,
      totalDebtKRW: 0,
      netAssetKRW: 0,
      investmentPrincipalKRW: 0,
      investmentValueKRW: 0,
      returnAmountKRW: 0,
      returnPct: 0,
      holdings: [],
      financeAssets: [],
      preview: { financeHeader: [], financeRows: [], investmentHeader: [], investmentRows: [] },
      warnings: [],
      errors: [`파일 읽기 실패: ${e instanceof Error ? e.message : String(e)}`],
      excludedSmallCount: 0,
      excludedBelowMinimumCount: 0,
      excludedHoldingValueKRW: 0,
    };
  }
}
