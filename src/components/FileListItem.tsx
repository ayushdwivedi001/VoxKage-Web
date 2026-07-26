"use client";

import React from "react";
import { FileText } from "lucide-react";

interface FileListItemProps {
  name: string;
  type: string;
  onClick?: () => void;
  onDownload?: (e: React.MouseEvent) => void;
  versions?: Array<{ version: number; code: string }>;
  activeVersion?: number;
  onSelectVersion?: (version: number) => void;
}

export default function FileListItem({
  name,
  type,
  onClick,
  onDownload,
  versions,
  activeVersion,
  onSelectVersion,
}: FileListItemProps) {
  const currentVer = activeVersion || (versions && versions.length > 0 ? versions[versions.length - 1].version : 1);

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 [.light_&]:bg-[#efe9de] border border-blue-500/30 [.light_&]:border-blue-500/40 hover:border-blue-500 [.light_&]:hover:border-blue-600 hover:bg-[#141418]/60 [.light_&]:hover:bg-[#e6dfd8]/80 cursor-pointer transition-all duration-300 group/file"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
        {/* File icon wrapper */}
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 [.light_&]:bg-blue-500/10 border border-blue-500/30 [.light_&]:border-blue-500/30 text-blue-400 [.light_&]:text-blue-600 group-hover/file:text-blue-300 [.light_&]:group-hover/file:text-blue-700 transition-colors flex-shrink-0">
          <FileText className="w-5 h-5 text-blue-500 [.light_&]:text-blue-600" />
        </div>
        {/* Name and Type */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14.5px] font-medium text-zinc-200 [.light_&]:text-[#141413] group-hover/file:text-white [.light_&]:group-hover/file:text-black transition-colors truncate">
              {name}
            </span>
            {versions && versions.length > 1 ? (
              <div 
                onClick={(e) => e.stopPropagation()} 
                className="relative inline-flex items-center flex-shrink-0"
              >
                <select
                  value={currentVer}
                  onChange={(e) => {
                    if (onSelectVersion) onSelectVersion(Number(e.target.value));
                  }}
                  className="bg-[#202024] [.light_&]:bg-[#e6dfd8] border border-blue-500/30 [.light_&]:border-blue-500/30 rounded px-1.5 py-0.5 text-[11px] text-blue-400 [.light_&]:text-blue-700 font-sans cursor-pointer focus:outline-none focus:border-blue-500 select-none font-medium"
                >
                  {versions.map((v) => (
                    <option key={v.version} value={v.version}>
                      v{v.version}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-[11px] bg-blue-500/15 text-blue-400 [.light_&]:text-blue-700 px-1.5 py-0.5 rounded font-sans select-none flex-shrink-0 font-medium border border-blue-500/20">
                v1
              </span>
            )}
          </div>
          <span className="text-[11.5px] text-zinc-500 [.light_&]:text-[#6c6a64] font-sans tracking-wider uppercase font-semibold mt-0.5">
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
        className="px-4 py-1.5 rounded-xl border border-blue-600 [.light_&]:border-blue-600 bg-blue-600 [.light_&]:bg-blue-600 hover:bg-blue-700 [.light_&]:hover:bg-blue-700 hover:border-blue-700 [.light_&]:hover:border-blue-700 text-white text-[13px] font-medium transition-all duration-200 cursor-pointer flex-shrink-0 shadow-sm"
      >
        Download
      </button>
    </div>
  );
}
