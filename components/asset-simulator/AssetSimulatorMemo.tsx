"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NotebookPen, Plus, Save, History, Search, X } from "lucide-react";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import {
  loadAssetSimulatorMemo,
  loadAssetSimulatorMemos,
  saveAssetSimulatorMemoItem,
  warnFirestoreFallback,
} from "@/lib/firebase/firestore-repositories";
import {
  MEMO_MAX_CONTENT_LENGTH,
  MEMO_MAX_TITLE_LENGTH,
  createNewMemo,
  deriveMemoTitle,
  memoFromLegacyText,
  mergeMemos,
  readLocalMemos,
  searchMemos,
  sortMemosByRecent,
  writeLocalMemos,
  type AssetMemo,
} from "@/lib/asset-simulator-memos";

// 자산 시뮬레이터 상단 개인 "메모 관리".
// - 여러 개의 메모를 제목/내용/작성일/수정일과 함께 저장한다.
// - 우측 상단 작은 아이콘 툴바: ➕ 새 메모 · 💾 저장 · 🕒 과거 메모.
// - 자동 저장(로컬 즉시 + 클라우드 디바운스) 유지, 수동 저장 버튼 추가.
// - 과거 메모 모달에서 제목/내용 포함 단어 검색(대소문자 무관) + 최신순 목록.
// - 로그인 시 Firebase(users/{uid}/assetSimulatorMemos/{id})에 사용자별 저장되어
//   다른 기기/새로고침 후에도 동일하게 표시된다. 비로그인 시 브라우저 로컬에만 저장.
// - 기존 단일 메모(assetSimulatorMemo/default)는 자동 마이그레이션하며 원본은 보존한다.

const CLOUD_SAVE_DEBOUNCE_MS = 800;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

type SaveStatus = "idle" | "saving" | "saved" | "error";

