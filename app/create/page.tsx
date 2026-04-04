"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { toast } from "sonner";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Droplets, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import { parseUsdc, encodeLocationCondition, INTERVAL_PRESETS, DURATION_PRESETS } from "@/lib/utils";
import { DRIPLY_ABI, ERC20_ABI } from "@/lib/abi";
import { DRIPLY_CONTRACT_ADDRESS, USDC_ADDRESS, BACKEND_URL } from "@/lib/wagmi";
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

  const duration = durationPreset === 0 ? parseInt(customDuration || "0") : durationPreset;
  const interval = intervalPreset === 0 ? parseInt(customInterval || "0") * 3600 : intervalPreset;
  let rawAmount = 0n;
  try { rawAmount = parseUsdc(amountUsd); } catch {}

  useEffect(() => {
    async function checkAllowance() {
      if (!address || !publicClient || rawAmount === 0n) return;
      setCheckingAllowance(true);
      try {
        const result = await publicClient.readContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "allowance", args: [address, DRIPLY_CONTRACT_ADDRESS] });
        setStep((result as bigint) >= rawAmount ? "create" : "approve");
      } catch (e) { console.error(e); }
      finally { setCheckingAllowance(false); }
    }
    checkAllowance();
  }, [address, amountUsd, publicClient]);

  useEffect(() => {
    if (!isSuccess || !txHash) return;
    if (step === "approve") {
      toast.success("USDC approved!");
      setStep("create");
      reset();
    } else if (step === "create") {
      toast.success("Stream created! 🎉");
      // Save stream metadata if proof condition
      if (conditionMode === "proof") {
        saveStreamMeta();
      }
      setStep("done");
    }
  }, [isSuccess]);

  async function saveStreamMeta() {
    if (!publicClient) return;
    try {
      // Get the stream ID from the transaction receipt logs
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
      // StreamCreated event topic
      const streamCreatedTopic = "0x" + Array.from(new TextEncoder().encode("StreamCreated(uint256,address,address,uint256,uint256,uint256,uint8)")).map(b => b.toString(16).padStart(2, "0")).join("");
      const log = receipt?.logs?.[0];
      // Stream ID is in the first indexed topic
      const streamId = log?.topics?.[1] ? parseInt(log.topics[1], 16).toString() : "0";

      await fetch(`${BACKEND_URL}/api/stream-meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          conditionMode,
          proofType,
          proofInstructions,
        }),
      });
      console.log("Stream meta saved for stream:", streamId);
    } catch (e) { console.error("Failed to save stream meta:", e); }
  }

  function handleApprove() {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    writeContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve", args: [DRIPLY_CONTRACT_ADDRESS, rawAmount] });
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
      address: DRIPLY_CONTRACT_ADDRESS,
      abi: DRIPLY_ABI,
      functionName: "createStream",
      args: [receiver as `0x${string}`, USDC_ADDRESS, rawAmount, BigInt(duration), BigInt(interval), conditionType, conditionData],
    });
    toast.info("Creating stream…");
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
          <h1 className="text-3xl font-bold text-white mb-3">Stream created!</h1>
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
            {[
              { label: "👶 Kid's Allowance", amount: "50", duration: 2592000, interval: 86400, note: "Daily pocket money for 30 days" },
              { label: "💼 Freelance Pay",   amount: "500", duration: 604800, interval: 604800, note: "Weekly freelance payment" },
              { label: "👷 Field Worker",    amount: "200", duration: 2592000, interval: 86400, note: "Daily field worker pay" },
              { label: "🎓 Tuition Stream",  amount: "300", duration: 7776000, interval: 2592000, note: "Monthly tuition for 90 days" },
            ].map(t => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setAmountUsd(t.amount);
                  setDurationPreset(t.duration);
                  setIntervalPreset(t.interval);
                }}
                className="p-3 rounded-xl bg-white/5 border border-white/10 text-left hover:border-white/20 hover:bg-white/8 transition-all"
              >
                <p className="text-white text-xs font-medium">{t.label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{t.note}</p>
              </button>
            ))}
          </div>
        </div>

        <Card className="bg-[#0d0d0d] border-white/10 rounded-2xl">
          <CardContent className="p-8 space-y-8">

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
                <div className="mt-3"><FieldInput type="number" placeholder="Duration in seconds (e.g. 86400 = 1 day)" value={customDuration} onChange={e => setCustomDuration(e.target.value)} /></div>
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

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
