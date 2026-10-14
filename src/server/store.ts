/**
 * In-memory chain state.
 *
 * Holds the raw protocol events fetched by the sync engine and derives the
 * same entities the old Ponder indexer stored (DAOs, proposals, votes,
 * delegations, token holders). Derivation is cached per state version, so
 * reads between two syncs cost nothing.
 */

import type { DAO, Delegate, TokenHolder, Vote, VoteSupport } from "../types";

export type ContractType = "FACTORY" | "GOVERNOR" | "TOKEN";

export interface ChainEvent {
  contractType: ContractType;
  eventName: string;
  args: Record<string, unknown>;
  /** Emitting contract (lowercase) */
  address: string;
  txHash: string;
  blockNumber: bigint;
  logIndex: number;
  timestamp: bigint;
}

export interface DaoSettings {
  votingDelay: bigint | null;
  votingPeriod: bigint | null;
  proposalThreshold: bigint | null;
  quorumNumerator: bigint | null;
  manager: string | null;
  timelockMinDelay: bigint | null;
}

export interface ChainHead {
  number: bigint;
  timestamp: bigint;
  /** Wall-clock time (ms) when the head was read */
  fetchedAt: number;
}

export interface ChainState {
  chainId: number;
  /** Events at or below `safeBlock`, sorted. Never re-fetched. */
  safeEvents: ChainEvent[];
  /** Events above `safeBlock`, replaced on every sync */
  tentativeEvents: ChainEvent[];
  /** Last block whose events are final (null before the first sync) */
  safeBlock: bigint | null;
  head: ChainHead | null;
  /** Governance settings by governor address */
  settings: Map<string, DaoSettings>;
  /** quorum(voteStart) by proposal entity id, read once a proposal has ended */
  quorums: Map<string, bigint>;
  /** Bumped whenever events or settings change */
  version: number;
}

export function createChainState(chainId: number): ChainState {
  return {
    chainId,
    safeEvents: [],
    tentativeEvents: [],
    safeBlock: null,
    head: null,
    settings: new Map(),
    quorums: new Map(),
    version: 0,
  };
}

export function compareEvents(a: ChainEvent, b: ChainEvent): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  return a.logIndex - b.logIndex;
}

// ============================================================================
// DERIVED VIEW
// ============================================================================

/** Proposal data derived from events. State is resolved at query time. */
export interface ProposalRecord {
  id: string;
  daoId: string;
  chainId: number;
  governor: string;
  token: string;
  proposalId: bigint;
  proposer: string;
  targets: string[];
  values: string[];
  calldatas: string[];
  signatures: string[];
  description: string;
  voteStart: bigint;
  voteEnd: bigint;
  eta: bigint | null;
  queued: boolean;
  executed: boolean;
  canceled: boolean;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  createdAt: bigint;
  blockNumber: bigint;
  transactionHash: string;
}

