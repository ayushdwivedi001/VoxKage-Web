"use client";

import React, { useState, useEffect } from "react";
import { login, clearToken, getToken } from "@/lib/api";

interface UseAuthProps {
  loadInitialData: () => void;
  onLogoutSuccess: () => void;
}

export default function useAuth({ loadInitialData, onLogoutSuccess }: UseAuthProps) {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("ayushdwivedi001@gmail.com");
  const [loginMasterKey, setLoginMasterKey] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      setIsLoggedIn(true);
      loadInitialData();
    }
    setIsAuthChecking(false);

    const handleUnauthorized = () => {
      setIsLoggedIn(false);
      clearToken();
    };

    window.addEventListener("voxkage_unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("voxkage_unauthorized", handleUnauthorized);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      await login(loginEmail, loginMasterKey);
      setIsLoggedIn(true);
      loadInitialData();
    } catch (err: any) {
      setLoginError(err.message || "Failed to log in.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setIsLoggedIn(false);
    onLogoutSuccess();
  };

  return {
    isAuthChecking,
    isLoggedIn,
    setIsLoggedIn,
    loginEmail,
    setLoginEmail,
    loginMasterKey,
    setLoginMasterKey,
    loginError,
    setLoginError,
    loginLoading,
    handleLogin,
    handleLogout,
  };
}
