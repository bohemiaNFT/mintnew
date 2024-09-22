import {
  AddressGate,
  Allocation,
  AssetBurn,
  AssetBurnMulti,
  AssetPayment,
  AssetPaymentMulti,
  CandyGuard,
  CandyMachine,
  EndDate,
  FreezeSolPayment,
  FreezeTokenPayment,
  GuardSet,
  NftBurn,
  NftGate,
  NftMintLimit,
  NftPayment,
  RedeemedAmount,
  SolFixedFee,
  SolPayment,
  StartDate,
  TokenBurn,
  TokenGate,
  TokenPayment,
  getMerkleRoot,
} from "@metaplex-foundation/mpl-core-candy-machine";
import {
  SolAmount,
  Some,
  Umi,
  assertAccountExists,
  publicKey,
  sol,
} from "@metaplex-foundation/umi";
import {
  addressGateChecker,
  allowlistChecker,
  checkTokensRequired,
  checkSolBalanceRequired,
  mintLimitChecker,
  ownedNftChecker,
  GuardReturn,
  allocationChecker,
  nftMintLimitChecker,
  DigitalAssetWithTokenAndNftMintLimit,
  DasApiAssetAndAssetMintLimit,
  checkCoreAssetsRequired,
  assetMintLimitChecker,
  ownedCoreAssetChecker,
} from "./checkerHelper";
import { allowLists } from "./../allowlist";
import {
  DigitalAssetWithToken,  
  fetchAllDigitalAssetWithTokenByOwner,
} from "@metaplex-foundation/mpl-token-metadata";
import { checkAtaValid } from "./validateConfig";
import { das } from "@metaplex-foundation/mpl-core-das";
import { AddressLookupTableProgram, PublicKey, Transaction, sendAndConfirmTransaction, Keypair } from "@solana/web3.js";
import bs58 from 'bs58'; // Add this import for base58 decoding

