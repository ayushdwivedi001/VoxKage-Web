"use client";

import React, { useState, useEffect, useRef } from "react";
import { ExternalLink, X, Image as ImageIcon, Sparkles, ChevronLeft, ChevronRight, Search, ChevronDown } from "lucide-react";
import { BACKEND_URL } from "@/lib/api";

export interface DuckDuckGoImageItem {
  id?: string;
  title: string;
  image_url: string;
  thumbnail_url: string;
  source_url: string;
  domain: string;
  width: number;
  height: number;
}

interface DuckDuckGoImageWidgetProps {
  query: string;
  isExpanded?: boolean;
}

export default function DuckDuckGoImageWidget({ query, isExpanded = false }: DuckDuckGoImageWidgetProps) {
  const [engine, setEngine] = useState<"ddg" | "pinterest">("ddg");
  const [isEngineDropdownOpen, setIsEngineDropdownOpen] = useState(false);
  const [activeQuery, setActiveQuery] = useState(query);
  const [searchInputValue, setSearchInputValue] = useState(query);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<DuckDuckGoImageItem[]>([]);
  const [pills, setPills] = useState<string[]>([]);
  const [activePill, setActivePill] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<DuckDuckGoImageItem | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsEngineDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Purge all legacy image cache keys on mount so stale data never persists
  useEffect(() => {
    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("vk_img_")) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error("SessionStorage purge notice:", e);
    }
  }, []);

  const fetchImages = async (searchQuery: string, targetEngine: "ddg" | "pinterest" = engine) => {
    const cleanQ = searchQuery.trim();
    if (!cleanQ) return;

    setLoading(true);
    try {
      const endpoint = targetEngine === "pinterest" 
        ? `${BACKEND_URL}/api/search/pinterest?query=${encodeURIComponent(cleanQ)}&limit=24`
        : `${BACKEND_URL}/api/search/images?query=${encodeURIComponent(cleanQ)}&limit=24`;

      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const resImages = data.images || [];
        setImages(resImages);
        if (data.pills?.length > 0) setPills(data.pills);
      } else {
        setImages([]);
      }
    } catch (err) {
      console.error("Image search error:", err);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query) {
      setActiveQuery(query);
      setSearchInputValue(query);
      fetchImages(query, engine);
    }
  }, [query]);

  const handleEngineSwitch = (newEngine: "ddg" | "pinterest") => {
    if (newEngine === engine) {
      setIsEngineDropdownOpen(false);
      return;
    }
    setEngine(newEngine);
    setIsEngineDropdownOpen(false);
    fetchImages(activeQuery, newEngine);
  };

  const handleCustomSearchSubmit = () => {
    const trimmed = searchInputValue.trim();
    if (!trimmed) return;
    setActivePill(null);
    setActiveQuery(trimmed);
    fetchImages(trimmed, engine);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCustomSearchSubmit();
    }
  };

  const handlePillClick = (pill: string) => {
    if (activePill === pill) {
      setActivePill(null);
      setActiveQuery(query);
      setSearchInputValue(query);
      fetchImages(query, engine);
    } else {
      setActivePill(pill);
      const baseQuery = query.trim();
      const pillLower = pill.toLowerCase();
      const baseLower = baseQuery.toLowerCase();
      const refinedQuery = baseLower.includes(pillLower) ? pill : `${baseQuery} ${pill}`;
      setActiveQuery(refinedQuery);
      setSearchInputValue(refinedQuery);
      fetchImages(refinedQuery, engine);
    }
  };

  const scrollPills = (dir: "left" | "right") => {
    if (scrollRef.current) {
      const offset = dir === "left" ? -250 : 250;
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className={`w-full rounded-2xl border border-zinc-800/80 bg-zinc-950/95 [.light_&]:bg-[#faf9f5] [.light_&]:border-[#e6dfd8] p-4 sm:p-5 shadow-2xl [.light_&]:shadow-xl backdrop-blur-md overflow-hidden select-none ${isExpanded ? "h-[85vh] flex flex-col" : "my-3"}`}>
      
      {/* --- Top Header & Controls Area --- */}
      <div className="flex flex-col gap-3 mb-4 border-b border-zinc-800/70 [.light_&]:border-[#e6dfd8] pb-3.5 shrink-0">
        
        {/* Top Title & Count Row */}
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1 justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7] flex items-center justify-center text-zinc-300 [.light_&]:text-[#141413] shrink-0">
                {engine === "pinterest" ? (
                  <svg className="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z"/>
                  </svg>
                ) : (
                  <ImageIcon className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-serif font-normal text-zinc-100 [.light_&]:text-[#141413] tracking-tight capitalize truncate max-w-[280px] sm:max-w-[480px] lg:max-w-[650px]">
                {activeQuery}
              </h3>
            </div>
            {images.length > 0 && (
              <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-zinc-900/60 [.light_&]:bg-[#efe9de] text-zinc-400 [.light_&]:text-[#6c6a64] border border-zinc-800/80 [.light_&]:border-[#c3c2b7] shrink-0">
                {images.length} {engine === "pinterest" ? "pins" : "images"}
              </span>
            )}
          </div>
        </div>

        {/* --- Suggestion Pills Row --- */}
        {pills.length > 0 && (
          <div className="relative flex items-center w-full bg-zinc-900/60 [.light_&]:bg-[#efe9de] backdrop-blur-md border border-zinc-800/80 [.light_&]:border-[#c3c2b7] px-2.5 py-2 rounded-xl shrink-0">
            <button
              onClick={() => scrollPills("left")}
              className="flex shrink-0 p-1 text-zinc-400 hover:text-zinc-200 [.light_&]:text-[#6c6a64] [.light_&]:hover:text-[#141413] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div
              ref={scrollRef}
              className="flex items-center gap-2 overflow-x-auto scrollbar-none px-1.5 py-0.5 w-full"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {pills.map((pill, idx) => {
                const isActive = activePill === pill;
                return (
                  <button
                    key={idx}
                    onClick={() => handlePillClick(pill)}
                    className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer border ${
                      isActive
                        ? "bg-zinc-800 border-zinc-700 text-zinc-100 [.light_&]:bg-[#3d3d3a] [.light_&]:border-[#252523] [.light_&]:text-[#faf9f5] font-semibold shadow-sm"
                        : "bg-zinc-950/80 border-zinc-800/90 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 [.light_&]:bg-[#f5f0e8] [.light_&]:border-[#c3c2b7] [.light_&]:text-[#525250] [.light_&]:hover:text-[#141413]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className={`w-3 h-3 ${isActive ? "text-zinc-300 [.light_&]:text-[#faf9f5]" : "text-zinc-400 [.light_&]:text-[#8e8b82]"}`} />
                      {pill}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => scrollPills("right")}
              className="flex shrink-0 p-1 text-zinc-400 hover:text-zinc-200 [.light_&]:text-[#6c6a64] [.light_&]:hover:text-[#141413] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* --- Engine Selector Dropdown & Multi-line Search Input Row --- */}
        <div className="flex items-center gap-2.5 w-full pt-1">
          {/* Dropdown Engine Button */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsEngineDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900/90 hover:bg-zinc-850 text-zinc-200 border border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:hover:bg-[#e6dfd1] [.light_&]:text-[#141413] [.light_&]:border-[#c3c2b7] transition-all duration-200 shadow-sm cursor-pointer"
            >
              {engine === "pinterest" ? (
                <>
                  <svg className="w-3.5 h-3.5 text-red-500 fill-current" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z"/>
                  </svg>
                  <span>Pinterest</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                  <span>DuckDuckGo</span>
                </>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isEngineDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isEngineDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-40 rounded-xl bg-zinc-900 border border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7] shadow-xl z-50 overflow-hidden py-1">
                <button
                  type="button"
                  onClick={() => handleEngineSwitch("ddg")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                    engine === "ddg"
                      ? "bg-zinc-800 text-white font-medium [.light_&]:bg-[#ded8cb] [.light_&]:text-[#141413]"
                      : "text-zinc-300 hover:bg-zinc-800/60 [.light_&]:text-[#3d3d3a] [.light_&]:hover:bg-[#e6dfd1]"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                  <span>DuckDuckGo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleEngineSwitch("pinterest")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                    engine === "pinterest"
                      ? "bg-zinc-800 text-white font-medium [.light_&]:bg-[#ded8cb] [.light_&]:text-[#141413]"
                      : "text-zinc-300 hover:bg-zinc-800/60 [.light_&]:text-[#3d3d3a] [.light_&]:hover:bg-[#e6dfd1]"
                  }`}
                >
                  <svg className="w-3.5 h-3.5 text-red-500 fill-current" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z"/>
                  </svg>
                  <span>Pinterest</span>
                </button>
              </div>
            )}
          </div>

          {/* Multi-line Auto-Wrapping Search Input & Lens Button */}
          <div className="flex-1 flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7] px-3 py-1.5 rounded-xl transition-all focus-within:border-zinc-600 [.light_&]:focus-within:border-[#141413]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={engine === "pinterest" ? "Search anything via Pinterest..." : "Search anything via DuckDuckGo..."}
              className="flex-1 bg-transparent border-0 outline-none resize-none text-xs text-zinc-100 [.light_&]:text-[#141413] placeholder:text-zinc-500 [.light_&]:placeholder:text-[#8e8b82] max-h-20 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 [.light_&]:scrollbar-thumb-zinc-400 py-1 leading-relaxed"
              style={{ minHeight: "24px" }}
            />
            <button
              type="button"
              onClick={handleCustomSearchSubmit}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 [.light_&]:bg-[#3d3d3a] [.light_&]:hover:bg-[#252523] [.light_&]:text-[#faf9f5] transition-colors shrink-0 cursor-pointer"
              title="Search"
              aria-label="Search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* --- Image Grid --- */}
      {loading ? (
        <div className={`grid gap-4 ${isExpanded ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 flex-1 auto-rows-max" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {Array.from({ length: isExpanded ? 12 : 6 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-[16/10] shrink-0 rounded-xl bg-zinc-900/60 border border-zinc-800/60 [.light_&]:bg-[#efe9de]/70 [.light_&]:border-[#e6dfd8] animate-pulse flex flex-col justify-between p-3.5"
            >
              <div className="w-14 h-3 rounded bg-zinc-800/80 [.light_&]:bg-[#dfd8cc] self-end" />
              <div className="space-y-1.5">
                <div className="w-3/4 h-3.5 rounded bg-zinc-800/80 [.light_&]:bg-[#dfd8cc]" />
                <div className="w-1/2 h-3 rounded bg-zinc-800/50 [.light_&]:bg-[#e6dfd8]" />
              </div>
            </div>
          ))}
        </div>
      ) : images.length > 0 ? (
        <div className={`grid gap-4 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 [.light_&]:scrollbar-thumb-zinc-300 ${isExpanded ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 flex-1 min-h-0 auto-rows-max" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-h-[580px]"}`}>
          {images.map((img, idx) => {
            const pinSearchUrl = `https://in.pinterest.com/search/pins/?q=${encodeURIComponent(activeQuery)}&rs=typed`;
            const ddgSearchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(activeQuery)}&iax=images&ia=images`;
            const visitUrl = engine === "pinterest" 
              ? (img.source_url && img.source_url.includes("pinterest.com") ? img.source_url : pinSearchUrl)
              : (img.source_url || ddgSearchUrl);

            return (
              <div
                key={idx}
                onClick={() => setSelectedImage(img)}
                className="group relative w-full aspect-[16/10] shrink-0 rounded-xl border border-zinc-800/80 bg-zinc-900/40 [.light_&]:border-[#e6dfd8] [.light_&]:bg-[#efe9de] overflow-hidden cursor-pointer transition-all duration-300 hover:border-zinc-600 [.light_&]:hover:border-[#c3c2b7] hover:shadow-2xl flex flex-col justify-end"
              >
                {/* Thumbnail Image */}
                <img
                  src={img.thumbnail_url}
                  alt={img.title}
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = img.image_url;
                  }}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-95 transition-opacity duration-300" />

                {/* Top Badge: Domain or Pin Badge */}
                <div className="absolute top-2.5 right-2.5 z-10">
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-zinc-300 border border-white/10 flex items-center gap-1">
                    {engine === "pinterest" || img.domain.includes("pinterest") ? (
                      <>
                        <svg className="w-2.5 h-2.5 text-red-500 fill-current" viewBox="0 0 24 24">
                          <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z"/>
                        </svg>
                        Pin
                      </>
                    ) : (
                      img.domain
                    )}
                  </span>
                </div>

                {/* Bottom Details Overlay */}
                <div className="relative z-10 p-3 flex flex-col justify-end min-w-0">
                  <h4 className="text-xs font-medium text-white line-clamp-2 leading-tight tracking-tight drop-shadow-md">
                    {img.title}
                  </h4>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-zinc-400 font-mono">
                    <span>{img.width && img.height ? `${img.width} × ${img.height}` : "HD Image"}</span>
                    <a
                      href={visitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-zinc-300 hover:text-white transition-colors"
                    >
                      <span>Visit</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-zinc-400 [.light_&]:text-[#6c6a64]">
          No images found for "{activeQuery}" via {engine === "pinterest" ? "Pinterest" : "DuckDuckGo"}.
        </div>
      )}

      {/* --- Image Detail Modal Popup --- */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-fadeIn"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-950 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#e6dfd8] rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 [.light_&]:border-[#e6dfd8] shrink-0">
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-4">
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-zinc-900 [.light_&]:bg-[#efe9de] text-zinc-400 [.light_&]:text-[#6c6a64] border border-zinc-800 [.light_&]:border-[#c3c2b7] shrink-0">
                  {selectedImage.domain}
                </span>
                <h3 className="text-sm sm:text-base font-medium text-zinc-100 [.light_&]:text-[#141413] truncate">
                  {selectedImage.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white [.light_&]:bg-[#efe9de] [.light_&]:hover:bg-[#e6dfd1] [.light_&]:text-[#6c6a64] [.light_&]:hover:text-[#141413] transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Large Image */}
            <div className="flex-1 min-h-0 bg-black/40 flex items-center justify-center p-4 overflow-hidden relative">
              <img
                src={selectedImage.image_url}
                alt={selectedImage.title}
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-2xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = selectedImage.thumbnail_url;
                }}
              />
            </div>

            {/* Modal Footer: Action Bar */}
            <div className="px-5 py-4 bg-zinc-950/90 [.light_&]:bg-[#faf9f5] border-t border-zinc-800/80 [.light_&]:border-[#e6dfd8] flex items-center justify-between gap-4 shrink-0">
              <div className="text-xs font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">
                {selectedImage.width && selectedImage.height ? `${selectedImage.width} × ${selectedImage.height} px` : "High Resolution"}
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={selectedImage.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 [.light_&]:bg-[#efe9de] [.light_&]:hover:bg-[#e6dfd1] [.light_&]:text-[#141413] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-xs font-medium transition-colors"
                >
                  Direct Image URL
                </a>
                <a
                  href={engine === "pinterest" || selectedImage.domain.includes("pinterest")
                    ? (selectedImage.source_url && selectedImage.source_url.includes("pinterest.com") ? selectedImage.source_url : `https://in.pinterest.com/search/pins/?q=${encodeURIComponent(activeQuery)}&rs=typed`)
                    : (selectedImage.source_url || `https://duckduckgo.com/?q=${encodeURIComponent(activeQuery)}&iax=images&ia=images`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                >
                  <span>{engine === "pinterest" || selectedImage.domain.includes("pinterest") ? "View Pin on Pinterest" : "Visit Source Website"}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
