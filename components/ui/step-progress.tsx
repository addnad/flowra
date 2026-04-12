"use client";
import { CheckCircle2, XCircle, Circle, Loader2, MapPin, Timer, FileCheck } from "lucide-react";

interface Step {
  id: string;
  status: "pending" | "completed" | "failed";
  completedAt: number | null;
}

interface StepProgressProps { steps: Step[]; }

const STEP_META: Record<string, { label: string; icon: React.ReactNode }> = {
  location: { label: "Location verified", icon: <MapPin className="w-4 h-4" /> },
  presence: { label: "Presence confirmed", icon: <Timer className="w-4 h-4" /> },
  proof:    { label: "Proof submitted",    icon: <FileCheck className="w-4 h-4" /> },
};

export function StepProgress({ steps }: StepProgressProps) {
  if (!steps || steps.length === 0) return null;
  const firstPendingIdx = steps.findIndex(s => s.status !== "completed");
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl mt-4">
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Verification Steps</p>
      <div className="space-y-2">
        {steps.map((step, i) => {
          const meta = STEP_META[step.id] || { label: step.id, icon: <Circle className="w-4 h-4" /> };
          const isNext = i === firstPendingIdx;
          return (
            <div key={step.id} className="flex items-center gap-3">
              <div className="w-6 flex-shrink-0">
                {step.status === "completed" && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                {step.status === "failed"    && <XCircle      className="w-5 h-5 text-red-400" />}
                {step.status === "pending"   && (isNext ? <Loader2 className="w-5 h-5 text-violet-400 animate-spin" /> : <Circle className="w-5 h-5 text-gray-600" />)}
              </div>
              <div className={`flex items-center gap-2 text-sm ${step.status === "completed" ? "text-green-400" : step.status === "failed" ? "text-red-400" : isNext ? "text-violet-300" : "text-gray-600"}`}>
                {meta.icon}<span>Step {i + 1}: {meta.label}</span>
              </div>
              <span className={`ml-auto text-xs font-medium ${step.status === "completed" ? "text-green-400" : step.status === "failed" ? "text-red-400" : "text-gray-500"}`}>
                {step.status === "completed" ? "✓" : step.status === "failed" ? "✗" : "…"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
