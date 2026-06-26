"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AnchoredMenu = {
  open: boolean;
  setOpen: (next: boolean) => void;
  coords: { top: number; left: number; width: number } | null;
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  menuRef: React.MutableRefObject<HTMLDivElement | null>;
};

// 트리거 버튼 기준으로 fixed dropdown 의 위치를 계산한다.
// position:fixed 를 쓰는 이유: 상단 nav 가 overflow-hidden 이라서
// 일반 absolute dropdown 은 잘린다. fixed 는 ancestor overflow 의 영향을 받지 않고
// 뷰포트 기준으로 clamp 해 모바일에서도 화면 밖으로 잘리지 않는다.
export function useAnchoredMenu(align: "left" | "right" = "left", preferredWidth = 200): AnchoredMenu {
  const [open, setOpenState] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (typeof window === "undefined" || !el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const width = Math.min(preferredWidth, vw - margin * 2);
    let left = align === "right" ? rect.right - width : rect.left;
    left = Math.min(Math.max(margin, left), vw - width - margin);
    setCoords({ top: rect.bottom + 6, left, width });
  }, [align, preferredWidth]);

  const setOpen = useCallback(
    (next: boolean) => {
      if (next) updatePosition();
      setOpenState(next);
    },
    [updatePosition],
  );

  useEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenState(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpenState(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, updatePosition]);

  return { open, setOpen, coords, triggerRef, menuRef };
}
