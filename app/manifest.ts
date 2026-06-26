import type { MetadataRoute } from "next";

// PWA / mobile home-screen metadata. The user-facing app name is unified to
// "고라니 자산관리" across the browser tab, OpenGraph, and the installable PWA.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "고라니 자산관리",
    short_name: "고라니 자산관리",
    description: "고라니 자산관리 — 포트폴리오 자산 관리 대시보드",
    start_url: "/portfolio",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/gorani-logo.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
