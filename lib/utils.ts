import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { USDC_DECIMALS } from "./wagmi";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsdc(raw: bigint): string {
  const dollars = Number(raw) / 10 ** USDC_DECIMALS;
  return `$${dollars.toFixed(2)}`;
}

export function parseUsdc(dollars: string): bigint {
  const num = parseFloat(dollars);
  if (isNaN(num) || num <= 0) throw new Error("Invalid USDC amount");
  return BigInt(Math.round(num * 10 ** USDC_DECIMALS));
}

export function timeRemaining(endTime: bigint): string {
  const diff = Number(endTime) - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

export function streamProgress(startTime: bigint, endTime: bigint): number {
  const now = Math.floor(Date.now() / 1000);
  const start = Number(startTime);
  const end = Number(endTime);
  if (now >= end) return 100;
  if (now <= start) return 0;
  return Math.round(((now - start) / (end - start)) * 100);
}

export function encodeLocationCondition(
  lat: number,
  lon: number,
  radiusMeters: number
): `0x${string}` {
  const latScaled = BigInt(Math.round(lat * 1e6));
  const lonScaled = BigInt(Math.round(lon * 1e6));
  const radiusBig = BigInt(Math.round(radiusMeters));
  return encodeAbiParameters(
    parseAbiParameters("int256 lat, int256 lon, uint256 radius"),
    [latScaled, lonScaled, radiusBig]
  );
}

export const STATUS_LABELS: Record<number, string> = {
  0: "Active",
  1: "Paused",
  2: "Cancelled",
  3: "Completed",
};

export const STATUS_COLORS: Record<number, string> = {
  0: "text-green-400",
  1: "text-yellow-400",
  2: "text-red-400",
  3: "text-gray-400",
};

export const INTERVAL_PRESETS = [
  { label: "Daily",  value: 86400  },
  { label: "Weekly", value: 604800 },
  { label: "Custom", value: 0      },
] as const;

export const DURATION_PRESETS = [
  { label: "7 days",  value: 604800  },
  { label: "30 days", value: 2592000 },
  { label: "90 days", value: 7776000 },
  { label: "Custom",  value: 0       },
] as const;
