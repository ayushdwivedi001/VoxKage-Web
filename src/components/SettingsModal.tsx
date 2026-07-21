"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Plus, Trash2, X, Info, ExternalLink, Key } from "lucide-react";

interface SettingsModalProps {
  openCodeApiKey: string;
  setOpenCodeApiKey: (key: string) => void;
  kiloApiKey: string;
  setKiloApiKey: (key: string) => void;
  customProxyUrl: string;
  setCustomProxyUrl: (url: string) => void;
  onClose: () => void;
  onSave: () => void;
  onLogout: () => void;
}

export default function SettingsModal({
  openCodeApiKey,
  setOpenCodeApiKey,
  kiloApiKey,
  setKiloApiKey,
  customProxyUrl,
  setCustomProxyUrl,
  onClose,
  onSave,
  onLogout,
}: SettingsModalProps) {
  const [showOpenCodeKey, setShowOpenCodeKey] = useState(false);
  const [showKiloKey, setShowKiloKey] = useState(false);
  const [showAddProviderModal, setShowAddProviderModal] = useState(false);
  const [selectedProviderToAdd, setSelectedProviderToAdd] = useState<"kilo" | null>(null);
  const [tempKiloKeyInput, setTempKiloKeyInput] = useState("");

  const handleConfirmAddKiloKey = () => {
    if (tempKiloKeyInput.trim()) {
      setKiloApiKey(tempKiloKeyInput.trim());
    }
    setTempKiloKeyInput("");
    setSelectedProviderToAdd(null);
    setShowAddProviderModal(false);
  };

  const handleRemoveKiloKey = () => {
    setKiloApiKey("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Outer Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
      />

      {/* Main Settings Modal Card */}
      <div className="relative w-full max-w-xl bg-[#121216] border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 flex flex-col gap-6 font-sans text-zinc-300 animate-fadeIn max-h-[90vh] overflow-y-auto custom-vscode-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3.5">
          <div className="flex flex-col">
            <h3 className="text-zinc-100 text-lg font-semibold">VoxKage Settings</h3>
            <span className="text-[12px] text-zinc-400">Configure your LLM provider keys and network proxy.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* SECTION 1: API PROVIDERS HEADER */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[13px] font-semibold text-zinc-400 uppercase tracking-wider">
              API Providers
            </h4>
            <span className="text-[11.5px] text-zinc-500 font-mono">BYOK (Bring Your Own Key)</span>
          </div>

          {/* PROVIDER 1: OPENCODE ZEN */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {/* OpenCode Logo Badge */}
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200 font-bold text-xs font-mono">
                  OC
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] font-semibold text-zinc-100">OpenCode Zen</span>
                  <span className="text-[11px] text-zinc-400">DeepSeek V4, Claude 4.6, Gemini 3.5</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                Active
              </span>
            </div>

            <div className="relative w-full">
              <input
                type="text"
                name="opencode_zen_api_key_field"
                autoComplete="off"
                data-lpignore="true"
                value={openCodeApiKey}
                onChange={(e) => setOpenCodeApiKey(e.target.value)}
                placeholder="Enter OpenCode API Key"
                className="w-full h-10 bg-zinc-950/80 border border-zinc-800 rounded-lg pl-3 pr-10 text-zinc-200 text-[13.5px] focus:outline-none focus:border-zinc-700 font-mono"
                style={{
                  WebkitTextSecurity: showOpenCodeKey ? "none" : "disc",
                } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => setShowOpenCodeKey(!showOpenCodeKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1 cursor-pointer"
                aria-label={showOpenCodeKey ? "Hide API Key" : "Show API Key"}
              >
                {showOpenCodeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* PROVIDER 2: KILO CODE (If configured) */}
          {kiloApiKey ? (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {/* Kilo Logo Badge */}
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200 font-bold text-xs font-mono">
                    KC
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold text-zinc-100">Kilo Code API</span>
                    <span className="text-[11px] text-zinc-400">StepFun 3.7 Flash, KAT-Coder Pro, Nemotron</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                    Active
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveKiloKey}
                    title="Remove Kilo API Key"
                    className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="relative w-full">
                <input
                  type="text"
                  name="kilo_api_key_field"
                  autoComplete="off"
                  data-lpignore="true"
                  value={kiloApiKey}
                  onChange={(e) => setKiloApiKey(e.target.value)}
                  placeholder="Enter Kilo Code API Key"
                  className="w-full h-10 bg-zinc-950/80 border border-zinc-800 rounded-lg pl-3 pr-10 text-zinc-200 text-[13.5px] focus:outline-none focus:border-zinc-700 font-mono"
                  style={{
                    WebkitTextSecurity: showKiloKey ? "none" : "disc",
                  } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowKiloKey(!showKiloKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1 cursor-pointer"
                  aria-label={showKiloKey ? "Hide API Key" : "Show API Key"}
                >
                  {showKiloKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : null}

          {/* ADD PROVIDER BUTTON */}
          <button
            type="button"
            onClick={() => setShowAddProviderModal(true)}
            className="w-full py-2.5 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-800/50 text-zinc-300 hover:text-white text-[13px] font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4 text-zinc-400" />
            <span>Add Provider</span>
          </button>
        </div>

        {/* SECTION 2: CLOUDFLARE CORS PROXY URL (Read-Only) */}
        <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
          <label className="text-[12.5px] font-medium text-zinc-400 flex items-center gap-1.5">
            <span>Cloudflare CORS Proxy URL</span>
            <span className="text-[10px] text-zinc-500 font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
              Auto-Generated
            </span>
          </label>
          <input
            type="text"
            readOnly
            value={customProxyUrl || "https://voxkage-proxy.ayushdwivedi001.workers.dev"}
            className="w-full h-10 bg-zinc-950/50 border border-zinc-800/60 rounded-xl px-3.5 text-zinc-400 text-[13.5px] cursor-not-allowed select-all font-mono"
          />
          <span className="text-[11px] text-zinc-500">
            Dynamically assigned Cloudflare worker edge proxy to prevent browser CORS restrictions.
          </span>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex gap-2 justify-between mt-2 pt-3 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="px-4 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-[13.5px] font-medium transition-colors cursor-pointer"
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

      {/* SUB-MODAL: ADD PROVIDER DIALOG */}
      {showAddProviderModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            onClick={() => {
              setShowAddProviderModal(false);
              setSelectedProviderToAdd(null);
            }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200"
          />

          <div className="relative w-full max-w-md bg-[#121216] border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 flex flex-col gap-4 font-sans text-zinc-300 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <h4 className="text-zinc-100 text-base font-semibold">Available Providers</h4>
              <button
                type="button"
                onClick={() => {
                  setShowAddProviderModal(false);
                  setSelectedProviderToAdd(null);
                }}
                className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!selectedProviderToAdd ? (
              <div className="flex flex-col gap-2">
                <span className="text-[12px] text-zinc-400">Select a provider to add your API key:</span>
                
                {/* Kilo Code Option */}
                <button
                  type="button"
                  onClick={() => setSelectedProviderToAdd("kilo")}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200 font-bold text-xs font-mono">
                      KC
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[14px] font-semibold text-zinc-100">Kilo Code API</span>
                      <span className="text-[11.5px] text-zinc-400">StepFun 3.7 Flash, KAT-Coder Pro, Nemotron</span>
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
            ) : (
              /* KILO CODE INSTRUCTIONS & PASTE KEY DIALOG */
              <div className="flex flex-col gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-zinc-200 font-semibold text-[13px]">
                    <Info className="w-4 h-4 text-zinc-400" />
                    <span>How to get your Kilo Code API Key</span>
                  </div>
                  <ol className="text-[11.5px] text-zinc-400 list-decimal list-inside space-y-1 leading-relaxed">
                    <li>Visit <a href="https://kilo.ai" target="_blank" rel="noreferrer" className="text-zinc-200 underline inline-flex items-center gap-0.5">kilo.ai <ExternalLink className="w-3 h-3 text-zinc-400" /></a></li>
                    <li>Navigate to <b>API / Account Settings</b></li>
                    <li>Generate a new API Key & copy the token string</li>
                  </ol>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-medium text-zinc-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Paste Kilo Code API Key</span>
                  </label>
                  <input
                    type="password"
                    value={tempKiloKeyInput}
                    onChange={(e) => setTempKiloKeyInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[13px] font-mono focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setSelectedProviderToAdd(null)}
                    className="px-3.5 py-1.5 rounded-xl border border-zinc-800 text-[13px] hover:bg-zinc-800 transition-colors cursor-pointer text-zinc-300"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddKiloKey}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-[13px] transition-colors cursor-pointer"
                  >
                    Save Provider
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
