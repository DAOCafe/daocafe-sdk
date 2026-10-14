/**
 * Known CreateDAO v2 factory deployments per chain.
 */

export interface DaoCafeDeployment {
  /** DAOFactory address */
  factory: string;
  /** First block to scan for events (factory deployment block) */
  startBlock: bigint;
  /**
   * Blocks near the head that are re-fetched on every sync. Some providers
   * report a block as available before its logs are queryable and return an
   * empty eth_getLogs result for it; re-reading the recent window heals that.
   */
  confirmations: bigint;
}

/** CreateDAO v2 factory (CREATE2 deployed, same address on every chain) */
export const FACTORY_ADDRESS = "0xc852e5cb44c50614a82050163ab7170cb88eb5f9";

export const DAOCAFE_DEPLOYMENTS: Record<number, DaoCafeDeployment> = {
  // Ethereum mainnet (~12s blocks: ~1 minute window)
  1: { factory: FACTORY_ADDRESS, startBlock: 24424853n, confirmations: 6n },
  // Arbitrum One (~0.25s blocks: ~1 minute window)
  42161: { factory: FACTORY_ADDRESS, startBlock: 463412091n, confirmations: 240n },
  // Sepolia (~12s blocks: ~1 minute window)
  11155111: { factory: FACTORY_ADDRESS, startBlock: 10224506n, confirmations: 6n },
};

/** Public RPCs used after the configured ones fail */
export const PUBLIC_RPC_URLS: Record<number, string[]> = {
  1: ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com"],
  42161: ["https://arb1.arbitrum.io/rpc", "https://arbitrum.drpc.org"],
  11155111: ["https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.gateway.tenderly.co"],
};
