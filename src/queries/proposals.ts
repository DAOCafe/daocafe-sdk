import { gql, type GraphQLClient } from "graphql-request";
import { daoCafeClient } from "../client";
import type {
  Proposal,
  ProposalQueryParams,
  PaginatedResponse,
} from "../types";

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

const PROPOSAL_FIELDS = gql`
  fragment ProposalFields on proposal {
    id
    daoId
    chainId
    governor
    proposalId
    proposer
    targets
    values
    calldatas
    signatures
    description
    voteStart
    voteEnd
    eta
    forVotes
    againstVotes
    abstainVotes
    state
    createdAt
    blockNumber
    transactionHash
  }
`;

const GET_PROPOSALS = gql`
  ${PROPOSAL_FIELDS}
  query GetProposals(
    $limit: Int
    $after: String
    $before: String
    $orderBy: String
    $orderDirection: String
    $daoId: String
    $state: proposalState
    $proposer: String
  ) {
    proposals(
      limit: $limit
      after: $after
      before: $before
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { daoId: $daoId, state: $state, proposer: $proposer }
    ) {
      items {
        ...ProposalFields
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

const GET_PROPOSALS_BY_DAO = gql`
  ${PROPOSAL_FIELDS}
  query GetProposalsByDAO(
    $daoId: String!
    $limit: Int
    $after: String
    $before: String
    $orderBy: String
    $orderDirection: String
  ) {
    proposals(
      where: { daoId: $daoId }
      limit: $limit
      after: $after
      before: $before
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      items {
        ...ProposalFields
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

const GET_PROPOSAL = gql`
  ${PROPOSAL_FIELDS}
  query GetProposal($id: String!) {
    proposal(id: $id) {
      ...ProposalFields
    }
  }
`;

const GET_ACTIVE_PROPOSALS = gql`
  ${PROPOSAL_FIELDS}
  query GetActiveProposals(
    $limit: Int
    $after: String
    $orderBy: String
    $orderDirection: String
  ) {
    proposals(
      where: { state: ACTIVE }
      limit: $limit
      after: $after
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      items {
        ...ProposalFields
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

interface GetProposalsResponse {
  proposals: PaginatedResponse<Proposal>;
}

interface GetProposalResponse {
  proposal: Proposal | null;
}

/**
 * Fetch proposals with optional filters
 *
 * @param params - Query parameters (daoId, state, proposer, pagination, etc.)
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of proposals
 *
 * @example
 * ```ts
 * // Get all proposals
 * const { items } = await getProposals({ limit: 20 });
 *
 * // Get active proposals for a specific DAO
 * const { items } = await getProposals({ daoId: "8453_0x...", state: "ACTIVE" });
 * ```
 */
export async function getProposals(
  params: ProposalQueryParams = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<Proposal>> {
  const { proposals } = await client.request<GetProposalsResponse>(GET_PROPOSALS, params);
  return proposals;
}

/**
 * Fetch proposals for a specific DAO
 *
 * @param daoId - DAO ID (format: chainId_governorAddress)
 * @param params - Additional query parameters
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of proposals for the DAO
 *
 * @example
 * ```ts
 * const { items } = await getProposalsByDAO("8453_0x1234...", { limit: 10 });
 * ```
 */
export async function getProposalsByDAO(
  daoId: string,
  params: Omit<ProposalQueryParams, "daoId"> = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<Proposal>> {
  const { proposals } = await client.request<GetProposalsResponse>(GET_PROPOSALS_BY_DAO, {
    daoId,
    ...params,
  });
  return proposals;
}

/**
 * Fetch a single proposal by its ID
 *
 * @param id - Proposal ID (format: chainId_governor_proposalId)
 * @param client - Optional custom GraphQL client
 * @returns Proposal or null if not found
 *
 * @example
 * ```ts
 * const proposal = await getProposal("8453_0x1234..._12345");
 * ```
 */
export async function getProposal(
  id: string,
  client: GraphQLClient = daoCafeClient
): Promise<Proposal | null> {
  const { proposal } = await client.request<GetProposalResponse>(GET_PROPOSAL, { id });
  return proposal;
}

/**
 * Fetch all currently active proposals across all DAOs
 *
 * @param params - Pagination parameters
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of active proposals
 *
 * @example
 * ```ts
 * const { items } = await getActiveProposals({ limit: 10 });
 * ```
 */
export async function getActiveProposals(
  params: Omit<ProposalQueryParams, "state"> = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<Proposal>> {
  const { proposals } = await client.request<GetProposalsResponse>(GET_ACTIVE_PROPOSALS, params);
  return proposals;
}
