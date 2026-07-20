"use client";

import React, { useState, useEffect } from "react";

const POETIC_DESIGN_PHRASES = [
  "Bring Ideas to Life",
  "Form Follows Pure Imagination",
  "Crafting Digital Tomorrow",
  "Sculpting Pure Aesthetic",
  "Vision Made Tangible",
  "Architects of Thought",
  "Code as Living Art",
  "Designing Without Limits",
  "Drafting New Realms",
  "Pure Aesthetic Elegance",
  "From Concept to Canvas",
  "Boundless Creative Canvas",
  "Symphony of Design",
  "Ideas in Full Bloom",
  "Where Thought Meets Form",
];

interface DesignPoeticSubtitleProps {
  isDesignMode?: boolean;
}

export default function DesignPoeticSubtitle({ isDesignMode = false }: DesignPoeticSubtitleProps) {
  const [currentPhrase, setCurrentPhrase] = useState("");
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [finishedIndices, setFinishedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isDesignMode) {
      setRevealedIndex(-1);
      setFinishedIndices(new Set());
      return;
    }

    // Pick a random phrase whenever Design Mode is activated
    const randomIndex = Math.floor(Math.random() * POETIC_DESIGN_PHRASES.length);
    const chosenPhrase = POETIC_DESIGN_PHRASES[randomIndex];
    setCurrentPhrase(chosenPhrase);
    setRevealedIndex(-1);
    setFinishedIndices(new Set());

    let idx = 0;
    const interval = setInterval(() => {
      setRevealedIndex(idx);
      
      const currentIdx = idx;
      setTimeout(() => {
        setFinishedIndices((prev) => {
          const next = new Set(prev);
          next.add(currentIdx);
          return next;
        });
      }, 340);

      idx++;
      if (idx >= chosenPhrase.length) {
        clearInterval(interval);
      }
    }, 55);

    return () => clearInterval(interval);
  }, [isDesignMode]);

  if (!isDesignMode || !currentPhrase) return null;

  return (
    <div className="w-full flex justify-start items-center mt-6 pl-1 select-none animate-fadeIn">
      <h2 className="font-serif text-3xl sm:text-[38px] md:text-[44px] lg:text-[48px] font-normal tracking-[-0.015em] text-left leading-tight flex flex-wrap">
        {currentPhrase.split("").map((char, index) => {
          const isRevealed = index <= revealedIndex;
          const isFinished = finishedIndices.has(index);

          return (
            <span
              key={index}
              style={{
                display: "inline-block",
                transform: isRevealed ? "translateY(0px)" : "translateY(28px)",
                opacity: isRevealed ? 1 : 0,
                transition: "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease-out, color 0.5s ease-out",
              }}
              className={`select-none ${
                !isRevealed
                  ? "opacity-0"
                  : isFinished
                  ? "text-zinc-200/90"
                  : "bg-gradient-to-b from-[#38bdf8] via-[#0438c2] to-[#020938] bg-clip-text text-transparent font-medium"
              }`}
            >
              {char === " " ? "\u00A0" : char}
            </span>
          );
        })}
      </h2>
    </div>
  );
}
