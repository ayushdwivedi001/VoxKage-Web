"use client";
import React, { useEffect, useCallback, useRef } from "react";
import { Maximize2, X } from "lucide-react";
import { createPortal } from "react-dom";

interface ExpandableWrapperProps {
  children: React.ReactNode;
  label?: string;
  className?: string;
}

export default function ExpandableWrapper({ children, label, className = "" }: ExpandableWrapperProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const open = useCallback(() => setIsExpanded(true), []);
  const close = useCallback(() => setIsExpanded(false), []);

  // Lock scroll when expanded
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isExpanded]);

  // ESC key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (isExpanded) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isExpanded, close]);

  const overlayContent = isExpanded ? (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center"
      style={{ animation: "vk-fade-in 0.18s ease" }}
      onClick={close}
    >
      {/* Dimmed backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Expanded content panel */}
      <div
        ref={contentRef}
        className="relative z-10 w-full max-w-[92vw] mt-10 mb-10 overflow-y-auto max-h-[88vh] rounded-2xl"
        style={{ animation: "vk-scale-in 0.2s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button row */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#121214] border border-zinc-800/70 rounded-t-2xl">
          {label && (
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">{label}</span>
          )}
          <button
            onClick={close}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors duration-150 text-[12px] font-sans"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>

        {/* Cloned children in expanded view */}
        <div className="bg-[#0d0d0f] border border-t-0 border-zinc-800/70 rounded-b-2xl p-4 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className={`relative group/expandable ${className}`}>
        {children}

        {/* Expand button — top-right absolute, always visible on hover */}
        <button
          onClick={open}
          title="Expand"
          className="
            absolute top-2 right-2 z-20
            w-7 h-7 flex items-center justify-center
            rounded-lg
            bg-zinc-900/90 border border-zinc-750/60
            text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 hover:border-zinc-600
            opacity-0 group-hover/expandable:opacity-100
            transition-all duration-150
            shadow-sm
          "
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Portal the overlay to document.body */}
      {typeof document !== "undefined" && overlayContent
        ? createPortal(overlayContent, document.body)
        : null}
    </>
  );
}
