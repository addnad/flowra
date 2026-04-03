"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { toast } from "sonner";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ArrowUpRight, ArrowDownLeft,
  Pause, Play, X, RefreshCw, PlusCircle, MapPin, Clock,
} from "lucide-react";
import { DrippayLogo } from "@/components/ui/logo";
import { formatUsdc, timeRemaining, streamProgress, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import { DRIPLY_ABI } from "@/lib/abi";
import { DRIPLY_CONTRACT_ADDRESS } from "@/lib/wagmi";

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
    if (txHash && !isConfirming) { toast.success("Done!"); onAction(); }
  }, [txHash, isConfirming]);

  return (
    <Card className="bg-[#0d0d0d] border border-white/10 hover:border-white/20 transition-colors rounded-2xl">
      <CardContent className="p-6">
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
              <button onClick={() => { writeContract({ address: DRIPLY_CONTRACT_ADDRESS, abi: DRIPLY_ABI, functionName: "pauseStream", args: [stream.id] }); toast.info("Pausing…"); }} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors disabled:opacity-50">
                <Pause className="w-3 h-3" /> Pause
              </button>
              <button onClick={() => { if (!confirm("Cancel this stream?")) return; writeContract({ address: DRIPLY_CONTRACT_ADDRESS, abi: DRIPLY_ABI, functionName: "cancelStream", args: [stream.id] }); toast.info("Cancelling…"); }} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                <X className="w-3 h-3" /> Cancel
              </button>
            </>
          )}
          {isSender && stream.status === 1 && (
            <button onClick={() => { writeContract({ address: DRIPLY_CONTRACT_ADDRESS, abi: DRIPLY_ABI, functionName: "resumeStream", args: [stream.id] }); toast.info("Resuming…"); }} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50">
              <Play className="w-3 h-3" /> Resume
            </button>
          )}
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
        allLogs.push(...sentLogs.map(l => ({ ...l, direction: "sent" as const })), ...receivedLogs.map(l => ({ ...l, direction: "received" as const })));
      }

      const seen = new Set<string>();
      const unique = allLogs.filter(l => {
        const id = (l.args?.streamId ?? "").toString();
        if (seen.has(id)) return false;
        seen.add(id); return true;
      });

      const enriched = await Promise.all(unique.map(async (log) => {
        const streamId = log.args?.streamId as bigint;
        const [rawStream, claimable] = await Promise.all([
          publicClient.readContract({ address: DRIPLY_CONTRACT_ADDRESS, abi: DRIPLY_ABI, functionName: "getStream", args: [streamId] }),
          publicClient.readContract({ address: DRIPLY_CONTRACT_ADDRESS, abi: DRIPLY_ABI, functionName: "claimableAmount", args: [streamId] }),
        ]);
        const s = rawStream as any;
        return { id: streamId, sender: s.sender, receiver: s.receiver, totalAmount: s.totalAmount, startTime: s.startTime, endTime: s.endTime, amountClaimed: s.amountClaimed, status: Number(s.status), conditionType: Number(s.conditionType), claimable: claimable as bigint, direction: log.direction } as StreamData;
      }));

      setStreams(enriched.sort((a, b) => Number(b.startTime - a.startTime)));
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
        <DrippayLogo size={48} />
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
          <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-5">
            <p className="text-gray-400 text-xs mb-2">Total streams</p>
            <p className="text-white text-2xl font-bold">{streams.length}</p>
          </div>
          <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-5">
            <p className="text-gray-400 text-xs mb-2">Ready to claim</p>
            <p className="text-white text-2xl font-bold">{formatUsdc(totalClaimable)}</p>
          </div>
          <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-5">
            <p className="text-gray-400 text-xs mb-2">Active streams</p>
            <p className="text-green-400 text-2xl font-bold">{streams.filter(s => s.status === 0).length}</p>
          </div>
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
            <DrippayLogo size={48} />
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
