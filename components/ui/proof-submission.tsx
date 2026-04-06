"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, LinkIcon, ImageIcon } from "lucide-react";
import { BACKEND_URL } from "@/lib/wagmi";

interface ProofSubmissionProps {
  streamId: string;
  isReceiver: boolean;
  isSender: boolean;
  streamStatus: number;
  onApproved: () => void;
}

interface ProofData {
  proofType: string;
  proofContent: string;
  proofNote: string;
  status: "pending" | "approved" | "rejected";
  aiVerdict: { verdict: string; confidence: string; reason: string } | null;
  senderNote: string;
  timestamp: number;
}

interface MetaData {
  proofType: string;
  proofInstructions: string;
  conditionMode: string;
}

export function ProofSubmission({ streamId, isReceiver, isSender, streamStatus, onApproved }: ProofSubmissionProps) {
  const [proof, setProof] = useState<ProofData | null>(null);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [proofContent, setProofContent] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [senderNote, setSenderNote] = useState("");
  const [rejected, setRejected] = useState(false);

  async function fetchData() {
    try {
      const [proofRes, metaRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/proof-submit/${streamId}`),
        fetch(`${BACKEND_URL}/api/stream-meta/${streamId}`),
      ]);
      const proofData = await proofRes.json();
      const metaData = await metaRes.json();
      setProof(proofData.proof);
      setMeta(metaData.meta);
    } catch (e) { console.error(e); }
  }

  useEffect(() => { fetchData(); }, [streamId]);

  async function submitProof() {
    if (!proofContent.trim()) { toast.error("Please enter your proof"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/proof-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          receiverAddress: "receiver",
          proofType: meta?.proofType || "link",
          proofContent,
          proofNote,
        }),
      });
      const data = await res.json();
      setProof(data.proof);
      setRejected(false);
      toast.success("Proof submitted!");
    } catch (e) {
      toast.error("Failed to submit proof");
    } finally {
      setSubmitting(false);
    }
  }

  async function respondToProof(action: "approve" | "reject") {
    try {
      await fetch(`${BACKEND_URL}/api/proof-submit/${streamId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderNote }),
      });
      toast.success(action === "approve" ? "Proof approved!" : "Proof rejected.");
      fetchData();
      if (action === "approve") onApproved();
    } catch (e) {
      toast.error("Failed to respond.");
    }
  }

  async function runAiVerification() {
    setAiVerifying(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/proof-submit/${streamId}/ai-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderInstructions: meta?.proofInstructions }),
      });
      const data = await res.json();
      if (data.aiVerdict) {
        setProof(prev => prev ? { ...prev, aiVerdict: data.aiVerdict } : prev);
        toast.success(`AI verdict: ${data.aiVerdict.verdict}`);
      }
    } catch (e) {
      toast.error("AI verification failed.");
    } finally {
      setAiVerifying(false);
    }
  }

  if (streamStatus !== 0) return null;

  return (
    <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl mt-4 p-5">
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-4">Proof of Work</p>

      {meta?.proofInstructions && (
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl mb-4">
          <p className="text-gray-500 text-xs mb-1">Instructions from sender</p>
          <p className="text-gray-300 text-sm">{meta.proofInstructions}</p>
          <p className="text-gray-600 text-xs mt-2">Submit: {meta.proofType === "link" ? "a URL link" : "an image URL"}</p>
        </div>
      )}

      {isReceiver && !proof && (
        <div className="space-y-3">
          <p className="text-gray-400 text-sm">Submit your proof to unlock funds.</p>
          <div className="relative">
            {meta?.proofType === "image"
              ? <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              : <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            }
            <input
              value={proofContent}
              onChange={e => setProofContent(e.target.value)}
              placeholder={meta?.proofType === "image" ? "Paste image URL..." : "https://your-proof-link.com"}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
          <textarea
            value={proofNote}
            onChange={e => setProofNote(e.target.value)}
            placeholder="Add a note to the sender (optional)..."
            rows={2}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
          />
          <button
            onClick={submitProof}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Proof
          </button>
        </div>
      )}

      {isReceiver && proof?.status === "pending" && (
        <div className="text-center py-4">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse mx-auto mb-3" />
          <p className="text-yellow-400 text-sm font-medium">Flowra is reviewing your submission…</p>
          <p className="text-gray-500 text-xs mt-2">Flowra will verify this against the sender's instructions automatically.</p>
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
          <button
            onClick={() => { setProof(null); setProofContent(""); setProofNote(""); }}
            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors"
          >
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
            <a href={proof.proofContent} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm break-all hover:underline">
              {proof.proofContent}
            </a>
            {proof.proofNote && <p className="text-gray-400 text-xs mt-2">"{proof.proofNote}"</p>}
          </div>



          <textarea
            value={senderNote}
            onChange={e => setSenderNote(e.target.value)}
            placeholder="Add a note to receiver (optional)..."
            rows={2}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
          />

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
        <div className="text-center py-4">
          <CheckCircle2 className="w-8 h-8 text-white mx-auto mb-3" />
          <p className="text-white text-sm font-medium">You approved this proof</p>
        </div>
      )}

      {isSender && proof?.status === "rejected" && (
        <div className="text-center py-4">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 text-sm font-medium">You rejected this proof</p>
          <p className="text-gray-500 text-xs mt-1">Receiver can submit a new proof.</p>
        </div>
      )}
    </div>
  );
}
