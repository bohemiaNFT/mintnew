import { useEffect, useState, useCallback, useMemo } from 'react';
import { Umi, SolAmount } from '@metaplex-foundation/umi';
import { useWallet } from '@solana/wallet-adapter-react';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';

export const useWalletBalance = (umi: Umi) => {
  const [balance, setBalance] = useState<number | null>(null);
  const wallet = useWallet();
  const umiWithWallet = useMemo(() => wallet.connected ? umi.use(walletAdapterIdentity(wallet)) : umi, [umi, wallet]);

  const fetchWalletBalance = useCallback(async () => {
    if (wallet.connected) {
      try {
        const balance: SolAmount = await umiWithWallet.rpc.getBalance(umiWithWallet.identity.publicKey);
        setBalance(Number(balance.basisPoints) / 1_000_000_000); // Convert lamports to SOL
      } catch (error) {
        console.error('Error fetching wallet balance:', error);
      }
    }
  }, [wallet.connected, umiWithWallet]);

  useEffect(() => {
    if (wallet.connected) {
      fetchWalletBalance();
    }
  }, [wallet.connected, fetchWalletBalance]);

  return balance;
};