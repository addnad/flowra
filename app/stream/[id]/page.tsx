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
import { DRIPLY_ABI } from "@/lib/abi";
import { DRIPLY_CONTRACT_ADDRESS, BACKEND_URL } from "@/lib/wagmi";
import { DrippayLogo } from "@/components/ui/logo";
import { ProofSubmission } from "@/components/ui/proof-submission";

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
  } | null>(null);
  const [unlockMessage, setUnlockMessage] = useState("");
  const [unlockPercentage, setUnlockPercentage] = useState(10);
  const [submittingUnlock, setSubmittingUnlock] = useState(false);

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
      toast.success("Emergency unlock request sent to sender.");
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
          address: DRIPLY_CONTRACT_ADDRESS,
          abi: DRIPLY_ABI,
          functionName: "emergencyUnlock",
          args: [streamId, BigInt(unlockRequest.percentage || 100)],
        });
        toast.info(`Approving ${unlockRequest.percentage || 100}% emergency unlock on-chain…`);
      } else {
        toast.success("Request rejected.");
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
        publicClient.readContract({ address: DRIPLY_CONTRACT_ADDRESS, abi: DRIPLY_ABI, functionName: "getStream", args: [streamId] }),
        publicClient.readContract({ address: DRIPLY_CONTRACT_ADDRESS, abi: DRIPLY_ABI, functionName: "claimableAmount", args: [streamId] }),
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

  useEffect(() => { fetchStream(); fetchUnlockRequest(); }, [fetchStream]);
  useEffect(() => { const id = setInterval(() => { fetchStream(); fetchUnlockRequest(); }, 30_000); return () => clearInterval(id); }, [fetchStream]);

  useEffect(() => {
    if (!isSuccess || !txHash) return;
    toast.success("Transaction confirmed!");
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
      toast.error("Could not get your location. Please allow location access.");
      setLocationVerif(v => ({ ...v, checking: false, allowed: false, message: "Location access denied." }));
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/verify-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId: id, receiverAddress: address, userLat: geo.coords.latitude, userLon: geo.coords.longitude, allowedLat: locationInfo.lat, allowedLon: locationInfo.lon, radiusMeters: locationInfo.radius }),
      });
      const data = await res.json();
      setLocationVerif({ allowed: data.allowed, distanceMeters: data.distanceMeters, signature: data.signature, message: data.message, checking: false });
      if (data.allowed) { toast.success("Location verified! You can now claim."); }
      else { toast.error(data.message || "You are outside the allowed zone."); }
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
      writeContract({ address: DRIPLY_CONTRACT_ADDRESS, abi: DRIPLY_ABI, functionName: "claimFunds", args: [streamId, locationVerif.signature as `0x${string}`] });
    } else {
      writeContract({ address: DRIPLY_CONTRACT_ADDRESS, abi: DRIPLY_ABI, functionName: "claimFunds", args: [streamId, "0x"] });
    }
    toast.info("Submitting claim…");
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
              <DrippayLogo size={20} />
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

        <Card className="bg-[#0d0d0d] border border-white/10 mb-4 rounded-2xl">
          <CardContent className="p-6">
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

            {isReceiver && stream.status === 0 && (
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                <p className="text-gray-400 text-xs mb-1">Available to claim now</p>
                <p className="text-white text-3xl font-bold">{formatUsdc(claimable)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {isReceiver && stream.conditionType === 1 && stream.status === 0 && locationInfo && (
          <Card className="bg-[#0d0d0d] border border-violet-500/20 mb-4 rounded-2xl">
            <CardContent className="p-6">
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
              </button>
            </CardContent>
          </Card>
        )}

        {isReceiver && stream.status === 0 && (
          <button onClick={handleClaim} disabled={isLoading || claimable === 0n || (stream.conditionType === 1 && !locationVerif.signature)} className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-base hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2 mb-4">
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isLoading ? "Processing…" : claimable === 0n ? "Nothing to claim yet" : stream.conditionType === 1 && !locationVerif.signature ? "Verify location first" : `Claim ${formatUsdc(claimable)}`}
          </button>
        )}

        {/* Proof of work submission */}
        {(isReceiver || isSender) && stream.conditionType === 0 && stream.status === 0 && (
          <ProofSubmission
            streamId={id}
            isReceiver={!!isReceiver}
            isSender={!!isSender}
            streamStatus={stream.status}
            onApproved={fetchStream}
          />
        )}

        {isSender && (stream.status === 0 || stream.status === 1) && (
          <Card className="bg-[#0d0d0d] border border-white/10 rounded-2xl">
            <CardContent className="p-5">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-4">Sender controls</p>
              <div className="flex gap-3">
                {stream.status === 0 && (
                  <button onClick={() => { writeContract({ address: DRIPLY_CONTRACT_ADDRESS, abi: DRIPLY_ABI, functionName: "pauseStream", args: [streamId] }); toast.info("Pausing…"); }} disabled={isLoading} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 transition-colors disabled:opacity-50">
                    <Pause className="w-4 h-4" /> Pause
                  </button>
                )}
                {stream.status === 1 && (
                  <button onClick={() => { writeContract({ address: DRIPLY_CONTRACT_ADDRESS, abi: DRIPLY_ABI, functionName: "resumeStream", args: [streamId] }); toast.info("Resuming…"); }} disabled={isLoading} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50">
                    <Play className="w-4 h-4" /> Resume
                  </button>
                )}
                <button onClick={() => { if (!confirm("Cancel this stream?")) return; writeContract({ address: DRIPLY_CONTRACT_ADDRESS, abi: DRIPLY_ABI, functionName: "cancelStream", args: [streamId] }); toast.info("Cancelling…"); }} disabled={isLoading} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-3 text-center">Cancelling sends unlocked funds to receiver and refunds you the rest.</p>
            </CardContent>
          </Card>
        )}

        {/* Emergency unlock request — sender view */}
        {isSender && unlockRequest && unlockRequest.status === "pending" && (
          <Card className="bg-[#0d0d0d] border border-orange-500/20 mt-4 rounded-2xl">
            <CardContent className="p-5">
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
            </CardContent>
          </Card>
        )}

        {/* Emergency unlock request — receiver view */}
        {isReceiver && stream.status === 0 && (
          <Card className="bg-[#0d0d0d] border border-white/10 mt-4 rounded-2xl">
            <CardContent className="p-5">
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
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
