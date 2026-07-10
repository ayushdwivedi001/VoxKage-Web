"use client";

import React, { useState } from "react";
import { Search, X, Settings, Plus, Star, Check } from "lucide-react";

export interface McpServerItem {
  id: string;
  name: string;
  desc: string;
  rank: string;
  verified: boolean;
  category: string;
  logoColor: string;
}

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedServers: string[]; // list of connected server ids
  onConnectClick: (serverId: string) => void;
  onConfigureClick: (serverId: string) => void;
}

const CATEGORIES = ["All", "Productivity", "Development", "Social", "Database"];

const POPULAR_SERVERS: McpServerItem[] = [
  {
    id: "gdrive",
    name: "Google Drive",
    desc: "Search, download, and structure files in your cloud storage",
    rank: "Popular",
    verified: true,
    category: "Productivity",
    logoColor: "text-green-500",
  },
  {
    id: "slack",
    name: "Slack",
    desc: "Post updates, query channels, & search chat logs",
    rank: "#3 popular",
    verified: true,
    category: "Social",
    logoColor: "text-amber-500",
  },
  {
    id: "gcal",
    name: "Google Calendar",
    desc: "Create events, list schedules, & get calendar digests",
    rank: "Popular",
    verified: true,
    category: "Productivity",
    logoColor: "text-blue-500",
  },
];

const DIRECTORY_SERVERS: McpServerItem[] = [
  {
    id: "resend",
    name: "Resend",
    desc: "Email for developers. The best way to reach humans instead of spam folders. Deliver transactional and marketing mail.",
    rank: "New",
    verified: true,
    category: "Development",
    logoColor: "text-white",
  },
  {
    id: "tableau",
    name: "Tableau",
    desc: "See, understand, and act on visual business data metrics and dashboards.",
    rank: "New",
    verified: false,
    category: "Database",
    logoColor: "text-orange-400",
  },
  {
    id: "magicschool",
    name: "MagicSchool AI",
    desc: "Save teaching materials and plan lessons directly to your MagicSchool Resource Library.",
    rank: "Verified",
    verified: true,
    category: "Productivity",
    logoColor: "text-purple-400",
  },
  {
    id: "canva",
    name: "Canva",
    desc: "Search, create, autofill, and export Canva designs and posters.",
    rank: "#4 popular",
    verified: true,
    category: "Productivity",
    logoColor: "text-teal-400",
  },
  {
    id: "m365",
    name: "Microsoft 365",
    desc: "Access your company's SharePoint, OneDrive, Outlook, and Teams directly in VoxKage.",
    rank: "#7 popular",
    verified: true,
    category: "Productivity",
    logoColor: "text-blue-400",
  },
  {
    id: "figma",
    name: "Figma",
    desc: "Generate UI diagrams, mockups, and better front-end code from Figma artboard context.",
    rank: "#5 popular",
    verified: true,
    category: "Development",
    logoColor: "text-rose-500",
  },
  {
    id: "gmail",
    name: "Gmail",
    desc: "Draft replies, summarize threads, search your inbox, and manage emails securely.",
    rank: "#2 popular",
    verified: true,
    category: "Productivity",
    logoColor: "text-red-500",
  },
  {
    id: "notion",
    name: "Notion",
    desc: "Connect your Notion workspace to search documents, update databases, and power workflows.",
    rank: "#6 popular",
    verified: true,
    category: "Productivity",
    logoColor: "text-white",
  },
];

// Helper to render customized SVG app logos matching provided design
function renderAppLogo(id: string) {
  if (id === "gdrive") {
    return (
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
        <path d="M8.5 4.5L3.5 13.5L6.5 19L11.5 10L8.5 4.5Z" fill="#00D4B2" />
        <path d="M15.5 4.5L10.5 13.5L13.5 19L18.5 10L15.5 4.5Z" fill="#0084FF" />
        <path d="M12 10L7 19H17L12 10Z" fill="#FFC700" />
      </svg>
    );
  }
  if (id === "slack") {
    return (
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="8" height="8" rx="1.5" fill="#E01E5A" />
        <rect x="14" y="2" width="8" height="8" rx="1.5" fill="#36C5F0" />
        <rect x="2" y="14" width="8" height="8" rx="1.5" fill="#2EB67D" />
        <rect x="14" y="14" width="8" height="8" rx="1.5" fill="#ECB22E" />
      </svg>
    );
  }
  if (id === "gcal") {
    return (
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#1A73E8" />
        <path d="M7 8V16H9V10.5L11.5 13L13 11.5L9.5 8H7Z" fill="white" />
        <path d="M17 8H14V10H16V12H14V14H16V16H17V8Z" fill="white" />
      </svg>
    );
  }
  if (id === "gmail") {
    return (
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
        <path d="M2 5V19C2 20.1 2.9 21 4 21H6V9L12 14L18 9V21H20C21.1 21 22 20.1 22 19V5C22 3.9 21.1 3 20 3H18L12 8L6 3H4C2.9 3 2 3.9 2 5Z" fill="#EA4335" />
      </svg>
    );
  }
  if (id === "canva") {
    return (
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill="#00C4CC" />
        <text x="6" y="17" fill="white" fontSize="13" fontWeight="bold" fontFamily="sans-serif">C</text>
      </svg>
    );
  }
  if (id === "figma") {
    return (
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
        <path d="M8 2C5.79 2 4 3.79 4 6C4 7.21 4.54 8.29 5.39 9C4.54 9.71 4 10.79 4 12C4 13.21 4.54 14.29 5.39 15C4.54 15.71 4 16.79 4 18C4 20.21 5.79 22 8 22C10.21 22 12 20.21 12 18V12V6C12 3.79 10.21 2 8 2Z" fill="#F24E1E" />
        <path d="M16 12C13.79 12 12 13.79 12 16C12 18.21 13.79 20 16 20C18.21 20 20 18.21 20 16C20 13.79 18.21 12 16 12Z" fill="#A259FF" />
        <path d="M12 6C12 8.21 13.79 10 16 10C18.21 10 20 8.21 20 6C20 3.79 18.21 2 16 2C13.79 2 12 3.79 12 6Z" fill="#1ABC9C" />
      </svg>
    );
  }
  if (id === "notion") {
    return (
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#FFFFFF" />
        <text x="6" y="17" fill="#000000" fontSize="14" fontWeight="black" fontFamily="sans-serif">N</text>
      </svg>
    );
  }
  if (id === "resend") {
    return (
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#0d0d12" />
        <text x="7" y="17" fill="#FFFFFF" fontSize="13" fontWeight="bold" fontFamily="sans-serif">R</text>
      </svg>
    );
  }
  if (id === "tableau") {
    return (
      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#EAEBEE" />
        <circle cx="12" cy="12" r="2" fill="#E15759" />
        <circle cx="12" cy="6" r="1.5" fill="#4E79A7" />
        <circle cx="12" cy="18" r="1.5" fill="#4E79A7" />
        <circle cx="6" cy="12" r="1.5" fill="#4E79A7" />
        <circle cx="18" cy="12" r="1.5" fill="#4E79A7" />
      </svg>
    );
  }
  if (id === "magicschool") {
    return (
      <div className="w-5 h-5 flex-shrink-0 rounded bg-indigo-600 flex items-center justify-center text-[11px] font-bold text-white font-sans">
        M
      </div>
    );
  }
  return (
    <svg className="w-5 h-5 text-zinc-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M21 16V8M3 8v8M9 3v18M15 3v18" />
    </svg>
  );
}

