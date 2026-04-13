import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ApiClient } from "../api/client";
import { scanAndHash, filterMissing } from "../services/hasher";
import { connectSse } from "../services/sseClient";
import { StatusBarManager } from "../ui/statusBar";
import type { FileEntry } from "../api/types";
import * as T from "../localization/texts";

const MAX_STALE_RETRIES = 2;

/**
 * Find all gostforge.yml project roots in the workspace.
 */
function findProjectRoots(): string[] {
  const roots: string[] = [];
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return roots;
  }

  for (const folder of workspaceFolders) {
    searchForConfigs(folder.uri.fsPath, roots, 0);
  }
  return roots;
}

function searchForConfigs(dir: string, roots: string[], depth: number): void {
  if (depth > 10) { return; } // safety limit

  const configPath = path.join(dir, "gostforge.yml");
  if (fs.existsSync(configPath)) {
    roots.push(dir);
    return; // Don't recurse into nested projects
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) { continue; }
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "out") {
        continue;
      }
      searchForConfigs(path.join(dir, entry.name), roots, depth + 1);
    }
  } catch {
    // Permission or other error, skip
  }
}

/**
 * Main convert command: scan → hash → check-hashes → upload → SSE → download
 * Returns job info for history tracking.
 */
export async function convertQuickCommand(
  api: ApiClient,
  statusBar: StatusBarManager,
  outputFormat: string
): Promise<{ jobId: string; status: string; warnings: string[] } | undefined> {
  // 1. Find project roots
  const roots = findProjectRoots();
  if (roots.length === 0) {
    vscode.window.showWarningMessage(T.CONVERT_NO_PROJECT);
    return;
  }

  // 2. Pick project if multiple
  let projectRoot: string;
  if (roots.length === 1) {
    projectRoot = roots[0];
  } else {
    const items = roots.map((r) => ({
      label: path.basename(r),
      description: r,
      root: r,
    }));
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: T.CONVERT_PICK_PROJECT,
    });
    if (!picked) {
      return;
    }
    projectRoot = picked.root;
  }

  // 3. Check token
  const token = await api.getToken();
  if (!token) {
    vscode.window.showErrorMessage(T.TOKEN_MISSING_MSG);
    return;
  }

  statusBar.setBusy(T.CONVERT_SCANNING);

  try {
    // 4. Scan project and compute hashes
    const { manifest, fileMap } = await scanAndHash(projectRoot);
    const fileCount = Object.keys(manifest).length;

    if (fileCount === 0) {
      vscode.window.showWarningMessage(T.CONVERT_NO_FILES);
      statusBar.setIdle();
      return;
    }

    // Validate required source type for selected conversion mode.
    const hasMd = Object.keys(manifest).some((p) => p.endsWith(".md"));
    const hasDocx = Object.keys(manifest).some((p) => p.endsWith(".docx"));
    if (outputFormat === "MARKDOWN") {
      if (!hasDocx) {
        vscode.window.showWarningMessage(T.CONVERT_NO_DOCX);
        statusBar.setIdle();
        return;
      }
    } else {
      if (!hasMd) {
        vscode.window.showWarningMessage(T.CONVERT_NO_MD);
        statusBar.setIdle();
        return;
      }
    }

    statusBar.setBusy(T.CONVERT_CHECKING(fileCount));

    // 5. Check which files need uploading
    const { missing } = await api.checkHashes(manifest);
    const missingFiles = filterMissing(fileMap, missing);

    statusBar.setBusy(
      missing.length > 0
        ? T.CONVERT_UPLOADING(missing.length)
        : T.CONVERT_ALL_CACHED
    );

    // 6. Submit job (with STALE_CACHE retry)
    let jobResponse = await submitWithRetry(
      api, manifest, missingFiles, fileMap, outputFormat
    );

    statusBar.setBusy(T.CONVERT_QUEUED(jobResponse.status));

    // 7. Poll/SSE for completion
    const finalStatus = await waitForCompletion(api, jobResponse.jobId, token, statusBar);

    if (finalStatus !== "COMPLETED") {
      statusBar.setError(T.CONVERT_FAILED(finalStatus));
      vscode.window.showErrorMessage(T.CONVERT_FAILED(finalStatus));
      return { jobId: jobResponse.jobId, status: finalStatus, warnings: [] };
    }

    // 7b. Fetch warnings from the completed job
    let warnings: string[] = [];
    try {
      const finalJob = await api.getJobStatus(jobResponse.jobId);
      warnings = finalJob.warnings ?? [];
    } catch {
      // Non-critical, continue
    }

    // 8. Download results to out/
    const outDir = path.join(projectRoot, "out");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const formats = outputFormat === "BOTH"
      ? ["docx", "pdf"]
      : outputFormat === "MARKDOWN"
        ? ["zip"]
        : [outputFormat.toLowerCase()];
    for (const fmt of formats) {
      statusBar.setBusy(T.CONVERT_DOWNLOADING(fmt.toUpperCase()));
      try {
        const data = await api.downloadResult(jobResponse.jobId, fmt);
        const outName = fmt === "zip" ? "result.zip" : `result.${fmt}`;
        const outPath = path.join(outDir, outName);
        fs.writeFileSync(outPath, data);
      } catch (e: any) {
        vscode.window.showWarningMessage(T.CONVERT_DOWNLOAD_FAILED(fmt, e.message));
      }
    }

    statusBar.setDone();
    const relOut = path.relative(
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "",
      outDir
    );
    vscode.window.showInformationMessage(T.CONVERT_SUCCESS(relOut));
    return { jobId: jobResponse.jobId, status: "COMPLETED", warnings };
  } catch (e: any) {
    statusBar.setError(e.message);
    vscode.window.showErrorMessage(T.CONVERT_ERROR(e.message));
    return undefined;
  }
}

