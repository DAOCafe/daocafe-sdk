import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { getVotes, getVote, getVotesByProposal, getVotesByVoter } from "../queries/votes";
import type { Vote, VoteQueryParams, PaginatedResponse } from "../types";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const voteKeys = {
  all: ["votes"] as const,
  lists: () => [...voteKeys.all, "list"] as const,
  list: (params: VoteQueryParams) => [...voteKeys.lists(), params] as const,
  byProposal: (proposalId: string, params?: Omit<VoteQueryParams, "proposalId">) =>
    [...voteKeys.all, "byProposal", proposalId, params] as const,
  byVoter: (voter: string, params?: Omit<VoteQueryParams, "voter">) =>
    [...voteKeys.all, "byVoter", voter, params] as const,
  details: () => [...voteKeys.all, "detail"] as const,
  detail: (id: string) => [...voteKeys.details(), id] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

type UseVotesOptions = Omit<
  UseQueryOptions<PaginatedResponse<Vote>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch votes with optional filters
 *
 * @param params - Query parameters (proposalId, voter, support, pagination, etc.)
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated votes
 *
 * @example
 * ```tsx
 * function VoteList() {
 *   const { data, isLoading } = useVotes({ limit: 50 });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <ul>
 *       {data?.items.map(vote => (
 *         <li key={vote.id}>{vote.voter}: {vote.support}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useVotes(params: VoteQueryParams = {}, options?: UseVotesOptions) {
  return useQuery({
    queryKey: voteKeys.list(params),
    queryFn: () => getVotes(params),
    ...options,
  });
}

type UseVoteOptions = Omit<UseQueryOptions<Vote | null, Error>, "queryKey" | "queryFn">;

/**
 * Fetch a single vote by its ID
 *
 * @param id - Vote ID (format: chainId_governor_proposalId_voter)
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with vote or null
 *
 * @example
 * ```tsx
 * function VoteDetail({ voteId }: { voteId: string }) {
 *   const { data: vote, isLoading } = useVote(voteId);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!vote) return <div>Vote not found</div>;
 *
 *   return (
 *     <div>
 *       <p>Voter: {vote.voter}</p>
 *       <p>Support: {vote.support}</p>
 *       <p>Weight: {vote.weight}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useVote(id: string, options?: UseVoteOptions) {
  return useQuery({
    queryKey: voteKeys.detail(id),
    queryFn: () => getVote(id),
    enabled: !!id,
    ...options,
  });
}

type UseVotesByProposalOptions = Omit<
  UseQueryOptions<PaginatedResponse<Vote>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch all votes for a specific proposal
 *
 * @param proposalId - Proposal ID (format: chainId_governor_proposalId)
 * @param params - Additional query parameters
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated votes
 *
 * @example
 * ```tsx
 * function ProposalVotes({ proposalId }: { proposalId: string }) {
 *   const { data } = useVotesByProposal(proposalId, { limit: 100 });
 *
 *   const forVotes = data?.items.filter(v => v.support === 'FOR') ?? [];
 *   const againstVotes = data?.items.filter(v => v.support === 'AGAINST') ?? [];
 *
 *   return (
 *     <div>
 *       <p>For: {forVotes.length}</p>
 *       <p>Against: {againstVotes.length}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useVotesByProposal(
  proposalId: string,
  params: Omit<VoteQueryParams, "proposalId"> = {},
  options?: UseVotesByProposalOptions
) {
  return useQuery({
    queryKey: voteKeys.byProposal(proposalId, params),
    queryFn: () => getVotesByProposal(proposalId, params),
    enabled: !!proposalId,
    ...options,
  });
}

type UseVotesByVoterOptions = Omit<
  UseQueryOptions<PaginatedResponse<Vote>, Error>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch all votes cast by a specific voter
 *
 * @param voter - Voter address
 * @param params - Additional query parameters
 * @param options - Additional TanStack Query options
 * @returns TanStack Query result with paginated votes
 *
 * @example
 * ```tsx
 * function VoterHistory({ address }: { address: string }) {
 *   const { data } = useVotesByVoter(address, { limit: 50 });
 *
 *   return (
 *     <div>
 *       <h3>Vote History</h3>
 *       <ul>
 *         {data?.items.map(vote => (
 *           <li key={vote.id}>
 *             Proposal {vote.proposalId}: {vote.support}
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useVotesByVoter(
  voter: string,
  params: Omit<VoteQueryParams, "voter"> = {},
  options?: UseVotesByVoterOptions
) {
  return useQuery({
    queryKey: voteKeys.byVoter(voter, params),
    queryFn: () => getVotesByVoter(voter, params),
    enabled: !!voter,
    ...options,
  });
}
