"use client";

import React from "react";
import GradientBackground from "@/components/GradientBackground";

interface LoginViewProps {
  loginEmail: string;
  setLoginEmail: (email: string) => void;
  loginMasterKey: string;
  setLoginMasterKey: (key: string) => void;
  loginError: string;
  loginLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function LoginView({
  loginEmail,
  setLoginEmail,
  loginMasterKey,
  setLoginMasterKey,
  loginError,
  loginLoading,
  onSubmit,
}: LoginViewProps) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#05050a] px-4 select-none">
      <GradientBackground isChatActive={false} />

      <div className="w-full max-w-md bg-[#0e0e11] border border-zinc-800/80 rounded-2xl p-8 z-10 shadow-2xl relative">
        <div className="flex flex-col items-center mb-8">
          <h1
            className="text-white text-3xl font-light tracking-[0.03em] font-sans mb-2"
            style={{ fontFamily: "Copernicus, Tiempos, Georgia, serif" }}
          >
            VoxKage
          </h1>
          <p className="text-zinc-500 text-[13px] font-sans text-center">
            Enter your developer master credentials to authorize access.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] text-zinc-400 font-sans font-medium pl-1 text-left w-full block">
              Developer Email
            </label>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
              className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700 font-sans"
              placeholder="ayushdwivedi001@gmail.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] text-zinc-400 font-sans font-medium pl-1 text-left w-full block">
              Master Key
            </label>
            <input
              type="password"
              value={loginMasterKey}
              onChange={(e) => setLoginMasterKey(e.target.value)}
              required
              className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700 font-sans"
              placeholder="••••••••"
            />
          </div>

          {loginError && (
            <span className="text-red-400 text-[12.5px] font-sans pl-1 block text-left">
              {loginError}
            </span>
          )}

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full h-11 bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_12px_rgba(37,99,235,0.45)] text-white rounded-xl font-sans font-medium text-[14.5px] transition-all duration-200 cursor-pointer mt-4 flex items-center justify-center disabled:opacity-50"
          >
            {loginLoading ? "Authorizing..." : "Authorize Access"}
          </button>
        </form>
      </div>
    </div>
  );
}
