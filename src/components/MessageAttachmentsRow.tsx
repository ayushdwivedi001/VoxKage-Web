import React, { useRef } from "react";
import PDFHoverCard from "./PDFHoverCard";

export interface Attachment {
  filename: string;
  original_name: string;
  url: string;
  type: string;
  size: number;
  num_pages?: number;
}

export function parseMessageAttachments(content: string): { text: string; attachments: Attachment[] } {
  if (!content) return { text: "", attachments: [] };
  
  const attachments: Attachment[] = [];
  const attachmentsBlockRegex = /<attachments>([\s\S]*?)<\/attachments>/;
  const match = content.match(attachmentsBlockRegex);
  
  let cleanedText = content;
  if (match) {
    cleanedText = content.replace(attachmentsBlockRegex, "").trim();
    const attachmentsContent = match[1];
    
    const attachmentTagRegex = /<attachment\s+filename="([^"]*)"\s+original_name="([^"]*)"\s+url="([^"]*)"\s+type="([^"]*)"\s+size="([^"]*)"\s*(?:num_pages="([^"]*)")?\s*\/>/g;
    
    let tagMatch;
    while ((tagMatch = attachmentTagRegex.exec(attachmentsContent)) !== null) {
      attachments.push({
        filename: tagMatch[1],
        original_name: tagMatch[2],
        url: tagMatch[3],
        type: tagMatch[4],
        size: parseInt(tagMatch[5] || "0", 10),
        num_pages: tagMatch[6] ? parseInt(tagMatch[6], 10) : undefined
      });
    }
  }
  
  return { text: cleanedText, attachments };
}

interface MessageAttachmentsRowProps {
  attachments: Attachment[];
  onImageClick: (url: string, rect: DOMRect) => void;
  onDocumentClick?: (file: Attachment) => void;
}

export default function MessageAttachmentsRow({ 
  attachments, 
  onImageClick, 
  onDocumentClick 
}: MessageAttachmentsRowProps) {
  if (!attachments || attachments.length === 0) return null;

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://shinayush-voxkage-web-backend.hf.space";
  const getFileUrl = (url: string) => url.startsWith("http") ? url : `${backendUrl}${url}`;

  return (
    <div className="flex flex-wrap gap-3 mb-3 w-full justify-end">
      {attachments.map((file, idx) => {
        const isImage = file.type.startsWith("image/");
        const fileUrl = getFileUrl(file.url);

        if (isImage) {
          return (
            <ImageAttachmentItem 
              key={idx}
              src={fileUrl}
              name={file.original_name}
              onClick={onImageClick}
            />
          );
        }

        return (
          <ChatDocumentAttachmentItem 
            key={idx}
            file={file}
            onClick={onDocumentClick}
          />
        );
      })}
    </div>
  );
}

function ImageAttachmentItem({ 
  src, 
  name, 
  onClick 
}: { 
  src: string; 
  name: string; 
  onClick: (url: string, rect: DOMRect) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      onClick(src, rect);
    }
  };

  return (
    <div className="relative group rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950/40 w-[90px] h-[60px] flex-shrink-0">
      <img
        ref={imgRef}
        src={src}
        alt={name}
        className="w-full h-full object-cover cursor-zoom-in transition-all duration-300 hover:scale-105 group-hover:brightness-90"
        onClick={handleClick}
      />
    </div>
  );
}

function ChatDocumentAttachmentItem({
  file,
  onClick
}: {
  file: Attachment;
  onClick?: (file: Attachment) => void;
}) {
  const isPDF = file.type === "application/pdf";
  const ext = file.original_name.split(".").pop()?.toUpperCase() || "FILE";
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://shinayush-voxkage-web-backend.hf.space";
  const fileUrl = file.url.startsWith("http") ? file.url : `${backendUrl}${file.url}`;

  return (
    <div 
      className="relative group rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950/40 w-[90px] h-[60px] flex-shrink-0 select-none cursor-pointer"
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
  );
}
