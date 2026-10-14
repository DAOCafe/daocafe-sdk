# daocafe-sdk

TypeScript SDK for [DAO.CAFE](https://dao.cafe) - governance data for the CreateDAO protocol, read directly from the chain via RPC. No indexer required.

## Features

- 🔍 **Type-safe queries** - Full TypeScript support
- ⚛️ **React hooks** - TanStack Query integration for seamless data fetching
- ⛓️ **No indexer** - A server handler you mount in your own app reads the CreateDAO contracts over RPC
- 💸 **Cheap** - Cached in memory (optionally on disk); at most one small incremental sync per chain every 15s, only while someone is browsing
- 🔄 **Fresh after transactions** - `refreshDaoCafe()` bypasses the cache once a vote or proposal is mined

## Installation

```bash
npm install daocafe-sdk
# or
yarn add daocafe-sdk
# or
pnpm add daocafe-sdk
```

### Peer Dependencies

For React hooks, you'll need:

```bash
npm install @tanstack/react-query react
```

The server handler needs `viem`:

```bash
npm install viem
```

## Setup: mount the server handler

The hooks and query functions call `/api/daocafe` on your own origin. Mount the
handler there; it reads the chain and caches the results.

```ts
// Next.js App Router: app/api/daocafe/route.ts
import { createDaoCafeHandler } from 'daocafe-sdk/server';

export const GET = createDaoCafeHandler({
  rpcUrls: {
    1: process.env.RPC_URL_ETHEREUM,
    42161: process.env.RPC_URL_ARBITRUM,
    11155111: process.env.RPC_URL_SEPOLIA,
  },
  cacheDir: process.env.DAOCAFE_CACHE_DIR, // optional: survive restarts
});
```

```ts
// Next.js Pages Router: pages/api/daocafe.ts (also works with Express / node:http)
import { createDaoCafeNodeHandler } from 'daocafe-sdk/server';

export default createDaoCafeNodeHandler({ rpcUrls: { 1: process.env.RPC_URL_ETHEREUM } });
```

| Option | Default | Description |
|--------|---------|-------------|
| `rpcUrls` | — | RPC URL (or list) per chain id. Empty entries are skipped. Public RPCs are appended as fallbacks. |
| `chains` | all known | Chain ids to serve (`1`, `42161`, `11155111`) |
| `minSyncIntervalMs` | `15000` | Minimum time between two syncs of a chain |
| `minFreshIntervalMs` | `5000` | Same, for requests sent after `refreshDaoCafe()` |
| `cacheDir` | memory only | Directory to persist synced events in, so restarts don't re-scan history |
| `fourByte` | `true` | Decode unknown proposal calldata via 4byte.directory |
| `publicFallback` | `true` | Append public RPCs after `rpcUrls` |
| `deployments` | built in | Add or override factory address / start block per chain |

Use `createDaoCafeServer(config).query(op, params)` to read data in server
components or scripts without HTTP.

### How it works

- **DAOs, proposals, votes, delegations, holders** are rebuilt from `eth_getLogs`
  on the factory and every governor and token it created. The first sync scans from the
  factory deployment block (about one request per chain with a provider such as dRPC);
  later syncs only fetch new blocks.
- **The last ~minute of blocks is re-read on every sync**, because providers can return an
  empty `eth_getLogs` for a block whose logs are not indexed yet.
- **Proposal state** comes from events plus the block time. When a vote has ended, `state()`
  is read once to decide succeeded vs defeated, and the answer is cached.
- **Settings** (voting delay/period, threshold, quorum, manager, timelock delay) are
  read via multicall when a DAO appears and again after relevant governor events.
- If a provider rejects a block range, the range is split automatically.

## Quick Start

### Using React Hooks

```tsx
import { useDAOs, useProposals } from 'daocafe-sdk';

function DAOList() {
  const { data, isLoading } = useDAOs({ limit: 10 });

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {data?.items.map(dao => (
        <li key={dao.id}>
          {dao.name} - {dao.proposalCount} proposals
        </li>
      ))}
    </ul>
  );
}
```

### Using Query Functions (No React)

```ts
import { getDAOs, getProposals } from 'daocafe-sdk';

// Fetch all DAOs
const { items: daos } = await getDAOs({ limit: 10 });

// Fetch active proposals
const { items: proposals } = await getProposals({ state: 'ACTIVE' });
```

## API Reference

### Hooks

#### DAOs

| Hook | Description |
|------|-------------|
| `useDAOs(params?)` | Fetch all DAOs with pagination |
| `useDAO(id)` | Fetch a single DAO by ID |
| `useDAOsByManager({ manager })` | Fetch DAOs by manager address |

#### Proposals

| Hook | Description |
|------|-------------|
| `useProposals(params?)` | Fetch proposals with filters |
| `useProposal(id)` | Fetch a single proposal by ID |
| `useProposalsByDAO(daoId, params?)` | Fetch proposals for a specific DAO |
| `useActiveProposals(params?)` | Fetch all active proposals |

#### Votes

| Hook | Description |
|------|-------------|
| `useVotes(params?)` | Fetch votes with filters |
| `useVote(id)` | Fetch a single vote by ID |
| `useVotesByProposal(proposalId, params?)` | Fetch votes for a proposal |
| `useVotesByVoter(voter, params?)` | Fetch votes by a voter |

#### Delegates

| Hook | Description |
|------|-------------|
| `useDelegates(params?)` | Fetch delegates with filters |
| `useDelegate(id)` | Fetch a single delegate record |
| `useDelegatesByDAO(daoId, params?)` | Fetch delegates for a DAO |
| `useDelegationsFrom(delegator, params?)` | Fetch delegations from an address |
| `useDelegationsTo(toDelegate, params?)` | Fetch delegations to an address |

#### Token Holders

| Hook | Description |
|------|-------------|
| `useTokenHolders(params?)` | Fetch token holders with filters |
| `useTokenHolder(id)` | Fetch a single token holder |
| `useTokenHoldersByDAO(daoId, params?)` | Fetch token holders for a DAO |
| `useTokenHoldingsByAddress(holder, params?)` | Fetch holdings by address |

### Query Functions

All hooks have corresponding async query functions:

```ts
import {
  getDAOs,
  getDAO,
  getProposals,
  getVotes,
  getDelegates,
  getTokenHolders,
  // ... and more
} from 'daocafe-sdk';
```

### Types

```ts
import type {
  DAO,
  Proposal,
  Vote,
  Delegate,
  TokenHolder,
  ProposalState,
  VoteSupport,
  PaginatedResponse,
} from 'daocafe-sdk';
```

## Examples

### Fetch DAO with Proposals

```tsx
import { useDAO, useProposalsByDAO } from 'daocafe-sdk';

function DAOPage({ daoId }: { daoId: string }) {
  const { data: dao } = useDAO(daoId);
  const { data: proposals } = useProposalsByDAO(daoId, { limit: 20 });

  return (
    <div>
      <h1>{dao?.name}</h1>
      <p>Total Supply: {dao?.totalSupply}</p>
      
      <h2>Proposals</h2>
      <ul>
        {proposals?.items.map(p => (
          <li key={p.id}>
            {p.description.slice(0, 100)}...
            <span>State: {p.state}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Filter Active Proposals

```tsx
import { useActiveProposals } from 'daocafe-sdk';

function ActiveProposals() {
  const { data, isLoading } = useActiveProposals({ limit: 10 });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Active Proposals ({data?.items.length})</h2>
      {data?.items.map(proposal => (
        <div key={proposal.id}>
          <p>{proposal.description}</p>
          <p>
            For: {proposal.forVotes} | 
            Against: {proposal.againstVotes} | 
            Abstain: {proposal.abstainVotes}
          </p>
        </div>
      ))}
    </div>
  );
}
```

### Get User's Voting Power

```tsx
import { useTokenHoldingsByAddress } from 'daocafe-sdk';

