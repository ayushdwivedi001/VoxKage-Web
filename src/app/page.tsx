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
} from "lucide-react";
import GradientBackground from "@/components/GradientBackground";
import PromptInput from "@/components/PromptInput";
import Sidebar from "@/components/Sidebar";
import FileListItem from "@/components/FileListItem";
import FileInspectorPanel from "@/components/FileInspectorPanel";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: Array<{ name: string; type: string; code: string }>;
}

const MOCK_TELEGRAM_FILES = [
  {
    name: "telegram_watcher.py",
    type: "py",
    code: `import os
import sys
import time
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("telegram_watcher")

class TelegramHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith("telegram_inbox.json"):
            logger.info(f"Inbox file updated: {event.src_path}")

if __name__ == "__main__":
    path = os.path.expanduser("~/.voxkage/telegram_inbox.json")
    event_handler = TelegramHandler()
    observer = Observer()
    observer.schedule(event_handler, path=os.path.dirname(path), recursive=False)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()`
  },
  {
    name: "telegram_server.py",
    type: "py",
    code: `import os
import sys
import json
import logging
import time
from pathlib import Path

# Persistent state
_VOXKAGE_DIR      = Path(os.path.expanduser("~")) / ".voxkage"
_OFFSET_FILE      = _VOXKAGE_DIR / "telegram_offset.json"
_PENDING_REPLY_FILE = _VOXKAGE_DIR / "telegram_pending_reply.json"
_INBOX_FILE       = _VOXKAGE_DIR / "telegram_inbox.json"
_DOWNLOAD_DIR     = _VOXKAGE_DIR / "telegram_downloads"

_VOXKAGE_DIR.mkdir(parents=True, exist_ok=True)
_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Path setup
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from _env import load_voxkage_env
load_voxkage_env()

from mcp.server.fastmcp import FastMCP
mcp = FastMCP("voxkage-telegram")
logger = logging.getLogger(__name__)

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
API_BASE = f"https://api.telegram.org/bot{TOKEN}"

_PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp"}`
  },
  {
    name: "watcher_launcher.py",
    type: "py",
    code: `import os
import subprocess
import sys
from pathlib import Path

def launch_watcher():
    watcher_path = Path(__file__).parent / "telegram_watcher.py"
    if not watcher_path.exists():
        print("Watcher script not found!")
        return
    
    # Singleton lock check
    lock_file = Path(os.path.expanduser("~")) / ".voxkage" / "watcher.lock"
    if lock_file.exists():
        print("Watcher process already running.")
        return
        
    subprocess.Popen([sys.executable, str(watcher_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("Telegram watcher daemon started successfully.")`
  }
];

// Max collapsed height in px before showing Show more
const USER_BUBBLE_MAX_H = 180;

