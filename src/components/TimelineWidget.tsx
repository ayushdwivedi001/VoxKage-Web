import React, { useState } from "react";
import { TimelineEvent } from "@/lib/chatHelpers";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";

interface TimelineWidgetProps {
  title: string;
  events: TimelineEvent[];
}

export default function TimelineWidget({ title, events }: TimelineWidgetProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (idx: number) => {
    setExpandedIndex(prev => (prev === idx ? null : idx));
  };

  return (
    <div className="w-full max-w-[540px] bg-[#0c0c0e]/95 border border-zinc-850/60 rounded-2xl p-4.5 flex flex-col gap-4 shadow-2xl mx-auto my-3 select-none">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
        <Calendar className="w-4 h-4 text-rose-400" />
        <span className="text-[14px] font-semibold text-zinc-300 font-sans tracking-wide">
          {title}
        </span>
      </div>

      {/* Events Stream Stack */}
      <div className="relative border-l border-zinc-800 ml-3.5 pl-5 flex flex-col gap-5 py-1 select-text">
        {events.map((ev, idx) => {
          const isExpanded = expandedIndex === idx;

          return (
            <div key={idx} className="relative group flex flex-col gap-1.5">
              {/* Chrono Dot Indicator */}
              <button
                onClick={() => toggleExpand(idx)}
                className={`absolute -left-[27.5px] top-1.5 w-3.5 h-3.5 rounded-full border border-zinc-800 transition-all select-none ${
                  isExpanded
                    ? "bg-rose-450 border-rose-450 scale-110"
                    : "bg-[#0c0c0e] hover:border-rose-400"
                }`}
              />

              {/* Date & Category Tag */}
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-550 select-none">
                <span className="font-semibold text-rose-400">{ev.date}</span>
                {ev.category && ev.category !== "empty" && (
                  <>
                    <span className="text-zinc-700">•</span>
                    <span className="bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-900 text-zinc-450 lowercase">
                      {ev.category}
                    </span>
                  </>
                )}
              </div>

              {/* Event Title Row */}
              <div
                onClick={() => toggleExpand(idx)}
                className="flex items-center justify-between cursor-pointer group-hover:text-zinc-200 transition-colors"
              >
                <h4 className="text-[13px] font-semibold text-zinc-300 leading-snug">
                  {ev.title}
                </h4>
                {ev.description && (
                  <button className="text-zinc-650 hover:text-zinc-450 p-0.5 select-none">
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              {/* Expandable Description Details */}
              {ev.description && isExpanded && (
                <p className="text-[12px] text-zinc-400 font-sans leading-relaxed mt-0.5 bg-zinc-950/40 border border-zinc-900/60 p-2.5 rounded-xl animate-fadeIn">
                  {ev.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
