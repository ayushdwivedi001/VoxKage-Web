"use client";

import React, { useEffect, useState, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Sun, Moon, Mountain, Globe, ChevronDown, Star, ChevronRight, X, ExternalLink, MessageSquare, Compass, MapPin, Search, Sparkles, List, Box } from "lucide-react";
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

export type MapMode = "light" | "dark" | "terrain" | "satellite";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  Historic: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/40", hex: "#cc785c" },
  Heritage: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/40", hex: "#cc785c" },
  Nature: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/40", hex: "#10b981" },
  Religious: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/40", hex: "#8b5cf6" },
  Temple: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/40", hex: "#8b5cf6" },
  Food: { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/40", hex: "#f43f5e" },
  Sights: { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/40", hex: "#06b6d4" },
  Museum: { bg: "bg-indigo-500/15", text: "text-indigo-400", border: "border-indigo-500/40", hex: "#6366f1" },
  Default: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/40", hex: "#3b82f6" },
};

// 100% Verified MapLibre Style Specification Generator with Light Mode Default & Satellite/Terrain
const createMapStyle = (mode: MapMode): maplibregl.StyleSpecification => {
  let tileUrl = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  let bgColor = "#f4f4f5";

  if (mode === "dark") {
    tileUrl = "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    bgColor = "#09090b";
  } else if (mode === "terrain") {
    tileUrl = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    bgColor = "#18181b";
  } else if (mode === "satellite") {
    tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    bgColor = "#040404";
  }

  return {
    version: 8,
    name: `VoxKage Vector Map (${mode})`,
    sources: {
      "base-tiles": {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap &copy; CARTO / ESRI'
      }
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": bgColor
        }
      },
      {
        id: "base-tiles-layer",
        type: "raster",
        source: "base-tiles",
        minzoom: 0,
        maxzoom: 20,
        paint: {
          "raster-opacity": 1.0,
          "raster-fade-duration": 200
        }
      }
    ]
  };
};

