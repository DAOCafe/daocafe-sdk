/**
 * RPC sync engine.
 *
 * Fetches CreateDAO events with `eth_getLogs` (factory + every governor and
 * token it created) and keeps them in a `ChainState`. The first sync scans
 * from the factory deployment block; later syncs only fetch new blocks plus a
 * short window below the head that is re-read every time, because providers
 * can return an empty result for a block whose logs are not indexed yet.
 *
 * Syncs are de-duplicated and throttled, so any number of concurrent requests
 * cost at most one round of RPC calls per `minSyncIntervalMs`.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createPublicClient,
  decodeEventLog,
  http,
  toHex,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import type { ProposalState } from "../types";
import {
  factoryEventsAbi,
  governorEventsAbi,
  governorReadAbi,
  timelockReadAbi,
  tokenEventsAbi,
} from "./abis";
import type { DaoCafeDeployment } from "./deployments";
import {
  compareEvents,
  createChainState,
  knownDaoAddresses,
  type ChainEvent,
  type ChainState,
  type ContractType,
  type DaoSettings,
  type ProposalRecord,
} from "./store";

/** Multicall3 is deployed at the same address on all supported chains */
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

/** Max contract addresses per eth_getLogs request */
const ADDRESS_CHUNK_SIZE = 250;

/** Below this block range, a failing eth_getLogs is not split further */
const MIN_SPLIT_RANGE = 500n;

/** Provider errors that mean "query too large, try a smaller range" */
const RANGE_ERROR_PATTERN =
  /range|limit|too many|exceed|more than|too large|response size|max results|timeout|invalid param/i;

/** Block ranges fetched in parallel when a provider limits the range */
const LOG_CHUNK_CONCURRENCY = 4;

/** Provider errors that state the allowed block range */
const RANGE_LIMIT_PATTERNS = [
  /only (\d+) (?:blocks )?are allowed/i, // Arbitrum Nitro
  /maximum block range:? ?(\d+)/i, // PublicNode
  /up to a (\d+) block range/i, // Alchemy
  /block range (?:limit|is limited to|should not exceed|must not exceed|cannot exceed)\D{0,10}(\d+)/i,
  /range (?:of|is) (?:more than|greater than|over) (\d+) blocks/i,
];

/** The block-range limit stated in a provider error, if any */
export function parseRangeLimit(message: string): bigint | null {
  for (const pattern of RANGE_LIMIT_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const limit = BigInt(match[1]);
      if (limit > 0n) return limit;
    }
  }
  return null;
}

/** Map with at most `limit` promises in flight, preserving order */
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Wait this long before retrying a chain that has never synced successfully */
const FAILED_SYNC_BACKOFF_MS = 5_000;

/** Governor events after which DAO settings are re-read */
const SETTINGS_TRIGGERS = new Set([
  "VotingDelaySet",
  "VotingPeriodSet",
  "ProposalThresholdSet",
  "QuorumNumeratorUpdated",
  "ManagerChanged",
  "TimelockChange",
  // A timelock delay change is executed through a proposal
  "ProposalExecuted",
]);

/** OpenZeppelin Governor `state()` return values */
const PROPOSAL_STATES: ProposalState[] = [
  "PENDING",
  "ACTIVE",
  "CANCELED",
  "DEFEATED",
  "SUCCEEDED",
  "QUEUED",
  "EXPIRED",
  "EXECUTED",
];

/** States read via `state()` that can only change through a governor event */
const CACHEABLE_STATES = new Set<ProposalState>(["CANCELED", "DEFEATED", "SUCCEEDED", "EXPIRED", "EXECUTED"]);

const PERSIST_VERSION = 1;

interface RpcLog {
  address: Hex;
  topics: [Hex, ...Hex[]] | [];
  data: Hex;
  blockNumber: Hex;
  /** Returned by most providers; fetched separately when missing */
  blockTimestamp?: Hex;
  transactionHash: Hex;
  logIndex: Hex;
  removed?: boolean;
}

