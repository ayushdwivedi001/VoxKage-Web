import React, { useState } from "react";
import { Download } from "lucide-react";

interface PDFHoverCardProps {
  file: {
    filename: string;
    original_name: string;
    url: string;
    type: string;
    size: number;
    num_pages?: number;
  };
  children: React.ReactNode;
}

export default function PDFHoverCard({ file, children }: PDFHoverCardProps) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [hoveredPreview, setHoveredPreview] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://shinayush-voxkage-web-backend.hf.space";
  const fileUrl = file.url.startsWith("http") 
    ? file.url 
    : `${backendUrl}${file.url}`;

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsTooltipOpen(true)}
      onMouseLeave={() => {
        setIsTooltipOpen(false);
        setHoveredPreview(false);
      }}
    >
      {children}

      {isTooltipOpen && (
        <div 
          className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#131316]/98 border border-zinc-800/80 rounded-2xl shadow-2xl p-4 w-[250px] z-50 animate-fadeIn backdrop-blur-md select-none"
          onMouseEnter={() => setHoveredPreview(true)}
          onMouseLeave={() => setHoveredPreview(false)}
        >
          {/* Top: PDF File name */}
          <div className="text-[13px] font-medium text-zinc-200 truncate mb-2.5">
            {file.original_name}
          </div>

          {/* Middle: PDF Page Preview */}
          <div className="relative h-[160px] bg-zinc-950/60 border border-zinc-800/60 rounded-xl overflow-hidden flex items-center justify-center mb-3">
            <iframe 
              src={`${fileUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0`} 
              className="w-full h-full border-none pointer-events-none select-none overflow-hidden"
              title="PDF First Page Preview"
              scrolling="no"
            />
            {/* Overlay to block iframe interactions */}
            <div className="absolute inset-0 z-10 bg-transparent" />
          </div>

          {/* Bottom: Page count or Download button */}
          <div className="flex items-center justify-center h-8">
            {hoveredPreview ? (
              <a
                href={fileUrl}
                download={file.original_name}
                className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[12.5px] font-medium transition-all duration-200 active:scale-98 cursor-pointer shadow-lg shadow-blue-500/10"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF ({formatSize(file.size)})
              </a>
            ) : (
              <span className="text-[12px] text-zinc-400 font-medium">
                {file.num_pages ? `${file.num_pages} pages` : "Document"} • {formatSize(file.size)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
