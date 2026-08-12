/**
 * Multipart upload with XHR progress reporting.
 * Consumed by B4's useUpload, which passes an UploadReport
 * { signal, start, advance, fail } to feed per-file progress.
 */

import { API_BASE } from "@/lib/hooks/apiBase";
import { ApiError, parseError } from "./client";
import type { UploadResponse } from "./types";

export type UploadProgressHandler = (uploadedBytes: number, totalBytes: number) => void;

/**
 * Upload files (with parallel relative paths) to /api/uploads.
 * Reports aggregate byte progress via onProgress and honors `signal` for abort.
 */
export function uploadFiles(files: File[], paths: string[], sessionId?: string, onProgress?: UploadProgressHandler, signal?: AbortSignal): Promise<UploadResponse> {
  const form = new FormData();
  files.forEach((file, index) => {
    form.append("files", file, paths[index] ?? file.name);
  });
  form.append("paths", JSON.stringify(paths));
  if (sessionId) form.append("session_id", sessionId);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/uploads`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResponse);
        } catch {
          reject(new ApiError("Invalid upload response", "unknown", xhr.status));
        }
      } else {
        reject(parseError(xhr.status, xhr.responseText));
      }
    };

    xhr.onerror = () => reject(new ApiError("Network error", "network"));
    xhr.onabort = () => reject(new ApiError("Upload aborted", "unknown"));
    xhr.ontimeout = () => reject(new ApiError("Upload timed out", "network"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
      } else {
        signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }
    }

    xhr.send(form);
  });
}
