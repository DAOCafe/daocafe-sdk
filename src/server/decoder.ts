/**
 * Proposal calldata decoder.
 *
 * Decodes calls CreateDAO proposals commonly make (treasury transfers,
 * governance settings, timelock admin) from local ABIs with real argument
 * names, and falls back to 4byte.directory for anything else. Lookups are
 * cached in memory, so a selector is fetched at most once per process.
 */

import {
  decodeAbiParameters,
  decodeFunctionData,
  parseAbi,
  parseAbiParameters,
  toFunctionSelector,
  type AbiFunction,
  type Hex,
} from "viem";
import type { DecodedAction, DecodedArg, DecodedData } from "../types";

const FOUR_BYTES_API = "https://www.4byte.directory/api/v1/signatures/";
const FOUR_BYTES_TIMEOUT_MS = 4_000;
/** Retry a selector 4byte did not know after this long */
const NOT_FOUND_TTL_MS = 60 * 60_000;
/** Retry a selector after a network/API failure after this long */
const ERROR_TTL_MS = 60_000;

const KNOWN_FUNCTIONS = parseAbi([
  // ERC20 (DAO token and other treasury assets)
  "function transfer(address to, uint256 amount)",
  "function approve(address spender, uint256 amount)",
  "function transferFrom(address from, address to, uint256 amount)",
  "function delegate(address delegatee)",
  // DAOGovernor settings
  "function setVotingDelay(uint48 newVotingDelay)",
  "function setVotingPeriod(uint32 newVotingPeriod)",
  "function setProposalThreshold(uint256 newProposalThreshold)",
  "function updateQuorumNumerator(uint256 newQuorumNumerator)",
  "function setManager(address newManager)",
  "function updateTimelock(address newTimelock)",
  "function relay(address target, uint256 value, bytes data)",
  // TimelockController admin
  "function updateDelay(uint256 newDelay)",
  "function grantRole(bytes32 role, address account)",
  "function revokeRole(bytes32 role, address account)",
  // ERC721 / ERC1155 transfers out of the treasury
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
]);

const knownBySelector = new Map<string, AbiFunction>(
  KNOWN_FUNCTIONS.map((fn) => [toFunctionSelector(fn).toLowerCase(), fn]),
);

const signatureCache = new Map<string, { signature: string | null; expiresAt: number }>();
const inflightLookups = new Map<string, Promise<string | null>>();

export interface DecoderOptions {
  /** Look up unknown selectors on 4byte.directory (default true) */
  fourByte: boolean;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return JSON.stringify(value.map(stringifyValue));
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  }
  return String(value);
}

function createSummary(functionName: string, args: DecodedArg[]): string {
  const formatted = args.map((arg) =>
    arg.value.length > 20 ? `${arg.value.slice(0, 10)}...${arg.value.slice(-6)}` : arg.value,
  );
  return `${functionName}(${formatted.join(", ")})`;
}

/** Split "a,(b,c),d" into top-level types */
function splitParamTypes(params: string): string[] {
  const types: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of params) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      if (current.trim()) types.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) types.push(current.trim());
  return types;
}

async function lookupSignature(selector: string): Promise<string | null> {
  const cached = signatureCache.get(selector);
  if (cached && cached.expiresAt > Date.now()) return cached.signature;

  let lookup = inflightLookups.get(selector);
  if (!lookup) {
    lookup = (async () => {
      try {
        const response = await fetch(`${FOUR_BYTES_API}?hex_signature=${selector}`, {
          signal: AbortSignal.timeout(FOUR_BYTES_TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`4byte responded ${response.status}`);
        const data = (await response.json()) as { results?: { id: number; text_signature: string }[] };
        // The oldest registration is usually the canonical signature
        const oldest = [...(data.results ?? [])].sort((a, b) => a.id - b.id)[0];
        const signature = oldest?.text_signature ?? null;
        signatureCache.set(selector, {
          signature,
          expiresAt: signature ? Number.POSITIVE_INFINITY : Date.now() + NOT_FOUND_TTL_MS,
        });
        return signature;
      } catch {
        signatureCache.set(selector, { signature: null, expiresAt: Date.now() + ERROR_TTL_MS });
        return null;
      } finally {
        inflightLookups.delete(selector);
      }
    })();
    inflightLookups.set(selector, lookup);
  }
  return lookup;
}

function decodeKnown(fn: AbiFunction, calldata: Hex): DecodedData {
  const { args } = decodeFunctionData({ abi: [fn], data: calldata });
  const decodedArgs: DecodedArg[] = fn.inputs.map((input, i) => ({
    name: input.name || `arg${i}`,
    type: input.type,
    value: stringifyValue((args as readonly unknown[] | undefined)?.[i]),
  }));
  const signature = `${fn.name}(${fn.inputs.map((input) => input.type).join(",")})`;
  return {
    status: "success",
    functionName: fn.name,
    signature,
    args: decodedArgs,
    summary: createSummary(fn.name, decodedArgs),
  };
}

function decodeWithSignature(signature: string, calldata: string): DecodedData {
  const functionName = signature.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(/)?.[1] ?? signature;
  const params = signature.slice(signature.indexOf("(") + 1, signature.lastIndexOf(")"));
  const types = splitParamTypes(params);
  let args: DecodedArg[] = [];
  if (types.length > 0) {
    const values = decodeAbiParameters(parseAbiParameters(types.join(", ")), `0x${calldata.slice(10)}` as Hex);
    args = values.map((value, i) => ({ name: `arg${i}`, type: types[i] ?? "unknown", value: stringifyValue(value) }));
  }
  return { status: "success", functionName, signature, args, summary: createSummary(functionName, args) };
}

async function decodeAction(
  index: number,
  target: string,
  value: string,
  calldata: string,
  options: DecoderOptions,
): Promise<DecodedAction> {
  const base = { index, target, value, calldata };

  // Empty calldata is a plain ETH transfer
  if (!calldata || calldata === "0x" || calldata.length < 10) {
    return {
      ...base,
      decoded: { status: "success", functionName: "transfer", signature: "transfer()", args: [], summary: "ETH Transfer" },
    };
  }

  const selector = calldata.slice(0, 10).toLowerCase();
  const known = knownBySelector.get(selector);
  if (known) {
    try {
      return { ...base, decoded: decodeKnown(known, calldata as Hex) };
    } catch {
      // Same selector, different layout - fall through to 4byte
    }
  }

  const signature = options.fourByte ? await lookupSignature(selector) : null;
  if (!signature) {
    return {
      ...base,
      decoded: {
        status: "error",
        error: "Function selector not found in 4bytes directory",
        selector,
        hint: "Submit the contract ABI at https://www.4byte.directory/api/v1/import-solidity/ to enable decoding",
      },
    };
  }

  try {
    return { ...base, decoded: decodeWithSignature(signature, calldata) };
  } catch (error) {
    return {
      ...base,
      decoded: {
        status: "error",
        error: `Failed to decode calldata: ${error instanceof Error ? error.message : "Unknown error"}`,
        selector,
        hint: "The function signature was found but decoding failed. The calldata may be malformed.",
      },
    };
  }
}

export async function decodeProposalActions(
  targets: readonly string[],
  values: readonly string[],
  calldatas: readonly string[],
  options: DecoderOptions,
): Promise<DecodedAction[]> {
  return Promise.all(
    targets.map((target, i) => decodeAction(i, target, values[i] ?? "0", calldatas[i] ?? "0x", options)),
  );
}
