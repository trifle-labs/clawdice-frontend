// Index Supply integration for Clawdice events
// Using official @indexsupply/indexsupply.js library
// Note: Index Supply returns lowercase column names

import { query, queryLive } from "@indexsupply/indexsupply.js";
import { getActiveNetwork } from "./networks";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

// Bets expire after 256 blocks (blockhash lookback limit)
const EXPIRY_BLOCKS = 256;

// Create a client to fetch current block
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// Cache current block with 10s TTL
let cachedBlockNumber: bigint | null = null;
let blockCacheTime = 0;
const BLOCK_CACHE_TTL = 10000; // 10 seconds

async function getCurrentBlock(): Promise<bigint> {
  const now = Date.now();
  if (cachedBlockNumber && now - blockCacheTime < BLOCK_CACHE_TTL) {
    return cachedBlockNumber;
  }
  cachedBlockNumber = await publicClient.getBlockNumber();
  blockCacheTime = now;
  return cachedBlockNumber;
}

// Get addresses from central config
const network = getActiveNetwork();
const BASE_SEPOLIA_CHAIN = BigInt(network.indexerChainId);
const CLAWDICE_ADDRESS = network.contracts.clawdice;
const VAULT_ADDRESS = network.contracts.clawdiceVault;

// Event signatures from Clawdice contract (must match exactly!)
const EVENT_SIGNATURES = {
  BetPlaced:
    "BetPlaced(uint256 indexed betId, address indexed player, uint128 amount, uint64 targetOddsE18, uint64 blockNumber)",
  BetResolved:
    "BetResolved(uint256 indexed betId, bool won, uint256 payout)",
  Deposit:
    "Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  Withdraw:
    "Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
};

export interface BetEvent {
  betId: string;
  player: string;
  amount: bigint;
  odds: number;
  won?: boolean;
  payout?: bigint;
  blockNumber: number;
  timestamp?: number;
  expired?: boolean; // true if bet expired without being claimed
}

export interface VaultEvent {
  type: "deposit" | "withdraw";
  sender: string;
  owner: string;
  assets: bigint;
  shares: bigint;
  blockNumber: number;
}

export interface IndexerStats {
  totalVolume: bigint;
  totalBets: number;
  uniquePlayers: number;
  houseProfit: bigint;
}

export async function getRecentBets(
  limit = 50,
  apiKey?: string
): Promise<BetEvent[]> {
  // Fetch bets, resolutions, and current block in parallel
  const [betsResult, resolvedResult, currentBlock] = await Promise.all([
    query({
      chainId: BASE_SEPOLIA_CHAIN,
      apiKey,
      signatures: [EVENT_SIGNATURES.BetPlaced],
      query: `
        SELECT betId, player, amount, targetOddsE18, block_num
        FROM BetPlaced
        WHERE address = '${CLAWDICE_ADDRESS}'
        ORDER BY block_num DESC
        LIMIT ${limit}
      `,
    }),
    query({
      chainId: BASE_SEPOLIA_CHAIN,
      apiKey,
      signatures: [EVENT_SIGNATURES.BetResolved],
      query: `
        SELECT betId, won, payout
        FROM BetResolved
        WHERE address = '${CLAWDICE_ADDRESS}'
      `,
    }),
    getCurrentBlock(),
  ]);

  // Build resolution lookup map (columns come back lowercase)
  const resolvedMap = new Map<string, { won: boolean; payout: bigint }>();
  for (const row of resolvedResult.rows) {
    const r = row as Record<string, unknown>;
    resolvedMap.set(String(r.betid), {
      won: Boolean(r.won),
      payout: BigInt(r.payout as string),
    });
  }

  return betsResult.rows.map((row: Record<string, unknown>) => {
    const betId = String(row.betid);
    const resolution = resolvedMap.get(betId);
    const betBlockNumber = Number(row.block_num);
    
    // Check if bet is expired (no resolution and older than 256 blocks)
    const isExpired = !resolution && Number(currentBlock) > betBlockNumber + EXPIRY_BLOCKS;
    
    return {
      betId,
      player: String(row.player),
      amount: BigInt(row.amount as string),
      odds: Number(BigInt(row.targetoddse18 as string) / BigInt(10 ** 16)),
      blockNumber: betBlockNumber,
      won: resolution?.won,
      payout: resolution?.payout,
      expired: isExpired,
    };
  });
}

