import { useState } from "react";
import { useAccount } from "wagmi";
import { FLOWRA_CONTRACT_ADDRESS, BACKEND_URL } from "@/lib/wagmi";

export function usePaymaster() {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getPaymasterStatus() {
    const res = await fetch(`${BACKEND_URL}/api/paymaster/status`);
    const data = await res.json();
    return data;
  }

  async function sponsorTransaction(to: string, data: string, value?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/paymaster/sponsor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, data, value: value || "0" }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function getGaslessPermit() {
    if (!address) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/paymaster/permit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: address, contractAddress: FLOWRA_CONTRACT_ADDRESS }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, getPaymasterStatus, sponsorTransaction, getGaslessPermit };
}
