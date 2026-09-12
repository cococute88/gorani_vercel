import { classifyAccountStatusGroup } from "../account-status-group";
import type { PortfolioAccountRow, PortfolioPageModel } from "../portfolio-from-snapshots";
import type { MoneyLevelPortfolioSnapshot } from "./types";

export type MoneyLevelPortfolioDiagnosticCode =
  | "portfolio_snapshot_unavailable"
  | "isa_account_missing"
  | "isa_principal_unavailable"
  | "isa_principal_zero_or_missing"
  | "pension_account_missing"
  | "pension_principal_unavailable"
  | "pension_principal_zero_or_missing"
  | "updated_at_invalid"
  | "updated_at_epoch_fallback";

export type MoneyLevelPortfolioDiagnostic = {
  code: MoneyLevelPortfolioDiagnosticCode;
  message: string;
};

export type MoneyLevelPortfolioSelection = {
  snapshot: MoneyLevelPortfolioSnapshot | null;
  diagnostics: MoneyLevelPortfolioDiagnostic[];
};

type MoneyLevelPortfolioSelectorInput = Pick<PortfolioPageModel, "snapshot" | "accountCards">;

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function accountPrincipal(
  accountCards: readonly PortfolioAccountRow[],
  accountName: "ISA" | "연금",
): number {
  const principal = accountCards.find((card) => card.name === accountName)?.principal;
  return typeof principal === "number" && Number.isFinite(principal) ? principal : 0;
}

/**
 * Detects the mapper's known epoch fallback as well as malformed timestamps.
 * The selector still preserves PortfolioSnapshot.createdAt verbatim in the
 * public contract; this helper only exposes diagnostics to future UI code.
 */
export function isSuspiciousMoneyLevelUpdatedAt(updatedAt: string): boolean {
  const parsed = Date.parse(updatedAt);
  return !ISO_TIMESTAMP_PATTERN.test(updatedAt)
    || !Number.isFinite(parsed)
    || new Date(parsed).getUTCFullYear() <= 1970;
}

/**
 * Adapts the same normalized account rows rendered by /portfolio. It must not
 * inspect holdings, finance assets, raw Firestore fields, or apply thresholds.
 */
export function selectMoneyLevelPortfolioSnapshot(
  portfolioPageModel: MoneyLevelPortfolioSelectorInput,
): MoneyLevelPortfolioSnapshot | null {
  if (!portfolioPageModel.snapshot) return null;

  const brokerageValue = portfolioPageModel.accountCards
    .filter((card) => classifyAccountStatusGroup(card) === "위탁")
    .reduce((sum, card) => sum + card.value, 0);

  return {
    brokerageValue,
    isaPrincipal: accountPrincipal(portfolioPageModel.accountCards, "ISA"),
    pensionPrincipal: accountPrincipal(portfolioPageModel.accountCards, "연금"),
    updatedAt: portfolioPageModel.snapshot.createdAt,
  };
}

export function diagnoseMoneyLevelPortfolioSelection(
  portfolioPageModel: MoneyLevelPortfolioSelectorInput,
): MoneyLevelPortfolioDiagnostic[] {
  if (!portfolioPageModel.snapshot) {
    return [{
      code: "portfolio_snapshot_unavailable",
      message: "Money Level snapshot을 만들 Portfolio snapshot이 없습니다.",
    }];
  }

  const diagnostics: MoneyLevelPortfolioDiagnostic[] = [];
  const inspectPrincipal = (
    accountName: "ISA" | "연금",
    prefix: "isa" | "pension",
  ) => {
    const row = portfolioPageModel.accountCards.find((card) => card.name === accountName);
    if (!row) {
      diagnostics.push({
        code: `${prefix}_account_missing` as MoneyLevelPortfolioDiagnosticCode,
        message: `${accountName} normalized account row가 없습니다.`,
      });
      return;
    }
    if (row.principal === null || !Number.isFinite(row.principal)) {
      diagnostics.push({
        code: `${prefix}_principal_unavailable` as MoneyLevelPortfolioDiagnosticCode,
        message: `${accountName} normalized principal을 사용할 수 없어 contract에는 0원이 사용됩니다.`,
      });
      return;
    }
    if (row.principal === 0) {
      diagnostics.push({
        code: `${prefix}_principal_zero_or_missing` as MoneyLevelPortfolioDiagnosticCode,
        message: `${accountName} principal이 0원입니다. 실제 0원인지 mapper의 누락 fallback인지 확인이 필요합니다.`,
      });
    }
  };

  inspectPrincipal("ISA", "isa");
  inspectPrincipal("연금", "pension");

  const parsedUpdatedAt = Date.parse(portfolioPageModel.snapshot.createdAt);
  if (!ISO_TIMESTAMP_PATTERN.test(portfolioPageModel.snapshot.createdAt) || !Number.isFinite(parsedUpdatedAt)) {
    diagnostics.push({
      code: "updated_at_invalid",
      message: "PortfolioSnapshot.createdAt이 유효한 ISO timestamp가 아닙니다.",
    });
  } else if (new Date(parsedUpdatedAt).getUTCFullYear() <= 1970) {
    diagnostics.push({
      code: "updated_at_epoch_fallback",
      message: "PortfolioSnapshot.createdAt이 epoch fallback으로 보입니다.",
    });
  }

  return diagnostics;
}

export function selectMoneyLevelPortfolioSnapshotWithDiagnostics(
  portfolioPageModel: MoneyLevelPortfolioSelectorInput,
): MoneyLevelPortfolioSelection {
  return {
    snapshot: selectMoneyLevelPortfolioSnapshot(portfolioPageModel),
    diagnostics: diagnoseMoneyLevelPortfolioSelection(portfolioPageModel),
  };
}
