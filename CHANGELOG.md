# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-08

### Breaking Changes

- **Renamed Proposal vote fields** to match OpenZeppelin Governor convention:
  - `votesFor` → `forVotes`
  - `votesAgainst` → `againstVotes`
  - `votesAbstain` → `abstainVotes`

### Added

- **New Type Export**: `ProposalVote` - Type alias for `Vote` entity (for convenience)
- **VoteQueryParams**: Added `"timestamp"` as valid `orderBy` option (alias for `"createdAt"`)

### Migration Guide

If you're upgrading from 0.1.x, update your code to use the new field names:

```typescript
// Before (0.1.x)
proposal.votesFor
proposal.votesAgainst
proposal.votesAbstain

// After (0.2.0)
proposal.forVotes
proposal.againstVotes
proposal.abstainVotes
```

## [0.1.0] - 2024-12-29

### Added

- Initial release of the daocafe-sdk
- **Core Client**
  - `daoCafeClient` - Pre-configured GraphQL client for dao.cafe endpoint
  - `createClient()` - Factory function for custom endpoints
  - `setClientHeaders()` - Utility for setting request headers

- **Query Functions** (async/await)
  - DAO queries: `getDAOs`, `getDAO`, `getDAOsByManager`
  - Proposal queries: `getProposals`, `getProposal`, `getProposalsByDAO`, `getActiveProposals`
  - Vote queries: `getVotes`, `getVote`, `getVotesByProposal`, `getVotesByVoter`
  - Delegate queries: `getDelegates`, `getDelegate`, `getDelegatesByDAO`, `getDelegationsFrom`, `getDelegationsTo`
  - Token holder queries: `getTokenHolders`, `getTokenHolder`, `getTokenHoldersByDAO`, `getTokenHoldingsByAddress`

- **React Hooks** (TanStack Query integration)
  - DAO hooks: `useDAOs`, `useDAO`, `useDAOsByManager`
  - Proposal hooks: `useProposals`, `useProposal`, `useProposalsByDAO`, `useActiveProposals`
  - Vote hooks: `useVotes`, `useVote`, `useVotesByProposal`, `useVotesByVoter`
  - Delegate hooks: `useDelegates`, `useDelegate`, `useDelegatesByDAO`, `useDelegationsFrom`, `useDelegationsTo`
  - Token holder hooks: `useTokenHolders`, `useTokenHolder`, `useTokenHoldersByDAO`, `useTokenHoldingsByAddress`

- **Query Keys** for cache invalidation
  - `daoKeys`, `proposalKeys`, `voteKeys`, `delegateKeys`, `tokenHolderKeys`

- **TypeScript Types**
  - Entity types: `DAO`, `Proposal`, `Vote`, `Delegate`, `TokenHolder`, `GovernanceSettingsChange`
  - Enum types: `ProposalState`, `VoteSupport`, `SettingType`
  - Query parameter types with full type safety

- **Features**
  - Full TypeScript support with generated types
  - Tree-shakable exports (only bundle what you use)
  - Optional peer dependencies (React, TanStack Query)
  - Dual ESM/CJS build output
  - Comprehensive JSDoc documentation

### Supported Networks

- Base Mainnet (Chain ID: 8453)
- Sepolia Testnet (Chain ID: 11155111)
