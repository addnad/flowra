export function DrippayLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="drippay-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="28" fill="url(#drippay-grad)" />
      <rect x="32" y="28" width="14" height="64" rx="4" fill="white" />
      <path
        d="M46 28 Q92 28 92 60 Q92 92 46 92"
        fill="none"
        stroke="white"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <circle cx="92" cy="60" r="7" fill="white" opacity="0.35" />
    </svg>
  );
}
