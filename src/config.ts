import { Connection } from "@solana/web3.js";
import dotenv from "dotenv";
dotenv.config();

export const solBuyAmountRange: number[] = [0.00001, 0.00005];
export const msgCatchInternalDuration = 20000;
export const sellInternalDuration = 10000;
export const priceFactor: number[] =  [0.01, 2, 10];

const RPC_URL: string = process.env.RPC_URL as string; // ENTER YOUR RPC
const WEBSOCKET_URL: string = process.env.WEBSOCKET_URL as string;


export const connection = new Connection(RPC_URL, { wsEndpoint: WEBSOCKET_URL, confirmTransactionInitialTimeout: 30000, commitment: 'confirmed' }) 
export const solanaWallets: string[] = [""];

