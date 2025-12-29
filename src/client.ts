import { GraphQLClient } from "graphql-request";

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_ENDPOINT = "https://dao.cafe/graphql";

// ============================================================================
// CLIENT
// ============================================================================

/**
 * Default GraphQL client instance pointing to DAO.CAFE endpoint
 */
export const daoCafeClient = new GraphQLClient(DEFAULT_ENDPOINT);

/**
 * Create a custom GraphQL client with different endpoint or options
 *
 * @param endpoint - GraphQL endpoint URL (defaults to https://dao.cafe/graphql)
 * @param options - Additional GraphQL client options (headers, etc.)
 * @returns Configured GraphQLClient instance
 *
 * @example
 * ```ts
 * // Use default endpoint
 * const client = createClient();
 *
 * // Use custom endpoint
 * const client = createClient("https://my-indexer.com/graphql");
 *
 * // With custom headers
 * const client = createClient(undefined, {
 *   headers: { Authorization: "Bearer token" }
 * });
 * ```
 */
export function createClient(
  endpoint: string = DEFAULT_ENDPOINT,
  options?: ConstructorParameters<typeof GraphQLClient>[1]
): GraphQLClient {
  return new GraphQLClient(endpoint, options);
}

/**
 * Set request headers on the default client
 *
 * @param headers - Headers to set on all requests
 */
export function setClientHeaders(headers: Record<string, string>): void {
  daoCafeClient.setHeaders(headers);
}

// Re-export GraphQLClient for advanced usage
export { GraphQLClient };
