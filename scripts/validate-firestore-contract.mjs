#!/usr/bin/env node

// =============================================================
// Developer-only live-contract validation command (Phase F, Blocker 3).
//
// Validate a REAL Firestore portfolio contract document without enabling the
// feature flag, without writes, and without production credentials.
//
// Workflow for a developer:
//   1. In the Firebase console (or `firebase firestore:get`), open one document
//      under users/{uid}/portfolioContract and export it to a JSON file.
//   2. Run:
//        npm run validate:firestore-contract -- ./path/to/contract-doc.json
//
// The command validates document_version, required fields, and authoritative
// total consistency, then prints every mismatch. READ ONLY.
// =============================================================

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
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { validateContractDocument } = require("../lib/firestore-portfolio-validate.ts");

function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: npm run validate:firestore-contract -- <path-to-contract-doc.json>");
    process.exit(2);
  }
  const absPath = path.isAbsolute(fileArg) ? fileArg : path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(2);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch (err) {
    console.error(`Could not parse JSON: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }

  const report = validateContractDocument(raw, { documentId: path.basename(absPath) });

  console.log("\nFirestore contract document validation");
  console.log("--------------------------------------");
  console.log(`document:        ${report.documentId}`);
  console.log(`document_version: ${report.documentVersion ?? "(none)"}`);
  console.log(`fields checked:  ${report.checkedFields}`);
  console.log(`result:          ${report.ok ? "OK (no errors)" : "FAILED (has errors)"}`);

  if (report.issues.length === 0) {
    console.log("\nNo issues. Document is valid and totals are internally consistent.");
  } else {
    console.log(`\n${report.issues.length} issue(s):`);
    console.table(report.issues);
  }

  // Exit non-zero only on hard errors; warnings (divergence) do not fail the
  // command but are surfaced for the developer.
  process.exit(report.ok ? 0 : 1);
}

main();
