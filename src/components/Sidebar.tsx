"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Check,
  Palette,
  User,
  Moon,
  Sun,
  Monitor,
  LogOut,
  ChevronRight
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
  onOpenProfile: () => void;
  connectionStatus: "connected" | "connecting" | "disconnected";
  onOpenSearch: () => void;
  onOpenConnect: () => void;
  isChatActive?: boolean;
  userName?: string;
  userAvatarUrl?: string;
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
  onOpenProfile,
  connectionStatus,
  onOpenSearch,
  onOpenConnect,
  isChatActive = false,
  userName = "Ayush",
  userAvatarUrl = "",
}: SidebarProps) {
  const [activePopupSessionId, setActivePopupSessionId] = useState<string | null>(null);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filterType, setFilterType] = useState<"none" | "alphabetical">("none");

  // User Profile Popover States
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAppearanceMenu, setShowAppearanceMenu] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("dark");

  const glassBtnStyle = "border border-white/10 bg-white/5 backdrop-blur-md shadow-sm transition-all duration-200";

  // Touch Swipe to close drawer on mobile
  const touchStartXRef = React.useRef<number | null>(null);

  // Outside-click detection for User Profile Popover
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showUserMenu) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
        setShowAppearanceMenu(false);
        setShowSignOutConfirm(false);
        if (typeof window !== "undefined" && window.innerWidth < 768) {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [showUserMenu]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const autoCloseMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsExpanded(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const diffX = currentX - touchStartXRef.current;
    if (diffX < -50 && isExpanded) {
      setIsExpanded(false);
      touchStartXRef.current = null;
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        onClick={() => {
          setIsExpanded(false);
          setShowUserMenu(false);
          setShowAppearanceMenu(false);
          setShowSignOutConfirm(false);
        }}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${
          isExpanded ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />


      <aside
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onClick={() => !isExpanded && setIsExpanded(true)}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col h-full bg-[#0e0e11] border-r border-zinc-800/85 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none text-zinc-300 shadow-2xl md:shadow-none md:relative md:h-screen ${
          isExpanded
            ? "w-[280px] max-w-[85vw] md:w-[260px] translate-x-0 cursor-default"
            : "-translate-x-full md:translate-x-0 md:w-[48px] cursor-pointer bg-transparent border-transparent md:hover:bg-[#0e0e11] md:hover:border-zinc-800/85"
        }`}
      >
      {/* === TOP STICKY HEADER & NAVIGATION === */}
      <div className="flex flex-col flex-shrink-0 w-full">
          {/* Header Title & Collapse */}
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
                  className={`flex items-center justify-center w-[36px] h-[36px] rounded-lg text-zinc-100 hover:text-white transition-all duration-200 active:scale-95 cursor-pointer ${
                    isChatActive
                      ? "bg-[#141418] border border-zinc-700/80 shadow-md md:border-white/10 md:bg-white/5 md:backdrop-blur-md"
                      : glassBtnStyle
                  }`}
                  aria-label="Expand sidebar"
                >
                  <PanelLeft className="w-[18px] h-[18px] flex-shrink-0" />
                </button>
              </SidebarTooltip>
            )}
          </div>

          {/* Navigation Items (New Chat, Projects, Artifacts, Skills, Connect) */}
          <div className="py-2 flex flex-col gap-4 w-full">
            {/* New Chat Button */}
            <div className="px-[6px] w-full text-zinc-300">
              {isExpanded ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateNewChat();
                    autoCloseMobile();
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
                      autoCloseMobile();
                    }}
                    className={`flex items-center justify-center w-[36px] h-[36px] rounded-full text-zinc-100 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer ${glassBtnStyle}`}
                    aria-label="New chat"
                  >
                    <Plus className="w-[18px] h-[18px] stroke-[2.5] flex-shrink-0" />
                  </button>
                </SidebarTooltip>
              )}
            </div>

            {/* Navigation Links Section */}
            <nav className="flex flex-col gap-1 px-[6px] w-full">
              {/* Projects Link */}
              <SidebarTooltip text="Projects" show={!isExpanded}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className={`flex items-center rounded-xl text-zinc-400 hover:text-zinc-100 transition-colors duration-150 group text-left relative cursor-pointer ${
                    isExpanded ? "w-full h-[36px] pl-[9px] hover:bg-white/5" : "w-[36px] h-[36px] justify-center hover:bg-white/10"
                  }`}
                  aria-label="Projects"
                >
                  <Layers className="w-[18px] h-[18px] flex-shrink-0 transition-colors duration-150 group-hover:text-white" />
                  {isExpanded && (
                    <span className="ml-3.5 text-[14.5px] font-medium whitespace-nowrap">
                      Projects
                    </span>
                  )}
                </button>
              </SidebarTooltip>

              {/* Artifacts Link */}
              <SidebarTooltip text="Artifacts" show={!isExpanded}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className={`flex items-center rounded-xl text-zinc-400 hover:text-zinc-100 transition-colors duration-150 group text-left relative cursor-pointer ${
                    isExpanded ? "w-full h-[36px] pl-[9px] hover:bg-white/5" : "w-[36px] h-[36px] justify-center hover:bg-white/10"
                  }`}
                  aria-label="Artifacts"
                >
                  <Box className="w-[18px] h-[18px] flex-shrink-0 transition-colors duration-150 group-hover:text-white" />
                  {isExpanded && (
                    <span className="ml-3.5 text-[14.5px] font-medium whitespace-nowrap">
                      Artifacts
                    </span>
                  )}
                </button>
              </SidebarTooltip>

              {/* Skills Link */}
              <SidebarTooltip text="Skills" show={!isExpanded}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className={`flex items-center rounded-xl text-zinc-400 hover:text-zinc-100 transition-colors duration-150 group text-left relative cursor-pointer ${
                    isExpanded ? "w-full h-[36px] pl-[9px] hover:bg-white/5" : "w-[36px] h-[36px] justify-center hover:bg-white/10"
                  }`}
                  aria-label="Skills"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="flex-shrink-0 transition-colors duration-150 group-hover:text-white"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  {isExpanded && (
                    <span className="ml-3.5 text-[14.5px] font-medium whitespace-nowrap">
                      Skills
                    </span>
                  )}
                </button>
              </SidebarTooltip>

              {/* Connect Link */}
              <SidebarTooltip text="Connect" show={!isExpanded}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenConnect();
                    autoCloseMobile();
                  }}
                  className={`flex items-center rounded-xl text-zinc-400 hover:text-zinc-100 transition-colors duration-150 group text-left relative cursor-pointer ${
                    isExpanded ? "w-full h-[36px] pl-[9px] hover:bg-white/5" : "w-[36px] h-[36px] justify-center hover:bg-white/10"
                  }`}
                  aria-label="Connect"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="flex-shrink-0 transition-colors duration-150 group-hover:text-white"
                  >
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    <path d="M2 12h20" />
                    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
                  </svg>
                  {isExpanded && (
                    <span className="ml-3.5 text-[14.5px] font-medium whitespace-nowrap">
                      Connect
                    </span>
                  )}
                </button>
              </SidebarTooltip>
            </nav>
          </div>
        </div>

        {/* === RECENTS CHATS SCROLLABLE AREA === */}
        {isExpanded && (() => {
          const starredSessions = sessionsList.filter((s) => s.is_starred && !s.is_scheduled);
          let recentSessions = sessionsList.filter((s) => !s.is_starred && !s.is_scheduled);
          const scheduledSessions = sessionsList.filter((s) => s.is_scheduled);
          if (filterType === "alphabetical") {
            recentSessions = [...recentSessions].sort((a, b) => a.name.localeCompare(b.name));
          }

          const renderSessionItem = (session: any, isNearBottom = false) => {
            const isActive = session.id === currentSessionId;
            const isStarred = session.is_starred;
            const popupPosClass = isNearBottom ? "bottom-[38px]" : "top-[38px]";
            
            return (
              <div key={session.id} className="relative group w-full mb-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSession(session.id);
                    autoCloseMobile();
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
                
                {/* Three dots on hover (or always visible on mobile) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePopupSessionId(activePopupSessionId === session.id ? null : session.id);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-150 cursor-pointer z-10"
                  aria-label="Session actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {/* Dropdown Options Popup */}
                {activePopupSessionId === session.id && (
                  <>
                    <div 
                      className="fixed inset-0 z-45 cursor-default" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePopupSessionId(null);
                        setConfirmDeleteSessionId(null);
                      }}
                    />

                    {confirmDeleteSessionId === session.id ? (
                      <div className={`absolute right-2 ${popupPosClass} w-[196px] bg-[#121215] border border-zinc-700/60 rounded-xl p-3 shadow-2xl z-50 flex flex-col gap-3 animate-fadeIn`}>
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
                      <div className={`absolute right-2 ${popupPosClass} w-[140px] bg-[#121215] border border-zinc-800 rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-0.5 animate-fadeIn`}>
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
            <div className="flex-grow flex flex-col min-h-0 w-full pt-2">
              <div className="flex-grow overflow-y-auto overflow-x-hidden custom-sidebar-scrollbar px-5 flex flex-col gap-5">
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

                <div className="flex flex-col gap-2 pb-4">
                  <div className="flex items-center justify-between text-zinc-500 text-[11px] font-semibold tracking-wider uppercase select-none sticky top-0 bg-[#0e0e11] py-1 z-20">
                    <span>Recents</span>
                    <div className="flex items-center gap-1.5 relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSearch();
                          autoCloseMobile();
                        }}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer p-0.5"
                        aria-label="Search chats"
                        title="Search Chats"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
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

                      {showFilterMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowFilterMenu(false);
                            }}
                          />
                          <div className="absolute right-0 top-6 w-[150px] bg-[#121215] border border-zinc-800 rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-0.5 animate-fadeIn">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFilterType("none");
                                setShowFilterMenu(false);
                              }}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
                            >
                              <span>Default (Date)</span>
                              {filterType === "none" && <Check className="w-3.5 h-3.5 text-blue-400" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFilterType("alphabetical");
                                setShowFilterMenu(false);
                              }}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5">
                                <Palette className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Alphabetical</span>
                              </div>
                              {filterType === "alphabetical" && <Check className="w-3.5 h-3.5 text-blue-400" />}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 -mx-3">
                  {recentSessions.map((session, index) => {
                    const isNearBottom = index >= recentSessions.length - 2;
                    return renderSessionItem(session, isNearBottom);
                  })}
                  {recentSessions.length === 0 && starredSessions.length === 0 && (
                    <span className="text-[12.5px] text-zinc-600 px-3 py-1 font-sans">
                      No active chats
                    </span>
                  )}
                </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* === FOOTER USER SECTION === */}
      <div className="relative mt-auto border-t border-zinc-800/80 p-2.5 flex flex-col gap-2.5 items-center w-full flex-shrink-0">
        {/* User Profile Popover Menu */}
        {showUserMenu && (
          <>
            <div
              ref={userMenuRef}
              className={`absolute bottom-[56px] ${
                isExpanded ? "left-3.5 w-[232px]" : "left-2 w-[220px]"
              } bg-[#141418] border border-zinc-800 rounded-2xl p-1.5 shadow-2xl z-[130] flex flex-col gap-1 font-sans text-zinc-300 animate-fadeIn`}
            >
              {/* Profile Header */}
              <div className="flex items-center gap-3 px-2.5 py-2.5 border-b border-zinc-800/80 mb-0.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-zinc-200 text-[14px] font-semibold border border-zinc-700/50 flex-shrink-0 select-none">
                  {userName ? userName.charAt(0).toUpperCase() : "A"}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-[14px] font-medium text-white truncate">
                    {userName || "Ayush Dwivedi"}
                  </span>
                </div>
              </div>

              {/* Menu Items */}
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenProfile();
                }}
                className="flex items-center gap-3 px-2.5 py-2 rounded-xl text-[13.5px] text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
              >
                <User className="w-4 h-4 text-zinc-400" />
                <span>Profile</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenSettings();
                }}
                className="flex items-center gap-3 px-2.5 py-2 rounded-xl text-[13.5px] text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
              >
                <Settings className="w-4 h-4 text-zinc-400" />
                <span>Settings</span>
              </button>

              {/* Appearance Submenu Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAppearanceMenu(!showAppearanceMenu)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[13.5px] text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Moon className="w-4 h-4 text-zinc-400" />
                    <span>Appearance</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </button>

                {showAppearanceMenu && (
                  <div className="absolute left-full bottom-0 ml-1.5 w-[140px] bg-[#141418] border border-zinc-800 rounded-xl p-1 shadow-2xl z-[110] flex flex-col gap-0.5 animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => {
                        setThemeMode("light");
                        setShowAppearanceMenu(false);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Sun className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Light</span>
                      </div>
                      {themeMode === "light" && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setThemeMode("dark");
                        setShowAppearanceMenu(false);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Moon className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Dark</span>
                      </div>
                      {themeMode === "dark" && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setThemeMode("system");
                        setShowAppearanceMenu(false);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12.5px] text-zinc-300 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Monitor className="w-3.5 h-3.5 text-zinc-400" />
                        <span>System</span>
                      </div>
                      {themeMode === "system" && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-800/80 my-0.5" />

              {/* Sign out section with Inline Are You Sure popup */}
              {showSignOutConfirm ? (
                <div className="p-2 bg-red-950/20 border border-red-500/30 rounded-xl flex flex-col gap-2 my-0.5 animate-fadeIn">
                  <span className="text-[12px] text-zinc-200 text-center font-medium">
                    Are you sure?
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowSignOutConfirm(false)}
                      className="flex-1 py-1 rounded-lg border border-zinc-700 text-[11.5px] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSignOutConfirm(false);
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="flex-1 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11.5px] font-medium transition-colors cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSignOutConfirm(true)}
                  className="flex items-center gap-3 px-2.5 py-2 rounded-xl text-[13.5px] text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                  <span>Sign out</span>
                </button>
              )}
            </div>
          </>
        )}

        {!isExpanded ? (
          <SidebarTooltip text={userName || "Account"} show={true}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
              }}
              className="w-9 h-9 min-w-[36px] min-h-[36px] aspect-square rounded-full bg-zinc-800 text-zinc-200 text-[13.5px] font-semibold border border-zinc-700/50 hover:border-zinc-500 flex items-center justify-center flex-shrink-0 transition-all duration-200 cursor-pointer select-none"
              aria-label="User profile"
            >
              {userName ? userName.charAt(0).toUpperCase() : "A"}
            </button>
          </SidebarTooltip>
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setShowUserMenu(!showUserMenu);
            }}
            className="relative flex items-center w-full pl-[7px] py-1 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
          >
            {/* Avatar */}
            <div className="w-9 h-9 min-w-[36px] min-h-[36px] aspect-square flex-shrink-0 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200 text-sm font-medium shadow-sm transition-transform duration-200 group-hover:scale-105 overflow-hidden">
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt={userName || "User"} className="w-full h-full object-cover" />
              ) : (
                <span>{userName ? userName.charAt(0).toUpperCase() : "A"}</span>
              )}
            </div>

            {/* User info without Free plan text */}
            <div
              className={`flex flex-col text-left ml-3 transition-all duration-300 ${
                isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none absolute"
              }`}
            >
              <span className="text-[13.5px] font-medium text-zinc-200 truncate max-w-[130px]">
                {userName || "Ayush"}
              </span>
            </div>

            {/* Actions (Settings only) */}
            <div
              className={`flex items-center ml-auto pr-1 transition-opacity duration-300 ${
                isExpanded ? "opacity-100" : "opacity-0 pointer-events-none absolute"
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserMenu(!showUserMenu);
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-white/10 transition-all duration-200 cursor-pointer"
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
    </>
  );
}
