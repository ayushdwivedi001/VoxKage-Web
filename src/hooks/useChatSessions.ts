"use client";

import { useState, useRef, useEffect } from "react";
import { Message } from "@/lib/chatHelpers";
import {
  fetchSessions,
  fetchSessionMessages,
  toggleSessionStar,
  renameSession,
  deleteSession,
  getToken,
  WS_BACKEND_URL,
} from "@/lib/api";

interface UseChatSessionsProps {
  loginEmail: string;
  isLoggedIn: boolean;
  onLogout: () => void;
  setGreeting: (greeting: string) => void;
  getGreeting: (name: string, hr: number, day: number, isReturn: boolean) => string;
  extractNameFromEmail: (email: string) => string;
  setConnectedServers: (servers: string[]) => void;
  setModelsList: (models: any[]) => void;
  fetchConnectedAndModels: () => Promise<void>;
  onCreateNewChat: () => void;
}

export default function useChatSessions({
  loginEmail,
  isLoggedIn,
  onLogout,
  setGreeting,
  getGreeting,
  extractNameFromEmail,
  setConnectedServers,
  setModelsList,
  fetchConnectedAndModels,
  onCreateNewChat,
}: UseChatSessionsProps) {
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState("Greeting");
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesCache, setMessagesCache] = useState<{ [sessionId: string]: Message[] }>({});
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("disconnected");
  const [contextPercent, setContextPercent] = useState(0);

  const telemetryWsRef = useRef<WebSocket | null>(null);

  // Sync current active session messages with cache
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      setMessagesCache((prev) => {
        if (prev[currentSessionId] === messages) return prev;
        return { ...prev, [currentSessionId]: messages };
      });
    }
  }, [messages, currentSessionId]);

  // Live context-window % — recomputed from messages on every change.
  // Restored from the pre-modularization page.tsx (lost in commit 4163d59) and
  // aligned to backend/main.py calculate_context_percent (chars/4.2, 1M window,
  // 30k system-prompt/tools baseline) so it starts ~1% and grows as the
  // conversation accumulates tokens.
  const CONTEXT_WINDOW_TOKENS = 1_000_000;
  const SYSTEM_PROMPT_BASELINE_CHARS = 30000;
  useEffect(() => {
    let totalChars = SYSTEM_PROMPT_BASELINE_CHARS;
    for (const m of messages) {
      totalChars += (m.content || "").length + (m.role || "").length;
    }
    const tokens = Math.ceil(totalChars / 4.2);
    const pct = Math.min(100, Math.max(0, Math.round((tokens / CONTEXT_WINDOW_TOKENS) * 100)));
    setContextPercent(pct);
  }, [messages]);

  const loadSessionsOnly = async () => {
    try {
      const sess = await fetchSessions();
      setSessionsList(sess);
    } catch (e) {
      console.error("Failed to load sessions list", e);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadSessionsOnly();
    }
  }, [isLoggedIn]);

  // Reconnect the dynamic greeting: fires whenever the user logs in or their email is known
  useEffect(() => {
    if (!isLoggedIn) return;
    const now = new Date();
    const name = extractNameFromEmail(loginEmail);
    const g = getGreeting(name, now.getHours(), now.getDay(), false);
    setGreeting(g);
  }, [isLoggedIn, loginEmail]);

  const initializeTelemetryWS = (sessionId: string) => {
    if (telemetryWsRef.current) {
      telemetryWsRef.current.close();
      telemetryWsRef.current = null;
    }

    setConnectionStatus("connecting");
    const token = getToken() || "";
    const wsUrl = `${WS_BACKEND_URL}/ws/chat/${sessionId}?token=${token}`;
    const socket = new WebSocket(wsUrl);
    telemetryWsRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus("connected");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (data.type === "context_sync") {
          // Backend seeds the initial context-window % for this session.
          if (typeof data.percent === "number") {
            setContextPercent(data.percent);
          }
          return;
        }
        if (data.type === "hud_log") {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            const last = copy[lastIdx];
            if (last && last.role === "assistant") {
              const steps = last.thinkingSteps || [];
              const exists = steps.some((s) => s.label === data.content);
              if (!exists) {
                const stepId = `step-${steps.length + 1}`;
                copy[lastIdx] = {
                  ...last,
                  thinkingSteps: [
                    ...steps,
                    { id: stepId, label: data.content, status: "pending" },
                  ],
                };
              }
            }
            return copy;
          });
        } else if (data.type === "tool_success") {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            const last = copy[lastIdx];
            if (last && last.role === "assistant" && last.thinkingSteps) {
              copy[lastIdx] = {
                ...last,
                thinkingSteps: last.thinkingSteps.map((s) => {
                  if (s.status === "pending") {
                    return { ...s, status: "success" };
                  }
                  return s;
                }),
              };
            }
            return copy;
          });
        } else if (data.type === "tool_failed") {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            const last = copy[lastIdx];
            if (last && last.role === "assistant" && last.thinkingSteps) {
              copy[lastIdx] = {
                ...last,
                thinkingSteps: last.thinkingSteps.map((s) => {
                  if (s.status === "pending") {
                    return { ...s, status: "failed" };
                  }
                  return s;
                }),
              };
            }
            return copy;
          });
        } else if (data.type === "rename") {
          setChatTitle(data.name);
          loadSessionsOnly();
        }
      } catch (err) {
        console.warn("Failed to parse telemetry socket message:", err);
      }
    };

    socket.onclose = () => {
      setConnectionStatus("disconnected");
    };

    socket.onerror = () => {
      setConnectionStatus("disconnected");
    };
  };

  const loadSessionHistory = async (sessionId: string, scrollToBottom: () => void) => {
    setCurrentSessionId(sessionId);
    initializeTelemetryWS(sessionId);
    const cached = messagesCache[sessionId];
    if (cached) {
      setMessages(cached);
      const sess = sessionsList.find((s) => s.id === sessionId);
      if (sess) {
        setChatTitle(sess.name);
      }
      setTimeout(scrollToBottom, 50);
    } else {
      setIsSessionLoading(true);
      setMessages([]);
      const sess = sessionsList.find((s) => s.id === sessionId);
      if (sess) {
        setChatTitle(sess.name);
      }
    }

    try {
      const { messages: history, contextPercent: loadedPercent } =
        await fetchSessionMessages(sessionId);
      const mapped = history.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        status: "completed" as const,
        thinkingSteps: [],
      }));
      setMessagesCache((prev) => ({ ...prev, [sessionId]: mapped }));
      setCurrentSessionId((prevId) => {
        if (prevId === sessionId) {
          setMessages(mapped);
          setContextPercent(loadedPercent);
          setTimeout(scrollToBottom, 50);
        }
        return prevId;
      });
    } catch (e) {
      console.error("Failed to load session messages", e);
    } finally {
      setIsSessionLoading(false);
    }
  };

  const handleToggleStar = async (sessionId: string, starred: boolean) => {
    setSessionsList((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, is_starred: starred } : s))
    );
    try {
      await toggleSessionStar(sessionId, starred);
    } catch (e) {
      console.error("Failed to toggle star", e);
      setSessionsList((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, is_starred: !starred } : s))
      );
    }
  };

  const executeRenameSession = async (renameSessionId: string, renameValue: string) => {
    if (!renameSessionId || !renameValue.trim()) return;
    const newName = renameValue.trim();
    setSessionsList((prev) =>
      prev.map((s) => (s.id === renameSessionId ? { ...s, name: newName } : s))
    );
    if (currentSessionId === renameSessionId) {
      setChatTitle(newName);
    }
    try {
      await renameSession(renameSessionId, newName);
    } catch (e) {
      console.error("Failed to rename session", e);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setSessionsList((prev) => prev.filter((s) => s.id !== sessionId));
    setMessagesCache((prev) => {
      const copy = { ...prev };
      delete copy[sessionId];
      return copy;
    });
    if (currentSessionId === sessionId) {
      onCreateNewChat();
    }
    try {
      await deleteSession(sessionId);
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  };

  return {
    sessionsList,
    setSessionsList,
    currentSessionId,
    setCurrentSessionId,
    chatTitle,
    setChatTitle,
    messages,
    setMessages,
    isSessionLoading,
    setIsSessionLoading,
    connectionStatus,
    telemetryWsRef,
    contextPercent,
    setContextPercent,
    loadSessionsOnly,
    loadSessionHistory,
    handleToggleStar,
    executeRenameSession,
    handleDeleteSession,
  };
}
