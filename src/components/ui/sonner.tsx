"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Toast host, styled to match the ArchiTrack surface tokens. Mount once in the root layout. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--surface-raised)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--border-hairline)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
