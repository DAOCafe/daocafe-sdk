import { gql, type GraphQLClient } from "graphql-request";
import { daoCafeClient } from "../client";
import type { Delegate, DelegateQueryParams, PaginatedResponse } from "../types";

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

const DELEGATE_FIELDS = gql`
  fragment DelegateFields on delegate {
    id
    daoId
    chainId
    token
    delegator
    toDelegate
    updatedAt
    blockNumber
    transactionHash
  }
`;

const GET_DELEGATES = gql`
  ${DELEGATE_FIELDS}
  query GetDelegates(
    $limit: Int
    $after: String
    $before: String
    $orderBy: String
    $orderDirection: String
    $daoId: String
    $delegator: String
    $toDelegate: String
  ) {
    delegates(
      limit: $limit
      after: $after
      before: $before
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { daoId: $daoId, delegator: $delegator, toDelegate: $toDelegate }
    ) {
      items {
        ...DelegateFields
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

const GET_DELEGATES_BY_DAO = gql`
  ${DELEGATE_FIELDS}
  query GetDelegatesByDAO(
    $daoId: String!
    $limit: Int
    $after: String
    $before: String
    $orderBy: String
    $orderDirection: String
  ) {
    delegates(
      where: { daoId: $daoId }
      limit: $limit
      after: $after
      before: $before
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      items {
        ...DelegateFields
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

const GET_DELEGATIONS_FROM = gql`
  ${DELEGATE_FIELDS}
  query GetDelegationsFrom(
    $delegator: String!
    $limit: Int
    $after: String
    $before: String
  ) {
    delegates(
      where: { delegator: $delegator }
      limit: $limit
      after: $after
      before: $before
    ) {
      items {
        ...DelegateFields
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

const GET_DELEGATIONS_TO = gql`
  ${DELEGATE_FIELDS}
  query GetDelegationsTo(
    $toDelegate: String!
    $limit: Int
    $after: String
    $before: String
  ) {
    delegates(
      where: { toDelegate: $toDelegate }
      limit: $limit
      after: $after
      before: $before
    ) {
      items {
        ...DelegateFields
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

const GET_DELEGATE = gql`
  ${DELEGATE_FIELDS}
  query GetDelegate($id: String!) {
    delegate(id: $id) {
      ...DelegateFields
    }
  }
`;

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

interface GetDelegatesResponse {
  delegates: PaginatedResponse<Delegate>;
}

interface GetDelegateResponse {
  delegate: Delegate | null;
}

/**
 * Fetch delegates with optional filters
 *
 * @param params - Query parameters (daoId, delegator, toDelegate, pagination, etc.)
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of delegates
 *
 * @example
 * ```ts
 * const { items } = await getDelegates({ daoId: "8453_0x..." });
 * ```
 */
export async function getDelegates(
  params: DelegateQueryParams = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<Delegate>> {
  const { delegates } = await client.request<GetDelegatesResponse>(GET_DELEGATES, params);
  return delegates;
}

/**
 * Fetch all delegates for a specific DAO
 *
 * @param daoId - DAO ID (format: chainId_governorAddress)
 * @param params - Additional query parameters
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of delegates for the DAO
 *
 * @example
 * ```ts
 * const { items } = await getDelegatesByDAO("8453_0x1234...", { limit: 100 });
 * ```
 */
export async function getDelegatesByDAO(
  daoId: string,
  params: Omit<DelegateQueryParams, "daoId"> = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<Delegate>> {
  const { delegates } = await client.request<GetDelegatesResponse>(GET_DELEGATES_BY_DAO, {
    daoId,
    ...params,
  });
  return delegates;
}

/**
 * Fetch all delegations FROM a specific address (who this address delegated to)
 *
 * @param delegator - Delegator address
 * @param params - Additional query parameters
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of delegations from the address
 *
 * @example
 * ```ts
 * const { items } = await getDelegationsFrom("0x1234...");
 * ```
 */
export async function getDelegationsFrom(
  delegator: string,
  params: Omit<DelegateQueryParams, "delegator"> = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<Delegate>> {
  const { delegates } = await client.request<GetDelegatesResponse>(GET_DELEGATIONS_FROM, {
    delegator,
    ...params,
  });
  return delegates;
}

/**
 * Fetch all delegations TO a specific address (who delegated to this address)
 *
 * @param toDelegate - Delegate address receiving delegations
 * @param params - Additional query parameters
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of delegations to the address
 *
 * @example
 * ```ts
 * const { items } = await getDelegationsTo("0x1234...");
 * ```
 */
export async function getDelegationsTo(
  toDelegate: string,
  params: Omit<DelegateQueryParams, "toDelegate"> = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<Delegate>> {
  const { delegates } = await client.request<GetDelegatesResponse>(GET_DELEGATIONS_TO, {
    toDelegate,
    ...params,
  });
  return delegates;
}

/**
 * Fetch a single delegate record by its ID
 *
 * @param id - Delegate ID (format: chainId_tokenAddress_delegatorAddress)
 * @param client - Optional custom GraphQL client
 * @returns Delegate or null if not found
 *
 * @example
 * ```ts
 * const delegate = await getDelegate("8453_0xtoken..._0xdelegator...");
 * ```
 */
export async function getDelegate(
  id: string,
  client: GraphQLClient = daoCafeClient
): Promise<Delegate | null> {
  const { delegate } = await client.request<GetDelegateResponse>(GET_DELEGATE, { id });
  return delegate;
}
