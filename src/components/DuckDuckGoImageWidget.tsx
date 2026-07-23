"use client";

import React, { useState, useEffect, useRef } from "react";
import { ExternalLink, X, Image as ImageIcon, Sparkles, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { BACKEND_URL } from "@/lib/api";

export interface DuckDuckGoImageItem {
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
  entities?: string;
  isExpanded?: boolean;
  onAskVoxKage?: (item: DuckDuckGoImageItem) => void;
}

export default function DuckDuckGoImageWidget({ query, entities, isExpanded = false, onAskVoxKage }: DuckDuckGoImageWidgetProps) {
  const [activeQuery, setActiveQuery] = useState(query);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<DuckDuckGoImageItem[]>([]);
  const [pills, setPills] = useState<string[]>([]);
  const [activePill, setActivePill] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<DuckDuckGoImageItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchImages = async (searchQuery: string) => {
    setLoading(true);
    try {
      let url = `${BACKEND_URL}/api/search/images?query=${encodeURIComponent(searchQuery)}&limit=24`;
      if (entities) {
        url += `&entities=${encodeURIComponent(entities)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setImages(data.images || []);
        if (data.pills && data.pills.length > 0) {
          setPills(data.pills);
        }
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
      fetchImages(query);
    }
  }, [query, entities]);

  const handlePillClick = (pill: string) => {
    if (activePill === pill) {
      setActivePill(null);
      setActiveQuery(query);
      fetchImages(query);
    } else {
      setActivePill(pill);
      const newQuery = pill.toLowerCase().includes(query.toLowerCase()) ? pill : `${query} ${pill}`;
      setActiveQuery(newQuery);
      fetchImages(newQuery);
    }
  };

  const scrollPills = (dir: "left" | "right") => {
    if (scrollRef.current) {
      const offset = dir === "left" ? -250 : 250;
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className={`w-full rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-4 sm:p-5 shadow-2xl backdrop-blur-md overflow-hidden select-none ${isExpanded ? "h-[85vh] flex flex-col" : "my-3"}`}>
      {/* --- Restructured Header Bar --- */}
      <div className="flex flex-col gap-3 mb-4 border-b border-zinc-800/70 pb-3.5 shrink-0">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <h3 className="text-sm sm:text-base font-semibold text-zinc-100 tracking-tight capitalize truncate max-w-[280px] sm:max-w-[480px] lg:max-w-[650px]">
                  {activeQuery}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800 shrink-0">
                  DuckDuckGo Live
                </span>
                {images.length > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900/60 text-zinc-500 border border-zinc-800/60 hidden sm:inline-block shrink-0">
                    {images.length} images indexed
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 truncate">Live web image search & visual index</p>
            </div>
          </div>
        </div>

        {/* --- Full-Width Glassmorphic Suggestion Pills Row --- */}
        {pills.length > 0 && (
          <div className="relative flex items-center w-full bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 px-2.5 py-2 rounded-xl shrink-0">
            <button
              onClick={() => scrollPills("left")}
              className="flex shrink-0 p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
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
                        ? "bg-zinc-800 border-zinc-700 text-zinc-100 font-semibold shadow-sm"
                        : "bg-zinc-950/80 border-zinc-800/90 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-zinc-400" />
                      {pill}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => scrollPills("right")}
              className="flex shrink-0 p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* --- Image Grid (3 columns desktop inline, 4 columns expanded) --- */}
      {loading ? (
        <div className={`grid gap-4 ${isExpanded ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 flex-1 auto-rows-max" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {Array.from({ length: isExpanded ? 12 : 6 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-[16/10] shrink-0 rounded-xl bg-zinc-900/60 border border-zinc-800/60 animate-pulse flex flex-col justify-between p-3.5"
            >
              <div className="w-14 h-3 rounded bg-zinc-800/80 self-end" />
              <div className="space-y-1.5">
                <div className="w-3/4 h-3.5 rounded bg-zinc-800/80" />
                <div className="w-1/2 h-3 rounded bg-zinc-800/50" />
              </div>
            </div>
          ))}
        </div>
      ) : images.length > 0 ? (
        <div className={`grid gap-4 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 ${isExpanded ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 flex-1 min-h-0 auto-rows-max" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-h-[580px]"}`}>
          {images.map((img, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedImage(img)}
              className="group relative w-full aspect-[16/10] shrink-0 rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden cursor-pointer transition-all duration-300 hover:border-zinc-600 hover:shadow-2xl flex flex-col justify-end"
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
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/25 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />

              {/* Dimension Tag */}
              {img.width > 0 && img.height > 0 && (
                <div className="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded bg-zinc-950/85 border border-zinc-800 text-[10.5px] font-mono text-zinc-400">
                  {img.width} × {img.height}
                </div>
              )}

              {/* Title & Domain Footer */}
              <div className="relative z-10 p-3 space-y-1">
                <p className="text-xs sm:text-sm font-medium text-zinc-100 line-clamp-1 group-hover:text-white transition-colors">
                  {img.title}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="truncate font-mono text-[11px] text-zinc-400">
                    {img.domain}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-14 flex flex-col items-center justify-center text-center">
          <ImageIcon className="w-10 h-10 text-zinc-700 mb-2" />
          <p className="text-sm font-medium text-zinc-400">No images found for "{activeQuery}"</p>
          <p className="text-xs text-zinc-600 mt-1">Try selecting a different suggestion pill above</p>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/80 bg-zinc-900/50">
              <div className="flex items-center gap-2 truncate pr-4">
                <ImageIcon className="w-4 h-4 text-zinc-300 shrink-0" />
                <h4 className="text-sm font-semibold text-zinc-100 truncate">
                  {selectedImage.title}
                </h4>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Image Display */}
            <div className="relative flex-1 bg-black/70 min-h-[300px] flex items-center justify-center p-4 overflow-hidden">
              <img
                src={selectedImage.image_url}
                alt={selectedImage.title}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = selectedImage.thumbnail_url;
                }}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 font-mono">
                  Source: <span className="text-zinc-200">{selectedImage.domain}</span>
                </span>
                {selectedImage.width > 0 && (
                  <span className="text-xs text-zinc-400 font-mono">
                    {selectedImage.width} × {selectedImage.height} px
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onAskVoxKage && (
                  <button
                    onClick={() => {
                      onAskVoxKage(selectedImage);
                      setSelectedImage(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-zinc-100 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Ask VoxKage</span>
                  </button>
                )}

                <a
                  href={selectedImage.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <span>Visit Source Webpage</span>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-300" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
