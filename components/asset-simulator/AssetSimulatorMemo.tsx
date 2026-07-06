"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import {
  loadAssetSimulatorMemo,
  saveAssetSimulatorMemo,
  warnFirestoreFallback,
} from "@/lib/firebase/firestore-repositories";
import { STORAGE_KEYS } from "@/lib/storage-keys";

// 자산 시뮬레이터 상단 개인 메모.
// - 2~3줄 입력(줄바꿈 가능), 자동 저장(로컬 즉시 + 클라우드 디바운스).
// - 로그인 시 Firebase(users/{uid}/assetSimulatorMemo/default)에 사용자별로 저장되어
//   다른 기기/새로고침 후에도 동일하게 표시된다. 비로그인 시 브라우저 로컬에만 저장한다.
// - 너무 큰 메모 방지를 위해 최대 길이를 제한한다.

const MAX_MEMO_LENGTH = 500;
const CLOUD_SAVE_DEBOUNCE_MS = 800;
const STORAGE_KEY = STORAGE_KEYS.assetSimulatorMemo;

type SaveStatus = "idle" | "saving" | "saved" | "error";

function readLocalMemo(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeLocalMemo(text: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // 로컬 저장소 사용 불가 환경 방어(클라우드 저장은 별도 진행).
  }
}

export default function AssetSimulatorMemo() {
  const { user, configured } = useFirebaseAuth();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  // 사용자가 실제로 편집을 시작했는지. 클라우드 로드가 편집 중 내용을 덮어쓰지 않도록 가드.
  const editedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 마운트 시 로컬 즉시 표시 → (로그인 시) 클라우드 로드로 권위 값 반영.
  useEffect(() => {
    const local = readLocalMemo();
    if (local && !editedRef.current) setText(local);

    if (!user) return;
    let cancelled = false;
    loadAssetSimulatorMemo(user.uid)
      .then((memo) => {
        if (cancelled) return;
        if (memo && typeof memo.text === "string") {
          // 클라우드 값이 권위 소스: 편집 중이 아니면 반영하고 로컬 캐시도 맞춘다.
          if (!editedRef.current) {
            setText(memo.text);
            writeLocalMemo(memo.text);
          }
        } else if (local.trim()) {
          // 클라우드에 아직 없고 로컬에 내용이 있으면 최초 1회 마이그레이션 저장.
          void saveAssetSimulatorMemo(user.uid, local.slice(0, MAX_MEMO_LENGTH)).catch((err) =>
            warnFirestoreFallback("assetSimulatorMemo.migrate", err),
          );
        }
      })
      .catch((err) => warnFirestoreFallback("assetSimulatorMemo.load", err));

    return () => {
      cancelled = true;
    };
    // user 변경(로그인/로그아웃/계정 전환) 시 다시 로드한다.
  }, [user]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value.slice(0, MAX_MEMO_LENGTH);
      editedRef.current = true;
      setText(next);
      // 로컬은 즉시 저장(새로고침 유지 보장). 클라우드는 디바운스로 저장.
      writeLocalMemo(next);
      clearTimer();

      if (!user) {
        setStatus(configured ? "saved" : "saved");
        return;
      }
      setStatus("saving");
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        saveAssetSimulatorMemo(user.uid, next)
          .then(() => setStatus("saved"))
          .catch((err) => {
            warnFirestoreFallback("assetSimulatorMemo.save", err);
            setStatus("error");
          });
      }, CLOUD_SAVE_DEBOUNCE_MS);
    },
    [user, configured, clearTimer],
  );

  const statusText =
    status === "saving"
      ? "저장 중…"
      : status === "error"
        ? "저장 실패 · 로컬 보관됨"
        : status === "saved"
          ? user
            ? "클라우드 저장됨"
            : configured
              ? "로컬 저장됨 · 로그인 시 동기화"
              : "로컬 저장됨"
          : user
            ? "클라우드에 자동 저장"
            : "이 브라우저에 자동 저장";

  return (
    <div className="flex w-full min-w-0 flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-[#171d1e] sm:w-64 lg:w-72">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
          <NotebookPen size={13} strokeWidth={2.2} aria-hidden />
          메모
        </span>
        <span className="num text-[10.5px] tabular-nums text-slate-400 dark:text-slate-500">
          {text.length}/{MAX_MEMO_LENGTH}
        </span>
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        rows={3}
        maxLength={MAX_MEMO_LENGTH}
        placeholder="투자 아이디어·체크 사항을 기록하세요."
        aria-label="자산 시뮬레이터 메모"
        className="w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12.5px] leading-5 text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 dark:border-[#2a3336] dark:bg-[#151a1b] dark:text-slate-200 dark:placeholder:text-slate-500"
      />
      <span
        className={`mt-1 text-[10.5px] ${
          status === "error" ? "text-rose-500 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"
        }`}
      >
        {statusText}
      </span>
    </div>
  );
}
