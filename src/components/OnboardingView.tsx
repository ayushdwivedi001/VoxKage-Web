"use client";

import React, { useState } from "react";
import DesignDottedCanvas from "@/components/DesignDottedCanvas";
import { Eye, EyeOff, Key, ChevronDown, Check, LogOut, Info, ExternalLink } from "lucide-react";
import { secureSaveKey } from "@/lib/secureStorage";

interface OnboardingViewProps {
  userEmail: string;
  onComplete: (openCodeKey: string, kiloKey: string) => void;
  onLogout: () => void;
}

export default function OnboardingView({ userEmail, onComplete, onLogout }: OnboardingViewProps) {
  const [selectedProvider, setSelectedProvider] = useState<"opencode" | "kilo" | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSelectProvider = (provider: "opencode" | "kilo") => {
    setSelectedProvider(provider);
    setApiKeyInput("");
    setIsDropdownOpen(false);
    setErrorMessage("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider) return;
    if (!apiKeyInput.trim()) {
      setErrorMessage("API key cannot be empty.");
      return;
    }

    setIsLoading(true);
    try {
      const email = userEmail.trim().toLowerCase();
      const cleanKey = apiKeyInput.trim();

      let finalOpenCode = "";
      let finalKilo = "";

      if (selectedProvider === "opencode") {
        await secureSaveKey(`voxkage_${email}_opencode_api_key`, cleanKey);
        finalOpenCode = cleanKey;
      } else {
        await secureSaveKey(`voxkage_${email}_kilo_api_key`, cleanKey);
        finalKilo = cleanKey;
      }

      onComplete(finalOpenCode, finalKilo);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save key. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center p-4 bg-[#05050a] [.light_&]:bg-[#DBDAD4] overflow-hidden font-sans select-none z-10">
      {/* Background elements */}
      <DesignDottedCanvas active={true} isChatActive={false} />

      {/* Main card */}
      <div className="relative w-full max-w-md bg-[#0d0d12]/90 border border-zinc-800/80 rounded-2xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-md z-20 flex flex-col gap-6 animate-fadeIn">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <h2 className="text-zinc-100 text-2xl font-bold tracking-tight">Setup API Key</h2>
          <p className="text-zinc-400 text-[13px] leading-relaxed">
            Please configure your API provider key (BYOK) for <span className="text-zinc-200 font-medium">{userEmail}</span> to unlock VoxKage.
          </p>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4.5">
          {/* Provider Selection Dropdown */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[12.5px] font-medium text-zinc-400">Choose API Provider</label>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full h-11 bg-zinc-950/75 border border-zinc-850 hover:border-zinc-800 rounded-xl px-4 flex items-center justify-between text-zinc-300 text-[13.5px] font-medium transition-colors cursor-pointer"
            >
              <span>
                {selectedProvider === "opencode"
                  ? "OpenCode Zen"
                  : selectedProvider === "kilo"
                  ? "Kilo Code API"
                  : "Select a provider..."}
              </span>
              <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-[68px] left-0 w-full bg-[#121218] border border-zinc-800 rounded-xl shadow-2xl z-30 overflow-hidden py-1">
                <button
                  type="button"
                  onClick={() => handleSelectProvider("opencode")}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-900 text-left text-zinc-300 hover:text-zinc-100 text-[13.5px] transition-colors cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-[13px]">OpenCode Zen</span>
                    <span className="text-[11px] text-zinc-400">DeepSeek V4, Claude 4.6, Gemini 3.5</span>
                  </div>
                  {selectedProvider === "opencode" && <Check className="w-4 h-4 text-blue-500" />}
                </button>
                <div className="border-t border-zinc-900" />
                <button
                  type="button"
                  onClick={() => handleSelectProvider("kilo")}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-900 text-left text-zinc-300 hover:text-zinc-100 text-[13.5px] transition-colors cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-[13px]">Kilo Code API</span>
                    <span className="text-[11px] text-zinc-400">StepFun 3.7 Flash, KAT-Coder Pro, Nemotron</span>
                  </div>
                  {selectedProvider === "kilo" && <Check className="w-4 h-4 text-blue-500" />}
                </button>
              </div>
            )}
          </div>

          {/* Provider Specific Description & Key Input */}
          {selectedProvider && (
            <div className="flex flex-col gap-4 animate-slideDown">
              {/* Info panel */}
              <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-zinc-200 font-semibold text-[12.5px]">
                  <Info className="w-3.5 h-3.5 text-zinc-400" />
                  <span>How to obtain your key:</span>
                </div>
                {selectedProvider === "opencode" ? (
                  <ol className="text-[11.5px] text-zinc-400 list-decimal list-inside space-y-1 leading-relaxed">
                    <li>
                      Visit{" "}
                      <a
                        href="https://opencode.ai"
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-200 underline inline-flex items-center gap-0.5"
                      >
                        opencode.ai <ExternalLink className="w-3 h-3 text-zinc-500" />
                      </a>
                    </li>
                    <li>Navigate to Settings &rarr; API Keys</li>
                    <li>Generate a new API Key and copy the token</li>
                  </ol>
                ) : (
                  <ol className="text-[11.5px] text-zinc-400 list-decimal list-inside space-y-1 leading-relaxed">
                    <li>
                      Visit{" "}
                      <a
                        href="https://kilo.ai"
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-200 underline inline-flex items-center gap-0.5"
                      >
                        kilo.ai <ExternalLink className="w-3 h-3 text-zinc-500" />
                      </a>
                    </li>
                    <li>Navigate to API / Account Settings</li>
                    <li>Generate a new key and copy the token</li>
                  </ol>
                )}
              </div>

              {/* Key Input Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-medium text-zinc-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Paste API Key</span>
                </label>
                <div className="relative w-full">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder={
                      selectedProvider === "opencode"
                        ? "Enter OpenCode API Key"
                        : "Enter Kilo Code API Key"
                    }
                    className="w-full h-11 bg-zinc-950/75 border border-zinc-850 focus:border-zinc-700 rounded-xl pl-4 pr-11 text-zinc-200 text-[13.5px] font-mono focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1 cursor-pointer"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <span className="text-[12px] text-red-500 font-medium px-1 mt-1 block">
              {errorMessage}
            </span>
          )}

          {/* Save Action Button */}
          <button
            type="submit"
            disabled={isLoading || !selectedProvider || !apiKeyInput.trim()}
            className="w-full h-11 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800/80 text-white font-medium text-[13.5px] rounded-xl flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed shadow-[0_0_12px_rgba(37,99,235,0.2)] mt-2"
          >
            {isLoading ? "Saving Key..." : "Save Key & Continue"}
          </button>
        </form>

        {/* Footer actions */}
        <div className="flex justify-center border-t border-zinc-800/60 pt-4.5">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 text-[12.5px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
