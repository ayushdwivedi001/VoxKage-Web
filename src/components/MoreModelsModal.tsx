"use client";

import React, { useState } from "react";
import { Star, X, Check, Search } from "lucide-react";

interface ModelOption {
  name: string;
  desc: string;
  unavailable?: boolean;
  requiresUpgrade?: boolean;
  isFavourite?: boolean;
}

interface MoreModelsModalProps {
  selectedModel: string;
  modelsList: ModelOption[];
  onSelectModel: (model: string) => void;
  onToggleFavourite: (name: string) => void;
  onClose: () => void;
}

export default function MoreModelsModal({
  selectedModel,
  modelsList,
  onSelectModel,
  onToggleFavourite,
  onClose,
}: MoreModelsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredModels = modelsList.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const favourites = filteredModels.filter((m) => m.isFavourite);
  const otherModels = filteredModels.filter((m) => !m.isFavourite);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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

        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-zinc-800/40 bg-zinc-900/20">
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
          {filteredModels.length === 0 && (
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
