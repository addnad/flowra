"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { Navbar } from "@/components/ui/navbar";
import { DrippayLogo } from "@/components/ui/logo";
import { RefreshCw, TrendingUp, Droplets, Users, Zap } from "lucide-react";
import { formatUsdc } from "@/lib/utils";
import { DRIPLY_ABI } from "@/lib/abi";
import { DRIPLY_CONTRACT_ADDRESS } from "@/lib/wagmi";

export default function AnalyticsPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalStreams: 0,
    totalStreamed: 0n,
    totalClaimed: 0n,
    activeStreams: 0,
    completedStreams: 0,
    sentStreams: 0,
    receivedStreams: 0,
  });

  const fetchAnalytics = useCallback(async () => {
    if (!address || !publicClient) return;
    setLoading(true);
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const CHUNK = 9000n;
      const START_BLOCK = 34997075n;
      const allLogs: any[] = [];

      for (let from = START_BLOCK; from <= latestBlock; from += CHUNK) {
        const to = from + CHUNK - 1n < latestBlock ? from + CHUNK - 1n : latestBlock;
        const eventAbi = {
          name: "StreamCreated", type: "event" as const,
          inputs: [
            { name: "streamId", type: "uint256", indexed: true },
            { name: "sender", type: "address", indexed: true },
            { name: "receiver", type: "address", indexed: true },
            { name: "totalAmount", type: "uint256", indexed: false },
            { name: "startTime", type: "uint256", indexed: false },
            { name: "endTime", type: "uint256", indexed: false },
            { name: "conditionType", type: "uint8", indexed: false },
          ],
        };
        const [sentLogs, receivedLogs] = await Promise.all([
          publicClient.getLogs({ address: DRIPLY_CONTRACT_ADDRESS, event: eventAbi, args: { sender: address as `0x${string}` }, fromBlock: from, toBlock: to }),
          publicClient.getLogs({ address: DRIPLY_CONTRACT_ADDRESS, event: eventAbi, args: { receiver: address as `0x${string}` }, fromBlock: from, toBlock: to }),
        ]);
        allLogs.push(...sentLogs.map(l => ({ ...l, direction: "sent" })), ...receivedLogs.map(l => ({ ...l, direction: "received" })));
      }

      const seen = new Set<string>();
      const unique = allLogs.filter(l => {
        const id = (l.args?.streamId ?? "").toString();
        if (seen.has(id)) return false;
        seen.add(id); return true;
      });

      let totalStreamed = 0n;
      let totalClaimed = 0n;
      let activeStreams = 0;
      let completedStreams = 0;
      let sentStreams = 0;
      let receivedStreams = 0;

      await Promise.all(unique.map(async (log) => {
        const streamId = log.args?.streamId as bigint;
        const rawStream = await publicClient.readContract({
          address: DRIPLY_CONTRACT_ADDRESS,
          abi: DRIPLY_ABI,
          functionName: "getStream",
          args: [streamId],
        });
        const s = rawStream as any;
        totalStreamed += s.totalAmount;
        totalClaimed += s.amountClaimed;
        if (Number(s.status) === 0) activeStreams++;
        if (Number(s.status) === 3) completedStreams++;
        if (log.direction === "sent") sentStreams++;
        if (log.direction === "received") receivedStreams++;
      }));

      setStats({ totalStreams: unique.length, totalStreamed, totalClaimed, activeStreams, completedStreams, sentStreams, receivedStreams });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [address, publicClient]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
        <Navbar />
        <DrippayLogo size={48} />
        <h1 className="text-2xl font-bold text-white">Connect your wallet</h1>
        <p className="text-gray-400">Connect to view your analytics</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-16">
      <Navbar />
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <p className="text-gray-400 text-sm mt-1">Your payment stream overview</p>
          </div>
          <button onClick={fetchAnalytics} disabled={loading} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total streams",  value: stats.totalStreams.toString(),   Icon: Droplets  },
            { label: "Total streamed", value: formatUsdc(stats.totalStreamed), Icon: TrendingUp },
            { label: "Total claimed",  value: formatUsdc(stats.totalClaimed),  Icon: Zap       },
            { label: "Active",         value: stats.activeStreams.toString(),  Icon: Users     },
          ].map(s => (
            <div key={s.label} className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-5">
              <s.Icon className="w-4 h-4 text-gray-500 mb-3" />
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-gray-500 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-5">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-4">Stream breakdown</p>
            <div className="space-y-3">
              {[
                { label: "Sent",      value: stats.sentStreams      },
                { label: "Received",  value: stats.receivedStreams  },
                { label: "Active",    value: stats.activeStreams    },
                { label: "Completed", value: stats.completedStreams },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{r.label}</span>
                  <span className="text-white text-sm font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-5">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-4">Flow summary</p>
            <div className="space-y-3">
              {[
                { label: "Still locked",   value: formatUsdc(stats.totalStreamed - stats.totalClaimed) },
                { label: "Released",       value: formatUsdc(stats.totalClaimed) },
                { label: "Completion",     value: stats.totalStreamed > 0n ? `${Math.round(Number(stats.totalClaimed * 100n / stats.totalStreamed))}%` : "0%" },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{r.label}</span>
                  <span className="text-white text-sm font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
