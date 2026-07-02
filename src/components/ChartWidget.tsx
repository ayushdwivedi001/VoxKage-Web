import React, { useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { BarChart3, LineChart as LineIcon, Activity, TrendingUp } from "lucide-react";

interface ChartPoint {
  label: string;
  value: number;
  secondary_value?: number;
}

interface ChartWidgetProps {
  type: "line" | "area" | "bar";
  title: string;
  xLabel?: string;
  yLabel?: string;
  data: ChartPoint[];
  isExpanded?: boolean;
}

export default function ChartWidget({ type, title, xLabel, yLabel, data, isExpanded = false }: ChartWidgetProps) {
  const [chartStyle, setChartStyle] = useState<"line" | "area" | "bar">(type);

  // Floating Glassmorphic Tooltip Card
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-[#111115]/95 border border-zinc-800/80 px-3 py-2 rounded-xl backdrop-blur-md shadow-2xl select-text">
        <p className="text-[11px] font-mono text-zinc-550 mb-0.5">{label}</p>
        <div className="flex flex-col gap-0.5">
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-[13px] font-semibold" style={{ color: entry.color || '#cc785c' }}>
              {entry.name}: <span className="font-mono text-zinc-200">{entry.value.toLocaleString()}</span>
            </p>
          ))}
        </div>
      </div>
    );
  };

  const hasSecondary = data.some(pt => pt.secondary_value !== undefined);

  return (
    <div className={`relative w-full mx-auto bg-[#0c0c0e]/90 border border-zinc-850/60 rounded-2xl p-4.5 shadow-2xl flex flex-col gap-4.5 select-none transition-all duration-300 ${
      isExpanded ? "max-w-[1000px] my-0 p-6 md:p-8" : "max-w-[680px] my-4"
    }`}>
      {/* Header and Style Switcher */}
      <div className="flex justify-between items-center select-text">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5 text-zinc-500">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-mono tracking-wider uppercase font-medium">Analytics Output</span>
          </div>
          <span className="text-[14px] font-semibold text-zinc-300 truncate">
            {title}
          </span>
        </div>

        {/* Style Switcher Selector */}
        <div className="flex gap-1 bg-zinc-950/60 border border-zinc-850 p-0.5 rounded-lg flex-shrink-0">
          <button
            onClick={() => setChartStyle("area")}
            className={`p-1 px-2 rounded-md text-[11px] font-medium transition-all select-none flex items-center gap-1 ${
              chartStyle === "area"
                ? "bg-zinc-900 border border-zinc-800 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Activity className="w-3 h-3 text-[#cc785c]" />
            <span className="hidden sm:inline">Area</span>
          </button>
          <button
            onClick={() => setChartStyle("line")}
            className={`p-1 px-2 rounded-md text-[11px] font-medium transition-all select-none flex items-center gap-1 ${
              chartStyle === "line"
                ? "bg-zinc-900 border border-zinc-800 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <LineIcon className="w-3 h-3 text-sky-400" />
            <span className="hidden sm:inline">Line</span>
          </button>
          <button
            onClick={() => setChartStyle("bar")}
            className={`p-1 px-2 rounded-md text-[11px] font-medium transition-all select-none flex items-center gap-1 ${
              chartStyle === "bar"
                ? "bg-zinc-900 border border-zinc-800 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <BarChart3 className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Bar</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className={`w-full relative z-0 transition-all duration-300 ${
        isExpanded ? "h-[450px]" : "h-[240px]"
      }`}>
        <ResponsiveContainer width="100%" height="100%">
          {chartStyle === "area" ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGradientPrimary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#cc785c" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#cc785c" stopOpacity={0.02} />
                </linearGradient>
                {hasSecondary && (
                  <linearGradient id="areaGradientSecondary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                  </linearGradient>
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c21" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#6c6a64", fontSize: 10, fontFamily: "monospace" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#6c6a64", fontSize: 10, fontFamily: "monospace" }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#27272a", strokeWidth: 1 }} />
              
              <Area
                type="monotone"
                name="Primary Metric"
                dataKey="value"
                stroke="#cc785c"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#areaGradientPrimary)"
                activeDot={{ r: 5, strokeWidth: 0, fill: "#cc785c" }}
                dot={{ r: 0 }} // Clean smooth line without points until hover
              />
              {hasSecondary && (
                <Area
                  type="monotone"
                  name="Secondary Metric"
                  dataKey="secondary_value"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#areaGradientSecondary)"
                  activeDot={{ r: 5, strokeWidth: 0, fill: "#38bdf8" }}
                  dot={{ r: 0 }}
                />
              )}
            </AreaChart>
          ) : chartStyle === "line" ? (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="lineStrokeGradientPrimary" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#cc785c" />
                  <stop offset="100%" stopColor="#c96442" />
                </linearGradient>
                {hasSecondary && (
                  <linearGradient id="lineStrokeGradientSecondary" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </linearGradient>
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c21" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#6c6a64", fontSize: 10, fontFamily: "monospace" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#6c6a64", fontSize: 10, fontFamily: "monospace" }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#27272a", strokeWidth: 1 }} />
              <Line
                type="monotone"
                name="Primary Metric"
                dataKey="value"
                stroke="url(#lineStrokeGradientPrimary)"
                strokeWidth={2}
                dot={{ stroke: "#cc785c", strokeWidth: 1.5, r: 3.5, fill: "#0c0c0e" }} // Hollow circles along the line for Line view
                activeDot={{ stroke: "#cc785c", strokeWidth: 2, r: 5.5, fill: "#cc785c" }}
              />
              {hasSecondary && (
                <Line
                  type="monotone"
                  name="Secondary Metric"
                  dataKey="secondary_value"
                  stroke="url(#lineStrokeGradientSecondary)"
                  strokeWidth={2}
                  dot={{ stroke: "#38bdf8", strokeWidth: 1.5, r: 3.5, fill: "#0c0c0e" }}
                  activeDot={{ stroke: "#38bdf8", strokeWidth: 2, r: 5.5, fill: "#38bdf8" }}
                />
              )}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c21" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#6c6a64", fontSize: 10, fontFamily: "monospace" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#6c6a64", fontSize: 10, fontFamily: "monospace" }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255, 255, 255, 0.02)" }} />
              <Bar
                name="Primary Metric"
                dataKey="value"
                fill="#cc785c"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              {hasSecondary && (
                <Bar
                  name="Secondary Metric"
                  dataKey="secondary_value"
                  fill="#38bdf8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Axis Labels Info Footer */}
      {(xLabel || yLabel) && (
        <div className="flex justify-between items-center text-[10px] text-zinc-550 px-2 font-mono">
          <span>{xLabel ? `X-Axis: ${xLabel}` : ""}</span>
          <span>{yLabel ? `Y-Axis: ${yLabel}` : ""}</span>
        </div>
      )}
    </div>
  );
}
