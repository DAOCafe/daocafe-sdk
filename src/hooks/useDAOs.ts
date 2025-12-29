import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { getDAOs, getDAO, getDAOsByManager } from "../queries/dao";
import type { DAO, DAOQueryParams, DAOsByManagerParams, PaginatedResponse } from "../types";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const daoKeys = {
  all: ["daos"] as const,
  lists: () => [...daoKeys.all, "list"] as const,
  list: (params: DAOQueryParams) => [...daoKeys.lists(), params] as const,
  byManager: (params: DAOsByManagerParams) => [...daoKeys.all, "byManager", params] as const,
  details: () => [...daoKeys.all, "detail"] as const,
  detail: (id: string) => [...daoKeys.details(), id] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

type UseDAOsOptions = Omit<
  UseQueryOptions<PaginatedResponse<DAO>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch all DAOs with optional pagination and ordering
 *
 * @param params - Query parameters (limit, after, orderBy, etc.)
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated DAOs
 *
 * @example
 * ```tsx
 * function DAOList() {
 *   const { data, isLoading } = useDAOs({ limit: 10 });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <ul>
 *       {data?.items.map(dao => (
 *         <li key={dao.id}>{dao.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useDAOs(params: DAOQueryParams = {}, options?: UseDAOsOptions) {
  return useQuery({
    queryKey: daoKeys.list(params),
    queryFn: () => getDAOs(params),
    ...options,
  });
}

type UseDAOOptions = Omit<UseQueryOptions<DAO | null, Error>, "queryKey" | "queryFn">;

/**
 * Fetch a single DAO by its ID
 *
 * @param id - DAO ID (format: chainId_governorAddress)
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with DAO or null
 *
 * @example
 * ```tsx
 * function DAODetail({ daoId }: { daoId: string }) {
 *   const { data: dao, isLoading } = useDAO(daoId);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!dao) return <div>DAO not found</div>;
 *
 *   return <div>{dao.name}</div>;
 * }
 * ```
 */
export function useDAO(id: string, options?: UseDAOOptions) {
  return useQuery({
    queryKey: daoKeys.detail(id),
    queryFn: () => getDAO(id),
    enabled: !!id,
    ...options,
  });
}

type UseDAOsByManagerOptions = Omit<
  UseQueryOptions<PaginatedResponse<DAO>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch DAOs by manager address
 *
 * @param params - Query parameters including manager address
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated DAOs
 *
 * @example
 * ```tsx
 * function ManagedDAOs({ manager }: { manager: string }) {
 *   const { data } = useDAOsByManager({ manager });
 *
 *   return (
 *     <ul>
 *       {data?.items.map(dao => (
 *         <li key={dao.id}>{dao.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useDAOsByManager(
  params: DAOsByManagerParams,
  options?: UseDAOsByManagerOptions
) {
  return useQuery({
    queryKey: daoKeys.byManager(params),
    queryFn: () => getDAOsByManager(params),
    enabled: !!params.manager,
    ...options,
  });
}
