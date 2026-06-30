"use client";

import React from "react";
import { FileText } from "lucide-react";

interface FileListItemProps {
  name: string;
  type: string;
  onClick?: () => void;
  onDownload?: (e: React.MouseEvent) => void;
}

export default function FileListItem({
  name,
  type,
  onClick,
  onDownload,
}: FileListItemProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-blue-900/80 hover:bg-[#141418]/60 cursor-pointer transition-all duration-300 group/file"
    >
      <div className="flex items-center gap-3.5">
        {/* File icon wrapper */}
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-800/40 border border-zinc-800/80 text-zinc-400 group-hover/file:text-zinc-200 transition-colors">
          <FileText className="w-5 h-5" />
        </div>
        {/* Name and Type */}
        <div className="flex flex-col">
          <span className="text-[14.5px] font-medium text-zinc-200 group-hover/file:text-white transition-colors">
            {name}
          </span>
          <span className="text-[11.5px] text-zinc-500 font-sans tracking-wider uppercase font-semibold">
            {type}
          </span>
        </div>
      </div>

      {/* Download Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onDownload) onDownload(e);
        }}
        className="px-4 py-1.5 rounded-xl border border-zinc-800 bg-[#121215]/80 hover:bg-blue-600 hover:border-blue-600 hover:text-white text-zinc-300 text-[13px] font-medium transition-all duration-200 cursor-pointer"
      >
        Download
      </button>
    </div>
  );
}
