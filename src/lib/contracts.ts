import { Address } from "viem";

export const CONTRACTS = {
  baseSepolia: {
    clawToken: "0xD2C1CB4556ca49Ac6C7A5bc71657bD615500057c" as Address,
    clawdiceVault: "0x7406e3b5a1158aac919615cc7d5c2fc5b14dfc82" as Address,
    clawdice: "0xaef753fb788c57201bb36b9b4759c50bc70dd775" as Address,
  },
} as const;

export const CLAWDICE_ABI = [
  {
    name: "placeBet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "targetOddsE18", type: "uint64" },
    ],
    outputs: [{ name: "betId", type: "uint256" }],
  },
  {
    name: "placeBetWithETH",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "targetOddsE18", type: "uint64" },
      { name: "minTokensOut", type: "uint256" },
    ],
    outputs: [{ name: "betId", type: "uint256" }],
  },
  {
    name: "swapETHForClaw",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "minTokensOut", type: "uint256" }],
    outputs: [{ name: "tokensReceived", type: "uint256" }],
  },
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "betId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "computeResult",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "betId", type: "uint256" }],
    outputs: [
      { name: "won", type: "bool" },
      { name: "payout", type: "uint256" },
    ],
  },
  {
    name: "getBet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "betId", type: "uint256" }],
    outputs: [
      {
        name: "bet",
        type: "tuple",
        components: [
          { name: "player", type: "address" },
          { name: "amount", type: "uint128" },
          { name: "targetOddsE18", type: "uint64" },
          { name: "blockNumber", type: "uint64" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "getMaxBet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "targetOddsE18", type: "uint64" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "houseEdgeE18",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "nextBetId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "BetPlaced",
    type: "event",
    inputs: [
      { name: "betId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "amount", type: "uint128", indexed: false },
      { name: "targetOddsE18", type: "uint64", indexed: false },
      { name: "blockNumber", type: "uint64", indexed: false },
    ],
  },
  {
    name: "BetResolved",
    type: "event",
    inputs: [
      { name: "betId", type: "uint256", indexed: true },
      { name: "won", type: "bool", indexed: false },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
  {
    name: "BetClaimed",
    type: "event",
    inputs: [
      { name: "betId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
] as const;

export const VAULT_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "convertToAssets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "convertToShares",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "previewDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "previewRedeem",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
