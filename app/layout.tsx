import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "고라파이 Gorani-Finance",
  description:
    "Next.js + TS + Tailwind + Recharts",
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
