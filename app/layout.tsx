import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pftool — 포트폴리오 대시보드",
  description:
    "MOCK 데이터 기반 포트폴리오 대시보드 클론 (Next.js + TS + Tailwind + Recharts)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
