"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Copy,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ChevronDown,
  Download,
  ChevronRight,
  Clock,
  Check,
  FileText,
  Code,
  Settings,
  Search,
  Globe,
  X,
  ArrowUpRight,
  Square,
  Star,
  Edit3,
  Trash2,
  ArrowDown
} from "lucide-react";
import GradientBackground from "@/components/GradientBackground";
import PromptInput from "@/components/PromptInput";
import Sidebar from "@/components/Sidebar";
import FileListItem from "@/components/FileListItem";
import FileInspectorPanel from "@/components/FileInspectorPanel";
import MoreModelsModal from "@/components/MoreModelsModal";

import {
  login,
  fetchSessions,
  createSession,
  fetchSessionMessages,
  deleteSession,
  renameSession,
  toggleSessionStar,
  fetchFavorites,
  saveFavorites,
  fetchSettingsProfile,
  saveSettingsProfile,
  fetchModels,
  getToken,
  clearToken,
  WS_BACKEND_URL
} from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: Array<{ name: string; type: string; code: string }>;
  status?: "thinking" | "streaming" | "completed";
  thinkingDuration?: number;
  thinkingStart?: number;
  thinkingSteps?: Array<{ id: string; label: string; status: "pending" | "success" | "failed" }>;
}

// Max collapsed height in px before showing Show more
const USER_BUBBLE_MAX_H = 180;

function UserBubble({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);
  const innerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.maxHeight = "none";
    const natural = el.scrollHeight;
    el.style.maxHeight = "";
    setNeedsClamp(natural > USER_BUBBLE_MAX_H);
  }, [content]);

  return (
    <div className="max-w-[85%] flex flex-col items-end text-zinc-300">
      <div
        className="bg-[#202024] text-zinc-100 rounded-2xl px-4 pt-3 text-[15px] leading-relaxed font-sans border border-zinc-800/40 select-text w-full"
        style={{ paddingBottom: needsClamp ? 0 : "10px" }}
      >
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            maxHeight: needsClamp && !expanded ? `${USER_BUBBLE_MAX_H}px` : undefined,
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
          }}
        >
          <div ref={innerRef}>{content}</div>
          {needsClamp && !expanded && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: "auto 0 0 0",
                height: "72px",
                background: "linear-gradient(to bottom, transparent 0%, #202024 80%)",
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        {needsClamp && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left pt-1.5 pb-2.5 mt-1 border-t border-zinc-800/20 group cursor-pointer focus:outline-none flex items-center bg-transparent"
          >
            <span className="text-[13px] font-medium text-zinc-400 group-hover:text-white transition-all duration-200 group-hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.65)]">
              {expanded ? "Show less" : "Show more"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

interface AssistantResponseBubbleProps {
  msg: Message;
  setActiveFile: (file: { name: string; code: string } | null) => void;
  onScrollToBottom: () => void;
  messages: Message[];
  activeFileVersions: { [name: string]: number };
  setActiveFileVersions: React.Dispatch<React.SetStateAction<{ [name: string]: number }>>;
}

const extractFilesFromContent = (content: string) => {
  const files: Array<{ name: string; type: string; code: string }> = [];
  if (!content) return files;

  const codeBlockRegex = /```(\w*)\n([\s\S]*?)(?:```|$)/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = match[1] || "txt";
    const code = match[2];
    if (!code.trim()) continue;

    // Try to find a filename in the text preceding the code block (within last 150 characters)
    const searchStartIndex = Math.max(0, match.index - 150);
    const precedingText = content.substring(searchStartIndex, match.index);
    
    // Regex to search for a filename
    const fileMatch = precedingText.match(/`?([\w\-]+\.(?:py|js|ts|tsx|json|css|html|env|txt|md|yaml|yml|sh|bat))`?/i);
    let fileName = fileMatch ? fileMatch[1] : "";

    if (!fileName) {
      const ext = lang === "python" ? "py" : lang === "javascript" ? "js" : lang === "typescript" ? "ts" : lang === "html" ? "html" : lang === "css" ? "css" : "txt";
      const index = files.length + 1;
      fileName = `app_${index}.${ext}`;
    }

    if (!files.some(f => f.name === fileName)) {
      let fileType = "Code";
      if (fileName.endsWith(".py")) fileType = "Python";
      else if (fileName.endsWith(".js") || fileName.endsWith(".jsx")) fileType = "JavaScript";
      else if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) fileType = "TypeScript";
      else if (fileName.endsWith(".html")) fileType = "HTML";
      else if (fileName.endsWith(".css")) fileType = "CSS";
      else if (fileName.endsWith(".json")) fileType = "JSON";

      files.push({
        name: fileName,
        type: `${fileType} · ${lang.toUpperCase()}`,
        code: code.trim()
      });
    }
  }

  return files;
};

const removeCodeBlocks = (text: string) => {
  if (!text) return "";
  return text.replace(/```\w*\n[\s\S]*?(?:```|$)/g, "").trim();
};

const computeSessionFiles = (messages: Message[]) => {
  const list: Array<{ name: string; type: string; versions: Array<{ version: number; code: string }> }> = [];

  messages.forEach((m) => {
    if (m.role === "assistant") {
      const { finalContent } = parseMessageContent(m.content);
      const extracted = extractFilesFromContent(finalContent);
      extracted.forEach((file) => {
        let existing = list.find((item) => item.name === file.name);
        if (!existing) {
          existing = {
            name: file.name,
            type: file.type,
            versions: [],
          };
          list.push(existing);
        }
        // Only push version if the code is different from the last version
        const lastVer = existing.versions[existing.versions.length - 1];
        if (!lastVer || lastVer.code !== file.code) {
          existing.versions.push({
            version: existing.versions.length + 1,
            code: file.code,
          });
        }
      });
    }
  });

  return list;
};

const parseSources = (content: string) => {
  if (!content) return { cleanContent: "", sources: [] };
  const sourcesRegex = /<Sources\s+data="([^"]+)"\s*\/>/i;
  const match = content.match(sourcesRegex);
  let cleanContent = content.replace(/<Sources[\s\S]*/i, '').trim();
  let sources: { title: string; url: string; domain: string }[] = [];

  if (match) {
    const rawData = match[1];
    const pairs = rawData.split('||');
    pairs.forEach((p) => {
      const parts = p.split('|');
      if (parts.length >= 2) {
        const title = parts[0];
        const url = parts[1];
        let domain = '';
        try {
          const matchDomain = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
          domain = matchDomain ? matchDomain[1] : url;
        } catch {
          domain = url;
        }
        sources.push({ title, url, domain });
      }
    });
  }

  return { cleanContent, sources };
};

