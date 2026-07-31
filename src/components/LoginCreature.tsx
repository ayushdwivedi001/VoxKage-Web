"use client";

import React, { useEffect, useRef } from "react";

/**
 * LoginCreature — Pure, lightweight VoxKage creature SVG component for the Login title.
 * Uses the exact shape, body curve, and eye positions from VoxKageCreature.tsx on the homepage.
 */
export default function LoginCreature() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const eyesLayer = svgEl.querySelector<SVGGElement>("#lc-eyes-layer");
    if (!eyesLayer) return;

    let isDestroyed = false;

    function performSyncedBlink() {
      if (isDestroyed || !eyesLayer) return;
      eyesLayer.classList.add("lc-blinking");
      setTimeout(() => {
        if (!isDestroyed && eyesLayer) {
          eyesLayer.classList.remove("lc-blinking");
        }
      }, 160);
    }

    function scheduleNextBlink() {
      if (isDestroyed) return;
      const randomDelay = Math.floor(Math.random() * 3000) + 2500;
      setTimeout(() => {
        performSyncedBlink();
        if (Math.random() < 0.15) {
          setTimeout(() => {
            performSyncedBlink();
            scheduleNextBlink();
          }, 260);
        } else {
          scheduleNextBlink();
        }
      }, randomDelay);
    }

    scheduleNextBlink();

    return () => {
      isDestroyed = true;
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      className="w-full h-full select-none inline-block overflow-visible align-middle"
      style={{ display: "inline-block" }}
    >
      <defs>
        {/* Dynamic scale Y blink animation */}
        <style>{`
          .lc-blinking .lc-eye-shape {
            transform: scaleY(0.06) !important;
          }
          .lc-eye-shape {
            transform-origin: 50% 48px;
            transition: transform 0.08s ease-out;
          }
        `}</style>
        {/* Exact Homepage Creature Blue Gradient (white bottom -> VoxKage blue top) */}
        <linearGradient id="lc-body-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="12%" stopColor="#ffffff" />
          <stop offset="68%" stopColor="#338cec" />
          <stop offset="100%" stopColor="#338cec" />
        </linearGradient>
      </defs>

      {/* Main Egg-Shaped Creature Body — Exact Homepage Gradient Blue */}
      <path
        d="M 50 10 C 74 10, 90 28, 90 53 C 90 76, 72 90, 50 90 C 28 90, 10 76, 10 53 C 10 28, 26 10, 50 10 Z"
        fill="url(#lc-body-grad)"
      />

      {/* Synchronized Blinking Eyes Group */}
      <g id="lc-eyes-layer">
        {/* Left Eye */}
        <ellipse
          className="lc-eye-shape"
          cx="35"
          cy="48"
          rx="5.8"
          ry="9.5"
          fill="#ffffff"
        />

        {/* Right Eye */}
        <ellipse
          className="lc-eye-shape"
          cx="65"
          cy="48"
          rx="5.8"
          ry="9.5"
          fill="#ffffff"
        />
      </g>
    </svg>
  );
}
