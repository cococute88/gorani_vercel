#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = require("typescript");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(rootDir, request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");
const auth = read("lib/firebase/auth.ts");
const repos = read("lib/firebase/firestore-repositories.ts");
const store = read("lib/portfolio-store.ts");
const sync = read("lib/portfolio-cloud-sync.tsx");
const loginButton = read("components/auth/LoginButton.tsx");
const history = read("components/portfolio/SnapshotHistory.tsx");
const badge = read("components/common/StorageModeBadge.tsx");

assert.match(auth, /browserLocalPersistence/, "Auth uses browserLocalPersistence");
assert.match(auth, /setPersistence\(firebaseAuth, browserLocalPersistence\)/, "local persistence is set explicitly");
assert.match(auth, /getRedirectResult\((firebaseAuth|auth)\)/, "redirect result handler exists");
assert.match(auth, /signInWithRedirect\(firebaseAuth, provider\)/, "mobile/blocked-popup redirect sign-in path exists");
assert.match(auth, /signInWithPopup\(firebaseAuth, provider\)/, "desktop popup sign-in path remains available");

const savePath = repos.match(/doc\(requireDb\(\), "users", uid, "portfolioSnapshots", snapshot\.id\)/)?.[0];
const loadPath = repos.match(/collection\(requireDb\(\), "users", uid, "portfolioSnapshots"\)/)?.[0];
assert.ok(savePath, "Firestore save path uses users/{uid}/portfolioSnapshots/{snapshot.id}");
assert.ok(loadPath, "Firestore load path uses users/{uid}/portfolioSnapshots");

const { mergePortfolioSnapshots } = require("../lib/portfolio-store.ts");
const local = [{ id: "local-1", snapshotDate: "2026-06-01", holdings: [], financeAssets: [] }];
const cloud = [{ id: "cloud-1", snapshotDate: "2026-06-01", holdings: [], financeAssets: [] }, { id: "cloud-2", snapshotDate: "2026-06-02", holdings: [], financeAssets: [] }];
const merged = mergePortfolioSnapshots(local, cloud);
assert.equal(merged.length, 2, "local/cloud merge dedupes by snapshotDate");
assert.equal(merged.find((item) => item.snapshotDate === "2026-06-01")?.id, "cloud-1", "cloud wins duplicate dates");
assert.deepEqual(mergePortfolioSnapshots(local, []), local, "cloud empty does not discard local snapshots");

assert.match(sync, /localOnlySnapshots/, "sync uploads snapshots present locally but missing in cloud");
assert.match(sync, /replaceSnapshots\(merged\)/, "sync writes merged local+cloud snapshots to local cache");
assert.match(sync, /status: "auth-loading"/, "auth loading state exists before empty state");
assert.match(history, /로그인\/클라우드 스냅샷을 확인 중입니다\./, "snapshot history has loading message instead of premature empty state");
assert.match(loginButton, /const label = signedIn \? "Logout"/, "signed-in logout label is Logout");
assert.match(loginButton, /whitespace-nowrap/, "logout button prevents text wrapping/truncation");
assert.match(badge, /Firebase 미설정 · 로컬 저장/, "Firebase-unconfigured badge label exists");
assert.match(badge, /로그인 필요 · 로컬 저장/, "signed-out configured badge label exists");
assert.match(badge, /클라우드 동기화/, "signed-in cloud sync badge label exists");
assert.match(sync, /status: "failed"/, "sync failure status keeps local fallback visible to code");

console.log("AUTH-FIRESTORE-PERSISTENCE-1 checks passed");
