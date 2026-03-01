/** Response from POST /convert/quick/check-hashes */
export interface CheckHashesResponse {
  missing: string[];
}

/** Response from POST /convert/quick (job submission) */
export interface JobStatusResponse {
  jobId: string;
  status: string;
  queuePosition?: number;
  outputFormat?: string;
  errorStage?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
  warnings?: string[];
}

/** SSE event from /convert/quick/jobs/{jobId}/stream */
export interface SseEvent {
  event: string;
  data: string;
}

/** Manifest: relative path → SHA-256 hex hash */
export type Manifest = Record<string, string>;

/** File entry with path and bytes */
export interface FileEntry {
  path: string;
  data: Buffer;
}
