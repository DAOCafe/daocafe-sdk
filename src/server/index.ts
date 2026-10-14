// ============================================================================
// DAOCAFE SDK - SERVER
// ============================================================================
// Reads CreateDAO governance data straight from the chain via RPC and serves
// it to the SDK's query functions and hooks. Mount it in your app:
//
//   // app/api/daocafe/route.ts (Next.js App Router)
//   import { createDaoCafeHandler } from "daocafe-sdk/server";
//   export const GET = createDaoCafeHandler({ rpcUrls: { 1: process.env.RPC_1 } });
//
//   // pages/api/daocafe.ts (Next.js Pages Router / Node http)
//   import { createDaoCafeNodeHandler } from "daocafe-sdk/server";
//   export default createDaoCafeNodeHandler({ rpcUrls: { 1: process.env.RPC_1 } });
// ============================================================================

import type { IncomingMessage, ServerResponse } from "node:http";
import type { DaoCafeOperation } from "../client";
import { DAOCAFE_DEPLOYMENTS, PUBLIC_RPC_URLS, type DaoCafeDeployment } from "./deployments";
import { QueryError, runQuery, type QueryContext } from "./queries";
import { createChainSync, type ChainSync, type Logger } from "./sync";

export { DAOCAFE_DEPLOYMENTS, FACTORY_ADDRESS, PUBLIC_RPC_URLS } from "./deployments";
export type { DaoCafeDeployment } from "./deployments";
export type { Logger } from "./sync";

const OPERATIONS = new Set<DaoCafeOperation>([
  "daos",
  "dao",
  "proposals",
  "proposal",
  "votes",
  "vote",
  "delegates",
  "delegate",
  "tokenHolders",
  "tokenHolder",
]);

/** Longest accepted `params` query value */
const MAX_PARAMS_LENGTH = 4_096;

export interface DaoCafeServerConfig {
  /**
   * RPC endpoint(s) per chain id, tried in order. Missing or empty entries are
   * skipped, so env vars can be passed directly.
   */
  rpcUrls?: Record<number, string | string[] | undefined>;
  /** Chains to serve (default: every chain in DAOCAFE_DEPLOYMENTS) */
  chains?: number[];
  /** Add or override deployments (required for chains not built in) */
  deployments?: Record<number, Partial<DaoCafeDeployment>>;
  /** Fall back to public RPCs after the configured ones (default true) */
  publicFallback?: boolean;
  /** Minimum time between two syncs of a chain in ms (default 15000) */
  minSyncIntervalMs?: number;
  /** Minimum time between two syncs when a client asks for fresh data (default 5000) */
  minFreshIntervalMs?: number;
  /**
   * Directory to persist synced events in, so restarts don't re-scan history.
   * Unset = memory only.
   */
  cacheDir?: string;
  /** Look up unknown proposal calldata selectors on 4byte.directory (default true) */
  fourByte?: boolean;
  /** Start syncing every chain as soon as the server is created (default true) */
  warmup?: boolean;
  /** `Cache-Control` max-age in seconds for non-fresh responses (default 5) */
  cacheMaxAge?: number;
  logger?: Logger;
}

export interface DaoCafeServer {
  /** Run one SDK operation */
  query(op: DaoCafeOperation, params?: Record<string, unknown>, options?: { fresh?: boolean }): Promise<unknown>;
  /** Sync every chain now */
  warmup(): Promise<void>;
  /** Handle a `GET ?op=...&params=...` request (Fetch API) */
  handleRequest(request: Request): Promise<Response>;
}

interface HandlerResult {
  status: number;
  body: { data?: unknown; error?: string };
  cacheControl: string;
}

function resolveChains(config: DaoCafeServerConfig, logger: Logger): Map<number, ChainSync> {
  const chainIds =
    config.chains ??
    [...new Set([...Object.keys(DAOCAFE_DEPLOYMENTS), ...Object.keys(config.deployments ?? {})].map(Number))];
  const syncs = new Map<number, ChainSync>();

  for (const chainId of chainIds) {
    const deployment = { ...DAOCAFE_DEPLOYMENTS[chainId], ...config.deployments?.[chainId] };
    if (!deployment.factory || deployment.startBlock === undefined) {
      logger.warn(`[daocafe] chain ${chainId}: no deployment known, skipping`);
      continue;
    }
    const configured = ([] as (string | undefined)[])
      .concat(config.rpcUrls?.[chainId])
      .filter((url): url is string => typeof url === "string" && url.trim() !== "");
    const rpcUrls = [...configured, ...(config.publicFallback === false ? [] : PUBLIC_RPC_URLS[chainId] ?? [])];
    if (rpcUrls.length === 0) {
      logger.warn(`[daocafe] chain ${chainId}: no RPC URL, skipping`);
      continue;
    }
    if (configured.length === 0) {
      logger.warn(`[daocafe] chain ${chainId}: no RPC URL configured, using public RPCs only`);
    }

    syncs.set(
      chainId,
      createChainSync({
        chainId,
        rpcUrls,
        deployment: {
          factory: deployment.factory,
          startBlock: BigInt(deployment.startBlock),
          confirmations: BigInt(deployment.confirmations ?? 0n),
        },
        minSyncIntervalMs: config.minSyncIntervalMs ?? 15_000,
        minFreshIntervalMs: config.minFreshIntervalMs ?? 5_000,
        cacheDir: config.cacheDir,
        logger,
      }),
    );
  }
  return syncs;
}

