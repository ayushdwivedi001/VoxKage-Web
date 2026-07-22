"use client";

import React, { useState, useEffect } from "react";
import DesignDottedCanvas from "@/components/DesignDottedCanvas";
import LoginCreature from "@/components/LoginCreature";
import {
  Loader2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Mail,
  User,
  Lock,
  AlertCircle,
  X,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";

interface LoginViewProps {
  loginEmail: string;
  setLoginEmail: (email: string) => void;
  loginError: string;
  loginLoading: boolean;
  onGoogleSuccess?: (token: string, email: string, avatarUrl?: string, userName?: string) => void;
  onAuthSuccess?: (token: string, email: string, avatarUrl?: string, userName?: string) => void;
}

export default function LoginView({
  loginEmail,
  setLoginEmail,
  loginError: externalLoginError,
  loginLoading: externalLoginLoading,
  onGoogleSuccess,
  onAuthSuccess,
}: LoginViewProps) {
  // Mode toggles
  const [isSignUp, setIsSignUp] = useState(false);

  // Form states
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [userNameInput, setUserNameInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Field-level validation errors
  const [emailFieldError, setEmailFieldError] = useState("");
  const [passwordFieldError, setPasswordFieldError] = useState("");
  const [confirmPasswordFieldError, setConfirmPasswordFieldError] = useState("");
  const [userNameFieldError, setUserNameFieldError] = useState("");

  // Sign Up OTP state (4-digit code)
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const [otpError, setOtpError] = useState("");

  // Forgot password modal state (8-digit code)
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [resetCodeInput, setResetCodeInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState("");

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Dynamic email pre-filling
  useEffect(() => {
    if (!isSignUp) {
      import("@/lib/api").then(({ getLastUsedEmail }) => {
        const lastEmail = getLastUsedEmail();
        if (lastEmail) {
          setLoginEmail(lastEmail);
        }
      });
    } else {
      setLoginEmail("");
    }
    setAuthError("");
    setEmailFieldError("");
    setPasswordFieldError("");
    setConfirmPasswordFieldError("");
    setUserNameFieldError("");
  }, [isSignUp, setLoginEmail]);

  // Handle Google OAuth Click
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

  // Helper to validate password complexity rules (8+ chars, uppercase, lowercase, digit, non-alphanumeric special)
  const isPasswordComplex = (pwd: string) => {
    return (
      pwd.length >= 8 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /[0-9]/.test(pwd) &&
      /[^a-zA-Z0-9]/.test(pwd)
    );
  };

  // Input syntax validation
  const validateFormInputs = () => {
    let isValid = true;
    setEmailFieldError("");
    setPasswordFieldError("");
    setConfirmPasswordFieldError("");
    setUserNameFieldError("");

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(loginEmail.trim())) {
      setEmailFieldError("Invalid email format syntax.");
      isValid = false;
    }

    if (isSignUp) {
      if (!userNameInput.trim()) {
        setUserNameFieldError("Username is required.");
        isValid = false;
      }
      if (passwordInput.length < 8) {
        setPasswordFieldError("Password must be at least 8 characters long.");
        isValid = false;
      } else if (!/[A-Z]/.test(passwordInput)) {
        setPasswordFieldError("Password must contain at least one uppercase letter.");
        isValid = false;
      } else if (!/[a-z]/.test(passwordInput)) {
        setPasswordFieldError("Password must contain at least one lowercase letter.");
        isValid = false;
      } else if (!/[0-9]/.test(passwordInput)) {
        setPasswordFieldError("Password must contain at least one number.");
        isValid = false;
      } else if (!/[^a-zA-Z0-9]/.test(passwordInput)) {
        setPasswordFieldError("Password must contain at least one special character.");
        isValid = false;
      }

      if (passwordInput !== confirmPasswordInput) {
        setConfirmPasswordFieldError("Passwords do not match.");
        isValid = false;
      }
    } else {
      if (!passwordInput) {
        setPasswordFieldError("Password is required.");
        isValid = false;
      }
    }

    return isValid;
  };

  // Handle Form Submit (Either signs in or starts signup OTP flow)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFormInputs()) return;

    setAuthLoading(true);
    setAuthError("");

    try {
      if (isSignUp) {
        const { sendSignupOtp } = await import("@/lib/api");
        await sendSignupOtp(loginEmail.trim(), passwordInput, confirmPasswordInput, userNameInput.trim());
        setOtpDigits(["", "", "", ""]);
        setOtpError("");
        setShowOtpVerification(true);
      } else {
        const { loginWithPassword } = await import("@/lib/api");
        const res = await loginWithPassword(loginEmail.trim(), passwordInput);
        if (onAuthSuccess) {
          onAuthSuccess(res.token, loginEmail.trim(), res.avatarUrl, res.userName);
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || "";
      if (errorMsg.includes("already exists") || errorMsg.includes("not registered")) {
        setEmailFieldError(errorMsg);
      } else {
        setAuthError(errorMsg || "Authentication failed. Please verify credentials.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // 4-Digit Signup OTP input traversing logic
  const handleOtpChange = (index: number, val: string) => {
    const cleanVal = val.replace(/\D/g, "");
    if (!cleanVal && val) return;
    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    if (cleanVal && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  // Verify Sign Up 4-Digit OTP
  const handleVerifyOtpSubmit = async () => {
    const code = otpDigits.join("");
    if (code.length !== 4) {
      setOtpError("Please enter all 4 digits of the verification code.");
      return;
    }

    setAuthLoading(true);
    setOtpError("");

    try {
      const { verifySignupOtp } = await import("@/lib/api");
      const res = await verifySignupOtp(loginEmail.trim(), passwordInput, userNameInput.trim(), code);
      if (onAuthSuccess) {
        onAuthSuccess(res.token, loginEmail.trim(), res.avatarUrl, res.userName);
      }
    } catch (err: any) {
      setOtpError(err.message || "Invalid or expired verification code.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Forgot Password: Step 1 (Send Code)
  const handleSendResetCode = async () => {
    if (!forgotEmail.trim()) {
      setForgotError("Email address is required.");
      return;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(forgotEmail.trim())) {
      setForgotError("Invalid email format syntax.");
      return;
    }

    setForgotLoading(true);
    setForgotError("");

    try {
      const { sendResetCode } = await import("@/lib/api");
      await sendResetCode(forgotEmail.trim());
      setForgotStep(2);
    } catch (err: any) {
      setForgotError(err.message || "Failed to dispatch reset code.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Forgot Password: Step 3 (Save New Password with full complexity verification)
  const handleResetPasswordSubmit = async () => {
    if (newPasswordInput.length < 8) {
      setForgotError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(newPasswordInput)) {
      setForgotError("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/[a-z]/.test(newPasswordInput)) {
      setForgotError("Password must contain at least one lowercase letter.");
      return;
    }
    if (!/[0-9]/.test(newPasswordInput)) {
      setForgotError("Password must contain at least one number.");
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(newPasswordInput)) {
      setForgotError("Password must contain at least one special character.");
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setForgotError("Passwords do not match.");
      return;
    }

    setForgotLoading(true);
    setForgotError("");

    try {
      const { resetPassword } = await import("@/lib/api");
      await resetPassword(forgotEmail.trim(), resetCodeInput.trim(), newPasswordInput);
      setForgotStep(4);
    } catch (err: any) {
      setForgotError(err.message || "Failed to update password.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen h-screen w-full flex items-center justify-center bg-[#05050a] p-4 md:p-6 lg:p-8 select-none font-sans overflow-hidden">
      <DesignDottedCanvas active={true} isChatActive={false} />

      {/* Top Left Rounded Icon Box */}
      <div className="fixed top-6 left-7 z-50">
        <div className="w-11 h-11 rounded-2xl bg-black border border-zinc-800 flex items-center justify-center p-2 shadow-2xl overflow-hidden hover:border-zinc-700 transition-colors">
          <img src="/assets/voxkage_logo.png" alt="VoxKage Logo" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Main Dual-Pane Spacing Container */}
      <div className="w-full h-full max-w-none flex flex-col md:flex-row items-center justify-start gap-12 lg:gap-16 xl:gap-20 z-10 my-auto pl-4 md:pl-20 lg:pl-32 pr-4 md:pr-8">
        
        {/* === LEFT PANE: AUTHENTICATION CONTAINER === */}
        <div className="w-full max-w-sm flex flex-col items-center justify-center flex-shrink-0 z-10 my-auto">
          
          {/* Serif VoxKage Title Header */}
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

          <div className="w-full bg-[#0e0e11] border border-zinc-800/80 rounded-3xl p-7 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            
            {showOtpVerification ? (

              /* 4-DIGIT SIGNUP OTP VERIFICATION SCREEN */
              <div className="flex flex-col gap-4 animate-fadeIn">
                <div className="text-left border-b border-zinc-800/60 pb-3 mb-1">
                  <h3 className="text-white text-base font-medium">Verify your email</h3>
                  <p className="text-zinc-500 text-[11.5px] mt-1 leading-relaxed">
                    We sent a 4-digit verification code to <span className="text-blue-400 font-medium">{loginEmail}</span>.
                  </p>
                </div>

                <div className="flex flex-col gap-2 text-left">
                  <label className="text-[12px] text-zinc-400 font-medium pl-1">4-Digit Verification Code</label>
                  <div className="flex gap-3 justify-between px-1">
                    {[0, 1, 2, 3].map((idx) => (
                      <input
                        key={idx}
                        id={`otp-${idx}`}
                        type="text"
                        maxLength={1}
                        value={otpDigits[idx]}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl text-center text-zinc-100 text-lg font-bold focus:border-zinc-700 outline-none transition-colors"
                      />
                    ))}
                  </div>
                </div>

                {otpError && (
                  <span className="text-red-400 text-[12px] pl-1 block text-left flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{otpError}</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleVerifyOtpSubmit}
                  disabled={authLoading}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_15px_rgba(37,99,235,0.45)] text-white rounded-xl font-medium text-[13.5px] transition-all duration-200 flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify & Sign Up</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowOtpVerification(false)}
                  className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors text-center mt-1 cursor-pointer"
                >
                  Change registration email
                </button>
              </div>
            ) : (

              /* REGULAR SIGN IN / SIGN UP FORM */
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 mb-1">
                  <h3 className="text-white text-base font-medium">
                    {isSignUp ? "Create account" : "Sign in to VoxKage"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                    }}
                    className="text-[12px] text-blue-400 hover:text-blue-300 transition-colors font-medium cursor-pointer"
                  >
                    {isSignUp ? "Sign In" : "Sign Up"}
                  </button>
                </div>

                {/* Username Input (Sign Up Only) */}
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
                        onChange={(e) => {
                          setUserNameInput(e.target.value);
                          setUserNameFieldError("");
                        }}
                        required={isSignUp}
                        className="w-full h-10 bg-zinc-900/70 border border-zinc-800 rounded-xl pl-9 pr-3 text-zinc-200 text-[13px] outline-none focus:border-zinc-700 transition-colors"
                        placeholder="Type your username"
                      />
                    </div>
                    {userNameFieldError && (
                      <span className="text-red-400 text-[11px] pl-1 block text-left mt-0.5 font-medium">
                        {userNameFieldError}
                      </span>
                    )}
                  </div>
                )}

                {/* Email address input */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[12px] text-zinc-400 font-medium pl-1 block">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        setEmailFieldError("");
                      }}
                      required
                      className="w-full h-10 bg-zinc-900/70 border border-zinc-800 rounded-xl pl-9 pr-3 text-zinc-200 text-[13px] outline-none focus:border-zinc-700 transition-colors"
                      placeholder="Enter your email address"
                    />
                  </div>
                  {emailFieldError && (
                    <span className="text-red-400 text-[11px] pl-1 block text-left mt-0.5 font-medium">
                      {emailFieldError}
                    </span>
                  )}
                </div>

                {/* Password input */}
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[12px] text-zinc-400 font-medium pl-1 block">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-4 h-4 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setPasswordFieldError("");
                      }}
                      required
                      className="w-full h-10 bg-zinc-900/70 border border-zinc-800 rounded-xl pl-9 pr-16 text-zinc-200 text-[13px] outline-none focus:border-zinc-700 transition-colors"
                      placeholder="Enter your password"
                    />
                    {isSignUp && passwordInput && confirmPasswordInput && isPasswordComplex(passwordInput) && passwordInput === confirmPasswordInput && (
                      <CheckCircle2 className="absolute right-9 w-4 h-4 text-blue-500 flex-shrink-0 animate-fadeIn" />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordFieldError && (
                    <span className="text-red-400 text-[11px] pl-1 block text-left mt-0.5 font-medium">
                      {passwordFieldError}
                    </span>
                  )}
                </div>

                {/* Confirm password input (Sign Up Only) */}
                {isSignUp && (
                  <div className="flex flex-col gap-1 text-left animate-fadeIn">
                    <label className="text-[12px] text-zinc-400 font-medium pl-1 block">
                      Confirm Password
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3 w-4 h-4 text-zinc-500" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPasswordInput}
                        onChange={(e) => {
                          setConfirmPasswordInput(e.target.value);
                          setConfirmPasswordFieldError("");
                        }}
                        required={isSignUp}
                        className="w-full h-10 bg-zinc-900/70 border border-zinc-800 rounded-xl pl-9 pr-16 text-zinc-200 text-[13px] outline-none focus:border-zinc-700 transition-colors"
                        placeholder="Confirm your password"
                      />
                      {isSignUp && passwordInput && confirmPasswordInput && isPasswordComplex(passwordInput) && passwordInput === confirmPasswordInput && (
                        <CheckCircle2 className="absolute right-9 w-4 h-4 text-blue-500 flex-shrink-0 animate-fadeIn" />
                      )}
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPasswordFieldError && (
                      <span className="text-red-400 text-[11px] pl-1 block text-left mt-0.5 font-medium">
                        {confirmPasswordFieldError}
                      </span>
                    )}
                  </div>
                )}

                {authError && (
                  <span className="text-red-400 text-[12px] pl-1 block text-left flex items-center gap-1.5 mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{authError}</span>
                  </span>
                )}

                {/* Primary Button */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_15px_rgba(37,99,235,0.45)] text-white rounded-xl font-medium text-[13.5px] transition-all duration-200 cursor-pointer mt-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isSignUp ? "Creating account..." : "Signing In..."}</span>
                    </>
                  ) : (
                    <>
                      <span>{isSignUp ? "Sign Up" : "Sign In"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-[12px] text-zinc-400 text-center mt-0.5">
                  {isSignUp ? (
                    <span>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignUp(false);
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
                        }}
                        className="text-blue-400 hover:underline font-medium cursor-pointer"
                      >
                        Sign Up
                      </button>
                    </span>
                  )}
                </div>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-1">
                  <div className="border-t border-zinc-800/80 w-full" />
                  <span className="bg-[#0e0e11] px-3 text-[10.5px] font-medium text-zinc-500 uppercase tracking-widest absolute">
                    OR
                  </span>
                </div>

                {/* Google Login button */}
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

                <div className="flex items-center justify-center text-[11.5px] text-zinc-500 pt-2 border-t border-zinc-800/40 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(loginEmail);
                      setForgotError("");
                      setResetCodeInput("");
                      setNewPasswordInput("");
                      setConfirmNewPasswordInput("");
                      setForgotStep(1);
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

        {/* === RIGHT PANE: SHOWCASE CARD === */}
        <div className="flex-1 w-full h-full max-h-[calc(100vh-64px)] min-h-[580px] bg-[#0c0c10]/95 border border-zinc-800/80 rounded-[32px] p-8 md:p-10 lg:p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden backdrop-blur-xl z-10 my-auto">
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

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

          <div className="flex items-center justify-between text-[12px] text-zinc-500 border-t border-zinc-800/60 pt-5 relative z-10">
            <span>March 2026 Edition</span>
            <span className="text-zinc-400">JARVIS-Grade Precision</span>
          </div>
        </div>

      </div>

      {/* Forgot Password Multi-step Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForgotModal(false)} />
          <div className="w-full max-w-sm bg-[#121216] border border-zinc-800 rounded-2xl p-6 relative z-10 shadow-2xl flex flex-col gap-4 text-left animate-fadeIn">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <h4 className="text-zinc-100 font-medium text-base">Reset Password</h4>
              <button type="button" onClick={() => setShowForgotModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotStep === 1 && (
              <div className="flex flex-col gap-3">
                <p className="text-zinc-400 text-[12.5px]">
                  Enter your registered email address to receive an 8-digit secure reset code.
                </p>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-zinc-200 text-[13px] outline-none focus:border-zinc-700"
                  placeholder="you@domain.com"
                />
                {forgotError && (
                  <span className="text-red-400 text-[12px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{forgotError}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSendResetCode}
                  disabled={forgotLoading}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-[13px] transition-colors cursor-pointer mt-1 flex items-center justify-center gap-1"
                >
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Code"}
                </button>
              </div>
            )}

            {forgotStep === 2 && (
              <div className="flex flex-col gap-3">
                <p className="text-zinc-400 text-[12.5px]">
                  We sent an 8-digit secure reset code to <span className="text-blue-400">{forgotEmail}</span>.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] text-zinc-400 font-medium">8-Digit Code</label>
                  <input
                    type="text"
                    maxLength={8}
                    value={resetCodeInput}
                    onChange={(e) => setResetCodeInput(e.target.value.replace(/\D/g, ""))}
                    className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-center text-zinc-200 text-base font-mono font-semibold tracking-widest outline-none focus:border-zinc-700"
                    placeholder="12345678"
                  />
                </div>
                {forgotError && (
                  <span className="text-red-400 text-[12px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{forgotError}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (resetCodeInput.length !== 8) {
                      setForgotError("Code must be exactly 8 digits.");
                      return;
                    }
                    setForgotError("");
                    setForgotStep(3);
                  }}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-[13px] transition-colors cursor-pointer mt-1"
                >
                  Verify Code
                </button>
              </div>
            )}

            {forgotStep === 3 && (
              <div className="flex flex-col gap-3">
                <p className="text-zinc-400 text-[12.5px]">
                  Enter a new password for your account.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] text-zinc-400 font-medium">New Password</label>
                  <div className="relative flex items-center">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl pl-3 pr-16 text-zinc-200 text-[13px] outline-none focus:border-zinc-700"
                      placeholder="Enter new password"
                    />
                    {newPasswordInput && confirmNewPasswordInput && isPasswordComplex(newPasswordInput) && newPasswordInput === confirmNewPasswordInput && (
                      <CheckCircle2 className="absolute right-9 w-4 h-4 text-blue-500 flex-shrink-0 animate-fadeIn" />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] text-zinc-400 font-medium">Confirm New Password</label>
                  <div className="relative flex items-center">
                    <input
                      type={showConfirmNewPassword ? "text" : "password"}
                      value={confirmNewPasswordInput}
                      onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                      className="w-full h-10 bg-zinc-900 border border-zinc-800 rounded-xl pl-3 pr-16 text-zinc-200 text-[13px] outline-none focus:border-zinc-700"
                      placeholder="Confirm new password"
                    />
                    {newPasswordInput && confirmNewPasswordInput && isPasswordComplex(newPasswordInput) && newPasswordInput === confirmNewPasswordInput && (
                      <CheckCircle2 className="absolute right-9 w-4 h-4 text-blue-500 flex-shrink-0 animate-fadeIn" />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {forgotError && (
                  <span className="text-red-400 text-[12px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{forgotError}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleResetPasswordSubmit}
                  disabled={forgotLoading}
                  className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-[13px] transition-colors cursor-pointer mt-1 flex items-center justify-center"
                >
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save New Password"}
                </button>
              </div>
            )}

            {forgotStep === 4 && (
              <div className="flex flex-col gap-3 text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-zinc-300 text-[13px]">
                  Your password has been successfully reset.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotStep(1);
                    setResetCodeInput("");
                    setNewPasswordInput("");
                    setConfirmNewPasswordInput("");
                  }}
                  className="mt-2 text-[12.5px] text-blue-400 hover:underline cursor-pointer"
                >
                  Sign In Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
