"use client";

import React, { useState } from "react";
import { Copy, Maximize2, Minimize2, Check, X } from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-python";

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
}

export default function FileInspectorPanel({
  fileName,
  code,
  onClose,
  isExpanded,
  onToggleExpand,
}: FileInspectorPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text", err);
    }
  };

  const lines = code.split("\n");
  
  // Clean line-by-line highlight using Prism python rules
  const highlightedLines = lines.map((line) => {
    try {
      // Ensure empty lines have a space so they render with the correct height
      const content = line === "" ? " " : line;
      return Prism.highlight(content, Prism.languages.python, "python");
    } catch {
      return line;
    }
  });

  return (
    <div className="flex flex-col h-full bg-[#0d0d11] border-l border-zinc-800/80 w-full relative z-20 overflow-hidden">
      <style>{VS_CODE_THEME_CSS}</style>

      {/* Top Header Panel */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-800/80 bg-[#0d0d11] select-none flex-shrink-0 gap-4">
        {/* Left Side: Filename (flex-grow + min-w-0 so it truncates instead of pushing buttons) */}
        <div className="min-w-0 flex-1">
          <span className="text-[14.5px] font-medium text-zinc-300 font-sans tracking-wide truncate block">
            {fileName}
          </span>
        </div>

        {/* Right Side: Header Control Grid (flex-shrink-0 to lock position) */}
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

      {/* Code Display Area (Independent scrollbar) */}
      <div className="flex-grow overflow-auto p-4 custom-vscode-scrollbar bg-[#0f0f13] vscode-code-container">
        <div className="w-full flex flex-col font-mono text-[13.5px] leading-[22px]">
          {highlightedLines.map((htmlCode, index) => (
            <div key={index} className="flex items-start min-w-0 w-full hover:bg-white/5 transition-colors">
              {/* Line Numbers Column */}
              <div className="text-zinc-600 text-right select-none w-9 pr-3 border-r border-zinc-800/60 mr-3 flex-shrink-0 font-light select-none">
                {index + 1}
              </div>

              {/* Code Highlighted Column (with pre-wrap soft wrapping) */}
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
          ))}
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
