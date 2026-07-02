import React from "react";
import { GitCommit, ArrowRight, Layers, Database, Cpu, User, Cloud } from "lucide-react";

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
  // 1. Hierarchical Layout Algorithm
  const levels: { [id: string]: number } = {};
  nodes.forEach(n => levels[n.id] = 0);

  // Propagate ranks based on directed connections
  for (let i = 0; i < 5; i++) {
    edges.forEach(e => {
      const fromLvl = levels[e.from] || 0;
      levels[e.to] = Math.max(levels[e.to] || 0, fromLvl + 1);
    });
  }

  // Group nodes by levels
  const nodesByLevel: { [lvl: number]: FlowNode[] } = {};
  nodes.forEach(n => {
    const lvl = levels[n.id] || 0;
    if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
    nodesByLevel[lvl].push(n);
  });

  const maxLvl = Math.max(...Object.values(levels), 0);
  const canvasWidth = isExpanded ? 1000 : 640;
  const canvasHeight = isExpanded ? 500 : 280;

  // Node box sizes: width 110px, height 50px
  const nodeW = 120;
  const nodeH = 54;

  const coords: { [id: string]: { x: number; y: number } } = {};

  Object.keys(nodesByLevel).forEach((lvlStr) => {
    const lvl = parseInt(lvlStr);
    const levelNodes = nodesByLevel[lvl];
    // Calculate column horizontal offsets
    const colX = maxLvl === 0 
      ? canvasWidth / 2 
      : (lvl / maxLvl) * (canvasWidth - nodeW - 80) + (nodeW / 2) + 40;

    levelNodes.forEach((n, idx) => {
      // Calculate row vertical offsets
      const rowY = levelNodes.length === 1
        ? canvasHeight / 2
        : (idx / (levelNodes.length - 1)) * (canvasHeight - nodeH - 80) + (nodeH / 2) + 40;
      coords[n.id] = { x: colX, y: rowY };
    });
  });

  const getCategoryIcon = (category?: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("api") || cat.includes("network")) return <Cloud className="w-3.5 h-3.5 text-blue-400" />;
    if (cat.includes("db") || cat.includes("storage")) return <Database className="w-3.5 h-3.5 text-emerald-400" />;
    if (cat.includes("cpu") || cat.includes("system")) return <Cpu className="w-3.5 h-3.5 text-purple-400" />;
    if (cat.includes("user")) return <User className="w-3.5 h-3.5 text-amber-400" />;
    return <Layers className="w-3.5 h-3.5 text-[#cc785c]" />;
  };

  const getCategoryStyles = (category?: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("api")) return "border-blue-900/40 bg-blue-950/15 text-blue-300";
    if (cat.includes("db")) return "border-emerald-900/40 bg-emerald-950/15 text-emerald-300";
    if (cat.includes("cpu")) return "border-purple-900/40 bg-purple-950/15 text-purple-300";
    if (cat.includes("user")) return "border-amber-900/40 bg-amber-950/15 text-amber-300";
    return "border-zinc-850 bg-zinc-900/70 text-zinc-300";
  };

  return (
    <div className={`relative w-full mx-auto bg-[#0c0c0e]/90 border border-zinc-850/60 rounded-2xl p-4.5 shadow-2xl flex flex-col gap-4 select-none transition-all duration-300 ${
      isExpanded ? "max-w-[1000px] my-0 p-6 md:p-8" : "max-w-[680px] my-4"
    }`}>
      {/* Title Header */}
      <div className="flex flex-col gap-1 select-text">
        <div className="flex items-center gap-1.5 text-zinc-550">
          <GitCommit className="w-3.5 h-3.5 text-[#cc785c]" />
          <span className="text-[11px] font-mono tracking-wider uppercase font-medium">Process Pipeline</span>
        </div>
        <span className="text-[14px] font-semibold text-zinc-300">
          {title}
        </span>
      </div>

      {/* SVG Canvas Board */}
      <div 
        className="w-full relative overflow-hidden border border-zinc-900/80 bg-zinc-950/45 rounded-xl"
        style={{ height: `${canvasHeight}px` }}
      >
        {/* Draw Connection Pipes/Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <marker
              id="arrowhead"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#cc785c" opacity="0.8" />
            </marker>
          </defs>

          {edges.map((edge, idx) => {
            const S = coords[edge.from];
            const D = coords[edge.to];
            if (!S || !D) return null;

            // Offset the connection lines to touch the borders of the nodes instead of centers
            const dx = D.x - S.x;
            const dy = D.y - S.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            
            // Nodes boundaries offsets
            const offsetSourceX = S.x + (dx / len) * (nodeW / 2);
            const offsetSourceY = S.y + (dy / len) * (nodeH / 2);
            const offsetDestX = D.x - (dx / len) * (nodeW / 2 + 6);
            const offsetDestY = D.y - (dy / len) * (nodeH / 2 + 6);

            // Compute bezier curve anchor offsets
            const controlX1 = offsetSourceX + (offsetDestX - offsetSourceX) * 0.5;
            const controlX2 = offsetDestX - (offsetDestX - offsetSourceX) * 0.5;
            const pathD = `M ${offsetSourceX} ${offsetSourceY} C ${controlX1} ${offsetSourceY}, ${controlX2} ${offsetDestY}, ${offsetDestX} ${offsetDestY}`;

            return (
              <g key={idx} className="group/path">
                {/* Background thicker hover path */}
                <path
                  d={pathD}
                  stroke="transparent"
                  strokeWidth={8}
                  fill="none"
                  className="cursor-pointer pointer-events-auto"
                />
                
                {/* Thin styled bezier wave path */}
                <path
                  d={pathD}
                  stroke="#cc785c"
                  strokeWidth={1.2}
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  className="opacity-55 group-hover/path:opacity-100 transition-all duration-300"
                  strokeDasharray="4 4"
                />

                {/* Optional overlay label on connecting line */}
                {edge.label && edge.label !== "empty" && (
                  <text
                    x={(offsetSourceX + offsetDestX) / 2}
                    y={(offsetSourceY + offsetDestY) / 2 - 6}
                    fill="#6c6a64"
                    fontSize="9.5px"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="bg-zinc-950 px-1 py-0.5"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Render Nodes Layer */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {nodes.map((node) => {
            const coord = coords[node.id];
            if (!coord) return null;

            const categoryStyle = getCategoryStyles(node.category);

            return (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  left: `${coord.x - nodeW / 2}px`,
                  top: `${coord.y - nodeH / 2}px`,
                  width: `${nodeW}px`,
                  height: `${nodeH}px`,
                }}
                className={`pointer-events-auto rounded-xl border p-2 flex flex-col gap-1 items-start shadow-lg justify-center transition-all duration-200 hover:scale-[1.03] select-text group/node ${categoryStyle}`}
              >
                {/* Node Label/Icon */}
                <div className="flex items-center gap-1.5 w-full min-w-0">
                  {getCategoryIcon(node.category)}
                  <span className="text-[11.5px] font-semibold truncate leading-none">
                    {node.label}
                  </span>
                </div>

                {/* Node Detail Description */}
                {node.description && node.description !== "empty" && (
                  <span className="text-[9.5px] text-zinc-500 font-light truncate w-full leading-none group-hover/node:text-zinc-400 transition-colors">
                    {node.description}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
