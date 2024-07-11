import dotenv from "dotenv";
dotenv.config();

import RaydiumSwap from './RaydiumSwap';
import swapConfig from "./swapConfig" // Import the configuration

import { 
  getTokenAccountByOwnerAndMint,
  getTokenBalance
} from '../util/helper';

import { 
  Delay,
  getSolanaTokenPrice, 
} from "../util/helper";
// const { buyActions, sellActions } = require('../../utils/db');

import { solanaWallets } from '../config';
import { signal } from '../util/types';
import { buyActions, sellActions } from '../util/db';

/**
 * Performs a token swap on the Raydium protocol.
 * Depending on the configuration, it can execute the swap or simulate it.
 */
const raydiumSwap = async (signal: signal, sell: boolean = false, signalNumber: number) => {

  try {
    const raydiumSwap = new RaydiumSwap(solanaWallets[0]);
    console.log(`Raydium swap initialized`);
    let tokenAAddress: string;
    let tokenBAddress: string;
    let tokenAAmount: number = 0;
    let accountAddress: any;
    let initialBalance: any;
    let tokenBPrice;
    let tokenAPrice;
    if (sell) { // sell
      tokenAAddress = signal.contractAddress.toString();
      tokenBAddress = swapConfig.solTokenAddress;
     
    } else { // buy
      tokenAAddress = swapConfig.solTokenAddress;
      tokenBAddress = signal.contractAddress.toString();
      tokenAAmount = parseFloat(signal.amount.toString().split("SOL")[0]) as number;
      tokenAPrice = await getSolanaTokenPrice(tokenAAddress); // Sol price;
      console.log(`tokenAPrice: ${tokenAPrice?.usdPrice}`); 
      if (tokenAPrice?.usdPrice === undefined) return;
    }
    
    
    /**
      * Find pool information for the given token pair.
    */
    const poolInfo = await raydiumSwap.getPoolInfoByTokenPair(tokenAAddress, tokenBAddress);
    // console.log("poolInfo", poolInfo);
    if (!poolInfo) {
      console.log("Not find pool info");
      return;
    }
    console.log('Found pool info');

    const instructions = [];
    if (sell) { // sell
      accountAddress = await getTokenAccountByOwnerAndMint(solanaWallets[0], tokenAAddress);
      console.log("accountAddress", accountAddress);
      initialBalance = await getTokenBalance(accountAddress.value[0].pubkey);
      console.log(`sell wallet tokenA initial balance ---> ${initialBalance}`);
      tokenAAmount = parseFloat(signal.amount.toString().split("SOL")[0]) / 100 * initialBalance / (10 ** poolInfo.baseDecimals) as number
    }
    else { //buy
      accountAddress = await getTokenAccountByOwnerAndMint(solanaWallets[0], tokenBAddress);
      console.log("accountAddress", accountAddress);
      if (accountAddress?.value?.[0]?.pubkey === undefined) {
        // const createTokenAtaInst = await raydiumSwap.createAssociatedTokenAccount(tokenBAddress);
        // if (createTokenAtaInst) {
        //   // instructions.push(createTokenAtaInst);
        // }
        initialBalance = 0;
      }
      else {
        initialBalance = await getTokenBalance(accountAddress.value[0].pubkey);
      }
      console.log(`buy wallet tokenB initial balance ---> ${initialBalance}`);
    }
    console.log(`Swapping ${tokenAAmount} of ${tokenAAddress} for ${tokenBAddress}...`)
    
    /**
     * Prepare the swap transaction with the given parameters.
     */
    const swapInst = await raydiumSwap.getSwapTransaction(
      tokenBAddress,
      tokenAAmount,
      poolInfo,
      swapConfig.maxLamports, 
      swapConfig.useVersionedTransaction,
      swapConfig.direction
    );

    instructions.push(...swapInst);

    console.log("instructions", instructions)
    const { versionedTransaction: tx, recentBlockhashForSwap: recentBlockhash } = await raydiumSwap.createVersionedTransaction(instructions) 
    // console.log("versionedTransaction", tx);
    /**
     * Depending on the configuration, execute or simulate the swap.
     */
    if (swapConfig.executeSwap) {
      /**
       * Send the transaction to the network and log the transaction ID.
       */
      const res = await raydiumSwap.sendVersionedTransaction(tx, swapConfig.maxRetries, recentBlockhash)
      if (res) { //&& await raydiumSwap.checkTranactionSuccess(txid)
        console.log('buy success');
        if (!sell) {
          
          /**
           * Get token account if new token account was created.
           */
          if (accountAddress?.value[0]?.pubkey === undefined) {
            while (1) {
              accountAddress = await getTokenAccountByOwnerAndMint(solanaWallets[0], tokenBAddress);
              if (accountAddress != "empty") break;
            }
          }
          const afterBalance: any = await getTokenBalance(accountAddress.value[0].pubkey);
          console.log(`wallet tokenB initial balance after buy---> ${afterBalance}`);
          const tokenUsdPrice = (tokenAPrice?.usdPrice || 0) * tokenAAmount / ((afterBalance ? afterBalance: 0) - initialBalance) * (10 ** (2 * poolInfo.quoteDecimals - 9)) ;
          /**
           * Save buy result.
           */
          buyActions.push({
            signalNumber: signalNumber,
            contractAdress: tokenBAddress,
            price: tokenUsdPrice,
            platform: signal.platform.toString(),
            chain: "solana",
          });
        } else {
          /**
           * Save sell result.
           */
          sellActions.push({
            id: signal.id,
            contractAddress: signal.contractAddress,
            priceFactor: signal.priceFactor
          });
        }
      } 

    } else {
      /**
       * Simulate the transaction and log the result.
       */
      const simRes = await raydiumSwap.simulateVersionedTransaction(tx)
      console.log("instruction error", simRes.value.err);
      console.log(simRes);
    }
  } catch (err) {
    Delay(5000);
    console.error(err);
  }
};

/**
 * Implment raydium trading.
 * @param {string} signal signal for trading
 * @param {number} signalNumber signal number in valid signal group.
 */
const raydiumToken = async (signal: signal, signalNumber: number) => {
  try {
    if (signal.action.toString().toLowerCase().trim().includes("sell")) {
      await raydiumSwap(signal, true, signalNumber);
    } else {
      await raydiumSwap(signal, false, signalNumber);
    }
  } catch (err) {
    console.error(err)
  }
}

export default raydiumToken;

