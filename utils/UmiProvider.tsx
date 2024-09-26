import { createUmi, Umi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { useWallet } from "@solana/wallet-adapter-react";
import { ReactNode } from "react";
import { UmiContext } from "./useUmi";
import { mplCandyMachine } from "@metaplex-foundation/mpl-core-candy-machine";
import { createNoopSigner, publicKey, signerIdentity } from "@metaplex-foundation/umi";
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';

// Extend Umi type to include coreGuards
interface ExtendedUmi extends Umi {
  coreGuards?: any; // Adjust the type as needed
}

export const UmiProvider = ({
  endpoint,
  children,
}: {
  endpoint: string;
  children: ReactNode;
}) => {
  const wallet = useWallet();
  const umi: ExtendedUmi = createUmi(endpoint)
    .use(mplTokenMetadata())
    .use(mplCandyMachine())
    .use(dasApi());

  if (wallet.publicKey === null) {
    const noopSigner = createNoopSigner(publicKey("11111111111111111111111111111111"));
    umi.use(signerIdentity(noopSigner));
  } else {
    umi.use(walletAdapterIdentity(wallet));
  }

  // Initialize coreGuards if needed
  umi.coreGuards = {}; // Adjust the initialization as needed

  return <UmiContext.Provider value={{ umi }}>{children}</UmiContext.Provider>;
};