"use client";

import React, { useState } from "react";
import { CheckSquare, ChevronUp, ChevronDown, CheckCircle2, Circle, Loader2 } from "lucide-react";

export interface TaskItem {
  id: string;
  text: string;
  status: "pending" | "in_progress" | "completed";
}

interface TaskListWidgetProps {
  tasks: TaskItem[];
  isLightMode?: boolean;
}

export default function TaskListWidget({ tasks, isLightMode = false }: TaskListWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!tasks || tasks.length === 0) return null;

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount = tasks.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const isAllComplete = completedCount === totalCount && totalCount > 0;

  return (
    <div
      className={`w-full mb-2.5 rounded-2xl overflow-hidden border transition-all duration-300 ${
        isLightMode
          ? "bg-[#FAF9F5]/90 border-[#e6dfd8] text-[#3d3d3a] shadow-sm"
          : "bg-[#181715]/90 border-white/10 text-zinc-200 shadow-md shadow-black/40"
      } backdrop-blur-md animate-fadeIn select-none`}
    >
      {/* Compact Header Pill Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`p-1.5 rounded-lg ${
              isAllComplete
                ? "bg-emerald-500/15 text-emerald-500"
                : isLightMode
                ? "bg-[#cc785c]/10 text-[#cc785c]"
                : "bg-blue-500/15 text-blue-400"
            }`}
          >
            {isAllComplete ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <CheckSquare className="w-4 h-4" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-[13px] font-semibold ${
                isLightMode ? "text-[#141413]" : "text-white"
              }`}
            >
              Tasks ({completedCount}/{totalCount})
            </span>
            <div
              className={`w-16 h-1.5 rounded-full overflow-hidden ${
                isLightMode ? "bg-[#e6dfd8]" : "bg-white/10"
              }`}
            >
              <div
                className={`h-full transition-all duration-500 ${
                  isAllComplete ? "bg-emerald-500" : isLightMode ? "bg-[#cc785c]" : "bg-[#3A91EE]"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[11.5px] font-mono text-zinc-400 font-medium">
              {progressPercent}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-zinc-400">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 opacity-75" />
          ) : (
            <ChevronDown className="w-4 h-4 opacity-75" />
          )}
        </div>
      </div>

      {/* Expanded Task List View */}
      {isExpanded && (
        <div
          className={`px-4 py-3 border-t flex flex-col gap-2 max-h-56 overflow-y-auto ${
            isLightMode ? "border-[#e6dfd8] bg-[#f5f0e8]/40" : "border-white/10 bg-[#252320]/40"
          }`}
        >
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-2.5 text-[13px] leading-snug">
              <div className="mt-0.5 flex-shrink-0">
                {task.status === "completed" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : task.status === "in_progress" ? (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                ) : (
                  <Circle className={`w-4 h-4 ${isLightMode ? "text-zinc-400" : "text-zinc-500"}`} />
                )}
              </div>
              <span
                className={`flex-1 ${
                  task.status === "completed"
                    ? "line-through text-zinc-400"
                    : task.status === "in_progress"
                    ? isLightMode
                      ? "text-[#141413] font-medium"
                      : "text-white font-medium"
                    : isLightMode
                    ? "text-[#3d3d3a]"
                    : "text-zinc-300"
                }`}
              >
                {task.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
