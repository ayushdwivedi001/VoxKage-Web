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
    const activeRadius = 160; // Radius around cursor where dots turn VoxKage blue

    const render = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const mouse = mouseRef.current;

      // 1. Draw pitch black background
      ctx.fillStyle = "#040406";
      ctx.fillRect(0, 0, width, height);

      // 2. Draw minimal subtle bottom VoxKage blue ambient gradient overlay
      const bgGrad = ctx.createLinearGradient(0, height, 0, height * 0.2);
      bgGrad.addColorStop(0, "rgba(4, 56, 194, 0.08)"); // minimal subtle ambient glow
      bgGrad.addColorStop(1, "rgba(4, 4, 6, 0)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 3. Draw dense dotted grid (crisp, clearly visible white dots)
      const cols = Math.ceil(width / dotSpacing) + 1;
      const rows = Math.ceil(height / dotSpacing) + 1;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * dotSpacing;
          const y = j * dotSpacing;

          let radius = baseDotRadius;
          let r = 255;
          let g = 255;
          let b = 255;
          let alpha = 0.35;

          // Mouse reactivity calculation
          if (mouse.active) {
            const dx = x - mouse.x;
            const dy = y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < activeRadius) {
              const factor = 1 - dist / activeRadius;
              const intensity = factor * factor; // Quadratic falloff

              // Interpolate towards vibrant VoxKage blue (#38bdf8 / rgb(56, 189, 248))
              r = Math.round(255 + (56 - 255) * intensity);
              g = Math.round(255 + (189 - 255) * intensity);
              b = Math.round(255 + (248 - 255) * intensity);
              alpha = 0.35 + 0.6 * intensity;
              radius = baseDotRadius + 1.25 * intensity;
            }
          }

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.fill();
        }
      }

      animFrameId = requestAnimationFrame(render);
    };

    render();

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
