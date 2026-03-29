import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date string/Date consistently between server and client
 * by pinning to UTC, avoiding hydration mismatches.
 */
export function formatDate(
  input: string | Date,
  style: "short" | "long" | "time" | "datetime" = "short",
): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";

  const opts: Intl.DateTimeFormatOptions = { timeZone: "UTC" };
  switch (style) {
    case "short":
      return d.toLocaleDateString("en-US", { ...opts, month: "short", day: "numeric" });
    case "long":
      return d.toLocaleDateString("en-US", { ...opts, month: "short", day: "numeric", year: "numeric" });
    case "time":
      return d.toLocaleTimeString("en-US", { ...opts, hour: "2-digit", minute: "2-digit" });
    case "datetime":
      return d.toLocaleString("en-US", {
        ...opts,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
  }
}
