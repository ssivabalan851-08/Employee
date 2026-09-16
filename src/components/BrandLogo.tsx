import React from "react";

export const BrandLogo: React.FC<{ className?: string }> = ({ className = "h-10 w-10" }) => (
  <svg className={className} viewBox="0 0 48 48" role="img" aria-label="Enterprise Leave Portal logo">
    <defs><linearGradient id="leave-brand" x1="7" y1="5" x2="42" y2="43" gradientUnits="userSpaceOnUse"><stop stopColor="#4F46E5" /><stop offset="1" stopColor="#0891B2" /></linearGradient></defs>
    <rect width="48" height="48" rx="13" fill="url(#leave-brand)" />
    <path d="M15 12v6M33 12v6M11.5 20.5h25" stroke="white" strokeWidth="3" strokeLinecap="round" />
    <rect x="11.5" y="14.5" width="25" height="23" rx="5" stroke="white" strokeWidth="3" fill="none" />
    <path d="m18 29 4 4 8-9" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
