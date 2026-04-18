"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { toast } from "sonner";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ArrowUpRight, ArrowDownLeft,
  Pause, Play, X, RefreshCw, PlusCircle, MapPin, Clock, Share2,
} from "lucide-react";
import { FlowraLogo } from "@/components/ui/logo"
import CircleWalletPanel from "@/components/CircleWalletPanel";
import { formatUsdc, timeRemaining, streamProgress, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import { FLOWRA_ABI } from "@/lib/abi";
import { FLOWRA_CONTRACT_ADDRESS, BACKEND_URL } from "@/lib/wagmi";

interface StreamData {
  id: bigint;
  sender: string;
  receiver: string;
  totalAmount: bigint;
  startTime: bigint;
  endTime: bigint;
  amountClaimed: bigint;
  status: number;
  conditionType: number;
  claimable: bigint;
  direction: "sent" | "received";
}

function StreamCard({ stream, onAction }: { stream: StreamData; onAction: () => void }) {
  const { address } = useAccount();
  const isSender = stream.sender.toLowerCase() === address?.toLowerCase();
  const progress = streamProgress(stream.startTime, stream.endTime);
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const isLoading = isPending || isConfirming;

  useEffect(() => {
    if (txHash && !isConfirming) { toast.success("Flowra has settled this stream and returned remaining funds."); onAction(); }
  }, [txHash, isConfirming]);

  return (
    <Card className="bg-[#0d0d0d] border border-white/10 hover:border-white/20 transition-colors rounded-2xl overflow-hidden relative">
      {/* SVG background — sent streams get blue flow lines, received get green */}
      <div className="absolute inset-0 pointer-events-none">
        {stream.direction === "sent" ? (
          <>
            <svg className="absolute inset-0 w-full h-full opacity-[0.07]" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 100 Q100 60 200 100 Q300 140 400 100" stroke="#3b82f6" strokeWidth="1.5" fill="none"/>
              <path d="M0 120 Q100 80 200 120 Q300 160 400 120" stroke="#3b82f6" strokeWidth="1" fill="none" opacity="0.5"/>
              <path d="M0 80 Q100 40 200 80 Q300 120 400 80" stroke="#3b82f6" strokeWidth="1" fill="none" opacity="0.5"/>
              <circle cx="200" cy="100" r="4" fill="#3b82f6"/>
              <circle cx="100" cy="80" r="2" fill="#3b82f6" opacity="0.6"/>
              <circle cx="300" cy="120" r="2" fill="#3b82f6" opacity="0.6"/>
            </svg>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 to-black/90"/>
          </>
        ) : (
          <>
            <svg className="absolute inset-0 w-full h-full opacity-[0.07]" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="30" y="60" width="18" height="80" rx="4" fill="#10b981" opacity="0.5"/>
              <rect x="60" y="40" width="18" height="100" rx="4" fill="#10b981" opacity="0.6"/>
              <rect x="90" y="70" width="18" height="70" rx="4" fill="#10b981" opacity="0.4"/>
              <rect x="120" y="50" width="18" height="90" rx="4" fill="#10b981" opacity="0.7"/>
              <rect x="150" y="30" width="18" height="110" rx="4" fill="#10b981" opacity="0.9"/>
              <path d="M220 150 L260 80 L300 110 L340 50 L380 70" stroke="#10b981" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <circle cx="260" cy="80" r="3" fill="#10b981"/>
              <circle cx="340" cy="50" r="3" fill="#10b981"/>
            </svg>
            <div className="absolute inset-0 bg-gradient-to-br from-green-950/40 to-black/90"/>
          </>
        )}
      </div>
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stream.direction === "sent" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}`}>
              {stream.direction === "sent" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-white text-sm font-medium">{stream.direction === "sent" ? "Sent to" : "Receiving from"}</p>
              <p className="text-gray-500 text-xs font-mono">
                {stream.direction === "sent"
                  ? `${stream.receiver.slice(0, 8)}…${stream.receiver.slice(-6)}`
                  : `${stream.sender.slice(0, 8)}…${stream.sender.slice(-6)}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-xs font-medium ${STATUS_COLORS[stream.status]}`}>{STATUS_LABELS[stream.status]}</p>
            {stream.conditionType === 1 && (
              <div className="flex items-center gap-1 justify-end mt-1">
                <MapPin className="w-3 h-3 text-violet-400" />
                <span className="text-xs text-violet-400">Location-gated</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-gray-500 text-xs mb-1">Total</p>
            <p className="text-white text-sm font-semibold">{formatUsdc(stream.totalAmount)}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-gray-500 text-xs mb-1">Claimed</p>
            <p className="text-white text-sm font-semibold">{formatUsdc(stream.amountClaimed)}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <p className="text-gray-500 text-xs mb-1">Available</p>
            <p className="text-white text-sm font-semibold">{formatUsdc(stream.claimable)}</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Progress</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeRemaining(stream.endTime)}</span>
          </div>
          <Progress value={progress} className="h-1.5 bg-white/10" />
          <p className="text-right text-xs text-gray-500 mt-1">{progress}% elapsed</p>
        </div>

        <div className="flex gap-2">
          {!isSender && stream.status === 0 && (
            <a href={`/stream/${stream.id}`} className="flex-1 py-2 text-xs font-medium text-center rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:opacity-90 transition-opacity">
              Claim {formatUsdc(stream.claimable)}
            </a>
          )}
          {isSender && stream.status === 0 && (
            <>
              <button onClick={() => { writeContract({ address: FLOWRA_CONTRACT_ADDRESS, abi: FLOWRA_ABI, functionName: "pauseStream", args: [stream.id] }); toast.info("Flowra has paused this payment stream."); }} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors disabled:opacity-50">
                <Pause className="w-3 h-3" /> Pause
              </button>
              <button onClick={() => { if (!confirm("Cancel this stream?")) return; writeContract({ address: FLOWRA_CONTRACT_ADDRESS, abi: FLOWRA_ABI, functionName: "cancelStream", args: [stream.id] }); toast.info("Flowra is settling this stream…"); }} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                <X className="w-3 h-3" /> Cancel
              </button>
            </>
          )}
          {isSender && stream.status === 1 && (
            <button onClick={() => { writeContract({ address: FLOWRA_CONTRACT_ADDRESS, abi: FLOWRA_ABI, functionName: "resumeStream", args: [stream.id] }); toast.info("Flowra resumed the payment stream."); }} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50">
              <Play className="w-3 h-3" /> Resume
            </button>
          )}
          <button
            onClick={() => {
              const url = `${window.location.origin}/stream/${stream.id}`;
              navigator.clipboard.writeText(url).then(() => {
                toast.success("Stream link copied!");
              });
            }}
            className="px-3 py-2 text-xs rounded-lg bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1"
            title="Copy stream link"
          >
            <Share2 className="w-3 h-3" />
          </button>
          <a href={`/stream/${stream.id}`} className="px-3 py-2 text-xs rounded-lg bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-colors ml-auto">
            Details →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [streams, setStreams] = useState<StreamData[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"all" | "sent" | "received">("all");

  const fetchStreams = useCallback(async () => {
    if (!address || !publicClient) return;
    setLoading(true);
    try {
      // Fetch stream IDs from registry instantly — no chain scanning
      const regRes = await fetch(`${BACKEND_URL}/api/registry/${address}`);
      const regData = await regRes.json();
      const streamIds: string[] = regData.streamIds || [];

      if (streamIds.length === 0) { setStreams([]); return; }

      // Enrich each stream ID with on-chain data
      const enriched = await Promise.all(streamIds.map(async (idStr) => {
        const streamId = BigInt(idStr);
        const [rawStream, claimable] = await Promise.all([
          publicClient.readContract({ address: FLOWRA_CONTRACT_ADDRESS, abi: FLOWRA_ABI, functionName: "getStream", args: [streamId] }),
          publicClient.readContract({ address: FLOWRA_CONTRACT_ADDRESS, abi: FLOWRA_ABI, functionName: "claimableAmount", args: [streamId] }),
        ]);
        const s = rawStream as any;
        if (s.sender === "0x0000000000000000000000000000000000000000") return null;
        const isSender = s.sender.toLowerCase() === address.toLowerCase();
        const direction = isSender ? "sent" as const : "received" as const;
        return { id: streamId, sender: s.sender, receiver: s.receiver, totalAmount: s.totalAmount, startTime: s.startTime, endTime: s.endTime, amountClaimed: s.amountClaimed, status: Number(s.status), conditionType: Number(s.conditionType), claimable: claimable as bigint, direction } as StreamData;
      }));

      setStreams(enriched.filter(Boolean).sort((a, b) => Number(b!.startTime - a!.startTime)) as StreamData[]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load streams.");
    } finally {
      setLoading(false);
    }
  }, [address, publicClient]);

  useEffect(() => { fetchStreams(); }, [fetchStreams]);
  useEffect(() => { const id = setInterval(fetchStreams, 60_000); return () => clearInterval(id); }, [fetchStreams]);

  const filtered = streams.filter(s => tab === "all" ? true : tab === "sent" ? s.direction === "sent" : s.direction === "received");
  const totalClaimable = streams.filter(s => s.direction === "received" && s.status === 0).reduce((acc, s) => acc + s.claimable, 0n);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
        <Navbar />
        <FlowraLogo size={48} />
        <h1 className="text-2xl font-bold text-white">Connect your wallet</h1>
        <p className="text-gray-400">Connect to view your streams</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-16 text-white">
      <Navbar />
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400 mt-1 text-sm font-mono">{address?.slice(0, 8)}…{address?.slice(-6)}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchStreams} disabled={loading} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <a href="/create" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-medium hover:opacity-90 transition-opacity">
              <PlusCircle className="w-4 h-4" /> New Stream
            </a>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Total streams stat */}
          <div className="border border-white/10 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 to-black/90 pointer-events-none"/>
            <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" viewBox="0 0 200 100" fill="none">
              <circle cx="160" cy="50" r="40" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 4"/>
              <circle cx="160" cy="50" r="25" stroke="#3b82f6" strokeWidth="1"/>
              <circle cx="160" cy="50" r="4" fill="#3b82f6"/>
              <line x1="10" y1="30" x2="80" y2="30" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="50" x2="70" y2="50" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="70" x2="75" y2="70" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="relative text-gray-400 text-xs mb-2">Total streams</p>
            <p className="relative text-white text-2xl font-bold">{streams.length}</p>
          </div>
          {/* Ready to claim stat */}
          <div className="border border-white/10 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-950/40 to-black/90 pointer-events-none"/>
            <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" viewBox="0 0 200 100" fill="none">
              <polygon points="140,15 115,65 135,65 120,90 165,45 142,45" fill="#eab308" opacity="0.8"/>
              <circle cx="140" cy="50" r="40" stroke="#eab308" strokeWidth="0.5" strokeDasharray="3 5"/>
              <line x1="10" y1="40" x2="70" y2="40" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="55" x2="60" y2="55" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="70" x2="65" y2="70" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="relative text-gray-400 text-xs mb-2">Ready to claim</p>
            <p className="relative text-white text-2xl font-bold">{formatUsdc(totalClaimable)}</p>
          </div>
          {/* Active streams stat */}
          <div className="border border-white/10 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-950/40 to-black/90 pointer-events-none"/>
            <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" viewBox="0 0 200 100" fill="none">
              <path d="M100 15 L170 40 L170 70 C170 88 100 95 100 95 C100 95 30 88 30 70 L30 40 Z" stroke="#10b981" strokeWidth="1.5" fill="#10b981" fillOpacity="0.15"/>
              <rect x="82" y="50" width="36" height="28" rx="4" fill="#10b981" opacity="0.5"/>
              <path d="M88 50 L88 43 C88 35 112 35 112 43 L112 50" stroke="#10b981" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <circle cx="100" cy="64" r="4" fill="white" opacity="0.6"/>
            </svg>
            <p className="relative text-gray-400 text-xs mb-2">Active streams</p>
            <p className="relative text-green-400 text-2xl font-bold">{streams.filter(s => s.status === 0).length}</p>
          </div>
        </div>

        <div className="mb-8">
          <CircleWalletPanel />
        </div>

        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 mb-6 w-fit">
          {(["all", "sent", "received"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${tab === t ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}>
              {t}
            </button>
          ))}
        </div>

        {loading && streams.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 opacity-40" />
            Loading your streams…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-white/10 rounded-2xl">
            <FlowraLogo size={48} />
            <p className="text-gray-400 mb-4">No streams yet</p>
            <a href="/create" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-medium hover:opacity-90 transition-opacity">
              <PlusCircle className="w-4 h-4" /> Create your first stream
            </a>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map(s => <StreamCard key={s.id.toString()} stream={s} onAction={fetchStreams} />)}
          </div>
        )}
      </div>
    </div>
  );
}
