"use client";

import { useEffect, useMemo, useState } from "react";
import { Cloud } from "lucide-react";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import { loadPortfolioSyncMetadata, warnFirestoreFallback, type PortfolioSyncMetadata } from "@/lib/firebase/firestore-repositories";
import {
  formatPortfolioCloudSyncTime,
  usePortfolioCloudSyncTime,
} from "@/lib/portfolio-cloud-sync-time";

type SnapshotSyncDebugInfo = {
  createdAt?: unknown;
  updatedAt?: unknown;
  snapshotDate?: unknown;
};

type Props = {
  className?: string;
  snapshotDebugInfo?: SnapshotSyncDebugInfo | null;
};

const EMPTY_METADATA: PortfolioSyncMetadata = {
  exists: false,
  lastSyncedAtMs: null,
  lastSyncedAtIso: null,
  updatedAtMs: null,
  updatedAtIso: null,
};

function isUsableTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function describeTimestamp(value: number | null): string | null {
  return isUsableTimestamp(value) ? new Date(value).toISOString() : null;
}

function debugValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return describeTimestamp(value) ?? value;
  return value ?? null;
}

// 포트폴리오 관리 우측 상단 클라우드 동기화 상태.
// 로그인 상태에서는 Firestore metadata(status.lastSyncedAt)만 "최근 클라우드 동기화"의
// SSOT로 표시한다. metadata 문서가 없는 최초 로그인/마이그레이션 전 상황에서만
// localStorage 캐시를 임시 fallback으로 사용한다.
export default function PortfolioCloudSyncStatus({ className = "", snapshotDebugInfo = null }: Props) {
  const { user, loading, configured } = useFirebaseAuth();
  const isLight = useResolvedTheme() === "light";
  const localSyncedAt = usePortfolioCloudSyncTime();
  const [metadata, setMetadata] = useState<PortfolioSyncMetadata>(EMPTY_METADATA);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataFailed, setMetadataFailed] = useState(false);

  useEffect(() => {
    if (!configured || loading || !user) {
      setMetadata(EMPTY_METADATA);
      setMetadataLoading(false);
      setMetadataFailed(false);
      return;
    }
    let cancelled = false;
    setMetadataLoading(true);
    setMetadataFailed(false);
    loadPortfolioSyncMetadata(user.uid)
      .then((nextMetadata) => {
        if (!cancelled) setMetadata(nextMetadata);
      })
      .catch((err) => {
        warnFirestoreFallback("portfolioSyncMetadata.load", err);
        if (!cancelled) setMetadataFailed(true);
      })
      .finally(() => {
        if (!cancelled) setMetadataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, loading, user, localSyncedAt]);

  const selection = useMemo(() => {
    if (metadata.exists) {
      return {
        source: "metadata.lastSyncedAt",
        reason: "Firestore metadata exists; lastSyncedAt is the only SSOT.",
        value: metadata.lastSyncedAtMs,
      };
    }
    return {
      source: "localStorage",
      reason: "Firestore metadata does not exist; using first-login fallback only.",
      value: localSyncedAt,
    };
  }, [localSyncedAt, metadata.exists, metadata.lastSyncedAtMs]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!configured || loading || !user) return;
    /* eslint-disable no-console */
    console.log("[Portfolio Sync]", {
      "metadata.lastSyncedAt": metadata.lastSyncedAtIso,
      "metadata.updatedAt": metadata.updatedAtIso,
      "snapshot.createdAt": debugValue(snapshotDebugInfo?.createdAt),
      "snapshot.updatedAt": debugValue(snapshotDebugInfo?.updatedAt),
      snapshotDate: debugValue(snapshotDebugInfo?.snapshotDate),
      localStorage: describeTimestamp(localSyncedAt),
      selectedSource: selection.source,
      selectedValue: describeTimestamp(selection.value),
      reason: selection.reason,
    });
    /* eslint-enable no-console */
  }, [configured, loading, localSyncedAt, metadata, selection, snapshotDebugInfo, user]);

  const pill = (tone: string, content: React.ReactNode) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${tone} ${className}`}
    >
      {content}
    </span>
  );

  if (!configured) {
    return pill(
      isLight
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-amber-400/20 bg-amber-500/10 text-amber-200",
      "Firebase 미설정 · 로컬 저장",
    );
  }
  if (loading) {
    return pill(
      isLight
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-blue-400/20 bg-blue-500/10 text-blue-200",
      "로그인 확인 중",
    );
  }
  if (!user) {
    return pill(
      isLight
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : "border-slate-500/20 bg-white/5 text-slate-300",
      "로그인 필요 · 로컬 저장",
    );
  }

  const timeText = formatPortfolioCloudSyncTime(selection.value);
  const tone = isLight
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 ${tone} ${className}`}
    >
      <Cloud size={15} strokeWidth={2.2} className="shrink-0" />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-[10.5px] font-medium opacity-80">
          {metadataLoading ? "동기화 상태 확인 중" : metadataFailed && timeText ? "마지막 성공 동기화" : `최근 클라우드 동기화${timeText ? "" : " 없음"}`}
        </span>
        {timeText && (
          <span className="num text-[12.5px] font-bold tabular-nums">{timeText}</span>
        )}
        {metadataFailed && !timeText && (
          <span className="text-[12.5px] font-bold">동기화 실패</span>
        )}
      </div>
    </div>
  );
}
