"use client";

import React, { useState, useEffect, useRef } from "react";
import { Copy, Maximize2, Minimize2, Check, X, MessageSquare } from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-python";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-bash";

// Custom CSS styles to override default Prism Tomorrow theme for an authentic VS Code dark look
const VS_CODE_THEME_CSS = `
  .vscode-code-container .token.comment,
  .vscode-code-container .token.prolog,
  .vscode-code-container .token.doctype,
  .vscode-code-container .token.cdata {
    color: #6a737d;
    font-style: italic;
  }
  .vscode-code-container .token.punctuation {
    color: #e1e4e8;
  }
  .vscode-code-container .token.namespace {
    opacity: .7;
  }
  .vscode-code-container .token.property,
  .vscode-code-container .token.tag,
  .vscode-code-container .token.boolean,
  .vscode-code-container .token.number,
  .vscode-code-container .token.constant,
  .vscode-code-container .token.symbol,
  .vscode-code-container .token.deleted {
    color: #79b8ff;
  }
  .vscode-code-container .token.selector,
  .vscode-code-container .token.attr-name,
  .vscode-code-container .token.string,
  .vscode-code-container .token.char,
  .vscode-code-container .token.builtin,
  .vscode-code-container .token.inserted {
    color: #ffab70;
  }
  .vscode-code-container .token.operator,
  .vscode-code-container .token.entity,
  .vscode-code-container .token.url,
  .vscode-code-container .language-css .token.string,
  .vscode-code-container .style .token.string {
    color: #f97583;
  }
  .vscode-code-container .token.atrule,
  .vscode-code-container .token.attr-value,
  .vscode-code-container .token.keyword {
    color: #f97583;
  }
  .vscode-code-container .token.function,
  .vscode-code-container .token.class-name {
    color: #b392f0;
  }
  .vscode-code-container .token.regex,
  .vscode-code-container .token.important,
  .vscode-code-container .token.variable {
    color: #ffab70;
  }
`;

interface FileInspectorPanelProps {
  fileName: string;
  code: string;
  onClose: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  comments: Array<{ id: string; fileName: string; line: number; text: string }>;
  onAddComment: (line: number, text: string) => void;
  onDeleteComment: (id: string) => void;
  jumpToLine: number | null;
}