// In the guardChecker function
export const guardChecker = async (
  umi: Umi,
  candyGuard: CandyGuard,
  candyMachine: CandyMachine,
  solanaTime: bigint
) => {
  // Log the umi object to debug its structure
  console.log("UMI object:", umi);
  console.log("UMI identity:", umi.identity);
  console.log("UMI identity type:", typeof umi.identity);

  // Check if umi.identity is defined and has the expected structure
  if (!umi.identity || typeof umi.identity !== 'object') {
    console.error("UMI identity is not properly defined");
    return { guardReturn: [], ownedNfts: [], ownedCoreAssets: [] };
  }

  // Ensure the secret key is available
  if (!umi.identity.secretKey) {
    console.warn("Secret key is undefined. Cannot proceed with transaction.");
    // Instead of returning early, we'll continue without creating a Keypair
  } else {
    let secretKey = umi.identity.secretKey;
    console.log("Secret key type:", typeof secretKey);

    if (typeof secretKey === 'string') {
      try {
        secretKey = bs58.decode(secretKey);
      } catch (error) {
        console.error("Failed to decode secret key:", error);
      }
    } else if (!(secretKey instanceof Uint8Array)) {
      console.error(`Unexpected secret key type: ${typeof secretKey}`);
    }

    console.log("Secret key length:", secretKey.length);

    if (secretKey.length !== 64) {
      console.error(`Invalid secret key length. Expected 64 bytes, got ${secretKey.length}`);
    } else {
      try {
        const identityKeypair = Keypair.fromSecretKey(secretKey);
        console.log("Successfully created Keypair");

        // TODO: Consider using a lookup table to optimize transactions.
        // This should be set up separately, not within this function.
        // See the createLookupTable function below for an example implementation.
      } catch (error) {
        console.error("Error creating Keypair or sending transaction:", error);
      }
    }
  }

  let guardReturn: GuardReturn[] = [];

  let ownedTokens: DigitalAssetWithTokenAndNftMintLimit[] = [];
  let ownedCoreAssets: DasApiAssetAndAssetMintLimit[] = [];
  if (!candyGuard) {
    if (guardReturn.length === 0) {
      //guardReturn.push({ label: "default", allowed: false });
    }
    return { guardReturn, ownedNfts: ownedTokens, ownedCoreAssets };
  }

  let guardsToCheck: { label: string; guards: GuardSet }[] = candyGuard.groups;
  guardsToCheck.push({ label: "default", guards: candyGuard.guards });

  //no wallet connected. return dummies
  const dummyPublicKey = publicKey("11111111111111111111111111111111");
  if (
    umi.identity.publicKey === dummyPublicKey
  ) {
    for (const eachGuard of guardsToCheck) {
      guardReturn.push({
        label: eachGuard.label,
        allowed: false,
        reason: "Please connect your wallet to mint", 
      });
    }
    return { guardReturn, ownedNfts: ownedTokens, ownedCoreAssets };
  }

  if (
    Number(candyMachine.data.itemsAvailable) -
      Number(candyMachine.itemsRedeemed) ===
      0
  ) {
    for (const eachGuard of guardsToCheck) {
      guardReturn.push({
        label: eachGuard.label,
        allowed: false,
        reason: "Sorry, we are minted out!",
      });
    }
    return { guardReturn, ownedNfts: ownedTokens, ownedCoreAssets };
  }

  if (candyMachine.authority === umi.identity.publicKey) {
    checkAtaValid(umi, guardsToCheck);
  }

  let solBalance: SolAmount = sol(0);
  if (checkSolBalanceRequired(guardsToCheck)) {
    try {
      const account = await umi.rpc.getAccount(umi.identity.publicKey);
      assertAccountExists(account);
      solBalance = account.lamports;
    } catch (e) {
      for (const eachGuard of guardsToCheck) {
        guardReturn.push({
          label: eachGuard.label,
          allowed: false,
          reason: "Wallet does not exist. Do you have SOL?",
        });
      }
      return { guardReturn, ownedNfts: ownedTokens, ownedCoreAssets };
    }
  }

  if (checkTokensRequired(guardsToCheck)) {
    ownedTokens = await fetchAllDigitalAssetWithTokenByOwner(umi, 
      umi.identity.publicKey);      
  }

  if (checkCoreAssetsRequired(guardsToCheck)) {
    try {
      const assetList = await das.getAssetsByOwner(umi, {
        owner: umi.identity.publicKey
      });
      ownedCoreAssets = assetList;
    } catch (error) {
      if (error instanceof Error && error.message.includes("No assets found")) {
        console.warn("No assets found for the current user.");
        ownedCoreAssets = []; // Set to empty array if no assets found
      } else {
        throw error; // Re-throw other errors
      }
    }
  }  

  for (const eachGuard of guardsToCheck) {
    const singleGuard = eachGuard.guards;

    let isAllowed = true;
    let reason = "";

    if (singleGuard.addressGate.__option === "Some") {
      const addressGate = singleGuard.addressGate as Some<AddressGate>;
      if (
        !addressGateChecker(
          umi.identity.publicKey,
          publicKey(addressGate.value.address)
        )
      ) {
        isAllowed = false;
        reason = "AddressGate: Wrong Address";
      }
    }

    if (singleGuard.allocation.__option === "Some") {
      const allocatedAmount = await allocationChecker(
        umi,
        candyMachine,
        eachGuard
      );
      if (allocatedAmount < 1) {
        isAllowed = false;
        reason = "Allocation of this guard reached";
        console.info(`Guard ${eachGuard.label}; allocation reached`);
      }
    }

    if (singleGuard.allowList.__option === "Some") {
      if (!allowlistChecker(allowLists, umi, eachGuard.label)) {
        isAllowed = false;
        reason = "Wallet not allowlisted";
        console.info(`Guard ${eachGuard.label} wallet not allowlisted!`);
      }
    }

    if (singleGuard.assetBurn.__option === "Some") {
      const assetBurn = singleGuard.assetBurn as Some<AssetBurn>;
      const payableAmount = await ownedCoreAssetChecker(
        ownedCoreAssets,
        assetBurn.value.requiredCollection
      );
      if (payableAmount === 0) {
        isAllowed = false;
        reason = "No Asset to burn!";
        console.info(`${eachGuard.label}: No Asset to burn!`);
      }
    }

    if (singleGuard.assetBurnMulti.__option === "Some") {
      const assetBurnMulti = singleGuard.assetBurnMulti as Some<AssetBurnMulti>;
      const payableAmount = await ownedCoreAssetChecker(
        ownedCoreAssets,
        assetBurnMulti.value.requiredCollection
      );
      const multiAmount = payableAmount / assetBurnMulti.value.num;
      if (payableAmount === 0) {
        isAllowed = false;
        reason = "No Asset to burn!";
        console.info(`${eachGuard.label}: No Asset to burn!`);
      }
    }

    if (singleGuard.assetMintLimit.__option === "Some") {
      const { assetMintLimitAssets, ownedCoreAssets: newOwnedCoreAssets  } = await assetMintLimitChecker(
        umi,
        candyMachine,
        eachGuard,
        ownedCoreAssets
      );
      ownedCoreAssets = newOwnedCoreAssets;
      if (!assetMintLimitAssets) {
        continue;
      }
      let totalAmount: number = 0;
      assetMintLimitAssets.forEach(element => {
        if (element.assetMintLimit){
          totalAmount = totalAmount + element.assetMintLimit
        }        
      });
      if (totalAmount < 1) {
        isAllowed = false;
        reason = "Asset Mint limit of all owned NFT reached";
        console.info(`Guard ${eachGuard.label}; assetMintLimit reached`);
      }
    }

    if (singleGuard.assetPayment.__option === "Some") {
      const assetPayment = singleGuard.assetPayment as Some<AssetPayment>;
      const payableAmount = await ownedCoreAssetChecker(
        ownedCoreAssets,
        assetPayment.value.requiredCollection
      );
      if (payableAmount === 0) {
        isAllowed = false;
        reason = "No Asset to pay!";
        console.info(`${eachGuard.label}: No Asset to pay!`);
      }
    }

    if (singleGuard.assetPaymentMulti.__option === "Some") {
      const assetPaymentMulti = singleGuard.assetPaymentMulti as Some<AssetPaymentMulti>;
      const payableAmount = await ownedCoreAssetChecker(
        ownedCoreAssets,
        assetPaymentMulti.value.requiredCollection
      );
      const multiAmount = payableAmount / assetPaymentMulti.value.num;
      if (payableAmount === 0) {
        isAllowed = false;
        reason = "No Asset to pay!";
        console.info(`${eachGuard.label}: No Asset to pay!`);
      }
    }

    if (singleGuard.endDate.__option === "Some") {
      const addressGate = singleGuard.endDate as Some<EndDate>;
      if (solanaTime > addressGate.value.date) {
        isAllowed = false;
        reason = "Mint time is over!";
        console.info(`Guard ${eachGuard.label}; endDate reached!`);
      }
    }

    if (singleGuard.freezeSolPayment.__option === "Some") {
      const freezeSolPayment =
        singleGuard.freezeSolPayment as Some<FreezeSolPayment>;
      const payableAmount =
        solBalance.basisPoints / freezeSolPayment.value.lamports.basisPoints;

      if (
        freezeSolPayment.value.lamports.basisPoints > solBalance.basisPoints
      ) {
        isAllowed = false;
        reason = "Not enough SOL";
        console.info(
          `Guard ${eachGuard.label}; freezeSolPayment: not enough SOL`
        );
      }
    }

    if (singleGuard.mintLimit.__option === "Some") {
      const amount = await mintLimitChecker(umi, candyMachine, eachGuard);
      if (amount < 1) {
        isAllowed = false;
        reason = "Mint limit of this wallet reached";
        console.info(`Guard ${eachGuard.label}; mintLimit reached`);
      }
    }

    if (singleGuard.freezeTokenPayment.__option === "Some") {
      const freezeTokenPayment =
        singleGuard.freezeTokenPayment as Some<FreezeTokenPayment>;
      const digitalAssetWithToken = ownedTokens?.find(
        (el) => el.mint.publicKey === freezeTokenPayment.value.mint
      );
      if (
        !digitalAssetWithToken ||
        digitalAssetWithToken.token.amount >= freezeTokenPayment.value.amount
      ) {
        isAllowed = false;
        reason = "Not enough tokens!";
        console.info(`${eachGuard.label}: Token Balance too low !`);
      }
    }

    if (singleGuard.nftBurn.__option === "Some") {
      const nftBurn = singleGuard.nftBurn as Some<NftBurn>;
      const payableAmount = await ownedNftChecker(
        ownedTokens,
        nftBurn.value.requiredCollection
      );
      if (payableAmount === 0) {
        isAllowed = false;
        reason = "No NFT to burn!";
        console.info(`${eachGuard.label}: No Nft to burn!`);
      }
    }

    if (singleGuard.nftMintLimit.__option === "Some") {
      const { nftMintLimitAssets, ownedNfts } = await nftMintLimitChecker(
        umi,
        candyMachine,
        eachGuard,
        ownedTokens
      );
      ownedTokens = ownedNfts;
      if (!nftMintLimitAssets) {
        continue;
      }
      let totalAmount: number = 0;
      nftMintLimitAssets.forEach(element => {
        if (element.nftMintLimit){
          totalAmount = totalAmount + element.nftMintLimit
        }        
      });
      if (totalAmount < 1) {
        isAllowed = false;
        reason = "NFT Mint limit of all owned NFT reached";
        console.info(`Guard ${eachGuard.label}; nftmintLimit reached`);
      }
    }

    if (singleGuard.nftGate.__option === "Some") {
      const nftGate = singleGuard.nftGate as Some<NftGate>;
      if (!ownedNftChecker(ownedTokens, nftGate.value.requiredCollection)) {
        isAllowed = false;
        reason = "No NFT of the requred held!";
        console.info(`${eachGuard.label}: NftGate no NFT held!`);
      }
    }

    if (singleGuard.nftPayment.__option === "Some") {
      const nftPayment = singleGuard.nftPayment as Some<NftPayment>;
      const payableAmount = await ownedNftChecker(
        ownedTokens,
        nftPayment.value.requiredCollection
      );
      if (payableAmount === 0) {
        isAllowed = false;
        reason = "No NFT to pay with!";
        console.info(`${eachGuard.label}: nftPayment no NFT to pay with`);
      }
    }

    if (singleGuard.redeemedAmount.__option === "Some") {
      const redeemedAmount = singleGuard.redeemedAmount as Some<RedeemedAmount>;
      const payableAmount =
        redeemedAmount.value.maximum - candyMachine.itemsRedeemed;

      if (redeemedAmount.value.maximum >= candyMachine.itemsRedeemed) {
        isAllowed = false;
        reason = "Too many NFTs redeemed!";
        console.info(
          `${eachGuard.label}: redeemedAmount Too many NFTs redeemed!`
        );
      }
    }

    if (
      singleGuard.solPayment.__option === "Some" ||
      singleGuard.solFixedFee.__option === "Some"
    ) {
      const solPayment = singleGuard.solPayment as Some<SolPayment>;
      const solFixedFee = singleGuard.solFixedFee as Some<SolFixedFee>;
      let cost = 0;
      let payableAmount = 0;
      if (
        singleGuard.solPayment.__option === "Some" &&
        solPayment.value.lamports.basisPoints !== BigInt(0)
      ) {
        cost += Number(solPayment.value.lamports.basisPoints);
      }
      if (
        singleGuard.solFixedFee.__option === "Some" &&
        solFixedFee.value.lamports.basisPoints !== BigInt(0)
      ) {
        cost += Number(solFixedFee.value.lamports.basisPoints);
      }
      payableAmount = Number(solBalance.basisPoints) / cost;

      if (payableAmount === 0) {
        isAllowed = false;
        reason = "Not enough SOL!";
        console.info(`${eachGuard.label} SolPayment not enough SOL!`);
      }
    }

    if (singleGuard.startDate.__option === "Some") {
      const startDate = singleGuard.startDate as Some<StartDate>;
      if (solanaTime < startDate.value.date) {
        isAllowed = false;
        reason = "StartDate not reached!";
        console.info(`${eachGuard.label} StartDate not reached!`);
      }
    }

    if (singleGuard.tokenBurn.__option === "Some") {
      const tokenBurn = singleGuard.tokenBurn as Some<TokenBurn>;
      const digitalAssetWithToken = ownedTokens?.find(
        (el) => el.mint.publicKey === tokenBurn.value.mint
      );
      if (
        !digitalAssetWithToken ||
        digitalAssetWithToken.token.amount < tokenBurn.value.amount
      ) {
        isAllowed = false;
        reason = "Not enough tokens!";
        console.info(`${eachGuard.label} tokenBurn not enough tokens!`);
      }
    }

    if (singleGuard.tokenGate.__option === "Some") {
      const tokenGate = singleGuard.tokenGate as Some<TokenGate>;
      const digitalAssetWithToken = ownedTokens?.find(
        (el) => el.mint.publicKey === tokenGate.value.mint
      );
      if (
        !digitalAssetWithToken ||
        digitalAssetWithToken.token.amount < tokenGate.value.amount
      ) {
        isAllowed = false;
        reason = "Not enough tokens!";
        console.info(`${eachGuard.label} tokenGate not enough tokens!`);
      }
    }

    if (singleGuard.tokenPayment.__option === "Some") {
      const tokenPayment = singleGuard.tokenPayment as Some<TokenPayment>;
      const digitalAssetWithToken = ownedTokens?.find(
        (el) => el.mint.publicKey === tokenPayment.value.mint
      );
      if (
        !digitalAssetWithToken ||
        digitalAssetWithToken.token.amount < tokenPayment.value.amount
      ) {
        isAllowed = false;
        reason = "Not enough tokens!";
        console.info(`${eachGuard.label} tokenPayment not enough tokens!`);
      }
    }

    if (singleGuard.token2022Payment.__option === "Some") {
      const token2022Payment =
        singleGuard.token2022Payment as Some<TokenPayment>;
      const digitalAssetWithToken = ownedTokens?.find(
        (el) => el.mint.publicKey === token2022Payment.value.mint
      );
      if (
        !digitalAssetWithToken ||
        digitalAssetWithToken.token.amount < token2022Payment.value.amount
      ) {
        isAllowed = false;
        reason = "Not enough tokens!";
        console.info(`${eachGuard.label} token2022Payment not enough tokens!`);
      }
    }

    if (isAllowed) {
      guardReturn.push({
        label: eachGuard.label,
        allowed: true,
      });
    } else {
      guardReturn.push({
        label: eachGuard.label,
        allowed: false,
        reason: reason,
      });
    }
  }
  return { guardReturn, ownedTokens, ownedCoreAssets };
};

