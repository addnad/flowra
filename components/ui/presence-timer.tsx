"use client";
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PresenceTimerProps {
  timeInZoneMs: number;
  requiredDurationMs: number;
}

export function PresenceTimer({ timeInZoneMs, requiredDurationMs }: PresenceTimerProps) {
  const [localTimeMs, setLocalTimeMs] = useState(timeInZoneMs);

  useEffect(() => { setLocalTimeMs(timeInZoneMs); }, [timeInZoneMs]);

  useEffect(() => {
    if (localTimeMs >= requiredDurationMs) return;
    const interval = setInterval(() => setLocalTimeMs(t => Math.min(t + 1000, requiredDurationMs)), 1000);
    return () => clearInterval(interval);
  }, [localTimeMs, requiredDurationMs]);

  const progressPct = Math.min((localTimeMs / requiredDurationMs) * 100, 100);
  const met = localTimeMs >= requiredDurationMs;

  function formatMs(ms: number) {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }

  return (
    <div className="mt-4 p-4 bg-white/5 border border-violet-500/20 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="w-4 h-4 text-violet-400" />
        <p className="text-sm text-violet-300 font-medium">Presence Required</p>
        {met && <span className="ml-auto text-xs text-green-400 font-medium">✓ Duration met</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <p className="text-gray-500 mb-1">Time in zone</p>
          <p className={`font-mono font-bold ${met ? "text-green-400" : "text-violet-300"}`}>{formatMs(localTimeMs)}</p>
        </div>
        <div className="bg-black/30 rounded-lg p-2 text-center">
          <p className="text-gray-500 mb-1">Required</p>
          <p className="font-mono font-bold text-gray-300">{formatMs(requiredDurationMs)}</p>
        </div>
      </div>
      <Progress value={progressPct} className="h-2 bg-white/10" />
      <p className="text-xs text-gray-500 mt-2 text-center">
        {met ? "You've been in the zone long enough." : `Stay inside the zone for ${formatMs(requiredDurationMs - localTimeMs)} more.`}
      </p>
    </div>
  );
}
