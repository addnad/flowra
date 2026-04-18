"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { toast } from "sonner";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Droplets, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import { parseUsdc, encodeLocationCondition, INTERVAL_PRESETS, DURATION_PRESETS } from "@/lib/utils";
import { FLOWRA_ABI, ERC20_ABI } from "@/lib/abi";
import { FLOWRA_CONTRACT_ADDRESS, USDC_ADDRESS, BACKEND_URL } from "@/lib/wagmi";
import { ConditionSelector, type ConditionMode } from "@/components/ui/condition-selector";

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-white font-medium mb-2">{children}</p>;
}

function FieldInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 transition-colors" />
  );
}

function ToggleGroup({ options, value, onChange }: { options: { label: string; value: number }[]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o.label} type="button" onClick={() => onChange(o.value)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            value === o.value
              ? "bg-blue-600 text-white"
              : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function CreateStreamPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [receiver, setReceiver] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [durationPreset, setDurationPreset] = useState(2592000);
  const [customDuration, setCustomDuration] = useState("");
  const [intervalPreset, setIntervalPreset] = useState(86400);
  const [customInterval, setCustomInterval] = useState("");

  const [conditionMode, setConditionMode] = useState<ConditionMode>("none");
  const [proofType, setProofType] = useState<"link" | "image">("link");
  const [proofInstructions, setProofInstructions] = useState("");
  const [locationLat, setLocationLat] = useState(0);
  const [locationLon, setLocationLon] = useState(0);
  const [locationRadius, setLocationRadius] = useState(200);
  const [locationLabel, setLocationLabel] = useState("");

  const [step, setStep] = useState<"approve" | "create" | "done">("approve");
  const [checkingAllowance, setCheckingAllowance] = useState(false);

  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const duration = durationPreset === 0 ? parseInt(customDuration || "0") * 86400 : durationPreset;
  const interval = intervalPreset === 0 ? parseInt(customInterval || "0") * 3600 : intervalPreset;
  let rawAmount = 0n;
  try { rawAmount = parseUsdc(amountUsd); } catch {}

  useEffect(() => {
    async function checkAllowance() {
      if (!address || !publicClient || rawAmount === 0n) return;
      setCheckingAllowance(true);
      try {
        const result = await publicClient.readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "allowance", args: [address, FLOWRA_CONTRACT_ADDRESS] });
        setStep((result as bigint) >= rawAmount ? "create" : "approve");
      } catch (e) { console.error(e); }
      finally { setCheckingAllowance(false); }
    }
    checkAllowance();
  }, [address, amountUsd, publicClient]);

  useEffect(() => {
    if (!isSuccess || !txHash) return;
    if (step === "approve") {
      toast.success("USDC approved. Flowra is ready.");
      setStep("create");
      reset();
    } else if (step === "create") {
      toast.success("Flowra is now managing this payment.");
      saveStreamMeta();
      setStep("done");
    }
  }, [isSuccess]);

  async function saveStreamMeta() {
    if (!publicClient || !txHash || !address) return;
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
      // StreamCreated event — streamId is the first indexed topic (topics[1])
      const STREAM_CREATED_TOPIC = "0xa8b65715cb7f20e6736c0c2219f0fdea26e05b6a2d2297ecab23c6cb243daf34";
      const log = receipt?.logs?.find(l => l.topics?.[0]?.toLowerCase() === STREAM_CREATED_TOPIC);
      const streamId = log?.topics?.[1] ? BigInt(log.topics[1]).toString() : "0";

      // Save stream meta if proof condition
      if (conditionMode === "proof") {
        await fetch(`${BACKEND_URL}/api/stream-meta`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ streamId, conditionMode, proofType, proofInstructions }),
        });
      }

      // Always register stream ID for both sender and receiver wallets
      await fetch(`${BACKEND_URL}/api/registry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId, senderAddress: address, receiverAddress: receiver }),
      });

      console.log("Stream registered for ID:", streamId);
    } catch (e) { console.error("Failed to save stream meta:", e); }
  }

  function handleApprove() {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    writeContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve", args: [FLOWRA_CONTRACT_ADDRESS, rawAmount] });
    toast.info("Approving USDC…");
  }

  function handleCreate() {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    if (!receiver || !receiver.startsWith("0x")) { toast.error("Enter a valid receiver address"); return; }
    if (rawAmount === 0n) { toast.error("Enter an amount"); return; }
    if (duration === 0 || interval === 0) { toast.error("Enter valid duration and interval"); return; }
    if (interval > duration) { toast.error("Interval cannot exceed duration"); return; }

    let conditionType = 0;
    let conditionData: `0x${string}` = "0x";

    if (conditionMode === "location") {
      if (!locationLat || !locationLon) { toast.error("Pick a location on the map first"); return; }
      conditionType = 1;
      conditionData = encodeLocationCondition(locationLat, locationLon, locationRadius);
    }

    if (conditionMode === "proof") {
      if (!proofInstructions.trim()) { toast.error("Please add instructions for the receiver"); return; }
      // Store proof type and instructions in backend after stream created
      sessionStorage.setItem(`proof_${Date.now()}`, JSON.stringify({ proofType, proofInstructions }));
    }

    writeContract({
      address: FLOWRA_CONTRACT_ADDRESS,
      abi: FLOWRA_ABI,
      functionName: "createStream",
      args: [receiver as `0x${string}`, USDC_ADDRESS, rawAmount, BigInt(duration), BigInt(interval), conditionType, conditionData],
    });
    toast.info("Assigning Flowra to your payment…");
  }

  const isLoading = isPending || isConfirming || checkingAllowance;

  function formatPerInterval() {
    if (rawAmount === 0n || duration === 0 || interval === 0) return "$0.00";
    const totalIntervals = duration / interval;
    const perInterval = Number(rawAmount) / totalIntervals / 1e6;
    return `$${perInterval.toFixed(2)}`;
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 px-4">
        <Navbar />
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Flowra is on it.</h1>
          <p className="text-gray-400 mb-8">${amountUsd} USDC is now streaming over {Math.round(duration / 86400)} days.</p>
          <div className="flex gap-3 justify-center">
            <a href="/dashboard" className="px-6 py-3 rounded-full bg-blue-600 text-white text-sm font-medium hover:opacity-90 transition-opacity">View Dashboard</a>
            <button onClick={() => { setStep("approve"); reset(); setAmountUsd(""); setReceiver(""); setConditionMode("none"); }} className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">Create Another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-16">
      <Navbar />
      <div className="container mx-auto px-4 max-w-2xl">

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Create a Stream</h1>
          </div>
          <p className="text-gray-400">Money flows automatically. You stay in control.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-8 text-sm">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium ${step === "approve" ? "bg-blue-600 text-white" : "bg-white/5 text-green-400"}`}>
            {step !== "approve" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">1</span>}
            Approve USDC
          </div>
          <ChevronRight className="text-gray-600 w-4 h-4" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium ${step === "create" ? "bg-blue-600 text-white" : "bg-white/5 text-gray-500"}`}>
            <span className="text-xs font-bold">2</span>
            Create Stream
          </div>
        </div>

        {/* Stream Templates */}
        <div className="mb-6">
          <p className="text-sm text-white font-medium mb-3">Quick templates</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

            {/* Kid's Allowance */}
            <button type="button" onClick={() => { setAmountUsd("50"); setDurationPreset(2592000); setIntervalPreset(86400); }}
              className="p-3 rounded-xl border border-pink-500/20 text-left transition-all relative overflow-hidden hover:border-pink-500/40 hover:scale-[1.02]">
              <div className="absolute inset-0 bg-gradient-to-b from-pink-950/60 to-black/80" />
              <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="80" cy="60" r="30" stroke="#ec4899" strokeWidth="1.5"/>
                <circle cx="80" cy="60" r="4" fill="#ec4899"/>
                <rect x="140" y="40" width="20" height="40" rx="4" fill="#ec4899" opacity="0.4"/>
                <rect x="170" y="30" width="20" height="50" rx="4" fill="#ec4899" opacity="0.6"/>
                <rect x="200" y="20" width="20" height="60" rx="4" fill="#ec4899" opacity="0.8"/>
                <rect x="230" y="35" width="20" height="45" rx="4" fill="#ec4899" opacity="0.5"/>
                <rect x="260" y="45" width="20" height="35" rx="4" fill="#ec4899" opacity="0.3"/>
                <line x1="320" y1="30" x2="380" y2="30" stroke="#ec4899" strokeWidth="1" strokeDasharray="4 4"/>
                <line x1="320" y1="50" x2="360" y2="50" stroke="#ec4899" strokeWidth="1" strokeDasharray="4 4"/>
                <line x1="320" y1="70" x2="370" y2="70" stroke="#ec4899" strokeWidth="1" strokeDasharray="4 4"/>
              </svg>
              <p className="relative text-white text-xs font-medium">👶 Kid&apos;s Allowance</p>
              <p className="relative text-pink-300/60 text-xs mt-0.5">Daily pocket money for 30 days</p>
            </button>

            {/* Freelance Pay */}
            <button type="button" onClick={() => { setAmountUsd("500"); setDurationPreset(604800); setIntervalPreset(604800); }}
              className="p-3 rounded-xl border border-blue-500/20 text-left transition-all relative overflow-hidden hover:border-blue-500/40 hover:scale-[1.02]">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-950/60 to-black/80" />
              <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="40" y="30" width="80" height="60" rx="8" stroke="#3b82f6" strokeWidth="1.5" fill="#3b82f6" fillOpacity="0.1"/>
                <line x1="55" y1="50" x2="105" y2="50" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
                <line x1="55" y1="63" x2="90" y2="63" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="55" y1="75" x2="95" y2="75" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M180 60 L230 60 M220 50 L230 60 L220 70" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="300" cy="60" r="35" stroke="#3b82f6" strokeWidth="1.5" fill="#3b82f6" fillOpacity="0.1"/>
                <path d="M300 45 C293 45 287 51 287 58 C287 65 293 68 300 68 C307 68 313 71 313 78 C313 85 307 91 300 91 M300 40 L300 45 M300 91 L300 96" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="relative text-white text-xs font-medium">💼 Freelance Pay</p>
              <p className="relative text-blue-300/60 text-xs mt-0.5">Weekly freelance payment</p>
            </button>

            {/* Field Worker */}
            <button type="button" onClick={() => { setAmountUsd("200"); setDurationPreset(2592000); setIntervalPreset(86400); }}
              className="p-3 rounded-xl border border-orange-500/20 text-left transition-all relative overflow-hidden hover:border-orange-500/40 hover:scale-[1.02]">
              <div className="absolute inset-0 bg-gradient-to-b from-orange-950/60 to-black/80" />
              <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="200" cy="35" r="60" stroke="#f97316" strokeWidth="0.5" strokeDasharray="3 6" opacity="0.5"/>
                <path d="M60 90 Q100 40 140 70 Q180 100 220 50 Q260 0 300 60 Q330 100 360 80" stroke="#f97316" strokeWidth="2" fill="none" strokeLinecap="round"/>
                <circle cx="140" cy="70" r="4" fill="#f97316" opacity="0.8"/>
                <circle cx="220" cy="50" r="4" fill="#f97316" opacity="0.8"/>
                <circle cx="300" cy="60" r="4" fill="#f97316" opacity="0.8"/>
                <line x1="60" y1="100" x2="360" y2="100" stroke="#f97316" strokeWidth="1" opacity="0.3"/>
              </svg>
              <p className="relative text-white text-xs font-medium">👷 Field Worker</p>
              <p className="relative text-orange-300/60 text-xs mt-0.5">Daily field worker pay</p>
            </button>

            {/* Tuition Stream */}
            <button type="button" onClick={() => { setAmountUsd("300"); setDurationPreset(7776000); setIntervalPreset(2592000); }}
              className="p-3 rounded-xl border border-green-500/20 text-left transition-all relative overflow-hidden hover:border-green-500/40 hover:scale-[1.02]">
              <div className="absolute inset-0 bg-gradient-to-b from-green-950/60 to-black/80" />
              <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M200 20 L320 55 L200 90 L80 55 Z" stroke="#10b981" strokeWidth="1.5" fill="#10b981" fillOpacity="0.1"/>
                <path d="M320 55 L320 95" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M310 85 L320 95 L330 85" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="150" y="88" width="100" height="18" rx="4" fill="#10b981" opacity="0.3"/>
                <line x1="160" y1="97" x2="240" y2="97" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="60" cy="55" r="15" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>
                <circle cx="340" cy="55" r="15" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>
              </svg>
              <p className="relative text-white text-xs font-medium">🎓 Tuition Stream</p>
              <p className="relative text-green-300/60 text-xs mt-0.5">Monthly tuition for 90 days</p>
            </button>

          </div>
        </div>

        <div className="border border-blue-500/20 rounded-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-950/60 to-black/80 pointer-events-none"/>
          <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="30" y="120" width="22" height="180" rx="5" fill="#3b82f6" opacity="0.3"/>
            <rect x="62" y="90" width="22" height="210" rx="5" fill="#3b82f6" opacity="0.4"/>
            <rect x="94" y="60" width="22" height="240" rx="5" fill="#3b82f6" opacity="0.5"/>
            <rect x="126" y="80" width="22" height="220" rx="5" fill="#3b82f6" opacity="0.4"/>
            <rect x="158" y="40" width="22" height="260" rx="5" fill="#3b82f6" opacity="0.6"/>
            <path d="M580 480 L630 360 L670 410 L720 300 L760 340" stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="630" cy="360" r="5" fill="#3b82f6" opacity="0.8"/>
            <circle cx="720" cy="300" r="5" fill="#3b82f6" opacity="0.8"/>
            <circle cx="760" cy="340" r="5" fill="#3b82f6" opacity="0.8"/>
            <circle cx="700" cy="150" r="80" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 8" opacity="0.3"/>
            <circle cx="700" cy="150" r="50" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 4" opacity="0.4"/>
            <circle cx="700" cy="150" r="8" fill="#3b82f6" opacity="0.6"/>
            <path d="M200 300 Q350 200 500 300 Q650 400 800 300" stroke="#3b82f6" strokeWidth="1" fill="none" opacity="0.2"/>
            <path d="M200 330 Q350 230 500 330 Q650 430 800 330" stroke="#3b82f6" strokeWidth="0.5" fill="none" opacity="0.15"/>
          </svg>
          <div className="p-8 space-y-8 relative">

            <div>
              <Label>Receiver wallet address</Label>
              <FieldInput placeholder="0x..." value={receiver} onChange={e => setReceiver(e.target.value)} />
            </div>

            <div>
              <Label>Total amount (USDC)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input type="number" placeholder="100.00" value={amountUsd} onChange={e => setAmountUsd(e.target.value)}
                  className="w-full pl-8 pr-16 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 transition-colors" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium">USDC</span>
              </div>
            </div>

            <div>
              <Label>Stream duration</Label>
              <ToggleGroup options={DURATION_PRESETS.map(p => ({ label: p.label, value: p.value }))} value={durationPreset} onChange={setDurationPreset} />
              {durationPreset === 0 && (
                <div className="mt-3"><FieldInput type="number" placeholder="Number of days (e.g. 7 = 1 week)" value={customDuration} onChange={e => setCustomDuration(e.target.value)} /></div>
              )}
            </div>

            <div>
              <Label>Release frequency</Label>
              <ToggleGroup options={INTERVAL_PRESETS.map(p => ({ label: p.label, value: p.value }))} value={intervalPreset} onChange={setIntervalPreset} />
              {intervalPreset === 0 && (
                <div className="mt-3"><FieldInput type="number" placeholder="e.g. 1 = every hour, 24 = daily..." value={customInterval} onChange={e => setCustomInterval(e.target.value)} /></div>
              )}
            </div>

            <ConditionSelector
              conditionMode={conditionMode}
              setConditionMode={setConditionMode}
              proofType={proofType}
              setProofType={setProofType}
              proofInstructions={proofInstructions}
              setProofInstructions={setProofInstructions}
              onLocationSelect={(lat, lon, radius, label) => {
                setLocationLat(lat);
                setLocationLon(lon);
                setLocationRadius(radius);
                setLocationLabel(label);
              }}
            />

            {rawAmount > 0n && duration > 0 && interval > 0 && (
              <div className="p-4 bg-white/3 border border-white/8 rounded-2xl">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="text-white font-medium">${amountUsd} USDC</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Over</span><span className="text-white">{Math.round(duration / 86400)} days</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Releases</span><span className="text-white">{formatPerInterval()} / {interval === 86400 ? "day" : interval === 604800 ? "week" : `every ${interval/3600}h`}</span></div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Condition</span>
                    <span className="text-white">
                      {conditionMode === "none" ? "None" : conditionMode === "location" ? `📍 ${locationLabel || "Location-gated"}` : `🧾 Proof (${proofType})`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!isConnected ? (
              <div className="text-center py-2 text-gray-400 text-sm">Connect your wallet to continue</div>
            ) : step === "approve" ? (
              <button onClick={handleApprove} disabled={isLoading || rawAmount === 0n}
                className="w-full py-4 rounded-full bg-blue-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLoading ? "Approving…" : `Approve $${amountUsd || "0"} USDC`}
              </button>
            ) : (
              <button onClick={handleCreate} disabled={isLoading}
                className="w-full py-4 rounded-full bg-blue-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLoading ? "Creating stream…" : "Create Stream →"}
              </button>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
