import React, { useEffect, useState, useRef } from "react";
import MessageAttachmentsRow, { parseMessageAttachments, Attachment } from "./MessageAttachmentsRow";

const USER_BUBBLE_MAX_H = 180;

interface UserBubbleProps {
  content: string;
  onImageClick: (url: string, rect: DOMRect) => void;
  onDocumentClick?: (file: Attachment) => void;
}

export default function UserBubble({ content, onImageClick, onDocumentClick }: UserBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);
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

  return (
    <div className="max-w-[85%] flex flex-col items-end text-zinc-300 w-full">
      {attachments.length > 0 && (
        <MessageAttachmentsRow 
          attachments={attachments} 
          onImageClick={onImageClick} 
          onDocumentClick={onDocumentClick}
        />
      )}
      
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
    </div>
  );
}