export default function FileInspectorPanel({
  fileName,
  code,
  onClose,
  isExpanded,
  onToggleExpand,
  comments,
  onAddComment,
  onDeleteComment,
  jumpToLine,
}: FileInspectorPanelProps) {
  const [copied, setCopied] = useState(false);
  const [activeCommentLine, setActiveCommentLine] = useState<number | null>(null);
  const [commentInputText, setCommentInputText] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text", err);
    }
  };

  const getLanguage = (fname: string) => {
    const ext = fname.split(".").pop()?.toLowerCase();
    if (ext === "py") return "python";
    if (ext === "js" || ext === "jsx") return "javascript";
    if (ext === "ts" || ext === "tsx") return "typescript";
    if (ext === "html" || ext === "xml" || ext === "svg") return "markup";
    if (ext === "css") return "css";
    if (ext === "sh" || ext === "bash") return "bash";
    return "clike";
  };

  const lang = getLanguage(fileName);
  const grammar = Prism.languages[lang] || Prism.languages.clike;
  const lines = code.split("\n");

  const highlightedLines = lines.map((line) => {
    try {
      const content = line === "" ? " " : line;
      return Prism.highlight(content, grammar, lang);
    } catch {
      return line;
    }
  });

  useEffect(() => {
    if (jumpToLine && containerRef.current) {
      const lineEl = containerRef.current.querySelector(`[data-line="${jumpToLine}"]`);
      if (lineEl) {
        lineEl.scrollIntoView({ behavior: "smooth", block: "center" });
        lineEl.classList.add("bg-blue-950/40");
        const timer = setTimeout(() => {
          lineEl.classList.remove("bg-blue-950/40");
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [jumpToLine]);

  const handleCommitComment = (lineNum: number) => {
    if (!commentInputText.trim()) return;
    onAddComment(lineNum, commentInputText.trim());
    setCommentInputText("");
    setActiveCommentLine(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d11] border-l border-zinc-800/80 w-full relative z-20 overflow-hidden">
      <style>{VS_CODE_THEME_CSS}</style>

      {/* Top Header Panel */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-800/80 bg-[#0d0d11] select-none flex-shrink-0 gap-4">
        {/* Left Side: Filename */}
        <div className="min-w-0 flex-1">
          <span className="text-[14.5px] font-medium text-zinc-300 font-sans tracking-wide truncate block">
            {fileName}
          </span>
        </div>

        {/* Right Side: Header Controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[12.5px] font-medium transition-all duration-200 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Expand/Collapse Toggle Button */}
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
            aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Close Panel Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Code Display Area */}
      <div 
        ref={containerRef}
        className="flex-grow overflow-auto p-4 custom-vscode-scrollbar bg-[#0f0f13] vscode-code-container"
      >
        <div className="w-full flex flex-col font-mono text-[13.5px] leading-[22px]">
          {highlightedLines.map((htmlCode, index) => {
            const lineNum = index + 1;
            const lineComments = comments.filter(c => c.fileName === fileName && c.line === lineNum);
            
            return (
              <div 
                key={index} 
                data-line={lineNum}
                className="flex flex-col w-full border-l-2 border-transparent transition-all duration-300"
              >
                <div className="flex items-start min-w-0 w-full hover:bg-white/5 transition-colors group relative py-0.5">
                  {/* Hover comment trigger button */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCommentLine(activeCommentLine === lineNum ? null : lineNum);
                      setCommentInputText("");
                    }}
                    className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#1b2a47] border border-blue-500/50 flex items-center justify-center text-blue-400 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer z-10 hover:scale-105"
                    title={`Add suggestion to line ${lineNum}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  {/* Line Numbers Column */}
                  <div className="text-zinc-650 text-right select-none w-9 pr-3 border-r border-zinc-800/60 mr-3 flex-shrink-0 font-light select-none">
                    {lineNum}
                  </div>

                  {/* Code Column */}
                  <pre
                    className="flex-grow select-text overflow-visible font-mono text-zinc-300"
                    style={{
                      background: "none",
                      margin: 0,
                      padding: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                    dangerouslySetInnerHTML={{ __html: htmlCode }}
                  />
                </div>

                {/* Inline Comment Input Area */}
                {activeCommentLine === lineNum && (
                  <div className="pl-[54px] pr-4 py-2.5 bg-[#08080a] border-y border-zinc-800/40 flex items-center gap-2 animate-fadeIn w-full">
                    <input
                      type="text"
                      value={commentInputText}
                      onChange={(e) => setCommentInputText(e.target.value)}
                      placeholder="Add your comment"
                      className="flex-grow h-8 bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-zinc-200 text-[12.5px] focus:outline-none focus:border-blue-500/60 font-sans"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCommitComment(lineNum);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleCommitComment(lineNum)}
                      className="h-8 px-3.5 bg-blue-600 hover:bg-blue-500 text-white font-sans font-medium text-[12px] rounded-lg transition-colors cursor-pointer"
                    >
                      Enter
                    </button>
                  </div>
                )}

                {/* Render inline comments */}
                {lineComments.map((c) => (
                  <div 
                    key={c.id} 
                    className="pl-[54px] pr-4 py-1.5 bg-[#09090c]/85 border-b border-zinc-900/60 flex items-start justify-between gap-4 group/item"
                  >
                    <span className="text-[12px] text-zinc-400 font-sans leading-relaxed">
                      {c.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteComment(c.id)}
                      className="text-zinc-650 hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100 cursor-pointer"
                      aria-label="Delete comment"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* VS Code Scrollbar style overrides */}
      <style>{`
        .custom-vscode-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-vscode-scrollbar::-webkit-scrollbar-track {
          background: #0f0f13;
        }
        .custom-vscode-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }
        .custom-vscode-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.16);
        }
      `}</style>
    </div>
  );
}
