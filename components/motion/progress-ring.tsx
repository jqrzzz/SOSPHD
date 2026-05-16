"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

/**
 * Animated SVG progress ring with optional gradient stroke.
 * Used as the hero element on the Spine page and Dashboard research health.
 */
export function ProgressRing({
  value,
  size = 120,
  stroke = 8,
  trackClassName,
  ringClassName,
  gradientFrom = "hsl(170 50% 38%)",
  gradientTo = "hsl(190 70% 50%)",
  glow = true,
  children,
}: {
  /** 0–100. */
  value: number;
  size?: number;
  stroke?: number;
  trackClassName?: string;
  ringClassName?: string;
  gradientFrom?: string;
  gradientTo?: string;
  glow?: boolean;
  /** Centre content (e.g. the number itself). */
  children?: React.ReactNode;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const id = `ring-${gradientFrom}-${gradientTo}`.replace(/[^a-z0-9]/gi, "");
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          aria-hidden="true"
          className="absolute inset-2 rounded-full opacity-50 blur-2xl"
          style={{
            background: `radial-gradient(closest-side, ${gradientFrom}40, transparent 70%)`,
          }}
        />
      )}
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={`${value}%`}
      >
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="100%" stopColor={gradientTo} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackClassName ?? "stroke-border/50"}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={`url(#${id})`}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: inView ? target : circumference }}
          transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
          className={ringClassName}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
