"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Move, Network, AlertTriangle } from "lucide-react";

interface MermaidWidgetProps {
  chart: string;
  isExpanded?: boolean;
}

export default function MermaidWidget({ chart, isExpanded = false }: MermaidWidgetProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLightMode, setIsLightMode] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`mermaid-${Math.floor(Math.random() * 100000)}`);

  // Detect Light Mode vs Dark Mode dynamically
  useEffect(() => {
    const checkTheme = () => {
      const isLight = document.documentElement.classList.contains("light");
      setIsLightMode(isLight);
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  // Render Diagram with dynamic theme variables
  useEffect(() => {
    let active = true;

    async function renderDiagram() {
      if (!chart || !chart.trim()) return;
      try {
        const mermaid = (await import("mermaid")).default;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: isLightMode ? "base" : "dark",
          themeVariables: isLightMode
            ? {
                background: "transparent",
                primaryColor: "#efe9de",
                primaryTextColor: "#141413",
                primaryBorderColor: "#c3c2b7",
                lineColor: "#cc785c",
                secondaryColor: "#e6dfd8",
                tertiaryColor: "#faf9f5",
                fontFamily: "Inter, var(--font-geist-sans), sans-serif",
                fontSize: "12px",
                nodeBorder: "#c3c2b7",
                clusterBkg: "#efe9de",
                clusterBorder: "#c3c2b7",
                titleColor: "#141413",
                edgeLabelBackground: "#efe9de"
              }
            : {
                background: "transparent",
                primaryColor: "#18181b",
                primaryTextColor: "#d4d4d8",
                primaryBorderColor: "#3f3f46",
                lineColor: "#cc785c",
                secondaryColor: "#27272a",
                tertiaryColor: "#09090b",
                fontFamily: "monospace",
                fontSize: "12px",
                nodeBorder: "#3f3f46",
                clusterBkg: "#18181b",
                clusterBorder: "#3f3f46",
                titleColor: "#f4f4f5",
                edgeLabelBackground: "#18181b"
              }
        });

        // Ensure unique element ID per render
        const uniqueId = `${idRef.current}-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, chart.trim());
        
        if (active) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: any) {
        console.error("Mermaid render error:", err);
        if (active) {
          setError("Failed to parse diagram notation.");
        }
      }
    }

    renderDiagram();

    return () => {
      active = false;
    };
  }, [chart, isLightMode]);

  // Zoom Handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.3));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Mouse Drag Panning Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on left mouse click
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Mouse Wheel Zooming Handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom(prev => Math.min(Math.max(prev + zoomFactor, 0.3), 3.5));
  };

  return (
    <div className={`relative w-full max-w-full overflow-hidden mx-auto bg-[#0c0c0e]/90 [.light_&]:bg-[#faf9f5] border border-zinc-850/60 [.light_&]:border-[#e6dfd8] rounded-2xl p-4 sm:p-6 shadow-2xl [.light_&]:shadow-xl flex flex-col justify-between select-none transition-all duration-300 ${
      isExpanded ? "h-[85vh] my-0 p-6 sm:p-8" : "h-[460px] sm:h-[510px] my-3"
    }`}>
      {/* --- TOP HEADER BAR --- */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-800/70 [.light_&]:border-[#e6dfd8] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7] text-sky-500 [.light_&]:text-sky-600 shrink-0">
            <Network className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-mono tracking-wider uppercase font-medium text-zinc-400 [.light_&]:text-[#6c6a64]">
              System Topology Engine
            </span>
            <h4 className="text-zinc-100 [.light_&]:text-[#141413] font-serif text-base sm:text-lg font-normal tracking-tight truncate">
              Architecture & Flow Diagram
            </h4>
          </div>
        </div>

        {/* Floating Zoom & Pan Controls Overlay */}
        <div className="flex items-center gap-1.5 bg-zinc-900/90 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] p-1 rounded-xl shadow-md z-10 select-none">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In (+)"
            className="p-1.5 rounded-lg text-zinc-300 [.light_&]:text-[#141413] hover:bg-zinc-800 [.light_&]:hover:bg-[#e6dfd8] transition-all cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out (-)"
            className="p-1.5 rounded-lg text-zinc-300 [.light_&]:text-[#141413] hover:bg-zinc-800 [.light_&]:hover:bg-[#e6dfd8] transition-all cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            title="Reset Zoom (100%)"
            className="px-2 py-1 rounded-lg text-[11px] font-mono text-zinc-300 [.light_&]:text-[#141413] hover:bg-zinc-800 [.light_&]:hover:bg-[#e6dfd8] transition-all cursor-pointer font-medium"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={handleFitView}
            title="Fit View"
            className="p-1.5 rounded-lg text-zinc-300 [.light_&]:text-[#141413] hover:bg-zinc-800 [.light_&]:hover:bg-[#e6dfd8] transition-all cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* --- INTERACTIVE PAN & ZOOM CANVAS AREA --- */}
      <div
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`relative flex-1 w-full min-h-0 overflow-hidden bg-zinc-950/60 [.light_&]:bg-[#efe9de]/50 rounded-xl border border-zinc-850/80 [.light_&]:border-[#c3c2b7]/70 flex items-center justify-center cursor-grab ${
          isDragging ? "cursor-grabbing" : ""
        }`}
      >
        {/* Background Grid Pattern */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: isLightMode
              ? `radial-gradient(#141413 1px, transparent 1px)`
              : `radial-gradient(#ffffff 1px, transparent 1px)`,
            backgroundSize: "20px 20px"
          }}
        />

        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-rose-400 font-mono text-xs z-10">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
            <span>{error}</span>
          </div>
        ) : svg ? (
          <div
            ref={containerRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.15s ease-out"
            }}
            className="w-full h-full flex items-center justify-center p-6 select-text transition-all"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-zinc-500 [.light_&]:text-[#6c6a64] animate-pulse z-10">
            <Network className="w-4 h-4 animate-spin" />
            <span>Compiling architecture diagram...</span>
          </div>
        )}

        {/* Drag Hint Tag */}
        <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded bg-zinc-900/80 [.light_&]:bg-[#faf9f5]/80 border border-zinc-800 [.light_&]:border-[#c3c2b7] text-[10px] font-mono text-zinc-400 [.light_&]:text-[#6c6a64] flex items-center gap-1 pointer-events-none">
          <Move className="w-3 h-3 text-sky-500" />
          <span>Click & Drag to Pan • Scroll to Zoom</span>
        </div>
      </div>
    </div>
  );
}
