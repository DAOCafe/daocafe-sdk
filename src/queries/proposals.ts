import { daoCafeClient, type DaoCafeClient } from "../client";
import type {
  Proposal,
  ProposalQueryParams,
  PaginatedResponse,
} from "../types";

/**
 * Fetch proposals with optional filters
 *
 * @param params - Query parameters (daoId, state, proposer, pagination, etc.)
 * @param client - Optional custom client
 * @returns Paginated list of proposals
 *
 * @example
 * ```ts
 * // Get all proposals
 * const { items } = await getProposals({ limit: 20 });
 *
 * // Get active proposals for a specific DAO
 * const { items } = await getProposals({ daoId: "1_0x...", state: "ACTIVE" });
 * ```
 */
export async function getProposals(
  params: ProposalQueryParams = {},
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<Proposal>> {
  return client.request("proposals", params);
}

/**
 * Fetch proposals for a specific DAO
 *
 * @param daoId - DAO ID (format: chainId_governorAddress)
 * @param params - Additional query parameters
 * @param client - Optional custom client
 * @returns Paginated list of proposals for the DAO
 *
 * @example
 * ```ts
 * const { items } = await getProposalsByDAO("1_0x1234...", { limit: 10 });
 * ```
 */
export async function getProposalsByDAO(
  daoId: string,
  params: Omit<ProposalQueryParams, "daoId"> = {},
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<Proposal>> {
  return client.request("proposals", { ...params, daoId });
}

/**
 * Fetch a single proposal by its ID
 *
 * @param id - Proposal ID (format: chainId_governor_proposalId)
 * @param client - Optional custom client
 * @returns Proposal or null if not found
 *
 * @example
 * ```ts
 * const proposal = await getProposal("1_0x1234..._12345");
 * ```
 */
export async function getProposal(
  id: string,
  client: DaoCafeClient = daoCafeClient
): Promise<Proposal | null> {
  return client.request("proposal", { id });
}

/**
 * Fetch all currently active proposals across all DAOs
 *
 * @param params - Pagination parameters
 * @param client - Optional custom client
 * @returns Paginated list of active proposals
 *
 * @example
 * ```ts
 * const { items } = await getActiveProposals({ limit: 10 });
 * ```
 */
export async function getActiveProposals(
  params: Omit<ProposalQueryParams, "state"> = {},
  client: DaoCafeClient = daoCafeClient
): Promise<PaginatedResponse<Proposal>> {
  return client.request("proposals", { ...params, state: "ACTIVE" });
}
