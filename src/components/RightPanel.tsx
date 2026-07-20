"use client";

import React from "react";
import { X } from "lucide-react";
import FileInspectorPanel from "@/components/FileInspectorPanel";
import ArtifactFileTree from "@/components/ArtifactFileTree";

interface RightPanelProps {
  displayedActiveFile: { name: string; code: string } | null;
  showArtifactsPanel: boolean;
  isExpanded: boolean;
  rightPanelWidth: number;
  setActiveFile: (file: { name: string; code: string } | null) => void;
  setShowArtifactsPanel: (show: boolean) => void;
  setIsExpanded: (expanded: boolean) => void;
  comments: any[];
  setComments: React.Dispatch<React.SetStateAction<any[]>>;
  jumpToLine: number | null;
  setJumpToLine: (line: number | null) => void;
  sessionArtifacts: any[];
  activeFileVersions: Record<string, number>;
  setActiveFileVersions: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setEditingFile: (file: string | null) => void;
}

export default function RightPanel({
  displayedActiveFile,
  showArtifactsPanel,
  isExpanded,
  rightPanelWidth,
  setActiveFile,
  setShowArtifactsPanel,
  setIsExpanded,
  comments,
  setComments,
  jumpToLine,
  setJumpToLine,
  sessionArtifacts,
  activeFileVersions,
  setActiveFileVersions,
  setEditingFile,
}: RightPanelProps) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  if (displayedActiveFile) {
    return (
      <div
        style={{
          width: isMobile ? "100%" : (isExpanded ? "100%" : rightPanelWidth),
        }}
        className="fixed inset-0 z-50 w-full h-full max-w-full md:relative md:inset-auto md:z-auto md:h-full flex-shrink-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
      >
        <FileInspectorPanel
          fileName={displayedActiveFile.name}
          code={displayedActiveFile.code}
          onClose={() => {
            setActiveFile(null);
            setJumpToLine(null);
            setIsExpanded(false);
          }}
          onBack={() => {
            setActiveFile(null);
            setShowArtifactsPanel(true);
          }}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          comments={comments}
          onAddComment={(line, text) => {
            setComments((prev) => [
              ...prev,
              {
                id: `comment-${Date.now()}`,
                fileName: displayedActiveFile!.name,
                line,
                text,
              },
            ]);
          }}
          onDeleteComment={(id) => {
            setComments((prev) => prev.filter((c) => c.id !== id));
          }}
          jumpToLine={jumpToLine}
          sessionFiles={sessionArtifacts}
          onNavigateFile={(name) => {
            const matchingFile = sessionArtifacts.find((f) => f.name === name);
            if (matchingFile && matchingFile.versions.length > 0) {
              setActiveFile({
                name,
                code: matchingFile.versions[matchingFile.versions.length - 1].code,
              });
            }
          }}
          onEditClick={(name) => {
            setEditingFile(name);
          }}
        />
      </div>
    );
  }

  if (showArtifactsPanel) {
    return (
      <div
        style={{
          width: isMobile ? "100%" : (isExpanded ? "100%" : rightPanelWidth),
        }}
        className="fixed inset-0 z-50 w-full h-full max-w-full md:relative md:inset-auto md:z-auto md:h-full flex-shrink-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden bg-[#0d0d11] border-l border-zinc-800/80 flex flex-col"
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-800/80 bg-[#0d0d11] select-none flex-shrink-0">
          <span className="text-[14.5px] font-medium text-zinc-300 font-sans tracking-wide">
            Artifacts
          </span>
          <button
            type="button"
            onClick={() => {
              setShowArtifactsPanel(false);
              setIsExpanded(false);
            }}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-grow overflow-auto p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-zinc-100 text-[15px] font-medium font-sans">
              Artifacts created in this session
            </h3>
            {sessionArtifacts.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  sessionArtifacts.forEach((file) => {
                    const activeVer = activeFileVersions[file.name] || file.versions.length;
                    const verObj =
                      file.versions.find((v: any) => v.version === activeVer) ||
                      file.versions[file.versions.length - 1];
                    const blob = new Blob([verObj.code], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = file.name.split("/").pop() || file.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  });
                }}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-[#16161a] hover:bg-[#202025] text-zinc-355 hover:text-white text-[12.5px] font-medium transition-all duration-200 cursor-pointer select-none"
              >
                Download all
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2.5">
            <ArtifactFileTree
              files={sessionArtifacts}
              activeFileVersions={activeFileVersions}
              setActiveFile={setActiveFile}
              setShowArtifactsPanel={setShowArtifactsPanel}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
