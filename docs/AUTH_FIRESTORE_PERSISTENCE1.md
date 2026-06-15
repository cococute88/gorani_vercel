# AUTH-FIRESTORE-PERSISTENCE-1

## Auth persistence policy

Firebase Auth is initialized only when all existing `NEXT_PUBLIC_FIREBASE_*` values are present. The app now explicitly calls `setPersistence(auth, browserLocalPersistence)` before handling redirect results and before starting Google sign-in. This keeps the Google session in browser local persistence across refreshes and browser restarts where the browser allows persistent storage.

Auth hydration is treated as a loading state. UI that depends on snapshots should not conclude that the user is logged out until `onAuthStateChanged` has resolved.

## Mobile popup/redirect policy

Google remains the only sign-in provider. Desktop browsers continue to use `signInWithPopup`. Mobile user agents use `signInWithRedirect`, and popup-blocked / unsupported popup failures fall back to redirect. The redirect completion is handled through `getRedirectResult` during auth startup so returning mobile browsers can finish the sign-in flow and then hydrate the Firebase user.

## Portfolio snapshot Firestore path

Portfolio snapshots use one Firestore collection path for save and load:

- Save: `users/{uid}/portfolioSnapshots/{snapshot.id}`
- Load: `users/{uid}/portfolioSnapshots`, ordered by `snapshotDate`
- Delete: `users/{uid}/portfolioSnapshots/{snapshotId}`

No UID, email, Firebase project name, or environment variable name is hardcoded.

## Local/cloud merge policy

`localStorage` remains the fallback cache under `qld2.portfolio.snapshots.v1`. When Firebase is configured and the user is signed in, the shared cloud sync hook loads Firestore snapshots, merges them with the local cache by `snapshotDate`, writes the merged list back to local cache, and uploads local-only snapshots to Firestore. Cloud snapshots win when the same `snapshotDate` exists locally and in Firestore. If Firestore is empty but local snapshots exist, local snapshots remain visible and are uploaded.

New snapshot registration still writes local storage first. If a user is signed in, it then attempts the Firestore write. Firestore write failures do not delete local data.

## Empty state prevention

While auth or cloud snapshot synchronization is in progress, snapshot history shows a loading/syncing message instead of immediately showing “등록된 스냅샷이 없습니다.” This prevents a transient `currentUser === null` or pending Firestore load from looking like permanent data loss.

## Logout label

The signed-in auth button label is now `Logout` on both desktop and mobile. The button has a minimum mobile width and `whitespace-nowrap` to avoid truncating into misleading text on narrow screens.

## Firebase/local status badge policy

Auth/snapshot status labels are:

- Firebase env missing: `Firebase 미설정 · 로컬 저장`
- Firebase configured + auth loading: `로그인 확인 중`
- Firebase configured + signed out: `로그인 필요 · 로컬 저장`
- Firebase configured + signed in: `클라우드 동기화`
- Sync failure: portfolio copy reports `동기화 실패 · 로컬 저장 유지` while local snapshots remain available

Calendar imported badges, cache badges, and market badges are intentionally unchanged.

## Test commands

- `npm run check:auth-firestore-persistence`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Portfolio/parser/performance/dividend/calendar/KRX regression checks listed in the task request

## Remaining limitations

- Real Firebase persistence still depends on Firebase Console authorized domains, valid environment variables, browser storage permissions, and third-party/cross-site storage behavior on the user device.
- This change cannot verify a production Vercel Firebase write without valid deployed environment variables and a signed-in test account.
- Firestore security rules must allow authenticated users to read/write their own `users/{uid}/portfolioSnapshots` documents.
