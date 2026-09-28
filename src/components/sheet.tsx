"use client";

import { useEffect, useRef } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  /** "bottom": phone sheet sliding up from the bottom; "center": a centered dialog. */
  placement?: "bottom" | "center";
  /** Centered dialogs only: room for a large figure. */
  wide?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Modal built on the native <dialog>: focus trapping, Escape and the backdrop come for free. */
export function Sheet({ open, onClose, label, placement = "bottom", wide = false, className = "", children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Listen to the native event: Escape and dialog.close() must also reset the owner's state,
  // otherwise the same dialog could never be opened again.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handle = () => onCloseRef.current();
    d.addEventListener("close", handle);
    return () => d.removeEventListener("close", handle);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const position =
    placement === "bottom"
      ? "mt-auto mb-0 w-full max-w-none max-h-[calc(100dvh-2.5rem)] rounded-t-2xl"
      : `m-auto ${wide ? "w-[min(72rem,calc(100vw-2rem))]" : "w-[min(44rem,calc(100vw-2rem))]"} max-h-[calc(100dvh-4rem)] rounded-2xl`;

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onKeyDown={(e) => {
        // Route Escape through the owner's state so it stays in sync even if the native close event is late.
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`bg-surface p-0 text-ink shadow-[0_-8px_28px_rgb(0_0_0/0.35)] ${position} ${className}`}
    >
      {children}
    </dialog>
  );
}
