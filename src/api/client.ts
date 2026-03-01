import * as vscode from "vscode";
import * as http from "http";
import * as https from "https";
import { URL } from "url";
import * as T from "../localization/texts";
import type {
  CheckHashesResponse,
  FileEntry,
  JobStatusResponse,
  Manifest,
} from "./types";

const PAT_KEY = "gostforge.pat";

export class ApiClient {
  private secretStorage: vscode.SecretStorage;

  constructor(secretStorage: vscode.SecretStorage) {
    this.secretStorage = secretStorage;
  }

  // ── Token management ──

  async getToken(): Promise<string | undefined> {
    return this.secretStorage.get(PAT_KEY);
  }

  async setToken(token: string): Promise<void> {
    await this.secretStorage.store(PAT_KEY, token);
  }

  async clearToken(): Promise<void> {
    await this.secretStorage.delete(PAT_KEY);
  }

  // ── Helpers ──

  private getServerUrl(): string {
    return (
      vscode.workspace
        .getConfiguration("gostforge")
        .get<string>("serverUrl") ?? "http://localhost:8080"
    );
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    if (!token) {
      throw new Error(T.TOKEN_MISSING_MSG);
    }
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Low-level HTTP request using Node built-in http/https.
   * Returns { status, headers, body }.
   */
  private request(
    method: string,
    urlStr: string,
    headers: Record<string, string>,
    body?: Buffer | string
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const mod = url.protocol === "https:" ? https : http;
      const opts: http.RequestOptions = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: { ...headers },
      };
      if (body) {
        (opts.headers as Record<string, string>)["Content-Length"] = Buffer.byteLength(body).toString();
      }
      const req = mod.request(opts, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        );
      });
      req.on("error", reject);
      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  // ── JSON helper ──

  /**
   * Parse response body as JSON.
   * If the server returns HTML (e.g. a proxy error page or wrong port),
   * throws a clear error instead of the confusing "Unexpected token '<'" message.
   */
  private parseJson<T>(
    res: { status: number; headers: http.IncomingHttpHeaders; body: Buffer }
  ): T {
    const ct = res.headers["content-type"] ?? "";
    const text = res.body.toString();
    if (!ct.includes("application/json") && (text.trimStart().startsWith("<") || text.trimStart().startsWith("<!DOCTYPE"))) {
      const serverUrl = this.getServerUrl();
      throw new Error(
        `Сервер вернул HTML вместо JSON (статус ${res.status}). ` +
        `Проверьте настройку «GostForge: Server URL» — ` +
        `сейчас: ${serverUrl}. ` +
        `Backend должен быть доступен на порту 8080.`
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        `Сервер вернул некорректный JSON (статус ${res.status}): ${text.slice(0, 120)}`
      );
    }
  }

  // ── API calls ──

  /**
   * POST /api/v1/convert/quick/check-hashes
   */
  async checkHashes(manifest: Manifest): Promise<CheckHashesResponse> {
    const url = `${this.getServerUrl()}/api/v1/convert/quick/check-hashes`;
    const auth = await this.authHeaders();
    const payload = JSON.stringify({ hashes: manifest });
    const res = await this.request("POST", url, {
      ...auth,
      "Content-Type": "application/json",
    }, payload);

    if (res.status !== 200) {
      const err = this.parseJson<{ message?: string; error?: string }>(res);
      throw new Error(`check-hashes failed (${res.status}): ${err.message ?? err.error}`);
    }
    return this.parseJson<CheckHashesResponse>(res);
  }

  /**
   * POST /api/v1/convert/quick — multipart/form-data with files[] + manifest + options
   */
  async submitJob(
    manifest: Manifest,
    missingFiles: FileEntry[],
    outputFormat: string
  ): Promise<JobStatusResponse> {
    const url = `${this.getServerUrl()}/api/v1/convert/quick`;
    const auth = await this.authHeaders();
    const boundary = `----GostForge${Date.now()}`;

    const parts: Buffer[] = [];
    const crlf = "\r\n";

    // files[] parts (only missing files)
    for (const file of missingFiles) {
      parts.push(Buffer.from(
        `--${boundary}${crlf}` +
        `Content-Disposition: form-data; name="files[]"; filename="${file.path}"${crlf}` +
        `Content-Type: application/octet-stream${crlf}${crlf}`
      ));
      parts.push(file.data);
      parts.push(Buffer.from(crlf));
    }

    // manifest part
    parts.push(Buffer.from(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="manifest"${crlf}` +
      `Content-Type: application/json${crlf}${crlf}` +
      JSON.stringify(manifest) + crlf
    ));

    // outputFormat part
    parts.push(Buffer.from(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="outputFormat"${crlf}${crlf}` +
      outputFormat + crlf
    ));

    // end
    parts.push(Buffer.from(`--${boundary}--${crlf}`));

    const body = Buffer.concat(parts);
    const res = await this.request("POST", url, {
      ...auth,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    }, body);

    if (res.status === 409) {
      // STALE_CACHE or ACTIVE_JOB
      const err = this.parseJson<{ status?: string; errorMessage?: string; message?: string; error?: string }>(res);
      if (err.status === "STALE_CACHE") {
        const staleError = new Error("STALE_CACHE") as Error & { missingPaths: string[] };
        staleError.missingPaths = (err.errorMessage ?? "").split(",");
        throw staleError;
      }
      throw new Error(`Conflict: ${err.message ?? err.error}`);
    }

    if (res.status !== 202) {
      const err = this.parseJson<{ message?: string; error?: string }>(res);
      throw new Error(`Submit failed (${res.status}): ${err.message ?? err.error}`);
    }
    return this.parseJson<JobStatusResponse>(res);
  }

  /**
   * GET /api/v1/convert/quick/jobs/{jobId}
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const url = `${this.getServerUrl()}/api/v1/convert/quick/jobs/${jobId}`;
    const auth = await this.authHeaders();
    const res = await this.request("GET", url, auth);

    if (res.status !== 200) {
      const err = this.parseJson<{ message?: string; error?: string }>(res);
      throw new Error(`Status failed (${res.status}): ${err.message ?? err.error}`);
    }
    return this.parseJson<JobStatusResponse>(res);
  }

  /**
   * GET /api/v1/convert/quick/jobs/{jobId}/download/{format}
   * Returns raw bytes of the converted file.
   */
  async downloadResult(jobId: string, format: string): Promise<Buffer> {
    const url = `${this.getServerUrl()}/api/v1/convert/quick/jobs/${jobId}/download/${format}`;
    const auth = await this.authHeaders();
    const res = await this.request("GET", url, auth);

    if (res.status !== 200) {
      throw new Error(`Download failed (${res.status})`);
    }
    return res.body;
  }

  /**
   * Returns SSE stream URL for job monitoring.
   */
  getSseUrl(jobId: string): string {
    return `${this.getServerUrl()}/api/v1/convert/quick/jobs/${jobId}/stream`;
  }
}
