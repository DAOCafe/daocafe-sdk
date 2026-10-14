import { daoCafeClient, type DaoCafeClient } from "../client";
import type { Delegate, DelegateQueryParams, PaginatedResponse } from "../types";

/**
 * Fetch delegations with optional filters
 *
 * @param params - Query parameters (daoId, delegator, toDelegate, pagination)
 * @param client - Optional custom client
 * @returns Paginated list of delegations
 *
 * @example
 * ```ts
 * const { items } = await getDelegates({ daoId: "1_0x..." });
 * ```
 */
export async function getDelegates(
  params: DelegateQueryParams = {},
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<Delegate>> {
  return client.request("delegates", params);
}

/**
 * Fetch delegations for a specific DAO
 *
 * @param daoId - DAO ID (format: chainId_governorAddress)
 * @param params - Additional query parameters
 * @param client - Optional custom client
 * @returns Paginated list of delegations in the DAO
 *
 * @example
 * ```ts
 * const { items } = await getDelegatesByDAO("1_0x1234...");
 * ```
 */
export async function getDelegatesByDAO(
  daoId: string,
  params: Omit<DelegateQueryParams, "daoId"> = {},
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<Delegate>> {
  return client.request("delegates", { ...params, daoId });
}

/**
 * Fetch delegations made by an address (who they delegate to)
 *
 * @param delegator - Delegator address
 * @param params - Additional query parameters
 * @param client - Optional custom client
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
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<Delegate>> {
  return client.request("delegates", { ...params, delegator });
}

/**
 * Fetch delegations made to an address (who delegates to them)
 *
 * @param toDelegate - Delegate address
 * @param params - Additional query parameters
 * @param client - Optional custom client
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
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<Delegate>> {
  return client.request("delegates", { ...params, toDelegate });
}

/**
 * Fetch a single delegation by its ID
 *
 * @param id - Delegate ID (format: chainId_tokenAddress_delegatorAddress)
 * @param client - Optional custom client
 * @returns Delegation or null if not found
 *
 * @example
 * ```ts
 * const delegation = await getDelegate("1_0xtoken..._0xdelegator...");
 * ```
 */
export async function getDelegate(
  id: string,
  client: DaoCafeClient = daoCafeClient
): Promise<Delegate | null> {
  return client.request("delegate", { id });
}
