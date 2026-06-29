"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, ChevronDown, Mic, ArrowUp } from "lucide-react";

export default function PromptInput() {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize height based on value
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to let the browser recalculate the correct scrollHeight
      textarea.style.height = "auto";
      
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 220; // Maximum height in pixels before showing scrollbar
      
      if (scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = "auto";
      } else {
        textarea.style.height = `${scrollHeight}px`;
        textarea.style.overflowY = "hidden";
      }
    }
  };

  // Adjust height on text change
  useEffect(() => {
    adjustHeight();
  }, [value]);

  // Adjust height on window resize to ensure responsiveness
  useEffect(() => {
    window.addEventListener("resize", adjustHeight);
    return () => {
      window.removeEventListener("resize", adjustHeight);
    };
  }, []);

  // Auto-focus on load and place cursor at the end of the text
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      // Set cursor to the end
      textarea.setSelectionRange(value.length, value.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Handle submit action here
    }
  };

  return (
    <div
      className={`w-full max-w-[720px] bg-[#18181c]/90 border transition-all duration-300 ${
        isFocused ? "border-zinc-700 shadow-lg shadow-black/20" : "border-zinc-800/80"
      } rounded-[28px] p-5 pb-4 flex flex-col backdrop-blur-md`}
    >
      {/* Input Field */}
      <div className="relative w-full">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          rows={1}
          className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[17px] text-zinc-100 placeholder-zinc-500 font-sans tracking-wide leading-relaxed resize-none p-0 custom-scrollbar"
          placeholder="Ask VoxKage, type / for commands"
          style={{
            caretColor: "#e4e4e7", // zinc-200 cursor
            minHeight: "28px",
          }}
        />
      </div>

      {/* Bottom Actions Bar */}
      <div className="flex items-center justify-between mt-4 pt-1 w-full border-t border-transparent">
        {/* Left Side: Plus Button */}
        <button
          type="button"
          className="flex items-center justify-center w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all duration-200 active:scale-95"
          aria-label="Add attachment"
        >
          <Plus className="w-[22px] h-[22px] stroke-[2.2]" />
        </button>

        {/* Right Side: Options and Submit */}
        <div className="flex items-center gap-3">
          {/* Build Dropdown */}
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all duration-200 text-[14px] font-medium"
          >
            <span>Build</span>
            <ChevronDown className="w-4 h-4 opacity-70" />
          </button>

          {/* Voice Input Button */}
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all duration-200 active:scale-95"
            aria-label="Voice input"
          >
            <Mic className="w-5 h-5 opacity-90" />
          </button>

          {/* Submit Button */}
          <button
            type="button"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-700/80 hover:bg-zinc-600 text-zinc-100 hover:text-white transition-all duration-200 active:scale-95 cursor-pointer ml-1"
            aria-label="Submit prompt"
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Sleek custom scrollbar style tag */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.28);
        }
      `}</style>
    </div>
  );
}
