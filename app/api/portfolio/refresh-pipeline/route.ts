// =============================================================
// /api/portfolio/refresh-pipeline
//
// Server-only bridge that lets the Portfolio Manager "최신화" button run the
// FULL data pipeline (Gmail -> Excel -> Firestore) with one click, WITHOUT the
// user ever visiting the GitHub Actions UI.
//
//   POST  -> triggers the `bs-report-auto` workflow via GitHub's
//            workflow_dispatch REST API (ref = main) and returns a `since`
//            timestamp the client uses to locate the run it just started.
//   GET    ?since=<ISO>  -> finds the workflow_dispatch run created at/after
//            `since` and reports its status / conclusion / html_url so the
//            client can poll until completion.
//
// SECURITY (requirements 11 & 12): the GitHub token and every GitHub API call
// live ONLY here on the server. The token is read from the GITHUB_TOKEN env var
// (never hardcoded, never sent to the browser). The client only ever sees the
// run status and the public html_url of the run.
//
// This route NEVER throws to the client: it always responds 200 with a
// discriminated body so the UI can degrade gracefully.
// =============================================================

import { NextResponse } from "next/server";

// Always run live; never statically cache a dispatch/poll response.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const GITHUB_API = "https://api.github.com";
// The branch the workflow is dispatched against (requirement 1).
const WORKFLOW_REF = "main";

type GithubConfig = {
  token: string;
  owner: string;
  repo: string;
  workflow: string;
};

type ConfigResult =
  | { ok: true; config: GithubConfig }
  | { ok: false; missing: string[] };

/**
 * Read the GitHub configuration from env (requirement 11). All four values are
 * required; we return which ones are missing so misconfiguration is obvious in
 * the response/logs WITHOUT leaking the token value itself.
 */
function readConfig(): ConfigResult {
  const token = process.env.GITHUB_TOKEN ?? "";
  const owner = process.env.GITHUB_OWNER ?? "";
  const repo = process.env.GITHUB_REPO ?? "";
  const workflow = process.env.GITHUB_WORKFLOW ?? "";

  const missing: string[] = [];
  if (!token) missing.push("GITHUB_TOKEN");
  if (!owner) missing.push("GITHUB_OWNER");
  if (!repo) missing.push("GITHUB_REPO");
  if (!workflow) missing.push("GITHUB_WORKFLOW");

  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, config: { token, owner, repo, workflow } };
}

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gorani-portfolio-refresh",
  };
}

// -------------------------------------------------------------
// POST -> trigger the workflow (workflow_dispatch on main).
// GitHub's dispatch endpoint returns 204 with NO run id, so we hand the client
// a `since` anchor (a little before "now", to absorb clock skew) which the GET
// poller uses to identify the run that this dispatch created.
// -------------------------------------------------------------
type TriggerResponse =
  | { ok: true; since: string }
  | { ok: false; code: string; message?: string };

export async function POST(): Promise<NextResponse<TriggerResponse>> {
  const cfg = readConfig();
  if (!cfg.ok) {
    return NextResponse.json({
      ok: false,
      code: "config-missing",
      message: `Missing env: ${cfg.missing.join(", ")}`,
    });
  }

  const { token, owner, repo, workflow } = cfg.config;
  // Anchor 60s in the past so the run is never missed due to clock differences
  // between this server and GitHub.
  const since = new Date(Date.now() - 60_000).toISOString();

  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(
      workflow,
    )}/dispatches`;
    const res = await fetch(url, {
      method: "POST",
      headers: githubHeaders(token),
      body: JSON.stringify({ ref: WORKFLOW_REF }),
      cache: "no-store",
    });

    // 204 No Content = accepted. Anything else is a failure we surface.
    if (res.status === 204) {
      return NextResponse.json({ ok: true, since });
    }

    const text = await res.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.error("[refresh-pipeline] dispatch failed", { status: res.status, body: text });
    return NextResponse.json({
      ok: false,
      code: `dispatch-failed-${res.status}`,
      message: text.slice(0, 300),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[refresh-pipeline] dispatch error", error);
    return NextResponse.json({ ok: false, code: "dispatch-error" });
  }
}

// -------------------------------------------------------------
// GET ?since=<ISO> -> poll the run state.
// Lists recent workflow_dispatch runs on `main` for the configured workflow and
// picks the newest run created at/after `since` (the run this session started).
// -------------------------------------------------------------
type RunStatus = "queued" | "in_progress" | "completed";
type StatusResponse =
  | {
      ok: true;
      found: boolean;
      runId: number | null;
      status: RunStatus | string | null;
      conclusion: string | null;
      runUrl: string | null;
    }
  | { ok: false; code: string };

type WorkflowRun = {
  id: number;
  status: string | null;
  conclusion: string | null;
  html_url: string;
  created_at: string;
};

export async function GET(request: Request): Promise<NextResponse<StatusResponse>> {
  const cfg = readConfig();
  if (!cfg.ok) {
    return NextResponse.json({ ok: false, code: "config-missing" });
  }

  const sinceParam = new URL(request.url).searchParams.get("since");
  const sinceMs = sinceParam ? new Date(sinceParam).getTime() : NaN;

  const { token, owner, repo, workflow } = cfg.config;

  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(
      workflow,
    )}/runs?event=workflow_dispatch&branch=${WORKFLOW_REF}&per_page=15`;
    const res = await fetch(url, {
      method: "GET",
      headers: githubHeaders(token),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error("[refresh-pipeline] runs query failed", { status: res.status, body: text });
      return NextResponse.json({ ok: false, code: `runs-failed-${res.status}` });
    }

    const body = (await res.json()) as { workflow_runs?: WorkflowRun[] };
    const runs = Array.isArray(body.workflow_runs) ? body.workflow_runs : [];

    // Keep only runs created at/after the anchor (the one we just dispatched),
    // newest first. If `since` is unparseable, fall back to the newest run.
    const candidates = runs
      .filter((run) => {
        if (Number.isNaN(sinceMs)) return true;
        return new Date(run.created_at).getTime() >= sinceMs;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const run = candidates[0];
    if (!run) {
      // The run has not appeared in the API yet (dispatch is still registering).
      return NextResponse.json({
        ok: true,
        found: false,
        runId: null,
        status: null,
        conclusion: null,
        runUrl: null,
      });
    }

    return NextResponse.json({
      ok: true,
      found: true,
      runId: run.id,
      status: run.status,
      conclusion: run.conclusion,
      runUrl: run.html_url,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[refresh-pipeline] runs query error", error);
    return NextResponse.json({ ok: false, code: "runs-error" });
  }
}
