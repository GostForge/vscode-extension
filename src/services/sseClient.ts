import * as http from "http";
import * as https from "https";
import { URL } from "url";

export interface SseCallbacks {
  onStatus: (status: string, queuePosition?: number) => void;
  onComplete: (status: string) => void;
  onError: (message: string) => void;
}

/**
 * Connect to an SSE endpoint and dispatch events via callbacks.
 * Returns a function to abort the connection.
 */
export function connectSse(
  url: string,
  token: string,
  callbacks: SseCallbacks
): () => void {
  const parsedUrl = new URL(url);
  const mod = parsedUrl.protocol === "https:" ? https : http;

  const req = mod.get(
    {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
    },
    (res) => {
      if (res.statusCode !== 200) {
        callbacks.onError(`SSE connection failed: HTTP ${res.statusCode}`);
        return;
      }

      let buffer = "";

      res.setEncoding("utf-8");
      res.on("data", (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "message";
        let currentData = "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            currentData = line.slice(5).trim();
          } else if (line === "") {
            // Empty line = end of event
            if (currentData) {
              handleEvent(currentEvent, currentData, callbacks);
            }
            currentEvent = "message";
            currentData = "";
          }
        }
      });

      res.on("end", () => {
        // Stream closed by server — usually means job finished
      });

      res.on("error", (err) => {
        callbacks.onError(`SSE error: ${err.message}`);
      });
    }
  );

  req.on("error", (err) => {
    callbacks.onError(`SSE request error: ${err.message}`);
  });

  return () => req.destroy();
}

function handleEvent(event: string, data: string, callbacks: SseCallbacks): void {
  try {
    const parsed = JSON.parse(data);

    switch (event) {
      case "status":
      case "message":
        if (parsed.status === "COMPLETED" || parsed.status === "FAILED") {
          callbacks.onComplete(parsed.status);
        } else {
          callbacks.onStatus(parsed.status, parsed.queuePosition);
        }
        break;
      case "complete":
        callbacks.onComplete(parsed.status ?? "COMPLETED");
        break;
      case "error":
        callbacks.onError(parsed.message ?? parsed.errorMessage ?? "Unknown error");
        break;
      default:
        // Treat unknown events as status updates
        callbacks.onStatus(parsed.status ?? event, parsed.queuePosition);
    }
  } catch {
    // Non-JSON data, try plain text
    if (data.includes("COMPLETED")) {
      callbacks.onComplete("COMPLETED");
    } else if (data.includes("FAILED")) {
      callbacks.onError(data);
    } else {
      callbacks.onStatus(data);
    }
  }
}
