// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default endpoint: the DAO.CAFE handler mounted in your own app.
 * See `createDaoCafeHandler` in `daocafe-sdk/server`.
 */
export const DEFAULT_ENDPOINT = "/api/daocafe";

/** How long after `markFresh()` requests ask the server to bypass its cache */
const FRESH_WINDOW_MS = 20_000;

// ============================================================================
// TYPES
// ============================================================================

/** Operations understood by the DAO.CAFE server handler */
export type DaoCafeOperation =
  | "daos"
  | "dao"
  | "proposals"
  | "proposal"
  | "votes"
  | "vote"
  | "delegates"
  | "delegate"
  | "tokenHolders"
  | "tokenHolder";

export interface DaoCafeClientOptions {
  /** Headers sent with every request */
  headers?: Record<string, string>;
  /** Custom fetch implementation (defaults to global fetch) */
  fetch?: typeof fetch;
}

// ============================================================================
// FRESHNESS
// ============================================================================

let freshUntil = 0;

/**
 * Ask the server to skip its cache for the next few seconds.
 * Call this right after a transaction (vote, proposal, delegation) is mined so
 * the next fetches include it. `refreshDaoCafe` does this for you.
 */
export function markFresh(durationMs: number = FRESH_WINDOW_MS): void {
  freshUntil = Date.now() + durationMs;
}

// ============================================================================
// CLIENT
// ============================================================================

/**
 * Minimal HTTP client for the DAO.CAFE server handler.
 */
export class DaoCafeClient {
  private endpoint: string;
  private headers: Record<string, string>;
  private readonly fetchFn?: typeof fetch;

  constructor(endpoint: string = DEFAULT_ENDPOINT, options: DaoCafeClientOptions = {}) {
    this.endpoint = endpoint;
    this.headers = { ...options.headers };
    this.fetchFn = options.fetch;
  }

  /** Change the endpoint this client sends requests to */
  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }

  /** Replace the headers sent with every request */
  setHeaders(headers: Record<string, string>): void {
    this.headers = { ...headers };
  }

  async request<T>(op: DaoCafeOperation, params: object = {}): Promise<T> {
    const query = new URLSearchParams({ op, params: JSON.stringify(params) });
    if (Date.now() < freshUntil) query.set("fresh", "1");

    const separator = this.endpoint.includes("?") ? "&" : "?";
    const fetchFn = this.fetchFn ?? fetch;
    const response = await fetchFn(`${this.endpoint}${separator}${query.toString()}`, {
      headers: { accept: "application/json", ...this.headers },
    });

    let body: { data?: T; error?: string };
    try {
      body = (await response.json()) as { data?: T; error?: string };
    } catch {
      throw new Error(`DAO.CAFE request failed (${response.status})`);
    }
    if (!response.ok || body.error !== undefined) {
      throw new Error(body.error ?? `DAO.CAFE request failed (${response.status})`);
    }
    return body.data as T;
  }
}

/**
 * Default client instance pointing to `/api/daocafe` on the current origin
 */
export const daoCafeClient = new DaoCafeClient();

/**
 * Create a client with a different endpoint or options
 *
 * @param endpoint - Handler URL (defaults to /api/daocafe)
 * @param options - Headers or a custom fetch implementation
 * @returns Configured DaoCafeClient instance
 *
 * @example
 * ```ts
 * // Use default endpoint
 * const client = createClient();
 *
 * // Absolute URL (e.g. for server-side rendering)
 * const client = createClient("https://createdao.org/api/daocafe");
 * ```
 */
export function createClient(
  endpoint: string = DEFAULT_ENDPOINT,
  options?: DaoCafeClientOptions
): DaoCafeClient {
  return new DaoCafeClient(endpoint, options);
}

/**
 * Set request headers on the default client
 *
 * @param headers - Headers to set on all requests
 */
export function setClientHeaders(headers: Record<string, string>): void {
  daoCafeClient.setHeaders(headers);
}

/**
 * Point the default client (used by all hooks) at a different endpoint
 *
 * @param endpoint - Handler URL
 */
export function setDefaultEndpoint(endpoint: string): void {
  daoCafeClient.setEndpoint(endpoint);
}
