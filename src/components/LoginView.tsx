"use client";

import React, { useState } from "react";
import DesignDottedCanvas from "@/components/DesignDottedCanvas";
import LoginCreature from "@/components/LoginCreature";
import { Loader2, ArrowRight, ShieldCheck, Sparkles, KeyRound, Mail, User, Lock, AlertCircle, X, CheckCircle2 } from "lucide-react";

interface LoginViewProps {
  loginEmail: string;
  setLoginEmail: (email: string) => void;
  loginMasterKey: string;
  setLoginMasterKey: (key: string) => void;
  loginError: string;
  loginLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onGoogleSuccess?: (token: string, email: string, avatarUrl?: string, userName?: string) => void;
  onAuthSuccess?: (token: string, email: string, avatarUrl?: string, userName?: string) => void;
}

export default function LoginView({
  loginEmail,
  setLoginEmail,
  loginMasterKey,
  setLoginMasterKey,
  loginError: externalLoginError,
  loginLoading: externalLoginLoading,
  onSubmit: externalOnSubmit,
  onGoogleSuccess,
  onAuthSuccess,
}: LoginViewProps) {
  // Mode toggle: 'signin' | 'signup' | 'master_key'
  const [isSignUp, setIsSignUp] = useState(false);
  const [isMasterKeyMode, setIsMasterKeyMode] = useState(false);

  // Form states
  const [passwordInput, setPasswordInput] = useState("");
  const [userNameInput, setUserNameInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // Handle Real Production-Grade Google OAuth Popup Authentication
  const handleGoogleLogin = () => {
    setAuthLoading(true);
    setAuthError("");

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "948142993949-7emi9ertjv9amcdkr7eql250dmm0pdu0.apps.googleusercontent.com";
    const redirectUri = `${window.location.origin}/oauth/callback`;
    const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=openid%20email%20profile&prompt=select_account&state=google_login`;

    const width = 540;
    const height = 640;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      googleOAuthUrl,
      "GoogleAuthPopup",
      `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
    );

    if (!popup) {
      setAuthLoading(false);
      setAuthError("Popup blocked by browser. Please allow popups for this site.");
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "OAUTH_SUCCESS") {
        window.removeEventListener("message", handleMessage);
        setAuthLoading(false);
        const { token, email, userName, avatarUrl } = event.data;
        if (token && email) {
          import("@/lib/api").then(({ saveToken }) => {
            saveToken(token, email, avatarUrl, userName);
          });
          if (onGoogleSuccess) {
            onGoogleSuccess(token, email, avatarUrl, userName);
          } else if (onAuthSuccess) {
            onAuthSuccess(token, email, avatarUrl, userName);
          }
        }
      } else if (event.data?.type === "OAUTH_FAILURE") {
        window.removeEventListener("message", handleMessage);
        setAuthLoading(false);
        setAuthError(event.data?.error || "Google authentication failed.");
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        setAuthLoading(false);
      }
    }, 1000);
  };

  // Handle Password Sign In / Sign Up Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !passwordInput.trim()) {
      setAuthError("Please enter your email and password.");
      return;
    }
    if (isSignUp && !userNameInput.trim()) {
      setAuthError("Please enter a username for your account.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    try {
      if (isSignUp) {
        const { signupUser } = await import("@/lib/api");
        const res = await signupUser(loginEmail.trim(), passwordInput, userNameInput.trim());
        if (onAuthSuccess) {
          onAuthSuccess(res.token, loginEmail.trim(), res.avatarUrl, res.userName);
        }
      } else {
        const { loginWithPassword } = await import("@/lib/api");
        const res = await loginWithPassword(loginEmail.trim(), passwordInput);
        if (onAuthSuccess) {
          onAuthSuccess(res.token, loginEmail.trim(), res.avatarUrl, res.userName);
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen h-screen w-full flex items-center justify-center bg-[#05050a] p-4 md:p-6 lg:p-8 select-none font-sans overflow-hidden">
      {/* Background HTML Dotted Canvas */}
      <DesignDottedCanvas active={true} isChatActive={false} />

      {/* Top Left Enlarged Black Rounded Icon Box (NO PILL, NO TEXT) */}
      <div className="fixed top-6 left-7 z-50">
        <div className="w-11 h-11 rounded-2xl bg-black border border-zinc-800 flex items-center justify-center p-2 shadow-2xl overflow-hidden hover:border-zinc-700 transition-colors">
          <img src="/assets/voxkage_logo.png" alt="VoxKage Logo" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Main Dual-Pane Container matching Claude Login Spacing & Dimensions */}
      <div className="w-full h-full max-w-none flex flex-col md:flex-row items-center justify-start gap-12 lg:gap-16 xl:gap-20 z-10 my-auto pl-4 md:pl-20 lg:pl-32 pr-4 md:pr-8">
        
        {/* === LEFT PANE: AUTHENTICATION SECTION === */}
        <div className="w-full max-w-sm flex flex-col items-center justify-center flex-shrink-0 z-10 my-auto">
          
          {/* Big Enlarged Serif Title Header: V[LoginCreature]xKage */}
          <div className="flex flex-col items-center mb-8 text-center">
            <h1
              className="text-white text-6xl md:text-7xl lg:text-[76px] font-normal tracking-tight flex items-center justify-center gap-0.5 leading-none"
              style={{ fontFamily: "Copernicus, Tiempos, Georgia, serif" }}
            >
              <span>V</span>
              <span className="inline-flex items-center justify-center w-10 h-10 md:w-13 md:h-13 transform translate-y-1 mx-[1px]">
                <LoginCreature />
              </span>
              <span>xKage</span>
            </h1>
          </div>

          {/* Auth Form Card */}
          <div className="w-full bg-[#0e0e11] border border-zinc-800/80 rounded-3xl p-7 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            
            {/* MASTER KEY OVERRIDE MODE */}
            {isMasterKeyMode ? (
              <form onSubmit={externalOnSubmit} className="flex flex-col gap-4 animate-fadeIn">
                <div className="flex flex-col text-left mb-1">
                  <h3 className="text-white text-base font-medium">Master Key Override</h3>
                  <p className="text-zinc-400 text-[12px] mt-0.5">
                    Enter your developer master credentials to authorize access.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[12px] text-zinc-400 font-medium pl-1 block">
                    Developer Email
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-zinc-200 text-[13px] outline-none focus:border-zinc-700"
                    placeholder="ayushdwivedi001@gmail.com"
                  />
                </div>

                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[12px] text-zinc-400 font-medium pl-1 block">
                    Master Key
                  </label>
                  <input
                    type="password"
                    value={loginMasterKey}
                    onChange={(e) => setLoginMasterKey(e.target.value)}
                    required
                    className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-zinc-200 text-[13px] outline-none focus:border-zinc-700"
                    placeholder="••••••••"
                  />
                </div>

                {externalLoginError && (
                  <span className="text-red-400 text-[12px] pl-1 block text-left">
                    {externalLoginError}
                  </span>
                )}

                <button
                  type="submit"
                  disabled={externalLoginLoading}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-[13px] transition-colors cursor-pointer mt-2 flex items-center justify-center disabled:opacity-50"
                >
                  {externalLoginLoading ? "Authorizing..." : "Authorize Access"}
                </button>

                <button
                  type="button"
                  onClick={() => setIsMasterKeyMode(false)}
                  className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer mt-1 text-center"
                >
                  Back to Sign In
                </button>
              </form>
            ) : (

              /* STANDARD EMAIL / PASSWORD & GOOGLE AUTH FORM */
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 animate-fadeIn">
                
                {/* Form Header Title */}
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 mb-1">
                  <h3 className="text-white text-base font-medium">
                    {isSignUp ? "Create your account" : "Sign in to VoxKage"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setAuthError("");
                    }}
                    className="text-[12px] text-blue-400 hover:text-blue-300 transition-colors font-medium cursor-pointer"
                  >
                    {isSignUp ? "Sign In" : "Sign Up"}
                  </button>
                </div>

                {/* USERNAME FIELD — ONLY SHOWN DURING SIGN UP */}
                {isSignUp && (
                  <div className="flex flex-col gap-1 text-left animate-fadeIn">
                    <label className="text-[12px] text-zinc-400 font-medium pl-1 block">
                      Username
                    </label>
                    <div className="relative flex items-center">
                      <User className="absolute left-3 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={userNameInput}
                        onChange={(e) => setUserNameInput(e.target.value)}
                        required={isSignUp}
                        className="w-full h-10 bg-zinc-900/70 border border-zinc-800 rounded-xl pl-9 pr-3 text-zinc-200 text-[13px] outline-none focus:border-zinc-700 transition-colors"
                        placeholder="Ayush"
                      />
                    </div>
                  </div>
                )}

                {/* EMAIL ADDRESS FIELD */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[12px] text-zinc-400 font-medium pl-1 block">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="w-full h-10 bg-zinc-900/70 border border-zinc-800 rounded-xl pl-9 pr-3 text-zinc-200 text-[13px] outline-none focus:border-zinc-700 transition-colors"
                      placeholder="you@domain.com"
                    />
                  </div>
                </div>

                {/* PASSWORD FIELD */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[12px] text-zinc-400 font-medium pl-1 block">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      required
                      className="w-full h-10 bg-zinc-900/70 border border-zinc-800 rounded-xl pl-9 pr-3 text-zinc-200 text-[13px] outline-none focus:border-zinc-700 transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {authError && (
                  <span className="text-red-400 text-[12px] pl-1 block text-left flex items-center gap-1.5 mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{authError}</span>
                  </span>
                )}

                {/* PRIMARY VOXKAGE BLUE BUTTON */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_15px_rgba(37,99,235,0.45)] text-white rounded-xl font-medium text-[13.5px] transition-all duration-200 cursor-pointer mt-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isSignUp ? "Creating Account..." : "Signing In..."}</span>
                    </>
                  ) : (
                    <>
                      <span>{isSignUp ? "Sign Up" : "Sign In"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Toggle Sign Up / Sign In text helper */}
                <div className="text-[12px] text-zinc-400 text-center mt-0.5">
                  {isSignUp ? (
                    <span>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignUp(false);
                          setAuthError("");
                        }}
                        className="text-blue-400 hover:underline font-medium cursor-pointer"
                      >
                        Sign In
                      </button>
                    </span>
                  ) : (
                    <span>
                      Not signed in yet?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignUp(true);
                          setAuthError("");
                        }}
                        className="text-blue-400 hover:underline font-medium cursor-pointer"
                      >
                        Sign Up
                      </button>
                    </span>
                  )}
                </div>

                {/* DIVIDER */}
                <div className="relative flex items-center justify-center my-1">
                  <div className="border-t border-zinc-800/80 w-full" />
                  <span className="bg-[#0e0e11] px-3 text-[10.5px] font-medium text-zinc-500 uppercase tracking-widest absolute">
                    OR
                  </span>
                </div>

                {/* GOOGLE SIGN UP / IN BUTTON BELOW DIVIDER */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                  className="w-full h-10 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 rounded-xl font-medium text-[13px] transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{isSignUp ? "Sign Up with Google" : "Continue with Google"}</span>
                </button>

                {/* Footer helpers */}
                <div className="flex items-center justify-between text-[11.5px] text-zinc-500 pt-2 border-t border-zinc-800/40 mt-1">
                  <button
                    type="button"
                    onClick={() => setIsMasterKeyMode(true)}
                    className="hover:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Master Key</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(loginEmail);
                      setShowForgotModal(true);
                    }}
                    className="hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>

        {/* === RIGHT PANE: ENLARGED PRODUCT SHOWCASE CARD (RIGHT BORDER EXPANDED) === */}
        <div className="flex-1 w-full h-full max-h-[calc(100vh-64px)] min-h-[580px] bg-[#0c0c10]/95 border border-zinc-800/80 rounded-[32px] p-8 md:p-10 lg:p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden backdrop-blur-xl z-10 my-auto">
          
          {/* Subtle Blue Glow Accent */}
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Card Top Header */}
          <div className="flex flex-col gap-4 text-left relative z-10">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11.5px] font-medium tracking-wide">
                VoxKage AI Showcase
              </span>
            </div>
            
            <h2 className="text-zinc-100 text-2xl md:text-3xl font-normal tracking-tight font-sans">
              Next-Gen Agentic OS Workspace
            </h2>
            <p className="text-zinc-400 text-[13.5px] leading-relaxed">
              Experience dynamic model selection, seamless multi-provider APIs (OpenCode Zen & Kilo Code), and multi-turn autonomous tool execution right from your browser.
            </p>
          </div>

          {/* Showcase Preview Mockup */}
          <div className="my-6 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col gap-3.5 relative z-10">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-[13px] text-zinc-200 font-mono">Agent Kernel v2.5</span>
              </div>
              <span className="text-[11px] text-zinc-500 uppercase font-mono tracking-wider">LIVE</span>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5 bg-zinc-800/40 p-2.5 rounded-xl text-[12.5px] text-zinc-300">
                <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="truncate">Autonomous task routing & tool execution</span>
              </div>
              <div className="flex items-center gap-2.5 bg-zinc-800/40 p-2.5 rounded-xl text-[12.5px] text-zinc-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="truncate">Encrypted web keys & local persistent state</span>
              </div>
            </div>
          </div>

          {/* Card Bottom Footer */}
          <div className="flex items-center justify-between text-[12px] text-zinc-500 border-t border-zinc-800/60 pt-5 relative z-10">
            <span>March 2026 Edition</span>
            <span className="text-zinc-400">JARVIS-Grade Precision</span>
          </div>
        </div>

      </div>

      {/* Forgot Password Helper Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForgotModal(false)} />
          <div className="w-full max-w-sm bg-[#121216] border border-zinc-800 rounded-2xl p-6 relative z-10 shadow-2xl flex flex-col gap-4 text-left animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-zinc-100 font-medium text-base">Reset Account Password</h4>
              <button type="button" onClick={() => setShowForgotModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {forgotSent ? (
              <div className="flex flex-col gap-3 text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-zinc-300 text-[13px]">
                  Password reset link sent to <span className="text-blue-400">{forgotEmail}</span>. Please check your inbox.
                </p>
                <button type="button" onClick={() => setShowForgotModal(false)} className="mt-2 text-[12.5px] text-blue-400 hover:underline cursor-pointer">
                  Close
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-zinc-400 text-[12.5px]">
                  Enter your registered email address to receive password reset instructions.
                </p>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-zinc-200 text-[13px] outline-none focus:border-zinc-700"
                  placeholder="you@domain.com"
                />
                <button
                  type="button"
                  onClick={() => setForgotSent(true)}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-[13px] transition-colors cursor-pointer mt-1"
                >
                  Send Reset Link
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
