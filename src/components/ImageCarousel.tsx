import React, { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { ImageItem } from "@/lib/chatHelpers";

interface ImageCarouselProps {
  images: ImageItem[];
}

export default function ImageCarousel({ images }: ImageCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScrollLimits = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowLeftArrow(el.scrollLeft > 10);
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener("scroll", checkScrollLimits);
      // Run once on load
      checkScrollLimits();
      // Handle window resize recalculation
      window.addEventListener("resize", checkScrollLimits);
    }
    return () => {
      if (el) {
        el.removeEventListener("scroll", checkScrollLimits);
      }
      window.removeEventListener("resize", checkScrollLimits);
    };
  }, [images]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const offset = direction === "left" ? -400 : 400;
    el.scrollBy({
      left: offset,
      behavior: "smooth"
    });
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Fall back to a premium dark themed abstract placeholder image
    e.currentTarget.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800";
  };

  if (!images || images.length === 0) return null;

  return (
    <div className="relative w-full my-4 select-none group/carousel">
      {/* Navigation Arrows */}
      {showLeftArrow && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700/80 hover:bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-zinc-200 shadow-xl transition-all duration-200 cursor-pointer opacity-0 group-hover/carousel:opacity-100"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {showRightArrow && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700/80 hover:bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-zinc-200 shadow-xl transition-all duration-200 cursor-pointer opacity-0 group-hover/carousel:opacity-100"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollContainerRef}
        className="w-full flex gap-3.5 overflow-x-auto scrollbar-hide py-1 snap-x snap-mandatory"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none"
        }}
      >
        {images.map((img, idx) => {
          // Format image via weserv proxy to bypass hotlink blockages and optimize sizes
          const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(img.url)}&w=800&output=webp`;

          return (
            <div
              key={idx}
              className="flex-shrink-0 w-[280px] sm:w-[340px] snap-start rounded-2xl border border-zinc-850/60 bg-zinc-950/20 overflow-hidden flex flex-col relative group transition-all duration-300 hover:border-zinc-750"
            >
              {/* Image box without outside borders inside */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900/50">
                <img
                  src={proxiedUrl}
                  alt={img.title}
                  onError={handleImageError}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              {/* Lower caption info overlayed in premium style */}
              <div className="p-3 border-t border-zinc-850/40 bg-zinc-950/45 flex items-center gap-2 select-text">
                <ImageIcon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                <span className="text-[13px] font-medium text-zinc-400 truncate flex-grow">
                  {img.title || "Image view"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
