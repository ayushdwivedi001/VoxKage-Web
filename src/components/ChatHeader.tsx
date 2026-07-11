"use client";

import React, { useState } from "react";
import { ChevronDown, FileText, Star, Edit3, Trash2 } from "lucide-react";

interface ChatHeaderProps {
  isChatActive: boolean;
  isExpanded: boolean;
  activeFile: any;
  showArtifactsPanel: boolean;
  rightPanelWidth: number;
  chatTitle: string;
  currentSessionId: string | null;
  sessionsList: any[];
  handleToggleStar: (id: string, star: boolean) => void;
  setRenameSessionId: (id: string | null) => void;
  setRenameValue: (val: string) => void;
  setShowArtifactsPanel: (show: boolean) => void;
  sessionArtifacts: any[];
  handleDeleteSession: (id: string) => void;
}

export default function ChatHeader({
  isChatActive,
  isExpanded,
  activeFile,
  showArtifactsPanel,
  rightPanelWidth,
  chatTitle,
  currentSessionId,
  sessionsList,
  handleToggleStar,
  setRenameSessionId,
  setRenameValue,
  setShowArtifactsPanel,
  sessionArtifacts,
  handleDeleteSession,
}: ChatHeaderProps) {
  const [showHeaderDropdown, setShowHeaderDropdown] = useState(false);

  return (
    <div
      className={`absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-25 border-b border-transparent transition-all duration-500 select-none ${
        isChatActive ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      } ${isExpanded ? "hidden" : "flex"}`}
      style={{
        right: activeFile || showArtifactsPanel ? `${rightPanelWidth}px` : 0,
      }}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowHeaderDropdown((prev) => !prev)}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-white/5 text-zinc-300 hover:text-zinc-100 transition-all duration-200 text-[14.5px] font-medium cursor-pointer"
        >
          <span>{chatTitle}</span>
          <ChevronDown className="w-4 h-4 opacity-75" />
        </button>

        {showHeaderDropdown && (() => {
          const currentSess = sessionsList.find((s) => s.id === currentSessionId);
          const isStarred = currentSess?.is_starred || false;
          return (
            <>
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowHeaderDropdown(false)}
              />
              <div className="absolute left-0 mt-1.5 w-[160px] bg-[#121215] border border-zinc-800 rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-0.5 animate-fadeIn">
                <button
                  type="button"
                  onClick={() => {
                    if (currentSessionId) {
                      handleToggleStar(currentSessionId, !isStarred);
                    }
                    setShowHeaderDropdown(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                >
                  <Star
                    className={`w-3.5 h-3.5 ${isStarred ? "fill-white text-white" : "text-zinc-400"}`}
                  />
                  <span>{isStarred ? "Remove Star" : "Star"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowHeaderDropdown(false);
                    if (currentSessionId && currentSess) {
                      setRenameSessionId(currentSessionId);
                      setRenameValue(currentSess.name);
                    }
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Rename</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowHeaderDropdown(false);
                    if (currentSessionId) {
                      handleDeleteSession(currentSessionId);
                    }
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors text-left cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Delete</span>
                </button>
              </div>
            </>
          );
        })()}
      </div>

      {!activeFile && !showArtifactsPanel && (
        <div className="flex items-center gap-2">
          {sessionArtifacts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArtifactsPanel(true)}
              className="flex items-center justify-center w-8 h-8 rounded-xl border border-zinc-800 bg-[#181715] hover:bg-[#252320] text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
              aria-label="View artifacts"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-[#121215]/80 hover:bg-zinc-800/80 text-zinc-300 hover:text-white text-[13.5px] font-medium transition-all duration-200"
          >
            Share
          </button>
        </div>
      )}
    </div>
  );
}
