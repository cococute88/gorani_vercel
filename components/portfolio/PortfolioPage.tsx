"use client";

import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import StorageModeBadge from "@/components/common/StorageModeBadge";
import {
  usePortfolioSnapshots,
  saveSnapshot,
  deleteSnapshot,
  hasSnapshotDate,
} from "@/lib/portfolio-store";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import { deletePortfolioSnapshot, savePortfolioSnapshot, warnFirestoreFallback } from "@/lib/firebase/firestore-repositories";
import { parseBanksaladFile } from "@/lib/banksalad-parser";
import type { ParseResult } from "@/lib/banksalad-parser";
import { MOCK_LATEST_SNAPSHOT } from "@/lib/mock-portfolio-data";
import type { Holding, PortfolioSnapshot } from "@/lib/portfolio-types";
import { filterAggregateHoldings } from "@/lib/portfolio-summary-row";
import { applyKnownQuoteTickerToHolding } from "@/lib/holding-ticker-normalizer";
import {
  applyKrxTickerMappingsToHoldings,
  normalizeKrxTickerForTickerMap,
  upsertKrxTickerMapping,
} from "@/lib/krx-ticker-name-map";
import { parseSummaryFromSnapshot } from "@/lib/portfolio-parse-summary";
import ExcelUploadCard from "./ExcelUploadCard";
import PortfolioParsePreview from "./PortfolioParsePreview";
import ParseSummaryCard from "./ParseSummaryCard";
import AssetAllocationDonut from "./AssetAllocationDonut";
import HoldingsTable from "./HoldingsTable";
import AssetTable from "./AssetTable";
import SnapshotHistory from "./SnapshotHistory";
import PortfolioAssetTrendChart from "./PortfolioAssetTrendChart";
import PortfolioQuoteStatusPanel from "./PortfolioQuoteStatusPanel";
import AssetMapSection from "@/components/asset-map/AssetMapSection";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import { usePortfolioCloudSync } from "@/lib/portfolio-cloud-sync";

function snapshotToResult(s: PortfolioSnapshot): ParseResult {
  return {
    ok: true,
    sheetName: "목업 데이터",
    snapshotDate: s.snapshotDate,
    sourceFileName: s.sourceFileName,
    totalAssetKRW: s.totalAssetKRW,
    totalDebtKRW: s.totalDebtKRW,
    netAssetKRW: s.netAssetKRW,
    investmentPrincipalKRW: s.investmentPrincipalKRW,
    investmentValueKRW: s.investmentValueKRW,
    returnAmountKRW: s.returnAmountKRW,
    returnPct: s.returnPct,
    holdings: s.holdings,
    financeAssets: s.financeAssets,
    preview: { financeHeader: [], financeRows: [], investmentHeader: [], investmentRows: [] },
    warnings: ["목업 데이터로 불러온 결과입니다."],
    errors: [],
    excludedSmallCount: s.metadata?.excludedSmallCount ?? 0,
    excludedBelowMinimumCount: s.metadata?.excludedBelowMinimumCount ?? 0,
    excludedHoldingValueKRW: s.metadata?.excludedHoldingValueKRW ?? 0,
  };
}

function resultToSnapshot(r: ParseResult, holdings: Holding[]): PortfolioSnapshot {
  const cleanHoldings = filterAggregateHoldings(holdings);
  const investmentPrincipalKRW = cleanHoldings.reduce((sum, h) => sum + h.principalKRW, 0);
  const investmentValueKRW = cleanHoldings.reduce((sum, h) => sum + h.valueKRW, 0);
  const returnAmountKRW = investmentValueKRW - investmentPrincipalKRW;
  const returnPct =
    investmentPrincipalKRW > 0 ? (returnAmountKRW / investmentPrincipalKRW) * 100 : 0;

  return {
    id: `snap-${r.snapshotDate}-${Date.now().toString(36)}`,
    snapshotDate: r.snapshotDate,
    sourceFileName: r.sourceFileName,
    totalAssetKRW: r.totalAssetKRW,
    totalDebtKRW: r.totalDebtKRW,
    netAssetKRW: r.netAssetKRW,
    investmentPrincipalKRW,
    investmentValueKRW,
    returnAmountKRW,
    returnPct,
    holdings: cleanHoldings,
    financeAssets: r.financeAssets,
    createdAt: new Date().toISOString(),
    metadata: {
      parserVersion: "stage2-tags-v1",
      excludedSmallCount: r.excludedSmallCount,
      excludedBelowMinimumCount: r.excludedBelowMinimumCount,
      excludedHoldingValueKRW: r.excludedHoldingValueKRW,
      liveViewVersion: "stage2-live-v1",
    },
  };
}

