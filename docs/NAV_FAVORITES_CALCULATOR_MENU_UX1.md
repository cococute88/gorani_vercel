# NAV-FAVORITES-CALCULATOR-MENU-UX-1

상단 nav에 계산기 hover/click submenu와 즐겨찾기 메뉴(+편집 모달 + Firestore 동기화)를
추가하고, 계산기·자산시뮬레이터 페이지 상단의 개발자용 안내문구를 정리한 작업.

## 1. 계산기 submenu 구조

- 컴포넌트: `components/nav/CalculatorMenu.tsx`
- 트리거: nav의 `계산기` 항목이 dropdown 트리거(▾)가 된다.
  - hover(`onMouseEnter`), focus(`onFocus`), click(`onClick` toggle) 모두로 열린다.
  - hover가 풀릴 때는 140ms 지연 후 닫혀 메뉴로 이동할 여유를 준다.
  - `aria-haspopup="menu"` / `aria-expanded` / `role="menu"` 적용.
  - ESC · 바깥 클릭으로 닫힘(`useAnchoredMenu`).
- 하위 항목 → URL:
  - `배당치기` → `/calculator?tab=dividend-capture`
  - `매도전환` → `/calculator?tab=conversion`
  - `MDD` → `/calculator?tab=mdd`
- `components/calculator/CalculatorPage.tsx`가 `useSearchParams`로 `tab` 값을 읽어
  내부 탭 key(`capture`/`conversion`/`mdd`)로 매핑한다(`TAB_PARAM_MAP`).
  - 이미 페이지에 있을 때 submenu로 다른 탭을 누르면 `useEffect`가 활성 탭을 갱신한다.
  - `useSearchParams` 사용을 위해 `app/calculator/page.tsx`를 `<Suspense>`로 감쌌다.

## 2. 즐겨찾기 UI 구조

- 컴포넌트: `components/nav/FavoritesMenu.tsx` (TopNav 우측, `클라우드 동기화` 배지 왼쪽)
- 트리거: `⭐ 즐겨찾기` (모바일에서는 별 아이콘만)
- dropdown(`role="menu"`):
  - 항목은 compact row(파란 dot + 이름).
  - 내부 route(`/...`)는 Next `Link`로 현재 탭 이동, 외부 URL(`https://...`)은
    `target="_blank" rel="noopener noreferrer"`로 새 탭 이동(외부 표시 아이콘).
  - empty state: "즐겨찾기가 없습니다. 편집에서 자주 쓰는 페이지를 추가하세요."
  - 하단 divider 아래 `✏️ 편집` 버튼 → 편집 모달.

## 3. 즐겨찾기 편집 모달

- 제목: `즐겨찾기 편집`
- 각 row: 이름 input / 주소 input / 삭제 버튼.
- 하단: `+ 즐겨찾기 추가`, `닫기`, `저장`.
- 위험 URL/빈 값은 저장 시 sanitize 단계에서 자동 제외, 주소 input은
  안전하지 않은 값일 때 빨간 테두리로 표시.
- 디자인은 기존 표시이름/티커 관리 모달 톤(dim overlay + rounded card + blue primary).

## 4. Firestore schema / path

```
users/{uid}/uiSettings/favorites
{
  items: Array<{ id: string, name: string, href: string, order: number }>,
  updatedAt: serverTimestamp()
}
```

- `lib/firebase/firestore-repositories.ts`:
  - `loadNavFavorites(uid)` — 없으면 `null`.
  - `saveNavFavorites(uid, items)` — `order`를 배열 순서로 재부여하고
    `sanitizeFirestorePayload`로 undefined를 제거한 뒤 `setDoc(..., { merge: true })`.

## 5. localStorage fallback

- key: `gorani.favorites.v1` (`STORAGE_KEYS.navFavorites`)
- `lib/nav-favorites.ts`의 `loadLocalFavorites` / `saveLocalFavorites`.
- 로드 우선순위: 로그인 시 Firestore → localStorage → 기본 seed(`DEFAULT_FAVORITES`).
- Firestore 로드 성공 시 localStorage 캐시도 갱신.
- 저장 시 항상 localStorage에 먼저 기록한 뒤 로그인 상태면 Firestore에 저장.
  Firestore 저장 실패 시 모달 하단에 작은 오류 문구를 표시하고 로컬 저장은 유지.

## 6. sanitize 정책

- `isSafeFavoriteHref`: `javascript:`/`data:`/`vbscript:`/`file:` 차단,
  내부 상대경로(`/...`) 또는 `http(s)://`만 허용.
- `sanitizeFavoriteItems`: 이름/주소 trim, 빈 이름·위험 URL 제거, id 보강
  (`crypto.randomUUID` 우선, 없으면 deterministic fallback), order 재부여.
- Firestore payload는 `sanitizeFirestorePayload`로 undefined를 제거.

## 7. 삭제/정리한 상단 안내 문구

- 계산기: `components/calculator/PreviewNotice.tsx` 제거
  ("Live quote data enabled / sample 데이터 자동 전환" 박스).
  부제는 `실시간 시세 기반 계산을 지원합니다.` 한 줄로 축약.
- 자산시뮬레이터: `components/asset-simulator/SimulatorPreviewNotice.tsx` 제거
  ("Streamlit 자산 시뮬레이터 포팅 / 3A mock preview" 박스).
  부제는 `장기 투자·인출 계획을 계산합니다.` 한 줄로 축약.
- 실제 sample/조회 불가 상태는 각 계산기 내부 badge에서만 노출(`StorageModeBadge` 등).

## 8. 테스트 명령어

```bash
npm run check:nav-favorites-calculator-menu
npm run lint
npm run typecheck
npm run build
```

회귀:

```bash
npm run check:market-data-real
npm run check:portfolio-realdata
npm run check:asset-simulator-persistence
npm run check:dividend-capture-streamlit-restore
```

## 9. 남은 한계

- 즐겨찾기 항목 드래그 순서 변경 UI는 없음(편집 모달의 행 순서 = 저장 순서).
- submenu/즐겨찾기 active 탭 하이라이트는 trigger 단위까지만 반영(개별 항목은 hover만).
- Firestore 보안 규칙은 `users/{uid}/{document=**}` 재귀 wildcard로 이미 `uiSettings/favorites`를 포함하므로 별도 규칙 추가는 불필요.
