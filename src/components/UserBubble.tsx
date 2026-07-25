import React, { useEffect, useState, useRef } from "react";
import MessageAttachmentsRow, { parseMessageAttachments, Attachment } from "./MessageAttachmentsRow";
import { Copy, Edit3, Check } from "lucide-react";

const USER_BUBBLE_MAX_H = 180;

interface UserBubbleProps {
  messageId: string;
  content: string;
  onImageClick: (url: string, rect: DOMRect) => void;
  onDocumentClick?: (file: Attachment) => void;
  onEditSave?: (messageId: string, newText: string) => Promise<void>;
}

export default function UserBubble({ messageId, content, onImageClick, onDocumentClick, onEditSave }: UserBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [copied, setCopied] = useState(false);
  const innerRef = useRef<HTMLDivElement | null>(null);

  const { text, attachments } = parseMessageAttachments(content);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.maxHeight = "none";
    const natural = el.scrollHeight;
    el.style.maxHeight = "";
    setNeedsClamp(natural > USER_BUBBLE_MAX_H);
  }, [text]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy user message:", err);
    }
  };

  const handleSave = async () => {
    if (!editText.trim()) return;
    if (onEditSave) {
      await onEditSave(messageId, editText);
    }
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setEditText(text);
    setIsEditing(true);
  };

  const formatTime = () => {
    try {
      const parts = messageId.split("-");
      if (parts.length > 1) {
        const timestamp = parseInt(parts[1], 10);
        if (!isNaN(timestamp)) {
          const date = new Date(timestamp);
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }
    } catch {}
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-[85%] flex flex-col items-end text-zinc-300 w-full">
      {attachments.length > 0 && (
        <MessageAttachmentsRow 
          attachments={attachments} 
          onImageClick={onImageClick} 
          onDocumentClick={onDocumentClick}
        />
      )}
      
      {isEditing ? (
        <div className="w-full bg-[#1c1c20] border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 mt-2 select-text">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 rounded-xl p-3 text-zinc-100 text-[14.5px] leading-relaxed font-sans focus:outline-none min-h-[80px] resize-y"
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-1.5 text-zinc-400 text-[12.5px] leading-relaxed max-w-[75%] select-none">
              <span className="text-zinc-400 font-medium">ⓘ</span>
              <span>
                Editing this message will create a new conversation branch.
              </span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0 select-none">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl bg-[#28282c] hover:bg-[#343438] text-white text-[13px] font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-[#d9d9d9] hover:bg-white text-black text-[13px] font-medium transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            className="bg-[#202024] text-zinc-100 rounded-2xl px-4 pt-3 text-[15px] leading-relaxed font-sans border border-zinc-800/40 select-text w-fit max-w-full ml-auto"
            style={{ paddingBottom: needsClamp ? 0 : "10px" }}
          >
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                maxHeight: needsClamp && !expanded ? `${USER_BUBBLE_MAX_H}px` : undefined,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                whiteSpace: "pre-wrap",
              }}
            >
              <div ref={innerRef}>{text}</div>
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

          {/* Action row containing Timestamp, Edit and Copy */}
          <div className="flex items-center gap-3.5 mt-1.5 pr-2.5 text-zinc-500 text-[12.5px] font-sans select-none">
            <span>{formatTime()}</span>
            <button
              onClick={handleStartEdit}
              className="hover:text-zinc-200 transition-colors cursor-pointer"
              title="Edit message"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCopy}
              className="hover:text-zinc-200 transition-colors cursor-pointer"
              title="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
