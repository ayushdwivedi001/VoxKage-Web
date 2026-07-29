"use client";

import React from "react";

interface PlanModeHeaderProps {
  isPlanMode: boolean;
  isLightMode?: boolean;
  children: React.ReactNode;
}

export default function PlanModeHeader({ isPlanMode, isLightMode = false, children }: PlanModeHeaderProps) {
  return (
    <div
      className="w-full max-w-[720px] relative"
      // CRITICAL: always same padding/radius so children are never remounted
      style={{
        padding: "3px",
        borderRadius: "31px",
        background: isPlanMode
          ? "linear-gradient(135deg, #6ab4ff 0%, #338CEC 40%, #1a6fd4 60%, #4fa8f8 100%)"
          : "transparent",
        boxShadow: "none",
        transition: "background 0.5s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* PLAN header strip — height + opacity animated, never unmounted */}
      <div
        style={{
          height: isPlanMode ? "32px" : "0px",
          opacity: isPlanMode ? 1 : 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          paddingLeft: "16px",
          pointerEvents: "none",
          userSelect: "none",
          transition: "height 0.45s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 900,
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.95)",
            textShadow: "0 1px 4px rgba(0,0,0,0.2)",
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          PLAN
        </span>
      </div>

      {/*
        Inner children wrapper:
        - position: relative + z-index: 1 so popups (z-index:50) escape above the blue border
        - overflow: visible so popups are never clipped by the wrapper
        - NO border-radius override — the prompt box keeps its own styling
      */}
      <div style={{ position: "relative", zIndex: 1, overflow: "visible" }}>
        {children}
      </div>
    </div>
  );
}
