"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, ChevronDown, Mic, ArrowUp, Square } from "lucide-react";
import ModelSelectorDropdown from "./ModelSelectorDropdown";
import VariantSubPopup from "./VariantSubPopup";

interface ModelOption {
  name: string;
  desc: string;
  unavailable?: boolean;
  requiresUpgrade?: boolean;
  isFavourite?: boolean;
}

interface PromptInputProps {
  onSubmit?: (text: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  selectedVariant: string;
  setSelectedVariant: (variant: string) => void;
  modelsList: ModelOption[];
  onOpenMoreModels: () => void;
  isStreaming?: boolean;
  onStop?: () => void;
}

export default function PromptInput({
  onSubmit,
  selectedModel,
  setSelectedModel,
  selectedVariant,
  setSelectedVariant,
  modelsList,
  onOpenMoreModels,
  isStreaming = false,
  onStop,
}: PromptInputProps) {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // Hover states for Variant sub-popup
  const [isHoveringVariantRow, setIsHoveringVariantRow] = useState(false);
  const [isHoveringVariantPopup, setIsHoveringVariantPopup] = useState(false);
  const showVariantPopup = modelDropdownOpen && (isHoveringVariantRow || isHoveringVariantPopup);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Click outside listener for main dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    if (modelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [modelDropdownOpen]);

  const handleSelectModel = (modelName: string) => {
    setSelectedModel(modelName);
    setModelDropdownOpen(false);
  };

  const handleSelectVariant = (variantName: string) => {
    setSelectedVariant(variantName);
    setIsHoveringVariantRow(false);
    setIsHoveringVariantPopup(false);
  };

  const handleOpenMoreModels = () => {
    setModelDropdownOpen(false);
    onOpenMoreModels();
  };

  const handleMouseEnterVariant = () => setIsHoveringVariantRow(true);
  const handleMouseLeaveVariant = () => {
    setTimeout(() => {
      setIsHoveringVariantRow(false);
    }, 120);
  };

  const handleMouseEnterVariantPopup = () => setIsHoveringVariantPopup(true);
  const handleMouseLeaveVariantPopup = () => setIsHoveringVariantPopup(false);

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

  const handleSubmit = () => {
    if (value.trim().length > 0) {
      if (onSubmit) {
        onSubmit(value);
      }
      setValue("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasText = value.trim().length > 0;

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
          {/* Model Selector Dropdown & Button Wrapper */}
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all duration-200 text-[13.5px] font-medium border border-transparent hover:border-zinc-800 bg-transparent select-none cursor-pointer"
            >
              <span>{selectedModel}</span>
              <span className="text-zinc-500 font-normal text-[12.5px] ml-0.5">{selectedVariant}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70 ml-0.5" />
            </button>

            {/* Main Dropdown */}
            {modelDropdownOpen && (
              <ModelSelectorDropdown
                selectedModel={selectedModel}
                selectedVariant={selectedVariant}
                modelsList={modelsList}
                onSelectModel={handleSelectModel}
                onOpenMoreModels={handleOpenMoreModels}
                onMouseEnterVariant={handleMouseEnterVariant}
                onMouseLeaveVariant={handleMouseLeaveVariant}
              />
            )}

            {/* Variant Sub-Popup */}
            {showVariantPopup && (
              <VariantSubPopup
                selectedVariant={selectedVariant}
                onSelectVariant={handleSelectVariant}
                onMouseEnter={handleMouseEnterVariantPopup}
                onMouseLeave={handleMouseLeaveVariantPopup}
              />
            )}
          </div>

          {/* Voice Input Button */}
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all duration-200 active:scale-95"
            aria-label="Voice input"
          >
            <Mic className="w-5 h-5 opacity-90" />
          </button>

          {/* Submit / Stop Button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 active:scale-95 cursor-pointer ml-1 transition-all duration-200"
              aria-label="Stop generation"
            >
              <Square className="w-4 h-4 fill-zinc-300 stroke-none" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300 ml-1 ${
                hasText
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
                  : "bg-zinc-700/50 text-zinc-500 cursor-default"
              }`}
              aria-label="Submit prompt"
            >
              <ArrowUp className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}
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
