import React from "react";

interface BrandLogoProps {
  className?: string;
  compact?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = "", compact = false }) => (
  <span className={`leavewise-logo ${compact ? "leavewise-logo--compact" : "leavewise-logo--full"} ${className}`}>
    <img src={`${import.meta.env.BASE_URL}leavewise-logo.png`} alt="LeaveWise" />
  </span>
);