export default function ConnectModal({
  isOpen,
  onClose,
  connectedServers,
  onConnectClick,
  onConfigureClick,
}: ConnectModalProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  // Filter dynamic server directory list
  const filteredServers = DIRECTORY_SERVERS.filter((server) => {
    const matchesCategory = selectedCategory === "All" || server.category === selectedCategory;
    const matchesSearch =
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark Overlay backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Main modal container */}
      <div className="relative w-full max-w-4xl h-[85vh] bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans text-zinc-300 animate-fadeIn">
        {/* Header Section */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-[17px] font-semibold text-white tracking-wide font-sans">Connect Tools</h2>
            <p className="text-[12.5px] text-zinc-500 mt-0.5 font-sans">Integrate third-party developer apps and services directly into VoxKage</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-6 custom-chat-scrollbar">
          
          {/* POPULAR Section Row */}
          <div>
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest block mb-3.5 select-none font-sans">
              Popular
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {POPULAR_SERVERS.map((server) => {
                const isConnected = connectedServers.includes(server.id);
                return (
                  <div
                    key={server.id}
                    className="flex items-center justify-between p-3.5 bg-[#121216] border border-zinc-850 hover:border-zinc-800 rounded-xl transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {renderAppLogo(server.id)}
                      <span className="text-[14px] font-medium text-zinc-200 truncate font-sans">{server.name}</span>
                    </div>
                    {isConnected ? (
                      <button
                        type="button"
                        onClick={() => onConfigureClick(server.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
                        title="Configure integration"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onConnectClick(server.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 hover:border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
                        title="Connect application"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Directory Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mt-2 border-t border-zinc-850/50 pt-5 flex-shrink-0">
            {/* Category Tags */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 cursor-pointer font-sans ${
                    selectedCategory === cat
                      ? "bg-zinc-800 text-white font-medium"
                      : "text-zinc-450 hover:text-zinc-200 hover:bg-zinc-900/60"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input Box */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search app registry..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121216]/60 border border-zinc-850 focus:border-zinc-700/80 rounded-xl h-9 pl-9 pr-4 text-[13px] text-zinc-200 placeholder-zinc-550 focus:outline-none transition-colors font-sans"
              />
            </div>
          </div>

          {/* Dynamic MCP Directory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
            {filteredServers.length > 0 ? (
              filteredServers.map((server) => {
                const isConnected = connectedServers.includes(server.id);
                return (
                  <div
                    key={server.id}
                    className="p-5 bg-[#121216] border border-zinc-850 rounded-xl hover:border-zinc-800 transition-all duration-200 flex flex-col justify-between min-h-[140px]"
                  >
                    <div>
                      {/* Logo, Name, Badge Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {renderAppLogo(server.id)}
                          <div className="flex items-center gap-2">
                            <span className="text-[14.5px] font-semibold text-zinc-200 font-sans">{server.name}</span>
                            {server.verified && (
                              <svg className="w-3.5 h-3.5 text-blue-500 fill-blue-500/10" viewBox="0 0 24 24">
                                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                              </svg>
                            )}
                          </div>
                        </div>

                        {/* Rank Badge / Action */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500 font-medium px-2 py-0.5 rounded-full border border-zinc-850 bg-zinc-900/50 font-sans">
                            {server.rank}
                          </span>
                          {isConnected ? (
                            <button
                              type="button"
                              onClick={() => onConfigureClick(server.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-850 text-zinc-400 hover:text-white border border-transparent hover:border-zinc-800 transition-all cursor-pointer"
                              title="Configure integration"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onConnectClick(server.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-850 text-zinc-400 hover:text-white border border-transparent hover:border-zinc-800 transition-all cursor-pointer"
                              title="Connect application"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-[12.5px] text-zinc-400 leading-relaxed mt-3.5 max-w-[90%] font-sans">
                        {server.desc}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 py-10 flex flex-col items-center justify-center text-center">
                <span className="text-zinc-600 text-[14px] font-sans">No MCP servers found matching "{searchQuery}"</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