function UserBubble({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);
  const innerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    // Temporarily remove the maxHeight to measure true scrollHeight
    el.style.maxHeight = "none";
    const natural = el.scrollHeight;
    el.style.maxHeight = "";
    setNeedsClamp(natural > USER_BUBBLE_MAX_H);
  }, [content]);

  return (
    <div className="max-w-[85%] flex flex-col items-end">
      {/* The bubble itself */}
      <div
        className="bg-[#202024] text-zinc-100 rounded-2xl px-4 pt-3 text-[15px] leading-relaxed font-sans border border-zinc-800/40 select-text w-full"
        style={{ paddingBottom: needsClamp ? 0 : "10px" }}
      >
        {/* Text content wrapper — clamped when collapsed */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            maxHeight: needsClamp && !expanded ? `${USER_BUBBLE_MAX_H}px` : undefined,
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
          }}
        >
          {/* Actual text, measured via this ref */}
          <div ref={innerRef}>{content}</div>

          {/* Gradient fade — inside the clamped region so it covers the last lines */}
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

        {/* Show more / Show less row — inside the bubble, below the text */}
        {needsClamp && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left pt-1.5 pb-2.5 mt-1 border-t border-zinc-800/20 group cursor-pointer focus:outline-none flex items-center"
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

export default function Home() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isChatActive, setIsChatActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatTitle, setChatTitle] = useState("Greeting");

  // Code inspection split pane states
  const [activeFile, setActiveFile] = useState<{ name: string; code: string } | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(480);
  const [isExpanded, setIsExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageIdCounter = useRef(0);
  const isDraggingRef = useRef(false);

  // Auto scroll to bottom of chat when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Pointer drag events for panel resizing
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

      // Clamps: min chat column is 380px, min code inspector column is 300px
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

  const handleSendMessage = (text: string) => {
    messageIdCounter.current += 1;
    const userMsgId = `msg-user-${messageIdCounter.current}`;
    const newUserMessage: Message = {
      id: userMsgId,
      role: "user",
      content: text,
    };

    // Update state to active chat and append user message
    setIsChatActive(true);
    setMessages((prev) => [...prev, newUserMessage]);

    // Set dynamic chat title based on the first query
    if (messages.length === 0) {
      const truncatedTitle = text.length > 15 ? text.substring(0, 15) + "..." : text;
      setChatTitle(truncatedTitle);
    }

    const isTelegramFileQuery =
      text.toLowerCase().includes("python") &&
      text.toLowerCase().includes("file") &&
      text.toLowerCase().includes("telegram");

    // Trigger mock assistant response after delay
    setTimeout(() => {
      messageIdCounter.current += 1;
      const assistantMsgId = `msg-assistant-${messageIdCounter.current}`;
      
      let mockResponse = getMockResponse(text);
      let responseFiles: typeof MOCK_TELEGRAM_FILES | undefined = undefined;

      if (isTelegramFileQuery) {
        mockResponse = `Auto-start wiring. The launcher snippet goes into cli.py's cmd_launch() right after _ensure_tray_running(). Every time you run voxkage, it checks the lock file and starts the watcher if it isn't already running — same singleton pattern as the tray. You never have to manually start it.

Drop-in replacement. The telegram_server.py MCP tool names are identical — nothing in GEMINI.md or your settings needs to change. telegram_get_pending_messages still works as a manual check, it now also reads the inbox file in addition to live-polling.`;
        responseFiles = MOCK_TELEGRAM_FILES;
      }

      const newAssistantMessage: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: mockResponse,
        files: responseFiles,
      };
      setMessages((prev) => [...prev, newAssistantMessage]);
    }, 900);
  };

  const getMockResponse = (text: string): string => {
    const lower = text.toLowerCase().trim();
    if (lower.includes("hello") || lower.includes("hi")) {
      return "Hello! How can I help you today?";
    }
    if (lower.includes("help") || lower.includes("what can you do")) {
      return "I can assist you with web design layout verification, shader compiling, backend optimizations, and system tasks, sir. Let me know what you would like to build next.";
    }
    return `I have received your request regarding "${text}". As a mock local service, I am ready to process this task and generate the next stage of the landing interface. How would you like me to proceed?`;
  };

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#05050a]">
      {/* Animated mesh gradient background (prop driven to slide down) */}
      <GradientBackground isChatActive={isChatActive} />

      {/* Claude-style Premium Sidebar */}
      <Sidebar isExpanded={sidebarExpanded} setIsExpanded={setSidebarExpanded} />

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
            right: activeFile ? `${rightPanelWidth}px` : 0,
          }}
        >
          {/* Chat dropdown title */}
          <button
            type="button"
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-white/5 text-zinc-300 hover:text-zinc-100 transition-all duration-200 text-[14.5px] font-medium"
          >
            <span>{chatTitle}</span>
            <ChevronDown className="w-4 h-4 opacity-75" />
          </button>

          {/* Share Button */}
          {!activeFile && (
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-[#121215]/80 hover:bg-zinc-800/80 text-zinc-300 hover:text-white text-[13.5px] font-medium transition-all duration-200"
            >
              Share
            </button>
          )}
        </div>

        {/* === SPLIT SCREEN VIEW WORKSPACE === */}
        <div className="relative flex flex-grow w-full h-full overflow-hidden">
          
          {/* Left Column: Chat Area */}
          <div
            style={{
              width: activeFile && isExpanded ? "0px" : activeFile ? `calc(100% - ${rightPanelWidth}px)` : "100%",
              display: activeFile && isExpanded ? "none" : "flex",
            }}
            className="flex flex-col h-full relative transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
          >
            {/* Scrollable Chat Area */}
            <div
              className={`w-full h-full overflow-y-auto custom-chat-scrollbar flex flex-col items-center transition-all duration-500 ease-out ${
                isChatActive ? "opacity-100 block" : "opacity-0 hidden"
              }`}
            >
              <div className="w-full max-w-3xl flex flex-col gap-8 pt-24 pb-[180px] px-4 md:px-6">
                {messages.map((msg) => (
                  <div key={msg.id} className="w-full">
                    {msg.role === "user" ? (
                      /* User Bubble (aligned right) */
                      <div className="flex flex-col items-end w-full">
                        <UserBubble content={msg.content} />
                      </div>
                    ) : (
                      /* Assistant Response (aligned left) */
                      <div className="flex flex-col items-start w-full">
                        {/* Small thought tag */}
                        <span className="text-[12.5px] text-zinc-500 font-sans mb-1.5 select-none">
                          Thought for 0s
                        </span>

                        {/* Main text message */}
                        <div className="text-[16.5px] text-zinc-100 leading-relaxed font-serif max-w-[90%] select-text whitespace-pre-wrap">
                          {msg.content}
                        </div>

                        {/* Custom Mock Files List */}
                        {msg.files && msg.files.length > 0 && (
                          <div className="flex flex-col gap-2.5 w-full max-w-[90%] mt-4">
                            {msg.files.map((file, idx) => (
                              <FileListItem
                                key={idx}
                                name={file.name}
                                type={file.type}
                                onClick={() => {
                                  setActiveFile(file);
                                  setIsExpanded(false);
                                }}
                                onDownload={() => alert(`Downloading ${file.name}`)}
                              />
                            ))}

                            {/* Download All Button */}
                            <div className="mt-1 flex justify-start">
                              <button
                                type="button"
                                onClick={() => alert("Downloading all files")}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-[#121215]/80 hover:bg-zinc-800/80 text-zinc-300 hover:text-white text-[13px] font-medium transition-all duration-200 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download all</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Actions bar */}
                        <div className="flex items-center gap-4 mt-3 text-zinc-500 select-none mb-2">
                          <button
                            type="button"
                            className="hover:text-zinc-300 transition-colors"
                            aria-label="Copy response"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="hover:text-zinc-300 transition-colors"
                            aria-label="Speak response"
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
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Landing Hero Title & Input (only visible when not active, centered vertically) */}
            {!isChatActive && (
              <div className="flex-grow flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-4 z-20">
                <h1
                  className="text-white text-3xl sm:text-[40px] md:text-[44px] font-normal tracking-[-0.015em] select-none leading-tight mb-7 text-center"
                  style={{ fontFamily: "Copernicus, Tiempos, Georgia, serif" }}
                >
                  Ready to build, Ayush?
                </h1>
                <PromptInput onSubmit={handleSendMessage} />
              </div>
            )}

            {/* Pinned Bottom Input Panel (Only visible when active, sticky at the bottom) */}
            {isChatActive && (
              <div className="absolute bottom-0 left-0 right-0 z-30 pb-5 pt-10 px-4 flex flex-col items-center gap-2.5">
                {/* Content layers */}
                <div className="relative z-10 w-full flex flex-col items-center gap-2.5">
                  <PromptInput onSubmit={handleSendMessage} />

                  <span className="text-[12px] text-zinc-500 font-sans tracking-wide select-none">
                    VoxKage can make mistakes. Please double check responses.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Draggable Vertical Splitter Handle */}
          {activeFile && !isExpanded && (
            <div
              onPointerDown={handlePointerDown}
              className="w-1 cursor-col-resize h-full bg-zinc-800/80 hover:bg-blue-600/80 transition-colors z-30 select-none flex items-center justify-center relative group"
            >
              <div className="absolute w-[2px] h-8 rounded-full bg-zinc-700 group-hover:bg-blue-500 transition-colors" />
            </div>
          )}

          {/* Right Column: Code Inspection Panel */}
          {activeFile && (
            <div
              style={{
                width: isExpanded ? "100%" : `${rightPanelWidth}px`,
              }}
              className="h-full flex-shrink-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
            >
              <FileInspectorPanel
                fileName={activeFile.name}
                code={activeFile.code}
                onClose={() => setActiveFile(null)}
                isExpanded={isExpanded}
                onToggleExpand={() => setIsExpanded(!isExpanded)}
              />
            </div>
          )}

        </div>
      </main>

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
