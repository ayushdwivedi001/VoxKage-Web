"use client";

import React, { useState, useId } from "react";
import {
  GitCommit,
  Layers,
  Database,
  Cpu,
  User,
  Cloud,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowDown
} from "lucide-react";

interface FlowNode {
  id: string;
  label: string;
  description?: string;
  category?: string;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

interface FlowWidgetProps {
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  isExpanded?: boolean;
}

export default function FlowWidget({ title, nodes, edges, isExpanded = false }: FlowWidgetProps) {
  const markerId = useId();
  const [zoom, setZoom] = useState(1);

  // 1. Calculate Hierarchical Ranks (Levels) for Vertical Top-to-Bottom Flow
  const levels: { [id: string]: number } = {};
  nodes.forEach(n => (levels[n.id] = 0));

  // Topological rank propagation
  for (let i = 0; i < nodes.length; i++) {
    edges.forEach(e => {
      const fromLvl = levels[e.from] ?? 0;
      levels[e.to] = Math.max(levels[e.to] ?? 0, fromLvl + 1);
    });
  }

  // Group nodes by level (Vertical rows)
  const nodesByLevel: { [lvl: number]: FlowNode[] } = {};
  nodes.forEach(n => {
    const lvl = levels[n.id] ?? 0;
    if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
    nodesByLevel[lvl].push(n);
  });

  const levelKeys = Object.keys(nodesByLevel).map(Number).sort((a, b) => a - b);
  const maxLvl = levelKeys.length > 0 ? Math.max(...levelKeys) : 0;
  const maxNodesInLevel = Math.max(...Object.values(nodesByLevel).map(arr => arr.length), 1);

  // 2. Vertical Flow Dimensions (Mermaid TD Style)
  const cardW = 180;
  const cardH = 54;
  const colSpacing = 220; // Horizontal gap between parallel branch cards
  const rowSpacing = 115; // Vertical gap between consecutive levels (61px clear gap)
  const marginX = 35;
  const marginY = 40;

  const canvasWidth = Math.max(700, maxNodesInLevel * colSpacing + marginX * 2);
  const canvasHeight = Math.max(450, (maxLvl + 1) * rowSpacing + marginY * 2);

  // Calculate coordinates: Levels flow Top to Bottom, parallel nodes spread Horizontally
  const coords: { [id: string]: { x: number; y: number } } = {};

  levelKeys.forEach(lvl => {
    const levelNodes = nodesByLevel[lvl];
    const rowY = marginY + lvl * rowSpacing;
    const totalLevelWidth = (levelNodes.length - 1) * colSpacing + cardW;
    const startX = marginX + (canvasWidth - marginX * 2 - totalLevelWidth) / 2;

    levelNodes.forEach((node, idx) => {
      coords[node.id] = {
        x: startX + idx * colSpacing,
        y: rowY
      };
    });
  });

  const handleZoomIn = () => setZoom(z => Math.min(1.8, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom(z => Math.max(0.4, +(z - 0.15).toFixed(2)));
  const handleResetZoom = () => setZoom(1);

  const getCategoryIcon = (category?: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("api") || cat.includes("network") || cat.includes("cloud")) {
      return <Cloud className="w-4 h-4 text-sky-400 [.light_&]:text-[#0284c7] shrink-0" />;
    }
    if (cat.includes("db") || cat.includes("storage") || cat.includes("database")) {
      return <Database className="w-4 h-4 text-emerald-400 [.light_&]:text-[#059669] shrink-0" />;
    }
    if (cat.includes("cpu") || cat.includes("system") || cat.includes("process")) {
      return <Cpu className="w-4 h-4 text-purple-400 [.light_&]:text-[#7c3aed] shrink-0" />;
    }
    if (cat.includes("user") || cat.includes("client")) {
      return <User className="w-4 h-4 text-amber-400 [.light_&]:text-[#d97706] shrink-0" />;
    }
    return <Layers className="w-4 h-4 text-[#cc785c] [.light_&]:text-[#c96442] shrink-0" />;
  };

  const getCategoryBorder = (category?: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("api") || cat.includes("network")) return "border-sky-500/40 [.light_&]:border-sky-500/50";
    if (cat.includes("db") || cat.includes("storage")) return "border-emerald-500/40 [.light_&]:border-emerald-500/50";
    if (cat.includes("cpu") || cat.includes("system")) return "border-purple-500/40 [.light_&]:border-purple-500/50";
    if (cat.includes("user")) return "border-amber-500/40 [.light_&]:border-amber-500/50";
    return "border-zinc-800 [.light_&]:border-[#c3c2b7]";
  };

  return (
    <div className={`relative w-full max-w-full overflow-hidden mx-auto bg-[#0c0c0e]/90 [.light_&]:bg-[#faf9f5] border border-zinc-850/60 [.light_&]:border-[#e6dfd8] rounded-2xl p-4 sm:p-6 shadow-2xl [.light_&]:shadow-xl flex flex-col justify-between select-none transition-all duration-300 ${
      isExpanded ? "h-[85vh] my-0 p-6 sm:p-8" : "h-[460px] sm:h-[510px] my-3"
    }`}>
      {/* --- TOP HEADER BAR & ZOOM CONTROLS --- */}
      <div className="flex justify-between items-center select-text gap-3 pb-3 border-b border-zinc-800/70 [.light_&]:border-[#e6dfd8] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7] text-[#cc785c] [.light_&]:text-[#c96442] shrink-0">
            <GitCommit className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-mono tracking-wider uppercase font-medium text-zinc-400 [.light_&]:text-[#6c6a64]">
              Vertical Process Flow (Mermaid TD)
            </span>
            <h4 className="text-zinc-100 [.light_&]:text-[#141413] font-serif text-base sm:text-lg md:text-xl font-normal tracking-tight truncate">
              {title}
            </h4>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-[#141419] [.light_&]:bg-[#efe9de] p-1 rounded-xl border border-zinc-800/60 [.light_&]:border-[#c3c2b7] shrink-0">
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-100 [.light_&]:hover:text-[#141413] hover:bg-zinc-800/60 [.light_&]:hover:bg-[#faf9f5] transition-all cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-mono font-medium text-zinc-300 [.light_&]:text-[#141413] px-1 min-w-[36px] text-center">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1.5 rounded-lg text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-100 [.light_&]:hover:text-[#141413] hover:bg-zinc-800/60 [.light_&]:hover:bg-[#faf9f5] transition-all cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-zinc-800 [.light_&]:bg-[#c3c2b7] mx-0.5" />

          <button
            type="button"
            onClick={handleResetZoom}
            title="Reset View"
            className="p-1.5 rounded-lg text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-100 [.light_&]:hover:text-[#141413] hover:bg-zinc-800/60 [.light_&]:hover:bg-[#faf9f5] transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* --- SCROLLABLE VERTICAL DIAGRAM BOARD STAGE --- */}
      <div className="flex-1 w-full min-h-0 relative overflow-auto custom-scrollbar border border-zinc-800/80 [.light_&]:border-[#c3c2b7] bg-zinc-950/60 [.light_&]:bg-[#efe9de]/60 rounded-xl mt-3">
        <div
          style={{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
          className="relative mx-auto"
        >
          {/* Subtle Grid Background Pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [.light_&]:bg-[radial-gradient(#c3c2b7_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

          {/* SVG Connection Edges Layer */}
          <svg width={canvasWidth} height={canvasHeight} className="absolute inset-0 pointer-events-none z-0 overflow-visible">
            <defs>
              {/* Downward pointing arrowhead - Dark Mode */}
              <marker
                id={`${markerId}-arrow-dark`}
                viewBox="0 0 10 10"
                refX="5"
                refY="8"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 1.5 0 L 5 8 L 8.5 0 z" fill="#cc785c" opacity="0.95" />
              </marker>

              {/* Downward pointing arrowhead - Light Mode */}
              <marker
                id={`${markerId}-arrow-light`}
                viewBox="0 0 10 10"
                refX="5"
                refY="8"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 1.5 0 L 5 8 L 8.5 0 z" fill="#c96442" opacity="0.95" />
              </marker>
            </defs>

            {edges.map((edge, idx) => {
              const S = coords[edge.from];
              const D = coords[edge.to];
              if (!S || !D) return null;

              // Top-to-Bottom Flow: Output port = bottom center of source card; Input port = top center of dest card
              const sourceX = S.x + cardW / 2;
              const sourceY = S.y + cardH;
              const destX = D.x + cardW / 2;
              const destY = D.y - 4;

              // Vertical Bezier curve control points
              const dy = Math.max(destY - sourceY, 40);
              const controlY1 = sourceY + dy * 0.45;
              const controlY2 = destY - dy * 0.45;
              const pathD = `M ${sourceX} ${sourceY} C ${sourceX} ${controlY1}, ${destX} ${controlY2}, ${destX} ${destY}`;

              return (
                <g key={idx} className="group/edge">
                  {/* Bezier connection line - Dark Mode */}
                  <path
                    d={pathD}
                    stroke="#cc785c"
                    strokeWidth={2}
                    fill="none"
                    markerEnd={`url(#${markerId}-arrow-dark)`}
                    strokeDasharray="5 4"
                    className="opacity-80 group-hover/edge:opacity-100 group-hover/edge:stroke-amber-400 transition-all duration-300 [.light_&]:hidden"
                  />

                  {/* Bezier connection line - Light Mode */}
                  <path
                    d={pathD}
                    stroke="#c96442"
                    strokeWidth={2.25}
                    fill="none"
                    markerEnd={`url(#${markerId}-arrow-light)`}
                    strokeDasharray="5 4"
                    className="opacity-85 group-hover/edge:opacity-100 group-hover/edge:stroke-[#d97706] transition-all duration-300 hidden [.light_&]:block"
                  />
                </g>
              );
            })}
          </svg>

          {/* Node Cards Layer (z-10) */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            {nodes.map(node => {
              const coord = coords[node.id];
              if (!coord) return null;

              const borderClass = getCategoryBorder(node.category);

              return (
                <div
                  key={node.id}
                  style={{
                    position: "absolute",
                    left: `${coord.x}px`,
                    top: `${coord.y}px`,
                    width: `${cardW}px`,
                    height: `${cardH}px`,
                  }}
                  className={`pointer-events-auto rounded-xl border bg-zinc-900/95 [.light_&]:bg-[#faf9f5] p-2.5 flex flex-col justify-center gap-0.5 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-[1.03] select-text group/node ${borderClass}`}
                >
                  {/* Category Icon & Node Label */}
                  <div className="flex items-center gap-2 w-full min-w-0">
                    {getCategoryIcon(node.category)}
                    <span className="text-[11.5px] font-semibold text-zinc-100 [.light_&]:text-[#141413] truncate leading-snug">
                      {node.label}
                    </span>
                  </div>

                  {/* Description subtitle */}
                  {node.description && node.description !== "empty" && (
                    <span className="text-[9.5px] text-zinc-400 [.light_&]:text-[#6c6a64] font-normal truncate w-full pl-6 leading-none">
                      {node.description}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Floating Edge Labels Layer (z-20 - Fits in the 61px vertical gap between rows) */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            {edges.map((edge, idx) => {
              if (!edge.label || edge.label === "empty") return null;

              const S = coords[edge.from];
              const D = coords[edge.to];
              if (!S || !D) return null;

              const sourceX = S.x + cardW / 2;
              const sourceY = S.y + cardH;
              const destX = D.x + cardW / 2;
              const destY = D.y;

              const midX = (sourceX + destX) / 2;
              const midY = (sourceY + destY) / 2;

              return (
                <div
                  key={`edge-label-${idx}`}
                  style={{
                    position: "absolute",
                    left: `${midX}px`,
                    top: `${midY}px`,
                    transform: "translate(-50%, -50%)"
                  }}
                  className="pointer-events-auto bg-zinc-900/95 [.light_&]:bg-[#faf9f5] border border-zinc-800/90 [.light_&]:border-[#c3c2b7] px-2 py-0.5 rounded-md shadow-md text-[9.5px] font-mono font-medium text-zinc-300 [.light_&]:text-[#141413] whitespace-nowrap"
                >
                  {edge.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
