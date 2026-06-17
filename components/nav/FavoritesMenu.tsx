"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Pencil, Plus, Trash2, ExternalLink } from "lucide-react";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import { loadNavFavorites, saveNavFavorites, warnFirestoreFallback } from "@/lib/firebase/firestore-repositories";
import {
  DEFAULT_FAVORITES,
  createFavoriteId,
  isInternalFavoriteHref,
  isSafeFavoriteHref,
  loadLocalFavorites,
  sanitizeFavoriteItems,
  saveLocalFavorites,
  type FavoriteItem,
} from "@/lib/nav-favorites";
import { useAnchoredMenu } from "./useAnchoredMenu";

type Props = {
  isLight: boolean;
};

type DraftRow = { id: string; name: string; href: string };

export default function FavoritesMenu({ isLight }: Props) {
  const { user } = useFirebaseAuth();
  const { open, setOpen, coords, triggerRef, menuRef } = useAnchoredMenu("right", 256);
  const [favorites, setFavorites] = useState<FavoriteItem[]>(DEFAULT_FAVORITES);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 로그인/비로그인 모두 load: Firestore 우선, 없으면 localStorage, 둘 다 없으면 기본 seed.
  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const local = loadLocalFavorites();
      let resolved: FavoriteItem[] | null = null;

      if (user) {
        try {
          const cloud = await loadNavFavorites(user.uid);
          if (cloud && cloud.length > 0) {
            resolved = sanitizeFavoriteItems(cloud);
            saveLocalFavorites(resolved);
          }
        } catch (err) {
          warnFirestoreFallback("navFavorites.load", err);
        }
      }

      if (!resolved) resolved = local && local.length > 0 ? local : DEFAULT_FAVORITES;
      if (active) setFavorites(resolved);
    };
    void hydrate();
    return () => {
      active = false;
    };
  }, [user]);

  const openEditor = () => {
    setDraft(favorites.map((item) => ({ id: item.id, name: item.name, href: item.href })));
    setError(null);
    setOpen(false);
    setEditOpen(true);
  };

  const addRow = () => setDraft((rows) => [...rows, { id: createFavoriteId(), name: "", href: "" }]);
  const removeRow = (id: string) => setDraft((rows) => rows.filter((row) => row.id !== id));
  const updateRow = (id: string, key: "name" | "href", value: string) =>
    setDraft((rows) => rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));

  const handleSave = async () => {
    // 위험 URL(javascript: 등) · 빈 항목은 sanitize 단계에서 자동 제외된다.
    const sanitized = sanitizeFavoriteItems(draft);
    setFavorites(sanitized);
    saveLocalFavorites(sanitized);
    setError(null);

    if (user) {
      try {
        await saveNavFavorites(user.uid, sanitized);
      } catch (err) {
        warnFirestoreFallback("navFavorites.save", err);
        setError("클라우드 저장에 실패했어요. 이 브라우저에는 저장됐습니다.");
        return;
      }
    }
    setEditOpen(false);
  };

  const triggerClass = `inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[12px] font-medium transition-colors sm:px-2.5 sm:text-[13px] ${
    isLight ? "text-slate-600 hover:bg-slate-100" : "text-slate-200 hover:bg-white/10"
  }`;

  const panelBg = isLight ? "border-slate-200 bg-white" : "border-[#22303a] bg-[#101719]";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="즐겨찾기"
        onClick={() => setOpen(!open)}
        className={triggerClass}
      >
        <Star size={14} className="text-amber-400" fill="currentColor" />
        <span className="hidden sm:inline">즐겨찾기</span>
      </button>

      {open && coords && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="즐겨찾기 목록"
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
          className={`z-[60] flex flex-col rounded-xl border p-1.5 shadow-2xl ${panelBg}`}
        >
          {favorites.length === 0 ? (
            <p className={`px-3 py-4 text-center text-[12.5px] leading-5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
              즐겨찾기가 없습니다.
              <br />
              편집에서 자주 쓰는 페이지를 추가하세요.
            </p>
          ) : (
            <div className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto">
              {favorites.map((item) => {
                const internal = isInternalFavoriteHref(item.href);
                const rowClass = `flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  isLight ? "text-slate-700 hover:bg-blue-50 hover:text-blue-700" : "text-slate-200 hover:bg-blue-500/15 hover:text-white"
                }`;
                const dot = <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />;
                return internal ? (
                  <Link key={item.id} role="menuitem" href={item.href} onClick={() => setOpen(false)} className={rowClass}>
                    {dot}
                    <span className="truncate">{item.name}</span>
                  </Link>
                ) : (
                  <a
                    key={item.id}
                    role="menuitem"
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className={rowClass}
                  >
                    {dot}
                    <span className="truncate">{item.name}</span>
                    <ExternalLink size={12} className="ml-auto shrink-0 opacity-60" />
                  </a>
                );
              })}
            </div>
          )}
          <div className={`mt-1 border-t pt-1 ${isLight ? "border-slate-100" : "border-white/10"}`}>
            <button
              type="button"
              onClick={openEditor}
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                isLight ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800" : "text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Pencil size={13} />
              편집
            </button>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className={`flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border shadow-2xl ${isLight ? "border-slate-200 bg-white" : "border-slate-700 bg-[#151b1d]"}`}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${isLight ? "border-slate-100" : "border-white/10"}`}>
              <h2 className={`text-lg font-extrabold ${isLight ? "text-slate-900" : "text-white"}`}>즐겨찾기 편집</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className={`rounded px-2 py-1 text-sm font-bold ${isLight ? "text-slate-500 hover:bg-slate-100" : "text-slate-300 hover:bg-white/10"}`}
              >
                닫기
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {draft.length === 0 && (
                <p className={`rounded-xl border border-dashed px-3 py-6 text-center text-[13px] ${isLight ? "border-slate-200 text-slate-500" : "border-white/15 text-slate-400"}`}>
                  아직 즐겨찾기가 없습니다. 아래 버튼으로 추가하세요.
                </p>
              )}
              {draft.map((row) => (
                <div key={row.id} className={`rounded-xl border p-3 ${isLight ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5"}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <div>
                        <label className={`mb-1 block text-[11px] font-semibold ${isLight ? "text-slate-500" : "text-slate-400"}`}>이름</label>
                        <input
                          value={row.name}
                          onChange={(event) => updateRow(row.id, "name", event.target.value)}
                          placeholder="예: 투자현황"
                          className={`w-full rounded-lg border px-3 py-2 text-[13px] ${isLight ? "border-slate-300 bg-white text-slate-800 placeholder:text-slate-400" : "border-slate-600 bg-slate-950 text-white placeholder:text-slate-500"}`}
                        />
                      </div>
                      <div>
                        <label className={`mb-1 block text-[11px] font-semibold ${isLight ? "text-slate-500" : "text-slate-400"}`}>주소</label>
                        <input
                          value={row.href}
                          onChange={(event) => updateRow(row.id, "href", event.target.value)}
                          placeholder="/portfolio 또는 https://..."
                          className={`w-full rounded-lg border px-3 py-2 text-[13px] ${
                            row.href && !isSafeFavoriteHref(row.href)
                              ? "border-red-400 bg-red-50/50 text-red-700 dark:bg-red-500/10 dark:text-red-200"
                              : isLight
                                ? "border-slate-300 bg-white text-slate-800 placeholder:text-slate-400"
                                : "border-slate-600 bg-slate-950 text-white placeholder:text-slate-500"
                          }`}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      aria-label="삭제"
                      className={`mt-6 rounded-lg p-2 ${isLight ? "text-slate-400 hover:bg-red-50 hover:text-red-600" : "text-slate-500 hover:bg-red-500/15 hover:text-red-300"}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addRow}
                className={`flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                  isLight ? "border-slate-300 text-slate-600 hover:bg-slate-50" : "border-white/20 text-slate-300 hover:bg-white/5"
                }`}
              >
                <Plus size={15} />
                즐겨찾기 추가
              </button>
            </div>

            <div className={`flex items-center justify-between gap-2 border-t px-5 py-4 ${isLight ? "border-slate-100" : "border-white/10"}`}>
              <span className="min-h-[16px] flex-1 text-[12px] font-semibold text-red-500 dark:text-red-300">{error}</span>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold ${isLight ? "border-slate-300 text-slate-600 hover:bg-slate-100" : "border-slate-600 text-slate-200 hover:bg-white/10"}`}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-500"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