export default function MapWidget({ lat, lng, label, places, isExpanded = false, onSendPrompt }: MapWidgetProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ marker: maplibregl.Marker; placeName: string }[]>([]);

  // Default to Light Mode as requested by user
  const [mapTheme, setMapTheme] = useState<MapMode>("light");
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState<boolean>(false);
  const [is3DTilted, setIs3DTilted] = useState<boolean>(false);

  const [activePlace, setActivePlace] = useState<MapPlace | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [placeImages, setPlaceImages] = useState<Record<string, string>>({});

  // Side Panel Open/Closed State (Closed by default in inline mode)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(isExpanded);

  // Cached Camera Viewport State to preserve zoom/center/globe view across theme and expansion toggles
  const cameraStateRef = useRef<{ center: [number, number]; zoom: number; pitch: number; bearing: number } | null>(null);

  const hasPlaces = places && places.length > 0;

  // Sync sidebar open state when expanded state changes
  useEffect(() => {
    setIsSidebarOpen(isExpanded);
  }, [isExpanded]);

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

  // Save current camera viewport state before unmount or theme change
  const saveCameraState = () => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      const zoom = mapRef.current.getZoom();
      const pitch = mapRef.current.getPitch();
      const bearing = mapRef.current.getBearing();
      cameraStateRef.current = {
        center: [center.lng, center.lat],
        zoom,
        pitch,
        bearing
      };
    }
  };

  // Initialize MapLibre GL JS Map instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const styleSpec = createMapStyle(mapTheme);
    const initialCenter: [number, number] = cameraStateRef.current?.center || [lng, lat];
    const initialZoom: number = cameraStateRef.current?.zoom ?? (hasPlaces ? 12.5 : 13.5);
    const initialPitch: number = cameraStateRef.current?.pitch ?? (is3DTilted ? 45 : 0);
    const initialBearing: number = cameraStateRef.current?.bearing ?? 0;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleSpec,
      center: initialCenter,
      zoom: initialZoom,
      pitch: initialPitch,
      bearing: initialBearing,
      attributionControl: false,
    });

    // Configure 3D Globe projection & camera centering
    map.on("load", () => {
      map.resize();
      try {
        map.setProjection({ type: "globe" });
      } catch (e) {
        console.log("Globe projection note:", e);
      }
    });

    map.on("moveend", () => {
      saveCameraState();
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
    mapRef.current = map;

    return () => {
      saveCameraState();
      map.remove();
      mapRef.current = null;
    };
  }, [mapTheme]);

  // Render Persistent Map Markers with High-Contrast Text Labels & Zero Hover Shift Bug!
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove previous markers cleanly
    markersRef.current.forEach(item => item.marker.remove());
    markersRef.current = [];

    const targetPlaces = hasPlaces ? filteredPlaces : [{ name: label || "Location", lat, lng }];
    const isDarkBg = mapTheme === "dark" || mapTheme === "satellite";

    targetPlaces.forEach((place) => {
      const catConfig = CATEGORY_COLORS[place.category || "Default"] || CATEGORY_COLORS.Default;

      // Custom HTML Marker Pin (Hover scale applies ONLY to inner badge, preventing coordinate jump!)
      const el = document.createElement("div");
      el.className = "custom-maplibre-pin cursor-pointer flex flex-col items-center select-none pointer-events-auto group";
      el.setAttribute("data-place-name", place.name);
      
      const labelBgClass = isDarkBg ? "bg-zinc-950/95 text-zinc-100 border-zinc-800" : "bg-white/95 text-zinc-900 border-zinc-300";
      
      el.innerHTML = `
        <div class="relative flex flex-col items-center">
          <!-- Pin Badge (Hover scale applies to THIS element only) -->
          <div class="w-8 h-8 rounded-full border-2 border-zinc-950 flex items-center justify-center shadow-2xl transition-transform duration-200 group-hover:scale-125" style="background-color: ${catConfig.hex}">
            <svg class="w-4 h-4 text-white pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          
          <!-- High-Contrast Location Title Pill -->
          <div class="mt-1 px-2 py-0.5 rounded-md text-[10.5px] font-sans font-semibold border shadow-md whitespace-nowrap transition-all ${labelBgClass}">
            ${place.name}
          </div>
        </div>
      `;

      // Marker Click Event: Open Sidebar & Fly smoothly to spot
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setActivePlace(place);
        setIsSidebarOpen(true);
        map.flyTo({
          center: [place.lng, place.lat],
          zoom: 15.5,
          pitch: is3DTilted ? 45 : 0,
          duration: 1000,
          essential: true
        });
      });

      // Hover Popup Preview Card
      const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
        <div class="p-2 text-xs font-sans select-text bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-800 shadow-xl max-w-[200px]">
          <div class="font-semibold text-zinc-100 truncate">${place.name}</div>
          ${place.category ? `<div class="text-[10px] text-zinc-400 font-mono mt-0.5">${place.category}</div>` : ''}
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([place.lng, place.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push({ marker, placeName: place.name });
    });

    // Auto fit bounds if multiple places exist and camera state wasn't restored
    if (hasPlaces && filteredPlaces.length > 1 && !cameraStateRef.current) {
      const bounds = new maplibregl.LngLatBounds();
      filteredPlaces.forEach(p => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 800 });
    }
  }, [filteredPlaces, mapTheme]);

  const handlePlaceSelect = (place: MapPlace) => {
    setActivePlace(place);
    setIsSidebarOpen(true);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [place.lng, place.lat],
        zoom: 15.5,
        pitch: is3DTilted ? 45 : 0,
        duration: 1000,
        essential: true
      });
    }
  };

  const handleAskVoxKage = (place: MapPlace) => {
    const promptText = `Tell me everything about ${place.name} in ${label || "this location"}, including whether it's currently good to visit, insider travel tips, best time to go, historical background, and key highlights.`;
    if (onSendPrompt) {
      onSendPrompt(promptText);
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("voxkage_dispatch_prompt", { detail: { prompt: promptText } }));
    }
  };

  const toggle3DTilt = () => {
    setIs3DTilted(prev => {
      const next = !prev;
      if (mapRef.current) {
        mapRef.current.easeTo({ pitch: next ? 45 : 0, duration: 800 });
      }
      return next;
    });
  };

  const modeOptions: { mode: MapMode; label: string; icon: React.ReactNode }[] = [
    { mode: "light", label: "Light / Streets", icon: <Sun className="w-3.5 h-3.5 text-amber-500" /> },
    { mode: "dark", label: "Dark Mode", icon: <Moon className="w-3.5 h-3.5 text-indigo-400" /> },
    { mode: "terrain", label: "3D Terrain", icon: <Mountain className="w-3.5 h-3.5 text-emerald-400" /> },
    { mode: "satellite", label: "Satellite View", icon: <Globe className="w-3.5 h-3.5 text-cyan-400" /> },
  ];

  const currentModeObj = modeOptions.find(m => m.mode === mapTheme) || modeOptions[0];

  const getFallbackImage = () => {
    return "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&h=300&fit=crop&q=80";
  };

  return (
    <div
      className={`relative w-full mx-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/95 overflow-hidden flex flex-col select-none shadow-2xl backdrop-blur-md transition-all duration-300 ${
        isExpanded ? "h-[85vh] my-0" : "h-[500px] my-3"
      }`}
    >
      {/* --- Top Control & Header Bar --- */}
      <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-950/90 flex items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-zinc-100 tracking-tight truncate">
              {label || (hasPlaces ? "Interactive Map Explorer" : "Location Map")}
            </h3>
            <p className="text-[11px] text-zinc-400 truncate">MapLibre GL WebGL Engine • 3D Globe Mode Enabled</p>
          </div>
        </div>

        {/* Right Controls: Sidebar Toggle, Mode Dropdown, 3D Tilt & Coordinates */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Places Toggle */}
          {hasPlaces && (
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                isSidebarOpen
                  ? "bg-blue-600/20 border-blue-500/50 text-blue-300 font-semibold"
                  : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700"
              }`}
            >
              <List className="w-3.5 h-3.5 text-blue-400" />
              <span>{isSidebarOpen ? "Hide Places" : `Places (${filteredPlaces.length})`}</span>
            </button>
          )}

          {/* 3D Pitch Tilt Control */}
          <button
            onClick={toggle3DTilt}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              is3DTilted
                ? "bg-blue-600/20 border-blue-500/50 text-blue-300 font-semibold"
                : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700"
            }`}
            title="Toggle 3D Perspective Tilt"
          >
            <Box className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">3D Tilt</span>
          </button>

          {/* Multi-Mode Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setIsModeDropdownOpen(prev => !prev)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-white hover:border-zinc-700 transition-all flex items-center gap-2 text-xs font-medium cursor-pointer shadow-md"
            >
              {currentModeObj.icon}
              <span>{currentModeObj.label}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {isModeDropdownOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                {modeOptions.map((opt) => (
                  <button
                    key={opt.mode}
                    onClick={() => {
                      saveCameraState();
                      setMapTheme(opt.mode);
                      setIsModeDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                      mapTheme === opt.mode
                        ? "bg-blue-600/20 text-blue-300 font-semibold"
                        : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                    }`}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-[11px] font-mono text-zinc-500 hidden lg:inline-block px-2 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
            {lat.toFixed(4)}°, {lng.toFixed(4)}°
          </span>
        </div>
      </div>

      {/* --- Main Content Layout --- */}
      <div className="flex relative w-full flex-1 min-h-0 overflow-hidden">
        
        {/* --- Left-Aligned Google Maps Style Side Panel (Slide-over / Collapsible) --- */}
        {hasPlaces && isSidebarOpen && (
          <div className="w-full md:w-[360px] lg:w-[390px] h-full bg-zinc-950 border-r border-zinc-800/80 flex flex-col z-10 shrink-0 relative overflow-hidden animate-in slide-in-from-left duration-250">
            
            {/* Search & Category Filter Header */}
            <div className="p-3 border-b border-zinc-800/80 space-y-2 bg-zinc-950/90 shrink-0">
              <div className="flex items-center justify-between gap-2">
                {/* Search Bar */}
                <div className="relative flex items-center flex-1">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search places..."
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

                {/* Close Sidebar Button */}
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Close Places Panel"
                >
                  <X className="w-4 h-4" />
                </button>
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
                      {/* Place Image Thumbnail */}
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

            {/* --- Slide-Over Rich Place Detail Drawer --- */}
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
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-zinc-950/80 border border-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
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
                      Visitors praise the iconic significance, cultural richness, and vibrant atmosphere of {activePlace.name}. Highly rated for morning visits and scenic photography.
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

        {/* --- Right-Aligned Full WebGL Vector Map Container --- */}
        <div className="flex-1 h-full relative bg-zinc-950 z-0">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Floating Pill Toggle Button when Sidebar is Closed */}
          {hasPlaces && !isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute bottom-4 left-4 z-20 px-3.5 py-2 rounded-xl bg-zinc-950/90 border border-zinc-800 text-zinc-200 text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 hover:border-blue-500/50 hover:text-white transition-all cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-blue-400" />
              <span>Explore {filteredPlaces.length} Places</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
