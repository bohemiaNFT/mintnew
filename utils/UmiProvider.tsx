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
import { some, sol, dateTime } from '@metaplex-foundation/umi';

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

  // Define guard groups
  const guardGroups = [
    {
      label: 'early',
      guards: {
        solPayment: some({ lamports: sol(1), destination: 'treasury' }),
        startDate: some({ date: dateTime('2022-10-18T16:00:00Z') }),
        endDate: some({ date: dateTime('2022-10-18T17:00:00Z') }),
        botTax: some({ lamports: sol(0.001), lastInstruction: true }),
      },
    },
    {
      label: 'late',
      guards: {
        solPayment: some({ lamports: sol(2), destination: 'treasury' }),
        startDate: some({ date: dateTime('2022-10-18T17:00:00Z') }),
        botTax: some({ lamports: sol(0.001), lastInstruction: true }),
      },
    },
  ];

  // Debug: Check if guard groups are correctly defined
  console.log("Guard Groups:", guardGroups);

  // Use guard groups in Umi instance
  umi.use({ guardGroups });

  // Debug: Check if Umi instance is correctly created with guard groups
  console.log("Umi Instance with Guard Groups:", umi);

  return <UmiContext.Provider value={{ umi }}>{children}</UmiContext.Provider>;
};