function formatMemoDate(ms: number): string {
  try {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export default function AssetSimulatorMemo() {
  const { user, configured } = useFirebaseAuth();
  const [memos, setMemos] = useState<AssetMemo[]>([]);
  const [activeId, setActiveId] = useState<string>(() => createNewMemo().id);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  // 마지막으로 저장된 편집 필드 스냅샷(변경사항 여부 계산용).
  const [baseline, setBaseline] = useState<{ title: string; content: string }>({ title: "", content: "" });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 사용자가 편집을 시작했는지. 클라우드 로드가 편집 중 내용을 덮어쓰지 않도록 가드.
  const editedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  const dirty = title !== baseline.title || content !== baseline.content;
  const hasSomething = content.trim().length > 0 || title.trim().length > 0;

  // 편집기를 목록의 특정 메모(없으면 최신) 또는 빈 새 메모로 초기화한다.
  const hydrateFromList = useCallback((list: AssetMemo[]) => {
    const sorted = sortMemosByRecent(list);
    if (sorted.length > 0) {
      const top = sorted[0];
      setActiveId(top.id);
      setTitle(top.title);
      setContent(top.content);
      setBaseline({ title: top.title, content: top.content });
    } else {
      const fresh = createNewMemo();
      setActiveId(fresh.id);
      setTitle("");
      setContent("");
      setBaseline({ title: "", content: "" });
    }
  }, []);

  // 마운트/사용자 변경 시: 로컬 즉시 표시 → (로그인) 클라우드 로드로 권위 값 병합.
  useEffect(() => {
    const local = readLocalMemos(); // 신규 목록 없으면 레거시 단일 메모 자동 마이그레이션 포함.
    setMemos(local);
    if (!editedRef.current) hydrateFromList(local);

    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const cloud = await loadAssetSimulatorMemos(user.uid);
        if (cancelled) return;

        let merged: AssetMemo[];
        if (cloud.length === 0) {
          // 클라우드가 비어 있으면 레거시 단일 메모 + 로컬 메모를 최초 1회 업로드.
          let seed = local;
          try {
            const legacy = await loadAssetSimulatorMemo(user.uid);
            if (!cancelled && legacy && typeof legacy.text === "string" && legacy.text.trim()) {
              seed = mergeMemos(seed, [memoFromLegacyText(legacy.text)]);
            }
          } catch (err) {
            warnFirestoreFallback("assetSimulatorMemos.legacyLoad", err);
          }
          merged = seed;
          for (const memo of merged) {
            void saveAssetSimulatorMemoItem(user.uid, memo).catch((err) =>
              warnFirestoreFallback("assetSimulatorMemos.migrate", err),
            );
          }
        } else {
          merged = mergeMemos(local, cloud);
          // 로컬 전용이거나 로컬이 더 최신인 메모를 클라우드로 밀어 올린다.
          for (const memo of merged) {
            const remote = cloud.find((c) => c.id === memo.id);
            if (!remote || memo.updatedAt > remote.updatedAt) {
              void saveAssetSimulatorMemoItem(user.uid, memo).catch((err) =>
                warnFirestoreFallback("assetSimulatorMemos.sync", err),
              );
            }
          }
        }

        if (cancelled) return;
        setMemos(merged);
        writeLocalMemos(merged);
        // 편집 중이 아니고 과거 메모 모달이 닫혀 있으면 최신 값으로 반영.
        if (!editedRef.current && !historyOpen) hydrateFromList(merged);
      } catch (err) {
        warnFirestoreFallback("assetSimulatorMemos.load", err);
      }
    })();

    return () => {
      cancelled = true;
    };
    // user 변경(로그인/로그아웃/계정 전환) 시 다시 로드한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, hydrateFromList]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  // 편집기 값을 목록/로컬/클라우드에 반영한다. 빈 초안은 저장하지 않는다.
  const commit = useCallback(
    (id: string, rawTitle: string, rawContent: string) => {
      clearTimer();
      if (!rawContent.trim() && !rawTitle.trim()) {
        // 빈 초안: 저장할 것이 없으므로 상태만 idle 로.
        setStatus("idle");
        return;
      }
      const now = Date.now();
      const finalTitle = deriveMemoTitle(rawContent, rawTitle);

      let savedMemo: AssetMemo | null = null;
      setMemos((prev) => {
        const existing = prev.find((m) => m.id === id);
        const memo: AssetMemo = existing
          ? { ...existing, title: finalTitle, content: rawContent, updatedAt: now }
          : { id, title: finalTitle, content: rawContent, createdAt: now, updatedAt: now };
        savedMemo = memo;
        const next = sortMemosByRecent([...prev.filter((m) => m.id !== id), memo]);
        writeLocalMemos(next);
        return next;
      });

      setBaseline({ title: rawTitle, content: rawContent });

      if (!savedMemo) return;
      const memoToSave = savedMemo;
      if (user) {
        setStatus("saving");
        saveAssetSimulatorMemoItem(user.uid, memoToSave)
          .then(() => setStatus("saved"))
          .catch((err) => {
            warnFirestoreFallback("assetSimulatorMemos.save", err);
            setStatus("error");
          });
      } else {
        setStatus("saved");
      }
    },
    [clearTimer, user],
  );

  const scheduleAutoSave = useCallback(
    (id: string, nextTitle: string, nextContent: string) => {
      clearTimer();
      if (!nextContent.trim() && !nextTitle.trim()) {
        setStatus("idle");
        return;
      }
      setStatus("saving");
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        commit(id, nextTitle, nextContent);
      }, CLOUD_SAVE_DEBOUNCE_MS);
    },
    [clearTimer, commit],
  );

  const handleContentChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value.slice(0, MEMO_MAX_CONTENT_LENGTH);
      editedRef.current = true;
      setContent(next);
      scheduleAutoSave(activeId, title, next);
    },
    [activeId, title, scheduleAutoSave],
  );

  const handleTitleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value.slice(0, MEMO_MAX_TITLE_LENGTH);
      editedRef.current = true;
      setTitle(next);
      scheduleAutoSave(activeId, next, content);
    },
    [activeId, content, scheduleAutoSave],
  );

  // ➕ 새 메모: 현재 내용을 먼저 저장(있으면)한 뒤, 빈 새 문서를 만든다.
  const handleNew = useCallback(() => {
    commit(activeId, title, content);
    const fresh = createNewMemo();
    editedRef.current = true;
    setActiveId(fresh.id);
    setTitle("");
    setContent("");
    setBaseline({ title: "", content: "" });
    setStatus("idle");
    requestAnimationFrame(() => contentRef.current?.focus());
  }, [activeId, title, content, commit]);

  // 💾 저장: 즉시 저장.
  const handleSave = useCallback(() => {
    commit(activeId, title, content);
  }, [activeId, title, content, commit]);

  // 과거 메모에서 선택: 현재 내용을 저장한 뒤 선택 메모를 편집기로 불러온다.
  const handleSelect = useCallback(
    (memo: AssetMemo) => {
      commit(activeId, title, content);
      editedRef.current = true;
      setActiveId(memo.id);
      setTitle(memo.title);
      setContent(memo.content);
      setBaseline({ title: memo.title, content: memo.content });
      setStatus("idle");
      setHistoryOpen(false);
      setSearchQuery("");
      requestAnimationFrame(() => contentRef.current?.focus());
    },
    [activeId, title, content, commit],
  );

  const statusText =
    status === "saving"
      ? "저장 중…"
      : status === "error"
        ? "저장 실패 · 로컬 보관됨"
        : dirty
          ? "저장되지 않은 변경사항"
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
    <>
      <div className="flex w-full min-w-0 flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-[#171d1e] sm:w-80 md:w-[26rem] lg:w-[32rem]">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
            <NotebookPen size={13} strokeWidth={2.2} aria-hidden />
            메모
          </span>
          {/* 작은 아이콘 툴바: ➕ 새 메모 · 💾 저장 · 🕒 과거 메모 */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton label="새 메모" onClick={handleNew}>
              <Plus size={14} strokeWidth={2.4} aria-hidden />
            </ToolbarButton>
            <ToolbarButton
              label={dirty ? "저장 (변경사항 있음)" : "저장"}
              onClick={handleSave}
              active={dirty}
            >
              <Save size={14} strokeWidth={2.2} aria-hidden />
              {dirty && (
                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" aria-hidden />
              )}
            </ToolbarButton>
            <ToolbarButton label="과거 메모" onClick={() => setHistoryOpen(true)}>
              <History size={14} strokeWidth={2.2} aria-hidden />
            </ToolbarButton>
          </div>
        </div>

        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          maxLength={MEMO_MAX_TITLE_LENGTH}
          placeholder="제목 (미입력 시 내용 앞부분으로 자동 생성)"
          aria-label="메모 제목"
          className="mb-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12.5px] font-semibold text-slate-700 outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 focus:border-blue-400 dark:border-[#2a3336] dark:bg-[#151a1b] dark:text-slate-100 dark:placeholder:text-slate-500"
        />

        <textarea
          ref={contentRef}
          value={content}
          onChange={handleContentChange}
          rows={3}
          maxLength={MEMO_MAX_CONTENT_LENGTH}
          placeholder="투자 아이디어·체크 사항을 기록하세요."
          aria-label="자산 시뮬레이터 메모 내용"
          className="w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12.5px] leading-5 text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 dark:border-[#2a3336] dark:bg-[#151a1b] dark:text-slate-200 dark:placeholder:text-slate-500"
        />

        <div className="mt-1 flex items-center justify-between gap-2">
          <span
            className={`text-[10.5px] ${
              status === "error"
                ? "text-rose-500 dark:text-rose-400"
                : dirty
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {statusText}
          </span>
          <span className="num text-[10.5px] tabular-nums text-slate-400 dark:text-slate-500">
            {content.length}/{MEMO_MAX_CONTENT_LENGTH}
          </span>
        </div>
      </div>

      {historyOpen && (
        <MemoHistoryModal
          memos={memos}
          activeId={activeId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={handleSelect}
          onClose={() => {
            setHistoryOpen(false);
            setSearchQuery("");
          }}
        />
      )}
    </>
  );
}

function ToolbarButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`relative grid h-6 w-6 place-items-center rounded-md transition-colors ${
        active
          ? "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
          : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function MemoHistoryModal({
  memos,
  activeId,
  searchQuery,
  onSearchChange,
  onSelect,
  onClose,
}: {
  memos: AssetMemo[];
  activeId: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelect: (memo: AssetMemo) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const results = useMemo(
    () => sortMemosByRecent(searchMemos(memos, searchQuery)),
    [memos, searchQuery],
  );

  // ESC 닫기 + 배경 스크롤 잠금 + 포커스 복원.
  useEffect(() => {
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    const dialog = dialogRef.current;
    const focusables = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusables && focusables.length > 0 ? focusables[0] : dialog)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="memo-history-title"
        tabIndex={-1}
        className="relative z-[1] flex max-h-[85vh] w-full max-w-[520px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl outline-none dark:border-[#273032] dark:bg-[#171d1e]"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <h2 id="memo-history-title" className="inline-flex items-center gap-2 text-[18px] font-extrabold text-slate-900 dark:text-white">
            <History size={18} strokeWidth={2.2} aria-hidden />
            과거 메모
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X size={18} strokeWidth={2.2} aria-hidden />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search
              size={15}
              strokeWidth={2.2}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="제목·내용 검색 (예: SCHD)"
              aria-label="메모 검색"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-[13px] text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 dark:border-[#2a3336] dark:bg-[#151a1b] dark:text-slate-200 dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="검색 지우기"
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <X size={13} strokeWidth={2.4} aria-hidden />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {results.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-slate-400 dark:text-slate-500">
              {searchQuery.trim()
                ? `"${searchQuery.trim()}" 에 대한 검색 결과가 없습니다.`
                : "저장된 메모가 없습니다."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {results.map((memo) => {
                const preview = memo.content.replace(/\s+/g, " ").trim();
                const isActive = memo.id === activeId;
                return (
                  <li key={memo.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(memo)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        isActive
                          ? "border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-[#2a3336] dark:bg-[#151a1b] dark:hover:border-[#3a4548] dark:hover:bg-[#1b2223]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">
                          {memo.title || deriveMemoTitle(memo.content)}
                        </span>
                        {isActive && (
                          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                            편집 중
                          </span>
                        )}
                      </div>
                      {preview && (
                        <p className="mt-1 line-clamp-2 break-all text-[12px] leading-4 text-slate-500 dark:text-slate-400">
                          {preview}
                        </p>
                      )}
                      <div className="num mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] tabular-nums text-slate-400 dark:text-slate-500">
                        <span>작성 {formatMemoDate(memo.createdAt)}</span>
                        {memo.updatedAt > memo.createdAt && <span>수정 {formatMemoDate(memo.updatedAt)}</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
