export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

/** status 0 means the request never got a response (offline, DNS, CORS, server down). */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function getJson<T>(path: string, params?: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const query = params?.toString();
  const url = API_URL + path + (query ? `?${query}` : '');

  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    // Let React Query see cancellations as cancellations.
    if (signal?.aborted) throw error;
    throw new ApiError(0, "Couldn't reach the server. Check your connection and that the API is running.");
  }

  if (!response.ok) {
    let message = `The server returned an error (${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        message = body.error;
      }
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

/** Network failures, rate limits and 5xx are worth retrying; other 4xx will fail the same way again. */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}

export const MAX_RETRIES = 3;

export function retryDelay(attempt: number): number {
  return Math.min(400 * 2 ** attempt, 4000);
}