export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface ChainSyncConfig {
  chainId: number;
  /** RPC endpoints, tried in order */
  rpcUrls: string[];
  deployment: DaoCafeDeployment;
  /** Minimum time between two syncs */
  minSyncIntervalMs: number;
  /** Minimum time between two syncs when the caller asks for fresh data */
  minFreshIntervalMs: number;
  /** Directory to persist synced events in (optional) */
  cacheDir?: string;
  logger: Logger;
}

export interface ChainSync {
  readonly chainId: number;
  readonly state: ChainState;
  /** Whether at least one sync has completed */
  readonly isSynced: boolean;
  /** Bring the state up to date (throttled) and return it */
  sync(options?: { fresh?: boolean }): Promise<ChainState>;
  /** Current chain time in seconds, extrapolated from the last head block */
  now(): bigint;
  /**
   * Resolve proposal states that events alone cannot decide (vote ended:
   * succeeded vs defeated; queued past its ETA: executed directly on the
   * timelock?). Reads `state()` for those and caches final answers.
   */
  resolveStates(records: ProposalRecord[]): Promise<Map<string, ProposalState>>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const eventKey = (e: ChainEvent) => `${e.txHash}:${e.logIndex}`;

/** State derivable from events alone, or null when the chain must be asked */
export function eventProposalState(p: ProposalRecord, now: bigint): ProposalState | null {
  if (p.canceled) return "CANCELED";
  if (p.executed) return "EXECUTED";
  if (p.queued) {
    // Anyone may execute a ready operation directly on the timelock, which
    // emits no governor event - ask the chain once the ETA has passed.
    return p.eta !== null && now >= p.eta ? null : "QUEUED";
  }
  if (p.voteStart >= now) return "PENDING";
  if (p.voteEnd >= now) return "ACTIVE";
  return null;
}

export function createChainSync(config: ChainSyncConfig): ChainSync {
  const { chainId, deployment, logger } = config;
  const factoryAddress = deployment.factory.toLowerCase();

  const clients: PublicClient[] = config.rpcUrls.map((url) =>
    createPublicClient({ transport: http(url, { timeout: 30_000, retryCount: 1 }) }),
  );

  const state = createChainState(chainId);
  /** Final `state()` answers by proposal entity id (persisted) */
  const resolvedStates = new Map<string, ProposalState>();
  /** Non-final `state()` answers with the time they were read */
  const recentStates = new Map<string, { state: ProposalState; at: number }>();
  /** Settings-trigger events already acted on */
  const seenTriggers = new Set<string>();

  let lastSyncAt = 0;
  let lastFailure: { at: number; error: unknown } | null = null;
  let inflight: Promise<ChainState> | null = null;
  let loaded: Promise<void> | null = null;
  let persistDirty = false;

  const cacheFile = config.cacheDir
    ? join(config.cacheDir, `daocafe-${chainId}-${factoryAddress}.json`)
    : null;

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  async function load(): Promise<void> {
    if (!cacheFile) return;
    try {
      const raw = JSON.parse(await readFile(cacheFile, "utf8"), (_key, value) =>
        value && typeof value === "object" && typeof value.$bigint === "string" ? BigInt(value.$bigint) : value,
      );
      if (
        raw.v !== PERSIST_VERSION ||
        raw.chainId !== chainId ||
        raw.factory !== factoryAddress ||
        BigInt(raw.startBlock) !== deployment.startBlock
      ) {
        return;
      }
      state.safeEvents = raw.safeEvents as ChainEvent[];
      state.safeBlock = BigInt(raw.safeBlock);
      for (const [governor, settings] of raw.settings as [string, DaoSettings][]) {
        state.settings.set(governor, settings);
      }
      for (const [id, proposalState] of raw.resolvedStates as [string, ProposalState][]) {
        resolvedStates.set(id, proposalState);
      }
      state.version++;
      logger.info(`[daocafe] chain ${chainId}: loaded cache up to block ${state.safeBlock}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.warn(`[daocafe] chain ${chainId}: ignoring unreadable cache file`, err);
      }
    }
  }

  let persistChain: Promise<void> = Promise.resolve();

  /** Write the cache file (writes are serialized) */
  function persist(): Promise<void> {
    persistChain = persistChain.then(writeCache);
    return persistChain;
  }

  async function writeCache(): Promise<void> {
    if (!cacheFile || !persistDirty || state.safeBlock === null) return;
    persistDirty = false;
    const body = JSON.stringify(
      {
        v: PERSIST_VERSION,
        chainId,
        factory: factoryAddress,
        startBlock: deployment.startBlock.toString(),
        safeBlock: state.safeBlock.toString(),
        safeEvents: state.safeEvents,
        settings: [...state.settings],
        resolvedStates: [...resolvedStates],
      },
      (_key, value) => (typeof value === "bigint" ? { $bigint: value.toString() } : value),
    );
    try {
      await mkdir(config.cacheDir!, { recursive: true });
      const tmp = `${cacheFile}.${process.pid}.tmp`;
      await writeFile(tmp, body);
      await rename(tmp, cacheFile);
    } catch (err) {
      persistDirty = true;
      logger.warn(`[daocafe] chain ${chainId}: failed to write cache file`, err);
    }
  }

  // --------------------------------------------------------------------------
  // RPC helpers
  // --------------------------------------------------------------------------

  /** Run a read against each RPC in order until one succeeds */
  async function withFallback<T>(fn: (client: PublicClient) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (const [i, client] of clients.entries()) {
      try {
        return await fn(client);
      } catch (err) {
        lastError = err;
        if (i < clients.length - 1) warnFailover(i, err);
      }
    }
    throw lastError;
  }

  const lastFailoverWarning = new Map<number, number>();

  /** Log an RPC failover (at most once a minute per RPC) */
  function warnFailover(index: number, err: unknown) {
    if (Date.now() - (lastFailoverWarning.get(index) ?? 0) < 60_000) return;
    lastFailoverWarning.set(index, Date.now());
    const host = config.rpcUrls[index]?.split("/")[2] ?? `#${index}`;
    const reason = err instanceof Error ? ((err as { shortMessage?: string }).shortMessage ?? err.message) : String(err);
    logger.warn(`[daocafe] chain ${chainId}: RPC ${host} failed (${reason.split("\n")[0]}), trying next`);
  }

  const errorText = (err: unknown) =>
    err instanceof Error ? `${err.message} ${(err as { details?: string }).details ?? ""}` : String(err);

  /** Block-range limits learned from provider errors, by `${rpc}:${addressCount}` */
  const rangeLimits = new Map<string, bigint>();

  /**
   * eth_getLogs on one RPC. When the provider states its block-range limit in
   * the error, the range is fetched in chunks of that size (and the limit is
   * remembered for later calls).
   */
  async function fetchLogs(index: number, address: string[], fromBlock: bigint, toBlock: bigint): Promise<RpcLog[]> {
    const key = `${index}:${address.length}`;
    const limit = rangeLimits.get(key);
    if (limit !== undefined && toBlock - fromBlock + 1n > limit) {
      const ranges: [bigint, bigint][] = [];
      for (let start = fromBlock; start <= toBlock; start += limit) {
        ranges.push([start, start + limit - 1n < toBlock ? start + limit - 1n : toBlock]);
      }
      const results = await mapConcurrent(ranges, LOG_CHUNK_CONCURRENCY, ([from, to]) =>
        fetchLogs(index, address, from, to),
      );
      return results.flat();
    }
    try {
      const logs = (await clients[index]!.request({
        method: "eth_getLogs",
        params: [{ address: address as Address[], fromBlock: toHex(fromBlock), toBlock: toHex(toBlock) }],
      })) as unknown as RpcLog[];
      return logs.filter((log) => !log.removed);
    } catch (err) {
      const stated = parseRangeLimit(errorText(err));
      if (stated !== null && stated < toBlock - fromBlock + 1n) {
        rangeLimits.set(key, stated);
        return fetchLogs(index, address, fromBlock, toBlock);
      }
      throw err;
    }
  }

  /**
   * eth_getLogs across the configured RPCs. When every RPC fails and at least
   * one rejected the block range without stating a limit, the range is halved.
   */
  async function getLogs(address: string[], fromBlock: bigint, toBlock: bigint): Promise<RpcLog[]> {
    let lastError: unknown;
    let rangeRejected = false;
    for (let i = 0; i < clients.length; i++) {
      try {
        return await fetchLogs(i, address, fromBlock, toBlock);
      } catch (err) {
        lastError = err;
        if (RANGE_ERROR_PATTERN.test(errorText(err))) rangeRejected = true;
        else if (i < clients.length - 1) warnFailover(i, err);
      }
    }
    if (!rangeRejected || toBlock - fromBlock < MIN_SPLIT_RANGE) throw lastError;
    const mid = (fromBlock + toBlock) / 2n;
    const left = await getLogs(address, fromBlock, mid);
    const right = await getLogs(address, mid + 1n, toBlock);
    return [...left, ...right];
  }

  async function getLogsChunked(addresses: string[], fromBlock: bigint, toBlock: bigint): Promise<RpcLog[]> {
    if (addresses.length === 0) return [];
    const chunks = await Promise.all(
      chunk(addresses, ADDRESS_CHUNK_SIZE).map((c) => getLogs(c, fromBlock, toBlock)),
    );
    return chunks.flat();
  }

  function decode(logs: RpcLog[], abi: Abi, contractType: ContractType): ChainEvent[] {
    const events: ChainEvent[] = [];
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
        events.push({
          contractType,
          eventName: String(decoded.eventName),
          args: decoded.args as unknown as Record<string, unknown>,
          address: log.address.toLowerCase(),
          txHash: log.transactionHash.toLowerCase(),
          blockNumber: BigInt(log.blockNumber),
          logIndex: Number(log.logIndex),
          timestamp: log.blockTimestamp ? BigInt(log.blockTimestamp) : -1n,
        });
      } catch {
        // Event not in the ABI (e.g. Approval, Initialized) - not needed
      }
    }
    return events;
  }

  /** Fill timestamps for providers that don't return `blockTimestamp` */
  async function fillMissingTimestamps(events: ChainEvent[]): Promise<void> {
    const missing = [...new Set(events.filter((e) => e.timestamp < 0n).map((e) => e.blockNumber))];
    if (missing.length === 0) return;
    const blocks = await Promise.all(
      missing.map((blockNumber) => withFallback((client) => client.getBlock({ blockNumber }))),
    );
    const byNumber = new Map(blocks.map((b) => [b.number, b.timestamp]));
    for (const event of events) {
      if (event.timestamp < 0n) event.timestamp = byNumber.get(event.blockNumber) ?? 0n;
    }
  }

  /** Read current governance settings for the given governors */
  async function readSettings(daos: { governor: string; timelock: string }[]): Promise<void> {
    if (daos.length === 0) return;
    const governorFns = ["votingDelay", "votingPeriod", "proposalThreshold", "quorumNumerator", "manager"] as const;
    const perDao = governorFns.length + 1;
    const results = await withFallback((client) =>
      client.multicall({
        multicallAddress: MULTICALL3_ADDRESS,
        allowFailure: true,
        contracts: daos.flatMap(({ governor, timelock }) => [
        ...governorFns.map((functionName) => ({
          address: governor as Address,
          abi: governorReadAbi,
          functionName,
        })),
          { address: timelock as Address, abi: timelockReadAbi, functionName: "getMinDelay" as const },
        ]),
      }),
    );

    daos.forEach(({ governor }, i) => {
      const value = (offset: number) => {
        const r = results[i * perDao + offset];
        return r && r.status === "success" ? r.result : null;
      };
      const manager = value(4);
      state.settings.set(governor, {
        votingDelay: value(0) as bigint | null,
        votingPeriod: value(1) as bigint | null,
        proposalThreshold: value(2) as bigint | null,
        quorumNumerator: value(3) as bigint | null,
        manager: manager ? String(manager).toLowerCase() : null,
        timelockMinDelay: value(5) as bigint | null,
      });
    });
  }

  // --------------------------------------------------------------------------
  // Sync
  // --------------------------------------------------------------------------

  async function runSync(): Promise<void> {
    const block = await withFallback((client) => client.getBlock({ blockTag: "latest" }));
    const latest = block.number;
    const head = { number: latest, timestamp: block.timestamp, fetchedAt: Date.now() };
    const fromBlock = state.safeBlock === null ? deployment.startBlock : state.safeBlock + 1n;
    if (fromBlock > latest) {
      // Node behind the previous one we talked to - nothing new to read
      state.head = head;
      return;
    }

    const previous = knownDaoAddresses([...state.safeEvents, ...state.tentativeEvents]);
    const governors = new Set(previous.governors);
    const tokens = new Set(previous.tokens);

    const logs = await getLogsChunked([factoryAddress, ...governors, ...tokens], fromBlock, latest);
    const factoryEvents = decode(
      logs.filter((log) => log.address.toLowerCase() === factoryAddress),
      factoryEventsAbi as Abi,
      "FACTORY",
    );

    // DAOs created in this range only have logs from this range onwards, so
    // one extra [fromBlock, latest] scan of their contracts covers them.
    const created = knownDaoAddresses(factoryEvents);
    const newAddresses = [
      ...created.governors.filter((a) => !governors.has(a)),
      ...created.tokens.filter((a) => !tokens.has(a)),
    ];
    created.governors.forEach((a) => governors.add(a));
    created.tokens.forEach((a) => tokens.add(a));
    const newLogs = await getLogsChunked(newAddresses, fromBlock, latest);

    const childLogs = [...logs.filter((log) => log.address.toLowerCase() !== factoryAddress), ...newLogs];
    const events = [
      ...factoryEvents,
      ...decode(
        childLogs.filter((log) => governors.has(log.address.toLowerCase())),
        governorEventsAbi as Abi,
        "GOVERNOR",
      ),
      ...decode(
        childLogs.filter((log) => tokens.has(log.address.toLowerCase())),
        tokenEventsAbi as Abi,
        "TOKEN",
      ),
    ];
    await fillMissingTimestamps(events);
    events.sort(compareEvents);

    // Settings: read for new DAOs and after relevant governor events
    const allEvents = [...state.safeEvents, ...events];
    const timelocks = new Map<string, string>();
    for (const e of allEvents) {
      if (e.contractType === "FACTORY" && e.eventName === "DAOCreated") {
        timelocks.set(String(e.args.governor).toLowerCase(), String(e.args.timelock).toLowerCase());
      }
    }
    const settingsTargets = new Set<string>();
    for (const governor of timelocks.keys()) {
      if (!state.settings.has(governor)) settingsTargets.add(governor);
    }
    const triggers = events.filter(
      (e) => e.contractType === "GOVERNOR" && SETTINGS_TRIGGERS.has(e.eventName) && !seenTriggers.has(eventKey(e)),
    );
    triggers.forEach((e) => settingsTargets.add(e.address));
    await readSettings([...settingsTargets].map((governor) => ({ governor, timelock: timelocks.get(governor)! })));
    triggers.forEach((e) => seenTriggers.add(eventKey(e)));

    // Everything fetched successfully - now mutate state.
    let newSafe = latest - deployment.confirmations;
    if (newSafe < fromBlock - 1n) newSafe = fromBlock - 1n;
    const final = events.filter((e) => e.blockNumber <= newSafe);
    const tentative = events.filter((e) => e.blockNumber > newSafe);

    const tentativeChanged =
      tentative.length !== state.tentativeEvents.length ||
      tentative.some((e, i) => eventKey(e) !== eventKey(state.tentativeEvents[i]!));

    state.safeEvents.push(...final);
    state.tentativeEvents = tentative;
    state.safeBlock = newSafe;
    state.head = head;
    if (final.length > 0 || tentativeChanged || settingsTargets.size > 0) state.version++;
    if (final.length > 0 || settingsTargets.size > 0) persistDirty = true;
  }

  function sync(options: { fresh?: boolean } = {}): Promise<ChainState> {
    if (inflight) return inflight;
    const interval = options.fresh ? config.minFreshIntervalMs : config.minSyncIntervalMs;
    if (state.safeBlock !== null && Date.now() - lastSyncAt < interval) return Promise.resolve(state);
    if (state.head === null && lastFailure && Date.now() - lastFailure.at < FAILED_SYNC_BACKOFF_MS) {
      return Promise.reject(lastFailure.error);
    }

    loaded ??= load();
    inflight = loaded
      .then(runSync)
      .then(
        () => {
          lastFailure = null;
          void persist();
          return state;
        },
        (err: unknown) => {
          lastFailure = { at: Date.now(), error: err };
          // Serve stale data if we have any; otherwise surface the error
          if (state.head === null) throw err;
          logger.warn(`[daocafe] chain ${chainId}: sync failed, serving cached data`, err);
          return state;
        },
      )
      .finally(() => {
        lastSyncAt = Date.now();
        inflight = null;
      });
    return inflight;
  }

  function now(): bigint {
    if (!state.head) return BigInt(Math.floor(Date.now() / 1000));
    return state.head.timestamp + BigInt(Math.floor((Date.now() - state.head.fetchedAt) / 1000));
  }

  async function resolveStates(records: ProposalRecord[]): Promise<Map<string, ProposalState>> {
    const result = new Map<string, ProposalState>();
    const toRead: ProposalRecord[] = [];
    const current = now();

    for (const p of records) {
      if (eventProposalState(p, current) !== null) continue;
      // A queued proposal may still have a cached SUCCEEDED from before
      const cached = p.queued ? undefined : resolvedStates.get(p.id);
      if (cached) {
        result.set(p.id, cached);
        continue;
      }
      const recent = recentStates.get(p.id);
      if (recent && Date.now() - recent.at < config.minSyncIntervalMs) {
        result.set(p.id, recent.state);
        continue;
      }
      toRead.push(p);
    }
    if (toRead.length === 0) return result;

    try {
      const states = await withFallback((client) =>
        client.multicall({
          multicallAddress: MULTICALL3_ADDRESS,
          allowFailure: true,
          contracts: toRead.map((p) => ({
            address: p.governor as Address,
            abi: governorReadAbi,
            functionName: "state" as const,
            args: [p.proposalId] as const,
          })),
        }),
      );
      toRead.forEach((p, i) => {
        const r = states[i];
        if (!r || r.status !== "success") return;
        const value = PROPOSAL_STATES[Number(r.result)];
        if (!value) return;
        result.set(p.id, value);
        if (CACHEABLE_STATES.has(value) && !p.queued) {
          resolvedStates.set(p.id, value);
          persistDirty = true;
          void persist();
        } else {
          recentStates.set(p.id, { state: value, at: Date.now() });
        }
      });
    } catch (err) {
      logger.warn(`[daocafe] chain ${chainId}: state() multicall failed`, err);
    }
    return result;
  }

  return {
    chainId,
    state,
    get isSynced() {
      return state.head !== null;
    },
    sync,
    now,
    resolveStates,
  };
}
