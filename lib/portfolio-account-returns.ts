import { classifyAccountStatusGroup, type AccountStatusGroup } from "./account-status-group";
import type { FinanceAsset, Holding, PortfolioSnapshot } from "./portfolio-types";

export const MIN_VISIBLE_ACCOUNT_AMOUNT_KRW = 200_000;

export type AccountReturnSource = "holdings" | "financeAssets" | "mixed" | "unavailable";

export interface AccountReturnRow {
  id: string;
  label: string;
  parentGroup: "taxable" | "taxSaving" | "unclassified";
  type: string;
  tax: "과세" | "비과세" | "미확인";
  statusGroup: AccountStatusGroup;
  valueKRW: number | null;
  principalKRW: number | null;
  returnAmountKRW: number | null;
  returnPct: number | null;
  holdingCount: number;
  source: {
    value: AccountReturnSource;
    principal: AccountReturnSource;
  };
  warnings?: string[];
}

export interface AccountReturnGroup {
  id: "taxable" | "taxSaving" | "unclassified";
  label: AccountStatusGroup;
  rows: AccountReturnRow[];
  valueKRW: number;
  principalKRW: number | null;
  returnAmountKRW: number | null;
  returnPct: number | null;
}

export interface PortfolioAccountReturnsResult {
  groups: AccountReturnGroup[];
  rows: AccountReturnRow[];
  warnings: Array<{ code: string; message: string }>;
  valueSource: AccountReturnSource;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const n = finiteNumber(value);
  return n !== null && n > 0 ? n : null;
}

function accountKey(value: string | undefined): string {
  return value?.trim() || "미분류";
}

function holdingAccountName(holding: Holding): string {
  return accountKey(holding.accountGroup || holding.accountName || holding.broker || holding.assetType);
}

function financeAccountName(asset: FinanceAsset): string {
  const extra = asset as FinanceAsset & { accountName?: string; broker?: string; institutionName?: string };
  return accountKey(
    asset.accountGroup || extra.accountName || extra.broker || extra.institutionName || asset.groupName || asset.cleanName || asset.productName,
  );
}

function financePrincipal(asset: FinanceAsset): number | null {
  const extra = asset as FinanceAsset & {
    principalKRW?: unknown;
    investmentPrincipalKRW?: unknown;
    principalAmountKRW?: unknown;
    purchaseAmountKRW?: unknown;
  };
  return (
    finiteNumber(extra.principalKRW) ??
    finiteNumber(extra.investmentPrincipalKRW) ??
    finiteNumber(extra.principalAmountKRW) ??
    finiteNumber(extra.purchaseAmountKRW)
  );
}

function taxTypeFromName(name: string, type: string): AccountReturnRow["tax"] {
  const text = `${name} ${type}`.toUpperCase();
  if (/ISA|IRP|연금|절세|비과세/.test(text)) return "비과세";
  if (/위탁|일반|해외주식|국내주식|과세/.test(text)) return "과세";
  return "미확인";
}

function parentGroupOf(status: AccountStatusGroup): AccountReturnRow["parentGroup"] {
  if (status === "위탁") return "taxable";
  if (status === "절세") return "taxSaving";
  return "unclassified";
}

function isNonDebtFinanceAsset(asset: FinanceAsset): boolean {
  return asset.isDebt !== true;
}

function calculate(value: number | null, principal: number | null) {
  if (value === null || principal === null || principal <= 0) {
    return { returnAmountKRW: null, returnPct: null };
  }
  const returnAmountKRW = Math.round(value - principal);
  const returnPct = (returnAmountKRW / principal) * 100;
  return Number.isFinite(returnPct) ? { returnAmountKRW, returnPct } : { returnAmountKRW: null, returnPct: null };
}

