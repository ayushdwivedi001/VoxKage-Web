"use client";

import React from "react";
import { Search, X, MessageSquare } from "lucide-react";

interface SearchModalProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sessionsList: any[];
  searchSelectedIndex: number;
  setSearchSelectedIndex: (idx: number | ((prev: number) => number)) => void;
  onSelectSession: (id: string | null) => void;
  onClose: () => void;
  getRelativeTime: (dateStr: string) => string;
}

export default function SearchModal({
  searchQuery,
  setSearchQuery,
  sessionsList,
  searchSelectedIndex,
  setSearchSelectedIndex,
  onSelectSession,
  onClose,
  getRelativeTime,
}: SearchModalProps) {
  const filteredSearchSessions = sessionsList.filter((session) =>
    session.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchSelectedIndex((prev) =>
        Math.min(prev + 1, filteredSearchSessions.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredSearchSessions[searchSelectedIndex]) {
        onSelectSession(filteredSearchSessions[searchSelectedIndex].id);
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[15vh]">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
      />
      <div className="relative w-full max-w-xl bg-[#121216] border border-zinc-800 rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden font-sans text-zinc-300 animate-fadeIn">
        {/* Search Input Box */}
        <div className="relative flex items-center border-b border-zinc-800/80">
          <Search className="absolute left-4 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchSelectedIndex(0);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search chats and projects"
            className="w-full bg-transparent h-14 pl-11 pr-11 focus:outline-none text-[14.5px] text-zinc-100 placeholder-zinc-500"
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-355 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-grow max-h-[350px] overflow-y-auto p-2 flex flex-col gap-0.5 custom-chat-scrollbar">
          {filteredSearchSessions.map((session, index) => {
            const isSelected = index === searchSelectedIndex;
            const relativeTime = getRelativeTime(session.updated_at);

            return (
              <div
                key={session.id}
                onClick={() => {
                  onSelectSession(session.id);
                  onClose();
                }}
                onMouseEnter={() => setSearchSelectedIndex(index)}
                className={`w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl cursor-pointer transition-all duration-150 select-none ${
                  isSelected
                    ? "bg-[#18181c] text-white font-medium border border-zinc-800/50"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-6">
                  <MessageSquare
                    className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-white" : "text-zinc-500"}`}
                  />
                  <span className="truncate text-[13.5px]">{session.name}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isSelected ? (
                    <span className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">
                      Enter
                    </span>
                  ) : (
                    <span className="text-[10.5px] text-zinc-500 font-normal">{relativeTime}</span>
                  )}
                </div>
              </div>
            );
          })}
          {filteredSearchSessions.length === 0 && (
            <div className="text-center py-8 text-[13px] text-zinc-500">No matching chats found</div>
          )}
        </div>
      </div>
    </div>
  );
}
