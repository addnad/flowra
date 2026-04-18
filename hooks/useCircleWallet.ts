import { useState, useEffect } from "react";
import { useAccount } from "wagmi";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export function useCircleWallet() {
  const { address } = useAccount();
  const [wallet, setWallet] = useState<any>(null);
  const [balance, setBalance] = useState<{ available: string; locked: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createWallet() {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/wallet/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: address }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setWallet(data.wallet);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBalance() {
    if (!address) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/wallet/balance/${address}`);
      const data = await res.json();
      if (data.success) setBalance(data.balance);
    } catch (e) {
      console.error("Balance fetch error:", e);
    }
  }

  async function getDepositAddress() {
    if (!address) return null;
    const res = await fetch(`${BACKEND_URL}/api/deposit/address/${address}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.depositAddress;
  }

  async function withdraw(toAddress: string, amount: string) {
    if (!address) return null;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: address, toAddress, amount }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchBalance();
      return data.transfer;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (address) fetchBalance();
  }, [address]);

  return { wallet, balance, loading, error, createWallet, fetchBalance, getDepositAddress, withdraw };
}
