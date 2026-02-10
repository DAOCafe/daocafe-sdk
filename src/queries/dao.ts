import { gql, type GraphQLClient } from "graphql-request";
import { daoCafeClient } from "../client";
import type {
  DAO,
  DAOQueryParams,
  DAOsByManagerParams,
  PaginatedResponse,
} from "../types";

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

const DAO_FIELDS = gql`
  fragment DAOFields on dao {
    id
    chainId
    governor
    token
    timelock
    creator
    name
    tokenName
    tokenSymbol
    totalSupply
    proposalCount
    manager
    votingDelay
    votingPeriod
    proposalThreshold
    quorumNumerator
    timelockMinDelay
    createdAt
    blockNumber
    transactionHash
  }
`;

const GET_DAOS = gql`
  ${DAO_FIELDS}
  query GetDAOs(
    $limit: Int
    $after: String
    $before: String
    $orderBy: String
    $orderDirection: String
  ) {
    daos(
      limit: $limit
      after: $after
      before: $before
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      items {
        ...DAOFields
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

const GET_DAO = gql`
  ${DAO_FIELDS}
  query GetDAO($id: String!) {
    dao(id: $id) {
      ...DAOFields
    }
  }
`;

const GET_DAOS_BY_MANAGER = gql`
  ${DAO_FIELDS}
  query GetDAOsByManager(
    $manager: String!
    $limit: Int
    $after: String
    $before: String
  ) {
    daos(where: { manager: $manager }, limit: $limit, after: $after, before: $before) {
      items {
        ...DAOFields
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

interface GetDAOsResponse {
  daos: PaginatedResponse<DAO>;
}

interface GetDAOResponse {
  dao: DAO | null;
}

/**
 * Fetch all DAOs with optional pagination and ordering
 *
 * @param params - Query parameters (limit, after, orderBy, etc.)
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of DAOs
 *
 * @example
 * ```ts
 * const { items, pageInfo } = await getDAOs({ limit: 10 });
 * ```
 */
export async function getDAOs(
  params: DAOQueryParams = {},
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<DAO>> {
  const { daos } = await client.request<GetDAOsResponse>(GET_DAOS, params);
  return daos;
}

/**
 * Fetch a single DAO by its ID
 *
 * @param id - DAO ID (format: chainId_governorAddress)
 * @param client - Optional custom GraphQL client
 * @returns DAO or null if not found
 *
 * @example
 * ```ts
 * const dao = await getDAO("8453_0x1234...");
 * ```
 */
export async function getDAO(
  id: string,
  client: GraphQLClient = daoCafeClient
): Promise<DAO | null> {
  const { dao } = await client.request<GetDAOResponse>(GET_DAO, { id });
  return dao;
}

/**
 * Fetch DAOs by manager address
 *
 * @param params - Query parameters including manager address
 * @param client - Optional custom GraphQL client
 * @returns Paginated list of DAOs managed by the address
 *
 * @example
 * ```ts
 * const { items } = await getDAOsByManager({ manager: "0x1234..." });
 * ```
 */
export async function getDAOsByManager(
  params: DAOsByManagerParams,
  client: GraphQLClient = daoCafeClient
): Promise<PaginatedResponse<DAO>> {
  const { daos } = await client.request<GetDAOsResponse>(GET_DAOS_BY_MANAGER, params);
  return daos;
}
