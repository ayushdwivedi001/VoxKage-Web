"use client";

import React, { useState, useEffect } from "react";

interface SwitchToDesignButtonProps {
  isDesignMode?: boolean;
  onToggleDesignMode?: () => void;
}

export default function SwitchToDesignButton({
  isDesignMode: externalIsDesignMode,
  onToggleDesignMode,
}: SwitchToDesignButtonProps) {
  const [internalIsDesignMode, setInternalIsDesignMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("voxkage_design_mode") === "true";
    }
    return false;
  });

  const isDesignActive = externalIsDesignMode ?? internalIsDesignMode;
  const [isHovered, setIsHovered] = useState(false);

  const handleToggle = () => {
    const nextState = !isDesignActive;
    setInternalIsDesignMode(nextState);
    if (typeof window !== "undefined") {
      localStorage.setItem("voxkage_design_mode", String(nextState));
    }
    if (onToggleDesignMode) {
      onToggleDesignMode();
    }
  };

  return (
    <div
      className="relative flex items-center justify-center group select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Native VoxKage Creature Button (No glassmorphism border around it) */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isDesignActive ? "Switch to Chat Mode" : "Switch to Design Mode"}
        className="relative flex items-center justify-center w-8 h-8 rounded-full focus:outline-none transition-transform duration-200 active:scale-90 cursor-pointer p-0 bg-transparent border-none"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible transition-all duration-300 transform group-hover:scale-110"
        >
          <defs>
            {/* Egg shape clip path */}
            <clipPath id="vk-design-body-clip">
              <path d="M 50 10 C 74 10, 90 28, 90 53 C 90 76, 72 90, 50 90 C 28 90, 10 76, 10 53 C 10 28, 26 10, 50 10 Z" />
            </clipPath>

            {/* Blue Gradient (White bottom -> VoxKage Blue top) */}
            <linearGradient id="vk-blue-body-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
              <stop offset="35%" stopColor="#38bdf8" stopOpacity={0.9} />
              <stop offset="75%" stopColor="#0438c2" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#020938" stopOpacity={0.8} />
            </linearGradient>

            {/* Red Gradient for Design Mode (White bottom -> Angry Red top) */}
            <linearGradient id="vk-red-body-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
              <stop offset="35%" stopColor="#f87171" stopOpacity={0.9} />
              <stop offset="75%" stopColor="#ef4444" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#991b1b" stopOpacity={0.85} />
            </linearGradient>
          </defs>

          {/* Base Creature Body (Egg shape) */}
          <path
            d="M 50 10 C 74 10, 90 28, 90 53 C 90 76, 72 90, 50 90 C 28 90, 10 76, 10 53 C 10 28, 26 10, 50 10 Z"
            fill="#FAF9F5"
            className="transition-colors duration-300"
          />

          {/* Animated Overlay Body Layer: Blue gradient in Chat Mode on hover / Red gradient in Design Mode */}
          <path
            d="M 50 10 C 74 10, 90 28, 90 53 C 90 76, 72 90, 50 90 C 28 90, 10 76, 10 53 C 10 28, 26 10, 50 10 Z"
            fill={isDesignActive ? "url(#vk-red-body-grad)" : "url(#vk-blue-body-grad)"}
            className={`transition-opacity duration-300 ${
              isDesignActive || isHovered ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Eyes Layer */}
          <g id="vk-creature-eyes">
            <ellipse cx="35" cy="48" rx="5.8" ry="9.5" fill="#141413" />
            <ellipse cx="65" cy="48" rx="5.8" ry="9.5" fill="#141413" />
          </g>
        </svg>
      </button>

      {/* Non-trimmed Tooltip Text positioned under the icon */}
      <div className="absolute top-full right-0 mt-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap">
        <div className="bg-[#121216]/98 border border-zinc-800 text-zinc-200 text-[11px] font-sans px-2.5 py-1 rounded-lg shadow-xl backdrop-blur-md">
          {isDesignActive ? "Switch to Chat Mode" : "Switch to Design Mode"}
        </div>
      </div>
    </div>
  );
}