export function buildPortfolioAccountReturnRows(snapshot: PortfolioSnapshot): PortfolioAccountReturnsResult {
  const warnings: PortfolioAccountReturnsResult["warnings"] = [];
  const financeTotals = new Map<string, { value: number; principal: number; hasPrincipal: boolean; count: number; type: string }>();
  const holdingTotals = new Map<string, { value: number; principal: number; hasPrincipal: boolean; count: number; type: string }>();

  for (const asset of snapshot.financeAssets ?? []) {
    if (!isNonDebtFinanceAsset(asset)) continue;
    const value = positiveNumber(asset.amountKRW);
    if (value === null) continue;
    const name = financeAccountName(asset);
    const current = financeTotals.get(name) ?? { value: 0, principal: 0, hasPrincipal: false, count: 0, type: asset.statusGroup || asset.category || asset.groupName || "기타" };
    current.value += value;
    const principal = financePrincipal(asset);
    if (principal !== null) {
      current.principal += principal;
      current.hasPrincipal = true;
    }
    current.count += 1;
    financeTotals.set(name, current);
  }

  for (const holding of snapshot.holdings ?? []) {
    const value = positiveNumber(holding.valueKRW);
    if (value === null) continue;
    const name = holdingAccountName(holding);
    const current = holdingTotals.get(name) ?? { value: 0, principal: 0, hasPrincipal: false, count: 0, type: holding.statusGroup || holding.assetType || "기타" };
    current.value += value;
    const principal = finiteNumber(holding.principalKRW);
    if (principal !== null) {
      current.principal += principal;
      current.hasPrincipal = true;
    }
    current.count += 1;
    holdingTotals.set(name, current);
  }

  const useFinanceValues = financeTotals.size > 0;
  const valueEntries = useFinanceValues ? financeTotals : holdingTotals;
  const rows: AccountReturnRow[] = [];

  for (const [label, valueItem] of Array.from(valueEntries.entries())) {
    if (valueItem.value < MIN_VISIBLE_ACCOUNT_AMOUNT_KRW) continue;
    const holdingItem = holdingTotals.get(label);
    const financeItem = financeTotals.get(label);
    const principalItem = holdingItem?.hasPrincipal ? holdingItem : financeItem?.hasPrincipal ? financeItem : null;
    const principalKRW = principalItem ? Math.round(principalItem.principal) : null;
    const valueKRW = Math.round(valueItem.value);
    const calc = calculate(valueKRW, principalKRW);
    const statusGroup = classifyAccountStatusGroup({ name: label, type: valueItem.type, statusGroup: valueItem.type, tax: taxTypeFromName(label, valueItem.type) });
    const rowWarnings: string[] = [];
    if (principalKRW === null) rowWarnings.push("원금 정보 없음");
    if (useFinanceValues && holdingItem?.hasPrincipal && Math.abs(holdingItem.value - valueItem.value) > 1) {
      rowWarnings.push("평가금액과 원금의 집계 기준이 다릅니다.");
    }
    rows.push({
      id: label,
      label,
      parentGroup: parentGroupOf(statusGroup),
      type: valueItem.type,
      tax: taxTypeFromName(label, valueItem.type),
      statusGroup,
      valueKRW,
      principalKRW,
      returnAmountKRW: calc.returnAmountKRW,
      returnPct: calc.returnPct,
      holdingCount: valueItem.count,
      source: {
        value: useFinanceValues ? "financeAssets" : "holdings",
        principal: principalItem === holdingItem ? "holdings" : principalItem === financeItem ? "financeAssets" : "unavailable",
      },
      warnings: rowWarnings.length > 0 ? rowWarnings : undefined,
    });
  }

  rows.sort((a, b) => (b.valueKRW ?? 0) - (a.valueKRW ?? 0));
  if (rows.some((row) => row.principalKRW === null)) {
    warnings.push({ code: "account_principal_missing", message: "일부 계좌는 원금 정보가 없어 수익률을 계산하지 않습니다." });
  }
  if (rows.some((row) => row.source.value === "financeAssets" && row.source.principal === "holdings")) {
    warnings.push({ code: "account_value_principal_source_mixed", message: "일부 계좌는 평가금액과 원금의 집계 기준이 달라 참고용으로 표시합니다." });
  }

  const groupDefs: Array<{ id: AccountReturnGroup["id"]; label: AccountStatusGroup }> = [
    { id: "taxable", label: "위탁" },
    { id: "taxSaving", label: "절세" },
    { id: "unclassified", label: "미확인" },
  ];
  const groups = groupDefs.map(({ id, label }) => {
    const groupRows = rows.filter((row) => row.parentGroup === id);
    const valueKRW = groupRows.reduce((sum, row) => sum + (row.valueKRW ?? 0), 0);
    const principalSum = groupRows.reduce((sum, row) => sum + (row.principalKRW ?? 0), 0);
    const hasAllPrincipal = groupRows.length > 0 && groupRows.every((row) => row.principalKRW !== null);
    const principalKRW = hasAllPrincipal && principalSum > 0 ? principalSum : null;
    const calc = calculate(valueKRW, principalKRW);
    return { id, label, rows: groupRows, valueKRW, principalKRW, ...calc };
  }).filter((group) => group.rows.length > 0);

  return { groups, rows, warnings, valueSource: useFinanceValues ? "financeAssets" : rows.length > 0 ? "holdings" : "unavailable" };
}
