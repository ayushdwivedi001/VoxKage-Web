"use client";

import React from "react";
import { Check } from "lucide-react";

interface VariantSubPopupProps {
  selectedVariant: string;
  onSelectVariant: (variant: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const VARIANTS = ["Low", "Medium", "High", "Max"];

export default function VariantSubPopup({
  selectedVariant,
  onSelectVariant,
  onMouseEnter,
  onMouseLeave,
}: VariantSubPopupProps) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed inset-x-3 bottom-24 w-auto sm:absolute sm:inset-auto sm:bottom-0 sm:right-[304px] sm:w-[280px] rounded-2xl fluid-glass-popup p-4 shadow-2xl z-[90] select-none flex flex-col font-sans animate-fadeIn text-zinc-300 border border-white/10"
    >
      {/* Header Description */}
      <span className="text-[11.5px] leading-relaxed text-zinc-400 font-normal border-b border-white/10 pb-3.5 mb-2.5">
        Higher effort means more thorough responses, but takes longer and uses your limits faster.
      </span>

      {/* Options List */}
      <div className="flex flex-col gap-0.5">
        {VARIANTS.map((v) => {
          const isSelected = selectedVariant === v;

          return (
            <button
              key={v}
              type="button"
              onClick={() => onSelectVariant(v)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-xl hover:bg-white/10 transition-all duration-200 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-medium text-zinc-100">{v}</span>
                {v === "Low" && (
                  <span className="text-[10px] text-zinc-400 font-normal px-1.5 py-0.5 bg-white/10 border border-white/10 rounded">
                    Default
                  </span>
                )}
              </div>
              {isSelected && <Check className="w-4 h-4 text-blue-400 stroke-[2.5]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
