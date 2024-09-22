import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";   
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mplCandyMachine } from "@metaplex-foundation/mpl-core-candy-machine";
import { createNoopSigner, publicKey, signerIdentity } from "@metaplex-foundation/umi";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { useWallet } from "@solana/wallet-adapter-react";
import { ReactNode } from "react";
import { UmiContext } from "./useUmi";
import { CoreGuards } from "@metaplex-foundation/umi"; // Import CoreGuards type

export const UmiProvider = ({
  endpoint,
  children,
  coreGuards, // Add coreGuards as a prop
}: {
  endpoint: string;
  children: ReactNode;
  coreGuards?: CoreGuards; // Define the type
}) => {
  const wallet = useWallet();
  const umi = createUmi(endpoint)
    .use(mplTokenMetadata())
    .use(mplCandyMachine())
    .use(dasApi());

  if (wallet.publicKey === null) {
    const noopSigner = createNoopSigner(publicKey("11111111111111111111111111111111"));
    umi.use(signerIdentity(noopSigner));
  } else {
    umi.use(walletAdapterIdentity(wallet));   

  }

  // Use conditional typing to handle coreGuards
  const umiWithCoreGuards = coreGuards ? umi.use(coreGuards) : umi;

  return <UmiContext.Provider value={{ umi: umiWithCoreGuards }}>{children}</UmiContext.Provider>;
};