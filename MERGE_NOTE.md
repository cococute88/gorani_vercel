# QLD 대시보드 병합 메모

이 ZIP은 원본 `gorani-finance`를 기준으로 QLD 대시보드만 추가 병합한 버전입니다.

적용한 변경:

1. `app/qld-dashboard/page.tsx` 추가
2. `components/qld/*` 추가
3. `lib/qldDashboardData.ts` 추가
4. `lib/mockData.ts`의 `NAV_ITEMS`에 `QLD 대시보드` 메뉴 1줄 추가

의도적으로 하지 않은 변경:

- 기존 `app/page.tsx`, `app/portfolio/page.tsx`, `app/performance/page.tsx`, `app/asset-map/page.tsx`는 원본 유지
- 기존 공통 컴포넌트는 원본 유지
- 기존 `app/globals.css`는 원본 유지

실행:

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000/qld-dashboard` 확인.
