"use client";

import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";

interface ConnectingAppModalProps {
  isOpen: boolean;
  serverId: string;
  serverName: string;
  onCancel: () => void;
  onSuccess: () => void;
}

// Helper to render customized SVG app logos
function renderAppLogo(id: string) {
  if (id === "gdrive") {
    return (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <path d="M8.5 4.5L3.5 13.5L6.5 19L11.5 10L8.5 4.5Z" fill="#00D4B2" />
        <path d="M15.5 4.5L10.5 13.5L13.5 19L18.5 10L15.5 4.5Z" fill="#0084FF" />
        <path d="M12 10L7 19H17L12 10Z" fill="#FFC700" />
      </svg>
    );
  }
  if (id === "slack") {
    return (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="8" height="8" rx="1.5" fill="#E01E5A" />
        <rect x="14" y="2" width="8" height="8" rx="1.5" fill="#36C5F0" />
        <rect x="2" y="14" width="8" height="8" rx="1.5" fill="#2EB67D" />
        <rect x="14" y="14" width="8" height="8" rx="1.5" fill="#ECB22E" />
      </svg>
    );
  }
  if (id === "gcal" || id === "google_calendar") {
    return (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#1A73E8" />
        <path d="M7 8V16H9V10.5L11.5 13L13 11.5L9.5 8H7Z" fill="white" />
        <path d="M17 8H14V10H16V12H14V14H16V16H17V8Z" fill="white" />
      </svg>
    );
  }
  if (id === "gmail") {
    return (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <path d="M2 5V19C2 20.1 2.9 21 4 21H6V9L12 14L18 9V21H20C21.1 21 22 20.1 22 19V5C22 3.9 21.1 3 20 3H18L12 8L6 3H4C2.9 3 2 3.9 2 5Z" fill="#EA4335" />
      </svg>
    );
  }
  if (id === "canva") {
    return (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill="#00C4CC" />
        <text x="5" y="17" fill="white" fontSize="13" fontWeight="bold" fontFamily="sans-serif">C</text>
      </svg>
    );
  }
  if (id === "figma") {
    return (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <path d="M8 2C5.79 2 4 3.79 4 6C4 7.21 4.54 8.29 5.39 9C4.54 9.71 4 10.79 4 12C4 13.21 4.54 14.29 5.39 15C4.54 15.71 4 16.79 4 18C4 20.21 5.79 22 8 22C10.21 22 12 20.21 12 18V12V6C12 3.79 10.21 2 8 2Z" fill="#F24E1E" />
        <path d="M16 12C13.79 12 12 13.79 12 16C12 18.21 13.79 20 16 20C18.21 20 20 18.21 20 16C20 13.79 18.21 12 16 12Z" fill="#A259FF" />
        <path d="M12 6C12 8.21 13.79 10 16 10C18.21 10 20 8.21 20 6C20 3.79 18.21 2 16 2C13.79 2 12 3.79 12 6Z" fill="#1ABC9C" />
      </svg>
    );
  }
  if (id === "notion") {
    return (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#FFFFFF" />
        <text x="6" y="17" fill="#000000" fontSize="14" fontWeight="black" fontFamily="sans-serif">N</text>
      </svg>
    );
  }
  if (id === "resend") {
    return (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#0d0d12" />
        <text x="6" y="17" fill="#FFFFFF" fontSize="14" fontWeight="bold" fontFamily="sans-serif">R</text>
      </svg>
    );
  }
  if (id === "tableau") {
    return (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#EAEBEE" />
        <circle cx="12" cy="12" r="3" fill="#E15759" />
        <circle cx="12" cy="5" r="2.5" fill="#4E79A7" />
        <circle cx="12" cy="19" r="2.5" fill="#4E79A7" />
        <circle cx="5" cy="12" r="2.5" fill="#4E79A7" />
        <circle cx="19" cy="12" r="2.5" fill="#4E79A7" />
      </svg>
    );
  }
  if (id === "magicschool") {
    return (
      <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-[18px] font-bold text-white font-sans">
        M
      </div>
    );
  }
  return (
    <svg className="w-12 h-12 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M21 16V8M3 8v8M9 3v18M15 3v18" />
    </svg>
  );
}

// Render VoxKage Logo mascot
function renderVoxKageLogo() {
  return (
    <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-750 flex items-center justify-center relative overflow-hidden group">
      {/* Dynamic glowing background */}
      <div className="absolute inset-0 bg-[#c96442]/10 blur-md rounded-full group-hover:scale-110 transition-transform duration-500" />
      
      {/* Styled mascot SVG representing a sleek creature */}
      <svg className="w-9 h-9 text-[#cc785c] relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function ConnectingAppModal({
  isOpen,
  serverId,
  serverName,
  onCancel,
  onSuccess,
}: ConnectingAppModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    // Simulate OAuth connection loop
    // In mock mode, we show the linking animation for 3 seconds,
    // then open a mock OAuth page (or directly confirm authentication success)
    const timer = setTimeout(() => {
      onSuccess();
    }, 3200);

    return () => clearTimeout(timer);
  }, [isOpen, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Modal backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* Connection Popup box */}
      <div className="relative w-full max-w-md bg-[#0a0a0d] border border-zinc-850 rounded-2xl p-8 flex flex-col items-center justify-center shadow-2xl text-center font-sans overflow-hidden">
        {/* Animated pulse background lines */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-transparent to-transparent" />

        {/* Title */}
        <h3 className="text-white text-[15px] font-semibold tracking-wide mb-6 font-sans">
          Connecting {serverName} to VoxKage
        </h3>

        {/* Linking Mascot & App Logo Panel */}
        <div className="flex items-center justify-center gap-6 w-full mb-8 relative">
          
          {/* App Logo Container */}
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-850 flex items-center justify-center shadow-inner relative z-10">
            {renderAppLogo(serverId)}
          </div>

          {/* Linking Thread / Scanning Pulse Animation */}
          <div className="relative flex-grow h-1.5 max-w-[80px] bg-zinc-850 rounded-full overflow-hidden">
            {/* Glowing scanning pulse indicator */}
            <div className="absolute top-0 bottom-0 w-6 bg-gradient-to-r from-transparent via-[#cc785c] to-transparent animate-scanLine" />
          </div>

          {/* VoxKage Mascot Logo Container */}
          <div className="relative z-10">
            {renderVoxKageLogo()}
          </div>
        </div>

        {/* Status Loader */}
        <div className="flex items-center gap-2.5 text-zinc-400 text-[13px] font-medium font-sans">
          <Loader2 className="w-4 h-4 text-[#cc785c] animate-spin" />
          <span>Authenticating connection credentials...</span>
        </div>

        {/* Cancel Button */}
        <button
          type="button"
          onClick={onCancel}
          className="mt-8 px-5 py-2 text-[12px] font-medium text-zinc-500 hover:text-zinc-300 border border-zinc-850 hover:border-zinc-700 bg-transparent rounded-lg transition-colors cursor-pointer font-sans"
        >
          Cancel Connection
        </button>

        {/* Style block for the keyframe scanner animation */}
        <style jsx global>{`
          @keyframes scanLine {
            0% {
              left: -30%;
            }
            50% {
              left: 100%;
            }
            100% {
              left: -30%;
            }
          }
          .animate-scanLine {
            animation: scanLine 2.2s infinite ease-in-out;
          }
        `}</style>
      </div>
    </div>
  );
}
