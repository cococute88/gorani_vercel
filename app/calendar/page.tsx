import type { Metadata } from "next";
import WatchlistPage from "@/components/watchlist/WatchlistPage";

export const metadata: Metadata = {
  title: "배당캘린더",
  description: "배당락, 매수마감, 지급, 실적 일정을 확인하는 페이지",
  alternates: {
    canonical: "/calendar",
  },
};

export default function CalendarPage() {
  return <WatchlistPage />;
}