const parseMessageContent = (content: string) => {
  const { cleanContent: noSourcesContent, sources } = parseSources(content);
  
  let thinkingContent = "";
  let finalContent = noSourcesContent;

  const thinkStartIndex = noSourcesContent.indexOf("<think>");
  const thinkEndIndex = noSourcesContent.indexOf("</think>");

  if (thinkStartIndex !== -1) {
    if (thinkEndIndex !== -1) {
      thinkingContent = noSourcesContent.substring(thinkStartIndex + 7, thinkEndIndex).trim();
      finalContent = (noSourcesContent.substring(0, thinkStartIndex) + noSourcesContent.substring(thinkEndIndex + 8)).trim();
    } else {
      thinkingContent = noSourcesContent.substring(thinkStartIndex + 7).trim();
      finalContent = noSourcesContent.substring(0, thinkStartIndex).trim();
    }
  }

  return { thinkingContent, finalContent, sources };
};

function parseInlineElements(text: string) {
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let tokenKey = 0;

  // Pattern matches bold (**text**), inline code (`code`), standard filenames (file.ext), or function signatures containing ()
  const regex = /(\*\*.*?\*\*|`.*?`|\b[\w\-]+\.(?:py|js|ts|tsx|json|css|html|env|txt|md|yaml|yml|sh|bat)\b|\b\w+[\w\-]*\(\))/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(remaining)) !== null) {
    const matchIndex = match.index;
    const matchStr = match[0];

    // Add preceding text
    if (matchIndex > lastIndex) {
      tokens.push(<React.Fragment key={tokenKey++}>{remaining.substring(lastIndex, matchIndex)}</React.Fragment>);
    }

    if (matchStr.startsWith("**") && matchStr.endsWith("**")) {
      const boldText = matchStr.slice(2, -2);
      // Headings/General bold text remains bold and thick white (never blue)
      tokens.push(
        <strong key={tokenKey++} className="font-bold text-zinc-100">
          {boldText}
        </strong>
      );
    } else if (matchStr.startsWith("`") && matchStr.endsWith("`")) {
      const codeText = matchStr.slice(1, -1);
      tokens.push(
        <code key={tokenKey++} className="bg-zinc-850/60 text-zinc-200 border border-zinc-700/50 px-1.5 py-0.5 rounded font-mono text-[13.5px] mx-0.5">
          {codeText}
        </code>
      );
    } else {
      // Filename or function call pops out in high-contrast premium blue!
      tokens.push(
        <span key={tokenKey++} className="text-blue-400 font-mono font-medium hover:underline cursor-help">
          {matchStr}
        </span>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < remaining.length) {
    tokens.push(<React.Fragment key={tokenKey++}>{remaining.substring(lastIndex)}</React.Fragment>);
  }

  return tokens.length > 0 ? tokens : text;
}

function renderTable(rows: string[][], key: string) {
  if (rows.length === 0) return null;
  const headers = rows[0];
  const bodyRows = rows.slice(1);

  return (
    <div key={key} className="w-full my-3.5 overflow-x-auto rounded-xl border border-zinc-850 bg-zinc-950/40 custom-scrollbar select-text">
      <table className="w-full text-left border-collapse min-w-[500px]">
        <thead>
          <tr className="border-b border-zinc-800/80 bg-zinc-900/10">
            {headers.map((h, idx) => (
              <th key={idx} className="px-4 py-2.5 text-[13px] font-semibold text-zinc-300 tracking-wide font-sans">
                {parseInlineElements(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-900/60">
          {bodyRows.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-zinc-900/10 transition-colors duration-150">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-2.5 text-[13px] text-zinc-400 font-sans leading-relaxed">
                  {parseInlineElements(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderFormattedContent(content: string) {
  if (!content) return null;
  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];

  let inTable = false;
  let tableRows: string[][] = [];
  let tableKey = 0;

  const isTableRow = (line: string) => {
    return line.trim().startsWith("|") && line.trim().endsWith("|");
  };

  const parseRowCells = (line: string) => {
    const parts = line.split("|");
    return parts.slice(1, parts.length - 1).map(c => c.trim());
  };

  const isSeparatorRow = (cells: string[]) => {
    return cells.length > 0 && cells.every(c => c.match(/^:?-+:?$/));
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isTableRow(line)) {
      const cells = parseRowCells(line);
      if (!inTable) {
        // Lookahead to see if next row is separator
        const nextLine = lines[i + 1];
        if (nextLine && isTableRow(nextLine)) {
          const nextCells = parseRowCells(nextLine);
          if (isSeparatorRow(nextCells)) {
            inTable = true;
            tableRows = [cells];
            i++; // skip separator
            continue;
          }
        }
      }

      if (inTable) {
        tableRows.push(cells);
        continue;
      }
    }

    if (inTable && (!isTableRow(line) || i === lines.length - 1)) {
      if (isTableRow(line) && i === lines.length - 1) {
        tableRows.push(parseRowCells(line));
      }
      renderedElements.push(renderTable(tableRows, `table-${tableKey++}`));
      inTable = false;
      tableRows = [];
      if (isTableRow(line)) continue;
    }

    if (!isTableRow(line)) {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];
        const headingClass = level === 1 
          ? "text-[22px] font-bold text-zinc-100 mt-4 mb-2 block" 
          : level === 2 
            ? "text-[19px] font-bold text-zinc-100 mt-3.5 mb-1.5 block" 
            : "text-[17px] font-bold text-zinc-100 mt-3 mb-1 block";
        renderedElements.push(
          <span key={`h-${i}`} className={headingClass}>
            {parseInlineElements(headingText)}
          </span>
        );
      } else {
        renderedElements.push(
          <div key={`p-${i}`} className="min-h-[1.5em] mb-1">
            {parseInlineElements(line)}
          </div>
        );
      }
    }
  }

  if (inTable && tableRows.length > 0) {
    renderedElements.push(renderTable(tableRows, `table-${tableKey++}`));
  }

  return renderedElements;
}

function AssistantResponseBubble({
  msg,
  setActiveFile,
  onScrollToBottom,
  messages,
  activeFileVersions,
  setActiveFileVersions,
}: AssistantResponseBubbleProps) {
  const [isThoughtsExpanded, setIsThoughtsExpanded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(msg.thinkingDuration || 0);
  const [dots, setDots] = useState(".");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Setup speech synthesis
  useEffect(() => {
    synthRef.current = typeof window !== "undefined" ? window.speechSynthesis : null;
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const handleSpeak = () => {
    if (!synthRef.current) return;

    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }

    // Strip custom XML tags and markdown chars before speaking
    const cleanText = msg.content
      .replace(/<[^>]*>/g, "")
      .replace(/\*\*|`/g, "")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    const voices = synthRef.current.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith("en-US") || v.lang.startsWith("en-GB"));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
    setIsSpeaking(true);
  };

  // If currently thinking, run a local timer
  useEffect(() => {
    if (msg.status !== "thinking") {
      setElapsedSeconds(msg.thinkingDuration || 0);
      return;
    }

    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev === "..." ? "." : prev + "."));
    }, 600);

    const start = Date.now();
    const timerInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - start) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => {
      clearInterval(dotsInterval);
      clearInterval(timerInterval);
    };
  }, [msg.status, msg.thinkingDuration]);

  // Parse message content to extract thinking, final output, and consulted web sources
  const { thinkingContent, finalContent, sources } = parseMessageContent(msg.content);

  // Fallback to logical default steps when no deep <think> reasoning blocks exist
  const thoughts = thinkingContent
    ? thinkingContent.split("\n").filter(line => line.trim().length > 0).map((line, idx) => ({
        id: `think-${idx}`,
        label: line.replace(/^-\s*/, "").trim(),
        status: "success" as const
      }))
    : msg.thinkingSteps && msg.thinkingSteps.length > 0
      ? msg.thinkingSteps
      : [
          { id: "step-1", label: "Analyzing prompt...", status: "success" as const },
          { id: "step-2", label: "Retrieving context and profile...", status: "success" as const },
          { id: "step-3", label: "Formulating response...", status: "success" as const }
        ];

  // If streaming and there is an active code block being written, append "Writing [filename]..." step
  const extracted = extractFilesFromContent(finalContent);
  const isStreamingCode = msg.status === "streaming" && extracted.length > 0;
  
  const processedThoughts = [...thoughts];
  if (isStreamingCode) {
    const activeFileName = extracted[extracted.length - 1].name;
    const stepLabel = `Writing ${activeFileName}...`;
    if (!processedThoughts.some(t => t.label === stepLabel)) {
      processedThoughts.push({
        id: "writing-file-step",
        label: stepLabel,
        status: "pending" as const
      });
    }
  }

  const renderStepIcon = (status: "pending" | "success" | "failed") => {
    if (status === "success") {
      return <Check className="w-3 h-3 text-zinc-400 stroke-[2.5]" />;
    } else if (status === "failed") {
      return <span className="text-red-400 font-bold text-[11px]">X</span>;
    } else {
      return <Clock className="w-3 h-3 text-zinc-500 animate-pulse" />;
    }
  };

  const isMsgRunning = msg.status === "thinking" || msg.status === "streaming";
  
  const activeStep = processedThoughts.find(t => t.status === "pending") || (isMsgRunning ? processedThoughts[processedThoughts.length - 1] : null);
  const displayLabel = isMsgRunning
    ? (activeStep ? activeStep.label : `Thinking${dots}`)
    : `Thought for ${msg.thinkingDuration || elapsedSeconds || 3}s`;

  const showGlow = isMsgRunning;

  return (
    <div className="flex flex-col items-start w-full">
      {/* --- Clickable Thinking Accordion Header (Always Interactive) --- */}
      <div className="flex flex-col mb-1.5 w-full">
        <div
          onClick={() => setIsThoughtsExpanded(!isThoughtsExpanded)}
          className="flex items-center gap-2 py-1.5 text-zinc-500 hover:text-zinc-200 transition-colors duration-200 cursor-pointer select-none group/thought w-fit"
        >
          <ChevronRight
            className={`w-3.5 h-3.5 transition-all duration-200 ${
              isThoughtsExpanded ? "rotate-90 text-zinc-200" : "text-zinc-400"
            }`}
          />
          <span className={`text-[13px] font-medium tracking-wide font-sans ${showGlow ? "animate-thinking-glow text-zinc-400" : ""}`}>
            {displayLabel}
          </span>
          {isMsgRunning && (
            <span className="text-[11.5px] text-zinc-600 font-mono">({elapsedSeconds}s)</span>
          )}
        </div>

        {/* Expanded Step Timeline */}
        {isThoughtsExpanded && processedThoughts.length > 0 && (
          <div className="flex flex-col pl-4 mt-2 mb-3.5 select-none animate-fadeIn max-w-[90%]">
            {processedThoughts.map((step, idx) => {
              const isLast = idx === processedThoughts.length - 1;
              return (
                <div key={idx} className="relative flex items-start gap-3.5 pb-4 last:pb-1">
                  {!isLast && (
                    <div className="absolute left-[10px] top-6 bottom-0 w-[1px] bg-zinc-800" />
                  )}

                  <div
                    className={`w-[22px] h-[22px] rounded-full border flex items-center justify-center z-10 flex-shrink-0 bg-zinc-950/60 border-zinc-800 transition-colors duration-200`}
                  >
                    {renderStepIcon(step.status)}
                  </div>

                  <span className={`text-[13px] leading-[22px] font-sans block pr-2 truncate ${
                    step.status === "pending" ? "text-zinc-300 font-medium animate-pulse" : "text-zinc-500"
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- Assistant Response Text content --- */}
      {msg.status !== "thinking" && finalContent && (
        <div className="text-[16px] text-zinc-200 leading-relaxed font-sans font-light tracking-wide max-w-[90%] select-text whitespace-pre-wrap animate-fadeIn">
          {renderFormattedContent(removeCodeBlocks(finalContent))}
        </div>
      )}

      {/* --- Consulted Web Search Sources Mini Row --- */}
      {sources.length > 0 && (
        <div 
          onClick={() => setIsSourcesOpen(true)}
          className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:bg-zinc-800/80 transition-colors duration-200 cursor-pointer select-none"
        >
          <div className="flex items-center">
            {sources.slice(0, 3).map((src, srcIdx) => {
              const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${src.domain}`;
              return (
                <img
                  key={srcIdx}
                  src={faviconUrl}
                  alt=""
                  className="w-4 h-4 rounded-full border border-zinc-950 bg-zinc-900"
                  style={{
                    marginLeft: srcIdx > 0 ? "-6px" : "0px",
                    zIndex: 10 - srcIdx,
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234b5563' stroke-width='2'/%3E";
                  }}
                />
              );
            })}
          </div>
          <span className="text-[12px] text-zinc-400 font-medium font-sans">
            {sources.length > 3 ? `+${sources.length - 3} sources` : `${sources.length} sources`}
          </span>
        </div>
      )}

      {/* --- Files cards and Actions section --- */}
      {(msg.status === "completed" || msg.status === "streaming") && (() => {
        const extractedFiles = extractFilesFromContent(finalContent);
        if (extractedFiles.length === 0) return null;
        const sessionFiles = computeSessionFiles(messages);
        
        return (
          <div className="flex flex-col gap-2.5 w-full max-w-[90%] mt-4 animate-fadeIn">
            {extractedFiles.map((file, idx) => {
              const fileData = sessionFiles.find(f => f.name === file.name);
              const currentActiveVer = activeFileVersions[file.name] || (fileData ? fileData.versions.length : 1);
              const currentVerObj = fileData?.versions.find(v => v.version === currentActiveVer) || file;

              return (
                <FileListItem
                  key={idx}
                  name={file.name}
                  type={file.type}
                  versions={fileData ? fileData.versions : undefined}
                  activeVersion={currentActiveVer}
                  onSelectVersion={(ver) => {
                    setActiveFileVersions(prev => ({ ...prev, [file.name]: ver }));
                    const targetVer = fileData?.versions.find(v => v.version === ver);
                    if (targetVer) {
                      setActiveFile({ name: file.name, code: targetVer.code });
                    }
                  }}
                  onClick={() => {
                    setActiveFile({ name: file.name, code: currentVerObj.code });
                  }}
                  onDownload={() => {
                    const blob = new Blob([currentVerObj.code], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = file.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                />
              );
            })}
          </div>
        );
      })()}
      {/* --- Response actions block --- */}
      {msg.status === "completed" && (
        <div className="flex items-center gap-4 mt-3 text-zinc-500 select-none mb-2 animate-fadeIn">
          <button
            type="button"
            className="hover:text-zinc-300 transition-colors"
            aria-label="Copy response"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleSpeak}
            className={`transition-colors duration-200 ${
              isSpeaking ? "text-blue-400 animate-pulse" : "hover:text-zinc-300"
            }`}
            aria-label={isSpeaking ? "Stop speaking" : "Speak response"}
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="hover:text-zinc-300 transition-colors"
            aria-label="Thumbs up"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="hover:text-zinc-300 transition-colors"
            aria-label="Thumbs down"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="hover:text-zinc-300 transition-colors"
            aria-label="Retry response"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sources Centric Modal Popup Overlay */}
      {isSourcesOpen && (
        <div 
          className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setIsSourcesOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-[#0e0e11] border border-zinc-850 rounded-2xl p-6 shadow-2xl relative mx-4 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4 select-none">
              <div className="flex items-center gap-2 text-blue-400">
                <Globe className="w-4.5 h-4.5" />
                <h3 className="text-white text-[15px] font-semibold tracking-wide font-sans">Consulted Sources</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsSourcesOpen(false)}
                className="w-6 h-6 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors duration-150 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-grow pr-1 custom-scrollbar">
              <div className="flex flex-col gap-3">
                {sources.map((src, idx) => {
                  const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${src.domain}`;
                  return (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3.5 p-3 rounded-xl border border-zinc-900 hover:border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800/20 transition-all duration-200 group"
                    >
                      <img 
                        src={faviconUrl} 
                        alt="" 
                        className="w-6 h-6 rounded bg-zinc-900 p-0.5"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234b5563' stroke-width='2'/%3E";
                        }}
                      />
                      <div className="flex-grow min-w-0">
                        <div className="text-[13.5px] text-zinc-200 font-medium truncate group-hover:text-blue-400 transition-colors">
                          {src.title}
                        </div>
                        <div className="text-[11.5px] text-zinc-500 font-mono truncate mt-0.5">
                          {src.domain}
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors flex-shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("ayushdwivedi001@gmail.com");
  const [loginMasterKey, setLoginMasterKey] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isChatActive, setIsChatActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatTitle, setChatTitle] = useState("Greeting");
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Code inspection split pane states
  const [activeFile, setActiveFile] = useState<{ name: string; code: string } | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(480);
  const [isExpanded, setIsExpanded] = useState(false);

  // New comments and artifacts states
  const [comments, setComments] = useState<Array<{ id: string; fileName: string; line: number; text: string }>>([]);
  const [jumpToLine, setJumpToLine] = useState<number | null>(null);
  const [showArtifactsPanel, setShowArtifactsPanel] = useState(false);
  const [activeFileVersions, setActiveFileVersions] = useState<{ [name: string]: number }>({});

  // Caching and UI helper states
  const [messagesCache, setMessagesCache] = useState<{ [sessionId: string]: Message[] }>({});
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showHeaderDropdown, setShowHeaderDropdown] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Model Selector global states
  const [selectedModel, setSelectedModel] = useState("DeepSeek V4 Flash");
  const [selectedVariant, setSelectedVariant] = useState("Max");
  const [moreModelsModalOpen, setMoreModelsModalOpen] = useState(false);
  const [modelsList, setModelsList] = useState<any[]>([]);

  const activeWsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  // Check auth on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      setIsLoggedIn(true);
      loadInitialData();
    }

    const handleUnauthorized = () => {
      setIsLoggedIn(false);
      clearToken();
    };

    window.addEventListener("voxkage_unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("voxkage_unauthorized", handleUnauthorized);
    };
  }, []);

  // Sync current active session messages with cache
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      setMessagesCache((prev) => ({ ...prev, [currentSessionId]: messages }));
    }
  }, [messages, currentSessionId]);

  const loadInitialData = async () => {
    try {
      // Load sessions list
      const sess = await fetchSessions();
      setSessionsList(sess);

      // Load favorites
      const favs = await fetchFavorites();
      
      // Load available models
      const apiModels = await fetchModels();
      
      // Build modelsList
      const builtList = apiModels.map((m: string) => {
        let name = m;
        let desc = "OpenCode model";
        if (m === "deepseek-v4-flash-free") {
          name = "DeepSeek V4 Flash";
          desc = "Fastest performance with intelligence";
        } else if (m === "gemini-3.5-flash") {
          name = "Gemini 3.5 Flash";
          desc = "Fastest for quick answers";
        } else if (m === "claude-sonnet-4") {
          name = "Claude 4.6 Sonnet";
          desc = "Most efficient for everyday tasks";
        } else if (m === "mimo-v2.5-free") {
          name = "Mimo 2.5 Free";
          desc = "Multimodal vision understanding model";
        }
        
        return {
          name,
          desc,
          isFavourite: favs.includes(m) || m === "deepseek-v4-flash-free",
          api_key: m
        };
      });
      setModelsList(builtList);
    } catch (e) {
      console.error("Failed to load initial data", e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      await login(loginEmail, loginMasterKey);
      setIsLoggedIn(true);
      loadInitialData();
    } catch (err: any) {
      setLoginError(err.message || "Failed to log in.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setIsLoggedIn(false);
    setMessages([]);
    setCurrentSessionId(null);
    setIsChatActive(false);
    setChatTitle("Greeting");
  };

  const loadSessionHistory = async (sessionId: string) => {
    const cached = messagesCache[sessionId];
    if (cached) {
      setMessages(cached);
      setIsChatActive(true);
      setCurrentSessionId(sessionId);
      const sess = sessionsList.find(s => s.id === sessionId);
      if (sess) {
        setChatTitle(sess.name);
      }
      setTimeout(scrollToBottom, 50);
    } else {
      setIsSessionLoading(true);
      setMessages([]);
      setIsChatActive(true);
      setCurrentSessionId(sessionId);
      const sess = sessionsList.find(s => s.id === sessionId);
      if (sess) {
        setChatTitle(sess.name);
      }
    }

    try {
      const history = await fetchSessionMessages(sessionId);
      const mapped = history.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        status: "completed" as const,
        thinkingSteps: []
      }));
      setMessagesCache(prev => ({ ...prev, [sessionId]: mapped }));
      setCurrentSessionId(prevId => {
        if (prevId === sessionId) {
          setMessages(mapped);
          setTimeout(scrollToBottom, 50);
        }
        return prevId;
      });
    } catch (e) {
      console.error("Failed to load session messages", e);
    } finally {
      setIsSessionLoading(false);
    }
  };

  const handleSelectSession = (sessionId: string | null) => {
    if (sessionId) {
      loadSessionHistory(sessionId);
    } else {
      handleCreateNewChat();
    }
  };

  const handleCreateNewChat = () => {
    if (activeWsRef.current) {
      activeWsRef.current.close();
    }
    setCurrentSessionId(null);
    setMessages([]);
    setIsChatActive(false);
    setChatTitle("Greeting");
  };

  const handleToggleStar = async (sessionId: string, starred: boolean) => {
    setSessionsList(prev => prev.map(s => s.id === sessionId ? { ...s, is_starred: starred } : s));
    try {
      await toggleSessionStar(sessionId, starred);
    } catch (e) {
      console.error("Failed to toggle star", e);
      setSessionsList(prev => prev.map(s => s.id === sessionId ? { ...s, is_starred: !starred } : s));
    }
  };

  const handleRenameSessionClick = (sessionId: string, currentName: string) => {
    setRenameSessionId(sessionId);
    setRenameValue(currentName);
  };

  const executeRenameSession = async () => {
    if (!renameSessionId || !renameValue.trim()) return;
    const targetId = renameSessionId;
    const newName = renameValue.trim();
    setSessionsList(prev => prev.map(s => s.id === targetId ? { ...s, name: newName } : s));
    if (currentSessionId === targetId) {
      setChatTitle(newName);
    }
    setRenameSessionId(null);
    try {
      await renameSession(targetId, newName);
    } catch (e) {
      console.error("Failed to rename session", e);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    setSessionsList(prev => prev.filter(s => s.id !== sessionId));
    setMessagesCache(prev => {
      const copy = { ...prev };
      delete copy[sessionId];
      return copy;
    });
    if (currentSessionId === sessionId) {
      handleCreateNewChat();
    }
    try {
      await deleteSession(sessionId);
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  };

  const handleToggleFavourite = async (modelName: string) => {
    let apiName = modelName;
    if (modelName === "DeepSeek V4 Flash") apiName = "deepseek-v4-flash-free";
    else if (modelName === "Gemini 3.5 Flash") apiName = "gemini-3.5-flash";
    else if (modelName === "Claude 4.6 Sonnet") apiName = "claude-sonnet-4";
    else if (modelName === "Mimo 2.5 Free") apiName = "mimo-v2.5-free";

    const updated = modelsList.map((model) =>
      model.name === modelName
        ? { ...model, isFavourite: !model.isFavourite }
        : model
    );
    setModelsList(updated);

    const favs = updated.filter(m => m.isFavourite).map(m => m.api_key);
    try {
      await saveFavorites(favs);
    } catch (e) {
      console.error("Failed to save favorites to backend", e);
    }
  };

  const modelNameToKey = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes("deepseek")) return "deepseek-flash";
    if (lower.includes("gemini")) return "gemini-flash";
    if (lower.includes("claude") || lower.includes("sonnet")) return "claude-sonnet";
    if (lower.includes("mimo")) return "mimo-free";
    return "deepseek-flash";
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    setShowScrollBottom(distanceToBottom > 300);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;

      const mainEl = document.querySelector("main");
      if (!mainEl) return;

      const rect = mainEl.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const totalWidth = rect.width;
      const newRightWidth = totalWidth - relativeX;

      const minChatWidth = 380;
      const minCodeWidth = 300;

      if (relativeX >= minChatWidth && newRightWidth >= minCodeWidth) {
        setRightPanelWidth(newRightWidth);
      }
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const handleStopGeneration = () => {
    if (activeWsRef.current) {
      activeWsRef.current.close();
      activeWsRef.current = null;
    }
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const lastIdx = copy.length - 1;
      const last = copy[lastIdx];
      if (last && last.role === "assistant" && last.status !== "completed") {
        copy[lastIdx] = {
          ...last,
          status: "completed"
        };
      }
      return copy;
    });
  };

  const isStreaming = messages.length > 0 &&
    (messages[messages.length - 1].status === "thinking" ||
     messages[messages.length - 1].status === "streaming");

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    let sessionId = currentSessionId;
    
    // Check if new transient session
    if (!sessionId) {
      try {
        const words = text.trim().split(" ");
        const defaultName = words.slice(0, 4).join(" ") + (words.length > 4 ? "..." : "");
        const newSess = await createSession(defaultName);
        sessionId = newSess.id;
        setCurrentSessionId(sessionId);
        setChatTitle(defaultName);
        setSessionsList(prev => [newSess, ...prev]);
      } catch (e) {
        console.error("Failed to create session on message send", e);
        return;
      }
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      status: "thinking",
      thinkingDuration: 0,
      thinkingStart: Date.now(),
      thinkingSteps: []
    };

    setIsChatActive(true);
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    let promptText = text;
    if (comments.length > 0) {
      const commentCtx = comments.map(c => `[Context: ${c.fileName} at line ${c.line}]: "${c.text}"`).join("\n");
      promptText = `${text}\n\n---\nCode Comments Context:\n${commentCtx}`;
    }

    const connectAndSend = (retryCount: number) => {
      const token = getToken() || "";
      const wsUrl = `${WS_BACKEND_URL}/ws/chat/${sessionId}?token=${token}`;
      const socket = new WebSocket(wsUrl);
      activeWsRef.current = socket;
      
      let gotDoneEvent = false;

      socket.onopen = () => {
        const payload = {
          message: promptText,
          model: modelNameToKey(selectedModel),
          variant: selectedVariant,
          client_time: new Date().toLocaleString()
        };
        socket.send(json_stringify_safe(payload));
        if (retryCount === 0) {
          setComments([]);
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "hud_log") {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const lastIdx = copy.length - 1;
              const last = copy[lastIdx];
              if (last && last.role === "assistant") {
                const steps = last.thinkingSteps || [];
                const exists = steps.some(s => s.label === data.content);
                if (!exists) {
                  const stepId = `step-${steps.length + 1}`;
                  copy[lastIdx] = {
                    ...last,
                    thinkingSteps: [...steps, { id: stepId, label: data.content, status: "pending" }]
                  };
                }
              }
              return copy;
            });
          }
          else if (data.type === "clear_tokens") {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const lastIdx = copy.length - 1;
              const last = copy[lastIdx];
              if (last && last.role === "assistant") {
                const cleanContent = last.content.endsWith(data.content)
                  ? last.content.substring(0, last.content.length - data.content.length)
                  : last.content.replace(data.content, "");
                copy[lastIdx] = {
                  ...last,
                  content: cleanContent.trim()
                };
              }
              return copy;
            });
          }
          else if (data.type === "tool_success") {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const lastIdx = copy.length - 1;
              const last = copy[lastIdx];
              if (last && last.role === "assistant" && last.thinkingSteps) {
                copy[lastIdx] = {
                  ...last,
                  thinkingSteps: last.thinkingSteps.map(s => {
                    if (s.status === "pending") {
                      return { ...s, status: "success" };
                    }
                    return s;
                  })
                };
              }
              return copy;
            });
          }
          else if (data.type === "tool_failed") {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const lastIdx = copy.length - 1;
              const last = copy[lastIdx];
              if (last && last.role === "assistant" && last.thinkingSteps) {
                copy[lastIdx] = {
                  ...last,
                  thinkingSteps: last.thinkingSteps.map(s => {
                    if (s.status === "pending") {
                      return { ...s, status: "failed" };
                    }
                    return s;
                  })
                };
              }
              return copy;
            });
          }
          else if (data.type === "token") {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const lastIdx = copy.length - 1;
              const last = copy[lastIdx];
              if (last && last.role === "assistant") {
                const isThinking = last.status === "thinking";
                const newStatus = isThinking ? "streaming" : last.status;
                const newDuration = isThinking && last.thinkingStart
                  ? Math.max(1, Math.round((Date.now() - last.thinkingStart) / 1000))
                  : last.thinkingDuration;

                copy[lastIdx] = {
                  ...last,
                  status: newStatus,
                  thinkingDuration: newDuration,
                  content: last.content + data.content
                };
              }
              return copy;
            });
          }
          else if (data.type === "rename") {
            setChatTitle(data.name);
            loadInitialData();
          }
          else if (data.type === "done") {
            gotDoneEvent = true;
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const lastIdx = copy.length - 1;
              const last = copy[lastIdx];
              if (last && last.role === "assistant") {
                copy[lastIdx] = {
                  ...last,
                  status: "completed"
                };
              }
              return copy;
            });
            socket.close();
          }
        } catch (err) {
          console.error("Error parsing WS packet", err);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socket.onclose = () => {
        if (activeWsRef.current === socket && !gotDoneEvent) {
          if (retryCount < 3) {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const lastIdx = copy.length - 1;
              const last = copy[lastIdx];
              if (last && last.role === "assistant") {
                const steps = last.thinkingSteps || [];
                const stepId = `retry-${retryCount + 1}`;
                const stepLabel = `Connection dropped. Reconnecting (attempt ${retryCount + 1}/3)...`;
                copy[lastIdx] = {
                  ...last,
                  status: "thinking",
                  content: "",
                  thinkingSteps: [...steps, { id: stepId, label: stepLabel, status: "pending" }]
                };
              }
              return copy;
            });
            setTimeout(() => {
              connectAndSend(retryCount + 1);
            }, 1500);
          } else {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const lastIdx = copy.length - 1;
              const last = copy[lastIdx];
              if (last && last.role === "assistant") {
                const steps = last.thinkingSteps || [];
                copy[lastIdx] = {
                  ...last,
                  status: "completed",
                  thinkingSteps: [...steps.map(s => s.status === "pending" ? { ...s, status: "failed" as const } : s), {
                    id: "retry-failed",
                    label: "Reconnection failed. Please check your network connection.",
                    status: "failed"
                  }]
                };
              }
              return copy;
            });
            activeWsRef.current = null;
          }
        } else {
          if (activeWsRef.current === socket) {
            activeWsRef.current = null;
          }
        }
      };
    };

    connectAndSend(0);
  };

  const json_stringify_safe = (val: any) => {
    try {
      return JSON.stringify(val);
    } catch {
      return "";
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-[#05050a] px-4 select-none">
        <GradientBackground isChatActive={false} />
        
        <div className="w-full max-w-md bg-[#0e0e11] border border-zinc-800/80 rounded-2xl p-8 z-10 shadow-2xl relative">
          <div className="flex flex-col items-center mb-8">
            <h1 className="text-white text-3xl font-light tracking-[0.03em] font-sans mb-2" style={{ fontFamily: "Copernicus, Tiempos, Georgia, serif" }}>
              VoxKage
            </h1>
            <p className="text-zinc-500 text-[13px] font-sans text-center">
              Enter your developer master credentials to authorize access.
            </p>
          </div>
          
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] text-zinc-400 font-sans font-medium pl-1 text-left w-full block">
                Developer Email
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700 font-sans"
                placeholder="ayushdwivedi001@gmail.com"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] text-zinc-400 font-sans font-medium pl-1 text-left w-full block">
                Master Key
              </label>
              <input
                type="password"
                value={loginMasterKey}
                onChange={(e) => setLoginMasterKey(e.target.value)}
                required
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700 font-sans"
                placeholder="••••••••"
              />
            </div>
            
            {loginError && (
              <span className="text-red-400 text-[12.5px] font-sans pl-1 block text-left">
                {loginError}
              </span>
            )}
            
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_12px_rgba(37,99,235,0.45)] text-white rounded-xl font-sans font-medium text-[14.5px] transition-all duration-200 cursor-pointer mt-4 flex items-center justify-center disabled:opacity-50"
            >
              {loginLoading ? "Authorizing..." : "Authorize Access"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const sessionArtifacts = computeSessionFiles(messages);

  let displayedActiveFile = activeFile;
  if (activeFile) {
    const fileData = sessionArtifacts.find(f => f.name === activeFile.name);
    if (fileData) {
      const selectedVerNum = activeFileVersions[activeFile.name] || fileData.versions.length;
      const verObj = fileData.versions.find(v => v.version === selectedVerNum) || fileData.versions[fileData.versions.length - 1];
      if (verObj) {
        displayedActiveFile = {
          name: activeFile.name,
          code: verObj.code,
        };
      }
    }
  }

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#05050a]">
      {/* Animated mesh gradient background (prop driven to slide down) */}
      <GradientBackground isChatActive={isChatActive} />

      {/* Claude-style Premium Sidebar */}
      <Sidebar 
        isExpanded={sidebarExpanded} 
        setIsExpanded={setSidebarExpanded}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        sessionsList={sessionsList}
        onCreateNewChat={handleCreateNewChat}
        onLogout={handleLogout}
        onToggleStar={handleToggleStar}
        onRenameSession={handleRenameSessionClick}
        onDeleteSession={handleDeleteSession}
      />

      {/* Main content workspace container */}
      <main
        className="relative flex flex-col flex-grow items-center justify-between overflow-hidden bg-transparent transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10"
        style={{
          height: "100vh",
        }}
      >
        {/* Active Chat Bottom Background Glow (no noise, smooth linear gradient, spans bottom 28% of page) */}
        {isChatActive && (
          <div className="absolute bottom-0 left-0 right-0 h-[28%] z-0 pointer-events-none bg-gradient-to-t from-[#041285]/24 via-[#041285]/06 to-transparent" />
        )}
        {/* === ACTIVE CHAT HEADER (Only visible when chat is active) === */}
        <div
          className={`absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-25 border-b border-transparent transition-all duration-500 select-none ${
            isChatActive
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-4 pointer-events-none"
          } ${isExpanded ? "hidden" : "flex"}`}
          style={{
            right: (activeFile || showArtifactsPanel) ? `${rightPanelWidth}px` : 0,
          }}
        >
          {/* Chat dropdown title */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHeaderDropdown(prev => !prev)}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-white/5 text-zinc-300 hover:text-zinc-100 transition-all duration-200 text-[14.5px] font-medium cursor-pointer"
            >
              <span>{chatTitle}</span>
              <ChevronDown className="w-4 h-4 opacity-75" />
            </button>

            {showHeaderDropdown && (() => {
              const currentSess = sessionsList.find(s => s.id === currentSessionId);
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
                      <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-white text-white" : "text-zinc-400"}`} />
                      <span>{isStarred ? "Remove Star" : "Star"}</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderDropdown(false);
                        if (currentSessionId && currentSess) {
                          handleRenameSessionClick(currentSessionId, currentSess.name);
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

          {/* Share & Artifacts Button Container */}
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

        {/* === SPLIT SCREEN VIEW WORKSPACE === */}
        <div className="relative flex flex-grow w-full h-full overflow-hidden">
          
          {/* Left Column: Chat Area */}
          <div
            style={{
              width: (activeFile || showArtifactsPanel) && isExpanded ? "0px" : (activeFile || showArtifactsPanel) ? `calc(100% - ${rightPanelWidth}px)` : "100%",
              display: (activeFile || showArtifactsPanel) && isExpanded ? "none" : "flex",
            }}
            className="flex flex-col h-full relative transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
          >
            {/* Scrollable Chat Area */}
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className={`w-full h-full overflow-y-auto custom-chat-scrollbar flex flex-col items-center transition-all duration-500 ease-out ${
                isChatActive ? "opacity-100 block" : "opacity-0 hidden"
              }`}
            >
              <div className="w-full max-w-3xl flex flex-col gap-8 pt-24 pb-[180px] px-4 md:px-6">
                {isSessionLoading ? (
                  <div className="flex flex-col gap-8 w-full animate-pulse select-none">
                    <div className="flex gap-4 items-start w-full">
                      <div className="w-8 h-8 rounded-full bg-zinc-800/40 flex-shrink-0" />
                      <div className="flex flex-col gap-3.5 flex-grow">
                        <div className="h-4 bg-zinc-800/40 rounded-lg w-1/4" />
                        <div className="h-3.5 bg-zinc-800/40 rounded-lg w-3/4" />
                        <div className="h-3.5 bg-zinc-800/40 rounded-lg w-1/2" />
                        <div className="h-3.5 bg-zinc-800/40 rounded-lg w-5/6" />
                      </div>
                    </div>
                    <div className="flex gap-4 items-start justify-end w-full mt-4">
                      <div className="flex flex-col gap-3.5 items-end flex-grow max-w-[70%]">
                        <div className="h-3.5 bg-zinc-800/40 rounded-lg w-3/4" />
                        <div className="h-3.5 bg-zinc-800/40 rounded-lg w-1/2" />
                      </div>
                      <div className="w-8 h-8 rounded-full bg-zinc-800/40 flex-shrink-0" />
                    </div>
                    <div className="flex gap-4 items-start w-full mt-4">
                      <div className="w-8 h-8 rounded-full bg-zinc-800/40 flex-shrink-0" />
                      <div className="flex flex-col gap-3.5 flex-grow">
                        <div className="h-4 bg-zinc-800/40 rounded-lg w-1/5" />
                        <div className="h-3.5 bg-zinc-800/40 rounded-lg w-2/3" />
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="w-full">
                      {msg.role === "user" ? (
                        /* User Bubble (aligned right) */
                        <div className="flex flex-col items-end w-full">
                          <UserBubble content={msg.content} />
                        </div>
                      ) : (
                        /* Assistant Response (aligned left) */
                        <AssistantResponseBubble
                          msg={msg}
                          setActiveFile={setActiveFile}
                          onScrollToBottom={scrollToBottom}
                          messages={messages}
                          activeFileVersions={activeFileVersions}
                          setActiveFileVersions={setActiveFileVersions}
                        />
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>


            {/* Landing Hero Title & Input (only visible when not active, centered vertically) */}
            {!isChatActive && (
              <div className="flex-grow flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-4 z-20">
                <h1
                  className="text-white text-3xl sm:text-[40px] md:text-[44px] font-normal tracking-[-0.015em] select-none leading-tight mb-7 text-center font-serif"
                >
                  Ready to build, Ayush?
                </h1>
                <PromptInput
                  onSubmit={handleSendMessage}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  selectedVariant={selectedVariant}
                  setSelectedVariant={setSelectedVariant}
                  modelsList={modelsList}
                  onOpenMoreModels={() => setMoreModelsModalOpen(true)}
                  isStreaming={isStreaming}
                  onStop={handleStopGeneration}
                  comments={comments}
                  onRemoveComment={(id) => setComments(prev => prev.filter(c => c.id !== id))}
                  onClickComment={(fileName, line) => {
                    const matchingFile = sessionArtifacts.find(f => f.name === fileName);
                    if (matchingFile) {
                      setActiveFile({ name: fileName, code: matchingFile.versions[matchingFile.versions.length - 1].code });
                      setJumpToLine(line);
                      setShowArtifactsPanel(false);
                    }
                  }}
                />
              </div>
            )}

            {/* Pinned Bottom Input Panel (Only visible when active, sticky at the bottom) */}
            {isChatActive && (
              <div className="absolute bottom-0 left-0 right-0 z-30 pb-5 pt-10 px-4 flex flex-col items-center gap-2.5">
                {/* Content layers */}
                <div className="relative z-10 w-full flex flex-col items-center gap-2.5">
                  {showScrollBottom && (
                    <button
                      type="button"
                      onClick={scrollToBottom}
                      className="flex items-center justify-center w-8 h-8 rounded-full border border-zinc-800 bg-[#16161a] hover:bg-[#202025] text-zinc-400 hover:text-zinc-200 shadow-lg transition-all duration-200 cursor-pointer animate-fadeIn mb-1"
                      aria-label="Scroll to bottom"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  )}
                  <PromptInput
                    onSubmit={handleSendMessage}
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                    selectedVariant={selectedVariant}
                    setSelectedVariant={setSelectedVariant}
                    modelsList={modelsList}
                    onOpenMoreModels={() => setMoreModelsModalOpen(true)}
                    isStreaming={isStreaming}
                    onStop={handleStopGeneration}
                    comments={comments}
                    onRemoveComment={(id) => setComments(prev => prev.filter(c => c.id !== id))}
                    onClickComment={(fileName, line) => {
                      const matchingFile = sessionArtifacts.find(f => f.name === fileName);
                      if (matchingFile) {
                        setActiveFile({ name: fileName, code: matchingFile.versions[matchingFile.versions.length - 1].code });
                        setJumpToLine(line);
                        setShowArtifactsPanel(false);
                      }
                    }}
                  />

                  <span className="text-[12px] text-zinc-500 font-sans tracking-wide select-none">
                    VoxKage can make mistakes. Please double check responses.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Draggable Vertical Splitter Handle */}
          {(activeFile || showArtifactsPanel) && !isExpanded && (
            <div
              onPointerDown={handlePointerDown}
              className="w-1 cursor-col-resize h-full bg-zinc-800/80 hover:bg-blue-600/80 transition-colors z-30 select-none flex items-center justify-center relative group"
            >
              <div className="absolute w-[2px] h-8 rounded-full bg-zinc-700 group-hover:bg-blue-500 transition-colors" />
            </div>
          )}

          {/* Right Column: Code Inspection Panel */}
          {displayedActiveFile && (
            <div
              style={{
                width: isExpanded ? "100%" : `${rightPanelWidth}px`,
              }}
              className="h-full flex-shrink-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
            >
              <FileInspectorPanel
                fileName={displayedActiveFile.name}
                code={displayedActiveFile.code}
                onClose={() => {
                  setActiveFile(null);
                  setJumpToLine(null);
                }}
                isExpanded={isExpanded}
                onToggleExpand={() => setIsExpanded(!isExpanded)}
                comments={comments}
                onAddComment={(line, text) => {
                  setComments(prev => [
                    ...prev,
                    {
                      id: `comment-${Date.now()}`,
                      fileName: displayedActiveFile!.name,
                      line,
                      text
                    }
                  ]);
                }}
                onDeleteComment={(id) => {
                  setComments(prev => prev.filter(c => c.id !== id));
                }}
                jumpToLine={jumpToLine}
              />
            </div>
          )}

          {showArtifactsPanel && !displayedActiveFile && (
            <div
              style={{
                width: isExpanded ? "100%" : `${rightPanelWidth}px`,
              }}
              className="h-full flex-shrink-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden bg-[#0d0d11] border-l border-zinc-800/80 flex flex-col"
            >
              <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-800/80 bg-[#0d0d11] select-none flex-shrink-0">
                <span className="text-[14.5px] font-medium text-zinc-300 font-sans tracking-wide">
                  Artifacts
                </span>
                <button
                  type="button"
                  onClick={() => setShowArtifactsPanel(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
                  aria-label="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-grow overflow-auto p-5 flex flex-col gap-4">
                <h3 className="text-zinc-100 text-[15px] font-medium font-sans">
                  Artifacts created in this session
                </h3>
                <div className="flex flex-col gap-2.5">
                  {sessionArtifacts.map((file, idx) => {
                    const activeVer = activeFileVersions[file.name] || file.versions.length;
                    const verObj = file.versions.find(v => v.version === activeVer) || file.versions[file.versions.length - 1];
                    return (
                      <FileListItem
                        key={idx}
                        name={file.name}
                        type={file.type}
                        versions={file.versions}
                        activeVersion={activeVer}
                        onSelectVersion={(ver) => {
                          setActiveFileVersions(prev => ({ ...prev, [file.name]: ver }));
                        }}
                        onClick={() => {
                          setActiveFile({ name: file.name, code: verObj.code });
                          setShowArtifactsPanel(false);
                        }}
                        onDownload={() => {
                          const blob = new Blob([verObj.code], { type: "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = file.name;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* More Models Modal */}
      {moreModelsModalOpen && (
        <MoreModelsModal
          selectedModel={selectedModel}
          modelsList={modelsList}
          onSelectModel={setSelectedModel}
          onToggleFavourite={handleToggleFavourite}
          onClose={() => setMoreModelsModalOpen(false)}
        />
      )}

      {/* Rename Session Dialog */}
      {renameSessionId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            onClick={() => setRenameSessionId(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200" 
          />
          <div className="relative w-full max-w-sm bg-[#121216] border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 flex flex-col gap-4 font-sans text-zinc-300 animate-fadeIn">
            <h3 className="text-zinc-100 text-base font-semibold">Rename Chat</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  executeRenameSession();
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRenameSessionId(null)}
                className="px-4 py-2 rounded-xl border border-zinc-800 text-[13.5px] hover:bg-zinc-800/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRenameSession}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_12px_rgba(37,99,235,0.45)] text-white border border-blue-500/30 transition-colors text-[13.5px] font-medium cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS custom scrollbar style tag */}
      <style>{`
        .custom-chat-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-chat-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-chat-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 99px;
        }
        .custom-chat-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.16);
        }
      `}</style>
    </div>
  );
}
