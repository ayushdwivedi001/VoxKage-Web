"use client";

import React, { useState } from "react";
import {
  X,
  KeyRound,
  ShieldAlert,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  Loader2,
  Copy,
  Info
} from "lucide-react";
import { saveGoogleCredentials } from "@/lib/api";

interface GoogleOAuthConnectModalProps {
  isOpen: boolean;
  serviceName: string; // "Gmail" | "Google Drive" | "Google Calendar"
  serviceSlug: string; // "gmail" | "google_drive" | "google_calendar"
  onClose: () => void;
  onProceedWithDefault: () => void;
  onProceedWithCustom: () => void;
}

export default function GoogleOAuthConnectModal({
  isOpen,
  serviceName,
  serviceSlug,
  onClose,
  onProceedWithDefault,
  onProceedWithCustom
}: GoogleOAuthConnectModalProps) {
  const [activeTab, setActiveTab] = useState<"custom" | "developer">("custom");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  if (!isOpen) return null;

  const redirectUri = typeof window !== "undefined"
    ? `${window.location.origin}/oauth/callback`
    : "https://voxkage-ai.vercel.app/oauth/callback";

  const handleCopyRedirect = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  const handleSaveAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) {
      setError("Please enter both your Google Client ID and Client Secret.");
      return;
    }

    if (!clientId.trim().includes(".apps.googleusercontent.com")) {
      setError("Client ID should end with '.apps.googleusercontent.com'");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await saveGoogleCredentials(clientId.trim(), clientSecret.trim());
      setLoading(false);
      onProceedWithCustom();
    } catch (err: any) {
      setError(err.message || "Failed to save Google credentials.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div
        className="relative w-full max-w-xl bg-[#0e0e11] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-white animate-scaleUp max-h-[90vh] flex flex-col"
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/80 bg-zinc-900/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white leading-snug">
                Connect {serviceName} with VoxKage
              </h3>
              <p className="text-[12px] text-zinc-400">
                Choose how you want to authenticate with Google
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Option Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 p-1.5 flex-shrink-0 gap-1.5 px-6 pt-3">
          <button
            type="button"
            onClick={() => { setActiveTab("custom"); setError(null); }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-[13px] font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "custom"
                ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/60"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Use My Own Keys (BYO - Recommended)</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("developer"); setError(null); }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-[13px] font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "developer"
                ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/60"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-blue-400" />
            <span>VoxKage Developer OAuth</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto custom-chat-scrollbar space-y-5 flex-grow">
          {activeTab === "custom" ? (
            /* TAB 1: CUSTOM CREDENTIALS (BYO KEYS) */
            <form onSubmit={handleSaveAndConnect} className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-amber-200/90 leading-relaxed">
                  Enter your Google Cloud OAuth Client ID & Secret below. Once saved, these credentials will be linked to your account for <strong>Gmail, Google Drive, and Google Calendar</strong> so you only enter them once!
                </p>
              </div>

              {/* Client ID Input */}
              <div className="space-y-1.5">
                <label className="text-[12.5px] font-medium text-zinc-300 flex items-center justify-between">
                  <span>Google Client ID</span>
                  <span className="text-[11px] text-zinc-500">Required</span>
                </label>
                <input
                  type="text"
                  placeholder="123456789-abc.apps.googleusercontent.com"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full h-11 px-3.5 bg-zinc-900/90 border border-zinc-700/80 rounded-xl text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Client Secret Input */}
              <div className="space-y-1.5">
                <label className="text-[12.5px] font-medium text-zinc-300 flex items-center justify-between">
                  <span>Google Client Secret</span>
                  <span className="text-[11px] text-zinc-500">Required</span>
                </label>
                <input
                  type="password"
                  placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxx"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-full h-11 px-3.5 bg-zinc-900/90 border border-zinc-700/80 rounded-xl text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-[12px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Expandable How-To Guide for Non-Developers */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/40">
                <button
                  type="button"
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="w-full px-4 py-3 text-left text-[13px] font-medium text-zinc-300 flex items-center justify-between hover:bg-zinc-900/40 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" />
                    How to generate your Client ID & Secret (5 Easy Steps)
                  </span>
                  {showInstructions ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  )}
                </button>

                {showInstructions && (
                  <div className="px-4 pb-4 pt-1 space-y-3 text-[12px] text-zinc-400 border-t border-zinc-800/60 leading-relaxed">
                    <ol className="list-decimal pl-4 space-y-2.5">
                      <li>
                        Go to{" "}
                        <a
                          href="https://console.cloud.google.com"
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          Google Cloud Console <ExternalLink className="w-3 h-3" />
                        </a>{" "}
                        and create a new project (e.g. <em>VoxKage MCP</em>).
                      </li>
                      <li>
                        Go to <strong>APIs & Services</strong> &gt; <strong>Library</strong> and search &amp; enable:
                        <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[11px]">
                          <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">Gmail API</span>
                          <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">Google Drive API</span>
                          <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">Google Calendar API</span>
                        </div>
                      </li>
                      <li>
                        Go to <strong>OAuth consent screen</strong> &gt; Select <strong>External</strong> &gt; Add your email under <strong>Test users</strong>.
                      </li>
                      <li>
                        Go to <strong>Credentials</strong> &gt; <strong>Create Credentials</strong> &gt; Select <strong>OAuth client ID</strong> (Application type: <em>Web application</em>).
                      </li>
                      <li>
                        Add this exact URL under <strong>Authorized redirect URIs</strong>:
                        <div className="mt-1.5 flex items-center gap-2 bg-zinc-900 p-2 rounded-lg border border-zinc-800 font-mono text-[11px] text-zinc-300">
                          <span className="truncate flex-1">{redirectUri}</span>
                          <button
                            type="button"
                            onClick={handleCopyRedirect}
                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[10.5px] transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            {copiedRedirect ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            {copiedRedirect ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </li>
                    </ol>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-medium text-[13.5px] rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Credentials...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Save Credentials &amp; Connect {serviceName}</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* TAB 2: DEVELOPER DEFAULT OAUTH */
            <div className="space-y-5 py-2">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-[12.5px] text-zinc-300">
                  <p className="font-semibold text-white">VoxKage Developer App OAuth</p>
                  <p className="leading-relaxed">
                    This connects directly via VoxKage's official developer OAuth application. While Google branding verification is pending, your account email must be added to the developer test user list to bypass the unverified app warning screen.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2 text-[12.5px] text-zinc-400">
                <p className="font-medium text-zinc-200">What to expect:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>If your account is approved, a standard Google sign-in window will open.</li>
                  <li>If you see "Google hasn't verified this app", click <em>Advanced</em> &gt; <em>Go to VoxKage (unsafe)</em> to proceed.</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={onProceedWithDefault}
                className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-medium text-[13.5px] rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
              >
                <span>Continue with Developer OAuth</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
