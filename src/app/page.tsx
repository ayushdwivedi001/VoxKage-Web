"use client";

import React, { useEffect, useState } from "react";
import GradientBackground from "@/components/GradientBackground";
import PromptInput from "@/components/PromptInput";

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Staggered entry animation delay
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main
      className="relative flex flex-col flex-1 items-center justify-center min-h-screen px-4 overflow-hidden"
      style={{ position: "relative", zIndex: 10 }}
    >
      {/* Animated mesh gradient background */}
      <GradientBackground />

      {/* Main Content Area — always above the gradient */}
      <div
        className={`flex flex-col items-center w-full max-w-3xl text-center transition-all duration-[1600ms] ${
          isLoaded
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-8"
        }`}
        style={{
          position: "relative",
          zIndex: 20,
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Heading */}
        <h1 className="text-white text-3xl sm:text-[40px] md:text-[44px] font-semibold tracking-[-0.02em] mb-7 select-none leading-tight font-sans">
          What should we build, Ayush?
        </h1>

        {/* Interactive Prompt Input Box */}
        <PromptInput />
      </div>
    </main>
  );
}
