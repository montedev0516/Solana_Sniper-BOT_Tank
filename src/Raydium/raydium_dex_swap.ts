
import { web3 } from "@project-serum/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { Market as RayMarket, Liquidity, LIQUIDITY_STATE_LAYOUT_V4, LiquidityPoolJsonInfo, LIQUIDITY_STATE_LAYOUT_V5, Token, TokenAmount, Percent, LiquidityStateV4, LiquidityStateV5, LiquidityPoolKeys, _SERUM_PROGRAM_ID_V3, SwapSide, LiquidityPoolInfo, } from '@raydium-io/raydium-sdk'
import { AccountLayout, MintLayout, NATIVE_MINT, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createCloseAccountInstruction,createSyncNativeInstruction } from "@solana/spl-token";
import { BN } from '@project-serum/anchor'
import { toBufferBE } from "bigint-buffer";

const log = console.log;

type Result<T, E = any | undefined> = {
    Ok?: T,
    Err?: E
}

type SwapInput = {
    keypair: Keypair
    poolId: web3.PublicKey
    buyToken: "base" | 'quote',
    sellToken?: 'base' | 'quote',
    amountSide: "send" | 'receive',
    amount: number,
    slippage: Percent,
    url: 'mainnet' | 'devnet',
}

type BuyFromPoolInput = {
    poolKeys: LiquidityPoolKeys,
    amountIn: TokenAmount
    amountOut: TokenAmount
    user: web3.PublicKey
    fixedSide: SwapSide
    tokenAccountIn: web3.PublicKey,
    tokenAccountOut: web3.PublicKey
  }

type ComputeBuyAmountInput = {
    poolKeys: LiquidityPoolKeys,
    user: web3.PublicKey
    amount: number,
    inputAmountType: 'send' | 'receive',
    buyToken: 'base' | 'quote',
    /** default (1 %) */
    slippage?: Percent
}

type BaseRayInput = {
    rpcEndpointUrl: string
}

const solanaConnection = new Connection(RPC_ENDPOINT, { wsEndpoint: WEBSOCKET_ENDPOINT, confirmTransactionInitialTimeout: 30000, commitment: "confirmed" });
const devConnection = new Connection(DEV_NET_RPC);

class BaseRay {
    private connection: web3.Connection
    private cacheIxs: web3.TransactionInstruction[]
    private pools: Map<string, LiquidityPoolJsonInfo>;
    private cachedPoolKeys: Map<string, LiquidityPoolKeys>;
    ammProgramId: web3.PublicKey
    private orderBookProgramId: web3.PublicKey
    private feeDestinationId: web3.PublicKey

