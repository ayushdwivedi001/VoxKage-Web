"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, ExternalLink, X, Image as ImageIcon, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
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
}

export default function DuckDuckGoImageWidget({ query }: DuckDuckGoImageWidgetProps) {
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
      const res = await fetch(`${BACKEND_URL}/api/search/images?query=${encodeURIComponent(searchQuery)}&limit=24`);
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
  }, [query]);

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
    <div className="w-full my-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-2xl backdrop-blur-md overflow-hidden select-none">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-zinc-800/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100 tracking-tight capitalize">
                {activeQuery}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                DuckDuckGo Live
              </span>
            </div>
            <p className="text-xs text-zinc-500">Live web image search & visual index</p>
          </div>
        </div>

        {/* Suggestion Pills Bar */}
        {pills.length > 0 && (
          <div className="relative flex items-center max-w-full sm:max-w-[60%]">
            <button
              onClick={() => scrollPills("left")}
              className="hidden sm:flex shrink-0 p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div
              ref={scrollRef}
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {pills.map((pill, idx) => {
                const isActive = activePill === pill;
                return (
                  <button
                    key={idx}
                    onClick={() => handlePillClick(pill)}
                    className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer border ${
                      isActive
                        ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-sm"
                        : "bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-cyan-400/70" />
                      {pill}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => scrollPills("right")}
              className="hidden sm:flex shrink-0 p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Grid Content / Skeleton */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-[16/11] rounded-xl bg-zinc-900/60 border border-zinc-800/60 animate-pulse flex flex-col justify-between p-3"
            >
              <div className="w-12 h-3 rounded bg-zinc-800/80 self-end" />
              <div className="space-y-1.5">
                <div className="w-3/4 h-3 rounded bg-zinc-800/80" />
                <div className="w-1/2 h-2.5 rounded bg-zinc-800/50" />
              </div>
            </div>
          ))}
        </div>
      ) : images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {images.map((img, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedImage(img)}
              className="group relative aspect-[16/11] rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden cursor-pointer transition-all duration-300 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/5 flex flex-col justify-end"
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
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

              {/* Dimension Tag */}
              {img.width > 0 && img.height > 0 && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 text-[10px] font-mono text-zinc-400">
                  {img.width} × {img.height}
                </div>
              )}

              {/* Title & Domain Footer */}
              <div className="relative z-10 p-2.5 space-y-0.5">
                <p className="text-xs font-medium text-zinc-100 line-clamp-1 group-hover:text-cyan-300 transition-colors">
                  {img.title}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span className="truncate max-w-[120px] font-mono text-[10px] text-zinc-400">
                    {img.domain}
                  </span>
                  <ExternalLink className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <ImageIcon className="w-10 h-10 text-zinc-700 mb-2" />
          <p className="text-sm font-medium text-zinc-400">No images found for "{activeQuery}"</p>
          <p className="text-xs text-zinc-600 mt-1">Try selecting a different topic pill above</p>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/80 bg-zinc-900/50">
              <div className="flex items-center gap-2 truncate pr-4">
                <ImageIcon className="w-4 h-4 text-cyan-400 shrink-0" />
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
            <div className="relative flex-1 bg-black/60 min-h-[300px] flex items-center justify-center p-4 overflow-hidden">
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
                <a
                  href={selectedImage.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Visit Source Webpage</span>
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