function createServer(config: DaoCafeServerConfig): DaoCafeServer {
  const logger = config.logger ?? console;
  const ctx: QueryContext = {
    syncs: resolveChains(config, logger),
    decoder: { fourByte: config.fourByte ?? true },
    logger,
  };
  const maxAge = config.cacheMaxAge ?? 5;

  const query: DaoCafeServer["query"] = (op, params = {}, options = {}) =>
    runQuery(ctx, op, params, options.fresh ?? false);

  const warmup = async () => {
    await Promise.allSettled([...ctx.syncs.values()].map((sync) => sync.sync()));
  };

  async function handle(url: URL): Promise<HandlerResult> {
    const op = url.searchParams.get("op") as DaoCafeOperation | null;
    const rawParams = url.searchParams.get("params") ?? "{}";
    const fresh = url.searchParams.get("fresh") === "1";
    const cacheControl = fresh ? "no-store" : `public, max-age=${maxAge}`;

    if (!op || !OPERATIONS.has(op)) {
      return { status: 400, body: { error: "Unknown or missing op" }, cacheControl: "no-store" };
    }
    let params: Record<string, unknown>;
    try {
      if (rawParams.length > MAX_PARAMS_LENGTH) throw new Error("too long");
      params = JSON.parse(rawParams);
      if (typeof params !== "object" || params === null || Array.isArray(params)) throw new Error("not an object");
    } catch {
      return { status: 400, body: { error: "Invalid params" }, cacheControl: "no-store" };
    }

    try {
      const data = await query(op, params, { fresh });
      return { status: 200, body: { data }, cacheControl };
    } catch (err) {
      if (err instanceof QueryError) {
        return { status: 400, body: { error: err.message }, cacheControl: "no-store" };
      }
      logger.error(`[daocafe] ${op} failed`, err);
      return { status: 502, body: { error: "Chain data temporarily unavailable" }, cacheControl: "no-store" };
    }
  }

  const server: DaoCafeServer & { handle: typeof handle } = {
    query,
    warmup,
    handle,
    async handleRequest(request) {
      const result = await handle(new URL(request.url));
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { "content-type": "application/json", "cache-control": result.cacheControl },
      });
    },
  };

  if (config.warmup !== false) void warmup();
  return server;
}

// One server (and in-memory cache) per config per process, also across
// Next.js route modules and dev-mode hot reloads.
const SERVERS_KEY = Symbol.for("daocafe-sdk.servers");
const globalServers = ((globalThis as Record<symbol, unknown>)[SERVERS_KEY] ??= new Map()) as Map<
  string,
  DaoCafeServer & { handle(url: URL): Promise<HandlerResult> }
>;

function getServer(config: DaoCafeServerConfig) {
  const key = JSON.stringify(config, (k, v) => (k === "logger" ? undefined : typeof v === "bigint" ? `${v}` : v));
  let server = globalServers.get(key);
  if (!server) {
    server = createServer(config) as DaoCafeServer & { handle(url: URL): Promise<HandlerResult> };
    globalServers.set(key, server);
  }
  return server;
}

/**
 * Create (or reuse) a DAO.CAFE server for direct use, e.g. in server
 * components or scripts.
 *
 * @example
 * ```ts
 * const daocafe = createDaoCafeServer({ rpcUrls: { 1: process.env.RPC_1 } });
 * const { items } = (await daocafe.query("daos", { limit: 10 })) as PaginatedResponse<DAO>;
 * ```
 */
export function createDaoCafeServer(config: DaoCafeServerConfig = {}): DaoCafeServer {
  return getServer(config);
}

/**
 * Fetch API route handler (Next.js App Router, Hono, Bun, Deno, ...)
 *
 * @example
 * ```ts
 * // app/api/daocafe/route.ts
 * export const GET = createDaoCafeHandler({
 *   rpcUrls: { 1: process.env.DAOCAFE_RPC_URL_1, 42161: process.env.DAOCAFE_RPC_URL_42161 },
 * });
 * ```
 */
export function createDaoCafeHandler(config: DaoCafeServerConfig = {}): (request: Request) => Promise<Response> {
  return (request) => getServer(config).handleRequest(request);
}

/**
 * Node `(req, res)` handler (Next.js Pages Router API routes, Express, http)
 *
 * @example
 * ```ts
 * // pages/api/daocafe.ts
 * export default createDaoCafeNodeHandler({ rpcUrls: { 1: process.env.DAOCAFE_RPC_URL_1 } });
 * ```
 */
export function createDaoCafeNodeHandler(
  config: DaoCafeServerConfig = {},
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("allow", "GET, HEAD");
      res.end();
      return;
    }
    const result = await getServer(config).handle(new URL(req.url ?? "/", "http://localhost"));
    res.statusCode = result.status;
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", result.cacheControl);
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(result.body));
  };
}
