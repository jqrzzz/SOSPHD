"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useMotionValue, useTransform } from "framer-motion";

/**
 * CountUp — animates a number from 0 → value on mount (or when in view).
 *
 * Used for metric cards, dashboard hero numbers, spine progress.
 * Stays accessible: the final value is rendered immediately for SR users
 * via aria-label, and the animation is skipped when prefers-reduced-motion.
 */
export function CountUp({
  value,
  duration = 1.2,
  decimals = 0,
  format,
  className,
  prefix,
  suffix,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  /** Optional custom formatter — overrides decimals. */
  format?: (v: number) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const motion = useMotionValue(0);
  const rounded = useTransform(motion, (v) =>
    format ? format(v) : v.toFixed(decimals),
  );

  useEffect(() => {
    if (!inView) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      motion.set(value);
      return;
    }
    const controls = animate(motion, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
    });
    return () => controls.stop();
  }, [inView, value, duration, motion]);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const unsub = rounded.on("change", (latest) => {
      el.textContent = `${prefix ?? ""}${latest}${suffix ?? ""}`;
    });
    el.textContent = `${prefix ?? ""}${format ? format(0) : (0).toFixed(decimals)}${suffix ?? ""}`;
    return () => unsub();
  }, [rounded, prefix, suffix, decimals, format]);

  return (
    <span
      ref={ref}
      className={className}
      aria-label={`${prefix ?? ""}${format ? format(value) : value.toFixed(decimals)}${suffix ?? ""}`}
    />
  );
}
