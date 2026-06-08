import QldDashboardPage from "@/components/qld/QldDashboardPage";

// /qld-dashboard 라우트. qld.kr 느낌의 다크 대시보드(MOCK).
export const metadata = {
  title: "QLD 대시보드 — pftool",
};

export default function Page() {
  return <QldDashboardPage />;
}