export async function getBetsByPlayer(
  player: string,
  limit = 50,
  apiKey?: string
): Promise<BetEvent[]> {
  // Fetch bets, resolutions, and current block in parallel
  // Note: BetResolved doesn't have player field, so we fetch all and filter
  const [betsResult, resolvedResult, currentBlock] = await Promise.all([
    query({
      chainId: BASE_SEPOLIA_CHAIN,
      apiKey,
      signatures: [EVENT_SIGNATURES.BetPlaced],
      query: `
        SELECT betId, player, amount, targetOddsE18, block_num
        FROM BetPlaced
        WHERE address = '${CLAWDICE_ADDRESS}'
          AND player = '${player}'
        ORDER BY block_num DESC
        LIMIT ${limit}
      `,
    }),
    query({
      chainId: BASE_SEPOLIA_CHAIN,
      apiKey,
      signatures: [EVENT_SIGNATURES.BetResolved],
      query: `
        SELECT betId, won, payout
        FROM BetResolved
        WHERE address = '${CLAWDICE_ADDRESS}'
      `,
    }),
    getCurrentBlock(),
  ]);

  // Build resolution lookup map (columns come back lowercase)
  const resolvedMap = new Map<string, { won: boolean; payout: bigint }>();
  for (const row of resolvedResult.rows) {
    const r = row as Record<string, unknown>;
    resolvedMap.set(String(r.betid), {
      won: Boolean(r.won),
      payout: BigInt(r.payout as string),
    });
  }

  return betsResult.rows.map((row: Record<string, unknown>) => {
    const betId = String(row.betid);
    const resolution = resolvedMap.get(betId);
    const betBlockNumber = Number(row.block_num);
    
    // Check if bet is expired (no resolution and older than 256 blocks)
    const isExpired = !resolution && Number(currentBlock) > betBlockNumber + EXPIRY_BLOCKS;
    
    return {
      betId,
      player: String(row.player),
      amount: BigInt(row.amount as string),
      odds: Number(BigInt(row.targetoddse18 as string) / BigInt(10 ** 16)),
      blockNumber: betBlockNumber,
      won: resolution?.won,
      payout: resolution?.payout,
      expired: isExpired,
    };
  });
}

export async function getStats(apiKey?: string): Promise<IndexerStats> {
  // Fetch volume/bets and payouts in parallel
  const [volumeResult, payoutsResult] = await Promise.all([
    query({
      chainId: BASE_SEPOLIA_CHAIN,
      apiKey,
      signatures: [EVENT_SIGNATURES.BetPlaced],
      query: `
        SELECT
          SUM(amount) as total_volume,
          COUNT(betId) as total_bets,
          COUNT(DISTINCT player) as unique_players
        FROM BetPlaced
        WHERE address = '${CLAWDICE_ADDRESS}'
      `,
    }),
    query({
      chainId: BASE_SEPOLIA_CHAIN,
      apiKey,
      signatures: [EVENT_SIGNATURES.BetResolved],
      query: `
        SELECT SUM(payout) as total_payouts
        FROM BetResolved
        WHERE address = '${CLAWDICE_ADDRESS}'
      `,
    }),
  ]);

  const row = volumeResult.rows[0] || {};
  const payoutRow = payoutsResult.rows[0] || {};
  const r = row as Record<string, unknown>;
  const pr = payoutRow as Record<string, unknown>;

  const totalVolume = BigInt((r.total_volume as string) || "0");
  const totalPayouts = BigInt((pr.total_payouts as string) || "0");

  return {
    totalVolume,
    totalBets: Number(r.total_bets || 0),
    uniquePlayers: Number(r.unique_players || 0),
    houseProfit: totalVolume - totalPayouts,
  };
}

export async function getVaultEvents(
  limit = 50,
  apiKey?: string
): Promise<VaultEvent[]> {
  const [depositResult, withdrawResult] = await Promise.all([
    query({
      chainId: BASE_SEPOLIA_CHAIN,
      apiKey,
      signatures: [EVENT_SIGNATURES.Deposit],
      query: `
        SELECT sender, owner, assets, shares, block_num
        FROM Deposit
        WHERE address = '${VAULT_ADDRESS}'
        ORDER BY block_num DESC
        LIMIT ${limit}
      `,
    }),
    query({
      chainId: BASE_SEPOLIA_CHAIN,
      apiKey,
      signatures: [EVENT_SIGNATURES.Withdraw],
      query: `
        SELECT sender, owner, assets, shares, block_num
        FROM Withdraw
        WHERE address = '${VAULT_ADDRESS}'
        ORDER BY block_num DESC
        LIMIT ${limit}
      `,
    }),
  ]);

  const allEvents = [
    ...depositResult.rows.map((row: Record<string, unknown>) => ({
      type: "deposit" as const,
      sender: String(row.sender),
      owner: String(row.owner),
      assets: BigInt(row.assets as string),
      shares: BigInt(row.shares as string),
      blockNumber: Number(row.block_num),
    })),
    ...withdrawResult.rows.map((row: Record<string, unknown>) => ({
      type: "withdraw" as const,
      sender: String(row.sender),
      owner: String(row.owner),
      assets: BigInt(row.assets as string),
      shares: BigInt(row.shares as string),
      blockNumber: Number(row.block_num),
    })),
  ];

  return allEvents.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, limit);
}

// Live subscription using SSE
export function subscribeToBets(
  onBet: (bet: BetEvent) => void,
  apiKey?: string
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      for await (const response of queryLive({
        chainId: BASE_SEPOLIA_CHAIN,
        apiKey,
        abortSignal: controller.signal,
        signatures: [EVENT_SIGNATURES.BetPlaced],
        query: `
          SELECT betId, player, amount, targetOddsE18, block_num
          FROM BetPlaced
          WHERE address = '${CLAWDICE_ADDRESS}'
        `,
      })) {
        for (const row of response.rows) {
          const r = row as Record<string, unknown>;
          onBet({
            betId: String(r.betid),
            player: String(r.player),
            amount: BigInt(r.amount as string),
            odds: Number(BigInt(r.targetoddse18 as string) / BigInt(10 ** 16)),
            blockNumber: Number(r.block_num),
          });
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error("Live subscription error:", e);
      }
    }
  })();

  return () => controller.abort();
}
