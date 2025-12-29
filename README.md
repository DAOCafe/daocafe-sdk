# daocafe-sdk

TypeScript SDK for [DAO.CAFE](https://dao.cafe) - The GraphQL indexer for the CreateDAO governance protocol.

## Features

- 🔍 **Type-safe queries** - Full TypeScript support with generated types
- ⚛️ **React hooks** - TanStack Query integration for seamless data fetching
- 🚀 **Tree-shakable** - Only bundle what you use
- 📦 **Zero config** - Pre-configured to work with the DAO.CAFE endpoint
- 🔄 **Real-time ready** - Built-in caching and refetching with TanStack Query

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
            For: {proposal.votesFor} | 
            Against: {proposal.votesAgainst} | 
            Abstain: {proposal.votesAbstain}
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

### Custom GraphQL Client

```ts
import { createClient, getDAOs } from 'daocafe-sdk';

// Create a custom client
const client = createClient('https://your-endpoint.com/graphql', {
  headers: {
    Authorization: 'Bearer your-token',
  },
});

// Use with query functions
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

- Base Mainnet (Chain ID: 8453)
- Sepolia Testnet (Chain ID: 11155111)

## License

MIT
