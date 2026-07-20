"use client";

import React, { useEffect, useRef } from "react";

interface DesignDottedCanvasProps {
  active?: boolean;
}

export default function DesignDottedCanvas({ active = false }: DesignDottedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -1000,
    y: -1000,
    active: false,
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
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

    const dotSpacing = 22;
    const baseDotRadius = 1.35;

    const render = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;

      // 1. Left-to-Right Entrance Sweep Progress (0.0 -> 1.0 over 1.6s)
      const sweepDuration = 1.6;
      const rawSweep = Math.min(1, elapsed / sweepDuration);
      // cubic-bezier easeOutCubic
      const sweepProgress = 1 - Math.pow(1 - rawSweep, 3);

      const width = window.innerWidth;
      const height = window.innerHeight;
      const mouse = mouseRef.current;

      // Pitch black background
      ctx.fillStyle = "#040406";
      ctx.fillRect(0, 0, width, height);

      // Subtle ambient bottom VoxKage blue background gradient
      const bgGrad = ctx.createLinearGradient(0, height, 0, height * 0.35);
      bgGrad.addColorStop(0, "rgba(4, 56, 194, 0.07)");
      bgGrad.addColorStop(1, "rgba(4, 4, 6, 0)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const cols = Math.ceil(width / dotSpacing) + 1;
      const rows = Math.ceil(height / dotSpacing) + 1;

      // Sweep boundary position
      const sweepBoundaryX = width * sweepProgress;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const baseX = i * dotSpacing;
          const baseY = j * dotSpacing;

          // Normalized coordinates (0.0 to 1.0)
          const normX = baseX / width;
          const normY = baseY / height; // 0.0 top, 1.0 bottom

          // 2. High-amplitude ocean wave formula
          const wave1 = Math.sin(normX * 3.6 - elapsed * 0.85) * 0.16;
          const wave2 = Math.cos(normX * 2.2 + elapsed * 0.55) * 0.11;
          const wave3 = Math.sin(normX * 5.2 - elapsed * 1.25) * 0.06;
          const waveVal = wave1 + wave2 + wave3;

          // Wave crest surface height (peaks higher up to ~65% height from bottom, i.e., normY ~ 0.52)
          const waveSurfaceNormY = 0.52 - waveVal;
          const isBelowWaveSurface = normY >= waveSurfaceNormY;

          // Sweep activation factor (left to right transition)
          const distFromSweep = (baseX - sweepBoundaryX) / 180;
          const sweepFactor = Math.max(0, Math.min(1, 1 - distFromSweep));

          // 3. Dynamic High-Amplitude Wave Displacement
          let dx = 0;
          let dy = 0;
          let isBlueWaveDot = false;
          let waveZoneIntensity = 0;

          if (isBelowWaveSurface && sweepFactor > 0) {
            isBlueWaveDot = true;

            // Distance ratio inside the wave region (0 at surface, 1 at bottom)
            const depthRatio = Math.min(1, (normY - waveSurfaceNormY) / (1 - waveSurfaceNormY));
            waveZoneIntensity = (1 - depthRatio * 0.35) * sweepFactor;

            // Deep ocean wave vertical & horizontal rolling motion
            dy = (Math.sin(normX * 4.5 - elapsed * 1.8 + normY * 5.0) * 26 +
                  Math.cos(normX * 2.8 + elapsed * 1.2) * 14) * waveZoneIntensity;
            dx = Math.cos(normX * 3.2 + elapsed * 1.1 + normY * 3.0) * 10 * waveZoneIntensity;
          }

          // Render coordinates before cursor displacement
          let renderX = baseX + dx;
          let renderY = baseY + dy;

          // 4. Ocean Wave Cursor Reactivity (Ocean ripple effect)
          let cursorIntensity = 0;
          let cursorDx = 0;
          let cursorDy = 0;

          if (mouse.active) {
            const mdx = renderX - mouse.x;
            const mdy = renderY - mouse.y;
            const dist = Math.sqrt(mdx * mdx + mdy * mdy);
            const oceanRadius = 190;

            if (dist < oceanRadius) {
              const force = Math.pow(1 - dist / oceanRadius, 1.4);
              cursorIntensity = force;

              // Ocean wave ripple push direction & amplitude
              const angle = Math.atan2(mdy, mdx);
              const waveRipple = Math.sin(dist * 0.07 - elapsed * 4.0) * 18 * force;
              cursorDx = Math.cos(angle) * waveRipple;
              cursorDy = Math.sin(angle) * waveRipple;
            }
          }

          renderX += cursorDx;
          renderY += cursorDy;

          // 5. Color & Radius Styling
          let radius = baseDotRadius;
          let r = 255;
          let g = 255;
          let b = 255;
          let alpha = 0.28;

          if (isBlueWaveDot && sweepFactor > 0) {
            // Wave region dots: VoxKage Cobalt Blue gradient
            // Surface = Sky cyan (#38bdf8), Core = Cobalt (#0438c2)
            const colorBlend = Math.min(1, (normY - waveSurfaceNormY) / 0.35);

            // Interpolate #38bdf8 (56, 189, 248) -> #0438c2 (4, 56, 194)
            r = Math.round(56 + (4 - 56) * colorBlend);
            g = Math.round(189 + (56 - 189) * colorBlend);
            b = Math.round(248 + (194 - 248) * colorBlend);
            alpha = (0.35 + 0.35 * (1 - colorBlend)) * sweepFactor;
            radius = baseDotRadius + 0.45 * sweepFactor;
          }

          // Cursor interaction boost (Ocean wave highlight)
          if (cursorIntensity > 0) {
            r = Math.round(r + (56 - r) * cursorIntensity);
            g = Math.round(g + (189 - g) * cursorIntensity);
            b = Math.round(b + (248 - b) * cursorIntensity);
            alpha = Math.min(0.95, alpha + 0.5 * cursorIntensity);
            radius = Math.max(radius, baseDotRadius + 1.4 * cursorIntensity);
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
