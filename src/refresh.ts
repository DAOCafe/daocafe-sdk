import type { QueryClient } from "@tanstack/react-query";
import { markFresh } from "./client";

/** Root query keys of every SDK hook */
const SDK_QUERY_ROOTS = ["daos", "proposals", "votes", "delegates", "tokenHolders"] as const;

/**
 * Refetch all DAO.CAFE data, bypassing the server cache.
 *
 * Call after a governance transaction is mined (propose, vote, queue, execute,
 * delegate) so the UI shows it immediately instead of after the next sync.
 *
 * @example
 * ```ts
 * const queryClient = useQueryClient();
 * await waitForTransactionReceipt(config, { hash });
 * await refreshDaoCafe(queryClient);
 * ```
 */
export async function refreshDaoCafe(queryClient: QueryClient): Promise<void> {
  markFresh();
  await Promise.all(
    SDK_QUERY_ROOTS.map((root) => queryClient.invalidateQueries({ queryKey: [root] }))
  );
}
