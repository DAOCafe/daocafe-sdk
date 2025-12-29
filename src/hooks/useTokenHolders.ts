import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  getTokenHolders,
  getTokenHolder,
  getTokenHoldersByDAO,
  getTokenHoldingsByAddress,
} from "../queries/tokenHolders";
import type { TokenHolder, TokenHolderQueryParams, PaginatedResponse } from "../types";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const tokenHolderKeys = {
  all: ["tokenHolders"] as const,
  lists: () => [...tokenHolderKeys.all, "list"] as const,
  list: (params: TokenHolderQueryParams) => [...tokenHolderKeys.lists(), params] as const,
  byDAO: (daoId: string, params?: Omit<TokenHolderQueryParams, "daoId">) =>
    [...tokenHolderKeys.all, "byDAO", daoId, params] as const,
  byAddress: (holder: string, params?: Omit<TokenHolderQueryParams, "holder">) =>
    [...tokenHolderKeys.all, "byAddress", holder, params] as const,
  details: () => [...tokenHolderKeys.all, "detail"] as const,
  detail: (id: string) => [...tokenHolderKeys.details(), id] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

type UseTokenHoldersOptions = Omit<
  UseQueryOptions<PaginatedResponse<TokenHolder>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch token holders with optional filters
 *
 * @param params - Query parameters (daoId, holder, orderBy, pagination, etc.)
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated token holders
 *
 * @example
 * ```tsx
 * function TokenHolderList() {
 *   const { data, isLoading } = useTokenHolders({
 *     limit: 50,
 *     orderBy: 'balance',
 *     orderDirection: 'desc'
 *   });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <ul>
 *       {data?.items.map(holder => (
 *         <li key={holder.id}>{holder.holder}: {holder.balance}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useTokenHolders(
  params: TokenHolderQueryParams = {},
  options?: UseTokenHoldersOptions
) {
  return useQuery({
    queryKey: tokenHolderKeys.list(params),
    queryFn: () => getTokenHolders(params),
    ...options,
  });
}

type UseTokenHolderOptions = Omit<
  UseQueryOptions<TokenHolder | null, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch a single token holder record by its ID
 *
 * @param id - TokenHolder ID (format: chainId_tokenAddress_holderAddress)
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with token holder or null
 *
 * @example
 * ```tsx
 * function TokenHolderDetail({ holderId }: { holderId: string }) {
 *   const { data: holder, isLoading } = useTokenHolder(holderId);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!holder) return <div>Holder not found</div>;
 *
 *   return (
 *     <div>
 *       <p>Address: {holder.holder}</p>
 *       <p>Balance: {holder.balance}</p>
 *       <p>Voting Power: {holder.votes}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTokenHolder(id: string, options?: UseTokenHolderOptions) {
  return useQuery({
    queryKey: tokenHolderKeys.detail(id),
    queryFn: () => getTokenHolder(id),
    enabled: !!id,
    ...options,
  });
}

type UseTokenHoldersByDAOOptions = Omit<
  UseQueryOptions<PaginatedResponse<TokenHolder>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch all token holders for a specific DAO
 *
 * @param daoId - DAO ID (format: chainId_governorAddress)
 * @param params - Additional query parameters
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated token holders
 *
 * @example
 * ```tsx
 * function DAOTokenHolders({ daoId }: { daoId: string }) {
 *   const { data } = useTokenHoldersByDAO(daoId, {
 *     limit: 100,
 *     orderBy: 'votes',
 *     orderDirection: 'desc'
 *   });
 *
 *   return (
 *     <div>
 *       <h3>Top Token Holders</h3>
 *       <ul>
 *         {data?.items.map(h => (
 *           <li key={h.id}>
 *             {h.holder}: {h.votes} votes
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTokenHoldersByDAO(
  daoId: string,
  params: Omit<TokenHolderQueryParams, "daoId"> = {},
  options?: UseTokenHoldersByDAOOptions
) {
  return useQuery({
    queryKey: tokenHolderKeys.byDAO(daoId, params),
    queryFn: () => getTokenHoldersByDAO(daoId, params),
    enabled: !!daoId,
    ...options,
  });
}

type UseTokenHoldingsByAddressOptions = Omit<
  UseQueryOptions<PaginatedResponse<TokenHolder>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch all token holdings for a specific address across all DAOs
 *
 * @param holder - Holder address
 * @param params - Additional query parameters
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated token holdings
 *
 * @example
 * ```tsx
 * function MyTokenHoldings({ address }: { address: string }) {
 *   const { data } = useTokenHoldingsByAddress(address);
 *
 *   return (
 *     <div>
 *       <h3>My DAO Tokens</h3>
 *       <ul>
 *         {data?.items.map(h => (
 *           <li key={h.id}>
 *             DAO {h.daoId}: {h.balance} tokens, {h.votes} votes
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTokenHoldingsByAddress(
  holder: string,
  params: Omit<TokenHolderQueryParams, "holder"> = {},
  options?: UseTokenHoldingsByAddressOptions
) {
  return useQuery({
    queryKey: tokenHolderKeys.byAddress(holder, params),
    queryFn: () => getTokenHoldingsByAddress(holder, params),
    enabled: !!holder,
    ...options,
  });
}
