"use client";

// =============================================================
// One-click "최신화" pipeline orchestration (client side).
//
// Upgrades the Portfolio Manager refresh from "just re-read Firestore" to the
// FULL pipeline, without the user ever opening GitHub Actions:
//
//   click 최신화
//     -> POST /api/portfolio/refresh-pipeline            (workflow_dispatch, main)
//     -> poll GET /api/portfolio/refresh-pipeline?since= (every ~12s)
//     -> on workflow success: applyLatestFirestoreSnapshot()
//        (re-fetch /api/portfolio/latest-snapshot and publish into the same
//         Firestore snapshot store the screen already reads — single source
//         preserved, no F5 needed).
//
// All GitHub API calls happen server-side in the API route; this hook only ever
// talks to our own routes, so the GitHub token never reaches the browser.
//
// Phases drive the status UI (requirement 4). A hard 5-minute timeout (req. 10)
// and a duplicate-run guard (req. 2) are enforced here.
// =============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyLatestFirestoreSnapshot,
  type PortfolioRefreshOutcome,
} from "./portfolio-firestore-snapshot-sync";

const ENDPOINT = "/api/portfolio/refresh-pipeline";
// 12s poll interval — well within the recommended 10~15s window (req. 3):
// snappier UX than 30s while keeping GitHub API usage tiny.
const POLL_INTERVAL_MS = 12_000;
// Hard cap on the whole wait (req. 10).
const TIMEOUT_MS = 5 * 60_000;

export type PipelinePhase =
  | "idle"
  | "dispatching" // POST trigger in flight ("작업을 시작했습니다.")
  | "queued" // run accepted, waiting to start ("실행 대기 중...")
  | "running" // workflow in progress ("최신 데이터를 생성하고 있습니다...")
  | "applying" // workflow succeeded, re-reading Firestore
  | "done" // finished -> see `outcome`
  | "failed" // workflow failed / dispatch failed
  | "timeout"; // exceeded 5 minutes

export interface PipelineState {
  phase: PipelinePhase;
  /** Set only when phase === "done" (updated | unchanged | error). */
  outcome: PortfolioRefreshOutcome | null;
  /** Public GitHub run URL, for the "GitHub Actions 로그 보기" button on failure. */
  runUrl: string | null;
}

export interface PipelineController {
  state: PipelineState;
  /** True while the pipeline is actively running (drives the disabled button). */
  isBusy: boolean;
  /** Start the full pipeline. Ignored while a run is already in progress. */
  start: () => Promise<void>;
  /** Reset back to idle (used to auto-dismiss the success/info message). */
  reset: () => void;
}

const IDLE_STATE: PipelineState = { phase: "idle", outcome: null, runUrl: null };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBusyPhase(phase: PipelinePhase): boolean {
  return (
    phase === "dispatching" ||
    phase === "queued" ||
    phase === "running" ||
    phase === "applying"
  );
}

export function usePortfolioPipelineRefresh(): PipelineController {
  const [state, setState] = useState<PipelineState>(IDLE_STATE);

  // Guard against overlapping pipelines (double-click / concurrent triggers).
  const inFlight = useRef(false);
  // Set false on unmount so the long-running loop stops updating state.
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const safeSet = useCallback((next: PipelineState) => {
    if (aliveRef.current) setState(next);
  }, []);

  const reset = useCallback(() => {
    if (inFlight.current) return; // never reset mid-run
    safeSet(IDLE_STATE);
  }, [safeSet]);

  const start = useCallback(async () => {
    if (inFlight.current) return; // duplicate-run guard (requirement 2)
    inFlight.current = true;
    safeSet({ phase: "dispatching", outcome: null, runUrl: null });

    let runUrl: string | null = null;

    try {
      // 1) Trigger workflow_dispatch (server performs the GitHub call).
      const triggerRes = await fetch(ENDPOINT, { method: "POST", cache: "no-store" });
      const triggerBody = (await triggerRes.json().catch(() => null)) as
        | { ok: boolean; since?: string; code?: string }
        | null;

      if (!triggerRes.ok || !triggerBody?.ok || !triggerBody.since) {
        safeSet({ phase: "failed", outcome: null, runUrl: null });
        return;
      }
      const since = triggerBody.since;

      // 2) Poll the run status until completion or timeout.
      safeSet({ phase: "queued", outcome: null, runUrl: null });
      const deadline = Date.now() + TIMEOUT_MS;

      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        if (!aliveRef.current) return;

        const statusRes = await fetch(
          `${ENDPOINT}?since=${encodeURIComponent(since)}`,
          { cache: "no-store" },
        );
        const statusBody = (await statusRes.json().catch(() => null)) as
          | {
              ok: boolean;
              found?: boolean;
              status?: string | null;
              conclusion?: string | null;
              runUrl?: string | null;
            }
          | null;

        // Transient poll failure: keep waiting (don't abort the whole pipeline).
        if (!statusRes.ok || !statusBody?.ok) continue;
        if (statusBody.runUrl) runUrl = statusBody.runUrl;

        if (!statusBody.found) {
          // Dispatch still registering — stay in queued state.
          safeSet({ phase: "queued", outcome: null, runUrl });
          continue;
        }

        if (statusBody.status === "completed") {
          if (statusBody.conclusion === "success") {
            // 3) Workflow succeeded -> pull the freshly written Firestore
            //    snapshot through the existing single-source path.
            safeSet({ phase: "applying", outcome: null, runUrl });
            const outcome = await applyLatestFirestoreSnapshot();
            safeSet({ phase: "done", outcome, runUrl });
            return;
          }
          // failure / cancelled / timed_out / etc.
          safeSet({ phase: "failed", outcome: null, runUrl });
          return;
        }

        if (statusBody.status === "in_progress") {
          safeSet({ phase: "running", outcome: null, runUrl });
        } else {
          // queued / waiting / pending / requested
          safeSet({ phase: "queued", outcome: null, runUrl });
        }
      }

      // 4) Exceeded the 5-minute budget (requirement 10).
      safeSet({ phase: "timeout", outcome: null, runUrl });
    } catch {
      safeSet({ phase: "failed", outcome: null, runUrl });
    } finally {
      inFlight.current = false;
    }
  }, [safeSet]);

  return { state, isBusy: isBusyPhase(state.phase), start, reset };
}
