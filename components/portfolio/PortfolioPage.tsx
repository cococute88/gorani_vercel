"use client";

import { useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import {
  usePortfolioSnapshots,
  saveSnapshot,
  deleteSnapshot,
  hasSnapshotDate,
} from "@/lib/portfolio-store";
import { parseBanksaladFile } from "@/lib/banksalad-parser";
import type { ParseResult } from "@/lib/banksalad-parser";
import { MOCK_LATEST_SNAPSHOT } from "@/lib/mock-portfolio-data";
import type { Holding, PortfolioSnapshot } from "@/lib/portfolio-types";
import ExcelUploadCard from "./ExcelUploadCard";
import PortfolioParsePreview from "./PortfolioParsePreview";
import HoldingsTable from "./HoldingsTable";
import AssetTable from "./AssetTable";
import SnapshotHistory from "./SnapshotHistory";
import PortfolioPerformanceChart from "./PortfolioPerformanceChart";
import QldAssetSummaryCard from "@/components/qld/QldAssetSummaryCard";
import QldValueFxChart from "@/components/qld/QldValueFxChart";
import QldHoldingsRankTable from "@/components/qld/QldHoldingsRankTable";

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
  };
}

function resultToSnapshot(r: ParseResult, holdings: Holding[]): PortfolioSnapshot {
  return {
    id: `snap-${r.snapshotDate}-${Date.now().toString(36)}`,
    snapshotDate: r.snapshotDate,
    sourceFileName: r.sourceFileName,
    totalAssetKRW: r.totalAssetKRW,
    totalDebtKRW: r.totalDebtKRW,
    netAssetKRW: r.netAssetKRW,
    investmentPrincipalKRW: r.investmentPrincipalKRW,
    investmentValueKRW: r.investmentValueKRW,
    returnAmountKRW: r.returnAmountKRW,
    returnPct: r.returnPct,
    holdings,
    financeAssets: r.financeAssets,
    createdAt: new Date().toISOString(),
  };
}

export default function PortfolioPage() {
  const snapshots = usePortfolioSnapshots();

  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const applyResult = (r: ParseResult) => {
    setResult(r);
    setHoldings(r.holdings);
    const sel: Record<string, boolean> = {};
    r.holdings.forEach((h) => (sel[h.id] = true));
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
      });
    } finally {
      setParsing(false);
    }
  };

  const handleLoadMock = () => applyResult(snapshotToResult(MOCK_LATEST_SNAPSHOT));

  const handleRegister = () => {
    if (!result || !result.ok) return;
    const chosen = holdings.filter((h) => selected[h.id] ?? true);
    const snap = resultToSnapshot(result, chosen);
    if (hasSnapshotDate(snap.snapshotDate)) {
      const ok = window.confirm(
        `${snap.snapshotDate} 스냅샷이 이미 있습니다. 덮어쓰시겠습니까?`,
      );
      if (!ok) return;
    }
    saveSnapshot(snap);
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
        <h1 className="mb-4 text-[20px] font-extrabold text-white">포트폴리오 관리</h1>

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
          <SnapshotHistory snapshots={snapshots} onDelete={deleteSnapshot} />
        </section>

        <section className="mb-6">
          <PortfolioPerformanceChart snapshots={snapshots} />
        </section>

        <section className="mt-8 border-t border-[#242938] pt-6">
          <div className="mb-4">
            <h2 className="text-[18px] font-extrabold text-white">QLD 평가 대시보드</h2>
            <p className="mt-1 text-[12.5px] text-slate-500">
              QLD 대시보드에서 사용하던 총 평가금액, 환율 추이, 종목 랭킹을 관리 화면 하단에서 확인합니다.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <QldAssetSummaryCard />
            <QldValueFxChart />
          </div>
          <div className="mt-4">
            <QldHoldingsRankTable />
          </div>
        </section>
      </main>
    </div>
  );
}
