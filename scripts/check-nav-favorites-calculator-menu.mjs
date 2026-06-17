import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const topNav = read("components/TopNav.tsx");
const calcMenu = read("components/nav/CalculatorMenu.tsx");
const favMenu = read("components/nav/FavoritesMenu.tsx");
const navFavorites = read("lib/nav-favorites.ts");
const repos = read("lib/firebase/firestore-repositories.ts");
const storageKeys = read("lib/storage-keys.ts");
const calcPage = read("components/calculator/CalculatorPage.tsx");
const simPage = read("components/asset-simulator/AssetSimulatorPage.tsx");
const pkg = JSON.parse(read("package.json"));

// 1. nav 에 즐겨찾기 버튼 존재
assert.match(topNav, /FavoritesMenu/, "TopNav renders FavoritesMenu");
assert.match(favMenu, /aria-label="즐겨찾기"/, "Favorites trigger button has an accessible label");
assert.match(favMenu, /즐겨찾기/, "Favorites button label text exists");

// 즐겨찾기는 클라우드 동기화 배지 왼쪽에 위치
assert.match(
  topNav,
  /<FavoritesMenu[\s\S]*?\/>[\s\S]*?StorageModeBadge/,
  "Favorites menu is placed before the cloud-sync badge",
);

// 2. 즐겨찾기 편집 모달 존재
assert.match(favMenu, /즐겨찾기 편집/, "Edit modal title exists");
assert.match(favMenu, /editOpen/, "Edit modal open state exists");
assert.match(favMenu, /즐겨찾기 추가/, "Add favorite control exists");
assert.match(favMenu, /handleSave/, "Edit modal has a save handler");

// 3. Firestore favorites path / repository 존재
assert.match(repos, /export async function loadNavFavorites/, "loadNavFavorites repository exists");
assert.match(repos, /export async function saveNavFavorites/, "saveNavFavorites repository exists");
assert.match(
  repos,
  /doc\(requireDb\(\), "users", uid, "uiSettings", "favorites"\)/,
  "Firestore path users/{uid}/uiSettings/favorites is used",
);

// 4. localStorage fallback 존재
assert.match(navFavorites, /loadLocalFavorites/, "localStorage load helper exists");
assert.match(navFavorites, /saveLocalFavorites/, "localStorage save helper exists");
assert.match(storageKeys, /navFavorites:/, "navFavorites storage key is registered");
assert.match(favMenu, /loadLocalFavorites|saveLocalFavorites/, "FavoritesMenu uses localStorage fallback");

// 5. 계산기 submenu 에 배당치기/매도전환/MDD 존재
assert.match(calcMenu, /배당치기/, "Calculator submenu has 배당치기");
assert.match(calcMenu, /매도전환/, "Calculator submenu has 매도전환");
assert.match(calcMenu, /MDD/, "Calculator submenu has MDD");
assert.match(calcMenu, /\/calculator\?tab=\$\{item\.tab\}/, "Submenu links to /calculator?tab=...");
assert.match(calcMenu, /tab: "dividend-capture"/, "배당치기 maps to dividend-capture tab");
assert.match(calcMenu, /tab: "conversion"/, "매도전환 maps to conversion tab");
assert.match(calcMenu, /tab: "mdd"/, "MDD maps to mdd tab");

// CalculatorPage 가 tab query 를 읽어 탭을 연다
assert.match(calcPage, /useSearchParams/, "CalculatorPage reads tab query via useSearchParams");
assert.match(calcPage, /TAB_PARAM_MAP/, "CalculatorPage maps tab query values to tab keys");

// 6. submenu 가 hover/click/focus 중 최소 click 으로 동작
assert.match(calcMenu, /onClick=\{\(\) => setOpen\(!open\)\}/, "Calculator submenu toggles on click");
assert.match(calcMenu, /onMouseEnter/, "Calculator submenu opens on hover");
assert.match(calcMenu, /onFocus/, "Calculator submenu opens on focus");
assert.match(calcMenu, /aria-haspopup="menu"/, "Calculator submenu uses aria-haspopup");

// 7. `Live quote data enabled` 문구 제거
assert.ok(!existsSync("components/calculator/PreviewNotice.tsx"), "PreviewNotice component is removed");
assert.doesNotMatch(calcPage, /Live quote data enabled/, "Calculator page no longer shows 'Live quote data enabled'");

// 8. `Streamlit 자산 시뮬레이터 포팅` 문구 제거
assert.ok(!existsSync("components/asset-simulator/SimulatorPreviewNotice.tsx"), "SimulatorPreviewNotice component is removed");
assert.doesNotMatch(simPage, /Streamlit 자산 시뮬레이터 포팅/, "Asset simulator page no longer shows the porting notice");

// 9. `mock preview` / 개발자용 단어가 calculator/asset simulator 상단 안내에 남지 않음
for (const [name, source] of [["calculator", calcPage], ["asset-simulator", simPage]]) {
  assert.doesNotMatch(source, /mock preview/i, `${name} page has no 'mock preview' wording`);
  assert.doesNotMatch(source, /포팅/, `${name} page top copy has no '포팅' wording`);
}
assert.doesNotMatch(simPage, /Streamlit/, "Asset simulator page top copy has no 'Streamlit' wording");

// 10. theme toggle / cloud sync / logout 관련 코드가 제거되지 않음
assert.match(topNav, /ThemeToggle/, "ThemeToggle is preserved");
assert.match(topNav, /StorageModeBadge/, "Cloud-sync badge is preserved");
assert.match(topNav, /LoginButton/, "LoginButton (logout) is preserved");

// 11. 즐겨찾기 URL sanitize 또는 javascript URL 방어 존재
assert.match(navFavorites, /isSafeFavoriteHref/, "URL safety helper exists");
assert.match(navFavorites, /javascript:/, "javascript: URLs are explicitly blocked");
assert.match(favMenu, /sanitizeFavoriteItems/, "FavoritesMenu sanitizes items before saving");

// 12. Firestore 저장 payload sanitize 또는 undefined 방어 존재
assert.match(repos, /sanitizeFirestorePayload\(\{[\s\S]*items:/, "saveNavFavorites sanitizes payload");

// package.json script 등록
assert.equal(
  pkg.scripts["check:nav-favorites-calculator-menu"],
  "node scripts/check-nav-favorites-calculator-menu.mjs",
  "package script is registered",
);

console.log("nav favorites + calculator menu checks passed");
