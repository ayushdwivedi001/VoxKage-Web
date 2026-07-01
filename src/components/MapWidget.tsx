import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Navigation, Sun, Moon, Star, ChevronRight } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapPlace {
  name: string;
  lat: number;
  lng: number;
  rating?: number;
  reviews_count?: number;
  description?: string;
  category?: string;
  image_url?: string;
}

interface MapWidgetProps {
  lat: number;
  lng: number;
  label?: string;
  places?: MapPlace[];
}

// Controller component to pan Leaflet map reactively
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1.0 });
  }, [center, zoom, map]);
  return null;
}

export default function MapWidget({ lat, lng, label, places }: MapWidgetProps) {
  const [customIcon, setCustomIcon] = useState<L.DivIcon | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [mapTheme, setMapTheme] = useState<"dark" | "light">("dark");
  const [activePlace, setActivePlace] = useState<MapPlace | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([lat, lng]);
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  // Keep center synchronized if props update
  useEffect(() => {
    setMapCenter([lat, lng]);
  }, [lat, lng]);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== "undefined") {
      // Create a premium custom pulsing dot icon for the map marker
      const icon = L.divIcon({
        className: "custom-map-pin-container",
        html: `
          <div class="relative flex items-center justify-center w-6 h-6">
            <span class="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-blue-500/30 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500 border-2 border-zinc-950 shadow-lg"></span>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -10]
      });
      setCustomIcon(icon);
    }
  }, []);

  if (!isClient) {
    return (
      <div className="w-full max-w-[850px] mx-auto h-[480px] rounded-2xl border border-zinc-850/60 bg-zinc-950/20 flex items-center justify-center text-zinc-500 font-sans text-[13.5px]">
        Loading map resources...
      </div>
    );
  }

  // Extract unique categories from places
  const categories = places 
    ? ["All", ...Array.from(new Set(places.map(p => p.category).filter(Boolean))) as string[]]
    : ["All"];

  // Filter places list
  const filteredPlaces = places
    ? categoryFilter === "All"
      ? places
      : places.filter(p => p.category === categoryFilter)
    : [];

  const handlePlaceSelect = (place: MapPlace) => {
    setActivePlace(place);
    setMapCenter([place.lat, place.lng]);
    setMapZoom(15);
  };

  const getPlaceholderImage = (place: MapPlace) => {
    return `https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=120&h=120&fit=crop&q=80`;
  };

  const hasPlaces = places && places.length > 0;

  return (
    <div 
      style={{
        "--map-popup-bg": mapTheme === "dark" ? "#0c0c0e" : "#ffffff",
        "--map-popup-color": mapTheme === "dark" ? "#e4e4e7" : "#18181b",
        "--map-popup-border": mapTheme === "dark" ? "#27272a" : "#e4e4e7",
        "--map-zoom-bg": mapTheme === "dark" ? "#0c0c0e" : "#ffffff",
        "--map-zoom-color": mapTheme === "dark" ? "#a1a1aa" : "#4b5563",
        "--map-zoom-border": mapTheme === "dark" ? "#27272a" : "#e4e4e7",
      } as React.CSSProperties}
      className="relative w-full max-w-[850px] mx-auto my-4 rounded-2xl border border-zinc-850/60 bg-[#0e0e12]/80 backdrop-blur-md overflow-hidden flex flex-col group/map select-none shadow-2xl transition-all duration-300"
    >
      {/* Map Header Panel */}
      <div className="p-3.5 border-b border-zinc-850/40 bg-zinc-950/50 flex items-center gap-2 select-text">
        <Navigation className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span className="text-[13.5px] font-semibold text-zinc-300 truncate flex-grow">
          {label || (hasPlaces ? "Interactive Map Explorer" : "Interactive Map")}
        </span>
        
        {/* Theme Toggle Switcher */}
        <button 
          onClick={() => setMapTheme(prev => prev === "dark" ? "light" : "dark")}
          className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all select-none mr-2 flex items-center gap-1.5 text-[11px] px-2.5 font-medium"
        >
          {mapTheme === "dark" ? (
            <>
              <Sun className="w-3 h-3 text-amber-400" />
              <span>Light Map</span>
            </>
          ) : (
            <>
              <Moon className="w-3 h-3 text-indigo-400" />
              <span>Dark Map</span>
            </>
          )}
        </button>

        <span className="text-[11px] font-mono text-zinc-500">
          {lat.toFixed(4)}°, {lng.toFixed(4)}°
        </span>
      </div>

      {/* Main Split Content Area */}
      <div className="flex flex-col md:flex-row h-[460px] relative w-full">
        {/* Map Panel (Left side 60% on desktop, full on mobile) */}
        <div className={`w-full ${hasPlaces ? "md:w-[60%]" : "w-full"} h-[280px] md:h-full relative bg-zinc-900/50 z-0`}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom={true}
            style={{ width: "100%", height: "100%", background: mapTheme === "dark" ? "#0e0e11" : "#f4f4f5" }}
          >
            <MapController center={mapCenter} zoom={mapZoom} />
            
            {/* CartoDB Map Tiles */}
            <TileLayer
              key={mapTheme}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url={mapTheme === "dark" 
                ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              }
              subdomains="abcd"
              maxZoom={20}
            />

            {/* Custom Markers */}
            {customIcon && (
              <>
                {/* Fallback Single Location Pin */}
                {!hasPlaces && (
                  <Marker position={[lat, lng]} icon={customIcon}>
                    <Popup>
                      <div className="text-[13px] font-sans font-semibold p-0.5">
                        {label || "Map Location"}
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Multiple Places Pins */}
                {hasPlaces && places.map((place, idx) => (
                  <Marker 
                    key={idx} 
                    position={[place.lat, place.lng]} 
                    icon={customIcon}
                    eventHandlers={{
                      click: () => handlePlaceSelect(place)
                    }}
                  >
                    <Popup>
                      <div className="text-[13px] font-sans flex flex-col gap-1 max-w-[180px] p-0.5 select-text">
                        <span className="font-semibold text-zinc-250 leading-tight">{place.name}</span>
                        {place.rating && (
                          <div className="flex items-center gap-1 text-[11px] text-amber-400">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span className="font-semibold">{place.rating}</span>
                          </div>
                        )}
                        {place.description && (
                          <span className="text-[11px] text-zinc-400 leading-normal">{place.description}</span>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </>
            )}
          </MapContainer>
        </div>

        {/* Explorer Sidebar Panel (Right side 40% on desktop) */}
        {hasPlaces && (
          <div className="w-full md:w-[40%] h-[180px] md:h-full bg-[#111115]/95 border-t md:border-t-0 md:border-l border-zinc-850/50 flex flex-col z-10">
            {/* Category Filter Tabs */}
            {categories.length > 2 && (
              <div className="flex gap-1.5 p-2 px-3 border-b border-zinc-850/40 overflow-x-auto custom-scrollbar flex-shrink-0 bg-zinc-950/20">
                {categories.map((cat, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all select-none border whitespace-nowrap ${
                      categoryFilter === cat
                        ? "bg-blue-600/10 border-blue-500/40 text-blue-400"
                        : "bg-zinc-900/60 border-zinc-850 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Places Card List */}
            <div className="flex-grow overflow-y-auto custom-scrollbar bg-zinc-950/5">
              {filteredPlaces.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[12px] text-zinc-500">
                  No places match filter category.
                </div>
              ) : (
                filteredPlaces.map((place, idx) => {
                  const isActive = activePlace?.name === place.name;
                  const thumbUrl = place.image_url 
                    ? `https://images.weserv.nl/?url=${encodeURIComponent(place.image_url)}&w=80&h=80&fit=cover`
                    : getPlaceholderImage(place);
                  
                  return (
                    <div
                      key={idx}
                      onClick={() => handlePlaceSelect(place)}
                      className={`flex gap-3 p-3 border-b border-zinc-850/30 transition-all duration-200 cursor-pointer select-none items-start relative ${
                        isActive
                          ? "bg-blue-600/5 border-l-2 border-l-blue-500"
                          : "hover:bg-zinc-900/30 border-l-2 border-l-transparent"
                      }`}
                    >
                      {/* Place Image Thumbnail */}
                      <div className="w-[60px] h-[60px] rounded-lg overflow-hidden border border-zinc-800 flex-shrink-0 bg-zinc-900 relative">
                        <img 
                          src={thumbUrl} 
                          alt={place.name} 
                          className="w-full h-full object-cover grayscale-[30%] hover:grayscale-0 transition duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getPlaceholderImage(place);
                          }}
                        />
                        {place.category && (
                          <span className="absolute bottom-0 left-0 right-0 text-[8.5px] text-center bg-zinc-950/85 text-zinc-400 border-t border-zinc-900/60 py-0.5 truncate font-mono">
                            {place.category}
                          </span>
                        )}
                      </div>

                      {/* Place Text Highlights */}
                      <div className="flex flex-col gap-0.5 min-w-0 flex-grow select-text">
                        <div className="flex justify-between items-start gap-1">
                          <span className="text-[12.5px] font-semibold text-zinc-250 truncate">
                            {place.name}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-600 mt-0.5 flex-shrink-0" />
                        </div>

                        {place.rating && (
                          <div className="flex items-center gap-1 text-[11px] text-amber-400">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span className="font-semibold">{place.rating}</span>
                            {place.reviews_count && (
                              <span className="text-zinc-550 text-[10.5px]">
                                ({place.reviews_count.toLocaleString()})
                              </span>
                            )}
                          </div>
                        )}

                        {place.description && (
                          <span className="text-[11.5px] text-zinc-400 font-light leading-tight line-clamp-2 mt-0.5">
                            {place.description}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Inject custom leaflet styles mapping CSS theme variables */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #202024;
          border-radius: 9999px;
          transition: background 0.2s;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #33333b;
        }
        
        .leaflet-popup-content-wrapper {
          background-color: var(--map-popup-bg) !important;
          color: var(--map-popup-color) !important;
          border: 1px solid var(--map-popup-border) !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4) !important;
        }
        .leaflet-popup-tip {
          background-color: var(--map-popup-bg) !important;
          border: 1px solid var(--map-popup-border) !important;
        }
        .leaflet-container a.leaflet-popup-close-button {
          color: var(--map-zoom-color) !important;
          top: 6px !important;
          right: 6px !important;
        }
        .leaflet-bar {
          border: 1px solid var(--map-zoom-border) !important;
          border-radius: 8px !important;
          overflow: hidden !important;
          box-shadow: none !important;
        }
        .leaflet-bar a {
          background-color: var(--map-zoom-bg) !important;
          color: var(--map-zoom-color) !important;
          border-bottom: 1px solid var(--map-zoom-border) !important;
          transition: background 0.2s, color 0.2s;
        }
        .leaflet-bar a:hover {
          background-color: ${mapTheme === "dark" ? "#18181b" : "#f4f4f5"} !important;
          color: ${mapTheme === "dark" ? "#e4e4e7" : "#09090b"} !important;
        }
        .leaflet-control-attribution {
          background: ${mapTheme === "dark" ? "rgba(12, 12, 14, 0.75)" : "rgba(255, 255, 255, 0.75)"} !important;
          color: #71717a !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a {
          color: #3b82f6 !important;
        }
      `}</style>
    </div>
  );
}
