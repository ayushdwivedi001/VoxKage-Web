export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://shinayush-voxkage-web-backend.hf.space";
export const WS_BACKEND_URL = BACKEND_URL.replace(/^http/, "ws");

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("voxkage_web_token");
  }
  return null;
}

export function saveToken(token: string, email: string, avatarUrl?: string, userName?: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("voxkage_web_token", token);
    localStorage.setItem("voxkage_web_email", email);
    if (avatarUrl && avatarUrl.trim()) {
      localStorage.setItem("voxkage_web_avatar_url", avatarUrl.trim());
    } else {
      localStorage.removeItem("voxkage_web_avatar_url");
    }
    if (userName && userName.trim()) {
      localStorage.setItem("voxkage_user_name", userName.trim());
    } else {
      localStorage.removeItem("voxkage_user_name");
    }
  }
}

export function getAvatarUrl(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("voxkage_web_avatar_url") || "";
  }
  return "";
}

export function clearToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("voxkage_web_token");
    localStorage.removeItem("voxkage_web_email");
    localStorage.removeItem("voxkage_web_avatar_url");
    localStorage.removeItem("voxkage_user_name");
  }
}

async function apiRequest(endpoint: string, method: string = "GET", body: any = null) {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("voxkage_unauthorized"));
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (errorText.includes("<!DOCTYPE html>") || errorText.includes("<html") || response.status === 500) {
      throw new Error("FastAPI backend is restarting on Hugging Face. Please retry in 5 seconds.");
    }
    throw new Error(errorText || response.statusText);
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
      throw new Error("FastAPI backend is starting up or temporarily offline. Please wait a few seconds and try again.");
    }
    throw new Error("Server returned non-JSON response.");
  }

  return response.json();
}

export async function login(email: string, masterKey: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/auth/master-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, master_key: masterKey }),
  });
  if (!res.ok) {
    throw new Error("Invalid Master Key");
  }

  const contentType = res.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
      throw new Error("FastAPI backend is starting up or temporarily offline. Please wait a few seconds and try again.");
    }
    throw new Error("Server returned non-JSON response.");
  }

  const data = await res.json();
  const token = data.access_token;
  saveToken(token, email, "", data.user_name);
  return token;
}

export async function sendOtp(email: string): Promise<any> {
  const res = await fetch(`${BACKEND_URL}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || "Failed to send OTP.");
  }
  return res.json();
}

export async function verifyOtp(email: string, otp: string, userName?: string): Promise<{ token: string; avatarUrl?: string; userName?: string }> {
  const res = await fetch(`${BACKEND_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp, user_name: userName }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Invalid or expired OTP code.");
  }
  const data = await res.json();
  saveToken(data.access_token, data.email || email, data.avatar_url, data.user_name);
  return { token: data.access_token, avatarUrl: data.avatar_url, userName: data.user_name };
}

export async function loginWithGoogle(credential: string): Promise<{ token: string; avatarUrl?: string; userName?: string }> {
  const res = await fetch(`${BACKEND_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Google authentication failed.");
  }
  const data = await res.json();
  saveToken(data.access_token, data.email, data.avatar_url, data.user_name);
  return { token: data.access_token, avatarUrl: data.avatar_url, userName: data.user_name };
}

export async function signupUser(email: string, password: string, userName: string): Promise<{ token: string; avatarUrl?: string; userName?: string }> {
  const res = await fetch(`${BACKEND_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, user_name: userName }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to create account.");
  }
  const data = await res.json();
  saveToken(data.access_token, data.email, data.avatar_url, data.user_name);
  return { token: data.access_token, avatarUrl: data.avatar_url, userName: data.user_name };
}

