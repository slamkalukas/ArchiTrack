"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  /** 0–100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Center label; defaults to the rounded percentage in serif numerals. */
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
}

/**
 * Thin-ring progress indicator per spec/06-ui-ux.md §1 dataviz conventions:
 * muted track, accent fill, numeral in serif, animates once on mount.
 */
export function ProgressRing({
  value,
  size = 160,
  strokeWidth = 8,
  className,
  label,
  sublabel,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(clamped));
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  const offset = circumference - (animated / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent-soft)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-serif text-3xl text-foreground tabular-nums">
          {label ?? `${Math.round(clamped)}%`}
        </span>
        {sublabel && <span className="mt-1 text-xs text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
}
