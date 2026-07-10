"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, ChevronDown, Mic, ArrowUp, Square, X, CornerDownLeft } from "lucide-react";
import ModelSelectorDropdown from "./ModelSelectorDropdown";
import VariantSubPopup from "./VariantSubPopup";

import { Attachment } from "./MessageAttachmentsRow";
import { Monitor, FileUp } from "lucide-react";
import PDFHoverCard from "./PDFHoverCard";

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
  comments?: Array<{ id: string; fileName: string; line: number; text: string }>;
  onRemoveComment?: (id: string) => void;
  onClickComment?: (fileName: string, line: number) => void;
  contextPercent?: number;
  attachments?: Attachment[];
  uploadingStates?: Record<string, "uploading" | "failed">;
  onUpload?: (file: File) => Promise<void>;
  onRemoveAttachment?: (filename: string) => void;
  onPreviewImage?: (url: string, rect: DOMRect) => void;
  onPreviewDocument?: (file: Attachment) => void;
  editingFile?: string | null;
  onRemoveEditingFile?: () => void;
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
  comments = [],
  onRemoveComment,
  onClickComment,
  contextPercent = 0,
  attachments = [],
  uploadingStates = {},
  onUpload,
  onRemoveAttachment,
  onPreviewImage,
  onPreviewDocument,
  editingFile,
  onRemoveEditingFile,
}: PromptInputProps) {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // Plus button attachment menu states
  const [plusPopupOpen, setPlusPopupOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const plusButtonRef = useRef<HTMLButtonElement | null>(null);
  const plusPopupRef = useRef<HTMLDivElement | null>(null);

  // Hover states for Variant sub-popup
  const [isHoveringVariantRow, setIsHoveringVariantRow] = useState(false);
  const [isHoveringVariantPopup, setIsHoveringVariantPopup] = useState(false);
  const showVariantPopup = modelDropdownOpen && (isHoveringVariantRow || isHoveringVariantPopup);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Click outside listener for plus button popup
  useEffect(() => {
    const handleClickOutsidePlus = (event: MouseEvent) => {
      if (
        plusPopupRef.current && 
        !plusPopupRef.current.contains(event.target as Node) &&
        plusButtonRef.current &&
        !plusButtonRef.current.contains(event.target as Node)
      ) {
        setPlusPopupOpen(false);
      }
    };
    if (plusPopupOpen) {
      document.addEventListener("mousedown", handleClickOutsidePlus);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutsidePlus);
    };
  }, [plusPopupOpen]);

  const handleTakeScreenshot = async () => {
    try {
      setPlusPopupOpen(false);
      
      const CaptureControllerClass = (window as any).CaptureController || (globalThis as any).CaptureController;
      const controller = CaptureControllerClass ? new CaptureControllerClass() : null;

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false,
        ...(controller ? { controller } : {})
      } as any);

      if (controller && "setFocusBehavior" in controller) {
        try {
          controller.setFocusBehavior("no-focus-change");
        } catch (focusErr) {
          console.warn("Failed to set focus behavior:", focusErr);
        }
      }
      
      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = stream;
      
      video.onloadedmetadata = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Stop capturing tracks and return focus
          stream.getTracks().forEach((track) => track.stop());
          setTimeout(() => {
            window.focus();
            textareaRef.current?.focus();
          }, 150);
          
          canvas.toBlob((blob) => {
            if (blob && onUpload) {
              const file = new File([blob], "screenshot.png", { type: "image/png" });
              onUpload(file);
            }
          }, "image/png");
        }
      };
    } catch (err) {
      console.error("Screen capture screenshot failed:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onUpload) {
      setPlusPopupOpen(false);
      for (let i = 0; i < e.target.files.length; i++) {
        onUpload(e.target.files[i]);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    let fileFound = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file && onUpload) {
          fileFound = true;
          onUpload(file);
        }
      }
    }
    if (fileFound) {
      e.preventDefault();
    }
  };

  // --- / Commands Popup States ---
  const commands = ["/compact", "/agents", "/drill"];
  const [selectedIndex, setSelectedIndex] = useState(0);

  const getActiveCommandQuery = (text: string) => {
    if (!text) return null;
    const words = text.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith("/") && lastWord.length > 0) {
      return lastWord;
    }
    return null;
  };

  const query = getActiveCommandQuery(value);
  const filtered = query ? commands.filter((c) => c.startsWith(query)) : [];
  const showPopup = query !== null && filtered.length > 0;

  // Reset selection index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

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
    const overlay = overlayRef.current;
    if (textarea) {
      const savedScrollTop = textarea.scrollTop;
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 220; // Maximum height in pixels before showing scrollbar
      
      if (scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = "auto";
        
        if (overlay) {
          overlay.style.overflowY = "scroll";
          overlay.classList.add("custom-scrollbar-overlay");
          overlay.classList.remove("overflow-y-hidden");
        }

        // Auto-scroll to bottom if typing at the end of the text
        if (textarea.selectionStart === textarea.value.length) {
          textarea.scrollTop = textarea.scrollHeight;
        } else {
          textarea.scrollTop = savedScrollTop;
        }
      } else {
        textarea.style.height = `${scrollHeight}px`;
        textarea.style.overflowY = "hidden";
        
        if (overlay) {
          overlay.style.overflowY = "hidden";
          overlay.classList.remove("custom-scrollbar-overlay");
          overlay.classList.add("overflow-y-hidden");
        }
      }

      // Sync overlay scroll position
      if (overlay) {
        overlay.scrollTop = textarea.scrollTop;
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
    const textarea = e.target;
    let val = textarea.value;
    const originalSelectionStart = textarea.selectionStart;
    
    // Auto-spacing around command keywords:
    const prevLen = val.length;
    val = val.replace(/(?<!\s)(\/(?:agents|drill|compact))/g, " $1");
    val = val.replace(/(\/(?:agents|drill|compact))(?!\s|$)/g, "$1 ");
    const newLen = val.length;

    setValue(val);

    // Adjust caret position based on added spaces to prevent cursor jumps
    if (prevLen !== newLen) {
      const difference = newLen - prevLen;
      const newSelectionStart = originalSelectionStart + difference;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newSelectionStart, newSelectionStart);
        }
      }, 0);
    }
  };

  const handleSelectCommand = (command: string) => {
    const words = value.split(/\s+/);
    // Replace the last word (which was the query) with the selected command
    words[words.length - 1] = command;
    const newValue = words.join(" ") + " ";
    setValue(newValue);
    setTimeout(() => {
      textareaRef.current?.focus();
      adjustHeight();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPopup) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleSelectCommand(filtered[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        const words = value.split(/\s+/);
        if (words[words.length - 1].startsWith("/")) {
          words[words.length - 1] = "";
          setValue(words.join(" ").trim());
        }
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    const cmdList = ["/compact", "/agents", "/drill"];
    const parts = text.split(/(\/(?:compact|agents|drill))\b/g);
    
    return parts.map((part, index) => {
      if (cmdList.includes(part)) {
        return (
          <span
            key={index}
            className="text-blue-400 font-medium"
          >
            {part}
          </span>
        );
      }
      return <span key={index} className="text-zinc-100">{part}</span>;
    });
  };

  const hasText = value.trim().length > 0;

  return (
    <div
      className={`w-full max-w-[720px] bg-[#18181c]/90 border transition-all duration-300 ${
        isFocused ? "border-zinc-700 shadow-lg shadow-black/20" : "border-zinc-800/80"
      } rounded-[28px] p-5 pb-4 flex flex-col backdrop-blur-md relative`}
    >
      {/* / Commands Popup */}
      {showPopup && (
        <div 
          className="absolute bottom-full left-0 right-0 mb-3 bg-[#131316]/98 border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fadeIn"
          style={{
            width: "100%",
          }}
        >
          <div className="px-4 py-2 border-b border-zinc-800/50 flex justify-between items-center select-none bg-[#0e0e11]/50">
            <span className="text-[11px] font-mono text-zinc-550 uppercase tracking-wider">Available Commands</span>
            <span className="text-[10px] text-zinc-600 font-sans">Use arrow keys & enter to select</span>
          </div>
          <div className="flex flex-col max-h-[220px] overflow-y-auto p-1.5 custom-scrollbar">
            {filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd}
                  onClick={() => handleSelectCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[14.5px] cursor-pointer transition-all duration-150 ${
                    isSelected 
                      ? "bg-blue-600/10 border border-blue-500/20 text-white" 
                      : "border border-transparent text-zinc-300 hover:bg-zinc-850/40 hover:text-zinc-100"
                  }`}
                >
                  <span className="font-mono font-medium">{cmd}</span>
                  {isSelected && (
                    <CornerDownLeft className="w-3.5 h-3.5 text-blue-400 stroke-[2.5] animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pinned Comments Context Attachment Pills inside Prompt Box */}
      {(comments.length > 0 || editingFile) && (
        <div className="flex flex-wrap gap-2 mb-3.5 animate-fadeIn">
          {editingFile && (
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600/10 border border-blue-500/20 transition-all duration-200 cursor-default select-none"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-[12.5px] text-blue-300 font-sans font-medium">
                Editing: {editingFile}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRemoveEditingFile) {
                    onRemoveEditingFile();
                  }
                }}
                className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-200 transition-colors cursor-pointer"
                title="Remove file context"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
          {comments.map((comment) => (
            <div 
              key={comment.id}
              onClick={() => {
                if (onClickComment) {
                  onClickComment(comment.fileName, comment.line);
                }
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#202024] border border-zinc-800 hover:border-zinc-700 transition-all duration-200 cursor-pointer select-none max-w-[280px]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              <span className="text-[12.5px] text-zinc-300 font-sans truncate font-medium">
                {comment.fileName}:{comment.line} - {comment.text}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRemoveComment) {
                    onRemoveComment(comment.id);
                  }
                }}
                className="flex items-center justify-center w-4 h-4 rounded-full bg-zinc-900/60 hover:bg-zinc-800 text-zinc-450 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-row flex-nowrap overflow-x-auto overflow-y-hidden w-full max-w-full pb-2 pt-1.5 px-0.5 custom-horizontal-scrollbar gap-3 mb-2 animate-fadeIn select-none">
          {attachments.map((file) => {
            const isUploading = uploadingStates[file.filename] === "uploading";
            const isFailed = uploadingStates[file.filename] === "failed";
            const isImage = file.type.startsWith("image/");
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://shinayush-voxkage-web-backend.hf.space";
            const fileUrl = file.url.startsWith("http") ? file.url : `${backendUrl}${file.url}`;

            if (isUploading) {
              return (
                <div key={file.filename} className="flex items-center justify-center rounded-xl bg-zinc-900/40 border border-zinc-850/60 w-[90px] h-[60px] animate-pulse flex-shrink-0">
                  <div className="w-5 h-5 rounded bg-zinc-800" />
                </div>
              );
            }

            if (isFailed) {
              return (
                <div key={file.filename} className="relative group/failed w-[90px] h-[60px] flex-shrink-0 select-none">
                  <div className="w-full h-full flex flex-col items-center justify-center rounded-xl bg-red-950/10 border border-red-900/30">
                    <span className="text-[10px] font-mono font-bold text-red-400">ERR</span>
                    <span className="text-[8.5px] text-zinc-550 truncate mt-0.5 w-full text-center px-1">
                      Failed
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveAttachment?.(file.filename);
                    }}
                    className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/failed:opacity-100 flex items-center justify-center w-5 h-5 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer shadow-md z-20"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            }

            if (isImage) {
              return (
                <ImageAttachmentPreviewItem 
                  key={file.filename}
                  src={fileUrl}
                  filename={file.filename}
                  onRemove={onRemoveAttachment}
                  onPreview={onPreviewImage}
                />
              );
            }

            return (
              <DocumentAttachmentPreviewItem
                key={file.filename}
                file={file}
                onRemove={onRemoveAttachment}
                onClick={onPreviewDocument}
              />
            );
          })}
        </div>
      )}

      {/* Input Field */}
      <div className="relative w-full min-h-[28px]">
        {/* Background highlight overlay */}
        <div
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none select-none text-transparent whitespace-pre-wrap break-words font-sans text-[17px] leading-relaxed p-0 overflow-y-hidden prompt-overlay"
          style={{
            minHeight: "28px",
          }}
        >
          {renderHighlightedText(value)}
        </div>

        {/* Front textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onPaste={handlePaste}
          rows={1}
          className={`w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 ${
            value ? "text-transparent" : "text-zinc-100"
          } caret-zinc-200 placeholder-zinc-500 font-sans text-[17px] leading-relaxed resize-none p-0 custom-scrollbar relative z-10 prompt-textarea`}
          placeholder={value ? "" : "Ask VoxKage, type / for commands"}
          style={{
            minHeight: "28px",
          }}
        />
      </div>

      {/* Bottom Actions Bar */}
      <div className="flex items-center justify-between mt-4 pt-1 w-full border-t border-transparent">
        {/* Left Side: Plus Button */}
        <div className="relative">
          <button
            ref={plusButtonRef}
            type="button"
            onClick={() => setPlusPopupOpen(!plusPopupOpen)}
            className="flex items-center justify-center w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all duration-200 active:scale-95 cursor-pointer"
            aria-label="Add attachment"
          >
            <Plus className={`w-[22px] h-[22px] stroke-[2.2] transition-transform duration-200 ${plusPopupOpen ? "rotate-45" : ""}`} />
          </button>

          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            multiple 
            style={{ display: "none" }} 
          />

          {/* Hovering Popup Menu */}
          {plusPopupOpen && (
            <div 
              ref={plusPopupRef}
              className="absolute bottom-11 left-0 bg-[#121215]/98 border border-zinc-800 rounded-2xl shadow-2xl p-1.5 z-40 w-[200px] flex flex-col animate-fadeIn select-none backdrop-blur-md"
            >
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] text-zinc-300 hover:bg-[#1d1d21]/60 hover:text-zinc-100 transition-colors text-left cursor-pointer"
              >
                <FileUp className="w-4 h-4 text-zinc-400" />
                <span>Add files or Images</span>
              </button>
              
              <button
                type="button"
                onClick={handleTakeScreenshot}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] text-zinc-300 hover:bg-[#1d1d21]/60 hover:text-zinc-100 transition-colors text-left cursor-pointer"
              >
                <Monitor className="w-4 h-4 text-zinc-400" />
                <span>Take a Screenshot</span>
              </button>
            </div>
          )}
        </div>

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

          {/* Context Window HUD indicator */}
          <div className="relative group/hud flex items-center">
            <div 
              className={`flex items-center justify-center px-2 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-[12.5px] font-mono select-none cursor-help transition-all duration-200 ${
                contextPercent >= 85 
                  ? "text-red-500 border-red-900/40 bg-red-950/10 font-bold" 
                  : "text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              <span>{contextPercent}%</span>
            </div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover/hud:opacity-100 transition-opacity duration-150 bg-[#121214] border border-zinc-850 text-zinc-350 text-[11px] font-sans px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap z-50">
              Context window. Run <span className="font-mono text-blue-400">/compact</span> to compact the context window.
            </div>
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
        .custom-horizontal-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .custom-horizontal-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-horizontal-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 99px;
        }
        .custom-horizontal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.16);
        }
        .custom-scrollbar-overlay::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar-overlay::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar-overlay::-webkit-scrollbar-thumb {
          background: transparent;
        }
        textarea::selection {
          background: rgba(37, 99, 235, 0.4);
          color: transparent;
        }
        textarea::-moz-selection {
          background: rgba(37, 99, 235, 0.4);
          color: transparent;
        }
        .prompt-textarea, .prompt-overlay {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          font-size: 17px !important;
          line-height: 27.625px !important;
          padding: 0px !important;
          margin: 0px !important;
          border: 0px !important;
          letter-spacing: normal !important;
          word-break: break-word !important;
          white-space: pre-wrap !important;
          overflow-wrap: break-word !important;
          box-sizing: border-box !important;
        }
        .prompt-overlay {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}

function DocumentAttachmentPreviewItem({
  file,
  onRemove,
  onClick
}: {
  file: Attachment;
  onRemove?: (filename: string) => void;
  onClick?: (file: Attachment) => void;
}) {
  const isPDF = file.type === "application/pdf";
  const ext = file.original_name.split(".").pop()?.toUpperCase() || "FILE";
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://shinayush-voxkage-web-backend.hf.space";
  const fileUrl = file.url.startsWith("http") ? file.url : `${backendUrl}${file.url}`;

  return (
    <div className="relative group/doc w-[90px] h-[60px] flex-shrink-0 select-none">
      <div 
        className="w-full h-full rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950/40 cursor-pointer relative"
        onClick={() => onClick?.(file)}
      >
        {isPDF ? (
          <div className="w-full h-full relative overflow-hidden bg-zinc-950">
            <iframe 
              src={`${fileUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0`} 
              className="w-full h-full pointer-events-none select-none opacity-80 scale-[1.3] origin-center"
              title="PDF Thumbnail"
              scrolling="no"
            />
            <div className="absolute inset-0 z-10 bg-transparent" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900/60">
            <span className="text-[14px] font-bold text-zinc-550 font-mono tracking-wider">
              .{ext.toLowerCase()}
            </span>
          </div>
        )}

        {/* Pill Badge */}
        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-zinc-950/80 border border-zinc-850/70 text-[9.5px] font-mono font-bold text-zinc-350 pointer-events-none">
          {ext}
        </div>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove?.(file.filename);
        }}
        className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/doc:opacity-100 flex items-center justify-center w-5 h-5 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer shadow-md z-20"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

function ImageAttachmentPreviewItem({ 
  src, 
  filename, 
  onRemove, 
  onPreview 
}: { 
  src: string; 
  filename: string; 
  onRemove?: (filename: string) => void; 
  onPreview?: (url: string, rect: DOMRect) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (imgRef.current && onPreview) {
      const rect = imgRef.current.getBoundingClientRect();
      onPreview(src, rect);
    }
  };

  return (
    <div className="relative group/img w-[90px] h-[60px] flex-shrink-0 select-none">
      <div className="w-full h-full rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950/40">
        <img
          ref={imgRef}
          src={src}
          alt="Attachment Thumbnail"
          className="w-full h-full object-cover cursor-zoom-in transition-all duration-300 hover:scale-105 group-hover/img:brightness-90"
          onClick={handleClick}
        />
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove?.(filename);
        }}
        className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/img:opacity-100 flex items-center justify-center w-5 h-5 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer shadow-md z-20"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}