export async function loginWithPassword(email: string, password: string): Promise<{ token: string; avatarUrl?: string; userName?: string }> {
  const res = await fetch(`${BACKEND_URL}/auth/login-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Invalid email or password.");
  }
  const data = await res.json();
  saveToken(data.access_token, data.email, data.avatar_url, data.user_name);
  return { token: data.access_token, avatarUrl: data.avatar_url, userName: data.user_name };
}

export async function fetchSessions() {
  return apiRequest("/sessions");
}

export async function createSession(name: string = "New Chat") {
  return apiRequest(`/sessions?name=${encodeURIComponent(name)}`, "POST");
}

export async function fetchSessionMessages(sessionId: string) {
  const res = await apiRequest(`/sessions/${sessionId}`);
  return {
    messages: res.messages || [],
    contextPercent: res.context_percent || 0
  };
}

export async function deleteSession(sessionId: string) {
  return apiRequest(`/sessions/${sessionId}`, "DELETE");
}

export async function renameSession(sessionId: string, name: string) {
  return apiRequest(`/sessions/${sessionId}/rename?name=${encodeURIComponent(name)}`, "PUT");
}

export async function toggleSessionStar(sessionId: string, starred: boolean) {
  return apiRequest(`/sessions/${sessionId}/star?starred=${starred}`, "PUT");
}

export async function fetchFavorites() {
  const res = await apiRequest("/user/favorites");
  return res.favorite_models || [];
}

export async function saveFavorites(favorites: string[]) {
  const res = await apiRequest("/user/favorites", "POST", { favorites });
  return res.favorite_models || [];
}

export async function fetchSettingsProfile() {
  const res = await apiRequest("/user/settings-profile");
  return res.settings_profile || {};
}

export async function saveSettingsProfile(profile: any) {
  const res = await apiRequest("/user/settings-profile", "POST", { settings_profile: profile });
  return res.settings_profile || {};
}

export async function fetchModels(): Promise<string[]> {
  try {
    return await apiRequest("/models");
  } catch (e) {
    console.error("Failed to fetch models, returning defaults:", e);
    return ["deepseek-v4-flash-free", "gemini-3.5-flash", "claude-sonnet-4", "mimo-v2.5-free"];
  }
}

export async function fetchKiloModels(kiloKey: string): Promise<any[]> {
  if (!kiloKey) return [];
  // 1. Try FastAPI backend endpoint first
  try {
    const res = await apiRequest(`/models/kilo?kilo_api_key=${encodeURIComponent(kiloKey.trim())}`);
    if (Array.isArray(res) && res.length > 0) {
      return res;
    }
  } catch (e) {
    console.warn("Backend /models/kilo unavailable, attempting direct client fetch:", e);
  }

  // 2. Direct client-side fetch fallback
  try {
    const res = await fetch("https://api.kilo.ai/api/gateway/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${kiloKey.trim()}`,
        Accept: "application/json",
      },
    });
    if (res.ok) {
      const json = await res.json();
      const data = json.data || [];
      return data.map((m: any) => {
        const isFree = m.isFree || m.id.endsWith(":free");
        return {
          name: m.name || m.id,
          api_key: m.id,
          provider: "kilo",
          desc: m.description || (isFree ? "Free Model" : "Paid Model"),
          isFree,
          requiresUpgrade: !isFree,
        };
      });
    }
  } catch (e) {
    // Silent recovery if direct client fetch hits network drop/CORS preflight
    console.warn("Direct fetch to Kilo models unavailable:", e);
  }
  return [];
}

export async function uploadSessionFile(sessionId: string, file: File) {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BACKEND_URL}/sessions/${sessionId}/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (response.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("voxkage_unauthorized"));
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return response.json();
}

export async function deleteSessionFile(sessionId: string, filename: string) {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BACKEND_URL}/sessions/${sessionId}/files/${filename}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return response.json();
}

export async function adoptDraftFiles(sessionId: string, draftId: string) {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BACKEND_URL}/sessions/${sessionId}/adopt-draft/${draftId}`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return response.json();
}

export async function prepareSessionPayload(
  sessionId: string,
  query: string,
  attachments: any[],
  model: string,
  variant: string,
  skipTools?: boolean
) {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  const clientTime = new Intl.DateTimeFormat('en-US', options).format(new Date()).replace(" at ", ", ");

  return apiRequest(`/sessions/${sessionId}/prepare`, "POST", {
    message: query,
    attachments,
    model,
    variant,
    client_time: clientTime,
    skip_tools: !!skipTools
  });
}

export async function executeBackendTools(sessionId: string, toolCalls: any[]) {
  return apiRequest(`/sessions/${sessionId}/execute-tools`, "POST", {
    tool_calls: toolCalls
  });
}

export async function logAssistantResponse(sessionId: string, content: string) {
  return apiRequest(`/sessions/${sessionId}/log`, "POST", {
    content
  });
}

export async function editSessionMessage(sessionId: string, messageId: string, newContent: string) {
  return apiRequest(`/sessions/${sessionId}/messages/${messageId}/edit`, "PUT", {
    new_content: newContent
  });
}

export async function logMessageFeedback(
  sessionId: string,
  messageId: string,
  feedbackType: "thumbs_up" | "thumbs_down",
  comments?: string
) {
  return apiRequest(`/sessions/${sessionId}/messages/${messageId}/feedback`, "POST", {
    feedback_type: feedbackType,
    comments
  });
}

export async function fetchBootPayload() {
  return apiRequest("/user/boot-payload", "GET");
}

export async function compactSession(sessionId: string, model: string) {
  return apiRequest(`/sessions/${sessionId}/compact`, "POST", { model });
}

