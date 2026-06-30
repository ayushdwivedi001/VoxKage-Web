"use client";

import React from "react";
import { Star, ChevronRight, Check } from "lucide-react";

interface ModelOption {
  name: string;
  desc: string;
  unavailable?: boolean;
  requiresUpgrade?: boolean;
  isFavourite?: boolean;
}

interface ModelSelectorDropdownProps {
  selectedModel: string;
  selectedVariant: string;
  modelsList: ModelOption[];
  onSelectModel: (model: string) => void;
  onOpenMoreModels: () => void;
  onMouseEnterVariant: () => void;
  onMouseLeaveVariant: () => void;
}

export default function ModelSelectorDropdown({
  selectedModel,
  selectedVariant,
  modelsList,
  onSelectModel,
  onOpenMoreModels,
  onMouseEnterVariant,
  onMouseLeaveVariant,
}: ModelSelectorDropdownProps) {
  // Filter favourite models dynamically from props
  const favourites = modelsList.filter((m) => m.isFavourite);

  return (
    <div className="absolute bottom-full mb-2 right-0 w-[300px] rounded-2xl border border-zinc-800 bg-[#18181c] p-1.5 shadow-2xl z-40 select-none flex flex-col font-sans animate-fadeIn text-zinc-300">
      {/* Favourite Models Section */}
      <div className="flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-semibold text-zinc-500 tracking-wider uppercase border-b border-zinc-800/60 mb-1">
        <Star className="w-3.5 h-3.5 text-zinc-400 stroke-[2]" />
        <span>Favourite models</span>
      </div>

      {/* Models List Scroll Container */}
      <div className="flex flex-col gap-0.5 max-h-[220px] overflow-y-auto custom-vscode-scrollbar pr-0.5">
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
                }
              }}
              className={`flex flex-col w-full text-left px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
                model.unavailable
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-zinc-800/60 cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[13.5px] font-medium text-zinc-200">
                  {model.name}
                </span>
                
                {/* Checkmark or Upgrade badge */}
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
            </button>
          );
        })}
      </div>

      {/* Separator line */}
      <div className="border-t border-zinc-800/60 my-1" />

      {/* Variant Row Button */}
      <button
        type="button"
        onMouseEnter={onMouseEnterVariant}
        onMouseLeave={onMouseLeaveVariant}
        className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl hover:bg-zinc-800/60 transition-all duration-200 text-left cursor-pointer"
      >
        <span className="text-[13.5px] font-medium text-zinc-200">Variant</span>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <span className="text-[13px] font-normal text-zinc-500">{selectedVariant}</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-70" />
        </div>
      </button>

      {/* More models Row Button */}
      <button
        type="button"
        onClick={onOpenMoreModels}
        className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl hover:bg-zinc-800/60 transition-all duration-200 text-left cursor-pointer"
      >
        <span className="text-[13.5px] font-medium text-zinc-200">More models</span>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-400 opacity-70" />
      </button>

      {/* Sleek VS Code style scrollbar overrides */}
      <style>{`
        .custom-vscode-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
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
