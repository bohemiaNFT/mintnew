import { createUmi, coreGuards } from "@metaplex-foundation/umi"; // Import coreGuards from umi
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { useWallet } from "@solana/wallet-adapter-react";
import { ReactNode } from "react";
import { UmiContext } from "./useUmi";
import { mplCandyMachine } from "@metaplex-foundation/mpl-core-candy-machine"; // Correct package
import { createNoopSigner, publicKey, signerIdentity } from "@metaplex-foundation/umi";
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { web3JsRpc } from "@metaplex-foundation/umi-rpc-web3js"; // Correct plugin for RPC

export const UmiProvider = ({
  endpoint,
  children,
}: {
  endpoint: string;
  children: ReactNode;
}) => {
  const wallet = useWallet();
  const umi = createUmi()
    .use(web3JsRpc(endpoint)) // Use the web3JsRpc plugin to set the endpoint
    .use(mplTokenMetadata())
    .use(mplCandyMachine()) // Ensure correct plugin usage
    .use(dasApi())
    .use(coreGuards()); // Add coreGuards

  if (wallet.publicKey === null) {
    const noopSigner = createNoopSigner(publicKey("11111111111111111111111111111111"));
    umi.use(signerIdentity(noopSigner));
  } else {
    umi.use(walletAdapterIdentity(wallet));
  }

  return <UmiContext.Provider value={{ umi }}>{children}</UmiContext.Provider>;
};