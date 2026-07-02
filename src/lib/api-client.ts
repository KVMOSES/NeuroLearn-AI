/**
 * Typed API client for the frontend. Handles JSON + SSE streaming.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}
export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

async function request<T>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    credentials: "include",
  });

  let json: ApiResponse<T> | null = null;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Request to ${path} returned non-JSON response (${res.status})`);
  }

  if (json === null) {
    throw new Error(`Request to ${path} returned null response`);
  }

  if (!json.success) {
    // Narrow type to ApiFailure
    const failure = json as ApiFailure;
    const err = new Error(failure.error.message) as Error & { code?: string; status?: number };
    err.code = failure.error.code;
    err.status = res.status;
    throw err;
  }
  // Narrow type to ApiSuccess<T>
  const success = json as ApiSuccess<T>;
  return success.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
};

/**
 * Stream an SSE endpoint. Calls onToken for each delta and onDone when complete.
 */
export async function streamSSE(
  path: string,
  body: unknown,
  handlers: {
    onToken: (delta: string) => void;
    onDone?: (meta: Record<string, unknown>) => void;
    onError?: (message: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
    signal,
  });

  if (!res.ok || !res.body) {
    handlers.onError?.(`Stream failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";
      for (const block of lines) {
        const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (!payload) continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "token") handlers.onToken(evt.value);
          else if (evt.type === "done") handlers.onDone?.(evt);
          else if (evt.type === "error") handlers.onError?.(evt.message);
        } catch {
          // ignore malformed
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      handlers.onError?.((err as Error).message);
    }
  }
}
