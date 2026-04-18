"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { Navbar } from "@/components/ui/navbar";
import { FlowraLogo } from "@/components/ui/logo";
import { RefreshCw, TrendingUp, Droplets, Users, Zap } from "lucide-react";
import { formatUsdc } from "@/lib/utils";
import { FLOWRA_ABI } from "@/lib/abi";
import { FLOWRA_CONTRACT_ADDRESS, BACKEND_URL } from "@/lib/wagmi";

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
      // Use registry for instant load — no chain scanning
      const regRes = await fetch(`${BACKEND_URL}/api/registry/${address}`);
      const regData = await regRes.json();
      const streamIds: string[] = regData.streamIds || [];

      const unique = streamIds.map(id => ({ args: { streamId: BigInt(id) }, direction: "sent" }));

      let totalStreamed = 0n;
      let totalClaimed = 0n;
      let activeStreams = 0;
      let completedStreams = 0;
      let sentStreams = 0;
      let receivedStreams = 0;

      await Promise.all(unique.map(async (log) => {
        const streamId = log.args?.streamId as bigint;
        const rawStream = await publicClient.readContract({
          address: FLOWRA_CONTRACT_ADDRESS,
          abi: FLOWRA_ABI,
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
        <FlowraLogo size={48} />
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
            <div key={s.label} className="border border-blue-500/20 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-950/60 to-black/80 pointer-events-none"/>
              <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 200 120" fill="none">
                <path d="M20 90 Q60 50 100 70 Q140 90 180 40" stroke="#3b82f6" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <circle cx="100" cy="70" r="3" fill="#3b82f6" opacity="0.8"/>
                <circle cx="180" cy="40" r="3" fill="#3b82f6" opacity="0.8"/>
                <circle cx="160" cy="30" r="25" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="3 5" opacity="0.4"/>
              </svg>
              <s.Icon className="relative w-4 h-4 text-blue-400 mb-3" />
              <p className="relative text-2xl font-bold text-white">{s.value}</p>
              <p className="relative text-gray-500 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-violet-500/20 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-violet-950/60 to-black/80 pointer-events-none"/>
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 400 220" fill="none">
              <rect x="40" y="60" width="28" height="120" rx="5" fill="#a855f7" opacity="0.3"/>
              <rect x="80" y="40" width="28" height="140" rx="5" fill="#a855f7" opacity="0.4"/>
              <rect x="120" y="80" width="28" height="100" rx="5" fill="#a855f7" opacity="0.5"/>
              <rect x="160" y="50" width="28" height="130" rx="5" fill="#a855f7" opacity="0.4"/>
              <circle cx="320" cy="110" r="70" stroke="#a855f7" strokeWidth="1" strokeDasharray="4 8" opacity="0.3"/>
              <circle cx="320" cy="110" r="40" stroke="#a855f7" strokeWidth="1" opacity="0.4"/>
              <circle cx="320" cy="110" r="6" fill="#a855f7" opacity="0.6"/>
            </svg>
            <p className="relative text-gray-500 text-xs uppercase tracking-wider mb-4">Stream breakdown</p>
            <div className="space-y-3">
              {[
                { label: "Sent",      value: stats.sentStreams      },
                { label: "Received",  value: stats.receivedStreams  },
                { label: "Active",    value: stats.activeStreams    },
                { label: "Completed", value: stats.completedStreams },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className="relative text-gray-400 text-sm">{r.label}</span>
                  <span className="relative text-white text-sm font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-green-500/20 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-green-950/60 to-black/80 pointer-events-none"/>
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 400 220" fill="none">
              <path d="M20 180 Q80 120 140 150 Q200 180 260 100 Q320 20 380 60" stroke="#10b981" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <circle cx="140" cy="150" r="4" fill="#10b981"/>
              <circle cx="260" cy="100" r="4" fill="#10b981"/>
              <circle cx="380" cy="60" r="4" fill="#10b981"/>
              <path d="M20 180 Q80 120 140 150 Q200 180 260 100 Q320 20 380 60 L380 220 L20 220 Z" fill="#10b981" opacity="0.08"/>
              <line x1="20" y1="220" x2="380" y2="220" stroke="#10b981" strokeWidth="0.5" opacity="0.3"/>
            </svg>
            <p className="relative text-gray-500 text-xs uppercase tracking-wider mb-4">Flow summary</p>
            <div className="space-y-3">
              {[
                { label: "Still locked",   value: formatUsdc(stats.totalStreamed - stats.totalClaimed) },
                { label: "Released",       value: formatUsdc(stats.totalClaimed) },
                { label: "Completion",     value: stats.totalStreamed > 0n ? `${Math.round(Number(stats.totalClaimed * 100n / stats.totalStreamed))}%` : "0%" },
              ].map(r => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className="relative text-gray-400 text-sm">{r.label}</span>
                  <span className="relative text-white text-sm font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
