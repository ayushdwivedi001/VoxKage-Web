"use client";

import React from "react";

interface RenameSessionModalProps {
  renameValue: string;
  setRenameValue: (val: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function RenameSessionModal({
  renameValue,
  setRenameValue,
  onClose,
  onSave,
}: RenameSessionModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
      />
      <div className="relative w-full max-w-sm bg-[#121216] border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 flex flex-col gap-4 font-sans text-zinc-300 animate-fadeIn">
        <h3 className="text-zinc-100 text-base font-semibold">Rename Chat</h3>
        <input
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave();
            }
          }}
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-800 text-[13.5px] hover:bg-zinc-800/80 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_12px_rgba(37,99,235,0.45)] text-white border border-blue-500/30 transition-colors text-[13.5px] font-medium cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
