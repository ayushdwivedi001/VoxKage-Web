"use client";

import React, { useState } from "react";
import { Star, X, Check, Search, Layers, ChevronDown } from "lucide-react";

export interface ModelOption {
  name: string;
  desc: string;
  provider?: "opencode" | "kilo" | string;
  unavailable?: boolean;
  requiresUpgrade?: boolean;
  isFavourite?: boolean;
}

interface MoreModelsModalProps {
  selectedModel: string;
  modelsList: ModelOption[];
  hasKiloProvider?: boolean;
  onSelectModel: (model: string) => void;
  onToggleFavourite: (name: string) => void;
  onClose: () => void;
}

export default function MoreModelsModal({
  selectedModel,
  modelsList,
  hasKiloProvider = false,
  onSelectModel,
  onToggleFavourite,
  onClose,
}: MoreModelsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<"opencode" | "kilo">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("voxkage_selected_provider_filter");
      if (saved === "kilo" || saved === "opencode") return saved;
    }
    return "opencode";
  });
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);

  const handleSelectProvider = (provider: "opencode" | "kilo") => {
    setSelectedProviderFilter(provider);
    if (typeof window !== "undefined") {
      localStorage.setItem("voxkage_selected_provider_filter", provider);
    }
    setShowProviderDropdown(false);
  };

  // Filter models based on search query
  const searchFiltered = modelsList.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Favourites section shows ALL favorited models matching search, regardless of provider filter
  const favourites = searchFiltered.filter((m) => m.isFavourite);

  // All Models section strictly filters ONLY by the selected provider (OpenCode vs Kilo)
  const otherModels = searchFiltered.filter((m) => {
    if (m.isFavourite) return false;
    const modelProvider = m.provider || "opencode";
    return modelProvider === selectedProviderFilter;
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-[#121216] border border-zinc-800 rounded-2xl flex flex-col shadow-2xl z-10 max-h-[80vh] overflow-hidden select-none font-sans text-zinc-300 animate-fadeIn">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80">
          <span className="text-base font-semibold text-zinc-100">Select Model</span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar & Provider Dropdown Row */}
        <div className="px-5 py-3 border-b border-zinc-800/40 bg-zinc-900/20 flex flex-col gap-2.5">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models..."
              className="w-full bg-zinc-900/40 border border-zinc-800/80 rounded-xl py-2 pl-9 pr-4 text-[13.5px] text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-700/80 transition-colors"
            />
          </div>

          {/* PROVIDER FILTER DROPDOWN */}
          <div className="relative flex items-center justify-between px-1">
            <span className="text-[11.5px] text-zinc-400 font-medium flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span>Provider:</span>
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[12px] font-medium text-zinc-200 transition-all cursor-pointer"
              >
                <span>
                  {selectedProviderFilter === "kilo" ? "Kilo Code API" : "OpenCode Zen"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {showProviderDropdown && (
                <div className="absolute right-0 top-full mt-1 w-[160px] bg-[#16161b] border border-zinc-800 rounded-xl p-1 shadow-2xl z-[120] flex flex-col gap-0.5 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => handleSelectProvider("opencode")}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer text-left"
                  >
                    <span>OpenCode Zen</span>
                    {selectedProviderFilter === "opencode" && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                  {hasKiloProvider && (
                    <button
                      type="button"
                      onClick={() => handleSelectProvider("kilo")}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer text-left"
                    >
                      <span>Kilo Code API</span>
                      {selectedProviderFilter === "kilo" && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Models Scroll Area */}
        <div className="flex-grow overflow-y-auto p-3.5 custom-vscode-scrollbar flex flex-col gap-4">
          {/* Favourites Section */}
          {favourites.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 tracking-wider uppercase">
                <Star className="w-3 h-3 text-zinc-400" />
                <span>Favourites</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {favourites.map((model) => {
                  const isSelected = selectedModel === model.name;
                  const isClickable = !model.unavailable;
                  const providerLabel = model.provider === "kilo" ? "Kilo" : "OpenCode";

                  return (
                    <button
                      key={model.name}
                      type="button"
                      disabled={model.unavailable}
                      onClick={() => {
                        if (isClickable) {
                          onSelectModel(model.name);
                          onClose();
                        }
                      }}
                      className={`flex w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 ${
                        model.unavailable
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-zinc-800/60 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start w-full">
                        {/* Solid White Star for Favourites */}
                        <Star
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavourite(model.name);
                          }}
                          className="w-3.5 h-3.5 mr-2.5 mt-[3px] text-white fill-white transition-all duration-150 active:scale-[0.85] flex-shrink-0 cursor-pointer"
                        />
                        
                        <div className="flex-grow flex flex-col">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span className="text-[13.5px] font-medium text-zinc-200">
                                {model.name}
                              </span>
                              {/* Provider Tag on Favourites */}
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium border bg-zinc-800 text-zinc-300 border-zinc-700">
                                {providerLabel}
                              </span>
                            </div>
                            {isSelected ? (
                              <Check className="w-4 h-4 text-blue-500 stroke-[2.5]" />
                            ) : model.requiresUpgrade ? (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/30">
                                Upgrade
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[11.5px] text-zinc-500 font-normal mt-0.5">
                            {model.desc}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Other Models Section */}
          {otherModels.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 tracking-wider uppercase border-t border-zinc-800/40 pt-4 mt-2">
                <span>All Models</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {otherModels.map((model) => {
                  const isSelected = selectedModel === model.name;
                  const isClickable = !model.unavailable;

                  return (
                    <button
                      key={model.name}
                      type="button"
                      disabled={model.unavailable}
                      onClick={() => {
                        if (isClickable) {
                          onSelectModel(model.name);
                          onClose();
                        }
                      }}
                      className={`flex w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 ${
                        model.unavailable
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-zinc-800/60 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start w-full">
                        {/* Hollow Star Border for All Models */}
                        <Star
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavourite(model.name);
                          }}
                          className="w-3.5 h-3.5 mr-2.5 mt-[3px] text-zinc-600 hover:text-zinc-300 hover:scale-110 transition-all duration-150 active:scale-[0.85] flex-shrink-0 cursor-pointer"
                        />
                        
                        <div className="flex-grow flex flex-col">
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[13.5px] font-medium text-zinc-200">
                              {model.name}
                            </span>
                            {isSelected ? (
                              <Check className="w-4 h-4 text-blue-500 stroke-[2.5]" />
                            ) : model.requiresUpgrade ? (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/30">
                                Upgrade
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[11.5px] text-zinc-500 font-normal mt-0.5">
                            {model.desc}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty search results state */}
          {searchFiltered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-500">
              <span className="text-[13.5px] font-normal">No models found for query</span>
            </div>
          )}
        </div>
      </div>

      {/* VS Code Scrollbar style overrides */}
      <style>{`
        .custom-vscode-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-vscode-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-vscode-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }
        .custom-vscode-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.16);
        }
      `}</style>
    </div>
  );
}
