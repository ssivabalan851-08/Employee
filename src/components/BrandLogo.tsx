import React from "react";

interface BrandLogoProps {
  className?: string;
  compact?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = "", compact = false }) => (
  <span className={`leavewise-logo ${compact ? "leavewise-logo--compact" : "leavewise-logo--full"} ${className}`}>
    <img src="/leavewise-logo.png" alt="LeaveWise" />
  </span>
);