export interface ChainView {
  /** By DAO id */
  daos: Map<string, DAO>;
  /** By proposal entity id */
  proposals: Map<string, ProposalRecord>;
  /** By vote entity id */
  votes: Map<string, Vote>;
  /** By delegate entity id */
  delegates: Map<string, Delegate>;
  /** By token holder entity id */
  holders: Map<string, TokenHolder>;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const lower = (value: unknown): string => String(value).toLowerCase();
const optionalString = (value: bigint | null | undefined): string | null =>
  value === null || value === undefined ? null : value.toString();

export const daoEntityId = (chainId: number, governor: string) =>
  `${chainId}_${governor.toLowerCase()}`;
export const proposalEntityId = (chainId: number, governor: string, proposalId: bigint) =>
  `${chainId}_${governor.toLowerCase()}_${proposalId.toString()}`;
const accountEntityId = (chainId: number, token: string, account: string) =>
  `${chainId}_${token.toLowerCase()}_${account.toLowerCase()}`;

function supportToEnum(support: unknown): VoteSupport {
  const value = Number(support);
  if (value === 0) return "AGAINST";
  if (value === 1) return "FOR";
  return "ABSTAIN";
}

interface HolderAccumulator {
  daoId: string;
  token: string;
  holder: string;
  balance: bigint;
  votes: bigint;
  updatedAt: bigint;
  blockNumber: bigint;
}

const viewCache = new WeakMap<ChainState, { version: number; view: ChainView }>();

/** All DAO contract addresses known from events (factory children) */
export function knownDaoAddresses(events: Iterable<ChainEvent>): { governors: string[]; tokens: string[] } {
  const governors: string[] = [];
  const tokens: string[] = [];
  for (const event of events) {
    if (event.contractType !== "FACTORY" || event.eventName !== "DAOCreated") continue;
    governors.push(lower(event.args.governor));
    tokens.push(lower(event.args.token));
  }
  return { governors, tokens };
}

export function getChainView(state: ChainState): ChainView {
  const cached = viewCache.get(state);
  if (cached && cached.version === state.version) return cached.view;
  const view = buildChainView(state);
  viewCache.set(state, { version: state.version, view });
  return view;
}

function buildChainView(state: ChainState): ChainView {
  const { chainId } = state;
  const daos = new Map<string, DAO>();
  const proposals = new Map<string, ProposalRecord>();
  const votes = new Map<string, Vote>();
  const delegates = new Map<string, Delegate>();
  const holders = new Map<string, HolderAccumulator>();

  const governorToDao = new Map<string, { daoId: string; token: string }>();
  const tokenToDaoId = new Map<string, string>();

  const events = [...state.safeEvents, ...state.tentativeEvents];

  // Pass 1: DAOs. Token events of a new DAO come before DAOCreated in the
  // same transaction, so the address mapping must exist before replaying.
  for (const event of events) {
    if (event.contractType !== "FACTORY" || event.eventName !== "DAOCreated") continue;
    const { args } = event;
    const governor = lower(args.governor);
    const token = lower(args.token);
    const daoId = daoEntityId(chainId, governor);
    const settings = state.settings.get(governor);

    governorToDao.set(governor, { daoId, token });
    tokenToDaoId.set(token, daoId);
    daos.set(daoId, {
      id: daoId,
      chainId,
      governor,
      token,
      timelock: lower(args.timelock),
      creator: lower(args.creator),
      name: String(args.daoName),
      tokenName: String(args.tokenName),
      tokenSymbol: String(args.tokenSymbol),
      totalSupply: String(args.totalSupply),
      proposalCount: 0,
      manager: settings?.manager ?? lower(args.creator),
      votingDelay: optionalString(settings?.votingDelay),
      votingPeriod: optionalString(settings?.votingPeriod),
      proposalThreshold: optionalString(settings?.proposalThreshold),
      quorumNumerator: optionalString(settings?.quorumNumerator),
      timelockMinDelay: optionalString(settings?.timelockMinDelay),
      createdAt: event.timestamp.toString(),
      blockNumber: event.blockNumber.toString(),
      transactionHash: event.txHash,
    });
  }

  // Pass 2: governor and token events
  for (const event of events) {
    const { args } = event;

    if (event.contractType === "GOVERNOR") {
      const owner = governorToDao.get(event.address);
      if (!owner) continue;
      const proposalKey =
        args.proposalId !== undefined
          ? proposalEntityId(chainId, event.address, args.proposalId as bigint)
          : "";

      switch (event.eventName) {
        case "ProposalCreated": {
          const dao = daos.get(owner.daoId);
          if (dao) dao.proposalCount += 1;
          proposals.set(proposalKey, {
            id: proposalKey,
            daoId: owner.daoId,
            chainId,
            governor: event.address,
            token: owner.token,
            proposalId: args.proposalId as bigint,
            proposer: lower(args.proposer),
            targets: (args.targets as readonly string[]).map(lower),
            values: (args.values as readonly bigint[]).map(String),
            calldatas: (args.calldatas as readonly string[]).map(String),
            signatures: (args.signatures as readonly string[]).map(String),
            description: String(args.description),
            voteStart: args.voteStart as bigint,
            voteEnd: args.voteEnd as bigint,
            eta: null,
            queued: false,
            executed: false,
            canceled: false,
            forVotes: 0n,
            againstVotes: 0n,
            abstainVotes: 0n,
            createdAt: event.timestamp,
            blockNumber: event.blockNumber,
            transactionHash: event.txHash,
          });
          break;
        }
        case "ProposalQueued": {
          const proposal = proposals.get(proposalKey);
          if (proposal) {
            proposal.queued = true;
            proposal.eta = args.etaSeconds as bigint;
          }
          break;
        }
        case "ProposalExecuted": {
          const proposal = proposals.get(proposalKey);
          if (proposal) proposal.executed = true;
          break;
        }
        case "ProposalCanceled": {
          const proposal = proposals.get(proposalKey);
          if (proposal) proposal.canceled = true;
          break;
        }
        case "VoteCast":
        case "VoteCastWithParams": {
          const voter = lower(args.voter);
          const support = supportToEnum(args.support);
          const weight = args.weight as bigint;
          const voteId = `${proposalKey}_${voter}`;
          votes.set(voteId, {
            id: voteId,
            proposalId: proposalKey,
            daoId: owner.daoId,
            chainId,
            governor: event.address,
            voter,
            support,
            weight: weight.toString(),
            reason: args.reason ? String(args.reason) : null,
            params: event.eventName === "VoteCastWithParams" ? String(args.params) : null,
            createdAt: event.timestamp.toString(),
            blockNumber: event.blockNumber.toString(),
            transactionHash: event.txHash,
          });
          const proposal = proposals.get(proposalKey);
          if (proposal) {
            if (support === "FOR") proposal.forVotes += weight;
            else if (support === "AGAINST") proposal.againstVotes += weight;
            else proposal.abstainVotes += weight;
          }
          break;
        }
      }
      continue;
    }

    if (event.contractType === "TOKEN") {
      const daoId = tokenToDaoId.get(event.address);
      if (!daoId) continue;
      const token = event.address;

      const touch = (account: string): HolderAccumulator => {
        const id = accountEntityId(chainId, token, account);
        let holder = holders.get(id);
        if (!holder) {
          holder = { daoId, token, holder: account, balance: 0n, votes: 0n, updatedAt: 0n, blockNumber: 0n };
          holders.set(id, holder);
        }
        holder.updatedAt = event.timestamp;
        holder.blockNumber = event.blockNumber;
        return holder;
      };

      switch (event.eventName) {
        case "Transfer": {
          const from = lower(args.from);
          const to = lower(args.to);
          const value = args.value as bigint;
          if (from !== ZERO_ADDRESS) touch(from).balance -= value;
          if (to !== ZERO_ADDRESS) touch(to).balance += value;
          break;
        }
        case "DelegateVotesChanged": {
          touch(lower(args.delegate)).votes = args.newVotes as bigint;
          break;
        }
        case "DelegateChanged": {
          const delegator = lower(args.delegator);
          const id = accountEntityId(chainId, token, delegator);
          delegates.set(id, {
            id,
            daoId,
            chainId,
            token,
            delegator,
            toDelegate: lower(args.toDelegate),
            updatedAt: event.timestamp.toString(),
            blockNumber: event.blockNumber.toString(),
            transactionHash: event.txHash,
          });
          break;
        }
      }
    }
  }

  const holderEntities = new Map<string, TokenHolder>();
  for (const [id, h] of holders) {
    holderEntities.set(id, {
      id,
      daoId: h.daoId,
      chainId,
      token: h.token,
      holder: h.holder,
      balance: h.balance.toString(),
      votes: h.votes.toString(),
      updatedAt: h.updatedAt.toString(),
      blockNumber: h.blockNumber.toString(),
    });
  }

  return { daos, proposals, votes, delegates, holders: holderEntities };
}
