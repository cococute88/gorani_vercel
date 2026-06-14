"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TopNav from "@/components/TopNav";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import { firestoreDb } from "@/lib/firebase/client";
import {
  LEGACY_DIVIDEND_META_COLLECTION,
  buildLegacyDividendCalendarImportPlan,
  type LegacyDividendCalendarImportPlan,
} from "@/lib/legacy-dividend-calendar-import";
import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch, type Firestore, type WriteBatch } from "firebase/firestore";

type PreviewCounts = {
  newWrites: number;
  updateWrites: number;
  excludedWrites: number;
};

type ImportStatus = {
  kind: "idle" | "loading" | "success" | "error";
  message: string;
};

const BATCH_SIZE = 425;

function sanitizeForFirestore(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeForFirestore).filter((item) => item !== undefined);

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const sanitized = sanitizeForFirestore(child);
    if (sanitized !== undefined) out[key] = sanitized;
  }
  return out;
}

function getMetaDocCount(plan: LegacyDividendCalendarImportPlan): number {
  return (plan.memosDoc ? 1 : 0) + (plan.portfoliosDoc ? 1 : 0);
}

function getPlanDocIds(plan: LegacyDividendCalendarImportPlan) {
  return {
    calendarEventIds: plan.calendarEventDocs.map((event) => event.id),
    customEventIds: plan.customCalendarEvents.map((event) => event.id),
    metaIds: [plan.memosDoc ? "memos" : null, plan.portfoliosDoc ? "portfolios" : null].filter((id): id is string => Boolean(id)),
  };
}

async function loadPreviewCounts(db: Firestore, uid: string, plan: LegacyDividendCalendarImportPlan): Promise<PreviewCounts> {
  const [calendarEventSnap, customEventSnap, memosSnap, portfoliosSnap] = await Promise.all([
    getDocs(collection(db, "users", uid, "calendarEvents")),
    getDocs(collection(db, "users", uid, "calendarCustomEvents")),
    getDoc(doc(db, "users", uid, LEGACY_DIVIDEND_META_COLLECTION, "memos")),
    getDoc(doc(db, "users", uid, LEGACY_DIVIDEND_META_COLLECTION, "portfolios")),
  ]);
  const calendarEventIds = new Set(calendarEventSnap.docs.map((item) => item.id));
  const customEventIds = new Set(customEventSnap.docs.map((item) => item.id));
  const ids = getPlanDocIds(plan);

  let newWrites = 0;
  let updateWrites = 0;
  for (const id of ids.calendarEventIds) {
    if (calendarEventIds.has(id)) updateWrites += 1;
    else newWrites += 1;
  }
  for (const id of ids.customEventIds) {
    if (customEventIds.has(id)) updateWrites += 1;
    else newWrites += 1;
  }
  if (plan.memosDoc) {
    if (memosSnap.exists()) updateWrites += 1;
    else newWrites += 1;
  }
  if (plan.portfoliosDoc) {
    if (portfoliosSnap.exists()) updateWrites += 1;
    else newWrites += 1;
  }

  return {
    newWrites,
    updateWrites,
    excludedWrites: plan.stats.excludedEventCount,
  };
}

