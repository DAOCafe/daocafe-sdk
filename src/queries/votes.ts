import { daoCafeClient, type DaoCafeClient } from "../client";
import type { Vote, VoteQueryParams, PaginatedResponse } from "../types";

/**
 * Fetch votes with optional filters
 *
 * @param params - Query parameters (proposalId, daoId, voter, support, pagination)
 * @param client - Optional custom client
 * @returns Paginated list of votes
 *
 * @example
 * ```ts
 * const { items } = await getVotes({ daoId: "1_0x...", support: "FOR" });
 * ```
 */
export async function getVotes(
  params: VoteQueryParams = {},
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<Vote>> {
  return client.request("votes", params);
}

/**
 * Fetch votes for a specific proposal
 *
 * @param proposalId - Proposal ID (format: chainId_governor_proposalId)
 * @param params - Additional query parameters
 * @param client - Optional custom client
 * @returns Paginated list of votes on the proposal
 *
 * @example
 * ```ts
 * const { items } = await getVotesByProposal("1_0x..._123", { orderBy: "weight" });
 * ```
 */
export async function getVotesByProposal(
  proposalId: string,
  params: Omit<VoteQueryParams, "proposalId"> = {},
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<Vote>> {
  return client.request("votes", { ...params, proposalId });
}

/**
 * Fetch all votes cast by an address
 *
 * @param voter - Voter address
 * @param params - Additional query parameters
 * @param client - Optional custom client
 * @returns Paginated list of votes by the voter
 *
 * @example
 * ```ts
 * const { items } = await getVotesByVoter("0x1234...");
 * ```
 */
export async function getVotesByVoter(
  voter: string,
  params: Omit<VoteQueryParams, "voter"> = {},
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<Vote>> {
  return client.request("votes", { ...params, voter });
}

/**
 * Fetch a single vote by its ID
 *
 * @param id - Vote ID (format: chainId_governor_proposalId_voter)
 * @param client - Optional custom client
 * @returns Vote or null if not found
 *
 * @example
 * ```ts
 * const vote = await getVote("1_0x..._123_0xvoter...");
 * ```
 */
export async function getVote(
  id: string,
  client: DaoCafeClient = daoCafeClient
): Promise<Vote | null> {
  return client.request("vote", { id });
}
