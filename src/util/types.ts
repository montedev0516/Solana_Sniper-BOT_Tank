import { PublicKey } from "@solana/web3.js"
export enum addressType {
    "SOLANA",
    "EVM",
    "INVALID"
}

export type signal = {
    id: number,
    contractAddress: string,
    action: "buy" | "sell",
    amount: string,
    priceFactor?: number,
    platform: "raydium"
    chain: "solana"
    timestamp: string 
}

export type buyActionType = {
    signalNumber: number,
    contractAdress: string,
    price: number,
    platform: string,
    chain: string
}

export type sellActionType = {
    id: number,
    contractAddress: string,
    priceFactor: number | undefined
}

export type signalMap = {
    [key: number]: signal | null
}

export type poolInfoDataType = {
    id: PublicKey
    baseMint: PublicKey
    quoteMint: PublicKey
    lpMint: PublicKey
    baseDecimals: number
    quoteDecimals: number
    lpDecimals: number
    version: number
    programId: PublicKey
    authority: PublicKey
    openOrders: PublicKey
    targetOrders: PublicKey
    baseVault: PublicKey
    quoteVault: PublicKey
    withdrawQueue: PublicKey
    lpVault: PublicKey
    marketVersion: PublicKey
    marketProgramId: PublicKey
    marketId: PublicKey
    marketAuthority: PublicKey
    marketBaseVault: PublicKey
    marketQuoteVault: PublicKey
    marketBids: PublicKey
    marketAsks: PublicKey
    marketEventQueue: PublicKey
    lookupTableAccount: string
}