/**
 * Submit with automatic STALE_CACHE retry.
 */
async function submitWithRetry(
  api: ApiClient,
  manifest: Record<string, string>,
  missingFiles: FileEntry[],
  fileMap: Map<string, Buffer>,
  outputFormat: string,
  attempt = 0
): ReturnType<ApiClient["submitJob"]> {
  try {
    return await api.submitJob(manifest, missingFiles, outputFormat);
  } catch (e: any) {
    if (e.message === "STALE_CACHE" && attempt < MAX_STALE_RETRIES) {
      // Re-upload the stale files
      const stalePaths: string[] = e.missingPaths ?? [];
      const extraFiles = filterMissing(fileMap, stalePaths);
      const allFiles = [...missingFiles, ...extraFiles];
      return submitWithRetry(api, manifest, allFiles, fileMap, outputFormat, attempt + 1);
    }
    throw e;
  }
}

/**
 * Wait for job completion using polling (fallback from SSE).
 */
async function waitForCompletion(
  api: ApiClient,
  jobId: string,
  token: string,
  statusBar: StatusBarManager
): Promise<string> {
  return new Promise<string>((resolve) => {
    let resolved = false;
    let abortSse: (() => void) | null = null;

    // Try SSE first
    try {
      const sseUrl = api.getSseUrl(jobId);
      abortSse = connectSse(sseUrl, token, {
        onStatus: (status, queuePos) => {
          statusBar.setBusy(T.CONVERT_STATUS(status, queuePos));
        },
        onComplete: (status) => {
          if (!resolved) {
            resolved = true;
            resolve(status);
          }
        },
        onError: (msg) => {
          // SSE failed, fall back to polling
          if (!resolved) {
            pollForCompletion(api, jobId, statusBar).then((s) => {
              if (!resolved) {
                resolved = true;
                resolve(s);
              }
            });
          }
        },
      });
    } catch {
      // SSE construction failed, use polling
      pollForCompletion(api, jobId, statusBar).then((s) => {
        if (!resolved) {
          resolved = true;
          resolve(s);
        }
      });
    }

    // Safety timeout: 5 minutes
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        abortSse?.();
        resolve("TIMEOUT");
      }
    }, 300_000);
  });
}

async function pollForCompletion(
  api: ApiClient,
  jobId: string,
  statusBar: StatusBarManager
): Promise<string> {
  const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED"]);
  for (let i = 0; i < 120; i++) {
    await sleep(2500);
    try {
      const status = await api.getJobStatus(jobId);
      if (TERMINAL_STATUSES.has(status.status)) {
        return status.status;
      }
      const posStr = status.queuePosition ? ` (#${status.queuePosition})` : "";
      statusBar.setBusy(T.CONVERT_STATUS(status.status, status.queuePosition));
    } catch {
      // Transient error, keep polling
    }
  }
  return "TIMEOUT";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
