"use client";

import React, { useState, useEffect, useRef } from "react";
import { ExternalLink, X, Sparkles, ChevronLeft, ChevronRight, Search, Plus, Loader2 } from "lucide-react";
import { BACKEND_URL } from "@/lib/api";

export interface ImageItem {
  id?: string;
  title: string;
  image_url: string;
  thumbnail_url: string;
  source_url: string;
  domain: string;
  width: number;
  height: number;
}

// Backwards compatibility alias
export type DuckDuckGoImageItem = ImageItem;

interface ImageWidgetProps {
  query: string;
  isExpanded?: boolean;
}

export type DuckDuckGoImageWidgetProps = ImageWidgetProps;

export default function ImageWidget({ query, isExpanded = false }: ImageWidgetProps) {
  // Session State Persistence Key
  const stateKey = `vk_img_state_${query.trim().toLowerCase().replace(/\s+/g, "_")}`;

  const [activeQuery, setActiveQuery] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(stateKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.query) return parsed.query;
        }
      } catch {}
    }
    return query;
  });

  const [searchInputValue, setSearchInputValue] = useState<string>(activeQuery);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pills, setPills] = useState<string[]>([]);
  const [activePill, setActivePill] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);

  // Related Images Detail Modal State
  const [relatedImages, setRelatedImages] = useState<ImageItem[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedLoadingMore, setRelatedLoadingMore] = useState(false);
  const [relatedPage, setRelatedPage] = useState<number>(1);
  const [curatedSearchTerm, setCuratedSearchTerm] = useState<string>("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);

  // Read user's active selected model & explicit provider ("kilo" vs "opencode") dynamically
  const getSelectedModelInfo = (): { model: string; provider: string } => {
    if (typeof window !== "undefined") {
      try {
        const voxkageModel = localStorage.getItem("voxkage_selected_model");
        const directModel = localStorage.getItem("selected_model") || localStorage.getItem("selectedModel");
        const profileStr = localStorage.getItem("vk_user_settings_profile");

        let activeModelName = "DeepSeek V4 Flash";
        if (voxkageModel && voxkageModel.trim()) {
          activeModelName = voxkageModel.trim();
        } else if (directModel && directModel.trim()) {
          activeModelName = directModel.trim();
        } else if (profileStr) {
          const parsed = JSON.parse(profileStr);
          const pModel = parsed.selected_model || parsed.selectedModel;
          if (pModel && pModel.trim()) activeModelName = pModel.trim();
        }

        // Check explicit provider stored in settings profile
        let provider = "opencode";
        if (profileStr) {
          try {
            const parsed = JSON.parse(profileStr);
            if (parsed.selected_provider || parsed.selectedProvider) {
              provider = parsed.selected_provider || parsed.selectedProvider;
            }
          } catch {}
        }

        const cachedModelsStr = localStorage.getItem("voxkage_cached_models");
        if (cachedModelsStr) {
          try {
            const cachedModels = JSON.parse(cachedModelsStr);
            if (Array.isArray(cachedModels)) {
              const found = cachedModels.find(
                (m: any) => m.name === activeModelName || m.api_key === activeModelName || m.id === activeModelName
              );
              if (found && found.provider) {
                return { model: activeModelName, provider: found.provider };
              }
            }
          } catch {}
        }

        // Heuristic fallback: if model name contains stepfun or kilo or step, provider is kilo
        const lowerName = activeModelName.toLowerCase();
        if (lowerName.includes("stepfun") || lowerName.includes("step 3.7") || lowerName.includes("kilo")) {
          provider = "kilo";
        }

        return { model: activeModelName, provider };
      } catch (e) {
        console.error("Model info resolution notice:", e);
      }
    }
    return { model: "DeepSeek V4 Flash", provider: "opencode" };
  };

  // Save lightweight session state metadata (query, page) to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(
        stateKey,
        JSON.stringify({ query: activeQuery, page })
      );
    } catch (e) {
      console.error("State persist notice:", e);
    }
  }, [activeQuery, page, stateKey]);

  // Fetch Pinterest Images with bookmark pagination support
  const fetchImages = async (
    q: string,
    targetPage: number = 1,
    append: boolean = false
  ) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const limit = targetPage * 24;
      const endpoint = `${BACKEND_URL}/api/search/pinterest?query=${encodeURIComponent(q)}&limit=${limit}`;

      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const newImages: ImageItem[] = data.images || [];

        setImages(newImages);

        if (data.pills?.length > 0 && !append) setPills(data.pills);
      } else {
        if (!append) setImages([]);
      }
    } catch (err) {
      console.error("Pinterest image search error:", err);
      if (!append) setImages([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchImages(activeQuery, page, false);
  }, []);

  // Fetch Related Images with VoxKage AI Query Curator (Selected Model & Explicit Provider dynamically)
  const fetchRelatedImages = async (img: ImageItem, targetPage: number = 1, append: boolean = false) => {
    if (append) {
      setRelatedLoadingMore(true);
    } else {
      setRelatedLoading(true);
      setRelatedImages([]);
      setCuratedSearchTerm("");
    }

    try {
      const limit = targetPage * 24;
      const { model: currentModel, provider: currentProvider } = getSelectedModelInfo();
      const endpoint = `${BACKEND_URL}/api/search/pinterest/related?pin_id=${encodeURIComponent(img.id || "")}&query=${encodeURIComponent(img.title || activeQuery)}&initial_query=${encodeURIComponent(activeQuery)}&image_title=${encodeURIComponent(img.title)}&image_url=${encodeURIComponent(img.image_url)}&model=${encodeURIComponent(currentModel)}&provider=${encodeURIComponent(currentProvider)}&limit=${limit}`;

      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setRelatedImages(data.images || []);
        if (data.query) setCuratedSearchTerm(data.query);
      }
    } catch (err) {
      console.error("Related Pinterest images fetch notice:", err);
    } finally {
      setRelatedLoading(false);
      setRelatedLoadingMore(false);
    }
  };

  const handleSelectImage = (img: ImageItem) => {
    setSelectedImage(img);
    setRelatedPage(1);
    fetchRelatedImages(img, 1, false);
    if (modalScrollRef.current) {
      modalScrollRef.current.scrollTop = 0;
    }
  };

  const handleCustomSearchSubmit = () => {
    const trimmed = searchInputValue.trim();
    if (!trimmed) return;
    setActivePill(null);
    setActiveQuery(trimmed);
    setPage(1);
    fetchImages(trimmed, 1, false);
  };

  const handleClearInput = () => {
    setSearchInputValue("");
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
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
      setPage(1);
      fetchImages(query, 1, false);
    } else {
      setActivePill(pill);
      const baseQuery = query.trim();
      const pillLower = pill.toLowerCase();
      const baseLower = baseQuery.toLowerCase();
      const refinedQuery = baseLower.includes(pillLower) ? pill : `${baseQuery} ${pill}`;
      setActiveQuery(refinedQuery);
      setSearchInputValue(refinedQuery);
      setPage(1);
      fetchImages(refinedQuery, 1, false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchImages(activeQuery, nextPage, true);
  };

  const handleRelatedLoadMore = () => {
    if (!selectedImage) return;
    const nextPage = relatedPage + 1;
    setRelatedPage(nextPage);
    fetchRelatedImages(selectedImage, nextPage, true);
  };

  const scrollPills = (dir: "left" | "right") => {
    if (scrollRef.current) {
      const offset = dir === "left" ? -250 : 250;
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className={`w-full rounded-2xl border border-zinc-800/80 bg-zinc-950/95 [.light_&]:bg-[#faf9f5] [.light_&]:border-[#e6dfd8] p-3.5 sm:p-5 shadow-2xl [.light_&]:shadow-xl backdrop-blur-md overflow-hidden select-none ${isExpanded ? "h-[85vh] flex flex-col" : "my-3 flex flex-col max-h-[600px] sm:max-h-[640px]"}`}>
      
      {/* --- Top Header & Controls Area --- */}
      <div className="flex flex-col gap-3 mb-4 border-b border-zinc-800/70 [.light_&]:border-[#e6dfd8] pb-3.5 shrink-0 w-full max-w-full min-w-0">
        
        {/* Top Title & Count Row */}
        <div className="flex items-center justify-between gap-3 w-full max-w-full min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1 justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7] flex items-center justify-center text-zinc-300 [.light_&]:text-[#141413] shrink-0">
                <svg className="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z"/>
                </svg>
              </div>
              <h3 className="text-sm sm:text-lg md:text-xl font-serif font-normal text-zinc-100 [.light_&]:text-[#141413] tracking-tight capitalize truncate max-w-[180px] sm:max-w-[480px] lg:max-w-[650px]">
                {activeQuery}
              </h3>
            </div>
            {images.length > 0 && (
              <span className="text-[10px] sm:text-[11px] font-mono px-2.5 sm:px-3 py-1 rounded-full bg-zinc-900/60 [.light_&]:bg-[#efe9de] text-zinc-400 [.light_&]:text-[#6c6a64] border border-zinc-800/80 [.light_&]:border-[#c3c2b7] shrink-0">
                {images.length} pins
              </span>
            )}
          </div>
        </div>

        {/* --- Suggestion Pills Row --- */}
        {pills.length > 0 && (
          <div className="relative flex items-center w-full bg-zinc-900/60 [.light_&]:bg-[#efe9de] backdrop-blur-md border border-zinc-800/80 [.light_&]:border-[#c3c2b7] px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-xl shrink-0">
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

        {/* --- Pinterest Search Input Row --- */}
        <div className="flex items-center gap-2 sm:gap-2.5 w-full max-w-full min-w-0 pt-1">
          {/* Search Input Box with Text Selection Colors & Instant 'X' Clear Button */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 bg-zinc-900/90 border border-zinc-800 [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7] px-2.5 sm:px-3 py-1.5 rounded-xl transition-all focus-within:border-zinc-600 [.light_&]:focus-within:border-[#141413]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search Pinterest..."
              className="flex-1 min-w-0 bg-transparent border-0 outline-none resize-none text-xs text-zinc-100 [.light_&]:text-[#141413] selection:bg-[#cc785c] selection:text-white [.light_&]:selection:bg-[#cc785c] [.light_&]:selection:text-white placeholder:text-zinc-500 [.light_&]:placeholder:text-[#8e8b82] max-h-20 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 [.light_&]:scrollbar-thumb-zinc-400 py-1 leading-relaxed"
              style={{ minHeight: "24px" }}
            />
            {/* Clear 'X' Button */}
            {searchInputValue.length > 0 && (
              <button
                type="button"
                onClick={handleClearInput}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 [.light_&]:text-[#6c6a64] [.light_&]:hover:text-[#141413] transition-colors shrink-0 cursor-pointer"
                title="Clear search text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Lens Search Button */}
            <button
              type="button"
              onClick={handleCustomSearchSubmit}
              className="p-1.5 sm:px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 [.light_&]:bg-[#3d3d3a] [.light_&]:hover:bg-[#252523] [.light_&]:text-[#faf9f5] transition-colors shrink-0 cursor-pointer flex items-center justify-center"
              title="Search"
              aria-label="Search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* --- Main Image Grid & Scroll Container --- */}
      {loading ? (
        <div className={`grid gap-3 sm:gap-4 ${isExpanded ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 flex-1 auto-rows-max" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
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
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 [.light_&]:scrollbar-thumb-zinc-300">
          <div className={`grid gap-3 sm:gap-4 ${isExpanded ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 auto-rows-max" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-max"}`}>
            {images.map((img, idx) => {
              const pinSearchUrl = `https://in.pinterest.com/search/pins/?q=${encodeURIComponent(activeQuery)}&rs=typed`;
              const visitUrl = img.source_url && img.source_url.includes("pinterest.com") ? img.source_url : pinSearchUrl;

              return (
                <div
                  key={idx}
                  onClick={() => handleSelectImage(img)}
                  className="group relative w-full aspect-[16/10] shrink-0 rounded-xl border border-zinc-800/80 bg-zinc-900/40 [.light_&]:border-[#e6dfd8] [.light_&]:bg-[#efe9de] overflow-hidden cursor-pointer transition-all duration-300 hover:border-zinc-600 [.light_&]:hover:border-[#c3c2b7] hover:shadow-2xl flex flex-col justify-end"
                >
                  <img
                    src={img.thumbnail_url}
                    alt={img.title}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = img.image_url;
                    }}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-95 transition-opacity duration-300" />

                  <div className="absolute top-2.5 right-2.5 z-10">
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-zinc-300 border border-white/10 flex items-center gap-1">
                      <svg className="w-2.5 h-2.5 text-red-500 fill-current" viewBox="0 0 24 24">
                        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z"/>
                      </svg>
                      Pin
                    </span>
                  </div>

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

          {/* --- Always Visible Theme Supported + Load More Button --- */}
          <div className="my-6 flex items-center justify-center w-full shrink-0">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-md border bg-[#efe9de] hover:bg-[#e4dcce] text-[#141413] border-[#c3c2b7] dark:bg-[#252320] dark:hover:bg-[#2e2b27] dark:text-[#faf9f5] dark:border-[#383531]"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#cc785c]" />
                  <span>Loading additional pins...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-[#cc785c]" />
                  <span>+ Load more pins</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-zinc-400 [.light_&]:text-[#6c6a64]">
          No pins found for "{activeQuery}" via Pinterest.
        </div>
      )}

      {/* --- Immersive Visual Similarity Detail Modal Popup --- */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/85 backdrop-blur-xl animate-fadeIn"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className={`relative w-full ${
              isExpanded 
                ? "max-w-5xl h-[82vh] md:h-[80vh] max-h-[780px]" 
                : "max-w-4xl h-[72vh] md:h-[70vh] max-h-[540px] sm:max-h-[560px]"
            } bg-zinc-950 [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#e6dfd8] rounded-2xl overflow-hidden flex flex-col shadow-2xl transition-all duration-300`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header Bar - Permanently Pinned at Top (Mobile & Desktop) */}
            <div className="flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-zinc-800/80 [.light_&]:border-[#e6dfd8] shrink-0 bg-zinc-950 [.light_&]:bg-[#faf9f5] z-30">
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-3">
                <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-900 [.light_&]:bg-[#efe9de] text-zinc-400 [.light_&]:text-[#6c6a64] border border-zinc-800 [.light_&]:border-[#c3c2b7] shrink-0">
                  {selectedImage.domain}
                </span>
                <h3 className="text-xs sm:text-sm font-medium text-zinc-100 [.light_&]:text-[#141413] truncate" title={selectedImage.title}>
                  {selectedImage.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white [.light_&]:bg-[#efe9de] [.light_&]:hover:bg-[#e6dfd1] [.light_&]:text-[#6c6a64] [.light_&]:hover:text-[#141413] transition-colors shrink-0 cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Modal Body: Desktop Dual-Column Split (Left 45% Image, Right 55% Independent Scrollable Suggestions) / Mobile Unified Full Scroll Sheet */}
            <div 
              ref={modalScrollRef}
              className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row bg-black/30"
            >
              
              {/* Main Picked Image Area (Desktop Left 45% / Mobile Top View) */}
              <div className="w-full md:w-[45%] shrink-0 flex flex-col justify-between p-3 sm:p-4 bg-black/60 border-b md:border-b-0 md:border-r border-zinc-800/80 [.light_&]:border-[#e6dfd8] md:h-full md:overflow-y-auto">
                <div className="flex-1 min-h-0 flex items-center justify-center w-full p-1 overflow-hidden">
                  <img
                    src={selectedImage.image_url}
                    alt={selectedImage.title}
                    className={`max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-transform duration-300 ${
                      isExpanded 
                        ? "max-h-[42vh] md:max-h-[55vh]" 
                        : "max-h-[300px] sm:max-h-[350px] md:max-h-[390px]"
                    }`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = selectedImage.thumbnail_url;
                    }}
                  />
                </div>

                {/* Main Image Action Buttons & Metadata */}
                <div className="w-full mt-2.5 pt-2.5 border-t border-zinc-800/60 [.light_&]:border-[#e6dfd8] flex flex-col gap-2 shrink-0">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 [.light_&]:text-[#6c6a64]">
                    <span>Dimensions:</span>
                    <span>{selectedImage.width && selectedImage.height ? `${selectedImage.width} × ${selectedImage.height} px` : "High Resolution"}</span>
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <a
                      href={selectedImage.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 sm:py-2 text-center rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 [.light_&]:bg-[#efe9de] [.light_&]:hover:bg-[#e6dfd1] [.light_&]:text-[#141413] border border-zinc-800 [.light_&]:border-[#c3c2b7] text-xs font-medium transition-colors"
                    >
                      Direct Image URL
                    </a>
                    <a
                      href={selectedImage.source_url && selectedImage.source_url.includes("pinterest.com") ? selectedImage.source_url : `https://in.pinterest.com/search/pins/?q=${encodeURIComponent(activeQuery)}&rs=typed`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 sm:py-2 text-center rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
                    >
                      <span>View Pin</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Related / Similar Images Area (Desktop Right 55% Independent Scrollable Column / Mobile Scroll Sheet Section) */}
              <div className="w-full md:w-[55%] flex-1 flex flex-col p-3.5 sm:p-4 md:h-full md:overflow-y-auto bg-zinc-950/70 [.light_&]:bg-[#faf9f5] scrollbar-thin scrollbar-thumb-zinc-700 [.light_&]:scrollbar-thumb-zinc-400">
                <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#cc785c]" />
                    <h4 className="text-xs sm:text-sm font-serif font-medium text-zinc-200 [.light_&]:text-[#141413]">
                      More Like This ({relatedImages.length})
                    </h4>
                  </div>
                  {curatedSearchTerm && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 [.light_&]:bg-[#efe9de] text-zinc-400 [.light_&]:text-[#6c6a64] border border-zinc-800 [.light_&]:border-[#c3c2b7] truncate max-w-[140px] sm:max-w-[200px]" title={curatedSearchTerm}>
                      AI Query: {curatedSearchTerm}
                    </span>
                  )}
                </div>

                {relatedLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="aspect-[16/10] rounded-xl bg-zinc-900/60 [.light_&]:bg-[#efe9de] animate-pulse" />
                    ))}
                  </div>
                ) : relatedImages.length > 0 ? (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 auto-rows-max">
                      {relatedImages.map((relImg, rIdx) => (
                        <div
                          key={rIdx}
                          onClick={() => handleSelectImage(relImg)}
                          className="group relative aspect-[16/10] rounded-xl border border-zinc-800/80 bg-zinc-900/40 [.light_&]:border-[#e6dfd8] [.light_&]:bg-[#efe9de] overflow-hidden cursor-pointer hover:border-zinc-600 [.light_&]:hover:border-[#c3c2b7] transition-all"
                        >
                          <img
                            src={relImg.thumbnail_url}
                            alt={relImg.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = relImg.image_url;
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-70 group-hover:opacity-90 transition-opacity" />
                          <div className="absolute bottom-1.5 left-1.5 right-1.5 z-10">
                            <p className="text-[10px] sm:text-[11px] font-medium text-white line-clamp-1 leading-tight">
                              {relImg.title}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Sub-Pagination + Load More for Related Images */}
                    <div className="mt-4 mb-2 flex items-center justify-center w-full shrink-0">
                      <button
                        type="button"
                        onClick={handleRelatedLoadMore}
                        disabled={relatedLoadingMore}
                        className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-md border bg-[#efe9de] hover:bg-[#e4dcce] text-[#141413] border-[#c3c2b7] dark:bg-[#252320] dark:hover:bg-[#2e2b27] dark:text-[#faf9f5] dark:border-[#383531]"
                      >
                        {relatedLoadingMore ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#cc785c]" />
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 text-[#cc785c]" />
                            <span>+ Load more recommendations</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-zinc-500 [.light_&]:text-[#8e8b82]">
                    No additional recommendations found for this pin.
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
