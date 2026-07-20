"use client";

import React, { useState, useEffect } from "react";

interface AnimatedHomepageGreetingProps {
  greeting: string;
}

export default function AnimatedHomepageGreeting({ greeting }: AnimatedHomepageGreetingProps) {
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const [finishedIndices, setFinishedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!greeting) return;

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
      if (idx >= greeting.length) {
        clearInterval(interval);
      }
    }, 45);

    return () => clearInterval(interval);
  }, [greeting]);

  if (!greeting) return null;

  return (
    <h1 className="text-white text-2xl sm:text-[34px] md:text-[38px] font-normal tracking-[-0.015em] select-none leading-tight text-center font-serif mt-2 flex flex-wrap justify-center px-4">
      {greeting.split("").map((char, index) => {
        const isRevealed = index <= revealedIndex;
        const isFinished = finishedIndices.has(index);

        return (
          <span
            key={index}
            style={{
              display: "inline-block",
              transform: isRevealed ? "translateY(0px)" : "translateY(24px)",
              opacity: isRevealed ? 1 : 0,
              transition: "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease-out, color 0.5s ease-out",
            }}
            className={`select-none ${
              !isRevealed
                ? "opacity-0"
                : isFinished
                ? "text-white"
                : "bg-gradient-to-b from-[#38bdf8] via-[#0438c2] to-[#020938] bg-clip-text text-transparent font-medium"
            }`}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </h1>
  );
}
