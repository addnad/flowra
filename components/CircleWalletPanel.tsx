"use client";
import { useState } from "react";
import { useCircleWallet } from "@/hooks/useCircleWallet";
import { useAccount } from "wagmi";

export default function CircleWalletPanel() {
  const { address } = useAccount();
  const { wallet, balance, loading, error, createWallet, fetchBalance, getDepositAddress, withdraw } = useCircleWallet();
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [withdrawTo, setWithdrawTo] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [txResult, setTxResult] = useState<string | null>(null);

  async function handleGetDepositAddress() {
    const addr = await getDepositAddress();
    if (addr) setDepositAddress(addr.address);
  }

  async function handleWithdraw() {
    const result = await withdraw(withdrawTo, withdrawAmount);
    if (result) setTxResult(result.id);
  }

  if (!address) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 max-w-md w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">Circle Wallet</h2>
        <button onClick={fetchBalance} className="text-xs text-zinc-400 hover:text-white transition">Refresh</button>
      </div>

      {balance && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs mb-1">Available</p>
            <p className="text-white font-mono text-lg">{balance.available} <span className="text-zinc-400 text-sm">USDC</span></p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs mb-1">Locked</p>
            <p className="text-white font-mono text-lg">{balance.locked} <span className="text-zinc-400 text-sm">USDC</span></p>
          </div>
        </div>
      )}

      {!wallet && (
        <button onClick={createWallet} disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-3 text-sm font-medium transition disabled:opacity-50">
          {loading ? "Creating..." : "Create Circle Wallet"}
        </button>
      )}

      {wallet && (
        <div className="space-y-2">
          <p className="text-zinc-400 text-xs">Wallet ID</p>
          <p className="text-white font-mono text-xs break-all">{wallet.walletId}</p>
        </div>
      )}

      <div className="space-y-2">
        <button onClick={handleGetDepositAddress} disabled={loading}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl py-3 text-sm font-medium transition">
          Get Deposit Address
        </button>
        {depositAddress && (
          <p className="text-green-400 font-mono text-xs break-all">{depositAddress}</p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-zinc-400 text-sm font-medium">Withdraw USDC</p>
        <input value={withdrawTo} onChange={e => setWithdrawTo(e.target.value)}
          placeholder="Destination address"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-violet-500" />
        <input value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
          placeholder="Amount (USDC)"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-violet-500" />
        <button onClick={handleWithdraw} disabled={loading || !withdrawTo || !withdrawAmount}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-3 text-sm font-medium transition disabled:opacity-50">
          {loading ? "Processing..." : "Withdraw"}
        </button>
        {txResult && <p className="text-green-400 text-xs">Transfer ID: {txResult}</p>}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
