"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Container that staggers entrance of its direct children.
 * Pair with <StaggerItem>. Skip in reduced-motion mode (handled by framer).
 */
export function StaggerContainer({
  children,
  className,
  delay = 0,
  stagger = 0.06,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
} & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
      className={cn(className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] },
        },
      }}
      className={cn(className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
