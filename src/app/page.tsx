"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Copy,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import GradientBackground from "@/components/GradientBackground";
import PromptInput from "@/components/PromptInput";
import Sidebar from "@/components/Sidebar";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isChatActive, setIsChatActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatTitle, setChatTitle] = useState("Greeting");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageIdCounter = useRef(0);

  // Auto scroll to bottom of chat when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

    // Trigger mock assistant response after delay
    setTimeout(() => {
      messageIdCounter.current += 1;
      const assistantMsgId = `msg-assistant-${messageIdCounter.current}`;
      const mockResponse = getMockResponse(text);
      const newAssistantMessage: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: mockResponse,
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
        {/* === ACTIVE CHAT HEADER (Only visible when chat is active) === */}
        <div
          className={`absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-25 border-b border-transparent transition-all duration-500 select-none ${
            isChatActive
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-4 pointer-events-none"
          }`}
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
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-[#121215]/80 hover:bg-zinc-800/80 text-zinc-300 hover:text-white text-[13.5px] font-medium transition-all duration-200"
          >
            Share
          </button>
        </div>

        {/* === CENTRAL RESPONSIVE WORKSPACE === */}
        <div className="relative flex flex-col w-full h-full">
          {/* Scrollable Chat Area - Spans full width/height so scrollbar is at viewport edge */}
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
                      <div className="bg-[#202024] text-zinc-100 rounded-2xl px-4 py-2.5 max-w-[85%] text-[15px] leading-relaxed font-sans border border-zinc-800/40 select-text">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    /* Assistant Response (aligned left) */
                    <div className="flex flex-col items-start w-full">
                      {/* Small thought tag */}
                      <span className="text-[12.5px] text-zinc-500 font-sans mb-1.5 select-none">
                        Thought for 0s
                      </span>

                      {/* Main text message */}
                      <div className="text-[16.5px] text-zinc-100 leading-relaxed font-serif max-w-[90%] select-text">
                        {msg.content}
                      </div>

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
              <h1 className="text-white text-3xl sm:text-[40px] md:text-[44px] font-semibold tracking-[-0.02em] select-none leading-tight font-sans mb-7 text-center">
                Ready to build, Ayush?
              </h1>
              <PromptInput onSubmit={handleSendMessage} />
            </div>
          )}

          {/* Pinned Bottom Input Panel (Only visible when active, sticky at the bottom) */}
          {isChatActive && (
            <div className="absolute bottom-0 left-0 right-0 z-30 pb-5 pt-10 px-4 flex flex-col items-center gap-2.5 bg-gradient-to-t from-[#05050a] via-[#05050a]/90 to-transparent">
              <PromptInput onSubmit={handleSendMessage} />
              
              <span className="text-[12px] text-zinc-500 font-sans tracking-wide select-none">
                VoxKage can make mistakes. Please double check responses.
              </span>
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