function addSetOperation(
  operations: Array<(batch: WriteBatch) => void>,
  db: Firestore,
  path: [string, string, ...string[]],
  payload: Record<string, unknown>,
) {
  operations.push((batch) => {
    batch.set(
      doc(db, ...path),
      {
        ...(sanitizeForFirestore(payload) as Record<string, unknown>),
        importedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}

async function commitImportPlan(db: Firestore, uid: string, plan: LegacyDividendCalendarImportPlan): Promise<number> {
  const operations: Array<(batch: WriteBatch) => void> = [];

  for (const event of plan.calendarEventDocs) {
    addSetOperation(operations, db, ["users", uid, "calendarEvents", event.id], event as unknown as Record<string, unknown>);
  }
  for (const event of plan.customCalendarEvents) {
    addSetOperation(operations, db, ["users", uid, "calendarCustomEvents", event.id], event as unknown as Record<string, unknown>);
  }
  if (plan.memosDoc) {
    addSetOperation(operations, db, ["users", uid, LEGACY_DIVIDEND_META_COLLECTION, "memos"], plan.memosDoc as unknown as Record<string, unknown>);
  }
  if (plan.portfoliosDoc) {
    addSetOperation(operations, db, ["users", uid, LEGACY_DIVIDEND_META_COLLECTION, "portfolios"], plan.portfoliosDoc as unknown as Record<string, unknown>);
  }

  for (let start = 0; start < operations.length; start += BATCH_SIZE) {
    const batchNumber = Math.floor(start / BATCH_SIZE) + 1;
    const batch = writeBatch(db);
    for (const op of operations.slice(start, start + BATCH_SIZE)) {
      op(batch);
    }
    try {
      await batch.commit();
    } catch (error) {
      throw new Error(`Batch ${batchNumber} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return operations.length;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 dark:border-[#2a3336] dark:bg-[#151b1d]">
      <dt className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-[18px] font-extrabold text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

export default function LegacyDividendCalendarImportPage() {
  const theme = useResolvedTheme();
  const { user, loading, configured, signInWithGoogle } = useFirebaseAuth();
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<LegacyDividendCalendarImportPlan | null>(null);
  const [parseError, setParseError] = useState("");
  const [previewCounts, setPreviewCounts] = useState<PreviewCounts | null>(null);
  const [status, setStatus] = useState<ImportStatus>({ kind: "idle", message: "" });

  const importPath = user ? `users/${user.uid}/calendarEvents` : "users/{currentUser.uid}/calendarEvents";
  const canImport = Boolean(plan && user && configured && firestoreDb && status.kind !== "loading");

  const refreshPreviewCounts = useCallback(async () => {
    if (!plan || !user || !firestoreDb) {
      setPreviewCounts(null);
      return;
    }
    try {
      const counts = await loadPreviewCounts(firestoreDb, user.uid, plan);
      setPreviewCounts(counts);
    } catch (error) {
      setPreviewCounts(null);
      setStatus({ kind: "error", message: `Preview read failed: ${error instanceof Error ? error.message : String(error)}` });
    }
  }, [plan, user]);

  useEffect(() => {
    void refreshPreviewCounts();
  }, [refreshPreviewCounts]);

  const handleFile = async (file: File | undefined) => {
    setPlan(null);
    setPreviewCounts(null);
    setParseError("");
    setStatus({ kind: "idle", message: "" });
    if (!file) return;

    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const nextPlan = buildLegacyDividendCalendarImportPlan(parsed);
      setPlan(nextPlan);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleImport = async () => {
    if (!plan || !user || !firestoreDb) return;
    setStatus({ kind: "loading", message: "Importing legacy calendar events..." });
    try {
      const count = await commitImportPlan(firestoreDb, user.uid, plan);
      setStatus({ kind: "success", message: `${count.toLocaleString()} Firestore writes completed. Same JSON can be imported again without duplicate documents.` });
      await refreshPreviewCounts();
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const stats = plan?.stats;
  const warnings = useMemo(
    () => [
      "기존 이벤트를 삭제하지 않고 legacyId 기준 deterministic 문서 ID로 병합합니다.",
      "2999-12-31 또는 2100년 이후/유효하지 않은 날짜는 캘린더에 표시하지 않습니다.",
      "JSON 파일은 브라우저에서 읽고, 가져오기 실행 버튼을 누를 때만 Firestore에 저장합니다.",
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 dark:bg-[#111516] dark:text-slate-200">
      <TopNav theme={theme} />
      <main className="mx-auto max-w-[1040px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <header className="mb-5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">CALENDAR-LEGACY-IMPORT-1</p>
          <h1 className="mt-1 text-[24px] font-extrabold text-slate-950 dark:text-white sm:text-[30px]">기존 배당캘린더 가져오기</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-slate-600 dark:text-slate-400">
            Realtime Database export JSON을 현재 로그인한 사용자의 Firestore 캘린더 문서로 병합합니다.
          </p>
        </header>

        <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-[#2a3336] dark:bg-[#151b1d]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-slate-950 dark:text-white">JSON 파일</h2>
              <p className="mt-1 break-all text-[12px] text-slate-500 dark:text-slate-400">{fileName || "legacy-dividend-calendar-export.json을 선택하세요."}</p>
            </div>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void handleFile(event.target.files?.[0])}
              className="block w-full max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-white dark:border-[#344044] dark:bg-[#101719] dark:text-slate-200 dark:file:bg-blue-600"
            />
          </div>
          {parseError && <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">{parseError}</p>}
        </section>

        <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="로그인 사용자" value={loading ? "확인 중" : user?.email ?? user?.uid ?? "로그인 필요"} />
          <Stat label="import path" value={importPath} />
          <Stat label="신규 생성 예정" value={previewCounts?.newWrites ?? "-"} />
          <Stat label="업데이트 예정" value={previewCounts?.updateWrites ?? "-"} />
        </section>

        {stats && (
          <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="총 ticker 수" value={stats.totalTickerCount} />
            <Stat label="cached event 수" value={stats.cachedEventCount} />
            <Stat label="import 대상 event 수" value={stats.importableEventCount} />
            <Stat label="제외 event 수" value={stats.excludedEventCount} />
            <Stat label="placeholder 제외" value={stats.excludedPlaceholderEventCount} />
            <Stat label="custom event 수" value={stats.customEventCount} />
            <Stat label="marks 수" value={stats.marksCount} />
            <Stat label="memos 수" value={stats.memosCount} />
            <Stat label="portfolios 수" value={stats.portfoliosCount} />
            <Stat label="중복 input dedupe" value={stats.duplicateInputEventCount} />
            <Stat label="예상 Firestore write 수" value={stats.estimatedFirestoreWriteCount} />
            <Stat label="meta 문서 수" value={getMetaDocCount(plan)} />
          </section>
        )}

        <section className="mb-4 rounded-lg border border-amber-300/50 bg-amber-50 p-4 text-[12px] leading-6 text-amber-900 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-100">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          {!configured && <p className="font-bold">Firebase 환경 변수가 없어 import를 실행할 수 없습니다.</p>}
          {!user && !loading && <p className="font-bold">로그인하지 않은 상태에서는 import가 비활성화됩니다.</p>}
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          {!user && configured && (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] font-bold text-slate-800 hover:bg-slate-50 dark:border-[#344044] dark:bg-[#151b1d] dark:text-slate-100 dark:hover:bg-[#1d2527]"
            >
              Google 로그인
            </button>
          )}
          <button
            type="button"
            disabled={!canImport}
            onClick={() => void handleImport()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-slate-100 dark:disabled:bg-slate-700"
          >
            {status.kind === "loading" ? "가져오는 중" : "가져오기 실행"}
          </button>
        </div>

        {status.message && (
          <p className={`mt-4 rounded-md border px-3 py-2 text-[12px] font-semibold ${
            status.kind === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200"
              : status.kind === "error"
                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200"
                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#2a3336] dark:bg-[#101719] dark:text-slate-300"
          }`}
          >
            {status.message}
          </p>
        )}
      </main>
    </div>
  );
}
