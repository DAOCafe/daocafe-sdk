/**
 * Server-side query execution: filtering, ordering and cursor pagination over
 * the derived chain views, mirroring the old indexer's GraphQL semantics
 * (default order is by id ascending, default page size 50, max 1000).
 */

import type { DaoCafeOperation } from "../client";
import type {
  DAO,
  Delegate,
  OrderDirection,
  PaginatedResponse,
  PaginationParams,
  Proposal,
  ProposalState,
  TokenHolder,
  Vote,
} from "../types";
import { decodeProposalActions, type DecoderOptions } from "./decoder";
import { getChainView, type ChainView, type ProposalRecord } from "./store";
import { eventProposalState, type ChainSync, type Logger } from "./sync";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;

export interface QueryContext {
  syncs: Map<number, ChainSync>;
  decoder: DecoderOptions;
  logger: Logger;
}

type Params = Record<string, unknown>;

export class QueryError extends Error {}

// ============================================================================
// HELPERS
// ============================================================================

const lower = (value: unknown) => (typeof value === "string" ? value.toLowerCase() : undefined);

function chainIdOf(id: unknown): number | undefined {
  if (typeof id !== "string") return undefined;
  const chainId = Number(id.split("_")[0]);
  return Number.isInteger(chainId) ? chainId : undefined;
}

/** Sync the chains a query touches and return their views */
async function loadViews(
  ctx: QueryContext,
  chainId: number | undefined,
  fresh: boolean,
): Promise<{ sync: ChainSync; view: ChainView }[]> {
  const targets =
    chainId === undefined ? [...ctx.syncs.values()] : ctx.syncs.has(chainId) ? [ctx.syncs.get(chainId)!] : [];
  const results = await Promise.allSettled(targets.map((sync) => sync.sync({ fresh })));

  const loaded: { sync: ChainSync; view: ChainView }[] = [];
  let firstError: unknown;
  results.forEach((result, i) => {
    const sync = targets[i]!;
    if (result.status === "fulfilled") {
      loaded.push({ sync, view: getChainView(result.value) });
    } else {
      firstError ??= result.reason;
      ctx.logger.error(`[daocafe] chain ${sync.chainId}: unavailable`, result.reason);
    }
  });
  // Partial results are fine for cross-chain lists; nothing at all is an error
  if (loaded.length === 0 && firstError !== undefined) throw firstError;
  return loaded;
}

function compareValues(a: string | number, b: string | number, numeric: boolean): number {
  if (numeric) {
    const x = BigInt(a);
    const y = BigInt(b);
    return x === y ? 0 : x < y ? -1 : 1;
  }
  return String(a).localeCompare(String(b));
}

function sortItems<T extends { id: string }>(
  items: T[],
  orderBy: string | undefined,
  direction: OrderDirection | undefined,
  fields: Record<string, { get: (item: T) => string | number; numeric: boolean }>,
): T[] {
  const field = orderBy ? fields[orderBy] : undefined;
  const sign = direction === "desc" ? -1 : 1;
  return items.sort((a, b) => {
    const primary = field ? compareValues(field.get(a), field.get(b), field.numeric) : 0;
    return (primary !== 0 ? primary : a.id.localeCompare(b.id)) * sign;
  });
}

const encodeCursor = (index: number) => btoa(`o:${index}`);

function decodeCursor(cursor: string): number {
  try {
    const value = atob(cursor);
    if (value.startsWith("o:")) {
      const index = Number(value.slice(2));
      if (Number.isInteger(index) && index >= 0) return index;
    }
  } catch {
    // fall through
  }
  throw new QueryError("Invalid cursor");
}

