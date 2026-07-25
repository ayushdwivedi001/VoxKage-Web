"use client";

import React, { useState, useMemo } from "react";
import { TimelineEvent } from "@/lib/chatHelpers";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Layers,
  Award,
  Wrench,
  Milestone
} from "lucide-react";

interface TimelineWidgetProps {
  title: string;
  events: TimelineEvent[];
  isExpanded?: boolean;
}

export default function TimelineWidget({ title, events, isExpanded = false }: TimelineWidgetProps) {
  // Collapsed by default as requested by user
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Extract unique category tags
  const categories = useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => {
      if (e.category && e.category !== "empty") {
        set.add(e.category.trim());
      }
    });
    return Array.from(set);
  }, [events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (selectedCategory === "all") return events;
    return events.filter(
      e => e.category && e.category.trim().toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [events, selectedCategory]);

  const toggleExpand = (idx: number) => {
    setExpandedIndex(prev => (prev === idx ? null : idx));
  };

  const getCategoryIcon = (category?: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("release") || cat.includes("launch")) {
      return <Sparkles className="w-3.5 h-3.5 text-zinc-700 [.light_&]:text-[#141413]" />;
    }
    if (cat.includes("milestone") || cat.includes("founded")) {
      return <Milestone className="w-3.5 h-3.5 text-zinc-700 [.light_&]:text-[#141413]" />;
    }
    if (cat.includes("tool") || cat.includes("refresh")) {
      return <Wrench className="w-3.5 h-3.5 text-zinc-700 [.light_&]:text-[#141413]" />;
    }
    if (cat.includes("flagship") || cat.includes("specialist") || cat.includes("enterprise")) {
      return <Award className="w-3.5 h-3.5 text-zinc-700 [.light_&]:text-[#141413]" />;
    }
    return <Layers className="w-3.5 h-3.5 text-zinc-700 [.light_&]:text-[#141413]" />;
  };

  // Date range summary
  const dateRange = useMemo(() => {
    if (events.length === 0) return "";
    const first = events[0].date;
    const last = events[events.length - 1].date;
    return `${first} – ${last}`;
  }, [events]);

  return (
    <div className={`relative w-full max-w-full overflow-hidden mx-auto bg-[#0c0c0e]/90 [.light_&]:bg-[#faf9f5] border border-zinc-850/60 [.light_&]:border-[#e6dfd8] rounded-2xl p-4 sm:p-6 shadow-2xl [.light_&]:shadow-xl flex flex-col justify-between transition-all duration-300 ${
      isExpanded ? "h-[85vh] my-0 p-6 sm:p-8" : "h-auto my-3"
    }`}>
      {/* --- TOP HEADER BAR --- */}
      <div className="flex flex-col gap-3 pb-3 border-b border-zinc-800/70 [.light_&]:border-[#e6dfd8] shrink-0">
        <div className="flex items-center justify-between gap-3 select-text">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7] text-zinc-200 [.light_&]:text-[#141413] shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-mono tracking-wider uppercase font-medium text-zinc-400 [.light_&]:text-[#6c6a64]">
                Historical Sequence Timeline
              </span>
              <h4 className="text-zinc-100 [.light_&]:text-[#141413] font-serif text-base sm:text-lg md:text-xl font-normal tracking-tight truncate">
                {title}
              </h4>
            </div>
          </div>

          {/* Event Count & Date Range Pill */}
          <div className="flex items-center gap-2 shrink-0">
            {dateRange && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-zinc-900 [.light_&]:bg-[#efe9de] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-zinc-300 [.light_&]:text-[#141413]">
                <Calendar className="w-3 h-3 text-zinc-400 [.light_&]:text-[#6c6a64]" />
                {dateRange}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-zinc-900 [.light_&]:bg-[#141413] border border-zinc-800 [.light_&]:border-[#141413] text-zinc-200 [.light_&]:text-[#faf9f5]">
              {events.length} events
            </span>
          </div>
        </div>

        {/* Category Filter Pills (VoxKage Aesthetics: Selected = Dark Ink #141413, Unselected = Creamy #efe9de) */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pt-1 pb-0.5 select-none">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1 rounded-lg text-[11.5px] font-medium font-sans transition-all shrink-0 cursor-pointer border ${
                selectedCategory === "all"
                  ? "bg-zinc-100 text-zinc-950 border-zinc-100 [.light_&]:bg-[#141413] [.light_&]:text-[#faf9f5] [.light_&]:border-[#141413] shadow-sm font-semibold"
                  : "bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800/80 [.light_&]:bg-[#efe9de] [.light_&]:text-[#3d3d3a] [.light_&]:border-[#c3c2b7] [.light_&]:hover:bg-[#e6dfd8]"
              }`}
            >
              All ({events.length})
            </button>
            {categories.map((cat, idx) => {
              const count = events.filter(e => e.category?.trim().toLowerCase() === cat.toLowerCase()).length;
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-[11.5px] font-medium font-sans transition-all shrink-0 cursor-pointer capitalize border ${
                    isSelected
                      ? "bg-zinc-100 text-zinc-950 border-zinc-100 [.light_&]:bg-[#141413] [.light_&]:text-[#faf9f5] [.light_&]:border-[#141413] shadow-sm font-semibold"
                      : "bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border-zinc-800/80 [.light_&]:bg-[#efe9de] [.light_&]:text-[#3d3d3a] [.light_&]:border-[#c3c2b7] [.light_&]:hover:bg-[#e6dfd8]"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* --- TIMELINE STREAM FEED (Auto-height fits all events vertically in normal view) --- */}
      <div className={`w-full min-h-0 relative mt-3 select-text ${
        isExpanded ? "flex-1 overflow-y-auto custom-scrollbar pr-1 sm:pr-2" : "h-auto"
      }`}>
        <div className="relative border-l-2 border-zinc-800/80 [.light_&]:border-[#c3c2b7] ml-3.5 sm:ml-5 pl-5 sm:pl-7 flex flex-col gap-3 py-1">
          {filteredEvents.map((ev, idx) => {
            const isItemExpanded = expandedIndex === idx;

            return (
              <div
                key={idx}
                onClick={() => toggleExpand(idx)}
                className={`relative group rounded-xl border p-3 sm:p-4 transition-all duration-200 cursor-pointer select-none ${
                  isItemExpanded
                    ? "bg-zinc-900/95 [.light_&]:bg-[#faf9f5] border-zinc-700/90 [.light_&]:border-[#141413] shadow-md"
                    : "bg-zinc-950/40 [.light_&]:bg-[#efe9de]/60 border-zinc-850/60 [.light_&]:border-[#c3c2b7]/70 hover:border-zinc-700 [.light_&]:hover:border-[#141413] [.light_&]:hover:bg-[#efe9de]"
                }`}
              >
                {/* Timeline Chrono Node Indicator Dot */}
                <div
                  className={`absolute -left-[28px] sm:-left-[36px] top-4 w-4 h-4 rounded-full border-2 transition-all z-10 flex items-center justify-center ${
                    isItemExpanded
                      ? "bg-zinc-100 border-zinc-950 [.light_&]:bg-[#141413] [.light_&]:border-[#faf9f5] scale-125 shadow-md"
                      : "bg-zinc-950 [.light_&]:bg-[#faf9f5] border-zinc-700 [.light_&]:border-[#c3c2b7] group-hover:border-zinc-300 [.light_&]:group-hover:border-[#141413]"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isItemExpanded ? "bg-zinc-950 [.light_&]:bg-[#faf9f5]" : "bg-zinc-600 [.light_&]:bg-[#6c6a64]"}`} />
                </div>

                {/* Event Summary Bar (Entire card clickable!) */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                    {/* Date Pill */}
                    <span className="text-xs font-mono font-semibold text-zinc-100 [.light_&]:text-[#141413] bg-zinc-900 [.light_&]:bg-[#efe9de] px-2 py-0.5 rounded-md border border-zinc-800 [.light_&]:border-[#c3c2b7]">
                      {ev.date}
                    </span>

                    {/* Category Pill */}
                    {ev.category && ev.category !== "empty" && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-md border uppercase tracking-wider bg-zinc-900/80 text-zinc-300 border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:text-[#141413] [.light_&]:border-[#c3c2b7]">
                        {getCategoryIcon(ev.category)}
                        {ev.category}
                      </span>
                    )}

                    {/* Event Title */}
                    <h4 className="text-xs sm:text-sm font-semibold text-zinc-200 [.light_&]:text-[#141413] leading-snug truncate">
                      {ev.title}
                    </h4>
                  </div>

                  {/* Expand Chevron Toggle */}
                  {ev.description && (
                    <div className="p-1 rounded-md text-zinc-500 group-hover:text-zinc-200 [.light_&]:text-[#6c6a64] [.light_&]:group-hover:text-[#141413] transition-colors shrink-0">
                      {isItemExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  )}
                </div>

                {/* Expandable Paragraph Description (Revealed on click) */}
                {ev.description && isItemExpanded && (
                  <p className="text-xs sm:text-[13px] text-zinc-300 [.light_&]:text-[#3d3d3a] font-sans leading-relaxed mt-2.5 pt-2.5 border-t border-zinc-800/60 [.light_&]:border-[#e6dfd8] select-text animate-fadeIn">
                    {ev.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
