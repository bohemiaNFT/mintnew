import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { useWallet } from "@solana/wallet-adapter-react";
import { ReactNode } from "react";
import { UmiContext } from "./useUmi";
import { mplCandyMachine } from "@metaplex-foundation/mpl-core-candy-machine";
import { createNoopSigner, publicKey, signerIdentity } from "@metaplex-foundation/umi";
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';

export const UmiProvider = ({
  endpoint,
  children,
}: {
  endpoint: string;
  children: ReactNode;
}) => {
  const wallet = useWallet();
  const umi = createUmi(endpoint)
    .use(mplTokenMetadata())
    .use(mplCandyMachine())
    .use(dasApi());

  // Ensure coreGuards is included if required
  if (!umi.coreGuards) {
    umi.coreGuards = {}; // Initialize coreGuards if it's required and missing
  }

  if (wallet.publicKey === null) {
    const noopSigner = createNoopSigner(publicKey("11111111111111111111111111111111"));
    umi.use(signerIdentity(noopSigner));
  } else {
    umi.use(walletAdapterIdentity(wallet));
  }

  return <UmiContext.Provider value={{ umi }}>{children}</UmiContext.Provider>;
};