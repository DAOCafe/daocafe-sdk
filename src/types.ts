// ============================================================================
// ENUMS
// ============================================================================

/**
 * Proposal state enum matching OpenZeppelin Governor
 * Values: Pending(0), Active(1), Canceled(2), Defeated(3), Succeeded(4), Queued(5), Expired(6), Executed(7)
 */
export type ProposalState =
  | "PENDING"
  | "ACTIVE"
  | "CANCELED"
  | "DEFEATED"
  | "SUCCEEDED"
  | "QUEUED"
  | "EXPIRED"
  | "EXECUTED";

/**
 * Vote support enum matching OpenZeppelin Governor
 * Values: Against(0), For(1), Abstain(2)
 */
export type VoteSupport = "AGAINST" | "FOR" | "ABSTAIN";

/**
 * Governance setting type enum
 */
export type SettingType =
  | "VOTING_DELAY"
  | "VOTING_PERIOD"
  | "PROPOSAL_THRESHOLD"
  | "QUORUM_NUMERATOR";

// ============================================================================
// ENTITY TYPES
// ============================================================================

/**
 * DAO entity - tracks all DAOs created through the factory
 */
export interface DAO {
  /** Composite ID: chainId_governorAddress */
  id: string;
  chainId: number;
  governor: string;
  token: string;
  timelock: string;
  creator: string;
  name: string;
  tokenName: string;
  tokenSymbol: string;
  totalSupply: string;
  proposalCount: number;
  /** Manager address (can be updated via governance) */
  manager: string | null;
  /** Governance settings (cached for quick access) */
  votingDelay: string | null;
  votingPeriod: string | null;
  proposalThreshold: string | null;
  quorumNumerator: string | null;
  /** Timelock configuration */
  timelockMinDelay: string | null;
  createdAt: string;
  blockNumber: string;
  transactionHash: string;
  /** Relations */
  proposals?: Proposal[];
  votes?: Vote[];
  delegates?: Delegate[];
  tokenHolders?: TokenHolder[];
  settingsChanges?: GovernanceSettingsChange[];
}

/**
 * Proposal entity - tracks all governance proposals
 */
export interface Proposal {
  /** ID: chainId_governorAddress_proposalId */
  id: string;
  daoId: string;
  chainId: number;
  governor: string;
  proposalId: string;
  proposer: string;
  /** Proposal content */
  targets: string[];
  values: string[];
  calldatas: string[];
  signatures: string[] | null;
  /**
   * Human-readable decoding of each (target,value,calldata) action.
   * This is produced by the indexer at indexing time.
   */
  decodedActions?: DecodedAction[] | null;
  description: string;
  /** Timing */
  voteStart: string;
  voteEnd: string;
  eta: string | null;
  /** Vote tallies */
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  state: ProposalState;
  createdAt: string;
  blockNumber: string;
  transactionHash: string;
  /** Relations */
  dao?: DAO;
  votes?: Vote[];
}

// ============================================================================
// DECODED ACTION TYPES
// ============================================================================

/** A single decoded argument from calldata */
export interface DecodedArg {
  /** Generic name (arg0, arg1, etc.) since 4bytes doesn't provide parameter names */
  name: string;
  /** Solidity type (uint256, address, bytes, etc.) */
  type: string;
  /** Stringified value */
  value: string;
}

export interface DecodedSuccess {
  status: "success";
  functionName: string;
  signature: string;
  args: DecodedArg[];
  summary: string;
}

export interface DecodedError {
  status: "error";
  error: string;
  selector: string;
  hint: string;
}

export type DecodedData = DecodedSuccess | DecodedError;

export interface DecodedAction {
  index: number;
  target: string;
  value: string;
  calldata: string;
  decoded: DecodedData;
}

/**
 * Vote entity - tracks individual votes on proposals
 */
export interface Vote {
  /** ID: chainId_governor_proposalId_voter */
  id: string;
  proposalId: string;
  daoId: string;
  chainId: number;
  governor: string;
  voter: string;
  support: VoteSupport;
  weight: string;
  reason: string | null;
  params: string | null;
  createdAt: string;
  blockNumber: string;
  transactionHash: string;
  /** Relations */
  proposal?: Proposal;
  dao?: DAO;
}

/**
 * ProposalVote type alias for Vote entity
 * @deprecated Use Vote type instead
 */
export type ProposalVote = Vote;

/**
 * Delegate entity - tracks delegation relationships
 */
export interface Delegate {
  /** ID: chainId_tokenAddress_delegatorAddress */
  id: string;
  daoId: string;
  chainId: number;
  token: string;
  delegator: string;
  toDelegate: string;
  updatedAt: string;
  blockNumber: string;
  transactionHash: string;
  /** Relations */
  dao?: DAO;
}

/**
 * TokenHolder entity - tracks token balances and voting power
 */
export interface TokenHolder {
  /** ID: chainId_tokenAddress_holderAddress */
  id: string;
  daoId: string;
  chainId: number;
  token: string;
  holder: string;
  balance: string;
  votes: string;
  updatedAt: string;
  blockNumber: string;
  /** Relations */
  dao?: DAO;
}

/**
 * GovernanceSettingsChange entity - audit log for setting changes
 */
export interface GovernanceSettingsChange {
  /** ID: chainId_governor_blockNumber_logIndex */
  id: string;
  daoId: string;
  chainId: number;
  governor: string;
  setting: SettingType;
  oldValue: string;
  newValue: string;
  createdAt: string;
  blockNumber: string;
  transactionHash: string;
  /** Relations */
  dao?: DAO;
}

// ============================================================================
// QUERY RESPONSE TYPES
// ============================================================================

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  pageInfo: PageInfo;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

// ============================================================================
// QUERY PARAMETER TYPES
// ============================================================================

export type OrderDirection = "asc" | "desc";

export interface PaginationParams {
  limit?: number;
  after?: string;
  before?: string;
}

export interface DAOQueryParams extends PaginationParams {
  orderBy?: "createdAt" | "proposalCount" | "name";
  orderDirection?: OrderDirection;
}

export interface DAOsByManagerParams extends PaginationParams {
  manager: string;
}

export interface ProposalQueryParams extends PaginationParams {
  daoId?: string;
  state?: ProposalState;
  proposer?: string;
  orderBy?: "createdAt" | "voteEnd" | "voteStart";
  orderDirection?: OrderDirection;
}

export interface VoteQueryParams extends PaginationParams {
  proposalId?: string;
  daoId?: string;
  voter?: string;
  support?: VoteSupport;
  orderBy?: "createdAt" | "weight" | "timestamp";
  orderDirection?: OrderDirection;
}

export interface DelegateQueryParams extends PaginationParams {
  daoId?: string;
  delegator?: string;
  toDelegate?: string;
  orderBy?: "updatedAt";
  orderDirection?: OrderDirection;
}

export interface TokenHolderQueryParams extends PaginationParams {
  daoId?: string;
  holder?: string;
  orderBy?: "balance" | "votes" | "updatedAt";
  orderDirection?: OrderDirection;
}
