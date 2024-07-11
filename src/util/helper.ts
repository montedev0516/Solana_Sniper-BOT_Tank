import { Keypair, PublicKey } from "@solana/web3.js"
import { addressType, signal } from "./types";
import Moralis from "moralis";
import axios from 'axios';
import dotenv from "dotenv";
dotenv.config();

import { priceFactor, connection } from "../config";
import { Wallet } from "@coral-xyz/anchor";
import bs58 from "bs58";

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const BITQUERY_V2_TOKEN = process.env.BITQUERY_V2_TOKEN;
const BITQUERY_V1_TOKEN = process.env.BITQUERY_V1_TOKEN;



const verifySolanaAddress = (address: string) : any => {
    if (address.length < 32 || address.length > 44) {
        return false;
    }
    try {
        const publicKey = new PublicKey(address);
        return PublicKey.isOnCurve(publicKey);
    } catch (error) {
        return false;
    }
}

export const verifyAddress = (address: string): addressType => {
    if (verifySolanaAddress(address)) {
        return addressType.SOLANA;
    }
    return addressType.INVALID;
}
export const getRandomArbitrary = (min: number, max: number): number => {
    return Math.random() * (max - min) + min;
}

export const Delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const MoralisStart = async () => {
    await Moralis.start({ apiKey: MORALIS_API_KEY });
}

export const getSolanaTokenPrice = async (address: string) => {
    Delay(200);
    console.log("token mint address", address)
    for (let i = 0; i < 5; i++) {
        try {
            const response = await Moralis.SolApi.token.getTokenPrice({
                "network": "mainnet",
                "address": address
            });
            if (response.raw) return response.raw;    
        } catch(err) {
            Delay(1000);
            console.error("solana token price", err);
        }
    }
}

export const getSolanaTokenPriceBitquery = async (address: string) => {
    Delay(200);
    console.log("token mint address", address)
    let data = JSON.stringify({
        "query": `{
            Solana {
            DEXTradeByTokens(
                where: {Trade: {Currency: {MintAddress: {is: "${address}"}}}}
                orderBy: {descending: Trade_Side_Currency_Decimals}
                limit: {count: 1}
            ) {
                Trade {
                PriceInUSD
                }
            }
            }
        }`,
        "variables": "{}"
    });
    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://streaming.bitquery.io/eap',
        headers: { 
            'Content-Type': 'application/json', 
            'X-API-KEY': BITQUERY_V1_TOKEN, 
            'Authorization': `Bearer ${BITQUERY_V2_TOKEN}`
        },
        data : data
    };
  
    for (let i = 0; i < 5; i++) {
      try {
        const response = await axios.request(config);
        console.log(JSON.stringify(response.data));
        return {
          usdPrice: response.data.data.Solana.DEXTradeByTokens[0].Trade.PriceInUSD
        }
      } catch (err) {
          Delay(1000);
          console.log("getting token price on Raydium error");
      }
    }
}

export const convertAsSignal = async (histories: any, solana = false) => {
    try {
        const data = histories.map((item: any) => {
            return {
                address: item.contractAddress,
                chain: item.chain
            }
        }).flat();
        const uniqueData: any = [...new Set(data)];
        console.log("unique data", uniqueData);
        const newPrice: any = []
        let priceResult = []
     
        for (let i = 0; i < uniqueData.length; i++) {
            priceResult[i] = {
                ...await getSolanaTokenPriceBitquery(uniqueData[i].address),
                tokenAddress: uniqueData[i].address
            }
        }
        priceResult.forEach(e => {
            console.log("tokenAddress", e.tokenAddress.toString().toLowerCase(), "tokenprice", e.usdPrice);
        })
        priceResult.forEach(one => newPrice[one.tokenAddress.toString().toLowerCase()] = one.usdPrice);
    
        const signales: signal[] = [];
        
        histories.forEach((item: any) => {
            console.log("contract Address => ", item.contractAddress.toLocaleLowerCase(), 
            "purchase price =>", item.purchasedPrice, 
            "current price =>", newPrice[item.contractAddress.toLocaleLowerCase()], 
            "rate =>", newPrice[item.contractAddress.toLocaleLowerCase()] / item.purchasedPrice);
            if (newPrice[item.contractAddress.toLocaleLowerCase()] != undefined && newPrice[item.contractAddress.toLocaleLowerCase()] >= item.purchasedPrice * priceFactor[item.priceFactor]) {
            if (item.priceFactor == 2) {
                signales.push({
                "id": item.id,
                "contractAddress": item.contractAddress,
                "action": "sell",
                "amount": "100",
                "platform": item.platform,
                "chain": item.chain,
                "priceFactor": item.priceFactor
                } as signal);
            }
            else {
                signales.push({
                "id": item.id,
                "contractAddress": item.contractAddress,
                "action": "sell",
                "amount": "50",
                "platform": item.platform,
                "chain": item.chain,
                "priceFactor": item.priceFactor
                } as signal);
            }
            }
        })
        return signales
    }
    catch (err) {
      console.error(err)
      return []
    }
}

export const getTokenAccountByOwnerAndMint = async (WALLET_PRIVATE_KEY: string, mintAddress: string) => {
    const wallet = new Wallet(Keypair.fromSecretKey(Uint8Array.from(bs58.decode(WALLET_PRIVATE_KEY))))
    for (let i = 0; i < 3; i++) {
        try {
            const accountAddress = await connection.getTokenAccountsByOwner(
                wallet.publicKey,
                {
                    mint: new PublicKey(mintAddress)
                }
            );
            return accountAddress;
        } catch (err) {
            console.log("Empyt token account");
        } 
    }
    return "empty"
}

export const getTokenBalance = async (accountAddress: PublicKey) => {
    const balance = await connection.getTokenAccountBalance(
        accountAddress,
    )
    return balance.value.amount;
} 
  

