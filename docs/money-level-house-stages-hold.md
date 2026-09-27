# Money Level House Progression — Long-Term Hold / Resume Guide

> **LONG-TERM HOLD / DO NOT MERGE**
>
> PR #235 is intentionally preserved for future Gorani Forest house/background work.
> The 20-stage house progression and stage dialog are implemented, but final visual
> integration is blocked by the existing Forest lot/fence geometry, especially on
> the brokerage lot. Do not merge until the background lot redesign and final visual
> QA are complete and the user explicitly approves resuming and merging this work.

마지막 확인일: 2026-09-27 (Asia/Seoul)

## Current State

| 항목 | 값 |
| --- | --- |
| Repository | `cococute88/gorani_vercel` |
| Pull request | [#235 — feat: complete Money Level house growth progression](https://github.com/cococute88/gorani_vercel/pull/235) |
| 보존 branch | `feat/forest-house-stages` |
| 구현/visual checkpoint HEAD | `a335de4bac9492a80544326db4992b17f68e4368` |
| 구현/visual checkpoint commit | `fix(money-level): normalize house art direction and palette` |
| 최초 base / 현재 merge-base | `85aa1715acf849e290cee71d2d0ab704bacab6f7` (`origin/main`) |
| 보존 worktree | `C:\Users\sdf15\.codex\worktrees\forest-house-stages\gorani_vercel` |
| 의도한 PR 상태 | Draft, OPEN, long-term HOLD, not merged |

`a335de4`는 house artwork, runtime mapping, visual calibration, UI와 QA가 모두
완료된 보존 기준점이다. 이 문서를 추가하는 후속 commit은 문서/PR 상태만
정리하며 production runtime을 변경하지 않는다.

장기 보존 중에는 `main`과 이 branch가 자연스럽게 diverge할 수 있다. 재개할
때 즉시 rebase 또는 merge하지 말고, 최신 `main`과 PR #235의 전체 diff 및
Money Level/Forest 변경 내역을 먼저 조사한다. 새 Forest 변경이 있다면 그
의도를 이해한 뒤 #235를 재적용하거나 충돌을 해결한다.

## Completed Work

- Money Level Lv.0~19, 총 20단계 house progression 유지
- brokerage/tax account와 stage를 함께 해석하는 dedicated asset resolver
- brokerage 11개, tax 14개의 신규 계절 중립 alpha WebP house asset
- 기존 temporary house를 정상 runtime 경로에서 제거하고 fallback으로만 유지
- tax Lv.6~19를 오른쪽 부지에서 마을 중앙을 바라보는 inward-facing 시점으로 보정
- account별 Lv.6을 기준으로 후반 house palette/채도/목재/outline을 정규화
- 일반 house stage의 과도한 풀·꽃·덤불·녹색 ground patch 축소
- 실제 alpha object 기준 `visualFrame` / `visibleBounds` / reference width calibration
- 집 클릭/탭 시 current level, current value, progress, next stage, remaining amount,
  전체 20단계 compact list를 보여주는 overlay dialog
- X, outside click, Escape, Enter/Space, focus return 등 keyboard accessibility
- mobile tap/swipe 구분과 기존 mobile camera 동작 보존
- 기존 statue/character depth, labels, seasonal backgrounds, layout 관련 regression coverage
- house threshold, portfolio value 계산, HP/MP, retirement, activity, Spine 시스템 유지

세부 단계별 runtime inventory는
[`docs/money-level-house-asset-inventory.md`](./money-level-house-asset-inventory.md)를
source of truth로 사용한다.

## Current House Assets

### 신규 brokerage assets — 11개

- `brokerage-stage-30-35-micro-house.webp`
- `brokerage-stage-50-55-workshop-house.webp`
- `brokerage-stage-55-60-two-story.webp`
- `brokerage-stage-60-65-two-story-garden.webp`
- `brokerage-stage-65-70-two-story-veranda.webp`
- `brokerage-stage-70-75-two-story-large.webp`
- `brokerage-stage-75-80-two-story-annex.webp`
- `brokerage-stage-80-85-mansion.webp`
- `brokerage-stage-85-90-mansion-garden.webp`
- `brokerage-stage-90-95-grand-mansion.webp`
- `brokerage-stage-95-100-grand-mansion-annex.webp`

### 신규 tax assets — 14개

- `tax-stage-30-35-micro-house.webp`
- `tax-stage-35-40-small-cabin.webp`
- `tax-stage-40-45-expanded-cabin.webp`
- `tax-stage-45-50-proper-house.webp`
- `tax-stage-50-55-workshop-house.webp`
- `tax-stage-55-60-two-story.webp`
- `tax-stage-60-65-two-story-garden.webp`
- `tax-stage-65-70-two-story-veranda.webp`
- `tax-stage-70-75-two-story-large.webp`
- `tax-stage-75-80-two-story-annex.webp`
- `tax-stage-80-85-mansion.webp`
- `tax-stage-85-90-mansion-garden.webp`
- `tax-stage-90-95-grand-mansion.webp`
- `tax-stage-95-100-grand-mansion-annex.webp`

현재 asset과 `visualFrame`을 삭제하거나 처음부터 다시 만들지 않는다. 새 lot
geometry가 승인된 뒤 대부분의 asset을 재사용하고 calibration 값만 다시 조정할
가능성이 높다.

## Protected Approved Assets

다음 기존 승인 자산은 #235에서 픽셀을 재생성하거나 덮어쓰지 않았다.

- rugs / 작은 모닥불과 돗자리
- camp / camp-plus
- small white tent
- large white tent
- colored tent
- brokerage small cabin (Lv.7)
- brokerage expanded cabin (Lv.8)
- brokerage proper house (Lv.9)

Lv.1~5의 source, scale, translation, visual frame 역시 변경하지 않았다. 승인
자산 보호 원칙은 재개 후에도 유지한다.

## Test and Visual QA Status

구현/visual checkpoint `a335de4`에서 다음 명령이 PASS했다.

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run check:money-level-domain`
- `npm run check:money-level-assets`
- `npm run check:money-level-house-hotfix`
- `npm run check:money-level-tax-safe-frame`
- `npm run check:money-level-tax-stage-scale`
- `npm run check:money-level-layout`
- `npm run check:money-level-statue-depth`
- `npm run check:money-level-mobile`
- `npm run check:money-level-activities`
- `npm run check:money-level-seasonal-backgrounds`
- `npm run check:money-level-house-stages-browser`
- `npm run check:money-level-mobile-browser`
- `npm run check:money-level-house-hotfix-browser`
- `npm run check:money-level-seasonal-backgrounds-browser`
- `npm run check:money-level-premerge-depth-browser`

Browser QA 범위:

- brokerage/tax Lv.6~19 실제 production Forest 합성
- inward-facing 대표 단계 Lv.6, Lv.9, Lv.12, Lv.15, Lv.19 비교
- Spring day 전체 progression, Summer/Fall/Winter 대표 단계
- desktop 1920×1080, 1440×900, 1366×768
- mobile 390×844
- dialog mouse/touch/keyboard close, focus return, tap/swipe, no preload
- horizontal overflow 없음, dialog로 인한 document height 증가 없음
- character/house/statue depth, labels, mobile camera, seasonal background 회귀 확인

QA contact sheet는 당시 로컬 temp 디렉터리에 생성했으나 대용량 binary를 장기
보존 commit에 추가하지 않았다. 재개 시 위 browser QA 명령으로 runtime 캡처를
새로 만들고, 다음 네 비교판을 다시 구성한다.

1. brokerage Lv.6~19 actual Forest progression
2. tax Lv.6~19 actual Forest progression
3. brokerage/tax Lv.6·9·12·15·19 inward-facing 비교
4. Spring 대표 단계 및 Summer/Fall/Winter 표본

현재 페이지의 기존 세로 scroll은 #235 범위 밖이다. dialog는 scroll height를
추가하지 않았으며, 상단 제목/은퇴까지/HP/MP 압축은 별도 후속 작업이다.

## Unresolved Visual Blocker

Brokerage high-stage houses increasingly conflict with the fence and limited lot
footprint baked into the Forest background. Tax에도 같은 제약이 생길 수 있지만,
현재 merge를 막는 주된 blocker는 brokerage 왼쪽 부지다.

확인된 증상:

- background fence overlap
- 집이 울타리를 밟거나 관통하는 것처럼 보임
- annex/foundation과 울타리의 충돌
- 배치 가능한 ground footprint가 지나치게 제한됨
- roof/chimney top crop 위험과 부족한 vertical breathing room
- high-stage mansion을 지나치게 축소해야만 부지 안에 들어감
- 울타리를 존중할수록 Lv.6~19 성장감이 시각적으로 압축됨

단순 house scale, `visualFrame`, translation 조정만으로 해결하는 방안은 최종
해법으로 확정되지 않았다. scale만 계속 줄이면 mansion의 구조적 성장감이
사라지고, anchor만 움직이면 path/pond/character world와 충돌할 가능성이 있다.

가장 가능성이 높은 장기 해결 방향은 다음과 같다.

1. brokerage house lot의 baked-in fence 일부 제거 또는 재설계
2. 동적 house object를 수용하는 중립적이고 열린 ground plane 확보
3. 새 lot의 safe envelope와 geometry 확정
4. 그 geometry 위에서 anchor, scale, stage translation을 다시 calibration

Forest background가 먼저이고 house는 그 world 안에 들어가는 object다. 그러나
20단계 동적 object를 고정된 좁은 울타리에 무리하게 맞추는 대신, progression을
수용할 수 있는 background lot 자체를 설계해야 할 수 있다.

## Resume Phases

### Phase 1 — 기준 background 선택

production의 대표 `Spring Day Sunny` background 한 장만 선택한다. 이 단계에서
다른 season/time/weather background를 수정하지 않는다.

### Phase 2 — Brokerage lot prototype

선택한 한 장에서만 brokerage lot의 울타리 제거/재설계 시안을 만든다. 열린
ground plane, path 연결, 주변 landmark와의 관계를 함께 검토한다.

### Phase 3 — 사용자 visual approval

한 장의 기준 background에서 최종 fence/lot geometry를 사용자에게 승인받는다.
승인 전에는 다른 background로 변경을 전파하지 않는다.

### Phase 4 — 새 lot calibration

승인된 lot을 기준으로 brokerage anchor, safe envelope, ground plane, house scale,
stage-specific translation과 visible bounds를 다시 calibration한다.

### Phase 5 — Brokerage progression QA

Brokerage Lv.6~19를 실제 기준 background에 전부 합성하여 fence, crop, baseline,
growth continuity와 character/path 충돌을 검수한다.

### Phase 6 — Tax lot 결정

Tax 오른쪽 부지에도 동일한 fence-free/open-lot 원칙이 필요한지 판단한다. 필요할
때만 별도 prototype과 사용자 승인을 거친다.

### Phase 7 — Background propagation

기준 background와 house geometry가 모두 승인된 뒤에만 확정된 lot 변경을 나머지
season/time/weather background에 동일하게 전파한다.

### Phase 8 — Fall house variants

전체 base house illustration과 background integration이 승인된 뒤 Fall 전용
house variation을 만든다.

### Phase 9 — Winter house variants

동일한 확정 geometry를 유지하면서 Winter 전용 house variation을 만든다.

### Phase 10 — Final regression and merge decision

전체 static/browser/visual regression을 다시 실행하고 사용자 최종 승인을 받은
뒤에만 PR #235 merge 여부를 결정한다.

> **DO NOT start by editing every seasonal background.**
>
> 먼저 대표 background 단 한 장에서 최종 lot geometry를 확정한다. 수십 장을
> 일괄 생성·수정한 뒤 geometry 불일치로 다시 만드는 과정을 반복하지 않는다.

## Resume Checklist

- [ ] 최신 `main`과 `origin/main` 확인
- [ ] PR #235의 전체 diff와 현재 remote branch HEAD 확인
- [ ] #235 이후 추가된 Money Level/Forest 변경 이해
- [ ] 충돌 조사 전 무조건적인 rebase/merge 금지
- [ ] 대표 Spring Day Sunny 기준 background 한 장 선택
- [ ] brokerage fence-free/open-lot prototype 제작
- [ ] 사용자 visual approval 획득
- [ ] 새 lot safe envelope와 geometry calibration
- [ ] brokerage Lv.6~19 actual Forest QA
- [ ] tax lot redesign 필요 여부 결정
- [ ] 승인 후에만 seasonal/time/weather background 변경 전파
- [ ] 전체 base integration 승인
- [ ] Fall house variants 제작
- [ ] Winter house variants 제작
- [ ] full static/browser/visual regression
- [ ] 사용자 최종 merge 승인
- [ ] PR #235 merge 여부 결정

## Original Dirty Main Warning

원본 working tree `C:\gv\gorani_vercel`은 이 작업 시작 당시 local `main`이
`origin/main`보다 뒤처져 있었고 다음 untracked reference 디렉터리를 포함했다.

- `background/`
- `housereference/`
- `public/money-level/art/baseidea/`

해당 원본은 house progression 작업 중 read-only reference로만 사용됐다. 이
작업에서는 pull, reset, clean, restore, commit 또는 파일 삭제를 수행하지 않았다.
향후 작업자도 이 원본 dirty main을 임의로 clean/reset하거나 untracked reference를
삭제해서는 안 된다. 필요한 경우 먼저 별도의 clean worktree에서 작업한다.

## Hold Rules

- PR #235를 merge하지 않는다.
- `feat/forest-house-stages`와 remote branch를 삭제하지 않는다.
- 현재 house assets, `visualFrame`, resolver, dialog, test scripts를 삭제하지 않는다.
- 사용자 재개 요청 전에는 house/background visual 작업을 추가로 시작하지 않는다.
- 재개는 house 재생성이 아니라 대표 Spring background 한 장의 brokerage lot
  redesign prototype부터 시작한다.
