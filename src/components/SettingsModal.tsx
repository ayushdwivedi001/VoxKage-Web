"use client";

import React from "react";

interface SettingsModalProps {
  userName: string;
  setUserName: (name: string) => void;
  openCodeApiKey: string;
  setOpenCodeApiKey: (key: string) => void;
  customProxyUrl: string;
  setCustomProxyUrl: (url: string) => void;
  onClose: () => void;
  onSave: () => void;
  onLogout: () => void;
}

export default function SettingsModal({
  userName,
  setUserName,
  openCodeApiKey,
  setOpenCodeApiKey,
  customProxyUrl,
  setCustomProxyUrl,
  onClose,
  onSave,
  onLogout,
}: SettingsModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
      />
      <div className="relative w-full max-w-md bg-[#121216] border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 flex flex-col gap-4 font-sans text-zinc-300 animate-fadeIn">
        <h3 className="text-zinc-100 text-base font-semibold">VoxKage Settings</h3>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-zinc-400">Display Name</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700"
          />
          <span className="text-[11px] text-zinc-500">Shown in greetings and across the interface.</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-zinc-400">OpenCode Zen API Key</label>
          <input
            type="password"
            value={openCodeApiKey}
            onChange={(e) => setOpenCodeApiKey(e.target.value)}
            placeholder="Enter OpenCode API Key"
            className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700"
          />
          <span className="text-[11px] text-zinc-500">Stored locally in your browser. Originates requests directly from your IP.</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12.5px] font-medium text-zinc-400">Cloudflare CORS Proxy URL</label>
          <input
            type="text"
            value={customProxyUrl}
            onChange={(e) => setCustomProxyUrl(e.target.value)}
            placeholder="https://voxkage-proxy.yourname.workers.dev"
            className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700"
          />
          <span className="text-[11px] text-zinc-500">Personal proxy to bypass browser CORS headers. Default public workers pool used if empty.</span>
        </div>

        <div className="flex gap-2 justify-between mt-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="px-4 py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-950/20 text-[13.5px] font-medium transition-colors cursor-pointer"
          >
            Log Out
          </button>
          <div className="flex gap-2">
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
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_12px_rgba(37,99,235,0.45)] text-white border border-blue-500/30 transition-colors text-[13.5px] font-medium cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
