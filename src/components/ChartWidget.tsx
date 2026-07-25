"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import {
  BarChart3,
  LineChart as LineIcon,
  TrendingUp,
  PieChart as PieIcon,
  Hexagon
} from "lucide-react";

interface ChartPoint {
  label: string;
  value: number;
  secondary_value?: number;
}

interface ChartWidgetProps {
  type: "line" | "area" | "bar" | "ring" | "radar";
  title: string;
  xLabel?: string;
  yLabel?: string;
  data: ChartPoint[];
  isExpanded?: boolean;
}

export default function ChartWidget({
  type,
  title,
  xLabel,
  yLabel,
  data,
  isExpanded = false
}: ChartWidgetProps) {
  const [chartStyle, setChartStyle] = useState<"area" | "line" | "bar" | "ring" | "radar">(type || "area");
  const [isLightMode, setIsLightMode] = useState(false);

  // Detect Light Mode via MutationObserver on html class
  useEffect(() => {
    const checkTheme = () => {
      setIsLightMode(document.documentElement.classList.contains("light"));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const hasSecondary = data.some(pt => pt.secondary_value !== undefined);

  // Derive intelligent series names without generic 'Primary/Secondary Metric' fallbacks
  const deriveSeriesNames = () => {
    if (yLabel) {
      return {
        primary: yLabel,
        secondary: `${yLabel} (Secondary)`
      };
    }
    
    const lowerTitle = (title || "").toLowerCase();
    if (lowerTitle.includes("performance")) {
      return { primary: "Performance Score", secondary: "Baseline Score" };
    }
    if (lowerTitle.includes("revenue") || lowerTitle.includes("sales")) {
      return { primary: "Actual Revenue", secondary: "Target Revenue" };
    }
    if (lowerTitle.includes("traffic") || lowerTitle.includes("user")) {
      return { primary: "Active Users", secondary: "Previous Period" };
    }
    if (lowerTitle.includes("cost") || lowerTitle.includes("expense")) {
      return { primary: "Actual Cost", secondary: "Budgeted Cost" };
    }
    if (lowerTitle.includes("latency") || lowerTitle.includes("speed")) {
      return { primary: "Response Time", secondary: "Target Latency" };
    }

    return { primary: "Primary Value", secondary: "Secondary Value" };
  };

  const { primary: primaryName, secondary: secondaryName } = deriveSeriesNames();

  // Palette for Pie/Ring slices
  const colorPalette = isLightMode
    ? ["#c96442", "#0284c7", "#7c3aed", "#059669", "#d97706", "#e11d48", "#2563eb"]
    : ["#cc785c", "#38bdf8", "#a855f7", "#34d399", "#fbbf24", "#f43f5e", "#60a5fa"];

  // Custom Glassmorphic Tooltip Card with Defined Data Names
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const itemLabel = label || payload[0]?.payload?.label || "";

    return (
      <div className="bg-[#111115]/95 [.light_&]:bg-[#faf9f5]/95 border border-zinc-800/80 [.light_&]:border-[#c3c2b7] px-3.5 py-2.5 rounded-xl backdrop-blur-md shadow-2xl select-text">
        {itemLabel && (
          <p className="text-[11px] font-mono font-medium text-zinc-400 [.light_&]:text-[#6c6a64] mb-1 pb-1 border-b border-zinc-800/60 [.light_&]:border-[#e6dfd8]">
            {xLabel ? `${xLabel}: ` : ""}{itemLabel}
          </p>
        )}
        <div className="flex flex-col gap-1">
          {payload.map((entry: any, index: number) => {
            let displayName = entry.name;
            if (entry.dataKey === "value" || displayName === "Primary Metric" || displayName === "value") {
              displayName = primaryName;
            } else if (entry.dataKey === "secondary_value" || displayName === "Secondary Metric" || displayName === "secondary_value") {
              displayName = secondaryName;
            } else if (!displayName || displayName === "undefined") {
              displayName = entry.payload?.label || `Item ${index + 1}`;
            }

            const entryColor = entry.color || (index === 0 ? (isLightMode ? "#c96442" : "#cc785c") : (isLightMode ? "#0284c7" : "#38bdf8"));

            return (
              <div key={index} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entryColor }} />
                <span className="font-medium text-zinc-300 [.light_&]:text-[#3d3d3a]">
                  {displayName}:
                </span>
                <span className="font-mono font-semibold text-zinc-100 [.light_&]:text-[#141413] ml-auto">
                  {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Calculate total for center of Ring chart
  const totalValue = data.reduce((acc, curr) => acc + (curr.value || 0), 0);

  return (
    <div className={`relative w-full max-w-full overflow-hidden mx-auto bg-[#0c0c0e]/90 [.light_&]:bg-[#faf9f5] border border-zinc-850/60 [.light_&]:border-[#e6dfd8] rounded-2xl p-4 sm:p-6 shadow-2xl [.light_&]:shadow-xl flex flex-col justify-between select-none transition-all duration-300 ${
      isExpanded ? "h-[85vh] my-0 p-6 sm:p-8" : "h-[460px] sm:h-[510px] my-3"
    }`}>
      {/* Header and Style Switcher */}
      <div className="flex justify-between items-center select-text gap-3 shrink-0">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7] text-[#cc785c] [.light_&]:text-[#c96442] shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h4 className="text-zinc-100 [.light_&]:text-[#141413] font-serif text-base sm:text-lg md:text-xl font-normal tracking-tight truncate">
              {title}
            </h4>
          </div>
        </div>

        {/* 5-Type Chart Style Selector */}
        <div className="flex items-center gap-1 bg-[#141419] [.light_&]:bg-[#efe9de] p-1 rounded-xl border border-zinc-800/60 [.light_&]:border-[#c3c2b7] shrink-0">
          <button
            type="button"
            onClick={() => setChartStyle("area")}
            title="Area Chart"
            className={`p-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              chartStyle === "area"
                ? "bg-zinc-900 border border-zinc-800 text-zinc-100 [.light_&]:bg-[#faf9f5] [.light_&]:border-[#c3c2b7] [.light_&]:text-[#141413] shadow-sm font-semibold"
                : "text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-200 [.light_&]:hover:text-[#141413]"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-400 [.light_&]:text-[#d97706]" />
            <span className="hidden md:inline">Area</span>
          </button>

          <button
            type="button"
            onClick={() => setChartStyle("line")}
            title="Line Chart"
            className={`p-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              chartStyle === "line"
                ? "bg-zinc-900 border border-zinc-800 text-zinc-100 [.light_&]:bg-[#faf9f5] [.light_&]:border-[#c3c2b7] [.light_&]:text-[#141413] shadow-sm font-semibold"
                : "text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-200 [.light_&]:hover:text-[#141413]"
            }`}
          >
            <LineIcon className="w-3.5 h-3.5 text-[#cc785c] [.light_&]:text-[#c96442]" />
            <span className="hidden md:inline">Line</span>
          </button>

          <button
            type="button"
            onClick={() => setChartStyle("bar")}
            title="Bar Chart"
            className={`p-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              chartStyle === "bar"
                ? "bg-zinc-900 border border-zinc-800 text-zinc-100 [.light_&]:bg-[#faf9f5] [.light_&]:border-[#c3c2b7] [.light_&]:text-[#141413] shadow-sm font-semibold"
                : "text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-200 [.light_&]:hover:text-[#141413]"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400 [.light_&]:text-[#059669]" />
            <span className="hidden md:inline">Bar</span>
          </button>

          <button
            type="button"
            onClick={() => setChartStyle("ring")}
            title="Ring / Donut Chart"
            className={`p-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              chartStyle === "ring"
                ? "bg-zinc-900 border border-zinc-800 text-zinc-100 [.light_&]:bg-[#faf9f5] [.light_&]:border-[#c3c2b7] [.light_&]:text-[#141413] shadow-sm font-semibold"
                : "text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-200 [.light_&]:hover:text-[#141413]"
            }`}
          >
            <PieIcon className="w-3.5 h-3.5 text-sky-400 [.light_&]:text-[#0284c7]" />
            <span className="hidden md:inline">Ring</span>
          </button>

          <button
            type="button"
            onClick={() => setChartStyle("radar")}
            title="Radar / Spider Chart"
            className={`p-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              chartStyle === "radar"
                ? "bg-zinc-900 border border-zinc-800 text-zinc-100 [.light_&]:bg-[#faf9f5] [.light_&]:border-[#c3c2b7] [.light_&]:text-[#141413] shadow-sm font-semibold"
                : "text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-200 [.light_&]:hover:text-[#141413]"
            }`}
          >
            <Hexagon className="w-3.5 h-3.5 text-purple-400 [.light_&]:text-[#7c3aed]" />
            <span className="hidden md:inline">Radar</span>
          </button>
        </div>
      </div>

      {/* Ring Center Metrics Text Overlay (Rendered outside ResponsiveContainer) */}
      {chartStyle === "ring" && (
        <div className="absolute inset-0 top-12 flex flex-col items-center justify-center pointer-events-none z-10 pb-10">
          <span className="font-serif text-3xl sm:text-4xl font-normal text-zinc-100 [.light_&]:text-[#141413] tracking-tight">
            {totalValue.toLocaleString()}
          </span>
          <span className="text-[11px] font-mono text-zinc-400 [.light_&]:text-[#6c6a64] uppercase tracking-wider mt-0.5">
            Total {yLabel || "Metric"}
          </span>
        </div>
      )}

      {/* Chart Canvas Area */}
      <div className="w-full flex-1 min-h-0 relative z-0 pt-4 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartStyle === "area" ? (
            <AreaChart data={data} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
              <defs>
                <linearGradient id="areaGradientPrimary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isLightMode ? "#c96442" : "#cc785c"} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={isLightMode ? "#c96442" : "#cc785c"} stopOpacity={0.02} />
                </linearGradient>
                {hasSecondary && (
                  <linearGradient id="areaGradientSecondary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isLightMode ? "#0284c7" : "#38bdf8"} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={isLightMode ? "#0284c7" : "#38bdf8"} stopOpacity={0.02} />
                  </linearGradient>
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isLightMode ? "#e6dfd8" : "#1c1c21"} vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: isLightMode ? "#6c6a64" : "#a1a1aa", fontSize: 11, fontFamily: "sans-serif" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: isLightMode ? "#6c6a64" : "#a1a1aa", fontSize: 11, fontFamily: "sans-serif" }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: isLightMode ? "#c3c2b7" : "#27272a", strokeWidth: 1 }} />
              
              <Area
                type="monotone"
                name={primaryName}
                dataKey="value"
                stroke={isLightMode ? "#c96442" : "#cc785c"}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#areaGradientPrimary)"
                activeDot={{ r: 6, strokeWidth: 2, stroke: isLightMode ? "#faf9f5" : "#0c0c0e", fill: isLightMode ? "#c96442" : "#cc785c" }}
                dot={{ r: 0 }}
              />
              {hasSecondary && (
                <Area
                  type="monotone"
                  name={secondaryName}
                  dataKey="secondary_value"
                  stroke={isLightMode ? "#0284c7" : "#38bdf8"}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#areaGradientSecondary)"
                  activeDot={{ r: 6, strokeWidth: 2, stroke: isLightMode ? "#faf9f5" : "#0c0c0e", fill: isLightMode ? "#0284c7" : "#38bdf8" }}
                  dot={{ r: 0 }}
                />
              )}
            </AreaChart>
          ) : chartStyle === "line" ? (
            <LineChart data={data} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isLightMode ? "#e6dfd8" : "#1c1c21"} vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: isLightMode ? "#6c6a64" : "#a1a1aa", fontSize: 11, fontFamily: "sans-serif" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: isLightMode ? "#6c6a64" : "#a1a1aa", fontSize: 11, fontFamily: "sans-serif" }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: isLightMode ? "#c3c2b7" : "#27272a", strokeWidth: 1 }} />
              <Line
                type="monotone"
                name={primaryName}
                dataKey="value"
                stroke={isLightMode ? "#c96442" : "#cc785c"}
                strokeWidth={2.5}
                dot={{ stroke: isLightMode ? "#c96442" : "#cc785c", strokeWidth: 2, r: 4, fill: isLightMode ? "#faf9f5" : "#0c0c0e" }}
                activeDot={{ stroke: isLightMode ? "#c96442" : "#cc785c", strokeWidth: 2, r: 6, fill: isLightMode ? "#c96442" : "#cc785c" }}
              />
              {hasSecondary && (
                <Line
                  type="monotone"
                  name={secondaryName}
                  dataKey="secondary_value"
                  stroke={isLightMode ? "#0284c7" : "#38bdf8"}
                  strokeWidth={2.5}
                  dot={{ stroke: isLightMode ? "#0284c7" : "#38bdf8", strokeWidth: 2, r: 4, fill: isLightMode ? "#faf9f5" : "#0c0c0e" }}
                  activeDot={{ stroke: isLightMode ? "#0284c7" : "#38bdf8", strokeWidth: 2, r: 6, fill: isLightMode ? "#0284c7" : "#38bdf8" }}
                />
              )}
            </LineChart>
          ) : chartStyle === "bar" ? (
            <BarChart data={data} margin={{ top: 15, right: 15, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isLightMode ? "#e6dfd8" : "#1c1c21"} vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: isLightMode ? "#6c6a64" : "#a1a1aa", fontSize: 11, fontFamily: "sans-serif" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: isLightMode ? "#6c6a64" : "#a1a1aa", fontSize: 11, fontFamily: "sans-serif" }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: isLightMode ? "rgba(0, 0, 0, 0.03)" : "rgba(255, 255, 255, 0.03)" }} />
              <Bar
                name={primaryName}
                dataKey="value"
                fill={isLightMode ? "#c96442" : "#cc785c"}
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
              />
              {hasSecondary && (
                <Bar
                  name={secondaryName}
                  dataKey="secondary_value"
                  fill={isLightMode ? "#0284c7" : "#38bdf8"}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
              )}
            </BarChart>
          ) : chartStyle === "ring" ? (
            <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
              <Pie
                data={data}
                cx="50%"
                cy="48%"
                innerRadius={isExpanded ? 115 : 90}
                outerRadius={isExpanded ? 165 : 135}
                paddingAngle={4}
                dataKey="value"
                nameKey="label"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colorPalette[index % colorPalette.length]}
                    stroke={isLightMode ? "#faf9f5" : "#0c0c0e"}
                    strokeWidth={2.5}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(val) => (
                  <span className="text-xs font-medium text-zinc-300 [.light_&]:text-[#141413] px-1">
                    {val}
                  </span>
                )}
              />
            </PieChart>
          ) : (
            <RadarChart cx="50%" cy="50%" outerRadius={isExpanded ? 200 : 155} data={data}>
              <PolarGrid stroke={isLightMode ? "#c3c2b7" : "#27272a"} />
              <PolarAngleAxis
                dataKey="label"
                tick={{ fill: isLightMode ? "#6c6a64" : "#a1a1aa", fontSize: 12, fontFamily: "sans-serif" }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, "auto"]}
                tick={{ fill: isLightMode ? "#8e8b82" : "#52525b", fontSize: 10 }}
              />
              <Radar
                name={primaryName}
                dataKey="value"
                stroke={isLightMode ? "#c96442" : "#cc785c"}
                fill={isLightMode ? "#c96442" : "#cc785c"}
                fillOpacity={0.45}
              />
              {hasSecondary && (
                <Radar
                  name={secondaryName}
                  dataKey="secondary_value"
                  stroke={isLightMode ? "#0284c7" : "#38bdf8"}
                  fill={isLightMode ? "#0284c7" : "#38bdf8"}
                  fillOpacity={0.35}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Axis Labels Info Footer */}
      {(xLabel || yLabel) && (
        <div className="flex justify-between items-center text-xs text-zinc-400 [.light_&]:text-[#6c6a64] px-2 font-mono border-t border-zinc-800/60 [.light_&]:border-[#e6dfd8] pt-2.5 shrink-0">
          <span>{xLabel ? `X-Axis: ${xLabel}` : ""}</span>
          <span>{yLabel ? `Y-Axis: ${yLabel}` : ""}</span>
        </div>
      )}
    </div>
  );
}