    constructor(input: BaseRayInput) {
        this.connection = new web3.Connection(input.rpcEndpointUrl, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
        this.cacheIxs = []
        this.cachedPoolKeys = new Map();
        this.pools = new Map();
        if (input.rpcEndpointUrl == "https://api.devnet.solana.com" || input.rpcEndpointUrl == DEV_NET_RPC) {
            this.ammProgramId = new web3.PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8")
            this.feeDestinationId = new web3.PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR")
            this.orderBookProgramId = new web3.PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj")
        } else {
            this.ammProgramId = new web3.PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8")
            this.feeDestinationId = new web3.PublicKey("7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5")
            this.orderBookProgramId = new web3.PublicKey("srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX")
        }
    }

    reInit = () => this.cacheIxs = []

    async getPoolKeys(poolId: web3.PublicKey): Promise<LiquidityPoolKeys> {
        if (!this.pools) this.pools = new Map();
        if (!this.cachedPoolKeys) this.cachedPoolKeys = new Map();
        const cache2 = this.cachedPoolKeys.get(poolId.toBase58())
        if (cache2) {
            return cache2
        }
        // const cache = this.pools.get(poolId.toBase58())
        // if (cache) {
        //   return jsonInfo2PoolKeys(cache) as LiquidityPoolKeys
        // }

        const accountInfo = await this.connection.getAccountInfo(poolId)
        if (!accountInfo) throw "Pool info not found"
        let poolState: LiquidityStateV4 | LiquidityStateV5 | undefined = undefined
        let version: 4 | 5 | undefined = undefined
        let poolAccountOwner = accountInfo.owner
        if (accountInfo.data.length == LIQUIDITY_STATE_LAYOUT_V4.span) {
            poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(accountInfo.data)
            version = 4
        } else if (accountInfo.data.length == LIQUIDITY_STATE_LAYOUT_V5.span) {
            poolState = LIQUIDITY_STATE_LAYOUT_V5.decode(accountInfo.data)
            version = 5
        } else throw "Invalid Pool data length"
        if (!poolState || !version) throw "Invalid pool address"

        let { authority,
            baseDecimals,
            baseMint,
            baseVault,
            configId,
            id,
            lookupTableAccount,
            lpDecimals,
            lpMint,
            lpVault,
            marketAuthority,
            marketId,
            marketProgramId,
            marketVersion,
            nonce,
            openOrders,
            programId,
            quoteDecimals,
            quoteMint,
            quoteVault,
            targetOrders,
            // version,
            withdrawQueue,
        } = Liquidity.getAssociatedPoolKeys({
            baseMint: poolState.baseMint,
            baseDecimals: poolState.baseDecimal.toNumber(),
            quoteMint: poolState.quoteMint,
            quoteDecimals: poolState.quoteDecimal.toNumber(),
            marketId: poolState.marketId,
            marketProgramId: poolState.marketProgramId,
            marketVersion: 3,
            programId: poolAccountOwner,
            version,
        })
        if (lpMint.toBase58() != poolState.lpMint.toBase58()) {
            throw "Found some invalid keys"
        }

        // log({ version, baseMint: baseMint.toBase58(), quoteMint: quoteMint.toBase58(), lpMint: lpMint.toBase58(), marketId: marketId.toBase58(), marketProgramId: marketProgramId.toBase58() })
        let marketState: any = undefined;
        const marketAccountInfo = await this.connection.getAccountInfo(marketId).catch((error) => null)
        if (!marketAccountInfo) throw "Market not found"
        try {
            marketState = RayMarket.getLayouts(marketVersion).state.decode(marketAccountInfo.data)
            // if (mProgramIdStr != _SERUM_PROGRAM_ID_V3 && mProgramIdStr != _OPEN_BOOK_DEX_PROGRAM) {
            // }
        } catch (parseMeketDataError) {
            log({ parseMeketDataError })
        }
        if (!marketState) throw "MarketState not found"
        const { baseVault: marketBaseVault, quoteVault: marketQuoteVault, eventQueue: marketEventQueue, bids: marketBids, asks: marketAsks } = marketState
        const res: LiquidityPoolKeys = {
            baseMint,
            quoteMint,
            quoteDecimals,
            baseDecimals,
            authority,
            baseVault,
            quoteVault,
            id,
            lookupTableAccount,
            lpDecimals,
            lpMint,
            lpVault,
            marketAuthority,
            marketId,
            marketProgramId,
            marketVersion,
            openOrders,
            programId,
            targetOrders,
            version,
            withdrawQueue,
            marketAsks,
            marketBids,
            marketBaseVault,
            marketQuoteVault,
            marketEventQueue,
        }
        this.cachedPoolKeys.set(poolId.toBase58(), res)
        // log({ poolKeys: res })
        return res;
    }

    async computeBuyAmount(input: ComputeBuyAmountInput, etc?: { extraBaseResever?: number, extraQuoteReserve?: number, extraLpSupply?: number }) {
        const { amount, buyToken, inputAmountType, poolKeys, user } = input;
        const slippage = input.slippage ?? new Percent(1, 100)
        const base = poolKeys.baseMint
        const baseMintDecimals = poolKeys.baseDecimals;
        const quote = poolKeys.quoteMint
        const quoteMintDecimals = poolKeys.quoteDecimals;
        const baseTokenAccount = getAssociatedTokenAddressSync(base, user)
        const quoteTokenAccount = getAssociatedTokenAddressSync(quote, user)
        const baseR = new Token(TOKEN_PROGRAM_ID, base, baseMintDecimals);
        const quoteR = new Token(TOKEN_PROGRAM_ID, quote, quoteMintDecimals);
        let amountIn: TokenAmount
        let amountOut: TokenAmount
        let tokenAccountIn: web3.PublicKey
        let tokenAccountOut: web3.PublicKey
        const [lpAccountInfo, baseVAccountInfo, quoteVAccountInfo] = await this.connection.getMultipleAccountsInfo([poolKeys.lpMint, poolKeys.baseVault, poolKeys.quoteVault].map((e) => new web3.PublicKey(e))).catch(() => [null, null, null, null])
        if (!lpAccountInfo || !baseVAccountInfo || !quoteVAccountInfo) throw "Failed to fetch some data"
        // const lpSupply = new BN(Number(MintLayout.decode(lpAccountInfo.data).supply.toString()))
        // const baseReserve = new BN(Number(AccountLayout.decode(baseVAccountInfo.data).amount.toString()))
        // const quoteReserve = new BN(Number(AccountLayout.decode(quoteVAccountInfo.data).amount.toString()))

        const lpSupply = new BN(toBufferBE(MintLayout.decode(lpAccountInfo.data).supply, 8)).addn(etc?.extraLpSupply ?? 0)
        const baseReserve = new BN(toBufferBE(AccountLayout.decode(baseVAccountInfo.data).amount, 8)).addn(etc?.extraBaseResever ?? 0)
        const quoteReserve = new BN(toBufferBE(AccountLayout.decode(quoteVAccountInfo.data).amount, 8)).addn(etc?.extraQuoteReserve ?? 0)
        let fixedSide: SwapSide;

        const poolInfo: LiquidityPoolInfo = {
            baseDecimals: poolKeys.baseDecimals,
            quoteDecimals: poolKeys.quoteDecimals,
            lpDecimals: poolKeys.lpDecimals,
            lpSupply,
            baseReserve,
            quoteReserve,
            startTime: null as any,
            status: null as any
        }

        if (inputAmountType == 'send') {
            fixedSide = 'in'
            if (buyToken == 'base') {
                amountIn = new TokenAmount(quoteR, amount.toString(), false)
                // amountOut = Liquidity.computeAmountOut({ amountIn, currencyOut: baseR, poolInfo, poolKeys, slippage }).amountOut
                amountOut = Liquidity.computeAmountOut({ amountIn, currencyOut: baseR, poolInfo, poolKeys, slippage }).minAmountOut as TokenAmount
            } else {
                amountIn = new TokenAmount(baseR, amount.toString(), false)
                // amountOut = Liquidity.computeAmountOut({ amountIn, currencyOut: quoteR, poolInfo, poolKeys, slippage }).amountOut
                amountOut = Liquidity.computeAmountOut({ amountIn, currencyOut: quoteR, poolInfo, poolKeys, slippage }).minAmountOut as TokenAmount
            }
        } else {
            fixedSide = 'out'
            if (buyToken == 'base') {
                amountOut = new TokenAmount(baseR, amount.toString(), false)
                // amountIn = Liquidity.computeAmountIn({ amountOut, currencyIn: quoteR, poolInfo, poolKeys, slippage }).amountIn
                amountIn = Liquidity.computeAmountIn({ amountOut, currencyIn: quoteR, poolInfo, poolKeys, slippage }).maxAmountIn as TokenAmount
            } else {
                amountOut = new TokenAmount(quoteR, amount.toString(), false)
                // amountIn = Liquidity.computeAmountIn({ amountOut, currencyIn: baseR, poolInfo, poolKeys, slippage }).amountIn
                amountIn = Liquidity.computeAmountIn({ amountOut, currencyIn: baseR, poolInfo, poolKeys, slippage }).maxAmountIn as TokenAmount
            }
        }
        if (buyToken == 'base') {
            tokenAccountOut = baseTokenAccount
            tokenAccountIn = quoteTokenAccount
        } else {
            tokenAccountOut = quoteTokenAccount
            tokenAccountIn = baseTokenAccount
        }

        return {
            amountIn,
            amountOut,
            tokenAccountIn,
            tokenAccountOut,
            fixedSide
        }
    }

    async buyFromPool(input: BuyFromPoolInput): Promise<{ ixs: web3.TransactionInstruction[], signers: web3.Signer[] }> {
        this.reInit();
        const { amountIn, amountOut, poolKeys, user, fixedSide, tokenAccountIn, tokenAccountOut } = input

        const inToken = (amountIn as TokenAmount).token.mint;
        console.log('-------------------', inToken, tokenAccountIn, tokenAccountOut)
        if (inToken.toBase58() == NATIVE_MINT.toBase58()) {
            let lamports = BigInt(amountIn.raw.toNumber())
            const sendSolIx = web3.SystemProgram.transfer({
                fromPubkey: user,
                toPubkey: tokenAccountIn,
                lamports
            })
            const syncWSolAta = createSyncNativeInstruction(tokenAccountIn, TOKEN_PROGRAM_ID)
            const idemportent = createAssociatedTokenAccountIdempotentInstruction(
                user,
                tokenAccountOut,
                user,
                poolKeys.baseMint,
            )
            this.cacheIxs.push(sendSolIx, syncWSolAta, idemportent)
        } else {
            if (!await this.connection.getAccountInfo(tokenAccountOut))
                this.cacheIxs.push(
                    createAssociatedTokenAccountInstruction(
                        user,
                        tokenAccountOut,
                        user,
                        NATIVE_MINT,
                    )
                )
        }

        let rayIxs = Liquidity.makeSwapInstruction({
            poolKeys,
            amountIn: amountIn.raw,
            amountOut: 0,
            fixedSide: 'in',
            userKeys: { owner: user, tokenAccountIn, tokenAccountOut },
        }).innerTransaction

        if (inToken.toBase58() != NATIVE_MINT.toBase58()) {
            const unwrapSol = createCloseAccountInstruction(tokenAccountOut, user, user)
            rayIxs.instructions.push(unwrapSol)
        }
        const recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash
        const message = new web3.TransactionMessage({
            instructions: [...this.cacheIxs, ...rayIxs.instructions],
            payerKey: user,
            recentBlockhash
        }).compileToV0Message()
        const mainTx = new web3.VersionedTransaction(message)
        const buysimRes = (await this.connection.simulateTransaction(mainTx))
        console.log('inner buy', buysimRes)
        if (rayIxs.signers) mainTx.signatures.push(...rayIxs.signers)
        return {
            ixs: [...this.cacheIxs, ...rayIxs.instructions],
            signers: [...rayIxs.signers]
        }
    }
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function getPubkeyFromStr(str?: string) {
    try {
        return new web3.PublicKey((str ?? "").trim())
    } catch (error) {
        return null
    }
}

export async function sendAndConfirmTransaction(tx: web3.VersionedTransaction | web3.Transaction, connection: web3.Connection) {
    const rawTx = tx.serialize()
    const txSignature = (await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed', maxRetries: 4 })
        .catch(async () => {
            await sleep(500)
            return await web3.sendAndConfirmRawTransaction(connection, Buffer.from(rawTx), { commitment: 'confirmed' })
                .catch((txError) => {
                    log({ txError })
                    return null
                })
        }))
    return txSignature
}

export async function swap(input: SwapInput): Promise<Result<{ txSignature: string }, string>> {
    if (input.sellToken) {
        if (input.sellToken == 'base') {
            input.buyToken = "quote"
        } else {
            input.buyToken = "base"
        }
    }
    const user = input.keypair.publicKey
    const connection = new web3.Connection(input.url == 'mainnet' ? solanaConnection.rpcEndpoint : devConnection.rpcEndpoint, { commitment: "confirmed", confirmTransactionInitialTimeout: 60000 })
    const baseRay = new BaseRay({ rpcEndpointUrl: connection.rpcEndpoint })
    const slippage = input.slippage
    const poolKeys = await baseRay.getPoolKeys(input.poolId).catch(getPoolKeysError => { log({ getPoolKeysError }); return null })
    if (!poolKeys) { return { Err: "Pool info not found" } }
    log({
        baseToken: poolKeys.baseMint.toBase58(),
        quoteToken: poolKeys.quoteMint.toBase58(),
    })
    const { amount, amountSide, buyToken, } = input
    const swapAmountInfo = await baseRay.computeBuyAmount({
        amount, buyToken, inputAmountType: amountSide, poolKeys, user, slippage
    }).catch((computeBuyAmountError => log({ computeBuyAmountError })))

    if (!swapAmountInfo) return { Err: "failed to calculate the amount" }

    const { amountIn, amountOut, fixedSide, tokenAccountIn, tokenAccountOut, } = swapAmountInfo
    console.log('swapAmountInfo', { amountIn, amountOut, fixedSide, tokenAccountIn, tokenAccountOut, })

    const txInfo = await baseRay.buyFromPool({ amountIn, amountOut, fixedSide, poolKeys, tokenAccountIn, tokenAccountOut, user }).catch(buyFromPoolError => { log({ buyFromPoolError }); return null })
    if (!txInfo) return { Err: "failed to prepare swap transaction" }
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const txMsg = new web3.TransactionMessage({
        instructions: txInfo.ixs,
        payerKey: user,
        recentBlockhash,
    }).compileToV0Message()
    const tx = new web3.VersionedTransaction(txMsg)
    tx.sign([input.keypair, ...txInfo.signers])
    const buysimRes = (await connection.simulateTransaction(tx))
    console.log('tx handler buy sim res', buysimRes)
    const txSignature = await sendAndConfirmTransaction(tx, connection).catch((sendAndConfirmTransactionError) => {
        log({ sendAndConfirmTransactionError })
        return null
    })
    // const txSignature = await connection.sendTransaction(tx).catch((error) => { log({ createPoolTxError: error }); return null });
    if (!txSignature) {
        return { Err: "Failed to send transaction" }
    }
    return {
        Ok: {
            txSignature,
        }
    }
}