// Index Supply integration for Clawdice events
// Using official @indexsupply/indexsupply.js library

import { query, queryLive } from "@indexsupply/indexsupply.js";

const BASE_SEPOLIA_CHAIN = 84532n;

// Event signatures from Clawdice contract
const EVENT_SIGNATURES = {
  BetPlaced:
    "BetPlaced(uint256 indexed betId, address indexed player, uint256 amount, uint64 targetOddsE18)",
  BetClaimed:
    "BetClaimed(uint256 indexed betId, address indexed player, bool won, uint256 payout)",
  Deposit:
    "Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  Withdraw:
    "Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
};

const CLAWDICE_ADDRESS = "0x8eE2FCe0b8Bd17D4C958163dd2ef6877BA9eED7B";
const VAULT_ADDRESS = "0xA186fa18f9889097F7F7746378932b50f5A91E61";

export interface BetEvent {
  betId: string;
  player: string;
  amount: bigint;
  odds: number;
  won?: boolean;
  payout?: bigint;
  blockNumber: number;
  timestamp?: number;
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
  const result = await query({
    chainId: BASE_SEPOLIA_CHAIN,
    apiKey,
    signatures: [EVENT_SIGNATURES.BetPlaced, EVENT_SIGNATURES.BetClaimed],
    query: `
      SELECT
        p.betId,
        p.player,
        p.amount,
        p.targetOddsE18,
        p.block_num,
        c.won,
        c.payout
      FROM BetPlaced p
      LEFT JOIN BetClaimed c ON p.betId = c.betId
      WHERE p.address = '${CLAWDICE_ADDRESS}'
      ORDER BY p.block_num DESC
      LIMIT ${limit}
    `,
  });

  return result.rows.map((row: Record<string, unknown>) => ({
    betId: String(row.betId),
    player: String(row.player),
    amount: BigInt(row.amount as string),
    odds: Number(BigInt(row.targetOddsE18 as string) / BigInt(10 ** 16)),
    blockNumber: Number(row.block_num),
    won: row.won !== null ? Boolean(row.won) : undefined,
    payout: row.payout !== null ? BigInt(row.payout as string) : undefined,
  }));
}

export async function getBetsByPlayer(
  player: string,
  limit = 50,
  apiKey?: string
): Promise<BetEvent[]> {
  const result = await query({
    chainId: BASE_SEPOLIA_CHAIN,
    apiKey,
    signatures: [EVENT_SIGNATURES.BetPlaced, EVENT_SIGNATURES.BetClaimed],
    query: `
      SELECT
        p.betId,
        p.player,
        p.amount,
        p.targetOddsE18,
        p.block_num,
        c.won,
        c.payout
      FROM BetPlaced p
      LEFT JOIN BetClaimed c ON p.betId = c.betId
      WHERE p.address = '${CLAWDICE_ADDRESS}'
        AND p.player = '${player}'
      ORDER BY p.block_num DESC
      LIMIT ${limit}
    `,
  });

  return result.rows.map((row: Record<string, unknown>) => ({
    betId: String(row.betId),
    player: String(row.player),
    amount: BigInt(row.amount as string),
    odds: Number(BigInt(row.targetOddsE18 as string) / BigInt(10 ** 16)),
    blockNumber: Number(row.block_num),
    won: row.won !== null ? Boolean(row.won) : undefined,
    payout: row.payout !== null ? BigInt(row.payout as string) : undefined,
  }));
}

export async function getStats(apiKey?: string): Promise<IndexerStats> {
  // Get total volume and bet count
  const volumeResult = await query({
    chainId: BASE_SEPOLIA_CHAIN,
    apiKey,
    signatures: [EVENT_SIGNATURES.BetPlaced],
    query: `
      SELECT
        SUM(amount) as total_volume,
        COUNT(*) as total_bets,
        COUNT(DISTINCT player) as unique_players
      FROM BetPlaced
      WHERE address = '${CLAWDICE_ADDRESS}'
    `,
  });

  // Get total payouts for house profit calculation
  const payoutsResult = await query({
    chainId: BASE_SEPOLIA_CHAIN,
    apiKey,
    signatures: [EVENT_SIGNATURES.BetClaimed],
    query: `
      SELECT SUM(payout) as total_payouts
      FROM BetClaimed
      WHERE address = '${CLAWDICE_ADDRESS}' AND won = true
    `,
  });

  const row = volumeResult.rows[0] || { total_volume: "0", total_bets: 0, unique_players: 0 };
  const payoutRow = payoutsResult.rows[0] || { total_payouts: "0" };

  const totalVolume = BigInt((row as Record<string, unknown>).total_volume as string || "0");
  const totalPayouts = BigInt((payoutRow as Record<string, unknown>).total_payouts as string || "0");

  return {
    totalVolume,
    totalBets: Number((row as Record<string, unknown>).total_bets || 0),
    uniquePlayers: Number((row as Record<string, unknown>).unique_players || 0),
    houseProfit: totalVolume - totalPayouts,
  };
}

export async function getVaultEvents(
  limit = 50,
  apiKey?: string
): Promise<VaultEvent[]> {
  const depositResult = await query({
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
  });

  const withdrawResult = await query({
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
  });

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
            betId: String(r.betId),
            player: String(r.player),
            amount: BigInt(r.amount as string),
            odds: Number(BigInt(r.targetOddsE18 as string) / BigInt(10 ** 16)),
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
