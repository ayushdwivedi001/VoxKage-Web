"use client";

import React, { useEffect, useRef } from "react";

interface DesignDottedCanvasProps {
  active?: boolean;
  isChatActive?: boolean;
}

export default function DesignDottedCanvas({ active = false, isChatActive = false }: DesignDottedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ripplesRef = useRef<Array<{ x: number; y: number; startTime: number; maxRadius: number; duration: number }>>([]);
  const chatActiveRef = useRef(isChatActive);
  const dimProgressRef = useRef(isChatActive ? 1 : 0);

  useEffect(() => {
    chatActiveRef.current = isChatActive;
  }, [isChatActive]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Check if user clicked on interactive elements (buttons, prompt box, input, links, etc.)
      const isInteractive = target.closest(
        'button, a, input, textarea, select, [role="button"], [role="menuitem"], [role="option"], .prompt-textarea, .prompt-overlay, .fluid-glass-box-frosty, .fluid-glass-pill, .fluid-glass-popup, header, sidebar, nav, [data-interactive="true"]'
      );

      if (window.innerWidth < 768) return;
      if (isInteractive) return;

      // Spawn a new click ripple wave (tiny 2-dot circular click effect)
      ripplesRef.current.push({
        x: e.clientX,
        y: e.clientY,
        startTime: performance.now(),
        maxRadius: 45,
        duration: 350,
      });
    };

    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("click", handleClick);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    if (typeof window !== "undefined" && window.innerWidth < 768) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;
    let startTime: number | null = null;

    const resize = () => {
      if (window.innerWidth < 768) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener("resize", resize);
    resize();

    const dotSpacing = 22;
    const baseDotRadius = 1.35;

    const render = (timestamp: number) => {
      if (window.innerWidth < 768) {
        return;
      }
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const isLight = typeof document !== "undefined" && document.documentElement.classList.contains("light");

      // Smooth dimming interpolation towards target (0.0 homepage -> 1.0 active session)
      const targetDim = chatActiveRef.current ? 1 : 0;
      dimProgressRef.current += (targetDim - dimProgressRef.current) * 0.08;
      const dim = dimProgressRef.current; // 0.0 -> 1.0

      // Filter active ripples
      ripplesRef.current = ripplesRef.current.filter((r) => timestamp - r.startTime < r.duration);
      const activeRipples = ripplesRef.current;

      // 1. Left-to-Right Entrance Sweep Progress (0.0 -> 1.0 over 1.6s)
      const sweepDuration = 1.6;
      const rawSweep = Math.min(1, elapsed / sweepDuration);
      const sweepProgress = 1 - Math.pow(1 - rawSweep, 3);

      const width = window.innerWidth;
      const height = window.innerHeight;

      // Fill canvas background based on theme mode
      ctx.fillStyle = isLight ? "#DBDAD4" : "#040406";
      ctx.fillRect(0, 0, width, height);

      // In light theme: plain flat background only, no dots or ocean waves
      if (isLight) {
        animFrameId = requestAnimationFrame(render);
        return;
      }
      const ambientAlpha = (isLight ? 0.04 : 0.07) * (1 - dim * 0.35);
      const bgGrad = ctx.createLinearGradient(0, height, 0, height * 0.35);
      if (isLight) {
        bgGrad.addColorStop(0, `rgba(4, 56, 194, ${ambientAlpha})`);
        bgGrad.addColorStop(1, "rgba(219, 218, 212, 0)");
      } else {
        bgGrad.addColorStop(0, `rgba(4, 56, 194, ${ambientAlpha})`);
        bgGrad.addColorStop(1, "rgba(4, 4, 6, 0)");
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const cols = Math.ceil(width / dotSpacing) + 1;
      const rows = Math.ceil(height / dotSpacing) + 1;
      const sweepBoundaryX = width * sweepProgress;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const baseX = i * dotSpacing;
          const baseY = j * dotSpacing;

          const normX = baseX / width;
          const normY = baseY / height;

          // 2. High-amplitude ocean wave formula
          const wave1 = Math.sin(normX * 3.6 - elapsed * 0.85) * 0.16;
          const wave2 = Math.cos(normX * 2.2 + elapsed * 0.55) * 0.11;
          const wave3 = Math.sin(normX * 5.2 - elapsed * 1.25) * 0.06;
          const waveVal = wave1 + wave2 + wave3;

          const waveSurfaceNormY = 0.52 - waveVal;
          const isBelowWaveSurface = normY >= waveSurfaceNormY;

          const distFromSweep = (baseX - sweepBoundaryX) / 180;
          const sweepFactor = Math.max(0, Math.min(1, 1 - distFromSweep));

          // 3. Dynamic High-Amplitude Wave Displacement
          let dx = 0;
          let dy = 0;
          let isBlueWaveDot = false;
          let waveZoneIntensity = 0;

          if (isBelowWaveSurface && sweepFactor > 0) {
            isBlueWaveDot = true;
            const depthRatio = Math.min(1, (normY - waveSurfaceNormY) / (1 - waveSurfaceNormY));
            waveZoneIntensity = (1 - depthRatio * 0.35) * sweepFactor;

            dy = (Math.sin(normX * 4.5 - elapsed * 1.8 + normY * 5.0) * 26 +
                  Math.cos(normX * 2.8 + elapsed * 1.2) * 14) * waveZoneIntensity;
            dx = Math.cos(normX * 3.2 + elapsed * 1.1 + normY * 3.0) * 10 * waveZoneIntensity;
          }

          let renderX = baseX + dx;
          let renderY = baseY + dy;

          // 4. Click Ripple Wave Animation (tiny 2-dot circular click effect)
          let totalRippleDx = 0;
          let totalRippleDy = 0;
          let maxRippleIntensity = 0;

          for (let k = 0; k < activeRipples.length; k++) {
            const ripple = activeRipples[k];
            const age = (timestamp - ripple.startTime) / ripple.duration;
            if (age < 0 || age > 1) continue;

            const currentRadius = ripple.maxRadius * Math.pow(age, 0.7);
            const rdx = renderX - ripple.x;
            const rdy = renderY - ripple.y;
            const dist = Math.sqrt(rdx * rdx + rdy * rdy);

            const ringDist = Math.abs(dist - currentRadius);
            const ringWidth = 16;

            if (ringDist < ringWidth) {
              const fadeOut = Math.sin((1 - age) * Math.PI);
              const ringForce = Math.cos((ringDist / ringWidth) * (Math.PI / 2)) * fadeOut;

              if (ringForce > 0) {
                const angle = Math.atan2(rdy, rdx);
                const waveDisplacement = Math.sin((dist - currentRadius) * 0.25) * 4 * ringForce;
                
                totalRippleDx += Math.cos(angle) * waveDisplacement;
                totalRippleDy += Math.sin(angle) * waveDisplacement;
                maxRippleIntensity = Math.max(maxRippleIntensity, ringForce);
              }
            }
          }

          renderX += totalRippleDx;
          renderY += totalRippleDy;

          // 5. Color & Radius Styling
          let radius = baseDotRadius;
          let r = isLight ? 0 : 255;
          let g = isLight ? 0 : 255;
          let b = isLight ? 0 : 255;
          // Normal non-wave dots turn proper black in light mode, white in dark mode
          let alpha = (isLight ? 0.28 : 0.28) * (1 - dim * 0.89);

          let isGlowDot = false;
          if (isBlueWaveDot && sweepFactor > 0) {
            isGlowDot = true;

            // Interpolate colors based on dim state
            const startR = isLight ? 29 : 56;
            const startG = isLight ? 78 : 189;
            const startB = isLight ? 216 : 248;

            const endR = isLight ? 0 : 200;
            const endG = isLight ? 0 : 210;
            const endB = isLight ? 0 : 230;

            const targetR = Math.round(startR + (endR - startR) * dim);
            const targetG = Math.round(startG + (endG - startG) * dim);
            const targetB = Math.round(startB + (endB - startB) * dim);

            r = targetR;
            g = targetG;
            b = targetB;
            
            // Reduce alpha and glow radius during active sessions to lower diversion
            alpha = (0.85 - dim * 0.55) * sweepFactor * (1 - dim * 0.22);
            radius = baseDotRadius + (0.45 - dim * 0.15) * sweepFactor * (1 - dim * 0.15);
          }

          if (maxRippleIntensity > 0) {
            // Ripple color is sky blue in dark mode, royal blue in light mode
            const ripR = isLight ? 29 : 56;
            const ripG = isLight ? 78 : 189;
            const ripB = isLight ? 216 : 248;
            r = Math.round(r + (ripR - r) * maxRippleIntensity);
            g = Math.round(g + (ripG - g) * maxRippleIntensity);
            b = Math.round(b + (ripB - b) * maxRippleIntensity);
            alpha = Math.min(0.95, alpha + 0.45 * maxRippleIntensity);
            radius = Math.max(radius, baseDotRadius + 0.85 * maxRippleIntensity);
          }

          // Main dot rendering
          ctx.beginPath();
          ctx.arc(renderX, renderY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fill();

          // Render secondary wide-glow halo for blue ocean wave dots to simulate water glow
          if (isGlowDot) {
            ctx.beginPath();
            ctx.arc(renderX, renderY, radius * 2.5, 0, Math.PI * 2);
            // Lower the glowing effect during active session (from 0.22 down to 0.05)
            const glowAlphaScale = 0.22 - dim * 0.17;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * glowAlphaScale})`;
            ctx.fill();
          }
        }
      }

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 2,
        pointerEvents: "none",
      }}
      className={`hidden md:block transition-opacity duration-700 ease-out ${
        active ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
