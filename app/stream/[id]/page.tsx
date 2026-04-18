"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { decodeAbiParameters, parseAbiParameters } from "viem";
import { toast } from "sonner";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MapPin, Clock, Pause, Play, X, CheckCircle2, XCircle, Loader2, ArrowLeft, RefreshCw, Share2, Navigation } from "lucide-react";
import { formatUsdc, timeRemaining, streamProgress, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import { FLOWRA_ABI } from "@/lib/abi";
import { FLOWRA_CONTRACT_ADDRESS, BACKEND_URL } from "@/lib/wagmi";
import { FlowraLogo } from "@/components/ui/logo";
import { ProofSubmission } from "@/components/ui/proof-submission";
import { PresenceTimer } from "@/components/ui/presence-timer";
import { StepProgress } from "@/components/ui/step-progress";

interface StreamData {
  id: bigint;
  sender: string;
  receiver: string;
  totalAmount: bigint;
  startTime: bigint;
  endTime: bigint;
  interval: bigint;
  amountClaimed: bigint;
  status: number;
  conditionType: number;
  conditionData: string;
}

function decodeLocationCondition(data: string) {
  try {
    const [latRaw, lonRaw, radiusRaw] = decodeAbiParameters(
      parseAbiParameters("int256 lat, int256 lon, uint256 radius"),
      data as `0x${string}`
    );
    return { lat: Number(latRaw) / 1e6, lon: Number(lonRaw) / 1e6, radius: Number(radiusRaw) };
  } catch { return null; }
}

export default function StreamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const streamId = BigInt(id);
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [stream, setStream] = useState<StreamData | null>(null);
  const [claimable, setClaimable] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);
  const [streamMeta, setStreamMeta] = useState<{ conditionMode: string; proofType: string; proofInstructions: string } | null>(null);
  const [locationInfo, setLocationInfo] = useState<{ lat: number; lon: number; radius: number } | null>(null);
  const [locationVerif, setLocationVerif] = useState({ allowed: null as boolean | null, distanceMeters: null as number | null, signature: null as string | null, message: "", checking: false });

  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const isLoading = isPending || isConfirming;

  const [unlockRequest, setUnlockRequest] = useState<{
    status: "pending" | "approved" | "rejected";
    message: string;
    timestamp: number;
    receiverAddress: string;
    percentage?: number;
  } | null>(null);
  const [unlockMessage, setUnlockMessage] = useState("");
  const [unlockPercentage, setUnlockPercentage] = useState(10);
  const [submittingUnlock, setSubmittingUnlock] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<{ timeInZoneMs: number; requiredDurationMs: number; remainingMs: number; met: boolean } | null>(null);
  const [stepData, setStepData] = useState<{ id: string; status: string; completedAt: number | null }[] | null>(null);

  async function fetchStreamMeta() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/stream-meta/${id}`);
      const data = await res.json();
      if (data.meta) setStreamMeta(data.meta);
    } catch (e) { console.error(e); }
  }

  async function fetchUnlockRequest() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/unlock-request/${id}`);
      const data = await res.json();
      setUnlockRequest(data.request);
    } catch (e) { console.error(e); }
  }

  async function submitUnlockRequest() {
    if (!address) return;
    setSubmittingUnlock(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/unlock-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId: id, receiverAddress: address, message: unlockMessage, percentage: unlockPercentage }),
      });
      const data = await res.json();
      setUnlockRequest(data.request);
      toast.success("Flowra has sent your request to the sender.");
    } catch (e) {
      toast.error("Failed to send request.");
    } finally {
      setSubmittingUnlock(false);
    }
  }

  async function respondToUnlockRequest(action: "approve" | "reject") {
    try {
      await fetch(`${BACKEND_URL}/api/unlock-request/${id}/${action}`, { method: "POST" });
      if (action === "approve" && unlockRequest) {
        writeContract({
          address: FLOWRA_CONTRACT_ADDRESS,
          abi: FLOWRA_ABI,
          functionName: "emergencyUnlock",
          args: [streamId, BigInt(unlockRequest.percentage || 100)],
        });
        toast.info(`Approving ${unlockRequest.percentage || 100}% emergency unlock on-chain…`);
      } else {
        toast.info("Flowra has rejected the emergency request.");
        fetchUnlockRequest();
      }
    } catch (e) {
      toast.error("Failed to respond.");
    }
  }

  const fetchStream = useCallback(async () => {
    if (!publicClient) return;
    try {
      const [rawStream, rawClaimable] = await Promise.all([
        publicClient.readContract({ address: FLOWRA_CONTRACT_ADDRESS, abi: FLOWRA_ABI, functionName: "getStream", args: [streamId] }),
        publicClient.readContract({ address: FLOWRA_CONTRACT_ADDRESS, abi: FLOWRA_ABI, functionName: "claimableAmount", args: [streamId] }),
      ]);
      const s = rawStream as any;
      setStream({ id: streamId, sender: s.sender, receiver: s.receiver, totalAmount: s.totalAmount, startTime: s.startTime, endTime: s.endTime, interval: s.interval, amountClaimed: s.amountClaimed, status: Number(s.status), conditionType: Number(s.conditionType), conditionData: s.conditionData });
      setClaimable(rawClaimable as bigint);
      if (Number(s.conditionType) === 1) setLocationInfo(decodeLocationCondition(s.conditionData));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load stream.");
    } finally { setLoading(false); }
  }, [publicClient, streamId]);

  useEffect(() => { fetchStream(); fetchUnlockRequest(); fetchStreamMeta(); }, [fetchStream]);
  useEffect(() => { const id = setInterval(() => { fetchStream(); fetchUnlockRequest(); }, 30_000); return () => clearInterval(id); }, [fetchStream]);

  useEffect(() => {
    if (!isSuccess || !txHash) return;
    toast.success("Flowra released your funds.");
    reset();
    fetchStream();
    setLocationVerif({ allowed: null, distanceMeters: null, signature: null, message: "", checking: false });
  }, [isSuccess]);

  async function verifyLocation() {
    if (!locationInfo || !address) return;
    setLocationVerif(v => ({ ...v, checking: true, allowed: null, signature: null }));
    const geo = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 10_000 });
    });
    if (!geo) {
      toast.error("Flowra needs your location. Please allow access and try again.");
      setLocationVerif(v => ({ ...v, checking: false, allowed: false, message: "Location access denied." }));
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/verify-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId: id, receiverAddress: address, userLat: geo.coords.latitude, userLon: geo.coords.longitude, allowedLat: locationInfo.lat, allowedLon: locationInfo.lon, radiusMeters: locationInfo.radius, requiredDurationMs: (locationInfo as any).requiredDurationMs || 0 }),
      });
      const data = await res.json();
      setLocationVerif({ allowed: data.allowed, distanceMeters: data.distanceMeters, signature: data.signature, message: data.message, checking: false });
      if (data.presenceStatus) setPresenceStatus(data.presenceStatus);
      if (data.steps) setStepData(data.steps);
      if (data.allowed) { toast.success("Flowra verified your location. Funds can now be released."); }
      else { toast.error(data.message || "Flowra couldn't verify your location. Move closer to the required area."); }
    } catch (err) {
      console.error(err);
      toast.error("Location verification failed. Is the backend running?");
      setLocationVerif(v => ({ ...v, checking: false, allowed: false, message: "Backend unreachable." }));
    }
  }

  async function handleClaim() {
    if (!stream || !isConnected) return;
    if (stream.conditionType === 1) {
      if (!locationVerif.signature) { toast.error("Verify your location first."); return; }
      writeContract({ address: FLOWRA_CONTRACT_ADDRESS, abi: FLOWRA_ABI, functionName: "claimFunds", args: [streamId, locationVerif.signature as `0x${string}`] });
    } else {
      writeContract({ address: FLOWRA_CONTRACT_ADDRESS, abi: FLOWRA_ABI, functionName: "claimFunds", args: [streamId, "0x"] });
    }
    toast.info("Flowra is processing your claim…");
  }

  const isSender   = stream && address && stream.sender.toLowerCase()   === address.toLowerCase();
  const isReceiver = stream && address && stream.receiver.toLowerCase() === address.toLowerCase();
  const progress   = stream ? streamProgress(stream.startTime, stream.endTime) : 0;
  const remaining  = stream ? stream.totalAmount - stream.amountClaimed : 0n;

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Navbar />
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
    </div>
  );

  if (!stream || stream.sender === "0x0000000000000000000000000000000000000000") return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <Navbar />
      <XCircle className="w-12 h-12 text-red-400" />
      <p className="text-white text-lg">Stream not found</p>
      <a href="/dashboard" className="text-blue-400 text-sm">← Back to dashboard</a>
    </div>
  );

  return (
    <div className="min-h-screen bg-black pt-24 pb-16 text-white">
      <Navbar />
      <div className="container mx-auto px-4 max-w-2xl">

        <a href="/dashboard" className="flex items-center gap-2 text-gray-500 text-sm mb-6 hover:text-gray-300 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </a>

        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FlowraLogo size={20} />
              <h1 className="text-2xl font-bold text-white">Stream #{id}</h1>
            </div>
            <span className={`text-sm font-medium ${STATUS_COLORS[stream.status]}`}>{STATUS_LABELS[stream.status]}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const url = `${window.location.origin}/stream/${id}`;
                navigator.clipboard.writeText(url);
                toast.success("Stream link copied to clipboard!");
              }}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors"
              title="Copy share link"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button onClick={fetchStream} className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="border border-blue-500/20 mb-4 rounded-2xl overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 600 300" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="40" y="80" width="28" height="120" rx="6" fill="#3b82f6" opacity="0.3"/>
          <rect x="80" y="60" width="28" height="140" rx="6" fill="#3b82f6" opacity="0.4"/>
          <rect x="120" y="40" width="28" height="160" rx="6" fill="#3b82f6" opacity="0.5"/>
          <rect x="160" y="55" width="28" height="145" rx="6" fill="#3b82f6" opacity="0.4"/>
          <rect x="200" y="30" width="28" height="170" rx="6" fill="#3b82f6" opacity="0.6"/>
          <path d="M320 240 L370 140 L420 180 L470 100 L520 130 L560 80" stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="370" cy="140" r="5" fill="#3b82f6"/>
          <circle cx="470" cy="100" r="5" fill="#3b82f6"/>
          <circle cx="560" cy="80" r="5" fill="#3b82f6"/>
        </svg>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/70 to-black/90"/>
      </div>
          <div className="p-6 relative">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center"><p className="text-gray-500 text-xs mb-1">Total</p><p className="text-white text-xl font-bold">{formatUsdc(stream.totalAmount)}</p></div>
              <div className="text-center"><p className="text-gray-500 text-xs mb-1">Claimed</p><p className="text-white text-xl font-bold">{formatUsdc(stream.amountClaimed)}</p></div>
              <div className="text-center"><p className="text-gray-500 text-xs mb-1">Remaining</p><p className="text-gray-300 text-xl font-bold">{formatUsdc(remaining)}</p></div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>{progress}% elapsed</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeRemaining(stream.endTime)}</span>
              </div>
              <Progress value={progress} className="h-2 bg-white/10" />
            </div>

            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Sender</span><span className={`font-mono text-xs ${isSender ? "text-blue-400" : "text-gray-300"}`}>{stream.sender.slice(0, 10)}…{stream.sender.slice(-8)}{isSender && " (you)"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Receiver</span><span className={`font-mono text-xs ${isReceiver ? "text-green-400" : "text-gray-300"}`}>{stream.receiver.slice(0, 10)}…{stream.receiver.slice(-8)}{isReceiver && " (you)"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Interval</span><span className="text-gray-300">{Number(stream.interval) === 86400 ? "Daily" : Number(stream.interval) === 604800 ? "Weekly" : `Every ${stream.interval}s`}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Condition</span><span className={stream.conditionType === 1 ? "text-violet-400" : "text-gray-400"}>{stream.conditionType === 1 ? "📍 Location-gated" : "None"}</span></div>
            </div>

            {stepData && stepData.length > 0 && <StepProgress steps={stepData as any} />}

        {isReceiver && stream.status === 0 && (
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                <p className="text-gray-400 text-xs mb-1">Available to claim now</p>
                <p className="text-white text-3xl font-bold">{formatUsdc(claimable)}</p>
              </div>
            )}
          </div>
        </div>

        {isReceiver && stream.conditionType === 1 && stream.status === 0 && locationInfo && (
          <div className="border border-violet-500/20 mb-4 rounded-2xl overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 600 250" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="300" cy="125" r="180" stroke="#a855f7" strokeWidth="1" strokeDasharray="4 8"/>
          <circle cx="300" cy="125" r="120" stroke="#a855f7" strokeWidth="1" strokeDasharray="4 8"/>
          <circle cx="300" cy="125" r="60" stroke="#a855f7" strokeWidth="1"/>
          <circle cx="300" cy="125" r="8" fill="#a855f7"/>
          <line x1="300" y1="20" x2="300" y2="230" stroke="#a855f7" strokeWidth="0.5" strokeDasharray="4 8"/>
          <line x1="80" y1="125" x2="520" y2="125" stroke="#a855f7" strokeWidth="0.5" strokeDasharray="4 8"/>
          <path d="M300 85 C300 85 328 115 328 132 C328 149 315 160 300 160 C285 160 272 149 272 132 C272 115 300 85 300 85Z" fill="#a855f7" opacity="0.6"/>
          <circle cx="300" cy="129" r="10" fill="white" opacity="0.7"/>
        </svg>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/70 to-black/90"/>
      </div>
            <div className="p-6 relative">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-violet-400" />
                <h2 className="text-white font-semibold">Location Verification</h2>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                <div className="bg-white/5 rounded-lg p-3 text-center"><p className="text-gray-500 mb-1">Zone</p><p className="text-violet-300 font-mono">{locationInfo.lat.toFixed(4)}, {locationInfo.lon.toFixed(4)}</p></div>
                <div className="bg-white/5 rounded-lg p-3 text-center"><p className="text-gray-500 mb-1">Radius</p><p className="text-violet-300">{locationInfo.radius}m</p></div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-gray-500 mb-1">Status</p>
                  {locationVerif.allowed === null && <p className="text-gray-400">Not checked</p>}
                  {locationVerif.allowed === true  && <p className="text-green-400 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> Inside</p>}
                  {locationVerif.allowed === false && <p className="text-red-400 flex items-center justify-center gap-1"><XCircle className="w-3 h-3" /> Outside</p>}
                </div>
              </div>
              {locationVerif.distanceMeters !== null && (
                <p className="text-xs text-gray-400 mb-4">You are <strong className={locationVerif.allowed ? "text-green-400" : "text-red-400"}>{locationVerif.distanceMeters}m</strong> from the allowed zone.</p>
              )}
              <button onClick={verifyLocation} disabled={locationVerif.checking} className="w-full py-3 rounded-xl bg-violet-600/80 text-white text-sm font-medium hover:bg-violet-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {locationVerif.checking ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking location…</> : <><Navigation className="w-4 h-4" /> Verify My Location</>}
              {presenceStatus && <PresenceTimer timeInZoneMs={presenceStatus.timeInZoneMs} requiredDurationMs={presenceStatus.requiredDurationMs} />}
              </button>
            </div>
          </div>
        )}

        {stepData && stepData.length > 0 && <StepProgress steps={stepData as any} />}

        {isReceiver && stream.status === 0 && (
          <button onClick={handleClaim} disabled={isLoading || claimable === 0n || (stream.conditionType === 1 && !locationVerif.signature)} className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2 mb-4">
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isLoading ? "Processing…" : claimable === 0n ? "Flowra has not unlocked funds yet" : stream.conditionType === 1 && !locationVerif.signature ? "Ask Flowra to verify your location first" : `Flowra: Claim ${formatUsdc(claimable)}`}
          </button>
        )}

        {/* Proof of work submission */}
        {(isReceiver || isSender) && stream.conditionType === 0 && stream.status === 0 && streamMeta?.conditionMode === "proof" && (
          <ProofSubmission
            streamId={id}
            isReceiver={!!isReceiver}
            isSender={!!isSender}
            streamStatus={stream.status}
            onApproved={fetchStream}
            receiverAddress={stream.receiver}
          />
        )}

        {isSender && (stream.status === 0 || stream.status === 1) && (
          <div className="border border-orange-500/20 rounded-2xl overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 600 150" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="60" y="35" width="70" height="70" rx="16" fill="#f97316" opacity="0.5"/>
          <rect x="80" y="53" width="10" height="34" rx="3" fill="white"/>
          <rect x="100" y="53" width="10" height="34" rx="3" fill="white"/>
          <rect x="180" y="35" width="70" height="70" rx="16" fill="#f97316" opacity="0.3"/>
          <polygon points="198,50 198,88 228,69" fill="white"/>
          <rect x="300" y="35" width="70" height="70" rx="16" fill="#ef4444" opacity="0.4"/>
          <line x1="318" y1="50" x2="352" y2="87" stroke="white" strokeWidth="5" strokeLinecap="round"/>
          <line x1="352" y1="50" x2="318" y2="87" stroke="white" strokeWidth="5" strokeLinecap="round"/>
          <path d="M430 100 Q480 40 540 70" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4"/>
        </svg>
        <div className="absolute inset-0 bg-gradient-to-br from-orange-950/70 to-black/90"/>
      </div>
            <div className="p-5 relative">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-4">Sender controls</p>
              <div className="flex gap-3">
                {stream.status === 0 && (
                  <button onClick={() => { writeContract({ address: FLOWRA_CONTRACT_ADDRESS, abi: FLOWRA_ABI, functionName: "pauseStream", args: [streamId] }); toast.info("Flowra has paused this payment stream."); }} disabled={isLoading} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 transition-colors disabled:opacity-50">
                    <Pause className="w-4 h-4" /> Pause
                  </button>
                )}
                {stream.status === 1 && (
                  <button onClick={() => { writeContract({ address: FLOWRA_CONTRACT_ADDRESS, abi: FLOWRA_ABI, functionName: "resumeStream", args: [streamId] }); toast.info("Flowra resumed the payment stream."); }} disabled={isLoading} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50">
                    <Play className="w-4 h-4" /> Resume
                  </button>
                )}
                <button onClick={() => { if (!confirm("Cancel this stream?")) return; writeContract({ address: FLOWRA_CONTRACT_ADDRESS, abi: FLOWRA_ABI, functionName: "cancelStream", args: [streamId] }); toast.info("Flowra is settling this stream…"); }} disabled={isLoading} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-3 text-center">Cancelling sends unlocked funds to receiver and refunds you the rest.</p>
            </div>
          </div>
        )}

        {/* Emergency unlock request — sender view */}
        {isSender && unlockRequest && unlockRequest.status === "pending" && (
          <div className="border border-orange-500/20 mt-4 rounded-2xl overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 600 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="300,25 348,115 252,115" stroke="#f97316" strokeWidth="2" fill="#f97316" fillOpacity="0.15"/>
          <line x1="300" y1="52" x2="300" y2="88" stroke="#f97316" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="300" cy="101" r="4" fill="#f97316"/>
          <circle cx="300" cy="150" r="55" stroke="#f97316" strokeWidth="1" strokeDasharray="4 4" opacity="0.4"/>
          <circle cx="300" cy="150" r="85" stroke="#f97316" strokeWidth="0.5" strokeDasharray="4 8" opacity="0.25"/>
          <circle cx="300" cy="150" r="115" stroke="#f97316" strokeWidth="0.5" strokeDasharray="4 8" opacity="0.15"/>
        </svg>
        <div className="absolute inset-0 bg-gradient-to-br from-orange-950/70 to-black/90"/>
      </div>
            <div className="p-5 relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <p className="text-orange-400 text-sm font-semibold">Emergency Unlock Request</p>
              </div>
              <p className="text-gray-300 text-sm mb-1">The receiver is requesting early access to <strong className="text-orange-400">{unlockRequest.percentage || 100}%</strong> of locked funds.</p>
              {unlockRequest.message && (
                <p className="text-gray-500 text-xs mb-4 p-3 bg-white/5 rounded-xl">"{unlockRequest.message}"</p>
              )}
              <div className="flex gap-3">
                <button onClick={() => respondToUnlockRequest("approve")} className="flex-1 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors">
                  Approve {unlockRequest.percentage || 100}% Release
                </button>
                <button onClick={() => respondToUnlockRequest("reject")} className="flex-1 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors">
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Emergency unlock request — receiver view */}
        {stepData && stepData.length > 0 && <StepProgress steps={stepData as any} />}

        {isReceiver && stream.status === 0 && (
          <div className="border border-indigo-500/20 mt-4 rounded-2xl overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 600 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="480" cy="100" r="80" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 8"/>
          <circle cx="480" cy="100" r="50" stroke="#6366f1" strokeWidth="1" strokeDasharray="4 4"/>
          <path d="M455 95 L455 80 C455 64 505 64 505 80 L505 95" stroke="#6366f1" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <rect x="448" y="95" width="64" height="50" rx="8" fill="#6366f1" opacity="0.4"/>
          <circle cx="480" cy="120" r="7" fill="white" opacity="0.6"/>
          <line x1="480" y1="127" x2="480" y2="136" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/>
          <path d="M80 60 Q160 100 240 60 Q320 20 400 60" stroke="#6366f1" strokeWidth="1" strokeDasharray="3 5" opacity="0.3"/>
        </svg>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/70 to-black/90"/>
      </div>
            <div className="p-5 relative">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-4">Emergency Unlock</p>

              {!unlockRequest && (
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm">Need early access to your locked funds? Send a request to the sender.</p>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                      <span>Amount to request</span>
                      <span className="text-orange-400 font-medium">{unlockPercentage}% of locked funds</span>
                    </div>
                    <input
                      type="range" min={1} max={100} step={1} value={unlockPercentage}
                      onChange={e => setUnlockPercentage(parseInt(e.target.value))}
                      className="w-full accent-orange-500"
                    />
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>1%</span><span>100%</span>
                    </div>
                  </div>
                  <textarea
                    value={unlockMessage}
                    onChange={e => setUnlockMessage(e.target.value)}
                    placeholder="Explain why you need early access (optional)..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
                  />
                  <button onClick={submitUnlockRequest} disabled={submittingUnlock} className="w-full py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {submittingUnlock && <Loader2 className="w-4 h-4 animate-spin" />}
                    Request {unlockPercentage}% Emergency Unlock
                  </button>
                </div>
              )}

              {unlockRequest?.status === "pending" && (
                <div className="text-center py-4">
                  <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse mx-auto mb-3" />
                  <p className="text-orange-400 text-sm font-medium">Request sent — waiting for sender approval</p>
                  <p className="text-gray-500 text-xs mt-1">The sender will be notified to approve or reject.</p>
                </div>
              )}

              {unlockRequest?.status === "approved" && (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-3" />
                  <p className="text-green-400 text-sm font-medium">Unlock approved by sender</p>
                  <p className="text-gray-500 text-xs mt-1">The sender will release the funds shortly.</p>
                </div>
              )}

              {unlockRequest?.status === "rejected" && (
                <div className="text-center py-4">
                  <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                  <p className="text-red-400 text-sm font-medium">Request rejected by sender</p>
                  <p className="text-gray-500 text-xs mt-1">Funds will continue streaming as scheduled.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
