"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * VoxKageCreature — Animated egg-shaped creature for the VoxKage homepage greeting.
 *
 * Features:
 *  1. Synchronized human-like random blinking (both eyes, 2.5–5.5s interval, 15% double-blink chance)
 *  2. One-shot hover wink ('<') on the right eye (380ms, then returns to normal)
 *  3. Re-triggerable full-body blue/white wave animation on every click (2.4s fluid upward sweep)
 *  4. Real-time slanted cut angry eyes (\ /) on 10 rapid clicks within 650ms windows
 *  5. Red gradient body overlay (strictly contained, no glow) during anger state
 *  6. Real-time 5-second calming cooldown: eyes smoothly un-slant + red overlay fades back to white
 */
export default function VoxKageCreature() {
  const containerRef = useRef<SVGSVGElement>(null);
  const [isNight, setIsNight] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  // Day/night detection: night = 7 PM (19:00) to 6 AM (06:00)
  useEffect(() => {
    const check = () => {
      const h = new Date().getHours();
      setIsNight(h >= 19 || h < 6);
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Theme detection mutation observer
  useEffect(() => {
    const checkTheme = () => {
      const isL = document.documentElement.classList.contains("light");
      setIsLightMode(isL);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = containerRef.current;
    if (!svg) return;

    // Narrow to non-null for use inside all closures
    const svgEl: SVGSVGElement = svg;

    // --- DOM refs ---
    const bodyRedOverlay = svgEl.querySelector<SVGPathElement>("#vc-body-red-overlay")!;
    const waveRect = svgEl.querySelector<SVGRectElement>("#vc-full-wave-rect")!;
    const eyesLayer = svgEl.querySelector<SVGGElement>("#vc-eyes-layer")!;
    const rightEyeNormal = svgEl.querySelector<SVGEllipseElement>("#vc-right-eye-normal")!;
    const rightEyeWink = svgEl.querySelector<SVGPathElement>("#vc-right-eye-wink")!;

    // --- State ---
    let rapidClickCount = 0;
    let lastClickTime = 0;
    let clickDecayTimer: ReturnType<typeof setTimeout> | null = null;
    let isEnraged = false;
    let isWinking = false;
    let winkTimeout: ReturnType<typeof setTimeout> | null = null;
    let waveAnimation: Animation | null = null;
    let rageAmount = 0;
    let rageAnimFrame: number | null = null;

    // === 1. SYNCHRONIZED HUMAN-LIKE RANDOM BLINKING ===
    function performSyncedBlink() {
      if (isWinking) return;
      eyesLayer.classList.add("vc-blinking");
      setTimeout(() => {
        eyesLayer.classList.remove("vc-blinking");
      }, 160);
    }

    function scheduleNextBlink() {
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

    // === 2. ONE-SHOT HOVER WINK ('<') ===
    function onMouseEnter() {
      if (isEnraged || isWinking) return;
      isWinking = true;
      rightEyeNormal.style.display = "none";
      rightEyeWink.style.display = "block";

      if (winkTimeout) clearTimeout(winkTimeout);
      winkTimeout = setTimeout(() => {
        rightEyeWink.style.display = "none";
        rightEyeNormal.style.display = "block";
        isWinking = false;
      }, 380);
    }
    svgEl.addEventListener("mouseenter", onMouseEnter);

    // === 3. RE-TRIGGERABLE FULL-BODY WAVE ANIMATION (2.4s Fluid Flow) ===
    function triggerFullBodyWave() {
      if (waveAnimation) waveAnimation.cancel();
      waveAnimation = waveRect.animate(
        [
          { transform: "translateY(125%)", opacity: 0.98 },
          { transform: "translateY(-125%)", opacity: 0 },
        ],
        { duration: 2400, easing: "cubic-bezier(0.12, 1, 0.25, 1)", fill: "forwards" }
      );
    }

    // === REAL-TIME SMOOTH MORPH ANIMATION LOOP ===
    function updateRageVisuals(
      targetRage: number,
      durationMs: number,
      onComplete?: () => void
    ) {
      if (rageAnimFrame) cancelAnimationFrame(rageAnimFrame);

      const startRage = rageAmount;
      const startTime = performance.now();

      function animate(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const easeProgress =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        rageAmount = startRage + (targetRage - startRage) * easeProgress;

        // Drive CSS custom property on the SVG element for clip-path morphing
        svgEl.style.setProperty("--vc-rage", String(rageAmount));
        bodyRedOverlay.style.opacity = String(rageAmount);

        if (progress < 1) {
          rageAnimFrame = requestAnimationFrame(animate);
        } else {
          onComplete?.();
        }
      }

      rageAnimFrame = requestAnimationFrame(animate);
    }

    // === 4. RAPID CLICKS & ANGER WITH 5S REAL-TIME CALMING COOLDOWN ===
    function enterEnragedMode() {
      isEnraged = true;
      updateRageVisuals(1.0, 300, () => {
        setTimeout(() => start5sCalmingCooldown(), 1000);
      });
    }

    function start5sCalmingCooldown() {
      updateRageVisuals(0.0, 5000, () => {
        rapidClickCount = 0;
        isEnraged = false;
      });
    }

    function onClick() {
      if (isEnraged) return;

      const now = Date.now();
      const timeSinceLastClick = now - lastClickTime;
      lastClickTime = now;

      if (timeSinceLastClick <= 650) {
        rapidClickCount++;
      } else {
        rapidClickCount = 1;
      }

      triggerFullBodyWave();

      if (rapidClickCount >= 10) {
        enterEnragedMode();
      } else {
        if (clickDecayTimer) clearTimeout(clickDecayTimer);
        clickDecayTimer = setTimeout(() => {
          if (!isEnraged && rapidClickCount > 0) rapidClickCount = 0;
        }, 1200);
      }
    }
    function onTouchStart(e: TouchEvent) {
      if (e.cancelable) {
        e.preventDefault();
      }
      onClick();
    }

    svgEl.addEventListener("click", onClick);
    svgEl.addEventListener("touchstart", onTouchStart, { passive: false });

    // --- Cleanup ---
    return () => {
      svgEl.removeEventListener("mouseenter", onMouseEnter);
      svgEl.removeEventListener("click", onClick);
      svgEl.removeEventListener("touchstart", onTouchStart);
      if (winkTimeout) clearTimeout(winkTimeout);
      if (clickDecayTimer) clearTimeout(clickDecayTimer);
      if (rageAnimFrame) cancelAnimationFrame(rageAnimFrame);
      if (waveAnimation) waveAnimation.cancel();
    };
  }, []);

  return (
    <>
      <style>{`
        /* === VoxKage Creature — Scoped Styles === */

        /* Eye blink: scaleY to near-zero, transform-origin at eye centre (cy=48) */
        .vc-blinking .vc-eye-shape {
          transform: scaleY(0.06) !important;
        }

        /* Slanted cut eye morphing driven by CSS variable --vc-rage */
        .vc-left-eye-container {
          clip-path: polygon(
            0% 0%,
            100% calc(var(--vc-rage, 0) * 45%),
            100% 100%,
            0% 100%
          );
        }
        .vc-right-eye-container {
          clip-path: polygon(
            0% calc(var(--vc-rage, 0) * 45%),
            100% 0%,
            100% 100%,
            0% 100%
          );
        }

        /* Wave rect starts off-screen below */
        .vc-full-wave-rect {
          pointer-events: none;
          transform: translateY(125%);
        }

        /* Red body overlay — strictly inside SVG, no glow */
        .vc-body-red-overlay {
          opacity: 0;
          pointer-events: none;
        }

        /* Eye capsule transform-origin must be at eye centre */
        .vc-eye-shape {
          transform-origin: 50% 48px;
          transition: transform 0.08s ease-out;
        }

        /* Night mode — blinking pixel stars */
        @keyframes vc-star-blink-a {
          0%, 49%   { opacity: 0; }
          50%, 100% { opacity: 1; }
        }
        @keyframes vc-star-blink-b {
          0%, 64%   { opacity: 1; }
          65%, 100% { opacity: 0; }
        }
        @keyframes vc-star-blink-c {
          0%, 34%   { opacity: 0; }
          35%, 70%  { opacity: 1; }
          71%, 100% { opacity: 0; }
        }
        .vc-star-1 { animation: vc-star-blink-a 1.8s steps(1, end) infinite 0.0s; }
        .vc-star-2 { animation: vc-star-blink-b 2.4s steps(1, end) infinite 0.6s; }
        .vc-star-3 { animation: vc-star-blink-c 2.0s steps(1, end) infinite 1.1s; }
        .vc-star-4 { animation: vc-star-blink-a 2.6s steps(1, end) infinite 0.9s; }
      `}</style>

      <div
        className="mb-6 flex flex-col justify-center items-center select-none"
        style={{ cursor: "pointer", gap: 0 }}
      >
        {/* Night mode: flat bright yellow moon + blinking pixel stars above the creature */}
        {isNight && !isLightMode && (
          <svg
            width="54"
            height="20"
            viewBox="0 0 100 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "block", marginBottom: -2, pointerEvents: "none" }}
            aria-hidden="true"
          >
            {/* Pixel stars — four at different positions, staggered blink timings */}
            <rect className="vc-star-1" x="8"  y="10" width="5" height="5" fill="#faf9f5" rx="1" />
            <rect className="vc-star-2" x="42" y="20" width="4" height="4" fill="#faf9f5" rx="1" />
            <rect className="vc-star-3" x="72" y="8"  width="4" height="4" fill="#faf9f5" rx="1" />
            <rect className="vc-star-4" x="22" y="5"  width="3" height="3" fill="#faf9f5" rx="0.5" />
            {/* Crescent moon — flat #fbbf24, NO glow, NO filter, NO animation */}
            <path
              d="M 72 26 C 82 18, 86 10, 78 4 C 88 4, 96 12, 92 22 C 89 30, 78 32, 72 26 Z"
              fill="#fbbf24"
            />
          </svg>
        )}

        <svg
          ref={containerRef}
          id="voxkage-creature-svg"
          width="54"
          height="54"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ "--vc-rage": "0", overflow: "visible" } as React.CSSProperties}
          aria-label="VoxKage interactive creature — click or hover to interact"
          role="img"
        >
          <defs>
            {/* Body clip path (egg shape) */}
            <clipPath id="vc-body-clip">
              <path d="M 50 10 C 74 10, 90 28, 90 53 C 90 76, 72 90, 50 90 C 28 90, 10 76, 10 53 C 10 28, 26 10, 50 10 Z" />
            </clipPath>

            {/* Click Wave Gradient — white bottom → cyan → deep cobalt top */}
            <linearGradient id="vc-wave-grad-blue" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.96} />
              <stop offset="30%" stopColor="#38bdf8" stopOpacity={0.9} />
              <stop offset="70%" stopColor="#0438c2" stopOpacity={0.95} />
              <stop offset="92%" stopColor="#020938" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#020938" stopOpacity={0} />
            </linearGradient>

            {/* Anger Gradient — white bottom → crimson red top (no glow, contained) */}
            <linearGradient id="vc-angry-red-body-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="35%" stopColor="#f87171" />
              <stop offset="75%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>

            {/* Light Mode Body Gradient — white bottom → VoxKage blue top */}
            <linearGradient id="vc-light-body-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="12%" stopColor="#ffffff" />
              <stop offset="68%" stopColor="#338cecff" />
              <stop offset="100%" stopColor="#338cecff" />
            </linearGradient>
          </defs>

          {/* Base Body — gradient blue in light mode, cream/cool-white in dark mode */}
          <path
            d="M 50 10 C 74 10, 90 28, 90 53 C 90 76, 72 90, 50 90 C 28 90, 10 76, 10 53 C 10 28, 26 10, 50 10 Z"
            fill={isLightMode ? "url(#vc-light-body-grad)" : (isNight ? "#eef0f8" : "#FAF9F5")}
          />

          {/* Red Gradient Anger Overlay (strictly contained, NO shadow/glow) */}
          <path
            id="vc-body-red-overlay"
            className="vc-body-red-overlay"
            d="M 50 10 C 74 10, 90 28, 90 53 C 90 76, 72 90, 50 90 C 28 90, 10 76, 10 53 C 10 28, 26 10, 50 10 Z"
            fill="url(#vc-angry-red-body-grad)"
          />

          {/* Full-Body Click Wave (clipped to egg body) */}
          <g clipPath="url(#vc-body-clip)">
            <rect
              id="vc-full-wave-rect"
              className="vc-full-wave-rect"
              x="0"
              y="-30"
              width="100"
              height="160"
              fill="url(#vc-wave-grad-blue)"
            />
          </g>

          {/* === EYES LAYER === */}
          <g id="vc-eyes-layer">
            {/* Left Eye — slanted clip driven by --vc-rage */}
            <g className="vc-left-eye-container">
              <ellipse
                className="vc-eye-shape"
                cx="35"
                cy="48"
                rx="5.8"
                ry="9.5"
                fill={isLightMode ? "#FAF9F5" : "#141413"}
              />
            </g>

            {/* Right Eye — slanted clip + hover wink shape */}
            <g className="vc-right-eye-container">
              <ellipse
                id="vc-right-eye-normal"
                className="vc-eye-shape"
                cx="65"
                cy="48"
                rx="5.8"
                ry="9.5"
                fill={isLightMode ? "#FAF9F5" : "#141413"}
              />
              {/* Hover Wink Shape '<' — hidden by default */}
              <path
                id="vc-right-eye-wink"
                d="M 71 43 L 60 48 L 71 53"
                stroke={isLightMode ? "#FAF9F5" : "#141413"}
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: "none" }}
              />
            </g>
          </g>
        </svg>
      </div>
    </>
  );
}
