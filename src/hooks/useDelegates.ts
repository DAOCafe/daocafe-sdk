import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  getDelegates,
  getDelegate,
  getDelegatesByDAO,
  getDelegationsFrom,
  getDelegationsTo,
} from "../queries/delegates";
import type { Delegate, DelegateQueryParams, PaginatedResponse } from "../types";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const delegateKeys = {
  all: ["delegates"] as const,
  lists: () => [...delegateKeys.all, "list"] as const,
  list: (params: DelegateQueryParams) => [...delegateKeys.lists(), params] as const,
  byDAO: (daoId: string, params?: Omit<DelegateQueryParams, "daoId">) =>
    [...delegateKeys.all, "byDAO", daoId, params] as const,
  from: (delegator: string, params?: Omit<DelegateQueryParams, "delegator">) =>
    [...delegateKeys.all, "from", delegator, params] as const,
  to: (toDelegate: string, params?: Omit<DelegateQueryParams, "toDelegate">) =>
    [...delegateKeys.all, "to", toDelegate, params] as const,
  details: () => [...delegateKeys.all, "detail"] as const,
  detail: (id: string) => [...delegateKeys.details(), id] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

type UseDelegatesOptions = Omit<
  UseQueryOptions<PaginatedResponse<Delegate>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch delegates with optional filters
 *
 * @param params - Query parameters (daoId, delegator, toDelegate, pagination, etc.)
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated delegates
 *
 * @example
 * ```tsx
 * function DelegateList() {
 *   const { data, isLoading } = useDelegates({ limit: 50 });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <ul>
 *       {data?.items.map(d => (
 *         <li key={d.id}>{d.delegator} → {d.toDelegate}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useDelegates(params: DelegateQueryParams = {}, options?: UseDelegatesOptions) {
  return useQuery({
    queryKey: delegateKeys.list(params),
    queryFn: () => getDelegates(params),
    ...options,
  });
}

type UseDelegateOptions = Omit<
  UseQueryOptions<Delegate | null, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch a single delegate record by its ID
 *
 * @param id - Delegate ID (format: chainId_tokenAddress_delegatorAddress)
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with delegate or null
 *
 * @example
 * ```tsx
 * function DelegateDetail({ delegateId }: { delegateId: string }) {
 *   const { data: delegate, isLoading } = useDelegate(delegateId);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!delegate) return <div>Delegate not found</div>;
 *
 *   return (
 *     <div>
 *       <p>Delegator: {delegate.delegator}</p>
 *       <p>Delegated to: {delegate.toDelegate}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDelegate(id: string, options?: UseDelegateOptions) {
  return useQuery({
    queryKey: delegateKeys.detail(id),
    queryFn: () => getDelegate(id),
    enabled: !!id,
    ...options,
  });
}

type UseDelegatesByDAOOptions = Omit<
  UseQueryOptions<PaginatedResponse<Delegate>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch all delegates for a specific DAO
 *
 * @param daoId - DAO ID (format: chainId_governorAddress)
 * @param params - Additional query parameters
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated delegates
 *
 * @example
 * ```tsx
 * function DAODelegates({ daoId }: { daoId: string }) {
 *   const { data } = useDelegatesByDAO(daoId, { limit: 100 });
 *
 *   return (
 *     <ul>
 *       {data?.items.map(d => (
 *         <li key={d.id}>{d.delegator} → {d.toDelegate}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useDelegatesByDAO(
  daoId: string,
  params: Omit<DelegateQueryParams, "daoId"> = {},
  options?: UseDelegatesByDAOOptions
) {
  return useQuery({
    queryKey: delegateKeys.byDAO(daoId, params),
    queryFn: () => getDelegatesByDAO(daoId, params),
    enabled: !!daoId,
    ...options,
  });
}

type UseDelegationsFromOptions = Omit<
  UseQueryOptions<PaginatedResponse<Delegate>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch all delegations FROM a specific address (who this address delegated to)
 *
 * @param delegator - Delegator address
 * @param params - Additional query parameters
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated delegations
 *
 * @example
 * ```tsx
 * function MyDelegations({ address }: { address: string }) {
 *   const { data } = useDelegationsFrom(address);
 *
 *   return (
 *     <div>
 *       <h3>My Delegations</h3>
 *       <ul>
 *         {data?.items.map(d => (
 *           <li key={d.id}>Delegated to {d.toDelegate}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDelegationsFrom(
  delegator: string,
  params: Omit<DelegateQueryParams, "delegator"> = {},
  options?: UseDelegationsFromOptions
) {
  return useQuery({
    queryKey: delegateKeys.from(delegator, params),
    queryFn: () => getDelegationsFrom(delegator, params),
    enabled: !!delegator,
    ...options,
  });
}

type UseDelegationsToOptions = Omit<
  UseQueryOptions<PaginatedResponse<Delegate>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch all delegations TO a specific address (who delegated to this address)
 *
 * @param toDelegate - Delegate address receiving delegations
 * @param params - Additional query parameters
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated delegations
 *
 * @example
 * ```tsx
 * function ReceivedDelegations({ address }: { address: string }) {
 *   const { data } = useDelegationsTo(address);
 *
 *   return (
 *     <div>
 *       <h3>Delegated to Me</h3>
 *       <ul>
 *         {data?.items.map(d => (
 *           <li key={d.id}>From {d.delegator}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDelegationsTo(
  toDelegate: string,
  params: Omit<DelegateQueryParams, "toDelegate"> = {},
  options?: UseDelegationsToOptions
) {
  return useQuery({
    queryKey: delegateKeys.to(toDelegate, params),
    queryFn: () => getDelegationsTo(toDelegate, params),
    enabled: !!toDelegate,
    ...options,
  });
}
