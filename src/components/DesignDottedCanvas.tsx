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

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;
    let startTime: number | null = null;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener("resize", resize);
    resize();

    const isMobile = window.innerWidth < 768;
    const dotSpacing = isMobile ? 14 : 22;
    const baseDotRadius = isMobile ? 1.0 : 1.35;

    const render = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;

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

      // Pitch black background
      ctx.fillStyle = "#040406";
      ctx.fillRect(0, 0, width, height);

      // Subtle ambient bottom VoxKage blue background gradient (softly tuned during active session)
      const ambientAlpha = 0.07 * (1 - dim * 0.35);
      const bgGrad = ctx.createLinearGradient(0, height, 0, height * 0.35);
      bgGrad.addColorStop(0, `rgba(4, 56, 194, ${ambientAlpha})`);
      bgGrad.addColorStop(1, "rgba(4, 4, 6, 0)");
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
          let r = 255;
          let g = 255;
          let b = 255;
          // Normal non-wave dots turn pitch dark (0.28 homepage -> 0.03 active session)
          let alpha = 0.28 * (1 - dim * 0.89);

          if (isBlueWaveDot && sweepFactor > 0) {
            const colorBlend = Math.min(1, (normY - waveSurfaceNormY) / 0.35);
            const targetR = Math.round(56 + (4 - 56) * colorBlend);
            const targetG = Math.round(189 + (56 - 189) * colorBlend);
            const targetB = Math.round(248 + (194 - 248) * colorBlend);

            // Blue ocean wave dots stay vibrant & clearly visible
            r = Math.round(targetR * (1 - dim * 0.22));
            g = Math.round(targetG * (1 - dim * 0.22));
            b = Math.round(targetB * (1 - dim * 0.12));
            alpha = (0.35 + 0.35 * (1 - colorBlend)) * sweepFactor * (1 - dim * 0.22);
            radius = baseDotRadius + 0.45 * sweepFactor * (1 - dim * 0.15);
          }

          if (maxRippleIntensity > 0) {
            r = Math.round(r + (56 - r) * maxRippleIntensity);
            g = Math.round(g + (189 - g) * maxRippleIntensity);
            b = Math.round(b + (248 - b) * maxRippleIntensity);
            alpha = Math.min(0.95, alpha + 0.45 * maxRippleIntensity);
            radius = Math.max(radius, baseDotRadius + 0.85 * maxRippleIntensity);
          }

          ctx.beginPath();
          ctx.arc(renderX, renderY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fill();
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
        zIndex: 5,
        pointerEvents: "none",
      }}
      className={`transition-opacity duration-700 ease-out ${
        active ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
