// Index Supply integration for Clawdice events
// API docs: https://indexsupply.net/docs

const INDEXER_URL = "https://indexsupply.net";
const BASE_SEPOLIA_CHAIN = 84532;

// Event signatures from Clawdice contract
const EVENT_SIGNATURES = {
  BetPlaced: "BetPlaced(uint256 indexed betId, address indexed player, uint256 amount, uint64 targetOddsE18)",
  BetClaimed: "BetClaimed(uint256 indexed betId, address indexed player, bool won, uint256 payout)",
  Deposit: "Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  Withdraw: "Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
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

async function queryIndexer(
  signatures: string[],
  query: string,
  apiKey?: string
): Promise<{ columns: string[]; rows: unknown[][] }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${INDEXER_URL}/v2/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      chain: BASE_SEPOLIA_CHAIN,
      signatures,
      query,
    }),
  });

  if (!response.ok) {
    throw new Error(`Indexer error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    columns: data.columns?.map((c: { name: string }) => c.name) || [],
    rows: data.rows || [],
  };
}

export async function getRecentBets(
  limit = 50,
  apiKey?: string
): Promise<BetEvent[]> {
  // Query placed bets joined with claimed results
  const result = await queryIndexer(
    [EVENT_SIGNATURES.BetPlaced, EVENT_SIGNATURES.BetClaimed],
    `
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
    WHERE p.address = ${CLAWDICE_ADDRESS}
    ORDER BY p.block_num DESC
    LIMIT ${limit}
    `,
    apiKey
  );

  return result.rows.map((row) => ({
    betId: String(row[0]),
    player: String(row[1]),
    amount: BigInt(row[2] as string),
    odds: Number(BigInt(row[3] as string) / BigInt(10 ** 16)),
    blockNumber: Number(row[4]),
    won: row[5] !== null ? Boolean(row[5]) : undefined,
    payout: row[6] !== null ? BigInt(row[6] as string) : undefined,
  }));
}

export async function getBetsByPlayer(
  player: string,
  limit = 50,
  apiKey?: string
): Promise<BetEvent[]> {
  const result = await queryIndexer(
    [EVENT_SIGNATURES.BetPlaced, EVENT_SIGNATURES.BetClaimed],
    `
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
    WHERE p.address = ${CLAWDICE_ADDRESS}
      AND p.player = ${player}
    ORDER BY p.block_num DESC
    LIMIT ${limit}
    `,
    apiKey
  );

  return result.rows.map((row) => ({
    betId: String(row[0]),
    player: String(row[1]),
    amount: BigInt(row[2] as string),
    odds: Number(BigInt(row[3] as string) / BigInt(10 ** 16)),
    blockNumber: Number(row[4]),
    won: row[5] !== null ? Boolean(row[5]) : undefined,
    payout: row[6] !== null ? BigInt(row[6] as string) : undefined,
  }));
}

export async function getStats(apiKey?: string): Promise<IndexerStats> {
  // Get total volume and bet count
  const volumeResult = await queryIndexer(
    [EVENT_SIGNATURES.BetPlaced],
    `
    SELECT
      SUM(amount) as total_volume,
      COUNT(*) as total_bets,
      COUNT(DISTINCT player) as unique_players
    FROM BetPlaced
    WHERE address = ${CLAWDICE_ADDRESS}
    `,
    apiKey
  );

  // Get total payouts for house profit calculation
  const payoutsResult = await queryIndexer(
    [EVENT_SIGNATURES.BetClaimed],
    `
    SELECT SUM(payout) as total_payouts
    FROM BetClaimed
    WHERE address = ${CLAWDICE_ADDRESS} AND won = true
    `,
    apiKey
  );

  const row = volumeResult.rows[0] || [0, 0, 0];
  const payoutRow = payoutsResult.rows[0] || [0];

  const totalVolume = BigInt(row[0] as string || "0");
  const totalPayouts = BigInt(payoutRow[0] as string || "0");

  return {
    totalVolume,
    totalBets: Number(row[1] || 0),
    uniquePlayers: Number(row[2] || 0),
    houseProfit: totalVolume - totalPayouts,
  };
}

export async function getVaultEvents(
  limit = 50,
  apiKey?: string
): Promise<VaultEvent[]> {
  const depositResult = await queryIndexer(
    [EVENT_SIGNATURES.Deposit],
    `
    SELECT sender, owner, assets, shares, block_num, 'deposit' as type
    FROM Deposit
    WHERE address = ${VAULT_ADDRESS}
    ORDER BY block_num DESC
    LIMIT ${limit}
    `,
    apiKey
  );

  const withdrawResult = await queryIndexer(
    [EVENT_SIGNATURES.Withdraw],
    `
    SELECT sender, owner, assets, shares, block_num, 'withdraw' as type
    FROM Withdraw
    WHERE address = ${VAULT_ADDRESS}
    ORDER BY block_num DESC
    LIMIT ${limit}
    `,
    apiKey
  );

  const allEvents = [
    ...depositResult.rows.map((row) => ({
      type: "deposit" as const,
      sender: String(row[0]),
      owner: String(row[1]),
      assets: BigInt(row[2] as string),
      shares: BigInt(row[3] as string),
      blockNumber: Number(row[4]),
    })),
    ...withdrawResult.rows.map((row) => ({
      type: "withdraw" as const,
      sender: String(row[0]),
      owner: String(row[1]),
      assets: BigInt(row[2] as string),
      shares: BigInt(row[3] as string),
      blockNumber: Number(row[4]),
    })),
  ];

  return allEvents.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, limit);
}

// SSE live query for real-time updates
export function subscribeToBets(
  onBet: (bet: BetEvent) => void,
  apiKey?: string
): () => void {
  const params = new URLSearchParams({
    chain: String(BASE_SEPOLIA_CHAIN),
    signatures: EVENT_SIGNATURES.BetPlaced,
    query: `SELECT betId, player, amount, targetOddsE18, block_num FROM BetPlaced WHERE address = ${CLAWDICE_ADDRESS}`,
  });

  if (apiKey) {
    params.set("api_key", apiKey);
  }

  const eventSource = new EventSource(
    `${INDEXER_URL}/v2/query-live?${params.toString()}`
  );

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.rows && data.rows.length > 0) {
        for (const row of data.rows) {
          onBet({
            betId: String(row[0]),
            player: String(row[1]),
            amount: BigInt(row[2]),
            odds: Number(BigInt(row[3]) / BigInt(10 ** 16)),
            blockNumber: Number(row[4]),
          });
        }
      }
    } catch (e) {
      console.error("Failed to parse SSE event:", e);
    }
  };

  eventSource.onerror = (e) => {
    console.error("SSE error:", e);
  };

  return () => eventSource.close();
}
