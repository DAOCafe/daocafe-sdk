import { gql, type GraphQLClient } from "graphql-request";
import { daoCafeClient } from "../client";
import type { Vote, VoteQueryParams, PaginatedResponse } from "../types";

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

const VOTE_FIELDS = gql`
  fragment VoteFields on vote {
    id
    proposalId
    daoId
    chainId
    governor
    voter
    support
    weight
    reason
    params
    createdAt
    blockNumber
    transactionHash
  }
`;

const GET_VOTES = gql`
  ${VOTE_FIELDS}
  query GetVotes(
    $limit: Int
    $after: String
    $before: String
    $orderBy: String
    $orderDirection: String
    $proposalId: String
    $daoId: String
    $voter: String
    $support: voteSupport
  ) {
    votes(
      limit: $limit
      after: $after
      before: $before
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { proposalId: $proposalId, daoId: $daoId, voter: $voter, support: $support }
    ) {
      items {
        ...VoteFields
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

const GET_VOTES_BY_PROPOSAL = gql`
  ${VOTE_FIELDS}
  query GetVotesByProposal(
    $proposalId: String!
    $limit: Int
    $after: String
    $before: String
    $orderBy: String
    $orderDirection: String
  ) {
    votes(
      where: { proposalId: $proposalId }
      limit: $limit
      after: $after
      before: $before
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      items {
        ...VoteFields
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

const GET_VOTES_BY_VOTER = gql`
  ${VOTE_FIELDS}
  query GetVotesByVoter(
    $voter: String!
    $limit: Int
    $after: String
    $before: String
    $orderBy: String
    $orderDirection: String
  ) {
    votes(
      where: { voter: $voter }
      limit: $limit
      after: $after
      before: $before
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      items {
        ...VoteFields
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

const GET_VOTE = gql`
  ${VOTE_FIELDS}
  query GetVote($id: String!) {
    vote(id: $id) {
      ...VoteFields
    }
  }
`;

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

interface GetVotesResponse {
  votes: PaginatedResponse<Vote>;
}

interface GetVoteResponse {
  vote: Vote | null;
}

/**
 * Fetch votes with optional filters
 *
 * @param params - Query parameters (proposalId, voter, support, pagination, etc.)
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of votes
 *
 * @example
 * ```ts
 * // Get all votes
 * const { items } = await getVotes({ limit: 50 });
 *
 * // Get "FOR" votes on a proposal
 * const { items } = await getVotes({ proposalId: "8453_0x..._123", support: "FOR" });
 * ```
 */
export async function getVotes(
  params: VoteQueryParams = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<Vote>> {
  const { votes } = await client.request<GetVotesResponse>(GET_VOTES, params);
  return votes;
}

/**
 * Fetch all votes for a specific proposal
 *
 * @param proposalId - Proposal ID (format: chainId_governor_proposalId)
 * @param params - Additional query parameters
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of votes for the proposal
 *
 * @example
 * ```ts
 * const { items } = await getVotesByProposal("8453_0x1234..._123", { limit: 100 });
 * ```
 */
export async function getVotesByProposal(
  proposalId: string,
  params: Omit<VoteQueryParams, "proposalId"> = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<Vote>> {
  const { votes } = await client.request<GetVotesResponse>(GET_VOTES_BY_PROPOSAL, {
    proposalId,
    ...params,
  });
  return votes;
}

/**
 * Fetch all votes cast by a specific voter
 *
 * @param voter - Voter address
 * @param params - Additional query parameters
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of votes by the voter
 *
 * @example
 * ```ts
 * const { items } = await getVotesByVoter("0x1234...", { limit: 50 });
 * ```
 */
export async function getVotesByVoter(
  voter: string,
  params: Omit<VoteQueryParams, "voter"> = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<Vote>> {
  const { votes } = await client.request<GetVotesResponse>(GET_VOTES_BY_VOTER, {
    voter,
    ...params,
  });
  return votes;
}

/**
 * Fetch a single vote by its ID
 *
 * @param id - Vote ID (format: chainId_governor_proposalId_voter)
 * @param client - Optional custom GraphQL client
 * @returns Vote or null if not found
 *
 * @example
 * ```ts
 * const vote = await getVote("8453_0x1234..._123_0xabcd...");
 * ```
 */
export async function getVote(
  id: string,
  client: GraphQLClient = daoCafeClient
): Promise<Vote | null> {
  const { vote } = await client.request<GetVoteResponse>(GET_VOTE, { id });
  return vote;
}
