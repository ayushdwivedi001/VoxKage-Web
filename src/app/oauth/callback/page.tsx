"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"connecting" | "success" | "error">("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setStatus("error");
      setErrorMsg("Missing authorization code or state validation parameters.");
      return;
    }

    const exchangeToken = async () => {
      try {
        const redirectUri = window.location.origin + "/oauth/callback";
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
        
        const res = await fetch(`${backendUrl}/auth/oauth/callback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            state,
            redirect_uri: redirectUri,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Token exchange failed.");
        }

        const data = await res.json();
        setProviderName(data.provider || "Service");
        setStatus("success");

        // Send success message to parent window (validating origin securely)
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "OAUTH_SUCCESS",
              provider: data.provider || "google",
              token: data.access_token,
              email: data.email,
              userName: data.user_name,
              avatarUrl: data.avatar_url,
            },
            window.location.origin
          );
        }

        // Clean close of popup after success
        setTimeout(() => {
          window.close();
        }, 1500);

      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err.message || "An unexpected error occurred during connection.");
        if (window.opener) {
          window.opener.postMessage(
            { type: "OAUTH_FAILURE", error: err.message },
            window.location.origin
          );
        }
      }
    };

    exchangeToken();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center p-6 text-zinc-300 font-sans">
      <div className="w-full max-w-md bg-[#121216] border border-zinc-850 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
        {status === "connecting" && (
          <>
            <Loader2 className="w-12 h-12 text-blue-550 animate-spin mb-4" />
            <h2 className="text-[17px] font-semibold text-white mb-2">Connecting integration...</h2>
            <p className="text-[12.5px] text-zinc-450 leading-relaxed max-w-[85%]">
              Please wait while we complete the authorization and secure your credentials.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4 animate-bounce" />
            <h2 className="text-[17px] font-semibold text-white mb-2">Connected Successfully!</h2>
            <p className="text-[12.5px] text-zinc-450 leading-relaxed max-w-[85%]">
              {providerName.charAt(0).toUpperCase() + providerName.slice(1)} is now linked with VoxKage. This window will close automatically.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
            <h2 className="text-[17px] font-semibold text-white mb-2">Connection Failed</h2>
            <p className="text-[12.5px] text-zinc-400 mb-6 max-w-[90%] break-words">
              {errorMsg}
            </p>
            <button
              onClick={() => window.close()}
              className="px-5 py-2 rounded-xl text-[12.5px] font-medium bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer"
            >
              Close Window
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-550 animate-spin" />
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
