"use client";

import React, { useState, useEffect } from "react";
import { clearToken, getToken } from "@/lib/api";

interface UseAuthProps {
  loadInitialData: () => void;
  onLogoutSuccess: () => void;
}

export default function useAuth({ loadInitialData, onLogoutSuccess }: UseAuthProps) {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
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
    loginError,
    setLoginError,
    loginLoading,
    handleLogout,
  };
}
