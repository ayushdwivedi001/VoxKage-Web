import React, { useEffect, useState, useRef } from "react";
import {
  Check,
  ChevronRight,
  Clock,
  Copy,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Globe,
  X,
  Image as ImageIcon
} from "lucide-react";
import {
  Message,
  extractFilesFromContent,
  removeCodeBlocks,
  computeSessionFiles,
  parseMessageContent,
  renderFormattedContent
} from "@/lib/chatHelpers";
import FileListItem from "./FileListItem";
import ImageCarousel from "./ImageCarousel";

interface AssistantResponseBubbleProps {
  msg: Message;
  setActiveFile: (file: { name: string; code: string } | null) => void;
  onScrollToBottom: () => void;
  messages: Message[];
  activeFileVersions: { [name: string]: number };
  setActiveFileVersions: React.Dispatch<React.SetStateAction<{ [name: string]: number }>>;
}

export default function AssistantResponseBubble({
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
  const { thinkingContent, finalContent, sources, images } = parseMessageContent(msg.content);

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

  const renderStepIcon = (status: "pending" | "success" | "failed", label: string) => {
    const isPending = status === "pending";
    const lowerLabel = label.toLowerCase();
    
    // Check if it's an image search
    if (lowerLabel.includes("search images") || lowerLabel.includes("image")) {
      return (
        <ImageIcon 
          className={`w-3.5 h-3.5 ${
            isPending ? "text-blue-400 animate-pulse animate-duration-1000" : "text-zinc-400"
          }`} 
        />
      );
    }
    
    // Check if it's general web search/deep search/fetch
    if (lowerLabel.includes("search:") || lowerLabel.includes("fetch") || lowerLabel.includes("deep search") || lowerLabel.includes("parallel search")) {
      return (
        <Globe 
          className={`w-3.5 h-3.5 ${
            isPending ? "text-blue-400 animate-pulse animate-duration-1000" : "text-zinc-400"
          }`} 
        />
      );
    }

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
      {/* --- Clickable Thinking Accordion Header --- */}
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
                    {renderStepIcon(step.status, step.label)}
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

      {/* --- Dynamic Sliding Image Carousel --- */}
      {images && images.length > 0 && (
        <div className="w-full max-w-[90%] select-none">
          <ImageCarousel images={images} />
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
                        className="w-5 h-5 rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234b5563' stroke-width='2'/%3E";
                        }}
                      />
                      <div className="flex flex-col gap-0.5 min-w-0 flex-grow">
                        <span className="text-[13.5px] font-medium text-zinc-300 group-hover:text-white transition-colors truncate">
                          {src.title}
                        </span>
                        <span className="text-[11.5px] text-zinc-500 truncate">
                          {src.domain}
                        </span>
                      </div>
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
