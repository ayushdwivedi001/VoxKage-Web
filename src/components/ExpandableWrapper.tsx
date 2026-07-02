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

  const expandedChild = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<any>, { isExpanded: true })
    : children;

  const overlayContent = isExpanded ? (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 sm:p-6 md:p-10 select-none"
      style={{ animation: "vk-fade-in 0.18s ease" }}
      onClick={close}
    >
      {/* Dimmed backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

      {/* Floating Close Button in Top-Right */}
      <button
        onClick={close}
        className="absolute top-6 right-6 z-[9999] flex items-center justify-center w-10 h-10 rounded-full bg-zinc-900/90 border border-zinc-800 text-zinc-400 hover:text-zinc-150 hover:bg-zinc-800/80 transition-all duration-150 cursor-pointer shadow-lg"
        aria-label="Close expanded view"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Expanded content panel */}
      <div
        ref={contentRef}
        className="relative z-10 w-full max-w-[95vw] md:max-w-[1100px] max-h-[85vh] overflow-y-auto custom-scrollbar flex items-center justify-center"
        style={{ animation: "vk-scale-in 0.2s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        {expandedChild}
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
