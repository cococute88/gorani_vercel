"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import PortfolioCloudSyncStatus from "./PortfolioCloudSyncStatus";
import PortfolioSyncControl from "./PortfolioSyncControl";
import {
  usePortfolioSnapshots,
  saveSnapshot,
  deleteSnapshotByIdOrDate,
  hasSnapshotDate,
  mergePortfolioSnapshots,
} from "@/lib/portfolio-store";
import { usePortfolioView } from "@/lib/use-portfolio-view";
import {
  usePortfolioFirestoreSnapshot,
  usePortfolioFirestoreSnapshotData,
  removeActiveFirestoreSnapshot,
} from "@/lib/portfolio-firestore-snapshot-sync";
import {
  markSnapshotDateDeleted,
  unmarkSnapshotDateDeleted,
  useDeletedSnapshotDates,
  hydrateDeletedSnapshotDates,
} from "@/lib/portfolio-snapshot-deletions";
import {
  markSnapshotDateHidden,
  unmarkSnapshotDateHidden,
  useHiddenSnapshotDates,
  hydrateHiddenSnapshotDates,
} from "@/lib/portfolio-snapshot-hidden";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import {
  deletePortfolioSnapshot,
  savePortfolioSnapshot,
  warnFirestoreFallback,
  loadPortfolioSnapshotState,
  addDeletedSnapshotDateToCloud,
  removeDeletedSnapshotDateFromCloud,
  addHiddenSnapshotDateToCloud,
  removeHiddenSnapshotDateFromCloud,
  recordPortfolioCloudSyncSuccess,
} from "@/lib/firebase/firestore-repositories";
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
import { getAuthoritativeTotalAssetsKRW } from "@/lib/portfolio-authoritative-total";
import ExcelUploadCard from "./ExcelUploadCard";
import PortfolioParsePreview from "./PortfolioParsePreview";
import ParseSummaryCard from "./ParseSummaryCard";
import AssetAllocationDonut from "./AssetAllocationDonut";
import HoldingsTable from "./HoldingsTable";
import AssetTable from "./AssetTable";
import SnapshotHistory from "./SnapshotHistory";
import HiddenSnapshotsModal, { type HiddenSnapshotRow } from "./HiddenSnapshotsModal";
import SnapshotBacktestSection from "./SnapshotBacktestSection";
import PortfolioAssetTrendChart from "./PortfolioAssetTrendChart";
import PortfolioQuoteStatusPanel from "./PortfolioQuoteStatusPanel";
import AccountHoldingWeightCard from "./AccountHoldingWeightCard";
import type { AccountTabKey } from "@/lib/account-holding-weights";
import CollapsibleSection from "./CollapsibleSection";
import AssetMapSection from "@/components/asset-map/AssetMapSection";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import { usePortfolioCloudSync } from "@/lib/portfolio-cloud-sync";
import { USE_FIRESTORE_CONTRACT } from "@/lib/feature-flags";
import { markPortfolioCloudSyncNow, parsePortfolioSnapshotSyncTime } from "@/lib/portfolio-cloud-sync-time";

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

  // 포트폴리오 관리 상단의 "현재 스냅샷 / 최신화 / 확인이 필요한 항목"용 데이터 공급원.
  // 투자현황 페이지와 동일하게 Firestore 최신 스냅샷을 활성 데이터로 사용한다.
  // (스냅샷 없음/오류 시 기존 로컬 데이터로 자동 fallback. 계산/뷰모델은 변경하지 않는다.)
  usePortfolioFirestoreSnapshot();
  const portfolioView = usePortfolioView();
  // 활성 Firestore 스냅샷 객체(없으면 null → 로컬로 폴백).
  // 투자현황 화면이 보는 것과 동일한 소스다(usePortfolioView 도 이 값을 읽는다).
  const firestoreSnapshot = usePortfolioFirestoreSnapshotData();

  // 사용자가 히스토리에서 삭제한 스냅샷 날짜(영구 묘비). mergedSnapshots 에서 제외해
  // 어떤 소스(localStorage/계약/오버레이)에서 다시 올라오더라도 삭제 상태를 유지한다.
  const deletedSnapshotDates = useDeletedSnapshotDates();
  // 사용자가 숨긴 스냅샷 날짜. 삭제와 달리 데이터는 보존하되 기본 조회에서만 제외한다.
  const hiddenSnapshotDates = useHiddenSnapshotDates();

  // 로그인 시 Firestore 의 숨김/삭제 상태(users/{uid}/portfolioSnapshotState/state)를 읽어
  // 로컬 미러에 합친다. 이렇게 해야 다른 브라우저/기기에서 숨기거나 삭제한 상태가 이 기기에서도
  // 동일하게 적용된다(요구사항 4·5: Firestore 기준 조회). 실패해도 로컬 상태는 그대로 유지한다.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadPortfolioSnapshotState(user.uid)
      .then((state) => {
        if (cancelled) return;
        hydrateDeletedSnapshotDates(state.deletedDates);
        hydrateHiddenSnapshotDates(state.hiddenDates);
      })
      .catch((err) => warnFirestoreFallback("portfolioSnapshotState.load", err));
    return () => {
      cancelled = true;
    };
  }, [user]);

  // 활성 Firestore 오버레이 스냅샷(상단 "현재 스냅샷" 카드 소스)의 날짜가 삭제/숨김 대상이면
  // 전용 store 를 비운다. 새 브라우저에서 온-마운트 오버레이 fetch 와 Firestore 숨김/삭제
  // 상태 hydration 의 순서가 어긋나도(레이스), hydration 이 끝나는 즉시 상단 카드가
  // localStorage 로 폴백되어 삭제/숨긴 스냅샷이 어디에도 다시 나타나지 않게 한다.
  useEffect(() => {
    const date = firestoreSnapshot?.snapshotDate;
    if (!date) return;
    if (deletedSnapshotDates.has(date) || hiddenSnapshotDates.has(date)) {
      removeActiveFirestoreSnapshot({ id: firestoreSnapshot?.id, snapshotDate: date });
    }
  }, [firestoreSnapshot, deletedSnapshotDates, hiddenSnapshotDates]);

  // 드롭다운 / 히스토리 / 미리보기가 모두 "현재 활성 스냅샷"과 같은 소스를 보도록,
  // 활성 Firestore 스냅샷을 localStorage 스냅샷과 하나의 목록으로 통합한다.
  // - 중복 제거: snapshotDate 기준(Map/Set). 동일 날짜는 현재 활성(Firestore) 스냅샷을 우선해 1개만 남긴다.
  // - 정렬: snapshotDate 최신순(내림차순).
  // 계산식/차트(추이·역산)는 이 통합 목록(mergedSnapshots)을 사용해 현재 활성
  // Firestore 스냅샷을 단일 소스로 따른다(PR #158). 단, 역산 성과 분석은 데이터
  // 소스에 관계없이 보유종목 티커를 동일하게 정규화하므로(SnapshotBacktestSection
  // 의 resolveBacktestTicker) Firestore/로컬 어느 스냅샷이든 동일 기준으로 계산된다.
  const mergedSnapshots = useMemo<PortfolioSnapshot[]>(() => {
    const merged = firestoreSnapshot
      ? mergePortfolioSnapshots(snapshots, [firestoreSnapshot])
      : snapshots;
    // 삭제 묘비/숨김 적용: 사용자가 지우거나 숨긴 날짜는 어떤 소스에서 다시 올라와도 목록에서 제외한다.
    // (계약 어댑터의 replaceSnapshots 재동기화 등 읽기 전용 소스에서의 재유입까지 방어)
    const excludedDates = deletedSnapshotDates.size === 0 && hiddenSnapshotDates.size === 0
      ? null
      : new Set<string>([...Array.from(deletedSnapshotDates), ...Array.from(hiddenSnapshotDates)]);
    const withoutDeleted =
      excludedDates === null
        ? merged
        : merged.filter((snapshot) => !excludedDates.has(snapshot.snapshotDate));
    return [...withoutDeleted].sort((a, b) => (a.snapshotDate < b.snapshotDate ? 1 : -1));
  }, [firestoreSnapshot, snapshots, deletedSnapshotDates, hiddenSnapshotDates]);

  // 숨긴 스냅샷 조회용 행 목록. "숨긴 날짜 보기" 모달에서 사용한다.
  // - 데이터 소스: 삭제 묘비만 적용한 통합 목록(deleted 제외, 숨김은 유지)에서 숨김 날짜만 추린다.
  //   숨기기는 데이터(문서)를 지우지 않고 cloud sync 가 모든 스냅샷을 localStorage 로 적재하므로,
  //   숨긴 스냅샷의 총자산/평가금액/원금/수익률을 어느 브라우저에서나 그대로 표시할 수 있다.
  // - Firestore 의 hiddenDates(loadPortfolioSnapshotState → hydrate)가 반영된 hiddenSnapshotDates 를
  //   단일 기준으로 삼으므로, 조회 역시 Firestore 와 일관된다(요구사항 4).
  // - 데이터를 찾지 못한 숨김 날짜도(희귀) 날짜만으로 행을 만들어 "숨긴 데이터를 다시 볼 수 없는"
  //   실패 상황을 방지한다(금액은 null → "-" 표시, 복구는 정상 동작).
  const hiddenSnapshotRows = useMemo<HiddenSnapshotRow[]>(() => {
    if (hiddenSnapshotDates.size === 0) return [];
    const merged = firestoreSnapshot
      ? mergePortfolioSnapshots(snapshots, [firestoreSnapshot])
      : snapshots;
    const withoutDeleted =
      deletedSnapshotDates.size === 0
        ? merged
        : merged.filter((snapshot) => !deletedSnapshotDates.has(snapshot.snapshotDate));
    const byDate = new Map<string, PortfolioSnapshot>();
    for (const snapshot of withoutDeleted) byDate.set(snapshot.snapshotDate, snapshot);
    return Array.from(hiddenSnapshotDates)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => {
        const snapshot = byDate.get(date);
        return snapshot
          ? {
              snapshotDate: date,
              totalAssetKRW: snapshot.totalAssetKRW,
              investmentValueKRW: snapshot.investmentValueKRW,
              investmentPrincipalKRW: snapshot.investmentPrincipalKRW,
              returnPct: snapshot.returnPct,
            }
          : {
              snapshotDate: date,
              totalAssetKRW: null,
              investmentValueKRW: null,
              investmentPrincipalKRW: null,
              returnPct: null,
            };
      });
  }, [firestoreSnapshot, snapshots, deletedSnapshotDates, hiddenSnapshotDates]);

  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  // 사용자가 "미리보기"를 명시적으로 요청한 스냅샷 id.
  // - null               → 미리보기 요청 없음(최초 진입/미리보기 닫힘). 미리보기 영역을 표시하지 않는다.
  // - 최신/과거 구분 없이  → 사용자가 직접 고른 스냅샷 id. 최신 스냅샷이라도 null 로 접지 않는다.
  // "현재 선택된 스냅샷"(하이라이트/드롭다운 표시값)은 아래 selectedSnapshotId/Date 로 따로 파생하며,
  // 최신 스냅샷으로 기본 폴백한다. 즉 "선택 상태"와 "미리보기 표시 여부"를 분리한다(요구사항 6).
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null);
  // 계좌별 종목 비중 카드와 역산 성과 분석이 공유하는 계좌 필터 상태.
  const [accountTab, setAccountTab] = useState<AccountTabKey>("전체");
  const [tickerMapNotice, setTickerMapNotice] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  // "숨긴 날짜 보기" 모달 표시 여부.
  const [hiddenModalOpen, setHiddenModalOpen] = useState(false);
  // 숨기기/복구 후 잠깐 떠 있는 안내 토스트. message 와 함께 안내 텍스트를 보여준다.
  // (앱에 별도 토스트 라이브러리가 없어 가벼운 인라인 토스트를 둔다.)
  const [snapshotToast, setSnapshotToast] = useState<{ tone: "info" | "success"; text: string } | null>(null);

  // 숨기기/복구 안내 토스트 자동 닫힘(약 6초). 새 토스트가 뜨면 타이머를 갱신한다.
  useEffect(() => {
    if (!snapshotToast) return;
    const timer = window.setTimeout(() => setSnapshotToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [snapshotToast]);

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
    // 같은 날짜를 다시 등록하면 이전 삭제 묘비/숨김을 해제해 목록에 정상적으로 다시 보이게 한다.
    unmarkSnapshotDateDeleted(snap.snapshotDate);
    unmarkSnapshotDateHidden(snap.snapshotDate);
    // 로그인 상태면 Firestore 의 숨김/삭제 상태에서도 이 날짜를 제거해 모든 기기에서 다시 보이게 한다.
    if (user) {
      void removeDeletedSnapshotDateFromCloud(user.uid, snap.snapshotDate).catch((err) =>
        warnFirestoreFallback("portfolioSnapshotState.undelete", err),
      );
      void removeHiddenSnapshotDateFromCloud(user.uid, snap.snapshotDate).catch((err) =>
        warnFirestoreFallback("portfolioSnapshotState.unhide", err),
      );
    }
    if (user && !USE_FIRESTORE_CONTRACT) {
      try {
        const metadata = await savePortfolioSnapshot(user.uid, snap);
        // Firestore metadata(status.lastSyncedAt)가 SSOT이며 localStorage는 즉시 렌더링용 캐시다.
        markPortfolioCloudSyncNow(metadata.lastSyncedAtMs ?? Date.now());
      } catch (err) {
        warnFirestoreFallback("portfolioSnapshots.save", err);
      }
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    // 1) 삭제 대상 행을 통합 목록에서 찾아 날짜와 동일 날짜의 localStorage 원본 id 를 확보한다.
    //    (병합 목록은 동일 날짜일 때 Firestore 오버레이의 id(=날짜)를 표시할 수 있어,
    //     넘어온 id 가 localStorage 의 실제 id(`snap-...`)와 다를 수 있으므로 날짜가 필요하다.)
    const target = mergedSnapshots.find((snapshot) => snapshot.id === id) ?? null;
    const snapshotDate = target?.snapshotDate ?? null;
    const localTwins = snapshots.filter(
      (snapshot) => snapshot.id === id || (snapshotDate != null && snapshot.snapshotDate === snapshotDate),
    );

    // 2) 삭제 대상이 현재 미리보기 중이면 미리보기를 닫는다(id 또는 날짜 기준).
    const previewedDate = previewSnapshotId
      ? mergedSnapshots.find((snapshot) => snapshot.id === previewSnapshotId)?.snapshotDate ?? null
      : null;
    if (
      previewSnapshotId === id ||
      (snapshotDate != null && previewedDate === snapshotDate)
    ) {
      setPreviewSnapshotId(null);
    }

    // 3) 영구 묘비에 날짜를 기록 → 새로고침/재진입 후에도(읽기 전용 오버레이·계약 재유입 포함) 삭제 유지.
    if (snapshotDate != null) markSnapshotDateDeleted(snapshotDate);

    // 4) localStorage 스냅샷을 id 와 날짜 양쪽으로 제거(즉시 목록 갱신).
    deleteSnapshotByIdOrDate(id, snapshotDate);

    // 5) 활성 Firestore 오버레이 스냅샷이 이 행이면 전용 store 를 비워 즉시 UI 갱신
    //    (상단 총자산/보유종목 카드는 localStorage 로 폴백). ← "클릭해도 무반응" 핵심 해결.
    removeActiveFirestoreSnapshot({ id, snapshotDate });

    // 6) 클라우드 영구 반영. 로그인 상태면:
    //    (a) 쓰기 가능 컬렉션 users/{uid}/portfolioSnapshots 의 실제 문서를 삭제하고,
    //    (b) 삭제 묘비 날짜를 Firestore(portfolioSnapshotState.deletedDates)에 기록한다.
    //    (b)는 읽기 전용 파이프라인 오버레이(portfolio_snapshots, 클라이언트가 못 지움)가
    //    다른 브라우저/기기에서 다시 내려와도 게시 단계에서 걸러지도록 하는 핵심이다
    //    → 어떤 브라우저에서도 삭제 후 다시 나타나지 않는다(요구사항 4-3·5).
    //    오버레이 행은 넘어온 id 가 날짜일 수 있으므로 localStorage 원본 id 들도 함께 지운다.
    if (user) {
      const idsToDelete = new Set<string>([id, ...localTwins.map((snapshot) => snapshot.id)]);
      try {
        await Promise.all([
          ...Array.from(idsToDelete).map((snapshotId) => deletePortfolioSnapshot(user.uid, snapshotId)),
          ...(snapshotDate != null ? [addDeletedSnapshotDateToCloud(user.uid, snapshotDate)] : []),
        ]);
        // Firestore 삭제 성공도 클라우드 반영(동기화)이므로 metadata를 갱신한다.
        const metadata = await recordPortfolioCloudSyncSuccess(user.uid);
        markPortfolioCloudSyncNow(metadata.lastSyncedAtMs ?? Date.now());
      } catch (err) {
        warnFirestoreFallback("portfolioSnapshots.delete", err);
      }
    }
  };

  // 숨기기: 데이터(문서)는 보존하고 기본 조회에서만 제외한다. 숨김 상태는 Firestore 에 저장되어
  // 같은 계정의 모든 브라우저/기기에서 동일하게 유지된다(요구사항 4-2). 삭제와 달리 묘비/문서
  // 삭제는 하지 않으므로, 같은 날짜를 다시 등록하거나 향후 숨김 해제 시 데이터가 그대로 돌아온다.
  const handleHideSnapshot = async (id: string) => {
    const target = mergedSnapshots.find((snapshot) => snapshot.id === id) ?? null;
    const snapshotDate = target?.snapshotDate ?? null;
    if (snapshotDate == null) return;

    // 숨기는 스냅샷을 미리보기 중이면 미리보기를 닫는다.
    const previewedDate = previewSnapshotId
      ? mergedSnapshots.find((snapshot) => snapshot.id === previewSnapshotId)?.snapshotDate ?? null
      : null;
    if (previewSnapshotId === id || previewedDate === snapshotDate) {
      setPreviewSnapshotId(null);
    }

    // 로컬 즉시 반영(목록에서 제거) + 활성 오버레이가 이 행이면 비워 상단 카드도 폴백.
    markSnapshotDateHidden(snapshotDate);
    removeActiveFirestoreSnapshot({ id, snapshotDate });

    // 사용자에게 "숨김 = 복구 가능"임을 즉시 알려, 우측 상단에서 다시 꺼낼 수 있음을 안내한다(요구사항 5).
    setSnapshotToast({
      tone: "info",
      text: `${snapshotDate} 스냅샷이 숨김 처리되었습니다. 우측 상단의 "숨긴 날짜 보기"에서 언제든 복구할 수 있습니다.`,
    });

    // Firestore 영구 반영(다른 기기에서도 숨김 유지).
    if (user) {
      try {
        await addHiddenSnapshotDateToCloud(user.uid, snapshotDate);
        const metadata = await recordPortfolioCloudSyncSuccess(user.uid);
        markPortfolioCloudSyncNow(metadata.lastSyncedAtMs ?? Date.now());
      } catch (err) {
        warnFirestoreFallback("portfolioSnapshotState.hide", err);
      }
    }
  };

  // 복구: 숨김 상태를 해제해 등록된 스냅샷 히스토리 메인 목록에 즉시 다시 표시한다. 삭제와 달리
  // 데이터를 건드리지 않고 숨김 플래그만 false 로 되돌린다. 로컬 미러를 먼저 갱신해(즉시 반영)
  // 모달/목록이 바로 업데이트되고, Firestore(hiddenDates)에서도 날짜를 제거해 새로고침/다른
  // 브라우저에서도 복구 상태가 일관되게 유지된다(요구사항 3·4).
  const handleRestoreSnapshot = async (snapshotDate: string) => {
    if (!snapshotDate) return;
    unmarkSnapshotDateHidden(snapshotDate);
    setSnapshotToast({
      tone: "success",
      text: `${snapshotDate} 스냅샷을 복구했습니다. 등록된 스냅샷 히스토리에 다시 표시됩니다.`,
    });
    if (user) {
      try {
        await removeHiddenSnapshotDateFromCloud(user.uid, snapshotDate);
        const metadata = await recordPortfolioCloudSyncSuccess(user.uid);
        markPortfolioCloudSyncNow(metadata.lastSyncedAtMs ?? Date.now());
      } catch (err) {
        warnFirestoreFallback("portfolioSnapshotState.unhide", err);
      }
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
    () => mergedSnapshots.find((snapshot) => snapshot.id === previewSnapshotId) ?? null,
    [previewSnapshotId, mergedSnapshots],
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

  // 우측 상단 클라우드 동기화 상태(PortfolioCloudSyncStatus)로 이동한 "Firestore에 저장돼요" 안내는 제거하고,
  // 저장 모드/동기화 진행·실패 안내만 필요한 경우에만 노출한다.
  const portfolioNotice = [
    user
      ? ""
      : configured
        ? "로그아웃 상태에서는 이 브라우저에만 임시 저장돼요."
        : "Firebase 설정이 없어 로컬 미리보기 모드로 동작합니다.",
    syncState.status === "syncing" || authLoading ? "로그인/클라우드 스냅샷을 확인 중입니다." : "",
    syncState.status === "failed" ? "동기화 실패: 로컬 저장은 유지됩니다." : "",
  ]
    .filter(Boolean)
    .join(" ");

  // 최신 등록 스냅샷 (파싱 preview 가 없을 때 자산군 도넛의 기준).
  // 통합 목록(mergedSnapshots) 기준이므로 현재 활성 Firestore 스냅샷이 곧 최신으로 잡힌다.
  const latestSnapshot = useMemo(
    () =>
      mergedSnapshots.length > 0
        ? mergedSnapshots.reduce((latest, item) =>
            item.snapshotDate >= latest.snapshotDate ? item : latest,
          )
        : null,
    [mergedSnapshots],
  );

  // 상단 3-카드 도넛 기준: 스냅샷 미리보기 > 파싱 preview > 최신 스냅샷 > empty.
  // (요구사항 4: 선택된 스냅샷이 모든 차트의 유일한 데이터 소스 — 자산맵 도넛도 미리보기를 따른다.)
  const donutSnapshot = previewSnapshot ?? (result ? null : latestSnapshot);
  const donutHoldings = previewSnapshot
    ? displayedHoldings
    : result
      ? holdings
      : latestSnapshot?.holdings ?? [];
  const donutFinanceAssets = previewSnapshot
    ? previewSnapshot.financeAssets ?? []
    : result
      ? result.financeAssets ?? []
      : latestSnapshot?.financeAssets ?? [];
  // 권위 현금 합계(있으면)로 자산군 도넛 총자산을 단일 기준에 reconcile 한다.
  const donutAuthoritativeCashKRW = donutSnapshot?.authoritativeTotals?.totalCashKRW ?? null;
  // 모든 차트가 공유하는 단일 총자산 기준(권위 total_assets_krw).
  const donutAuthoritativeTotalAssetsKRW = getAuthoritativeTotalAssetsKRW(donutSnapshot);
  const donutEmptyMessage = result
    ? "평가금액이 있는 항목이 없어 자산군 비중을 표시할 수 없습니다."
    : "엑셀을 업로드하면 자산군 비중이 표시됩니다.";

  // 계좌별 종목 비중 카드 기준 보유종목: 미리보기 > 현재 파싱 결과 > 최신 스냅샷.
  const accountWeightHoldings = previewSnapshot
    ? displayedHoldings
    : result
      ? holdings
      : latestSnapshot?.holdings ?? [];

  // 상단 스냅샷 컨트롤용 값.
  // 활성(현재) 스냅샷 날짜는 투자현황과 동일하게 portfolioView 기준으로 잡는다.
  const activeSnapshotDate = portfolioView.snapshot?.snapshotDate ?? null;
  // "최근 클라우드 동기화" 시각의 서버 권위 소스: 현재 활성 Firestore 스냅샷이 실제로
  // 생성/저장된 서버 시각(generated_at → createdAt). 이 값이 있으면 브라우저 로컬
  // Date.now() 대신 이 시각을 표시해 모든 기기에서 동일하고, 새로고침/최신화 후에도
  // 실제 저장 시점과 항상 일치한다. Firestore 스냅샷이 없을 때만 localStorage 로 폴백한다.
  const serverSyncedAtMs = useMemo(
    () => (firestoreSnapshot ? parsePortfolioSnapshotSyncTime(firestoreSnapshot.createdAt) : null),
    [firestoreSnapshot],
  );
  // 드롭다운 항목: 통합 스냅샷 목록(mergedSnapshots)의 날짜(최신 우선). 하단 히스토리와 동일한
  // source 를 사용하므로 두 UI가 항상 같은 날짜 집합 — 그리고 현재 활성 Firestore 스냅샷 — 을
  // 가리킨다. 중복 날짜는 Set 으로 제거하고 최신순(내림차순)으로 정렬한다. 스냅샷이 누적되면 이
  // 목록만 늘어나고 UI(스크롤/더보기)는 그대로 동작한다(확장 가능 구조, 하드코딩 없음 — 요구사항 10).
  // 통합 목록이 비어 있고 활성 날짜만 있는 극단적 상황에서만 활성 날짜로 폴백한다.
  const snapshotDates = useMemo(() => {
    const set = new Set<string>();
    mergedSnapshots.forEach((snapshot) => set.add(snapshot.snapshotDate));
    const dates = Array.from(set).sort((a, b) => (a < b ? 1 : -1));
    if (dates.length === 0) {
      return activeSnapshotDate ? [activeSnapshotDate] : [];
    }
    return dates;
  }, [activeSnapshotDate, mergedSnapshots]);

  // TEMP DEBUG (gated by ?debugSnap): prints the exact runtime values used to
  // build the dropdown / history so we can confirm the Firestore snapshot
  // actually lands in mergedSnapshots. Removed before final commit.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("debugSnap")) return;
    /* eslint-disable no-console */
    console.log("[debugSnap] localStorage snapshots:", JSON.stringify(snapshots.map((s) => s.snapshotDate)));
    console.log("[debugSnap] firestoreSnapshot:", firestoreSnapshot ? `${firestoreSnapshot.snapshotDate}#${firestoreSnapshot.id}` : "null");
    console.log("[debugSnap] activeSnapshotDate:", activeSnapshotDate);
    console.log("[debugSnap] mergedSnapshots:", JSON.stringify(mergedSnapshots.map((s) => `${s.snapshotDate}#${s.id}`)));
    console.log("[debugSnap] snapshotDates:", JSON.stringify(snapshotDates));
    /* eslint-enable no-console */
  }, [snapshots, firestoreSnapshot, activeSnapshotDate, mergedSnapshots, snapshotDates]);

  // 상단 드롭다운과 하단 히스토리가 공유하는 "현재 선택된 스냅샷"(하이라이트/표시값) 기준.
  // 미리보기 요청 여부(previewSnapshotId)와 별개로, 선택 표시는 항상 어떤 스냅샷을 가리킨다:
  // 명시적으로 고른 스냅샷이 있으면 그것을, 없으면 최신 스냅샷으로 폴백한다.
  // → 최초 진입 시에도 드롭다운/하이라이트는 최신을 가리키지만, 미리보기 영역은 열리지 않는다.
  const selectedSnapshotId = previewSnapshotId ?? latestSnapshot?.id ?? null;
  const selectedSnapshotDate =
    previewSnapshot?.snapshotDate ?? latestSnapshot?.snapshotDate ?? activeSnapshotDate;

  // 날짜(YYYY-MM-DD) 기반 선택을 미리보기 요청으로 매핑한다.
  // 최신/과거 구분 없이 사용자가 직접 고른 스냅샷은 그대로 미리보기 대상으로 설정한다.
  // (예전에는 최신 날짜를 null 로 접어 미리보기를 숨겼지만, 이제는 최신도 동일하게 미리보기를 연다.)
  const handleSelectSnapshotDate = useCallback(
    (date: string) => {
      const target = mergedSnapshots.find((snapshot) => snapshot.snapshotDate === date);
      if (!target) return;
      setPreviewSnapshotId(target.id);
    },
    [mergedSnapshots],
  );

  // 하단 히스토리에서 행을 선택할 때도 동일한 매핑을 사용해 두 UI를 동기화한다.
  // 최신 스냅샷 행을 눌러도 과거 스냅샷과 똑같이 미리보기를 표시한다.
  const handleSelectSnapshot = useCallback(
    (snapshot: PortfolioSnapshot) => {
      setPreviewSnapshotId(snapshot.id);
    },
    [],
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-slate-800 dark:bg-[#111516] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto w-full min-w-0 max-w-[1640px] overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[20px] font-extrabold text-slate-900 dark:text-white">포트폴리오 관리</h1>
          <PortfolioCloudSyncStatus serverSyncedAtMs={serverSyncedAtMs} />
        </div>

        {/* 데이터 관리 영역: 현재 스냅샷 선택 + 최신화.
            (투자현황 페이지에서 이곳으로 이동 — 조회/관리 역할 분리) */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-[#273032] dark:bg-[#171d1e]">
          <PortfolioSyncControl
            snapshotDates={snapshotDates}
            snapshotDate={selectedSnapshotDate}
            onSelectSnapshotDate={handleSelectSnapshotDate}
            theme={theme}
          />
        </div>

        {/* 스냅샷 미리보기 — 상단 스냅샷 선택/최신화 바로 아래에 자산군 비중 도넛 +
            파싱 결과 요약을 표시한다. (현재 스냅샷 선택 → 자산군 비중 → 파싱 결과 요약 흐름) */}
        {previewSnapshot && (
          <section className="mb-6">
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
            {/* desktop(lg+) 2열로 나란히, mobile 에서는 세로 stack. */}
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
              <div className="w-full min-w-0">
                <AssetAllocationDonut
                  holdings={displayedHoldings}
                  financeAssets={previewSnapshot.financeAssets ?? []}
                  theme="dark"
                  title={`자산군 비중 · ${previewSnapshot.snapshotDate} 기준`}
                  emptyMessage="이 스냅샷에는 표시할 자산군 비중이 없습니다."
                  authoritativeCashKRW={previewSnapshot.authoritativeTotals?.totalCashKRW ?? null}
                  authoritativeTotalAssetsKRW={getAuthoritativeTotalAssetsKRW(previewSnapshot)}
                />
              </div>
              <div className="w-full min-w-0">
                <ParseSummaryCard model={parseSummaryFromSnapshot(previewSnapshot)} />
              </div>
            </div>
          </section>
        )}

        {portfolioNotice && (
          <p className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-500 dark:border-[#273032] dark:bg-[#171d1e] dark:text-slate-400">
            {portfolioNotice}
          </p>
        )}

        {/* 1) 최상단 2열: [계좌별 종목 비중 조회 40%] [월별 자산 추이 60%]
            데스크톱(lg+)은 2:3(=40:60) 비율, 모바일은 세로 배치. */}
        <section className="mb-6 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[2fr_3fr]">
          <div className="min-w-0">
            <AccountHoldingWeightCard
              holdings={accountWeightHoldings}
              tab={accountTab}
              onTabChange={setAccountTab}
            />
          </div>
          <div className="min-w-0">
            <PortfolioAssetTrendChart snapshots={mergedSnapshots} />
          </div>
        </section>

        {/* 2년 역산 성과 분석 — 선택된(없으면 최신) 스냅샷 비중 기준 역산.
            드롭다운/히스토리와 동일한 통합 목록(mergedSnapshots)을 사용해 현재 활성
            Firestore 스냅샷을 단일 소스로 따른다 (localStorage 전용 목록 혼입 제거). */}
        <SnapshotBacktestSection
          snapshots={mergedSnapshots}
          selectedSnapshotId={previewSnapshotId}
          accountTab={accountTab}
        />

        {/* 3) 자산맵 — 좌측 컬럼에 "자산군 비중" 도넛(기존 최하단 카드)을 이동 배치한다. */}
        <AssetMapSection
          holdings={donutHoldings}
          assetClassDonut={
            <AssetAllocationDonut
              holdings={donutHoldings}
              financeAssets={donutFinanceAssets}
              theme="dark"
              title="자산군 비중"
              emptyMessage={donutEmptyMessage}
              size={150}
              className=""
              authoritativeCashKRW={donutAuthoritativeCashKRW}
              authoritativeTotalAssetsKRW={donutAuthoritativeTotalAssetsKRW}
            />
          }
        />

        {/* 4) 스냅샷 생성 워크플로우(엑셀 업로드 / 파싱 결과 / 등록) — 기능 유지. */}
        <section className="mb-6 mt-6 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
          <ExcelUploadCard
            files={files}
            onAddFiles={(fs) => setFiles((prev) => [...prev, ...fs])}
            onRemoveFile={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
            onParse={handleParse}
            onLoadMock={handleLoadMock}
            parsing={parsing}
          />
          <div className="h-full">
            <PortfolioParsePreview result={result} />
          </div>
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

        {/* 4.5) 등록된 스냅샷 히스토리 — 드롭다운과 동일한 통합 목록(mergedSnapshots)을 사용해
            현재 활성 Firestore 스냅샷도 항상 포함된다. */}
        <section className="mb-6">
          <SnapshotHistory
            snapshots={mergedSnapshots}
            onDelete={handleDeleteSnapshot}
            onHide={handleHideSnapshot}
            onSelect={handleSelectSnapshot}
            selectedSnapshotId={selectedSnapshotId}
            loading={authLoading || syncState.status === "syncing"}
            onOpenHidden={() => setHiddenModalOpen(true)}
            hiddenCount={hiddenSnapshotRows.length}
          />
        </section>

        {/* 5) 보유 종목 리스트 (기본 접힘) */}
        <section className="mb-6">
          <CollapsibleSection title="보유 종목 리스트">
            <div className="space-y-4">
              <PortfolioQuoteStatusPanel holdings={displayedHoldings} />
              <HoldingsTable
                holdings={displayedHoldings}
                selected={displayedSelected}
                onToggle={previewSnapshot ? () => undefined : onToggle}
                onTickerChange={previewSnapshot ? () => undefined : onTickerChange}
                readOnly={Boolean(previewSnapshot)}
                tickerMapNotice={previewSnapshot ? null : tickerMapNotice}
                bare
              />
            </div>
          </CollapsibleSection>
        </section>

        {/* 6) 자산 리스트 (기본 접힘) */}
        <section className="mb-6">
          <CollapsibleSection title="자산 리스트">
            <AssetTable assets={displayedAssets} bare />
          </CollapsibleSection>
        </section>

        {/* 숨긴 날짜 보기 모달 — 숨김 처리된 스냅샷만 조회/복구한다(Firestore 기준). */}
        <HiddenSnapshotsModal
          open={hiddenModalOpen}
          onClose={() => setHiddenModalOpen(false)}
          rows={hiddenSnapshotRows}
          onRestore={handleRestoreSnapshot}
        />
      </main>

      {/* 숨기기/복구 안내 토스트 — 화면 하단 중앙에 잠깐 떠 자동으로 사라진다.
          숨김이 "삭제"가 아니라 복구 가능한 임시 비표시임을 사용자가 즉시 인지하도록 안내한다. */}
      {snapshotToast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[130] flex justify-center px-4">
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex max-w-[520px] items-start gap-3 rounded-xl border px-4 py-3 text-[13px] shadow-2xl backdrop-blur ${
              snapshotToast.tone === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/80 dark:text-emerald-100"
                : "border-amber-200 bg-amber-50/95 text-slate-800 dark:border-amber-500/30 dark:bg-[#1c2426]/90 dark:text-slate-100"
            }`}
          >
            <span className="break-keep leading-5">{snapshotToast.text}</span>
            {snapshotToast.tone === "info" && (
              <button
                type="button"
                onClick={() => {
                  setSnapshotToast(null);
                  setHiddenModalOpen(true);
                }}
                className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-[12px] font-semibold text-amber-800 transition-colors hover:bg-amber-200 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25"
              >
                보기
              </button>
            )}
            <button
              type="button"
              onClick={() => setSnapshotToast(null)}
              aria-label="알림 닫기"
              className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