// Separate function for creating a lookup table
export const createLookupTable = async (
  umi: Umi,
  candyMachine: CandyMachine,
  candyGuard: CandyGuard
) => {
  if (!umi.identity.secretKey) {
    throw new Error("Secret key is required to create a lookup table");
  }

  try {
    const slot = await umi.rpc.getSlot({ commitment: "finalized" });
    const authority = new PublicKey(umi.identity.publicKey.toString());
    const payer = new PublicKey(umi.identity.publicKey.toString());
    const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
      authority,
      payer,
      recentSlot: slot,
    });

    const addAddressesInst = AddressLookupTableProgram.extendLookupTable({
      payer: new PublicKey(umi.identity.publicKey.toString()),
      authority: new PublicKey(umi.identity.publicKey.toString()),
      lookupTable: lookupTableAddress,
      addresses: [
        new PublicKey(candyMachine.publicKey.toString()),
        new PublicKey(candyGuard.publicKey.toString()),
        new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), // SPL Token program
        // Add more addresses as needed
      ],
    });

    const tx = new Transaction().add(lookupTableInst, addAddressesInst);
    const connection = umi.rpc.connection;

    const secretKey = bs58.decode(umi.identity.secretKey);
    const identityKeypair = Keypair.fromSecretKey(secretKey);

    const signature = await sendAndConfirmTransaction(connection, tx, [identityKeypair], {
      commitment: "confirmed",
    });

    console.log(`Lookup table created and extended. Signature: ${signature}`);
    console.log(`Lookup table address: ${lookupTableAddress.toBase58()}`);

    return lookupTableAddress;
  } catch (error) {
    console.error("Error creating lookup table:", error);
    throw error;
  }
}