export default function PortfolioPage() {
  const snapshots = usePortfolioSnapshots();
  const { user, loading: authLoading, configured } = useFirebaseAuth();
  const syncState = usePortfolioCloudSync();

  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null);
  const [tickerMapNotice, setTickerMapNotice] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const applyResult = (r: ParseResult) => {
    setPreviewSnapshotId(null);
    const mapped = applyKrxTickerMappingsToHoldings(filterAggregateHoldings(r.holdings));
    const cleanHoldings = mapped.holdings.map(applyKnownQuoteTickerToHolding);
    const investmentPrincipalKRW = cleanHoldings.reduce((sum, h) => sum + h.principalKRW, 0);
    const investmentValueKRW = cleanHoldings.reduce((sum, h) => sum + h.valueKRW, 0);
    const returnAmountKRW = investmentValueKRW - investmentPrincipalKRW;
    const returnPct =
      investmentPrincipalKRW > 0 ? (returnAmountKRW / investmentPrincipalKRW) * 100 : 0;

    setResult({
      ...r,
      holdings: cleanHoldings,
      investmentPrincipalKRW,
      investmentValueKRW,
      returnAmountKRW,
      returnPct,
    });
    setHoldings(cleanHoldings);
    const sel: Record<string, boolean> = {};
    cleanHoldings.forEach((h) => (sel[h.id] = true));
    setSelected(sel);
    setTickerMapNotice(
      mapped.appliedCount > 0
        ? {
            tone: "info",
            text: `저장된 KRX 티커 매핑 ${mapped.appliedCount}개를 적용했어요.`,
          }
        : null,
    );
  };

  const handleParse = async () => {
    if (files.length === 0) return;
    setParsing(true);
    try {
      // 여러 파일 중 첫 파일을 파싱 (TODO(codex): 다중 파일 일괄 파싱)
      const r = await parseBanksaladFile(files[0]);
      applyResult(r);
    } catch (e) {
      setResult({
        ok: false,
        sheetName: "-",
        snapshotDate: "-",
        sourceFileName: files[0]?.name ?? "-",
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
        errors: [`파싱 중 오류가 발생했습니다: ${String(e)}`],
        excludedSmallCount: 0,
        excludedBelowMinimumCount: 0,
        excludedHoldingValueKRW: 0,
      });
    } finally {
      setParsing(false);
    }
  };

  const handleLoadMock = () => applyResult(snapshotToResult(MOCK_LATEST_SNAPSHOT));

  const handleRegister = async () => {
    if (!result || !result.ok) return;
    const chosen = filterAggregateHoldings(holdings.filter((h) => selected[h.id] ?? true));
    const snap = resultToSnapshot(result, chosen);
    if (hasSnapshotDate(snap.snapshotDate)) {
      const ok = window.confirm(
        `${snap.snapshotDate} 스냅샷이 이미 있습니다. 덮어쓰시겠습니까?`,
      );
      if (!ok) return;
    }
    saveSnapshot(snap);
    if (user) {
      await savePortfolioSnapshot(user.uid, snap).catch((err) =>
        warnFirestoreFallback("portfolioSnapshots.save", err),
      );
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (previewSnapshotId === id) setPreviewSnapshotId(null);
    deleteSnapshot(id);
    if (user) {
      await deletePortfolioSnapshot(user.uid, id).catch((err) =>
        warnFirestoreFallback("portfolioSnapshots.delete", err),
      );
    }
  };

  const onToggle = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  const onTickerChange = (id: string, ticker: string) => {
    const normalized = normalizeKrxTickerForTickerMap(ticker);

    if (!normalized) {
      setHoldings((prev) => prev.map((h) => (h.id === id ? { ...h, ticker } : h)));
      const compact = ticker.trim().replace(/\s+/g, "").toUpperCase();
      if (compact.length >= 6 && compact !== "") {
        setTickerMapNotice({
          tone: "error",
          text: "KRX 티커는 6자리 숫자 또는 005930.KS/KQ 형식만 저장돼요.",
        });
      } else {
        setTickerMapNotice(null);
      }
      return;
    }

    const target = holdings.find((holding) => holding.id === id);
    if (!target) return;

    const upserted = upsertKrxTickerMapping({ holding: target, tickerInput: ticker });
    if (!upserted.ok) {
      setTickerMapNotice({
        tone: "error",
        text: upserted.error === "invalid_product_name"
          ? "상품명을 확인할 수 없어 KRX 티커 매핑을 저장하지 못했어요."
          : "KRX 티커는 6자리 숫자 또는 005930.KS/KQ 형식만 저장돼요.",
      });
      return;
    }

    const next = holdings.map((holding) =>
      holding.id === id
        ? {
            ...holding,
            ticker: upserted.entry.displayTicker,
            tickerConfidence: "high" as const,
            needsReview: false,
          }
        : holding,
    );
    const applied = applyKrxTickerMappingsToHoldings(next, upserted.map);
    setHoldings(applied.holdings.map(applyKnownQuoteTickerToHolding));
    setTickerMapNotice({
      tone: "success",
      text: `KRX 티커 ${upserted.entry.displayTicker} 저장 · 같은 상품명 ${applied.appliedCount}개 자동 적용`,
    });
  };

  const previewSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === previewSnapshotId) ?? null,
    [previewSnapshotId, snapshots],
  );
  const displayedHoldings = useMemo(
    () =>
      previewSnapshot
        ? applyKrxTickerMappingsToHoldings(filterAggregateHoldings(previewSnapshot.holdings ?? [])).holdings.map(applyKnownQuoteTickerToHolding)
        : holdings,
    [holdings, previewSnapshot],
  );
  const displayedAssets = previewSnapshot ? previewSnapshot.financeAssets ?? [] : result?.financeAssets ?? [];
  const displayedSelected = useMemo(() => {
    if (!previewSnapshot) return selected;
    return Object.fromEntries(displayedHoldings.map((holding) => [holding.id, true]));
  }, [displayedHoldings, previewSnapshot, selected]);

  useEffect(() => {
    if (previewSnapshotId && !previewSnapshot) setPreviewSnapshotId(null);
  }, [previewSnapshot, previewSnapshotId]);

  const canRegister = useMemo(() => !!result && result.ok, [result]);
  const theme = useResolvedTheme();

  // 최신 등록 스냅샷 (파싱 preview 가 없을 때 자산군 도넛의 기준).
  const latestSnapshot = useMemo(
    () =>
      snapshots.length > 0
        ? snapshots.reduce((latest, item) =>
            item.snapshotDate >= latest.snapshotDate ? item : latest,
          )
        : null,
    [snapshots],
  );

  // 상단 3-카드 도넛 기준: 파싱 preview 우선 → 없으면 최신 스냅샷 → 없으면 empty.
  const donutHoldings = result ? holdings : latestSnapshot?.holdings ?? [];
  const donutFinanceAssets = result
    ? result.financeAssets ?? []
    : latestSnapshot?.financeAssets ?? [];
  const donutEmptyMessage = result
    ? "평가금액이 있는 항목이 없어 자산군 비중을 표시할 수 없습니다."
    : "엑셀을 업로드하면 자산군 비중이 표시됩니다.";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-800 dark:bg-[#111516] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[20px] font-extrabold text-slate-900 dark:text-white">포트폴리오 관리</h1>
          <StorageModeBadge />
        </div>
        <p className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-500 dark:border-[#273032] dark:bg-[#171d1e] dark:text-slate-400">
          {user
            ? "로그인 상태에서는 Firestore에 저장돼요."
            : configured
              ? "로그아웃 상태에서는 이 브라우저에만 임시 저장돼요."
              : "Firebase 설정이 없어 로컬 미리보기 모드로 동작합니다."}
          {syncState.status === "syncing" || authLoading ? " 로그인/클라우드 스냅샷을 확인 중입니다." : ""}
          {syncState.status === "failed" ? " 동기화 실패: 로컬 저장은 유지됩니다." : ""}
        </p>

        {/* 한 줄에 엑셀 업로드 / 자산군 도넛 / 파싱결과 요약 3개 카드.
            wide(xl): 3열 · tablet(md): 2열(요약은 한 줄 차지) · mobile: 1열 */}
        <section className="mb-6 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ExcelUploadCard
            files={files}
            onAddFiles={(fs) => setFiles((prev) => [...prev, ...fs])}
            onRemoveFile={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
            onParse={handleParse}
            onLoadMock={handleLoadMock}
            parsing={parsing}
          />
          <AssetAllocationDonut
            holdings={donutHoldings}
            financeAssets={donutFinanceAssets}
            theme="dark"
            title="자산군 비중"
            emptyMessage={donutEmptyMessage}
          />
          <div className="h-full md:col-span-2 xl:col-span-1">
            <PortfolioParsePreview result={result} />
          </div>
        </section>

        <section className="mb-6">
          {previewSnapshot && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
              <span className="break-keep text-[12.5px] text-blue-700 dark:text-blue-100">
                스냅샷 미리보기 중: <b className="text-blue-900 dark:text-white">{previewSnapshot.snapshotDate}</b>
              </span>
              <button
                type="button"
                onClick={() => setPreviewSnapshotId(null)}
                className="break-keep rounded-md bg-white/10 px-2.5 py-1 text-[12px] font-medium text-slate-100 hover:bg-white/15"
              >
                최신 스냅샷 보기
              </button>
            </div>
          )}
          {previewSnapshot && (
            // 스냅샷 상세: 왼쪽 도넛 + 오른쪽 파싱 결과 요약(3x3).
            // desktop(lg+) 2열로 나란히, mobile 에서는 세로 stack.
            <div className="mb-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
              <div className="w-full min-w-0">
                <AssetAllocationDonut
                  holdings={displayedHoldings}
                  financeAssets={previewSnapshot.financeAssets ?? []}
                  theme="dark"
                  title={`자산군 비중 · ${previewSnapshot.snapshotDate} 기준`}
                  emptyMessage="이 스냅샷에는 표시할 자산군 비중이 없습니다."
                />
              </div>
              <div className="w-full min-w-0">
                <ParseSummaryCard model={parseSummaryFromSnapshot(previewSnapshot)} />
              </div>
            </div>
          )}
          <PortfolioQuoteStatusPanel holdings={displayedHoldings} />
          <HoldingsTable
            holdings={displayedHoldings}
            selected={displayedSelected}
            onToggle={previewSnapshot ? () => undefined : onToggle}
            onTickerChange={previewSnapshot ? () => undefined : onTickerChange}
            readOnly={Boolean(previewSnapshot)}
            tickerMapNotice={previewSnapshot ? null : tickerMapNotice}
          />
        </section>

        <section className="mb-6">
          <AssetTable assets={displayedAssets} />
        </section>

        <section className="mb-6 flex justify-end">
          <button
            onClick={handleRegister}
            disabled={!canRegister}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            이 스냅샷 등록
          </button>
        </section>

        <section className="mb-6">
          <SnapshotHistory
            snapshots={snapshots}
            onDelete={handleDeleteSnapshot}
            onSelect={(snapshot) => setPreviewSnapshotId(snapshot.id)}
            selectedSnapshotId={previewSnapshotId}
            loading={authLoading || syncState.status === "syncing"}
          />
        </section>

        <section className="mb-6">
          <PortfolioAssetTrendChart snapshots={snapshots} />
        </section>

        <AssetMapSection />
      </main>
    </div>
  );
}
