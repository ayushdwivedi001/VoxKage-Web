"use client";

import React from "react";
import { User, X, Check } from "lucide-react";

interface ProfileModalProps {
  userName: string;
  setUserName: (name: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function ProfileModal({
  userName,
  setUserName,
  onClose,
  onSave,
}: ProfileModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
      />

      {/* Card */}
      <div className="relative w-full max-w-sm bg-[#121216] border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 flex flex-col gap-5 font-sans text-zinc-300 animate-fadeIn">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-zinc-100 text-base font-semibold">User Profile</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display Name Input */}
        <div className="flex flex-col gap-2">
          <label className="text-[12.5px] font-medium text-zinc-400">Display Name</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700 font-medium"
          />
          <span className="text-[11px] text-zinc-500">
            Shown in VoxKage greetings and chat assistant responses.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-800 text-[13.5px] hover:bg-zinc-800/80 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_12px_rgba(37,99,235,0.45)] text-white border border-blue-500/30 transition-colors text-[13.5px] font-medium cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Save Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
