import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { useWallet } from "@solana/wallet-adapter-react";
import { ReactNode } from "react";
import { UmiContext } from "./useUmi";
import { mplCandyMachine } from "@metaplex-foundation/mpl-core-candy-machine";
import { createNoopSigner, publicKey, signerIdentity } from "@metaplex-foundation/umi";
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { coreGuards } from '@metaplex-foundation/umi-core-guards';

export const UmiProvider = ({
  endpoint,
  children,
}: {
  endpoint: string;
  children: ReactNode;
}) => {
  const wallet = useWallet();

  // Debug: Check if the endpoint is correctly passed
  console.log("Endpoint:", endpoint);

  const umi = createUmi(endpoint)
    .use(mplTokenMetadata())
    .use(mplCandyMachine())
    .use(dasApi())
    .use(coreGuards()); // Ensure coreGuards is included

  // Debug: Check if the wallet publicKey is correctly retrieved
  console.log("Wallet PublicKey:", wallet.publicKey);

  if (wallet.publicKey === null) {
    const noopSigner = createNoopSigner(publicKey("11111111111111111111111111111111"));
    umi.use(signerIdentity(noopSigner));

    // Debug: Check if noopSigner is correctly created
    console.log("Noop Signer:", noopSigner);
  } else {
    umi.use(walletAdapterIdentity(wallet));

    // Debug: Check if walletAdapterIdentity is correctly used
    console.log("Using Wallet Adapter Identity");
  }

  // Debug: Check if Umi instance is correctly created
  console.log("Umi Instance:", umi);

  return <UmiContext.Provider value={{ umi }}>{children}</UmiContext.Provider>;
};