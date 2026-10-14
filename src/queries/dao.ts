import { daoCafeClient, type DaoCafeClient } from "../client";
import type {
  DAO,
  DAOQueryParams,
  DAOsByManagerParams,
  PaginatedResponse,
} from "../types";

/**
 * Fetch all DAOs with optional pagination and ordering
 *
 * @param params - Query parameters (limit, after, orderBy, etc.)
 * @param client - Optional custom client
 * @returns Paginated list of DAOs
 *
 * @example
 * ```ts
 * const { items, pageInfo } = await getDAOs({ limit: 10 });
 * ```
 */
export async function getDAOs(
  params: DAOQueryParams = {},
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<DAO>> {
  return client.request("daos", params);
}

/**
 * Fetch a single DAO by its ID
 *
 * @param id - DAO ID (format: chainId_governorAddress)
 * @param client - Optional custom client
 * @returns DAO or null if not found
 *
 * @example
 * ```ts
 * const dao = await getDAO("1_0x1234...");
 * ```
 */
export async function getDAO(
  id: string,
  client: DaoCafeClient = daoCafeClient
): Promise<DAO | null> {
  return client.request("dao", { id });
}

/**
 * Fetch DAOs by manager address
 *
 * @param params - Query parameters including manager address
 * @param client - Optional custom client
 * @returns Paginated list of DAOs managed by the address
 *
 * @example
 * ```ts
 * const { items } = await getDAOsByManager({ manager: "0x1234..." });
 * ```
 */
export async function getDAOsByManager(
  params: DAOsByManagerParams,
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<DAO>> {
  return client.request("daos", params);
}
