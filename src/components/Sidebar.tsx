"use client";

import React, { useState } from "react";
import {
  Clock,
  PanelLeft,
  PanelLeftClose,
  Search,
  Plus,
  MessageSquare,
  Layers,
  Box,
  SlidersHorizontal,
  MoreHorizontal,
  Star,
  Edit3,
  Trash2,
  Settings,
  Check
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
  onOpenSearch: () => void;
  onOpenConnect: () => void;
}

const SidebarTooltip = ({ children, text, show }: { children: React.ReactNode; text: string; show: boolean }) => {
  if (!show) return <>{children}</>;
  return (
    <div className="relative group/tooltip w-full flex justify-center">
      {children}
      <div className="absolute left-[50px] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#121215]/95 border border-zinc-800 text-zinc-350 text-[11px] font-sans font-medium rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 whitespace-nowrap z-[100] backdrop-blur-md">
        {text}
      </div>
    </div>
  );
};

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
  onOpenSearch,
  onOpenConnect,
}: SidebarProps) {
  const [activePopupSessionId, setActivePopupSessionId] = useState<string | null>(null);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filterType, setFilterType] = useState<"none" | "alphabetical">("none");

  const glassBtnStyle = "border border-white/10 bg-white/5 backdrop-blur-md shadow-sm transition-all duration-200";

  return (
    <aside
      onClick={() => !isExpanded && setIsExpanded(true)}
      className={`relative flex flex-col h-screen transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none z-40 text-zinc-300 ${
        isExpanded
          ? "w-[260px] cursor-default bg-[#0e0e11] border-r border-zinc-800/85"
          : "w-[48px] cursor-pointer bg-transparent border-r border-transparent hover:bg-[#0e0e11] hover:border-zinc-800/85"
      }`}
    >
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
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 hover:filter hover:drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-all duration-200 active:scale-95 cursor-pointer"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-[18px] h-[18px]" />
              </button>
            </div>
          </>
        ) : (
          <SidebarTooltip text="Side Panel" show={true}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              className={`flex items-center justify-center w-[36px] h-[36px] rounded-lg text-zinc-100 hover:text-white hover:bg-white/10 hover:filter hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.6)] transition-all duration-200 active:scale-95 cursor-pointer ${glassBtnStyle}`}
              aria-label="Expand sidebar"
            >
              <PanelLeft className="w-[18px] h-[18px] flex-shrink-0" />
            </button>
          </SidebarTooltip>
        )}
      </div>

      {/* === MAIN CONTENT SCROLL AREA === */}
      <div className={`flex-grow py-4 flex flex-col gap-5 custom-sidebar-scrollbar w-full ${
        isExpanded ? "overflow-y-auto overflow-x-hidden" : "overflow-visible"
      }`}>
        {/* New Chat Button */}
        <div className="px-[6px] w-full text-zinc-300">
          {isExpanded ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateNewChat();
              }}
              className="flex items-center gap-3.5 w-full h-[40px] pl-[9px] rounded-full border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-100 hover:text-white transition-all duration-200 active:scale-[0.98] overflow-hidden cursor-pointer"
            >
              <Plus className="w-[18px] h-[18px] stroke-[2.5] flex-shrink-0 text-zinc-400 hover:text-white hover:filter hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.6)] transition-all duration-200" />
              <span className="text-[14.5px] font-medium tracking-wide whitespace-nowrap">New chat</span>
            </button>
          ) : (
            <SidebarTooltip text="New Chat" show={true}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateNewChat();
                }}
                className={`flex items-center justify-center w-[36px] h-[36px] rounded-full text-zinc-100 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer ${glassBtnStyle}`}
                aria-label="New chat"
              >
                <Plus className="w-[18px] h-[18px] stroke-[2.5] flex-shrink-0" />
              </button>
            </SidebarTooltip>
          )}
        </div>

        {/* Navigation Section */}
        <nav className="flex flex-col gap-1 px-[6px] w-full">
          {/* Projects Link */}
          <SidebarTooltip text="Projects" show={!isExpanded}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
              }}
              className={`flex items-center w-full rounded-xl text-zinc-400 hover:text-zinc-100 transition-all duration-200 group text-left relative overflow-hidden cursor-pointer ${
                isExpanded
                  ? "h-[40px] pl-[9px] hover:bg-white/5"
                  : `h-[36px] pl-[9px] hover:bg-white/10 ${glassBtnStyle}`
              }`}
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
          </SidebarTooltip>

          {/* Artifacts Link */}
          <SidebarTooltip text="Artifacts" show={!isExpanded}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
              }}
              className={`flex items-center w-full rounded-xl text-zinc-400 hover:text-zinc-100 transition-all duration-200 group text-left relative overflow-hidden cursor-pointer ${
                isExpanded
                  ? "h-[40px] pl-[9px] hover:bg-white/5"
                  : `h-[36px] pl-[9px] hover:bg-white/10 ${glassBtnStyle}`
              }`}
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
          </SidebarTooltip>

          {/* Skills Link */}
          <SidebarTooltip text="Skills" show={!isExpanded}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
              }}
              className={`flex items-center w-full rounded-xl text-zinc-400 hover:text-zinc-100 transition-all duration-200 group text-left relative overflow-hidden cursor-pointer ${
                isExpanded
                  ? "h-[40px] pl-[9px] hover:bg-white/5"
                  : `h-[36px] pl-[9px] hover:bg-white/10 ${glassBtnStyle}`
              }`}
            >
              {/* Premium Skills SVG: Shield with star */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0 transition-all duration-200 group-hover:text-white"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8l1.5 3h3l-2.25 1.8 1 3.2-3.25-2-3.25 2 1-3.2L6.5 11h3.25L12 8z" fill="currentColor" fillOpacity="0.1" />
              </svg>
              <span
                className={`ml-3.5 text-[14.5px] font-medium whitespace-nowrap transition-all duration-300 ${
                  isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
                }`}
              >
                Skills
              </span>
            </button>
          </SidebarTooltip>

          {/* Connect Link */}
          <SidebarTooltip text="Connect With tools" show={!isExpanded}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenConnect();
              }}
              className={`flex items-center w-full rounded-xl text-zinc-400 hover:text-zinc-100 transition-all duration-200 group text-left relative overflow-hidden cursor-pointer ${
                isExpanded
                  ? "h-[40px] pl-[9px] hover:bg-white/5"
                  : `h-[36px] pl-[9px] hover:bg-white/10 ${glassBtnStyle}`
              }`}
            >
              {/* Premium Suitcase SVG */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0 transition-all duration-200 group-hover:text-white"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                <path d="M2 12h20" />
                <circle cx="12" cy="12" r="1.2" fill="currentColor" />
              </svg>
              <span
                className={`ml-3.5 text-[14.5px] font-medium whitespace-nowrap transition-all duration-300 ${
                  isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
                }`}
              >
                Connect
              </span>
            </button>
          </SidebarTooltip>
        </nav>

        {/* Recents Chats Section (Only visible when expanded) */}
        {isExpanded && (() => {
          const starredSessions = sessionsList.filter((s) => s.is_starred && !s.is_scheduled);
          let recentSessions = sessionsList.filter((s) => !s.is_starred && !s.is_scheduled);
          const scheduledSessions = sessionsList.filter((s) => s.is_scheduled);
          if (filterType === "alphabetical") {
            recentSessions = [...recentSessions].sort((a, b) => a.name.localeCompare(b.name));
          }

          const renderSessionItem = (session: any) => {
            const isActive = session.id === currentSessionId;
            const isStarred = session.is_starred;
            
            return (
              <div key={session.id} className="relative group w-full mb-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSession(session.id);
                  }}
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
              {/* Starred section */}
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

              {/* Scheduled section */}
              {scheduledSessions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-semibold tracking-wider uppercase select-none">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>Schedule Sessions</span>
                  </div>
                  <div className="flex flex-col gap-0.5 -mx-3">
                    {scheduledSessions.map((session) => renderSessionItem(session))}
                  </div>
                </div>
              )}

              {/* Recents section */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-zinc-500 text-[11px] font-semibold tracking-wider uppercase select-none">
                  <span>Recents</span>
                  <div className="flex items-center gap-1.5 relative">
                    {/* Search Lens Icon */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSearch();
                      }}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer p-0.5"
                      aria-label="Search chats"
                      title="Search Chats"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>

                    {/* Filter Icon */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowFilterMenu(!showFilterMenu);
                      }}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer p-0.5"
                      aria-label="Filter recents"
                      title="Filter Chats"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {/* Filter Popup Menu */}
                    {showFilterMenu && (
                      <>
                        <div 
                          className="fixed inset-0 z-40 cursor-default" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFilterMenu(false);
                          }}
                        />
                        <div className="absolute right-0 top-full mt-1.5 w-[170px] bg-[#121215] border border-zinc-800 rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-0.5 animate-fadeIn normal-case font-normal text-zinc-350">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterType("none");
                              setShowFilterMenu(false);
                            }}
                            className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-[13px] text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                          >
                            <span>None</span>
                            {filterType === "none" && (
                              <Check className="w-3.5 h-3.5 text-blue-500 stroke-[3]" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterType("alphabetical");
                              setShowFilterMenu(false);
                            }}
                            className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-[13px] text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                          >
                            <span>Alphabetical order</span>
                            {filterType === "alphabetical" && (
                              <Check className="w-3.5 h-3.5 text-blue-500 stroke-[3]" />
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
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
        className="mt-auto border-t border-zinc-800/80 p-2.5 flex flex-col gap-2.5 items-center w-full"
      >
        {!isExpanded ? (
          <SidebarTooltip text="Settings" show={true}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings();
              }}
              className={`w-[36px] h-[36px] rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-all duration-200 cursor-pointer ${glassBtnStyle}`}
              aria-label="Settings"
            >
              <Settings className="w-[16px] h-[16px]" />
            </button>
          </SidebarTooltip>
        ) : (
          <div className="relative flex items-center w-full pl-[9px]">
            {/* Avatar */}
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 text-[13px] font-semibold border border-zinc-700/40 flex-shrink-0 select-none">
              A
            </div>

            {/* User info */}
            <div
              className={`flex flex-col text-left ml-3.5 transition-all duration-300 ${
                isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none absolute"
              }`}
            >
              <span className="text-[13.5px] font-medium text-zinc-200">Ayush</span>
              <span className="text-[11px] text-zinc-500 font-normal">Free plan</span>
            </div>

            {/* Actions (Settings only) */}
            <div
              className={`flex items-center ml-auto pr-2 transition-opacity duration-300 ${
                isExpanded ? "opacity-100" : "opacity-0 pointer-events-none absolute"
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings();
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-white/5 hover:filter hover:drop-shadow-[0_0_4px_rgba(255,255,255,0.5)] transition-all duration-200 cursor-pointer"
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
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
