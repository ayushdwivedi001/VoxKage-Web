"use client";

import React, { useEffect, useState } from "react";

export default function VoxKageIdleCreature() {
  const [isNight, setIsNight] = useState(false);

  useEffect(() => {
    const checkTime = () => {
      const hours = new Date().getHours();
      setIsNight(hours >= 19 || hours < 5);
    };
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mb-6 flex justify-center items-end text-white h-[42px] overflow-visible">
      {isNight ? (
        <>
          <style>{`
            @keyframes idle-blink-left {
              0%, 94%, 100% { opacity: 0; }
              95%, 97%       { opacity: 1; }
            }
            @keyframes idle-blink-right {
              0%, 93%, 100% { opacity: 0; }
              94%, 96%       { opacity: 1; }
            }
            .idle-eye-l-lid {
              animation: idle-blink-left 6s steps(1, end) infinite 0s;
            }
            .idle-eye-r-lid {
              animation: idle-blink-right 7.5s steps(1, end) infinite 1.8s;
            }

            @keyframes star-blink-a {
              0%, 49%   { opacity: 0; }
              50%, 100% { opacity: 1; }
            }
            @keyframes star-blink-b {
              0%, 64%   { opacity: 1; }
              65%, 100% { opacity: 0; }
            }
            @keyframes star-blink-c {
              0%, 34%   { opacity: 0; }
              35%, 70%  { opacity: 1; }
              71%, 100% { opacity: 0; }
            }
            .star-1 { animation: star-blink-a 1.8s steps(1, end) infinite 0.0s; }
            .star-2 { animation: star-blink-b 2.4s steps(1, end) infinite 0.6s; }
            .star-3 { animation: star-blink-c 2.0s steps(1, end) infinite 1.1s; }

            @keyframes moon-glow {
              0%, 100% { filter: drop-shadow(0 0 1px rgba(251, 191, 36, 0.5)); }
              50%      { filter: drop-shadow(0 0 3px rgba(251, 191, 36, 0.8)); }
            }
            .premium-moon {
              animation: moon-glow 4s ease-in-out infinite;
            }
          `}</style>
          <svg
            width="48"
            height="42"
            viewBox="0 0 16 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ imageRendering: "pixelated" }}
            className="text-white animate-fadeIn"
          >
            <path className="premium-moon" d="M11.5 0.5 C15 0.5, 15 4.5, 11.5 5 C13.2 4, 13.2 1, 11.5 0.5 Z" fill="#fbbf24"/>
            <rect className="star-1" x="1" y="1" width="1" height="1" fill="#faf9f5"/>
            <rect className="star-2" x="5" y="3" width="1" height="1" fill="#faf9f5"/>
            <rect className="star-3" x="9" y="0" width="1" height="1" fill="#faf9f5"/>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M 2 6 h 12 v 3 h 2 v 2 h -2 v 1 h -2 v 2 h -2 v -2 h -4 v 2 h -2 v -2 h -2 v -1 h -2 v -2 h 2 v -3 z M 4 7 h 2 v 2 h -2 z M 10 7 h 2 v 2 h -2 z"
              fill="#faf9f5"
            />
            <rect className="idle-eye-l-lid" x="4"  y="7" width="2" height="2" fill="#faf9f5" opacity="0"/>
            <rect className="idle-eye-r-lid" x="10" y="7" width="2" height="2" fill="#faf9f5" opacity="0"/>
          </svg>
        </>
      ) : (
        <>
          <style>{`
            @keyframes idle-blink-left {
              0%, 94%, 100% { opacity: 0; }
              95%, 97%       { opacity: 1; }
            }
            @keyframes idle-blink-right {
              0%, 93%, 100% { opacity: 0; }
              94%, 96%       { opacity: 1; }
            }
            .idle-eye-l-lid {
              animation: idle-blink-left 6s steps(1, end) infinite 0s;
            }
            .idle-eye-r-lid {
              animation: idle-blink-right 7.5s steps(1, end) infinite 1.8s;
            }
          `}</style>
          <svg
            width="48"
            height="27"
            viewBox="0 0 16 9"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ imageRendering: "pixelated" }}
            className="text-white animate-fadeIn"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M 2 0 h 12 v 3 h 2 v 2 h -2 v 1 h -2 v 2 h -2 v -2 h -4 v 2 h -2 v -2 h -2 v -1 h -2 v -2 h 2 v -3 z M 4 1 h 2 v 2 h -2 z M 10 1 h 2 v 2 h -2 z"
              fill="currentColor"
            />
            <rect className="idle-eye-l-lid" x="4" y="1" width="2" height="2" fill="currentColor" opacity="0" />
            <rect className="idle-eye-r-lid" x="10" y="1" width="2" height="2" fill="currentColor" opacity="0" />
          </svg>
        </>
      )}
    </div>
  );
}
