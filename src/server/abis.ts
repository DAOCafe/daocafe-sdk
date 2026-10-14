import { parseAbi } from "viem";

export const factoryEventsAbi = parseAbi([
  "event DAOCreated(address indexed creator, address indexed token, address indexed governor, address timelock, string daoName, string tokenName, string tokenSymbol, uint256 totalSupply)",
]);

export const governorEventsAbi = parseAbi([
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)",
  "event ProposalQueued(uint256 proposalId, uint256 etaSeconds)",
  "event ProposalExecuted(uint256 proposalId)",
  "event ProposalCanceled(uint256 proposalId)",
  "event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)",
  "event VoteCastWithParams(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason, bytes params)",
  "event VotingDelaySet(uint256 oldVotingDelay, uint256 newVotingDelay)",
  "event VotingPeriodSet(uint256 oldVotingPeriod, uint256 newVotingPeriod)",
  "event ProposalThresholdSet(uint256 oldProposalThreshold, uint256 newProposalThreshold)",
  "event QuorumNumeratorUpdated(uint256 oldQuorumNumerator, uint256 newQuorumNumerator)",
  "event ManagerChanged(address indexed previousManager, address indexed newManager)",
  "event TimelockChange(address oldTimelock, address newTimelock)",
]);

export const tokenEventsAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate)",
  "event DelegateVotesChanged(address indexed delegate, uint256 previousVotes, uint256 newVotes)",
]);

export const governorReadAbi = parseAbi([
  "function votingDelay() view returns (uint256)",
  "function votingPeriod() view returns (uint256)",
  "function proposalThreshold() view returns (uint256)",
  "function quorumNumerator() view returns (uint256)",
  "function manager() view returns (address)",
  "function state(uint256 proposalId) view returns (uint8)",
]);

export const timelockReadAbi = parseAbi(["function getMinDelay() view returns (uint256)"]);
