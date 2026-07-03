"use client";

import React, { useState } from "react";
import {
  PanelLeft,
  PanelLeftClose,
  Search,
  Plus,
  MessageSquare,
  Layers,
  Box,
  Code,
  Briefcase,
  SlidersHorizontal,
  Download,
  ChevronsUpDown,
  MoreHorizontal,
  Star,
  Edit3,
  Trash2,
  Settings
} from "lucide-react";

interface SidebarProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  currentSessionId: string | null;
  onSelectSession: (id: string | null) => void;
  sessionsList: any[];
  onCreateNewChat: () => void;
  onLogout: () => void;
  onToggleStar: (sessionId: string, starred: boolean) => void;
  onRenameSession: (sessionId: string, currentName: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenSettings: () => void;
  connectionStatus: "connected" | "connecting" | "disconnected";
}

export default function Sidebar({
  isExpanded,
  setIsExpanded,
  currentSessionId,
  onSelectSession,
  sessionsList,
  onCreateNewChat,
  onLogout,
  onToggleStar,
  onRenameSession,
  onDeleteSession,
  onOpenSettings,
  connectionStatus,
}: SidebarProps) {
  const [activePopupSessionId, setActivePopupSessionId] = useState<string | null>(null);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);

  return (
    <aside
      className={`relative flex flex-col h-screen bg-[#0e0e11] border-r border-zinc-800/85 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none z-40 text-zinc-300 ${
        isExpanded ? "w-[260px]" : "w-[48px]"
      }`}
    >
      {/* Invisible overlay to capture click when collapsed */}
      {!isExpanded && (
        <div
          onClick={() => setIsExpanded(true)}
          className="absolute inset-0 z-50 cursor-pointer"
          aria-label="Expand sidebar"
        />
      )}

      {/* === HEADER === */}
      <div
        className={`flex items-center h-[60px] border-b border-transparent relative w-full ${
          isExpanded ? "pl-5 pr-4 justify-between" : "pl-[6px]"
        }`}
      >
        {isExpanded ? (
          <>
            <div className="flex items-center gap-1.5 animate-fadeIn">
              <span className="text-zinc-100 text-lg font-light tracking-[0.03em] font-sans select-none">
                VoxKage
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 hover:filter hover:drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-all duration-200"
                aria-label="Search chats"
              >
                <Search className="w-[17px] h-[17px]" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 hover:filter hover:drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-all duration-200 active:scale-95"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-[18px] h-[18px]" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="flex items-center justify-center w-[36px] h-[36px] rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 hover:filter hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.6)] transition-all duration-200 active:scale-95"
            aria-label="Expand sidebar"
          >
            <PanelLeft className="w-[18px] h-[18px] flex-shrink-0" />
          </button>
        )}
      </div>

      {/* === MAIN CONTENT SCROLL AREA === */}
      <div className="flex-grow overflow-y-auto overflow-x-hidden py-4 flex flex-col gap-5 custom-sidebar-scrollbar w-full">
        {/* New Chat Button */}
        <div className="px-[6px] w-full text-zinc-300">
          {isExpanded ? (
            <button
              type="button"
              onClick={onCreateNewChat}
              className="flex items-center gap-3.5 w-full h-[40px] pl-[9px] rounded-full border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-100 hover:text-white transition-all duration-200 active:scale-[0.98] overflow-hidden cursor-pointer"
            >
              <Plus className="w-[18px] h-[18px] stroke-[2.5] flex-shrink-0 text-zinc-400 hover:text-white hover:filter hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.6)] transition-all duration-200" />
              <span className="text-[14.5px] font-medium tracking-wide whitespace-nowrap">New chat</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onCreateNewChat}
              className="flex items-center justify-center w-[36px] h-[36px] rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:text-white hover:bg-zinc-800 transition-all duration-200 cursor-pointer"
              aria-label="New chat"
            >
              <Plus className="w-[18px] h-[18px] stroke-[2.5] flex-shrink-0" />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <nav className="flex flex-col gap-0.5 px-[6px] w-full">
          {/* Chats Link */}
          <button
            type="button"
            className="flex items-center w-full h-[40px] pl-[9px] rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-all duration-200 group text-left relative overflow-hidden"
          >
            <MessageSquare className="w-[18px] h-[18px] stroke-[2.2] flex-shrink-0 transition-all duration-200 group-hover:text-white group-hover:filter group-hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.65)]" />
            <span
              className={`ml-3.5 text-[14.5px] font-medium whitespace-nowrap transition-all duration-300 ${
                isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
              }`}
            >
              Chats
            </span>
          </button>

          {/* Projects Link */}
          <button
            type="button"
            className="flex items-center w-full h-[40px] pl-[9px] rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-all duration-200 group text-left relative overflow-hidden"
          >
            <Layers className="w-[18px] h-[18px] stroke-[2.2] flex-shrink-0 transition-all duration-200 group-hover:text-white group-hover:filter group-hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.65)]" />
            <span
              className={`ml-3.5 text-[14.5px] font-medium whitespace-nowrap transition-all duration-300 ${
                isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
              }`}
            >
              Projects
            </span>
          </button>

          {/* Artifacts Link */}
          <button
            type="button"
            className="flex items-center w-full h-[40px] pl-[9px] rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-all duration-200 group text-left relative overflow-hidden"
          >
            <Box className="w-[18px] h-[18px] stroke-[2.2] flex-shrink-0 transition-all duration-200 group-hover:text-white group-hover:filter group-hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.65)]" />
            <span
              className={`ml-3.5 text-[14.5px] font-medium whitespace-nowrap transition-all duration-300 ${
                isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
              }`}
            >
              Artifacts
            </span>
          </button>

          {/* Code Link */}
          <button
            type="button"
            className="flex items-center w-full h-[40px] pl-[9px] rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-all duration-200 group text-left relative overflow-hidden"
          >
            <Code className="w-[18px] h-[18px] stroke-[2.2] flex-shrink-0 transition-all duration-200 group-hover:text-white group-hover:filter group-hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.65)]" />
            <div
              className={`ml-3.5 flex items-center justify-between flex-grow transition-all duration-300 ${
                isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
              }`}
            >
              <span className="text-[14.5px] font-medium whitespace-nowrap">Code</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800/80 text-zinc-400 border border-zinc-700/30 group-hover:border-zinc-700/50 group-hover:text-zinc-300 transition-all duration-200 mr-2">
                Upgrade
              </span>
            </div>
          </button>

          {/* Customize Link */}
          <button
            type="button"
            className="flex items-center w-full h-[40px] pl-[9px] rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-all duration-200 group text-left relative overflow-hidden"
          >
            <Briefcase className="w-[18px] h-[18px] stroke-[2.2] flex-shrink-0 transition-all duration-200 group-hover:text-white group-hover:filter group-hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.65)]" />
            <span
              className={`ml-3.5 text-[14.5px] font-medium whitespace-nowrap transition-all duration-300 ${
                isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
              }`}
            >
              Customize
            </span>
          </button>
        </nav>

        {/* Recents Chats Section (Only visible when expanded) */}
        {isExpanded && (() => {
          const starredSessions = sessionsList.filter((s) => s.is_starred);
          const recentSessions = sessionsList.filter((s) => !s.is_starred);

          const renderSessionItem = (session: any) => {
            const isActive = session.id === currentSessionId;
            const isStarred = session.is_starred;
            
            return (
              <div key={session.id} className="relative group w-full mb-1">
                <button
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full flex items-center justify-between py-2.5 px-4 rounded-xl text-[14.5px] cursor-pointer transition-all duration-150 relative ${
                    isActive
                      ? "bg-[#18181c] text-white font-medium border border-zinc-800"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-6">
                    {isStarred && (
                      <Star className="w-3.5 h-3.5 fill-white text-white flex-shrink-0" />
                    )}
                    <span className="truncate">{session.name}</span>
                  </div>
                </button>
                
                {/* Three dots on hover */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePopupSessionId(activePopupSessionId === session.id ? null : session.id);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-150 cursor-pointer z-10"
                  aria-label="Session actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {/* Dropdown Options Popup */}
                {activePopupSessionId === session.id && (
                  <>
                    {/* Click-away backdrop */}
                    <div 
                      className="fixed inset-0 z-45 cursor-default" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePopupSessionId(null);
                        setConfirmDeleteSessionId(null);
                      }}
                    />

                    {confirmDeleteSessionId === session.id ? (
                      /* ── Delete confirmation inline ── */
                      <div className="absolute right-2 top-[38px] w-[196px] bg-[#121215] border border-zinc-700/60 rounded-xl p-3 shadow-2xl z-50 flex flex-col gap-3 animate-fadeIn">
                        <p className="text-[12.5px] text-zinc-300 leading-snug">
                          Delete <span className="font-semibold text-white">&ldquo;{session.name}&rdquo;</span>?{" "}
                          <span className="text-zinc-500">This can&apos;t be undone.</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteSessionId(null);
                              setActivePopupSessionId(null);
                            }}
                            className="flex-1 py-1.5 rounded-lg text-[12px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-zinc-700/40 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteSessionId(null);
                              setActivePopupSessionId(null);
                              onDeleteSession(session.id);
                            }}
                            className="flex-1 py-1.5 rounded-lg text-[12px] font-medium text-white bg-red-600/80 hover:bg-red-600 border border-red-500/30 transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Normal options menu ── */
                      <div className="absolute right-2 top-[38px] w-[140px] bg-[#121215] border border-zinc-800 rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-0.5 animate-fadeIn">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStar(session.id, !isStarred);
                            setActivePopupSessionId(null);
                          }}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                        >
                          <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-white text-white" : "text-zinc-400"}`} />
                          <span>{isStarred ? "Remove Star" : "Star"}</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePopupSessionId(null);
                            onRenameSession(session.id, session.name);
                          }}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Rename</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteSessionId(session.id);
                          }}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors text-left cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          };

          return (
            <div className="flex flex-col gap-5 px-5 mt-2 transition-opacity duration-300">
              {/* Starred section (only visible if there are starred sessions) */}
              {starredSessions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center text-zinc-500 text-[11px] font-semibold tracking-wider uppercase select-none">
                    <span>Starred</span>
                  </div>
                  <div className="flex flex-col gap-0.5 -mx-3">
                    {starredSessions.map((session) => renderSessionItem(session))}
                  </div>
                </div>
              )}

              {/* Recents section */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-zinc-500 text-[11px] font-semibold tracking-wider uppercase select-none">
                  <span>Recents</span>
                  <button
                    type="button"
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    aria-label="Filter recents"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-0.5 -mx-3">
                  {recentSessions.map((session) => renderSessionItem(session))}
                  {recentSessions.length === 0 && starredSessions.length === 0 && (
                    <span className="text-[12.5px] text-zinc-600 px-3 py-1 font-sans">
                      No active chats
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* === FOOTER USER SECTION === */}
      <div
        className={`mt-auto border-t border-zinc-800/80 p-2.5 flex flex-col gap-2.5 items-center w-full`}
      >
        {/* Download App button stacked when collapsed */}
        {!isExpanded && (
          <button
            type="button"
            className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-white/5 hover:filter hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.6)] transition-all duration-200"
            aria-label="Download app"
          >
            <Download className="w-[16px] h-[16px]" />
          </button>
        )}

        <div className={`relative flex items-center w-full ${isExpanded ? "pl-1" : "justify-center pl-0"}`}>
          {/* Avatar (Static horizontal center of 24px) */}
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 text-[13px] font-semibold border border-zinc-700/40 flex-shrink-0 select-none">
            A
          </div>

          {/* User info (Fades in) */}
          <div
            className={`flex flex-col text-left ml-3.5 transition-all duration-300 ${
              isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none absolute"
            }`}
          >
            <span className="text-[13.5px] font-medium text-zinc-200">Ayush</span>
            <span className="text-[11px] text-zinc-500 font-normal">Free plan</span>
          </div>

          {/* Action buttons (Fades in on the right) */}
          <div
            className={`flex items-center gap-1.5 ml-auto transition-opacity duration-300 ${
              isExpanded ? "opacity-100" : "opacity-0 pointer-events-none absolute"
            }`}
          >
            <button
              type="button"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-white/5 hover:filter hover:drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-all duration-200"
              aria-label="Download app"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-white/5 hover:filter hover:drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-all duration-200 cursor-pointer"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-white/5 hover:filter hover:drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-all duration-200 cursor-pointer"
              aria-label="Logout"
              title="Logout"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* CSS Scrollbar & Fade-in Animations */}
      <style>{`
        .custom-sidebar-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-sidebar-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-sidebar-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 99px;
        }
        .custom-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.16);
        }
        .animate-fadeIn {
          animation: fadeIn 0.25s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </aside>
  );
}
