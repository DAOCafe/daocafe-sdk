import { daoCafeClient, type DaoCafeClient } from "../client";
import type { TokenHolder, TokenHolderQueryParams, PaginatedResponse } from "../types";

/**
 * Fetch token holders with optional filters
 *
 * @param params - Query parameters (daoId, holder, ordering, pagination)
 * @param client - Optional custom client
 * @returns Paginated list of token holders
 *
 * @example
 * ```ts
 * const { items } = await getTokenHolders({ daoId: "1_0x...", orderBy: "votes" });
 * ```
 */
export async function getTokenHolders(
  params: TokenHolderQueryParams = {},
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<TokenHolder>> {
  return client.request("tokenHolders", params);
}

/**
 * Fetch token holders for a specific DAO
 *
 * @param daoId - DAO ID (format: chainId_governorAddress)
 * @param params - Additional query parameters
 * @param client - Optional custom client
 * @returns Paginated list of token holders in the DAO
 *
 * @example
 * ```ts
 * const { items } = await getTokenHoldersByDAO("1_0x1234...", { orderBy: "balance" });
 * ```
 */
export async function getTokenHoldersByDAO(
  daoId: string,
  params: Omit<TokenHolderQueryParams, "daoId"> = {},
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<TokenHolder>> {
  return client.request("tokenHolders", { ...params, daoId });
}

/**
 * Fetch a single token holder by its ID
 *
 * @param id - Token holder ID (format: chainId_tokenAddress_holderAddress)
 * @param client - Optional custom client
 * @returns Token holder or null if not found
 *
 * @example
 * ```ts
 * const holder = await getTokenHolder("1_0xtoken..._0xholder...");
 * ```
 */
export async function getTokenHolder(
  id: string,
  client: DaoCafeClient = daoCafeClient
): Promise<TokenHolder | null> {
  return client.request("tokenHolder", { id });
}

/**
 * Fetch all DAO token holdings of an address
 *
 * @param holder - Holder address
 * @param params - Additional query parameters
 * @param client - Optional custom client
 * @returns Paginated list of holdings across DAOs
 *
 * @example
 * ```ts
 * const { items } = await getTokenHoldingsByAddress("0x1234...");
 * ```
 */
export async function getTokenHoldingsByAddress(
  holder: string,
  params: Omit<TokenHolderQueryParams, "holder"> = {},
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<TokenHolder>> {
  return client.request("tokenHolders", { ...params, holder });
}
