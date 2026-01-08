// ============================================================================
// DAOCAFE SDK
// ============================================================================
// TypeScript SDK for DAO.CAFE - The GraphQL indexer for CreateDAO protocol
// https://dao.cafe
// ============================================================================

// Client
export {
  daoCafeClient,
  createClient,
  setClientHeaders,
  DEFAULT_ENDPOINT,
  GraphQLClient,
} from "./client";

// Types
export type {
  // Enums
  ProposalState,
  VoteSupport,
  SettingType,
  // Entities
  DAO,
  Proposal,
  Vote,
  ProposalVote,
  Delegate,
  TokenHolder,
  GovernanceSettingsChange,
  // Query response types
  PaginatedResponse,
  PageInfo,
  // Query parameter types
  OrderDirection,
  PaginationParams,
  DAOQueryParams,
  DAOsByManagerParams,
  ProposalQueryParams,
  VoteQueryParams,
  DelegateQueryParams,
  TokenHolderQueryParams,
} from "./types";

// Query functions
export {
  // DAO queries
  getDAOs,
  getDAO,
  getDAOsByManager,
  // Proposal queries
  getProposals,
  getProposal,
  getProposalsByDAO,
  getActiveProposals,
  // Vote queries
  getVotes,
  getVote,
  getVotesByProposal,
  getVotesByVoter,
  // Delegate queries
  getDelegates,
  getDelegate,
  getDelegatesByDAO,
  getDelegationsFrom,
  getDelegationsTo,
  // Token holder queries
  getTokenHolders,
  getTokenHolder,
  getTokenHoldersByDAO,
  getTokenHoldingsByAddress,
} from "./queries";

// React hooks (tree-shakable - only imported if used)
export {
  // DAO hooks
  useDAOs,
  useDAO,
  useDAOsByManager,
  daoKeys,
  // Proposal hooks
  useProposals,
  useProposal,
  useProposalsByDAO,
  useActiveProposals,
  proposalKeys,
  // Vote hooks
  useVotes,
  useVote,
  useVotesByProposal,
  useVotesByVoter,
  voteKeys,
  // Delegate hooks
  useDelegates,
  useDelegate,
  useDelegatesByDAO,
  useDelegationsFrom,
  useDelegationsTo,
  delegateKeys,
  // Token holder hooks
  useTokenHolders,
  useTokenHolder,
  useTokenHoldersByDAO,
  useTokenHoldingsByAddress,
  tokenHolderKeys,
} from "./hooks";
