// Cross-checks data derived by daocafe-sdk/server against direct contract
// reads: every proposal's tallies (proposalVotes) and every token holder's
// balanceOf / getVotes. Run after `npm run build`:
//
//   DRPC_API_KEY=... node scripts/verify-onchain.mjs
//
// Without DRPC_API_KEY it uses public RPCs (slow cold sync on Arbitrum).
import { createPublicClient, http, parseAbi } from "viem";
import { createDaoCafeServer, PUBLIC_RPC_URLS } from "../dist/server.js";

const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const key = process.env.DRPC_API_KEY;
const networks = { 1: "ethereum", 42161: "arbitrum", 11155111: "sepolia" };
const rpcUrls = Object.fromEntries(
  Object.entries(networks).map(([id, net]) => [id, key ? `https://lb.drpc.live/${net}/${key}` : undefined]),
);

const server = createDaoCafeServer({ rpcUrls, warmup: false });
const started = Date.now();
const [daos, proposals, holders, votes, delegates] = await Promise.all(
  ["daos", "proposals", "tokenHolders", "votes", "delegates"].map(
    async (op) => (await server.query(op, { limit: 1000 })).items,
  ),
);
console.log(
  `synced in ${Date.now() - started}ms: ${daos.length} DAOs, ${proposals.length} proposals, ` +
    `${votes.length} votes, ${holders.length} holders, ${delegates.length} delegations`,
);

const abi = parseAbi([
  "function proposalVotes(uint256) view returns (uint256 against, uint256 forVotes, uint256 abstain)",
  "function balanceOf(address) view returns (uint256)",
  "function getVotes(address) view returns (uint256)",
]);

let mismatches = 0;
for (const chainId of Object.keys(networks).map(Number)) {
  const client = createPublicClient({ transport: http(rpcUrls[chainId] ?? PUBLIC_RPC_URLS[chainId][0]) });
  const read = (contracts) => client.multicall({ multicallAddress: MULTICALL3, allowFailure: false, contracts });

  const ps = proposals.filter((p) => p.chainId === chainId);
  const tallies = await read(
    ps.map((p) => ({ address: p.governor, abi, functionName: "proposalVotes", args: [BigInt(p.proposalId)] })),
  );
  ps.forEach((p, i) => {
    const [against, forVotes, abstain] = tallies[i];
    if (`${against}` !== p.againstVotes || `${forVotes}` !== p.forVotes || `${abstain}` !== p.abstainVotes) {
      mismatches++;
      console.log("tally mismatch", p.id);
    }
  });

  const hs = holders.filter((h) => h.chainId === chainId);
  const reads = await read(
    hs.flatMap((h) => [
      { address: h.token, abi, functionName: "balanceOf", args: [h.holder] },
      { address: h.token, abi, functionName: "getVotes", args: [h.holder] },
    ]),
  );
  hs.forEach((h, i) => {
    if (`${reads[2 * i]}` !== h.balance || `${reads[2 * i + 1]}` !== h.votes) {
      mismatches++;
      console.log("holder mismatch", h.id, { balance: h.balance, onchain: `${reads[2 * i]}` });
    }
  });
  console.log(`chain ${chainId}: checked ${ps.length} proposals, ${hs.length} holders`);
}

console.log(mismatches === 0 ? "OK: all data matches on-chain state" : `FAILED: ${mismatches} mismatches`);
process.exit(mismatches === 0 ? 0 : 1);
