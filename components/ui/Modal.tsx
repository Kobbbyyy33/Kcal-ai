"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-950"
        )}
        role="dialog"
        aria-modal="true"
      >
        {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
        <div className={cn(title ? "mt-4" : "")}>{children}</div>
      </div>
    </div>
  );
}

