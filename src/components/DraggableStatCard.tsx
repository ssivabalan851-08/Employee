import React from "react";
import { motion, useReducedMotion } from "motion/react";

interface DraggableStatCardProps {
  children: React.ReactNode;
  className: string;
}

// Decorative drag motion only: each card returns to its original position and never changes data order.
export const DraggableStatCard: React.FC<DraggableStatCardProps> = ({ children, className }) => {
  const reducedMotion = useReducedMotion();
  const canDrag = !reducedMotion && window.matchMedia("(pointer: fine)").matches;

  return (
    <motion.div
      className={`leavewise-draggable-card ${className}`}
      drag={canDrag}
      dragSnapToOrigin
      dragMomentum={false}
      whileDrag={canDrag ? { scale: 1.035, rotate: 1, zIndex: 2 } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      {children}
    </motion.div>
  );
};
