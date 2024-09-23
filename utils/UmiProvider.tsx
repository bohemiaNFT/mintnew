import React, { createContext, useContext, useEffect, useState } from 'react';
import { Umi, createUmi } from '@metaplex-foundation/umi';
import { useWallet } from '@solana/wallet-adapter-react';
import { createDefaultUmi } from '@metaplex-foundation/umi-bundle-defaults';

const UmiContext = createContext<Umi | undefined>(undefined);

export const useUmi = (): Umi => {
  const context = useContext(UmiContext);
  if (!context) {
    throw new Error('useUmi must be used within a UmiProvider');
  }
  return context;
};

export const UmiProvider: React.FC<{ endpoint: string; children: React.ReactNode }> = ({ endpoint, children }) => {
  const wallet = useWallet();
  const [umi, setUmi] = useState<Umi | undefined>(undefined);

  useEffect(() => {
    const umiInstance = createDefaultUmi(endpoint);
    setUmi(umiInstance);
  }, [endpoint]);

  useEffect(() => {
    if (umi && wallet.connected) {
      umi.use(wallet);
    }
  }, [umi, wallet]);

  return <UmiContext.Provider value={umi}>{children}</UmiContext.Provider>;
};