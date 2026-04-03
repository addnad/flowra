"use client";

import { AlertCircle, Link, Image, MapPin, Unlock } from "lucide-react";
import { MapPicker } from "@/components/ui/map-picker";

export type ConditionMode = "none" | "location" | "proof";

interface ConditionSelectorProps {
  conditionMode: ConditionMode;
  setConditionMode: (mode: ConditionMode) => void;
  proofType: "link" | "image";
  setProofType: (type: "link" | "image") => void;
  onLocationSelect: (lat: number, lon: number, radius: number, label: string) => void;
}

export function ConditionSelector({
  conditionMode, setConditionMode, proofType, setProofType, onLocationSelect,
  proofInstructions, setProofInstructions
}: ConditionSelectorProps & {
  proofInstructions?: string;
  setProofInstructions?: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-white font-medium">Add a condition (optional)</p>

      {/* Condition toggle — matches existing pill button style */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "none",     label: "No condition", Icon: Unlock  },
          { value: "location", label: "Location",     Icon: MapPin  },
          { value: "proof",    label: "Proof of work", Icon: Image  },
        ].map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setConditionMode(value as ConditionMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              conditionMode === value
                ? "bg-blue-600 text-white"
                : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Location condition */}
      {conditionMode === "location" && (
        <div className="space-y-3 p-4 bg-white/3 border border-white/10 rounded-2xl">
          <p className="text-xs text-gray-400 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Search for a place or drop a pin. Receiver must be inside the radius to claim.
          </p>
          <MapPicker onLocationSelect={onLocationSelect} />
        </div>
      )}

      {/* Proof condition */}
      {conditionMode === "proof" && (
        <div className="space-y-4 p-4 bg-white/3 border border-white/10 rounded-2xl">
          <p className="text-xs text-gray-400 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Receiver submits proof of work. You review and approve before funds unlock.
          </p>

          <div className="flex gap-2">
            {[
              { value: "link",  label: "Link",  Icon: Link  },
              { value: "image", label: "Image", Icon: Image },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setProofType(value as "link" | "image")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  proofType === value
                    ? "bg-blue-600 text-white"
                    : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2">Instructions for receiver <span className="text-gray-600">(required)</span></p>
            <textarea
              value={proofInstructions || ""}
              onChange={e => setProofInstructions?.(e.target.value)}
              placeholder={proofType === "link"
                ? "e.g. Submit a GitHub PR link showing the completed feature..."
                : "e.g. Upload a photo of the completed installation at the site..."}
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 text-xs focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
            />
            <p className="text-xs text-gray-600 mt-1">
              This tells the receiver exactly what to submit. Claude AI can also review submissions against these instructions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
