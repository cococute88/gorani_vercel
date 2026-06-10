"use client";

import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import StorageModeBadge from "@/components/common/StorageModeBadge";
import {
  usePortfolioSnapshots,
  saveSnapshot,
  deleteSnapshot,
  hasSnapshotDate,
  replaceSnapshots,
} from "@/lib/portfolio-store";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import { deletePortfolioSnapshot, loadPortfolioSnapshots, savePortfolioSnapshot, warnFirestoreFallback } from "@/lib/firebase/firestore-repositories";
import { parseBanksaladFile } from "@/lib/banksalad-parser";
import type { ParseResult } from "@/lib/banksalad-parser";
import { MOCK_LATEST_SNAPSHOT } from "@/lib/mock-portfolio-data";
import type { Holding, PortfolioSnapshot } from "@/lib/portfolio-types";
import { filterAggregateHoldings } from "@/lib/portfolio-summary-row";
import ExcelUploadCard from "./ExcelUploadCard";
import PortfolioParsePreview from "./PortfolioParsePreview";
import HoldingsTable from "./HoldingsTable";
import AssetTable from "./AssetTable";
import SnapshotHistory from "./SnapshotHistory";
import PortfolioPerformanceChart from "./PortfolioPerformanceChart";

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
  const { user, configured } = useFirebaseAuth();

  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const applyResult = (r: ParseResult) => {
    const cleanHoldings = filterAggregateHoldings(r.holdings);
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

  useEffect(() => {
    if (!user) return;
    loadPortfolioSnapshots(user.uid)
      .then((cloudSnapshots) => {
        if (cloudSnapshots.length > 0) replaceSnapshots(cloudSnapshots);
      })
      .catch((err) => warnFirestoreFallback("portfolioSnapshots.load", err));
  }, [user]);

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
    deleteSnapshot(id);
    if (user) {
      await deletePortfolioSnapshot(user.uid, id).catch((err) =>
        warnFirestoreFallback("portfolioSnapshots.delete", err),
      );
    }
  };

  const onToggle = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  const onTickerChange = (id: string, ticker: string) =>
    setHoldings((prev) => prev.map((h) => (h.id === id ? { ...h, ticker } : h)));

  const canRegister = useMemo(() => !!result && result.ok, [result]);

  return (
    <div className="min-h-screen bg-[#111516] text-slate-200">
      <TopNav theme="dark" />
      <main className="mx-auto max-w-[1640px] px-8 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[20px] font-extrabold text-white">포트폴리오 관리</h1>
          <StorageModeBadge />
        </div>
        <p className="mb-4 rounded-2xl border border-[#273032] bg-[#171d1e] px-4 py-3 text-[13px] text-slate-400">
          {user
            ? "로그인 상태에서는 Firestore에 저장돼요."
            : configured
              ? "로그아웃 상태에서는 이 브라우저에만 임시 저장돼요."
              : "Firebase 설정이 없어 로컬 미리보기 모드로 동작합니다."}
        </p>

        <section className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ExcelUploadCard
            files={files}
            onAddFiles={(fs) => setFiles((prev) => [...prev, ...fs])}
            onRemoveFile={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
            onParse={handleParse}
            onLoadMock={handleLoadMock}
            parsing={parsing}
          />
          <PortfolioParsePreview result={result} />
        </section>

        <section className="mb-6">
          <HoldingsTable
            holdings={holdings}
            selected={selected}
            onToggle={onToggle}
            onTickerChange={onTickerChange}
          />
        </section>

        <section className="mb-6">
          <AssetTable assets={result?.financeAssets ?? []} />
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
          <SnapshotHistory snapshots={snapshots} onDelete={handleDeleteSnapshot} />
        </section>

        <section className="mb-6">
          <PortfolioPerformanceChart snapshots={snapshots} />
        </section>

      </main>
    </div>
  );
}
