"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, ChevronDown, ArrowUp, Square, X, CornerDownLeft, Zap, Compass } from "lucide-react";
import ModelSelectorDropdown from "./ModelSelectorDropdown";
import VariantSubPopup from "./VariantSubPopup";

import { getToken, BACKEND_URL } from "@/lib/api";
import { Attachment } from "./MessageAttachmentsRow";
import { Monitor, FileUp, Clock, Camera } from "lucide-react";
import PDFHoverCard from "./PDFHoverCard";
import PlanModeHeader from "./PlanModeHeader";
import TaskListWidget, { TaskItem } from "./TaskListWidget";

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
  isSession?: boolean;
  hideBoxStyling?: boolean;
  buildMode?: "Work" | "Plan";
  setBuildMode?: (mode: "Work" | "Plan") => void;
  tasks?: TaskItem[];
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
  isSession = false,
  hideBoxStyling = false,
  buildMode: buildModeProp = "Work",
  setBuildMode: setBuildModeProp,
  tasks = [],
}: PromptInputProps) {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  // Fallback local mode state if parent didn't pass state
  const [localBuildMode, setLocalBuildMode] = useState<"Work" | "Plan">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("voxkage_build_mode");
      if (saved === "Plan" || saved === "Work") return saved;
    }
    return "Work";
  });
  const buildMode = setBuildModeProp ? buildModeProp : localBuildMode;
  const setBuildMode = setBuildModeProp || setLocalBuildMode;

  // Theme detection mutation observer
  useEffect(() => {
    const checkTheme = () => {
      const isL = document.documentElement.classList.contains("light");
      setIsLightMode(isL);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
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

  // Work / Plan mode dropdown state
  const [buildDropdownOpen, setBuildDropdownOpen] = useState(false);
  const buildDropdownRef = useRef<HTMLDivElement | null>(null);

  // Context window HUD popup state
  const [contextHudOpen, setContextHudOpen] = useState(false);
  const contextHudRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutsideHud = (event: MouseEvent) => {
      if (contextHudRef.current && !contextHudRef.current.contains(event.target as Node)) {
        setContextHudOpen(false);
      }
    };
    if (contextHudOpen) {
      document.addEventListener("mousedown", handleClickOutsideHud);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideHud);
    };
  }, [contextHudOpen]);

  useEffect(() => {
    const handleClickOutsideBuild = (event: MouseEvent) => {
      if (buildDropdownRef.current && !buildDropdownRef.current.contains(event.target as Node)) {
        setBuildDropdownOpen(false);
      }
    };
    if (buildDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutsideBuild);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideBuild);
    };
  }, [buildDropdownOpen]);

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

      // Detect mobile/touch — use camera instead of screen capture
      const isMobile = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

      if (isMobile) {
        // Mobile: open camera via <input type="file" capture>
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.capture = "environment"; // rear camera by default
        input.onchange = () => {
          const file = input.files?.[0];
          if (file && onUpload) {
            onUpload(file);
          }
        };
        input.click();
        return;
      }

      // Desktop: screen capture flow
      const CaptureControllerClass = (window as any).CaptureController || (globalThis as any).CaptureController;
      const controller = CaptureControllerClass ? new CaptureControllerClass() : null;

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false,
        ...(controller ? { controller } : {}),
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
  const commands = ["/agents", "/drill", "/schedule"];
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
    if (typeof window !== "undefined") {
      localStorage.setItem("voxkage_selected_model", modelName);
    }
    try {
      const token = localStorage.getItem("voxkage_jwt_token");
      const apiBase = BACKEND_URL;
      if (token) {
        fetch(`${apiBase}/user/settings-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ selected_model: modelName })
        }).catch((err) => console.error("Failed to sync model choice:", err));
      }
    } catch (err) {
      console.warn("Model sync error:", err);
    }
  };

  const handleSelectVariant = (variantName: string) => {
    setSelectedVariant(variantName);
    setIsHoveringVariantRow(false);
    setIsHoveringVariantPopup(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("voxkage_selected_variant", variantName);
    }
    try {
      const token = localStorage.getItem("voxkage_jwt_token");
      const apiBase = BACKEND_URL;
      if (token) {
        fetch(`${apiBase}/user/settings-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ selected_variant: variantName })
        }).catch((err) => console.error("Failed to sync variant choice:", err));
      }
    } catch (err) {
      console.warn("Variant sync error:", err);
    }
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

  // Auto-resize height based on value without synchronous layout thrashing
  const resizeRafRef = useRef<number | null>(null);
  const adjustHeight = () => {
    if (resizeRafRef.current) {
      cancelAnimationFrame(resizeRafRef.current);
    }
    resizeRafRef.current = requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      const overlay = overlayRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = 220; // Maximum height in pixels before showing scrollbar
        const newHeight = scrollHeight > maxHeight ? maxHeight : Math.max(28, scrollHeight);
        
        textarea.style.height = `${newHeight}px`;
        textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";

        if (overlay && window.innerWidth >= 768) {
          overlay.style.height = `${newHeight}px`;
          overlay.style.overflowY = textarea.style.overflowY;
          overlay.scrollTop = textarea.scrollTop;
          overlay.scrollLeft = textarea.scrollLeft;
        }
      }
    });
  };

  // Adjust height on text change
  useEffect(() => {
    adjustHeight();
    return () => {
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
    };
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
      let finalValue = value;
      if (buildMode === "Plan" && !finalValue.startsWith("/plan") && !finalValue.startsWith("[PLAN MODE]")) {
        finalValue = `[PLAN MODE] ${finalValue}`;
      }
      if (onSubmit) {
        onSubmit(finalValue);
      }
      setValue("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };

  const handleSelectCommand = (command: string) => {
    const words = value.split(/\s+/);
    // Replace the last word (which was the query) with the selected command
    words[words.length - 1] = command;
    const newValue = words.join(" ") + " ";
    setValue(newValue);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const len = newValue.length;
        textareaRef.current.setSelectionRange(len, len);
      }
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
      const isMobile = typeof window !== "undefined" && (window.innerWidth < 768 || "ontouchstart" in window || navigator.maxTouchPoints > 0);
      if (isMobile) {
        // On mobile devices, Enter key inserts a newline (\n); submission requires tapping Send button.
        return;
      }
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    const cmdList = ["/agents", "/drill", "/schedule"];
    const parts = text.split(/(\/(?:agents|drill|schedule))\b/g);
    
    const rendered = parts.map((part, index) => {
      if (cmdList.includes(part)) {
        return (
          <span
            key={index}
            className="text-blue-400 font-normal"
          >
            {part}
          </span>
        );
      }
      return <span key={index} className="text-zinc-100 font-normal">{part}</span>;
    });

    if (text.endsWith("\n")) {
      rendered.push(<span key="trailing-newline">\u200b</span>);
    }

    return rendered;
  };

  const hasText = value.trim().length > 0;

  return (
    <PlanModeHeader isPlanMode={buildMode === "Plan"} isLightMode={isLightMode}>
      <TaskListWidget tasks={tasks} isLightMode={isLightMode} />
      <div className={`w-full p-5 pb-4 flex flex-col relative transition-all duration-500 ease-out ${
        hideBoxStyling
          ? "bg-transparent border-t border-white/10"
          : "rounded-[28px] fluid-glass-box-frosty"
      }`}>
      {/* / Commands Popup */}
      {showPopup && (
        <div 
          className="absolute bottom-full left-0 right-0 mb-3 fluid-glass-popup rounded-2xl overflow-hidden z-50 animate-fadeIn"
          style={{
            width: "100%",
          }}
        >
          <div className="px-4 py-2 border-b border-white/10 flex justify-between items-center select-none bg-white/[0.03]">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Available Commands</span>
            <span className="text-[10px] text-zinc-500 font-sans">Use arrow keys & enter to select</span>
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
                      ? "bg-white/10 border border-white/20 text-white shadow-sm" 
                      : "border border-transparent text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl fluid-glass-pill text-blue-300 border-blue-400/30 transition-all duration-200 cursor-default select-none"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[12.5px] font-sans font-medium">
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
                className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 hover:text-white transition-colors cursor-pointer"
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
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl fluid-glass-pill transition-all duration-200 cursor-pointer select-none max-w-[280px]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
              <span className="text-[12.5px] text-zinc-200 font-sans truncate font-medium">
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
                className="flex items-center justify-center w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white transition-colors cursor-pointer"
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
                <div key={file.filename} className="flex items-center justify-center rounded-xl fluid-glass-pill w-[90px] h-[60px] animate-pulse flex-shrink-0">
                  <div className="w-5 h-5 rounded bg-white/10" />
                </div>
              );
            }

            if (isFailed) {
              return (
                <div key={file.filename} className="relative group/failed w-[90px] h-[60px] flex-shrink-0 select-none">
                  <div className="w-full h-full flex flex-col items-center justify-center rounded-xl bg-red-950/20 border border-red-500/30">
                    <span className="text-[10px] font-mono font-bold text-red-400">ERR</span>
                    <span className="text-[8.5px] text-zinc-400 truncate mt-0.5 w-full text-center px-1">
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
                    className="absolute -top-1.5 -right-1.5 opacity-100 md:opacity-0 md:group-hover/failed:opacity-100 flex items-center justify-center w-5 h-5 rounded-full bg-zinc-950 border border-white/20 text-zinc-400 hover:text-white transition-all duration-200 cursor-pointer shadow-md z-20"
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
        {/* Background highlight overlay (desktop only to prevent mobile IME typing lag) */}
        <div
          ref={overlayRef}
          className="hidden md:block absolute inset-0 pointer-events-none select-none text-transparent whitespace-pre-wrap break-words font-sans text-[17px] leading-[1.55] p-0 m-0 border-0 prompt-overlay prompt-overlay-invisible-scrollbar"
          style={{
            minHeight: "28px",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            letterSpacing: "normal",
            boxSizing: "border-box",
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
          inputMode="text"
          autoCapitalize="sentences"
          autoComplete="off"
          autoCorrect="on"
          spellCheck="true"
          rows={1}
          className={`w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 ${
            value 
              ? "text-zinc-100 [.light_&]:text-[#141413] md:text-transparent" 
              : "text-zinc-100 [.light_&]:text-[#141413]"
          } caret-blue-400 [.light_&]:caret-[#141413] placeholder-zinc-400/60 [.light_&]:placeholder-[#8e8b82] font-sans text-[16px] md:text-[17px] leading-[1.55] resize-none p-0 m-0 border-0 custom-scrollbar relative z-10 prompt-textarea`}
          placeholder={value ? "" : "Ask VoxKage, type / for commands"}
          style={{
            minHeight: "28px",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            letterSpacing: "normal",
            boxSizing: "border-box",
            touchAction: "manipulation",
          }}
        />

        <style jsx>{`
          .prompt-overlay-invisible-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .prompt-overlay-invisible-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .prompt-overlay-invisible-scrollbar::-webkit-scrollbar-thumb {
            background: transparent;
            border: none;
          }
          .prompt-overlay-invisible-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: transparent transparent;
          }
        `}</style>
      </div>

      {/* Bottom Actions Bar */}
      <div className="flex items-center justify-between mt-4 pt-1 w-full border-t border-transparent">
        {/* Left Side: Plus Button */}
        <div className="relative">
          <button
            ref={plusButtonRef}
            type="button"
            onClick={() => setPlusPopupOpen(!plusPopupOpen)}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 active:scale-95 cursor-pointer ${
              isLightMode 
                ? "prompt-btn-dark-gray" 
                : "fluid-glass-pill text-zinc-300 hover:text-white"
            }`}
            aria-label="Add attachment"
          >
            <Plus className={`w-[20px] h-[20px] stroke-[2.2] transition-transform duration-200 ${plusPopupOpen ? "rotate-45" : ""}`} />
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
              className="absolute bottom-11 left-0 fluid-glass-popup rounded-2xl p-1.5 z-40 w-[210px] flex flex-col animate-fadeIn select-none"
            >
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] text-zinc-200 hover:bg-white/10 hover:text-white transition-colors text-left cursor-pointer"
              >
                <FileUp className="w-4 h-4 text-zinc-300" />
                <span>Add files or Images</span>
              </button>
              
              <button
                type="button"
                onClick={handleTakeScreenshot}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] text-zinc-200 hover:bg-white/10 hover:text-white transition-colors text-left cursor-pointer"
              >
                {/* Show Camera on mobile, Monitor on desktop */}
                <Camera className="w-4 h-4 text-zinc-300 md:hidden" />
                <Monitor className="w-4 h-4 text-zinc-300 hidden md:block" />
                <span className="md:hidden">Take a Photo</span>
                <span className="hidden md:inline">Take a Screenshot</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setPlusPopupOpen(false);
                  window.dispatchEvent(new CustomEvent("open-schedules-modal"));
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] text-zinc-200 hover:bg-white/10 hover:text-white transition-colors text-left cursor-pointer"
              >
                <Clock className="w-4 h-4 text-zinc-300" />
                <span>Check Schedules</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Options and Submit */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {/* Model Selector Dropdown & Button Wrapper */}
          <div ref={dropdownRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all duration-200 text-[12.5px] sm:text-[13.5px] font-medium select-none cursor-pointer max-w-[130px] sm:max-w-none ${
                isLightMode
                  ? "prompt-btn-dark-gray"
                  : "fluid-glass-pill text-zinc-300 hover:text-white"
              }`}
            >
              <span className="truncate max-w-[75px] sm:max-w-none">{selectedModel}</span>
              <span className="text-zinc-400 font-normal text-[11.5px] sm:text-[12.5px] ml-0.5 hidden xs:inline sm:inline">{selectedVariant}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70 ml-0.5 flex-shrink-0" />
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
          <div ref={contextHudRef} className="relative flex items-center flex-shrink-0">
            <button 
              type="button"
              onClick={() => setContextHudOpen((prev) => !prev)}
              className={`flex items-center justify-center px-2 sm:px-2.5 py-1 rounded-lg text-[11.5px] sm:text-[12.5px] font-mono select-none cursor-pointer transition-all duration-200 ${
                contextPercent >= 85 
                  ? "text-red-400 border-red-500/40 bg-red-950/30 font-bold" 
                  : isLightMode
                  ? "prompt-btn-dark-gray"
                  : "fluid-glass-pill text-zinc-300 hover:text-white"
              }`}
            >
              <span>{contextPercent}%</span>
            </button>
            
            {/* Click/Tap Toggleable Popup */}
            {contextHudOpen && (
              <div className="absolute bottom-full mb-2 right-0 w-[230px] fluid-glass-popup text-zinc-200 text-[11.5px] font-sans p-3 rounded-2xl shadow-2xl z-50 select-none flex flex-col gap-2.5 animate-fadeIn border border-white/10">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[12px] font-medium text-white font-sans">Context Window</span>
                  <span className="text-[11px] text-zinc-400 leading-snug">
                    {contextPercent}% used. Compact context to summarize history and free up space.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setContextHudOpen(false);
                    onSubmit?.("/compact");
                  }}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-medium transition-all duration-200 active:scale-95 cursor-pointer shadow-md shadow-blue-500/20"
                >
                  <Square className="w-3 h-3 fill-current rotate-45" />
                  <span>Compact Context</span>
                </button>
              </div>
            )}
          </div>
          {/* Work / Plan Mode Dropdown */}
          <div ref={buildDropdownRef} className="relative animate-fadeIn flex-shrink-0 z-[60]">
            <button
              type="button"
              onClick={() => setBuildDropdownOpen(!buildDropdownOpen)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all duration-200 text-[12.5px] sm:text-[13.5px] font-sans font-medium select-none cursor-pointer ${
                isLightMode
                  ? "prompt-btn-dark-gray"
                  : "fluid-glass-pill text-zinc-300 hover:text-white"
              }`}
            >
              <span>{buildMode}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70 ml-0.5 flex-shrink-0" />
            </button>

            {buildDropdownOpen && (
              <div className="absolute bottom-full mb-2.5 right-0 min-w-[240px] sm:w-[270px] fluid-glass-popup rounded-2xl p-2.5 z-[9999] flex flex-col gap-1.5 shadow-2xl animate-fadeIn select-none pointer-events-auto border border-white/10">
                <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-400 uppercase tracking-wider pointer-events-none">
                  <span>Execution Mode</span>
                </div>

                {/* Option 1: Work Mode */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBuildMode("Work");
                    setBuildDropdownOpen(false);
                  }}
                  className={`w-full flex flex-col items-start p-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer select-none border border-transparent ${
                    buildMode === "Work"
                      ? "bg-white/10 border border-white/15 text-white font-medium shadow-sm"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="w-full flex items-center justify-between pointer-events-none">
                    <span className="text-[13px] font-sans font-semibold text-white pointer-events-none">Work</span>
                    {buildMode === "Work" && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 pointer-events-none" />}
                  </div>
                  <span className="text-[11px] font-sans text-zinc-400 font-normal leading-snug mt-1 pointer-events-none">
                    VoxKage will directly start working on the tasks.
                  </span>
                </button>

                {/* Option 2: Plan Mode */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBuildMode("Plan");
                    setBuildDropdownOpen(false);
                  }}
                  className={`w-full flex flex-col items-start p-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer select-none border border-transparent ${
                    buildMode === "Plan"
                      ? "bg-white/10 border border-white/15 text-white font-medium shadow-sm"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="w-full flex items-center justify-between pointer-events-none">
                    <span className="text-[13px] font-sans font-semibold text-white pointer-events-none">Plan</span>
                    {buildMode === "Plan" && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 pointer-events-none" />}
                  </div>
                  <span className="text-[11px] font-sans text-zinc-400 font-normal leading-snug mt-1 pointer-events-none">
                    VoxKage will create a plan before working.
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Submit / Stop Button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#18181b] [.light_&]:bg-[#3D3D3A] hover:bg-zinc-800 [.light_&]:hover:bg-[#252523] border border-zinc-700/60 [.light_&]:border-[#3D3D3A] text-white active:scale-95 cursor-pointer ml-0.5 sm:ml-1 transition-all duration-200 flex-shrink-0 shadow-md"
              aria-label="Stop generation"
              title="Stop generation"
            >
              <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white [.light_&]:fill-[#faf9f5] stroke-none" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full transition-all duration-300 ml-0.5 sm:ml-1 flex-shrink-0 ${
                hasText
                  ? "bg-[#3A91EE] border border-[#3A91EE] hover:bg-[#3282d8] hover:border-[#3282d8] text-white shadow-md shadow-[#3A91EE]/20 active:scale-95 cursor-pointer"
                  : "bg-white/[0.04] [.light_&]:bg-[#e6dfd8] border border-white/[0.08] [.light_&]:border-[#d9d2c9] text-white/30 [.light_&]:text-[#8e8b82] cursor-default"
              }`}
              aria-label="Submit prompt"
            >
              <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
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
    </PlanModeHeader>
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
        className="absolute -top-1.5 -right-1.5 opacity-100 md:opacity-0 md:group-hover/doc:opacity-100 flex items-center justify-center w-5 h-5 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer shadow-md z-20"
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
        className="absolute -top-1.5 -right-1.5 opacity-100 md:opacity-0 md:group-hover/img:opacity-100 flex items-center justify-center w-5 h-5 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer shadow-md z-20"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}
