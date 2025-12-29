import { gql, type GraphQLClient } from "graphql-request";
import { daoCafeClient } from "../client";
import type { TokenHolder, TokenHolderQueryParams, PaginatedResponse } from "../types";

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

const TOKEN_HOLDER_FIELDS = gql`
  fragment TokenHolderFields on tokenHolder {
    id
    daoId
    chainId
    token
    holder
    balance
    votes
    updatedAt
    blockNumber
  }
`;

const GET_TOKEN_HOLDERS = gql`
  ${TOKEN_HOLDER_FIELDS}
  query GetTokenHolders(
    $limit: Int
    $after: String
    $before: String
    $orderBy: String
    $orderDirection: String
    $daoId: String
    $holder: String
  ) {
    tokenHolders(
      limit: $limit
      after: $after
      before: $before
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { daoId: $daoId, holder: $holder }
    ) {
      items {
        ...TokenHolderFields
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

const GET_TOKEN_HOLDERS_BY_DAO = gql`
  ${TOKEN_HOLDER_FIELDS}
  query GetTokenHoldersByDAO(
    $daoId: String!
    $limit: Int
    $after: String
    $before: String
    $orderBy: String
    $orderDirection: String
  ) {
    tokenHolders(
      where: { daoId: $daoId }
      limit: $limit
      after: $after
      before: $before
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      items {
        ...TokenHolderFields
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

const GET_TOKEN_HOLDER = gql`
  ${TOKEN_HOLDER_FIELDS}
  query GetTokenHolder($id: String!) {
    tokenHolder(id: $id) {
      ...TokenHolderFields
    }
  }
`;

const GET_TOKEN_HOLDINGS_BY_ADDRESS = gql`
  ${TOKEN_HOLDER_FIELDS}
  query GetTokenHoldingsByAddress(
    $holder: String!
    $limit: Int
    $after: String
    $before: String
  ) {
    tokenHolders(
      where: { holder: $holder }
      limit: $limit
      after: $after
      before: $before
    ) {
      items {
        ...TokenHolderFields
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

interface GetTokenHoldersResponse {
  tokenHolders: PaginatedResponse<TokenHolder>;
}

interface GetTokenHolderResponse {
  tokenHolder: TokenHolder | null;
}

/**
 * Fetch token holders with optional filters
 *
 * @param params - Query parameters (daoId, holder, orderBy, pagination, etc.)
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of token holders
 *
 * @example
 * ```ts
 * // Get top holders by balance
 * const { items } = await getTokenHolders({
 *   daoId: "8453_0x...",
 *   orderBy: "balance",
 *   orderDirection: "desc"
 * });
 * ```
 */
export async function getTokenHolders(
  params: TokenHolderQueryParams = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<TokenHolder>> {
  const { tokenHolders } = await client.request<GetTokenHoldersResponse>(GET_TOKEN_HOLDERS, params);
  return tokenHolders;
}

/**
 * Fetch all token holders for a specific DAO
 *
 * @param daoId - DAO ID (format: chainId_governorAddress)
 * @param params - Additional query parameters
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of token holders for the DAO
 *
 * @example
 * ```ts
 * // Get top 100 holders by voting power
 * const { items } = await getTokenHoldersByDAO("8453_0x1234...", {
 *   limit: 100,
 *   orderBy: "votes",
 *   orderDirection: "desc"
 * });
 * ```
 */
export async function getTokenHoldersByDAO(
  daoId: string,
  params: Omit<TokenHolderQueryParams, "daoId"> = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<TokenHolder>> {
  const { tokenHolders } = await client.request<GetTokenHoldersResponse>(GET_TOKEN_HOLDERS_BY_DAO, {
    daoId,
    ...params,
  });
  return tokenHolders;
}

/**
 * Fetch a single token holder record by its ID
 *
 * @param id - TokenHolder ID (format: chainId_tokenAddress_holderAddress)
 * @param client - Optional custom GraphQL client
 * @returns TokenHolder or null if not found
 *
 * @example
 * ```ts
 * const holder = await getTokenHolder("8453_0xtoken..._0xholder...");
 * ```
 */
export async function getTokenHolder(
  id: string,
  client: GraphQLClient = daoCafeClient
): Promise<TokenHolder | null> {
  const { tokenHolder } = await client.request<GetTokenHolderResponse>(GET_TOKEN_HOLDER, { id });
  return tokenHolder;
}

/**
 * Fetch all token holdings for a specific address across all DAOs
 *
 * @param holder - Holder address
 * @param params - Additional query parameters
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of token holdings for the address
 *
 * @example
 * ```ts
 * // Get all DAOs where address holds tokens
 * const { items } = await getTokenHoldingsByAddress("0x1234...");
 * ```
 */
export async function getTokenHoldingsByAddress(
  holder: string,
  params: Omit<TokenHolderQueryParams, "holder"> = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<TokenHolder>> {
  const { tokenHolders } = await client.request<GetTokenHoldersResponse>(
    GET_TOKEN_HOLDINGS_BY_ADDRESS,
    { holder, ...params }
  );
  return tokenHolders;
}