function paginate<T>(items: T[], params: PaginationParams): { page: T[]; pageInfo: PaginatedResponse<T>["pageInfo"] } {
  const limit = Math.min(Math.max(Math.floor(Number(params.limit ?? DEFAULT_LIMIT)) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  let start = 0;
  let end: number;
  if (params.after) {
    start = decodeCursor(params.after) + 1;
    end = start + limit;
  } else if (params.before) {
    end = decodeCursor(params.before);
    start = Math.max(0, end - limit);
  } else {
    end = limit;
  }
  end = Math.min(end, items.length);
  const page = start < end ? items.slice(start, end) : [];
  return {
    page,
    pageInfo: {
      hasNextPage: end < items.length,
      hasPreviousPage: start > 0,
      startCursor: page.length > 0 ? encodeCursor(start) : null,
      endCursor: page.length > 0 ? encodeCursor(end - 1) : null,
    },
  };
}

function finish<T>(items: T[], params: PaginationParams): PaginatedResponse<T> {
  const { page, pageInfo } = paginate(items, params);
  return { items: page, pageInfo };
}

// ============================================================================
// PROPOSALS
// ============================================================================

interface ResolvedProposal {
  record: ProposalRecord;
  state: ProposalState;
}

async function resolveProposals(
  entries: { sync: ChainSync; records: ProposalRecord[] }[],
): Promise<ResolvedProposal[]> {
  const out: ResolvedProposal[] = [];
  await Promise.all(
    entries.map(async ({ sync, records }) => {
      const now = sync.now();
      const chainStates = await sync.resolveStates(records);
      for (const record of records) {
        const state =
          eventProposalState(record, now) ??
          chainStates.get(record.id) ??
          // RPC failed: best effort from tallies (ignores quorum)
          (record.queued ? "QUEUED" : record.forVotes > record.againstVotes ? "SUCCEEDED" : "DEFEATED");
        out.push({ record, state });
      }
    }),
  );
  return out;
}

async function toProposal({ record: p, state }: ResolvedProposal, ctx: QueryContext): Promise<Proposal> {
  return {
    id: p.id,
    daoId: p.daoId,
    chainId: p.chainId,
    governor: p.governor,
    proposalId: p.proposalId.toString(),
    proposer: p.proposer,
    targets: p.targets,
    values: p.values,
    calldatas: p.calldatas,
    signatures: p.signatures,
    decodedActions: await decodeProposalActions(p.targets, p.values, p.calldatas, ctx.decoder),
    description: p.description,
    voteStart: p.voteStart.toString(),
    voteEnd: p.voteEnd.toString(),
    eta: p.eta === null ? null : p.eta.toString(),
    forVotes: p.forVotes.toString(),
    againstVotes: p.againstVotes.toString(),
    abstainVotes: p.abstainVotes.toString(),
    state,
    createdAt: p.createdAt.toString(),
    blockNumber: p.blockNumber.toString(),
    transactionHash: p.transactionHash,
  };
}

const proposalOrder: Record<string, { get: (p: ResolvedProposal & { id: string }) => string; numeric: boolean }> = {
  createdAt: { get: (p) => p.record.createdAt.toString(), numeric: true },
  voteStart: { get: (p) => p.record.voteStart.toString(), numeric: true },
  voteEnd: { get: (p) => p.record.voteEnd.toString(), numeric: true },
};

async function listProposals(ctx: QueryContext, params: Params, fresh: boolean): Promise<PaginatedResponse<Proposal>> {
  const daoId = lower(params.daoId);
  const proposer = lower(params.proposer);
  const state = params.state as ProposalState | undefined;

  const views = await loadViews(ctx, chainIdOf(daoId), fresh);
  const entries = views.map(({ sync, view }) => ({
    sync,
    records: [...view.proposals.values()].filter(
      (p) => (!daoId || p.daoId === daoId) && (!proposer || p.proposer === proposer),
    ),
  }));
  const resolved = (await resolveProposals(entries))
    .filter((p) => !state || p.state === state)
    .map((p) => ({ ...p, id: p.record.id }));

  const sorted = sortItems(resolved, params.orderBy as string, params.orderDirection as OrderDirection, proposalOrder);
  const { page, pageInfo } = paginate(sorted, params as PaginationParams);
  return { items: await Promise.all(page.map((p) => toProposal(p, ctx))), pageInfo };
}

async function getProposal(ctx: QueryContext, params: Params, fresh: boolean): Promise<Proposal | null> {
  const id = lower(params.id);
  if (!id) return null;
  const [entry] = await loadViews(ctx, chainIdOf(id), fresh);
  const record = entry?.view.proposals.get(id);
  if (!entry || !record) return null;
  const [resolved] = await resolveProposals([{ sync: entry.sync, records: [record] }]);
  return resolved ? toProposal(resolved, ctx) : null;
}

// ============================================================================
// OTHER ENTITIES
// ============================================================================

const daoOrder: Record<string, { get: (d: DAO) => string | number; numeric: boolean }> = {
  createdAt: { get: (d) => d.createdAt, numeric: true },
  proposalCount: { get: (d) => d.proposalCount, numeric: true },
  name: { get: (d) => d.name, numeric: false },
};

const voteOrder: Record<string, { get: (v: Vote) => string; numeric: boolean }> = {
  createdAt: { get: (v) => v.createdAt, numeric: true },
  timestamp: { get: (v) => v.createdAt, numeric: true },
  weight: { get: (v) => v.weight, numeric: true },
};

const delegateOrder: Record<string, { get: (d: Delegate) => string; numeric: boolean }> = {
  updatedAt: { get: (d) => d.updatedAt, numeric: true },
};

const holderOrder: Record<string, { get: (h: TokenHolder) => string; numeric: boolean }> = {
  balance: { get: (h) => h.balance, numeric: true },
  votes: { get: (h) => h.votes, numeric: true },
  updatedAt: { get: (h) => h.updatedAt, numeric: true },
};

async function getById<K extends "daos" | "votes" | "delegates" | "holders">(
  ctx: QueryContext,
  params: Params,
  fresh: boolean,
  table: K,
) {
  const id = lower(params.id);
  if (!id) return null;
  const [entry] = await loadViews(ctx, chainIdOf(id), fresh);
  return (entry?.view[table].get(id) as ReturnType<ChainView[K]["get"]>) ?? null;
}

async function collect<T>(
  ctx: QueryContext,
  scopeId: unknown,
  fresh: boolean,
  pick: (view: ChainView) => Iterable<T>,
): Promise<T[]> {
  const views = await loadViews(ctx, chainIdOf(scopeId), fresh);
  return views.flatMap(({ view }) => [...pick(view)]);
}

// ============================================================================
// DISPATCH
// ============================================================================

export async function runQuery(
  ctx: QueryContext,
  op: DaoCafeOperation,
  params: Params,
  fresh: boolean,
): Promise<unknown> {
  const order = params.orderBy as string | undefined;
  const direction = params.orderDirection as OrderDirection | undefined;
  const page = params as PaginationParams;

  switch (op) {
    case "daos": {
      const manager = lower(params.manager);
      const daos = (await collect(ctx, undefined, fresh, (v) => v.daos.values())).filter(
        (d) => !manager || d.manager === manager,
      );
      return finish(sortItems(daos, order, direction, daoOrder), page);
    }
    case "dao":
      return getById(ctx, params, fresh, "daos");

    case "proposals":
      return listProposals(ctx, params, fresh);
    case "proposal":
      return getProposal(ctx, params, fresh);

    case "votes": {
      const proposalId = lower(params.proposalId);
      const daoId = lower(params.daoId);
      const voter = lower(params.voter);
      const support = params.support as string | undefined;
      const votes = (await collect(ctx, proposalId ?? daoId, fresh, (v) => v.votes.values())).filter(
        (v) =>
          (!proposalId || v.proposalId === proposalId) &&
          (!daoId || v.daoId === daoId) &&
          (!voter || v.voter === voter) &&
          (!support || v.support === support),
      );
      return finish(sortItems(votes, order, direction, voteOrder), page);
    }
    case "vote":
      return getById(ctx, params, fresh, "votes");

    case "delegates": {
      const daoId = lower(params.daoId);
      const delegator = lower(params.delegator);
      const toDelegate = lower(params.toDelegate);
      const delegates = (await collect(ctx, daoId, fresh, (v) => v.delegates.values())).filter(
        (d) =>
          (!daoId || d.daoId === daoId) &&
          (!delegator || d.delegator === delegator) &&
          (!toDelegate || d.toDelegate === toDelegate),
      );
      return finish(sortItems(delegates, order, direction, delegateOrder), page);
    }
    case "delegate":
      return getById(ctx, params, fresh, "delegates");

    case "tokenHolders": {
      const daoId = lower(params.daoId);
      const holder = lower(params.holder);
      const holders = (await collect(ctx, daoId, fresh, (v) => v.holders.values())).filter(
        (h) => (!daoId || h.daoId === daoId) && (!holder || h.holder === holder),
      );
      return finish(sortItems(holders, order, direction, holderOrder), page);
    }
    case "tokenHolder":
      return getById(ctx, params, fresh, "holders");

    default:
      throw new QueryError(`Unknown operation: ${String(op)}`);
  }
}
