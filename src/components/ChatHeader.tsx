"use client";

import React, { useState } from "react";
import { ChevronDown, FileText, Star, Edit3, Trash2, Download, AlertTriangle, PanelLeft } from "lucide-react";
import { getToken } from "@/lib/api";

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
  onToggleSidebar?: () => void;
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
  onToggleSidebar,
}: ChatHeaderProps) {
  const [showHeaderDropdown, setShowHeaderDropdown] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  React.useEffect(() => {
    const checkTheme = () => {
      const isL = document.documentElement.classList.contains("light");
      setIsLightMode(isL);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const currentSess = sessionsList.find((s) => s.id === currentSessionId);
  const isScheduled = currentSess?.is_scheduled || false;

  const handleExportMarkdown = async () => {
    setShowExportConfirm(false);
    if (!currentSessionId) return;
    
    try {
      const token = getToken();
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      
      const res = await fetch(`${apiBase}/sessions/${currentSessionId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to load session history");
      
      const data = await res.json();
      const messages = data.messages || [];
      const sessionName = data.session?.name || "Scheduled Run Log";
      
      let md = `# VoxKage Scheduled Session Log: ${sessionName}\n`;
      md += `*Generated on: ${new Date().toLocaleString()}*\n\n---\n\n`;
      
      messages.forEach((m: any) => {
        const roleName = m.role === "user" ? "USER PROMPT" : "VOXKAGE REPORT";
        const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleString() : "";
        md += `## [${roleName}]${timeStr ? ` — ${timeStr}` : ""}\n\n`;
        md += `${m.content}\n\n---\n\n`;
      });
      
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${sessionName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_history.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export log: " + (err as Error).message);
    }
  };

  return (
    <div
      className={`absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-3 md:px-6 z-25 border-b border-transparent transition-all duration-500 select-none ${
        isChatActive ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      } ${isExpanded ? "hidden md:flex" : "flex"}`}
      style={{
        right: activeFile || showArtifactsPanel ? `${rightPanelWidth}px` : 0,
      }}
    >
      <div className="flex items-center gap-2">
        {/* Mobile Sidebar Toggle Button */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`flex md:hidden items-center justify-center w-9 h-9 rounded-xl active:scale-95 cursor-pointer transition-all duration-200 ${
              isLightMode 
                ? "bg-[#3d3d3a] border border-[#252523] text-[#e6dfd8] shadow-sm" 
                : "bg-white/5 border border-white/10 text-zinc-300 hover:text-white"
            }`}
            aria-label="Open sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        {/* Desktop Chat Title (Hidden on Mobile) */}
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setShowHeaderDropdown((prev) => !prev)}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl transition-all duration-200 text-[14.5px] font-medium cursor-pointer ${
              isLightMode
                ? "text-[#141413] hover:bg-black/5"
                : "hover:bg-white/5 text-zinc-300 hover:text-zinc-100"
            }`}
          >
            <span className="truncate max-w-[200px]">{chatTitle}</span>
            <ChevronDown className="w-4 h-4 opacity-75 flex-shrink-0" />
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
              <div className={`absolute left-0 mt-1.5 w-[160px] rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-0.5 animate-fadeIn ${
                isLightMode
                  ? "bg-[#efe9de] border border-[#e6dfd8]"
                  : "bg-[#121215] border border-zinc-800"
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    if (currentSessionId) {
                      handleToggleStar(currentSessionId, !isStarred);
                    }
                    setShowHeaderDropdown(false);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors text-left cursor-pointer ${
                    isLightMode
                      ? "text-[#141413] hover:bg-[#e6dfd8]"
                      : "text-zinc-300 hover:text-white hover:bg-zinc-800/80"
                  }`}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      isStarred
                        ? (isLightMode ? "fill-[#141413] text-[#141413]" : "fill-white text-white")
                        : (isLightMode ? "text-[#6c6a64]" : "text-zinc-400")
                    }`}
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
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors text-left cursor-pointer ${
                    isLightMode
                      ? "text-[#141413] hover:bg-[#e6dfd8]"
                      : "text-zinc-300 hover:text-white hover:bg-zinc-800/80"
                  }`}
                >
                  <Edit3 className={`w-3.5 h-3.5 ${isLightMode ? "text-[#6c6a64]" : "text-zinc-400"}`} />
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
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors text-left cursor-pointer ${
                    isLightMode
                      ? "text-red-600 hover:bg-red-100/60"
                      : "text-red-400 hover:text-red-300 hover:bg-red-950/20"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span>Delete</span>
                </button>
              </div>
            </>
          );
        })()}
      </div>
    </div>

    {!activeFile && !showArtifactsPanel && (
        <div className="flex items-center gap-2">
          {isScheduled && (
            <button
              type="button"
              onClick={() => setShowExportConfirm(true)}
              className="px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-[#121215]/80 hover:bg-zinc-800/80 text-zinc-300 hover:text-white text-[13.5px] font-medium transition-all duration-200 cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>Export Log</span>
            </button>
          )}

          {sessionArtifacts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArtifactsPanel(true)}
              className="flex items-center justify-center w-8 h-8 rounded-xl border border-blue-500/30 [.light_&]:border-blue-500/40 bg-blue-500/10 [.light_&]:bg-blue-500/10 hover:bg-blue-500/25 [.light_&]:hover:bg-blue-500/20 text-blue-400 [.light_&]:text-blue-600 hover:text-blue-300 [.light_&]:hover:text-blue-700 transition-all duration-200 cursor-pointer shadow-sm"
              aria-label="View workspace artifacts"
              title="Workspace Artifacts"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-[#121215]/80 hover:bg-zinc-800/80 text-zinc-300 hover:text-white text-[13.5px] font-medium transition-all duration-200 cursor-pointer"
          >
            Share
          </button>

          {showExportConfirm && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fadeIn backdrop-blur-md">
              <div className="w-full max-w-[360px] bg-[#252320] border border-[#e6dfd8]/15 rounded-lg p-5 text-center shadow-2xl">
                <Download className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                <h3 className="font-serif text-[#faf9f5] text-base font-normal mb-1.5">
                  Export Scheduled Log?
                </h3>
                <p className="text-xs text-[#8e8b82] leading-relaxed mb-5">
                  Do you want to download the entire execution history of this scheduled session as a markdown file?
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => setShowExportConfirm(false)}
                    className="px-4 py-2 text-[12.5px] font-medium text-[#efe9de] bg-[#181715] hover:bg-[#181715]/75 border border-[#e6dfd8]/10 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExportMarkdown}
                    className="px-4 py-2 text-[12.5px] font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                  >
                    Export
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