function VotingPower({ address }: { address: string }) {
  const { data } = useTokenHoldingsByAddress(address);

  return (
    <div>
      <h3>Your Voting Power</h3>
      {data?.items.map(holding => (
        <div key={holding.id}>
          <p>DAO: {holding.daoId}</p>
          <p>Balance: {holding.balance}</p>
          <p>Votes: {holding.votes}</p>
        </div>
      ))}
    </div>
  );
}
```

### Refresh After a Transaction

```tsx
import { useQueryClient } from '@tanstack/react-query';
import { refreshDaoCafe } from 'daocafe-sdk';

const queryClient = useQueryClient();
// after waitForTransactionReceipt(...) resolves:
await refreshDaoCafe(queryClient); // refetch all SDK queries, bypassing the server cache
```

Call `markFresh()` instead if you invalidate queries yourself.

### Custom Endpoint

```ts
import { createClient, getDAOs, setDefaultEndpoint } from 'daocafe-sdk';

// Point all hooks at another handler URL
setDefaultEndpoint('https://createdao.org/api/daocafe');

// Or use a dedicated client with query functions (e.g. for server-side fetches)
const client = createClient('https://createdao.org/api/daocafe');
const daos = await getDAOs({ limit: 10 }, client);
```

## Query Keys

Each hook exports query keys for cache invalidation:

```ts
import { useQueryClient } from '@tanstack/react-query';
import { daoKeys, proposalKeys } from 'daocafe-sdk';

function InvalidateExample() {
  const queryClient = useQueryClient();

  const invalidateAllDAOs = () => {
    queryClient.invalidateQueries({ queryKey: daoKeys.all });
  };

  const invalidateProposalsForDAO = (daoId: string) => {
    queryClient.invalidateQueries({ 
      queryKey: proposalKeys.byDAO(daoId) 
    });
  };
}
```

## ID Formats

| Entity | ID Format |
|--------|-----------|
| DAO | `chainId_governorAddress` |
| Proposal | `chainId_governor_proposalId` |
| Vote | `chainId_governor_proposalId_voter` |
| Delegate | `chainId_tokenAddress_delegatorAddress` |
| TokenHolder | `chainId_tokenAddress_holderAddress` |

## Supported Networks

- Ethereum Mainnet (Chain ID: 1)
- Arbitrum (Chain ID: 42161)
- Sepolia Testnet (Chain ID: 11155111)

## License

MIT
