import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  getProposals,
  getProposal,
  getProposalsByDAO,
  getActiveProposals,
} from "../queries/proposals";
import type { Proposal, ProposalQueryParams, PaginatedResponse } from "../types";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const proposalKeys = {
  all: ["proposals"] as const,
  lists: () => [...proposalKeys.all, "list"] as const,
  list: (params: ProposalQueryParams) => [...proposalKeys.lists(), params] as const,
  byDAO: (daoId: string, params?: Omit<ProposalQueryParams, "daoId">) =>
    [...proposalKeys.all, "byDAO", daoId, params] as const,
  active: (params?: Omit<ProposalQueryParams, "state">) =>
    [...proposalKeys.all, "active", params] as const,
  details: () => [...proposalKeys.all, "detail"] as const,
  detail: (id: string) => [...proposalKeys.details(), id] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

type UseProposalsOptions = Omit<
  UseQueryOptions<PaginatedResponse<Proposal>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch proposals with optional filters
 *
 * @param params - Query parameters (daoId, state, proposer, pagination, etc.)
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated proposals
 *
 * @example
 * ```tsx
 * function ProposalList() {
 *   const { data, isLoading } = useProposals({ limit: 20 });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <ul>
 *       {data?.items.map(proposal => (
 *         <li key={proposal.id}>{proposal.description.slice(0, 50)}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useProposals(params: ProposalQueryParams = {}, options?: UseProposalsOptions) {
  return useQuery({
    queryKey: proposalKeys.list(params),
    queryFn: () => getProposals(params),
    ...options,
  });
}

type UseProposalOptions = Omit<
  UseQueryOptions<Proposal | null, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch a single proposal by its ID
 *
 * @param id - Proposal ID (format: chainId_governor_proposalId)
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with proposal or null
 *
 * @example
 * ```tsx
 * function ProposalDetail({ proposalId }: { proposalId: string }) {
 *   const { data: proposal, isLoading } = useProposal(proposalId);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!proposal) return <div>Proposal not found</div>;
 *
 *   return (
 *     <div>
 *       <h1>{proposal.description}</h1>
 *       <p>State: {proposal.state}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useProposal(id: string, options?: UseProposalOptions) {
  return useQuery({
    queryKey: proposalKeys.detail(id),
    queryFn: () => getProposal(id),
    enabled: !!id,
    ...options,
  });
}

type UseProposalsByDAOOptions = Omit<
  UseQueryOptions<PaginatedResponse<Proposal>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch proposals for a specific DAO
 *
 * @param daoId - DAO ID (format: chainId_governorAddress)
 * @param params - Additional query parameters
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated proposals
 *
 * @example
 * ```tsx
 * function DAOProposals({ daoId }: { daoId: string }) {
 *   const { data } = useProposalsByDAO(daoId, { limit: 10 });
 *
 *   return (
 *     <ul>
 *       {data?.items.map(proposal => (
 *         <li key={proposal.id}>{proposal.description}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useProposalsByDAO(
  daoId: string,
  params: Omit<ProposalQueryParams, "daoId"> = {},
  options?: UseProposalsByDAOOptions
) {
  return useQuery({
    queryKey: proposalKeys.byDAO(daoId, params),
    queryFn: () => getProposalsByDAO(daoId, params),
    enabled: !!daoId,
    ...options,
  });
}

type UseActiveProposalsOptions = Omit<
  UseQueryOptions<PaginatedResponse<Proposal>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch all currently active proposals across all DAOs
 *
 * @param params - Pagination parameters
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated active proposals
 *
 * @example
 * ```tsx
 * function ActiveProposals() {
 *   const { data, isLoading } = useActiveProposals({ limit: 10 });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h2>Active Proposals ({data?.items.length})</h2>
 *       <ul>
 *         {data?.items.map(p => (
 *           <li key={p.id}>{p.description}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useActiveProposals(
  params: Omit<ProposalQueryParams, "state"> = {},
  options?: UseActiveProposalsOptions
) {
  return useQuery({
    queryKey: proposalKeys.active(params),
    queryFn: () => getActiveProposals(params),
    ...options,
  });
}
