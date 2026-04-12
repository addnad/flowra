"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, LinkIcon, Camera, Upload, X } from "lucide-react";
import { BACKEND_URL } from "@/lib/wagmi";

interface ProofSubmissionProps {
  streamId: string;
  isReceiver: boolean;
  isSender: boolean;
  streamStatus: number;
  onApproved: () => void;
}
interface ProofData {
  proofType: string; proofContent: string; proofNote: string;
  status: "pending" | "approved" | "rejected";
  aiVerdict: { verdict: string; confidence: string; reason: string } | null;
  senderNote: string; timestamp: number;
}
interface MetaData { proofType: string; proofInstructions: string; conditionMode: string; }
type CaptureMode = "link" | "camera" | "gallery";

export function ProofSubmission({ streamId, isReceiver, isSender, streamStatus, onApproved }: ProofSubmissionProps) {
  const [proof, setProof] = useState<ProofData | null>(null);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [proofContent, setProofContent] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [senderNote, setSenderNote] = useState("");
  const [aiVerifying, setAiVerifying] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("link");
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedFile, setCapturedFile] = useState<{ dataUrl: string; capturedAt: number; coords: { lat: number; lon: number } | null } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchData() {
    try {
      const [proofRes, metaRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/proof-submit/${streamId}`),
        fetch(`${BACKEND_URL}/api/stream-meta/${streamId}`),
      ]);
      setProof((await proofRes.json()).proof);
      setMeta((await metaRes.json()).meta);
    } catch (e) { console.error(e); }
  }
  useEffect(() => { fetchData(); }, [streamId]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCameraActive(true);
    } catch { toast.error("Camera access denied. Use gallery upload instead."); setCaptureMode("gallery"); }
  }

  function stopCamera() { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setCameraActive(false); }

  async function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current; const canvas = canvasRef.current;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const capturedAt = Date.now();
    let coords: { lat: number; lon: number } | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 }));
      coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    } catch { }
    setCapturedFile({ dataUrl, capturedAt, coords }); stopCamera();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const capturedAt = Date.now();
    const reader = new FileReader();
    reader.onload = async () => {
      let coords: { lat: number; lon: number } | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 }));
        coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      } catch { }
      setCapturedFile({ dataUrl: reader.result as string, capturedAt, coords });
    };
    reader.readAsDataURL(file);
  }

  function discardCapture() { setCapturedFile(null); stopCamera(); }

  async function submitProof() {
    let finalContent = proofContent, finalType = meta?.proofType || "link";
    let capturedAt: number | null = null, captureLocation: { lat: number; lon: number } | null = null;
    if (captureMode === "camera" || captureMode === "gallery") {
      if (!capturedFile) { toast.error("Please capture or select a file first."); return; }
      finalContent = capturedFile.dataUrl; finalType = "capture";
      capturedAt = capturedFile.capturedAt; captureLocation = capturedFile.coords;
    } else { if (!proofContent.trim()) { toast.error("Please enter your proof"); return; } }
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/proof-submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId, receiverAddress: "receiver", proofType: finalType, proofContent: finalContent, proofNote, capturedAt, captureLocation }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Proof rejected."); return; }
      setProof(data.proof); toast.success("Proof submitted!");
    } catch { toast.error("Failed to submit proof"); } finally { setSubmitting(false); }
  }

  async function respondToProof(action: "approve" | "reject") {
    try {
      await fetch(`${BACKEND_URL}/api/proof-submit/${streamId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senderNote }) });
      toast.success(action === "approve" ? "Proof approved!" : "Proof rejected.");
      fetchData(); if (action === "approve") onApproved();
    } catch { toast.error("Failed to respond."); }
  }

  if (streamStatus !== 0) return null;

  return (
    <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl mt-4 p-5">
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-4">Proof of Work</p>
      {meta?.proofInstructions && (
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl mb-4">
          <p className="text-gray-500 text-xs mb-1">Instructions from sender</p>
          <p className="text-gray-300 text-sm">{meta.proofInstructions}</p>
        </div>
      )}
      {isReceiver && !proof && (
        <div className="space-y-3">
          <p className="text-gray-400 text-sm">Submit your proof to unlock funds.</p>
          <div className="flex gap-2">
            {(["link", "camera", "gallery"] as CaptureMode[]).map(mode => (
              <button key={mode} onClick={() => { setCaptureMode(mode); discardCapture(); }}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1 ${captureMode === mode ? "bg-blue-600/20 border-blue-500/40 text-blue-400" : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"}`}>
                {mode === "link"    && <><LinkIcon className="w-3 h-3" /> Link</>}
                {mode === "camera"  && <><Camera   className="w-3 h-3" /> Camera</>}
                {mode === "gallery" && <><Upload   className="w-3 h-3" /> Gallery</>}
              </button>
            ))}
          </div>
          {captureMode === "link" && (
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={proofContent} onChange={e => setProofContent(e.target.value)} placeholder="https://your-proof-link.com"
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 transition-colors" />
            </div>
          )}
          {captureMode === "camera" && !capturedFile && (
            <div className="space-y-2">
              {!cameraActive ? (
                <button onClick={startCamera} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
                  <Camera className="w-4 h-4" /> Start Camera
                </button>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <video ref={videoRef} className="w-full rounded-xl" playsInline muted />
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                    <button onClick={capturePhoto} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-xl font-medium">Capture</button>
                    <button onClick={stopCamera} className="px-4 py-2 bg-white/10 text-gray-300 text-sm rounded-xl">Cancel</button>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
          {captureMode === "gallery" && !capturedFile && (
            <div>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
                <Upload className="w-4 h-4" /> Choose from gallery
              </button>
            </div>
          )}
          {capturedFile && (
            <div className="relative rounded-xl overflow-hidden bg-black/40 border border-white/10">
              <img src={capturedFile.dataUrl} alt="Captured proof" className="w-full max-h-48 object-cover" />
              <div className="p-2 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Captured {new Date(capturedFile.capturedAt).toLocaleTimeString()}
                  {capturedFile.coords && ` · ${capturedFile.coords.lat.toFixed(4)}, ${capturedFile.coords.lon.toFixed(4)}`}
                </p>
                <button onClick={discardCapture} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            </div>
          )}
          <textarea value={proofNote} onChange={e => setProofNote(e.target.value)} placeholder="Add a note to the sender (optional)..." rows={2}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 transition-colors resize-none" />
          <button onClick={submitProof} disabled={submitting}
            className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Submit Proof
          </button>
        </div>
      )}
      {isReceiver && proof?.status === "pending" && (
        <div className="text-center py-4">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse mx-auto mb-3" />
          <p className="text-yellow-400 text-sm font-medium">Flowra is reviewing your submission…</p>
        </div>
      )}
      {isReceiver && proof?.status === "approved" && (
        <div className="text-center py-4">
          <CheckCircle2 className="w-8 h-8 text-white mx-auto mb-3" />
          <p className="text-white text-sm font-medium">Flowra approved your proof. Funds released.</p>
          {proof.senderNote && <p className="text-gray-500 text-xs mt-2">"{proof.senderNote}"</p>}
        </div>
      )}
      {isReceiver && proof?.status === "rejected" && (
        <div className="space-y-3">
          <div className="text-center py-2">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-400 text-sm font-medium">Flowra rejected this proof.</p>
            {proof.senderNote && <p className="text-gray-500 text-xs mt-2">"{proof.senderNote}"</p>}
          </div>
          <button onClick={() => { setProof(null); setProofContent(""); setProofNote(""); setCapturedFile(null); }}
            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors">
            Submit New Proof
          </button>
        </div>
      )}
      {isSender && !proof && (
        <div className="text-center py-4">
          <div className="w-2 h-2 rounded-full bg-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Waiting for receiver to submit proof</p>
        </div>
      )}
      {isSender && proof?.status === "pending" && (
        <div className="space-y-4">
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-gray-500 text-xs mb-1">Submitted {proof.proofType}</p>
            {proof.proofType === "capture"
              ? <img src={proof.proofContent} alt="Submitted capture" className="w-full max-h-48 object-cover rounded-lg mt-2" />
              : <a href={proof.proofContent} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm break-all hover:underline">{proof.proofContent}</a>}
            {proof.proofNote && <p className="text-gray-400 text-xs mt-2">"{proof.proofNote}"</p>}
          </div>
          <textarea value={senderNote} onChange={e => setSenderNote(e.target.value)} placeholder="Add a note to receiver (optional)..." rows={2}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 transition-colors resize-none" />
          <div className="flex gap-3">
            <button onClick={() => respondToProof("approve")} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Approve
            </button>
            <button onClick={() => respondToProof("reject")} className="flex-1 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
              <XCircle className="w-4 h-4" /> Reject
            </button>
          </div>
        </div>
      )}
      {isSender && proof?.status === "approved" && (
        <div className="text-center py-4"><CheckCircle2 className="w-8 h-8 text-white mx-auto mb-3" /><p className="text-white text-sm font-medium">You approved this proof</p></div>
      )}
      {isSender && proof?.status === "rejected" && (
        <div className="text-center py-4"><XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" /><p className="text-red-400 text-sm font-medium">You rejected this proof</p></div>
      )}
    </div>
  );
}
