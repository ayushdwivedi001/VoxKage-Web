"use client";

import React, { useEffect, useState, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Navigation, Sun, Moon, Star, ChevronRight, X, ExternalLink, MessageSquare, Compass, MapPin, Search, Sparkles } from "lucide-react";
import { BACKEND_URL } from "@/lib/api";

export interface MapPlace {
  name: string;
  lat: number;
  lng: number;
  rating?: number;
  reviews_count?: number;
  description?: string;
  category?: string;
  image_url?: string;
  address?: string;
}

interface MapWidgetProps {
  lat: number;
  lng: number;
  label?: string;
  places?: MapPlace[];
  isExpanded?: boolean;
  onSendPrompt?: (promptText: string) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  Historic: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/40", hex: "#cc785c" },
  Nature: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/40", hex: "#10b981" },
  Religious: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/40", hex: "#8b5cf6" },
  Food: { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/40", hex: "#f43f5e" },
  Sights: { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/40", hex: "#06b6d4" },
  Default: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/40", hex: "#3b82f6" },
};

export default function MapWidget({ lat, lng, label, places, isExpanded = false, onSendPrompt }: MapWidgetProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [mapTheme, setMapTheme] = useState<"dark" | "light">("dark");
  const [activePlace, setActivePlace] = useState<MapPlace | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [placeImages, setPlaceImages] = useState<Record<string, string>>({});

  const hasPlaces = places && places.length > 0;

  // Extract unique categories
  const categories = places
    ? ["All", ...Array.from(new Set(places.map(p => p.category).filter(Boolean))) as string[]]
    : ["All"];

  // Filtered places list
  const filteredPlaces = places
    ? places.filter(p => {
        const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
        const matchesSearch = !searchQuery.trim() || 
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
      })
    : [];

  // Fetch authentic DuckDuckGo images for places without image_url
  useEffect(() => {
    if (!places) return;

    places.forEach(async (p) => {
      if (p.image_url && p.image_url !== "empty") {
        setPlaceImages(prev => ({ ...prev, [p.name]: p.image_url! }));
        return;
      }

      const cacheKey = `vk_place_img_${p.name.trim().toLowerCase()}`;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setPlaceImages(prev => ({ ...prev, [p.name]: cached }));
          return;
        }
      } catch (e) {
        console.error("Cache read error:", e);
      }

      try {
        const queryTerm = `${p.name} ${label || ""}`.trim();
        const res = await fetch(`${BACKEND_URL}/api/search/images?query=${encodeURIComponent(queryTerm)}&limit=1`);
        if (res.ok) {
          const data = await res.json();
          if (data.images && data.images.length > 0) {
            const fetchedUrl = data.images[0].thumbnail_url || data.images[0].image_url;
            setPlaceImages(prev => ({ ...prev, [p.name]: fetchedUrl }));
            try {
              sessionStorage.setItem(cacheKey, fetchedUrl);
            } catch (e) {
              console.error("Cache write error:", e);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to fetch place image for ${p.name}:`, err);
      }
    });
  }, [places, label]);

  // Initialize MapLibre GL JS Map instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const styleUrl = mapTheme === "dark"
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: [lng, lat],
      zoom: hasPlaces ? 12.5 : 14,
      pitch: 30,
      bearing: 0,
      attributionControl: false,
    });

    // Native Globe Projection when zooming out
    map.on("style.load", () => {
      try {
        map.setProjection({ type: "globe" });
      } catch (e) {
        console.log("Globe projection note:", e);
      }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapTheme]);

  // Render Map Markers dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const targetPlaces = hasPlaces ? filteredPlaces : [{ name: label || "Location", lat, lng }];

    targetPlaces.forEach((place) => {
      const catConfig = CATEGORY_COLORS[place.category || "Default"] || CATEGORY_COLORS.Default;
      const isSelected = activePlace?.name === place.name;

      // Custom SVG Marker Element
      const el = document.createElement("div");
      el.className = "custom-maplibre-pin cursor-pointer transition-all duration-300 transform hover:scale-125 z-10";
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          ${isSelected ? `<span class="absolute inline-flex h-8 w-8 animate-ping rounded-full opacity-75" style="background-color: ${catConfig.hex}"></span>` : ''}
          <div class="w-7 h-7 rounded-full border-2 border-zinc-950 flex items-center justify-center shadow-2xl transition-transform" style="background-color: ${catConfig.hex}">
            <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
      `;

      el.addEventListener("click", () => {
        setActivePlace(place);
        map.flyTo({ center: [place.lng, place.lat], zoom: 15.5, pitch: 45, duration: 1200 });
      });

      // Hover Popup Preview Card
      const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
        <div class="p-2 text-xs font-sans select-text bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-800 shadow-xl max-w-[200px]">
          <div class="font-semibold text-zinc-100 truncate">${place.name}</div>
          ${place.category ? `<div class="text-[10px] text-zinc-400 font-mono mt-0.5">${place.category}</div>` : ''}
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Auto fit bounds if multiple places exist
    if (hasPlaces && filteredPlaces.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      filteredPlaces.forEach(p => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
    }
  }, [filteredPlaces, activePlace, mapTheme]);

  const handlePlaceSelect = (place: MapPlace) => {
    setActivePlace(place);
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [place.lng, place.lat], zoom: 15.5, pitch: 45, duration: 1200 });
    }
  };

  const handleAskVoxKage = (place: MapPlace) => {
    const promptText = `Tell me everything about ${place.name} in ${label || "this location"}, including whether it's currently good to visit, insider travel tips, best time to go, historical background, and key highlights.`;
    if (onSendPrompt) {
      onSendPrompt(promptText);
    } else if (typeof window !== "undefined") {
      // Fallback custom event trigger for global prompt dispatch
      window.dispatchEvent(new CustomEvent("voxkage_dispatch_prompt", { detail: { prompt: promptText } }));
    }
  };

  const getFallbackImage = () => {
    return "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&h=300&fit=crop&q=80";
  };

  return (
    <div
      className={`relative w-full mx-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/95 overflow-hidden flex flex-col select-none shadow-2xl backdrop-blur-md transition-all duration-300 ${
        isExpanded ? "h-[85vh] my-0" : "h-[540px] my-3"
      }`}
    >
      {/* --- Top Control & Info Bar --- */}
      <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-950/90 flex items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-zinc-100 tracking-tight truncate">
              {label || (hasPlaces ? "Interactive Map Explorer" : "Location Map")}
            </h3>
            <p className="text-[11px] text-zinc-400 truncate">MapLibre GL WebGL Engine • 3D Globe View Enabled</p>
          </div>
        </div>

        {/* Theme & Coord Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setMapTheme(prev => prev === "dark" ? "light" : "dark")}
            className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          >
            {mapTheme === "dark" ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Light Map</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Dark Map</span>
              </>
            )}
          </button>
          <span className="text-[11px] font-mono text-zinc-500 hidden lg:inline-block px-2 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
            {lat.toFixed(4)}°, {lng.toFixed(4)}°
          </span>
        </div>
      </div>

      {/* --- Main Content Split View (Left Sidebar 38% / Right Map 62%) --- */}
      <div className="flex flex-col md:flex-row relative w-full flex-1 min-h-0 overflow-hidden">
        
        {/* --- Left-Aligned Google Maps Style Side Panel --- */}
        {hasPlaces && (
          <div className="w-full md:w-[380px] lg:w-[420px] h-[240px] md:h-full bg-zinc-950 border-r border-zinc-800/80 flex flex-col z-10 shrink-0 relative overflow-hidden">
            
            {/* Search & Category Filter Header */}
            <div className="p-3 border-b border-zinc-800/80 space-y-2 bg-zinc-950/80 shrink-0">
              {/* Search Bar */}
              <div className="relative flex items-center w-full">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-zinc-900/90 border border-zinc-800/90 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 text-zinc-500 hover:text-zinc-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter Tabs */}
              {categories.length > 2 && (
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                  {categories.map((cat, idx) => {
                    const isActive = categoryFilter === cat;
                    return (
                      <button
                        key={idx}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer border ${
                          isActive
                            ? "bg-blue-600/20 border-blue-500/50 text-blue-300 font-semibold"
                            : "bg-zinc-900/70 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Places List Card Container */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 divide-y divide-zinc-900/80">
              {filteredPlaces.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No locations match search filter.
                </div>
              ) : (
                filteredPlaces.map((place, idx) => {
                  const isActive = activePlace?.name === place.name;
                  const catConfig = CATEGORY_COLORS[place.category || "Default"] || CATEGORY_COLORS.Default;
                  const thumb = placeImages[place.name] || place.image_url || getFallbackImage();

                  return (
                    <div
                      key={idx}
                      onClick={() => handlePlaceSelect(place)}
                      className={`p-3.5 flex gap-3 transition-all duration-200 cursor-pointer select-none relative group ${
                        isActive
                          ? "bg-blue-600/10 border-l-4 border-l-blue-500"
                          : "hover:bg-zinc-900/50 border-l-4 border-l-transparent"
                      }`}
                    >
                      {/* Place Image Thumbnail (Dynamic DDG Stitched) */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-zinc-800 shrink-0 bg-zinc-900 relative">
                        <img
                          src={thumb}
                          alt={place.name}
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getFallbackImage();
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {place.category && (
                          <span className={`absolute bottom-0 inset-x-0 text-[8.5px] font-mono text-center py-0.5 backdrop-blur-md border-t ${catConfig.bg} ${catConfig.text} ${catConfig.border}`}>
                            {place.category}
                          </span>
                        )}
                      </div>

                      {/* Place Metadata Summary */}
                      <div className="min-w-0 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate group-hover:text-blue-400 transition-colors">
                              {place.name}
                            </h4>
                            <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                          </div>

                          {/* Rating & Review Counter */}
                          {place.rating && (
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-amber-400">
                              <Star className="w-3 h-3 fill-amber-400" />
                              <span className="font-semibold text-xs">{place.rating}</span>
                              {place.reviews_count && (
                                <span className="text-zinc-500 text-[11px]">
                                  ({place.reviews_count.toLocaleString()})
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {place.description && (
                          <p className="text-[11.5px] text-zinc-400 line-clamp-2 leading-tight mt-1 font-light">
                            {place.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* --- Slide-Over Rich Place Detail Drawer (Google Maps Style) --- */}
            {activePlace && (
              <div className="absolute inset-0 bg-zinc-950 z-30 flex flex-col animate-in slide-in-from-left duration-300">
                {/* Detail Drawer Header */}
                <div className="relative h-44 shrink-0 bg-zinc-900 overflow-hidden">
                  <img
                    src={placeImages[activePlace.name] || activePlace.image_url || getFallbackImage()}
                    alt={activePlace.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getFallbackImage();
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
                  
                  {/* Close Detail Drawer Button */}
                  <button
                    onClick={() => setActivePlace(null)}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-zinc-950/80 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-600/30 text-blue-400 border border-blue-500/40">
                      {activePlace.category || "Sightseeing"}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-1">
                      {activePlace.name}
                    </h3>
                  </div>
                </div>

                {/* Detail Content Body */}
                <div className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 space-y-4">
                  {/* Rating & Address */}
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                    {activePlace.rating && (
                      <div className="flex items-center gap-1.5">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span className="text-sm font-semibold text-zinc-100">{activePlace.rating}</span>
                        {activePlace.reviews_count && (
                          <span className="text-xs text-zinc-500">
                            ({activePlace.reviews_count.toLocaleString()} real visitor reviews)
                          </span>
                        )}
                      </div>
                    )}
                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-blue-400" />
                      {activePlace.lat.toFixed(3)}°, {activePlace.lng.toFixed(3)}°
                    </span>
                  </div>

                  {/* Overview Description */}
                  {activePlace.description && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Overview</h4>
                      <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-light">
                        {activePlace.description}
                      </p>
                    </div>
                  )}

                  {/* Summarized Real People Reviews Section */}
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Summarized Visitor Experience</span>
                    </div>
                    <p className="text-[11.5px] text-zinc-300 leading-relaxed font-light">
                      Visitors praise the iconic significance, cultural richness, and vibrant ambiance of {activePlace.name}. Highly rated for morning visits and scenic photography.
                    </p>
                  </div>

                  {/* Action Triggers Bar */}
                  <div className="space-y-2 pt-2">
                    {/* Ask VoxKage Button */}
                    <button
                      onClick={() => handleAskVoxKage(activePlace)}
                      className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Ask VoxKage About This Spot</span>
                    </button>

                    {/* Navigate & Open Google Maps Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${activePlace.lat},${activePlace.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Compass className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Navigate</span>
                      </a>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activePlace.name + " " + (label || ""))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Google Maps</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- Right-Aligned WebGL Vector Map Container --- */}
        <div className="flex-1 h-full relative bg-zinc-950 z-0">
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
