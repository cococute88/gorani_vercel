# UI-3B — Portfolio Treemap Width Hotfix

작업일: 2026-06-14
유형: `/portfolio` 레이아웃 폭 hotfix

## 1. Root Cause

UI-3에서 1300px+ 하단 레이아웃을 2열로 바꾸면서 트리맵 컬럼이 `minmax(0,1fr)`로 설정되었고, 트리맵 래퍼도 `min-[1300px]:max-w-none`으로 풀렸다. 그 결과 wide desktop에서 `배당 / 성장 트리맵`이 왼쪽 가용 폭을 전부 채우며 과도하게 넓어졌다.

## 2. Changed Files

- `app/portfolio/page.tsx`
- `docs/UI3B_PORTFOLIO_TREEMAP_WIDTH_HOTFIX.md`
- `docs/AUDIT.md`

## 3. New Wide Layout Rule

1300px+에서는 하단 영역을 다음 그리드로 배치한다.

```txt
min-[1300px]:grid-cols-[minmax(380px,560px)_minmax(0,1fr)]
```

- 왼쪽 `배당 / 성장 트리맵` 컬럼은 380px~560px 사이로 제한한다.
- 트리맵 카드 래퍼는 `max-w-[560px]`를 유지한다.
- 오른쪽 `위탁 계좌 현황` / `절세 계좌 현황`은 남은 폭을 사용한다.
- 1300px+에서도 트리맵 컬럼에는 `minmax(0,1fr)`를 쓰지 않는다.

## 4. Responsive Verification

- 320px, 390px, 780px, 1280px: 단일 컬럼 스택 유지.
- 1300px, 1440px, 1920px: 트리맵 좌측 compact 폭 유지, 계좌 그룹 우측 유지.
- 측정값: 1300px/1440px/1920px에서 트리맵 카드 width는 560px로 유지.
- 페이지 레벨 가로 overflow 없음.

## 5. Light/Dark Verification

- 라이트 모드: 트리맵/계좌 카드/제목 영역 가독성 유지.
- 다크 모드: 기존 다크 표면과 트리맵 색상 유지.
- 1440px 라이트/다크 모두 트리맵 좌측, 위탁/절세 계좌 현황 우측 stacked 배치 확인.
- 테마 로직과 `ThemeProvider`는 변경하지 않음.

## 6. Remaining Limitations

- 트리맵은 여전히 mock 표시 컴포넌트이며 데이터 연결/분류 로직은 변경하지 않았다.
- 계좌 카드 compact grid는 UI-3의 기존 1300px+ 2열 규칙을 유지한다.
