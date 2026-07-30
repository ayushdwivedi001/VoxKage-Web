"use client";

import React, { useState } from "react";
import { MessageSquare, ChevronDown, ChevronUp, ArrowRight, Plus, Trash2, Pencil, Check, CheckCircle2 } from "lucide-react";
import { renderFormattedContent } from "@/lib/chatHelpers";

interface PlanOutputCardProps {
  title: string;
  content: string;
  isLightMode?: boolean;
  onProceed?: (title: string, comments: string[]) => void;
  isExecuted?: boolean;
}

export default function PlanOutputCard({
  title,
  content,
  isLightMode = false,
  onProceed,
  isExecuted = false,
}: PlanOutputCardProps) {
  const [showReviewDrawer, setShowReviewDrawer] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [hasProceeded, setHasProceeded] = useState(isExecuted);

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    setComments((prev) => [...prev, newCommentText.trim()]);
    setNewCommentText("");
  };

  const handleRemoveComment = (index: number) => {
    setComments((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingText("");
    }
  };

  const handleStartEdit = (index: number, text: string) => {
    setEditingIndex(index);
    setEditingText(text);
  };

  const handleSaveEdit = (index: number) => {
    if (!editingText.trim()) return;
    setComments((prev) => {
      const copy = [...prev];
      copy[index] = editingText.trim();
      return copy;
    });
    setEditingIndex(null);
    setEditingText("");
  };

  const handleProceedClick = () => {
    if (hasProceeded || !onProceed) return;
    setHasProceeded(true);
    onProceed(title, comments);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Mobile screen check: ignore enter on touch/mobile screens to prevent accidental additions
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      if (!isMobile) {
        e.preventDefault();
        handleAddComment();
      }
    }
  };

  // Extract clean plan markdown (strip <task_list> tags if present in body content)
  const cleanMarkdown = content
    .replace(/<task_list>[\s\S]*?<\/task_list>/gi, "")
    .trim();

  return (
    <div
      className={`w-full my-4 rounded-2xl overflow-hidden border transition-all duration-300 ${
        isLightMode
          ? "bg-[#FAF9F5] border-[#e6dfd8] text-[#3d3d3a]"
          : "bg-[#181715] border-white/10 text-zinc-200"
      }`}
    >
      {/* Dynamic Style tag to force H1/H2/H3 subheadings to #338CEC */}
      <style>{`
        .plan-content-body h1,
        .plan-content-body h2,
        .plan-content-body h3,
        .plan-content-body h4 {
          color: #338CEC !important;
          font-weight: 700;
        }
      `}</style>

      {/* Header Banner */}
      <div
        className={`px-6 pt-5 pb-4 border-b ${
          isLightMode ? "border-[#e6dfd8] bg-[#f5f0e8]" : "border-white/10 bg-[#252320]"
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <span
            className={`text-[11px] font-black uppercase tracking-[0.18em] ${
              isLightMode ? "text-[#141413]" : "text-white"
            }`}
          >
            Implementation Plan
          </span>
          {hasProceeded && (
            <span className="flex items-center gap-1 text-[11.5px] font-medium text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Plan Approved</span>
            </span>
          )}
        </div>
        <h2 className="text-xl sm:text-2xl font-serif font-bold leading-tight text-[#338CEC]">
          {title || "Task Execution Blueprint"}
        </h2>
      </div>

      {/* Main Markdown Body Content */}
      <div className="plan-content-body px-6 py-5 overflow-x-auto text-[14.5px] leading-relaxed select-text whitespace-pre-wrap">
        {renderFormattedContent(cleanMarkdown)}
      </div>

      {/* Review Drawer & Footer Controls */}
      <div
        className={`px-6 py-4 border-t flex flex-col gap-3 ${
          isLightMode ? "border-[#e6dfd8] bg-[#f5f0e8]/50" : "border-white/10 bg-[#252320]/50"
        }`}
      >
        {/* Review Comments Drawer (High Contrast in both Light and Dark mode) */}
        {showReviewDrawer && (
          <div
            className={`w-full flex flex-col gap-3 p-3.5 rounded-xl border animate-fadeIn mb-1 ${
              isLightMode
                ? "bg-[#efe9de] border-[#c3c2b7] text-[#141413] shadow-sm"
                : "bg-[#252320] border-white/10 text-zinc-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[12.5px] font-bold flex items-center gap-1.5 ${
                  isLightMode ? "text-[#141413]" : "text-white"
                }`}
              >
                <MessageSquare className="w-4 h-4 text-[#3A91EE]" />
                <span>Review Comments ({comments.length})</span>
              </span>
            </div>

            {/* List of existing added comments */}
            {comments.length > 0 && (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {comments.map((cmt, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-lg text-[13px] border ${
                      isLightMode
                        ? "bg-white border-[#c3c2b7] text-[#141413] shadow-sm"
                        : "bg-white/10 border-white/10 text-zinc-100"
                    }`}
                  >
                    {editingIndex === idx ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(idx)}
                          className={`flex-1 px-2.5 py-1 text-[13px] rounded border outline-none ${
                            isLightMode
                              ? "bg-[#FAF9F5] border-[#3A91EE] text-[#141413]"
                              : "bg-black/40 border-blue-400 text-white"
                          }`}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(idx)}
                          className="p-1 rounded bg-[#3A91EE] hover:bg-[#3282d8] text-white transition-colors cursor-pointer"
                          title="Save changes"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 leading-snug font-medium">{cmt}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(idx, cmt)}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isLightMode ? "text-zinc-600 hover:text-black hover:bg-zinc-100" : "text-zinc-400 hover:text-white hover:bg-white/10"
                            }`}
                            title="Edit comment"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveComment(idx)}
                            className="p-1 rounded text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete comment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add new comment input */}
            <div className="flex gap-1.5 sm:gap-2 items-center w-full min-w-0">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your feedback..."
                className={`flex-1 min-w-0 px-2.5 sm:px-3.5 py-2 text-[12.5px] sm:text-[13px] rounded-xl border outline-none transition-all font-sans ${
                  isLightMode
                    ? "bg-white border-[#c3c2b7] text-[#141413] placeholder:text-[#6c6a64] focus:border-[#3A91EE]"
                    : "bg-black/30 border-white/15 text-white placeholder:text-zinc-500 focus:border-blue-400"
                }`}
              />
              <button
                type="button"
                onClick={handleAddComment}
                disabled={!newCommentText.trim()}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl bg-[#3A91EE] hover:bg-[#3282d8] text-white text-[12px] sm:text-[12.5px] font-semibold transition-all disabled:opacity-40 cursor-pointer shadow-sm active:scale-95 shrink-0"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                <span>Add</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* Review Button */}
          <button
            type="button"
            onClick={() => setShowReviewDrawer(!showReviewDrawer)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
              isLightMode
                ? "bg-[#D0CEC6] hover:bg-[#C3C2B7] text-[#3d3d3a]"
                : "bg-white/10 hover:bg-white/15 text-zinc-200"
            }`}
          >
            <MessageSquare className="w-4 h-4 opacity-80" />
            <span>Review {comments.length > 0 ? `(${comments.length})` : ""}</span>
            {showReviewDrawer ? (
              <ChevronUp className="w-3.5 h-3.5 opacity-60 ml-0.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
            )}
          </button>

          {/* Proceed Button */}
          <button
            type="button"
            onClick={handleProceedClick}
            disabled={hasProceeded}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold text-white transition-all cursor-pointer shadow-sm ${
              hasProceeded
                ? "bg-zinc-600 opacity-60 cursor-not-allowed"
                : "bg-[#3A91EE] hover:bg-[#3282d8] active:scale-95 shadow-[#3A91EE]/20"
            }`}
          >
            <span>{hasProceeded ? "Working..." : "Proceed"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
