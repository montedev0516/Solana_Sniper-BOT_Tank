import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

const TOKEN_MINT_ADDRESS = "7NgbAAMf3ozg4NG3Ynt2de5TA2afMZZkfkGpEpC2mXYu"

async function getTokenDetails(mintAddress: string) {
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const mintPublicKey = new PublicKey(mintAddress);
  
  // Get mint information using the getMint function
  const mintInfo = await getMint(connection, mintPublicKey);
  
  console.log("Token Details:", mintInfo);
}


// Replace 'TOKEN_MINT_ADDRESS' with the actual mint address of the token you're interested in
getTokenDetails(TOKEN_MINT_ADDRESS);

