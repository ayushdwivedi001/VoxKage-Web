import React from "react";
import { X } from "lucide-react";

interface ZoomDocumentPreviewProps {
  file: {
    filename: string;
    original_name: string;
    url: string;
    type: string;
    size: number;
    num_pages?: number;
  };
  onClose: () => void;
}

export default function ZoomDocumentPreview({ file, onClose }: ZoomDocumentPreviewProps) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://shinayush-voxkage-web-backend.hf.space";
  const fileUrl = file.url.startsWith("http") ? file.url : `${backendUrl}${file.url}`;

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center select-none animate-fadeIn">
      {/* Dimmed Background Overlay */}
      <div 
        className="absolute inset-0 bg-[#070709]/85 cursor-pointer"
        onClick={onClose}
      />
      
      {/* Modal Dialog Card */}
      <div className="relative z-[9999] bg-[#121215] border border-zinc-800/80 rounded-2xl shadow-2xl w-[90vw] max-w-[650px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-850/65">
          <span className="text-[14.5px] font-medium text-zinc-150 truncate max-w-[80%]">
            {file.original_name}
          </span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
            aria-label="Close document preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center: First Page Preview Frame */}
        <div className="p-6 bg-[#0c0c0e] flex items-center justify-center min-h-[350px] max-h-[500px] overflow-hidden">
          <div className="relative border border-zinc-800 rounded-xl overflow-hidden w-full h-[400px] bg-zinc-950/40">
            <iframe 
              src={`${fileUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0`} 
              className="w-full h-full border-none pointer-events-none select-none"
              title="First Page Preview"
              scrolling="no"
            />
            {/* Absolute overlay to intercept pointer interactions */}
            <div className="absolute inset-0 z-10 bg-transparent" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center py-4 border-t border-zinc-850/65 bg-[#0e0e11]">
          <span className="text-[12.5px] text-zinc-400 font-medium font-sans">
            {file.num_pages ? `${file.num_pages} ${file.num_pages === 1 ? "page" : "pages"}` : "Document"}
          </span>
        </div>
      </div>
    </div>
  );
}
