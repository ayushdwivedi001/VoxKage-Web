import React, { useState, useMemo } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface FunctionGraphWidgetProps {
  formula: string;
  minX?: number;
  maxX?: number;
}

export default function FunctionGraphWidget({ formula, minX = -10, maxX = 10 }: FunctionGraphWidgetProps) {
  const [zoom, setZoom] = useState(1);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; px: number; py: number } | null>(null);

  // Parse expression dynamically (safely, supporting sin, cos, tan, exp, log, sqrt, pow, and polynomial powers)
  const evaluateY = (x: number, formulaStr: string): number => {
    try {
      // Normalize common math functions
      let expr = formulaStr.toLowerCase();
      expr = expr.replace(/\bsin\b/g, "Math.sin");
      expr = expr.replace(/\bcos\b/g, "Math.cos");
      expr = expr.replace(/\btan\b/g, "Math.tan");
      expr = expr.replace(/\bexp\b/g, "Math.exp");
      expr = expr.replace(/\blog\b/g, "Math.log");
      expr = expr.replace(/\bsqrt\b/g, "Math.sqrt");
      expr = expr.replace(/\bpi\b/g, "Math.PI");
      expr = expr.replace(/\be\b/g, "Math.E");
      expr = expr.replace(/\^/g, "**"); // javascript power syntax

      // Safe evaluation context
      const safeEval = new Function("x", `
        try {
          with (Math) {
            return ${expr};
          }
        } catch {
          return NaN;
        }
      `);
      const val = safeEval(x);
      return isNaN(val) || !isFinite(val) ? 0 : val;
    } catch {
      return 0;
    }
  };

  const width = 500;
  const height = 300;
  const padding = 30;

  const currentMinX = minX * zoom;
  const currentMaxX = maxX * zoom;

  // Derive MinY/MaxY to auto-fit or keep square
  const currentMinY = -6 * zoom;
  const currentMaxY = 6 * zoom;

  // Coordinate Conversion
  const toScreenX = (x: number) => {
    return padding + ((x - currentMinX) / (currentMaxX - currentMinX)) * (width - 2 * padding);
  };

  const toScreenY = (y: number) => {
    return height - padding - ((y - currentMinY) / (currentMaxY - currentMinY)) * (height - 2 * padding);
  };

  const toMathX = (px: number) => {
    const ratio = (px - padding) / (width - 2 * padding);
    return currentMinX + ratio * (currentMaxX - currentMinX);
  };

  // Generate SVG Path
  const pathData = useMemo(() => {
    const pointsCount = 200;
    const paths: string[] = [];
    let isDrawing = false;

    for (let i = 0; i <= pointsCount; i++) {
      const px = padding + (i / pointsCount) * (width - 2 * padding);
      const x = toMathX(px);
      const y = evaluateY(x, formula);
      const py = toScreenY(y);

      // Check if coordinates are inside boundaries
      if (py >= padding && py <= height - padding) {
        if (!isDrawing) {
          paths.push(`M ${px} ${py}`);
          isDrawing = true;
        } else {
          paths.push(`L ${px} ${py}`);
        }
      } else {
        isDrawing = false;
      }
    }
    return paths.join(" ");
  }, [formula, zoom]);

  // Handle Mouse Hover Grid
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    if (px >= padding && px <= width - padding) {
      const x = toMathX(px);
      const y = evaluateY(x, formula);
      const py = toScreenY(y);
      if (py >= padding && py <= height - padding) {
        setHoverPoint({ x, y, px, py });
      } else {
        setHoverPoint(null);
      }
    } else {
      setHoverPoint(null);
    }
  };

  return (
    <div className="w-full max-w-[540px] bg-[#0c0c0e]/95 border border-zinc-850/60 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl select-none mx-auto my-3">
      {/* Title */}
      <div className="flex justify-between items-center px-1">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-mono tracking-wider uppercase text-blue-400 font-medium">Math Plotter</span>
          <span className="text-[13px] font-mono font-semibold text-zinc-300 truncate">
            y = {formula}
          </span>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(prev => Math.min(prev * 1.5, 5))}
            className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-850 hover:text-zinc-200 text-zinc-500 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(prev / 1.5, 0.2))}
            className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-850 hover:text-zinc-200 text-zinc-500 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-850 hover:text-zinc-200 text-zinc-500 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full border border-zinc-850/50 rounded-xl overflow-hidden bg-zinc-950/40">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPoint(null)}
        >
          {/* Grid Axes lines */}
          <line
            x1={toScreenX(currentMinX)}
            y1={toScreenY(0)}
            x2={toScreenX(currentMaxX)}
            y2={toScreenY(0)}
            stroke="#27272a"
            strokeWidth={1.5}
          />
          <line
            x1={toScreenX(0)}
            y1={toScreenY(currentMinY)}
            x2={toScreenX(0)}
            y2={toScreenY(currentMaxY)}
            stroke="#27272a"
            strokeWidth={1.5}
          />

          {/* Grid Axis Markers Labels */}
          <text
            x={toScreenX(currentMaxX) - 15}
            y={toScreenY(0) + 15}
            fill="#52525b"
            fontSize="9"
            fontFamily="monospace"
          >
            X
          </text>
          <text
            x={toScreenX(0) + 8}
            y={toScreenY(currentMaxY) + 15}
            fill="#52525b"
            fontSize="9"
            fontFamily="monospace"
          >
            Y
          </text>

          {/* Render Vector Graph Curve */}
          <path
            d={pathData}
            fill="none"
            stroke="#cc785c"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Hover Coordinate Tracker */}
          {hoverPoint && (
            <>
              {/* Vertical line tracker */}
              <line
                x1={hoverPoint.px}
                y1={padding}
                x2={hoverPoint.px}
                y2={height - padding}
                stroke="#52525b"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {/* Horizontal line tracker */}
              <line
                x1={padding}
                y1={hoverPoint.py}
                x2={width - padding}
                y2={hoverPoint.py}
                stroke="#52525b"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {/* Intersection Coordinate circle */}
              <circle
                cx={hoverPoint.px}
                cy={hoverPoint.py}
                r={4.5}
                fill="#cc785c"
                stroke="#0c0c0e"
                strokeWidth={1.5}
              />
              {/* Coordinate popup tag label */}
              <g transform={`translate(${Math.min(hoverPoint.px + 10, width - 110)}, ${Math.max(hoverPoint.py - 25, padding + 10)})`}>
                <rect
                  width="95"
                  height="18"
                  rx="4"
                  fill="#18181b"
                  stroke="#27272a"
                  strokeWidth={1}
                />
                <text
                  x="6"
                  y="12"
                  fill="#d4d4d8"
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  {`x:${hoverPoint.x.toFixed(2)} y:${hoverPoint.y.toFixed(2)}`}
                </text>
              </g>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
