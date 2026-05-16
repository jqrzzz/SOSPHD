"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

/**
 * Lightweight fade + rise on mount. Use for page bodies that don't need
 * stagger orchestration.
 */
export function FadeIn({
  children,
  delay = 0,
  duration = 0.4,
  y = 6,
  className,
  ...rest
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  className?: string;
} & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
