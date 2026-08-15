"use client";

import React, { useEffect, useState, useRef } from "react";
import { Info } from "lucide-react";

// Existing Components
import Sidebar from "@/components/Sidebar";

// Extracted Components
import LoginView from "@/components/LoginView";
import OnboardingView from "@/components/OnboardingView";
import RightPanel from "@/components/RightPanel";
import ChatHeader from "@/components/ChatHeader";
import ChatWorkspace from "@/components/ChatWorkspace";
import OverlayManager from "@/components/OverlayManager";
import DesignDottedCanvas from "@/components/DesignDottedCanvas";

// Extracted Hooks
import useChatSessions from "@/hooks/useChatSessions";
import useAttachments from "@/hooks/useAttachments";
import useAgentCompletion, { sessionToolsCache } from "@/hooks/useAgentCompletion";
import usePanelResizer from "@/hooks/usePanelResizer";
import useAuth from "@/hooks/useAuth";
import { useParams } from "next/navigation";

// Lib/Helpers
import { Attachment } from "@/components/MessageAttachmentsRow";
import { computeSessionFiles } from "@/lib/chatHelpers";
import { getGreeting, extractNameFromEmail, getRelativeTime } from "@/lib/greetings";
import { mapModelsList } from "@/lib/modelsHelper";
import {
  fetchSessions,
  fetchFavorites,
  saveFavorites,
  fetchSettingsProfile,
  fetchModels,
  deleteSession,
  fetchBootPayload,
} from "@/lib/api";

export default function Home() {
  const params = useParams();
  const urlSessionId = params?.sessionId as string | undefined;
  const [accessDeniedError, setAccessDeniedError] = useState(false);

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectingServer, setConnectingServer] = useState<{ id: string; name: string } | null>(null);
  const [connectedServers, setConnectedServers] = useState<string[]>([]);

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isChatActive, setIsChatActive] = useState(() => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname;
    return Boolean(urlSessionId || (path.length > 1 && path !== "/"));
  });

  // Code inspection split pane states
  const [activeFile, setActiveFile] = useState<{ name: string; code: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Comments and versions states
  const [comments, setComments] = useState<Array<{ id: string; fileName: string; line: number; text: string }>>([]);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [jumpToLine, setJumpToLine] = useState<number | null>(null);
  const [showArtifactsPanel, setShowArtifactsPanel] = useState(false);
  const [activeFileVersions, setActiveFileVersions] = useState<{ [name: string]: number }>({});

  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const [openCodeApiKey, setOpenCodeApiKey] = useState("");
  const [kiloApiKey, setKiloApiKey] = useState("");
  const [hasLoadedKeys, setHasLoadedKeys] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const favoritesRef = useRef(favorites);
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);
  const [customProxyUrl, setCustomProxyUrl] = useState("");

  const [userName, setUserName] = useState("");
  const [userAvatarUrl, setUserAvatarUrl] = useState("");
  const [greeting, setGreeting] = useState("");
  const hasVisitedRef = useRef(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Image & Document Zoom preview states
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomThumbnailRect, setZoomThumbnailRect] = useState<DOMRect | null>(null);
  const [zoomDocument, setZoomDocument] = useState<Attachment | null>(null);

  // Model Selector states
  const [selectedModel, setSelectedModel] = useState("DeepSeek V4 Flash");
  const [selectedVariant, setSelectedVariant] = useState("Max");
  const [moreModelsModalOpen, setMoreModelsModalOpen] = useState(false);
  const [modelsList, setModelsList] = useState<any[]>([]);

  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);

  // Panel resizing custom hook
  const { rightPanelWidth, handlePointerDown } = usePanelResizer(480);

  const loadInitialData = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("voxkage_web_token") : null;
    if (!token) return;
    try {
      const sess = await fetchSessions();
      chatSessions.setSessionsList(sess);

      const boot = await fetchBootPayload();

      // Cross-device theme sync — preserve user local preference over stale backend defaults
      const localTheme = localStorage.getItem("voxkage_theme_mode");
      if (localTheme && ["light", "dark", "system"].includes(localTheme)) {
        const root = document.documentElement;
        if (localTheme === "light") {
          root.classList.add("light");
          root.classList.remove("dark");
        } else if (localTheme === "dark") {
          root.classList.add("dark");
          root.classList.remove("light");
        } else {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          if (prefersDark) {
            root.classList.add("dark");
            root.classList.remove("light");
          } else {
            root.classList.add("light");
            root.classList.remove("dark");
          }
        }
        window.dispatchEvent(new CustomEvent("voxkage_theme_updated", { detail: localTheme }));
      } else if (boot.theme_mode && ["light", "dark", "system"].includes(boot.theme_mode)) {
        localStorage.setItem("voxkage_theme_mode", boot.theme_mode);
        const root = document.documentElement;
        if (boot.theme_mode === "light") {
          root.classList.add("light");
          root.classList.remove("dark");
        } else if (boot.theme_mode === "dark") {
          root.classList.add("dark");
          root.classList.remove("light");
        }
        window.dispatchEvent(new CustomEvent("voxkage_theme_updated", { detail: boot.theme_mode }));
      }

      setConnectedServers(boot.mcp_connections || []);
      setFavorites(boot.favorites || []);

      
      let initialModels = mapModelsList(boot.models || [], boot.favorites || []);
      const { secureLoadKey } = await import("@/lib/secureStorage");
      const email = auth.loginEmail?.trim().toLowerCase() || (typeof window !== "undefined" ? localStorage.getItem("voxkage_web_email")?.trim().toLowerCase() : null);
      const kKey = email ? await secureLoadKey(`voxkage_${email}_kilo_api_key`) : null;
      if (kKey) {
        const { fetchKiloModels } = await import("@/lib/api");
        const kiloModels = await fetchKiloModels(kKey);
        if (kiloModels && kiloModels.length > 0) {
          const kiloFormatted = kiloModels.map((km: any) => ({
            name: km.name,
            desc: km.desc,
            api_key: km.api_key || km.name,
            provider: "kilo",
            isFavourite: (boot.favorites || []).includes(km.name) || (boot.favorites || []).includes(km.api_key),
            requiresUpgrade: km.requiresUpgrade
          }));
          initialModels = [...initialModels, ...kiloFormatted] as any;
        }
      }
      setModelsList(initialModels);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("voxkage_cached_models", JSON.stringify(initialModels));
        } catch (e) {}
      }
      
      if (boot.user_name) {
        localStorage.setItem("voxkage_user_name", boot.user_name);
        setUserName(boot.user_name);
      } else {
        localStorage.removeItem("voxkage_user_name");
        setUserName("");
      }
      if (boot.avatar_url && boot.avatar_url.trim()) {
        localStorage.setItem("voxkage_web_avatar_url", boot.avatar_url.trim());
        setUserAvatarUrl(boot.avatar_url.trim());
      } else {
        localStorage.removeItem("voxkage_web_avatar_url");
        setUserAvatarUrl("");
      }

      if (boot.custom_proxy_url) {
        localStorage.setItem("voxkage_custom_proxy_url", boot.custom_proxy_url);
        setCustomProxyUrl(boot.custom_proxy_url);
      }

      if (boot.selected_model && !localStorage.getItem("voxkage_selected_model")) {
        localStorage.setItem("voxkage_selected_model", boot.selected_model);
        setSelectedModel(boot.selected_model);
      } else if (localStorage.getItem("voxkage_selected_model")) {
        setSelectedModel(localStorage.getItem("voxkage_selected_model") || "DeepSeek V4 Flash");
      }

      if (boot.selected_variant && !localStorage.getItem("voxkage_selected_variant")) {
        localStorage.setItem("voxkage_selected_variant", boot.selected_variant);
        setSelectedVariant(boot.selected_variant);
      } else if (localStorage.getItem("voxkage_selected_variant")) {
        setSelectedVariant(localStorage.getItem("voxkage_selected_variant") || "Max");
      }

      if (boot.build_mode && !localStorage.getItem("voxkage_build_mode")) {
        localStorage.setItem("voxkage_build_mode", boot.build_mode);
        if (agentCompletion?.setBuildMode) {
          agentCompletion.setBuildMode(boot.build_mode as any);
        }
      }

      if (boot.mcp_tools) {
        sessionToolsCache["__boot_tools__"] = boot.mcp_tools;
      }
    } catch (e) {
      console.error("Failed to load initial data", e);
    }
  };

  // Auth management custom hook
  const auth = useAuth({
    loadInitialData,
    onLogoutSuccess: () => {
      chatSessions.setMessages([]);
      chatSessions.setCurrentSessionId(null);
      setIsChatActive(false);
      chatSessions.setChatTitle("Greeting");
      setUserName("");
      setUserAvatarUrl("");
    },
  });

  // Hooks Integration
  const chatSessions = useChatSessions({
    loginEmail: auth.loginEmail,
    isLoggedIn: auth.isLoggedIn,
    userName,
    onLogout: () => auth.handleLogout(),
    setGreeting,
    getGreeting,
    extractNameFromEmail,
    setConnectedServers,
    setModelsList,
    fetchConnectedAndModels: loadInitialData,
    onCreateNewChat: () => handleCreateNewChat(),
  });

  const attachmentsManager = useAttachments({
    currentSessionId: chatSessions.currentSessionId,
    draftSessionId,
    setDraftSessionId,
  });

  const agentCompletion = useAgentCompletion({
    currentSessionId: chatSessions.currentSessionId,
    setCurrentSessionId: chatSessions.setCurrentSessionId,
    draftSessionId,
    setDraftSessionId,
    messages: chatSessions.messages,
    setMessages: chatSessions.setMessages,
    attachments: attachmentsManager.attachments,
    setAttachments: attachmentsManager.setAttachments,
    comments,
    setComments,
    editingFile,
    setEditingFile,
    setIsChatActive,
    setChatTitle: chatSessions.setChatTitle,
    setSessionsList: chatSessions.setSessionsList,
    selectedModel,
    selectedVariant,
    activeFileVersions,
    setActiveFileVersions,
    setActiveFile,
    hasVisitedRef,
    abortControllerRef,
    sessionArtifacts: computeSessionFiles(chatSessions.messages),
    setShowArtifactsPanel,
    setJumpToLine,
    loginEmail: auth.loginEmail,
  });

  // Load settings on mount with secure encryption load & instant models cache hydration
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("voxkage_cached_models");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setModelsList(parsed);
          }
        }
      } catch (e) {}

      const savedProxy = localStorage.getItem("voxkage_custom_proxy_url");
      if (savedProxy) {
        setCustomProxyUrl(savedProxy);
      }
      setUserName(localStorage.getItem("voxkage_user_name") || "");
      setUserAvatarUrl(localStorage.getItem("voxkage_web_avatar_url") || "");
      const savedModel = localStorage.getItem("voxkage_selected_model");
      if (savedModel) setSelectedModel(savedModel);
      const savedVariant = localStorage.getItem("voxkage_selected_variant");
      if (savedVariant) setSelectedVariant(savedVariant);
    }
  }, []);

  // Load settings when logged in and email is available, with migration fallback
  useEffect(() => {
    if (auth.isLoggedIn && auth.loginEmail) {
      const email = auth.loginEmail.trim().toLowerCase();
      const userOpenCodeKey = `voxkage_${email}_opencode_api_key`;
      const userKiloKey = `voxkage_${email}_kilo_api_key`;

      import("@/lib/secureStorage").then(async ({ secureLoadKey, secureSaveKey }) => {
        let openCodeKey = await secureLoadKey(userOpenCodeKey);
        let kiloKey = await secureLoadKey(userKiloKey);

        // Migration logic for ayushdwivedi2049@gmail.com
        if (!openCodeKey) {
          const oldOpenCodeKey = await secureLoadKey("voxkage_opencode_api_key");
          if (oldOpenCodeKey && email === "ayushdwivedi2049@gmail.com") {
            openCodeKey = oldOpenCodeKey;
            await secureSaveKey(userOpenCodeKey, oldOpenCodeKey);
          }
        }
        if (!kiloKey) {
          const oldKiloKey = await secureLoadKey("voxkage_kilo_api_key");
          if (oldKiloKey && email === "ayushdwivedi2049@gmail.com") {
            kiloKey = oldKiloKey;
            await secureSaveKey(userKiloKey, oldKiloKey);
          }
        }

        setOpenCodeApiKey(openCodeKey);
        setKiloApiKey(kiloKey);
        setHasLoadedKeys(true);
      });
    } else {
      setOpenCodeApiKey("");
      setKiloApiKey("");
      setHasLoadedKeys(false);
    }
  }, [auth.isLoggedIn, auth.loginEmail]);

  // Dynamically load Kilo Code models when kiloApiKey updates
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("voxkage_web_token") : null;
    if (!kiloApiKey || !token) return;
    import("@/lib/api").then(({ fetchKiloModels }) => {
      fetchKiloModels(kiloApiKey).then((kiloModels) => {
        if (kiloModels && kiloModels.length > 0) {
          setModelsList((prev) => {
            const nonKilo = prev.filter((m) => m.provider !== "kilo");
            const kiloFormatted = kiloModels.map((km: any) => {
              const kmKey = km.api_key || km.name;
              return {
                name: km.name,
                desc: km.desc,
                api_key: kmKey,
                provider: "kilo",
                isFavourite: favoritesRef.current.includes(km.name) || favoritesRef.current.includes(kmKey),
                requiresUpgrade: km.requiresUpgrade,
              };
            });
            const updated = [...nonKilo, ...kiloFormatted];
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("voxkage_cached_models", JSON.stringify(updated));
              } catch (e) {}
            }
            return updated;
          });
        }
      });
    });
  }, [kiloApiKey]);

  // Load session from URL or user-specific last active cache on login
  useEffect(() => {
    if (!auth.isLoggedIn) return;
    const email = auth.loginEmail.trim().toLowerCase();
    const lastSessionKey = `voxkage_${email}_last_active_session`;

    import("@/lib/api").then(({ fetchSessionMessages }) => {
      if (urlSessionId) {
        const loadSessionFromUrl = async () => {
          try {
            setAccessDeniedError(false);
            await fetchSessionMessages(urlSessionId);
            setIsChatActive(true);
            chatSessions.loadSessionHistory(urlSessionId, scrollToBottom);
            localStorage.setItem(lastSessionKey, urlSessionId);
          } catch (err: any) {
            console.error("Access denied or session not found:", err);
            setAccessDeniedError(true);
          }
        };
        loadSessionFromUrl();
      } else {
        const cachedSessionId = localStorage.getItem(lastSessionKey);
        if (cachedSessionId) {
          window.history.pushState(null, "", `/${cachedSessionId}`);
        } else {
          chatSessions.setCurrentSessionId(null);
          chatSessions.setMessages([]);
          setIsChatActive(false);
          chatSessions.setChatTitle("Greeting");
        }
      }
    });
  }, [auth.isLoggedIn, urlSessionId]);

  // Synchronize dynamic active session ID to the URL pathname
  useEffect(() => {
    if (auth.isLoggedIn) {
      const email = auth.loginEmail.trim().toLowerCase();
      if (chatSessions.currentSessionId) {
        window.history.pushState(null, "", `/${chatSessions.currentSessionId}`);
        localStorage.setItem(`voxkage_${email}_last_active_session`, chatSessions.currentSessionId);
      } else {
        window.history.pushState(null, "", "/");
        localStorage.removeItem(`voxkage_${email}_last_active_session`);
      }
    }
  }, [chatSessions.currentSessionId, auth.isLoggedIn]);

  // Handle browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        const matchedSessionId = path.substring(1); // Strip leading slash
        if (matchedSessionId) {
          setIsChatActive(true);
          chatSessions.loadSessionHistory(matchedSessionId, scrollToBottom);
        } else {
          chatSessions.setCurrentSessionId(null);
          chatSessions.setMessages([]);
          setIsChatActive(false);
          chatSessions.setChatTitle("Greeting");
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleCreateNewChat = () => {
    if (chatSessions.telemetryWsRef.current) {
      chatSessions.telemetryWsRef.current.close();
      chatSessions.telemetryWsRef.current = null;
    }
    const activeDraftId = draftSessionId;
    if (activeDraftId) {
      try {
        deleteSession(activeDraftId);
      } catch (e) {
        console.warn("Failed to delete draft uploads:", e);
      }
      setDraftSessionId(null);
      attachmentsManager.setAttachments([]);
    }
    chatSessions.setCurrentSessionId(null);
    chatSessions.setMessages([]);
    setIsChatActive(false);
    chatSessions.setChatTitle("Greeting");
    chatSessions.setContextPercent(0);
    setActiveFile(null);
    setComments([]);
    setJumpToLine(null);
    setShowArtifactsPanel(false);
    setActiveFileVersions({});
  };

  const handleSelectSession = (sessionId: string | null) => {
    const activeDraftId = draftSessionId;
    if (activeDraftId) {
      try {
        deleteSession(activeDraftId);
      } catch (e) {
        console.warn("Failed to delete draft uploads:", e);
      }
      setDraftSessionId(null);
      attachmentsManager.setAttachments([]);
    }
    if (sessionId) {
      setIsChatActive(true);
      chatSessions.loadSessionHistory(sessionId, scrollToBottom);
    } else {
      handleCreateNewChat();
    }
  };

  const handleToggleFavourite = async (modelName: string) => {
    let apiName = modelName;
    if (modelName === "DeepSeek V4 Flash") apiName = "deepseek-v4-flash-free";
    else if (modelName === "Gemini 3.5 Flash") apiName = "gemini-3.5-flash";
    else if (modelName === "Claude 4.6 Sonnet") apiName = "claude-sonnet-4";
    else if (modelName === "Mimo 2.5 Free") apiName = "mimo-v2.5-free";

    const updated = modelsList.map((model) =>
      model.name === modelName ? { ...model, isFavourite: !model.isFavourite } : model
    );
    setModelsList(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("voxkage_cached_models", JSON.stringify(updated));
      } catch (e) {}
    }

    const favs = updated.filter((m) => m.isFavourite).map((m) => m.api_key);
    setFavorites(favs);
    try {
      await saveFavorites(favs);
    } catch (e) {
      console.error("Failed to save favorites to backend", e);
    }
  };

  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const [hasUnreadResponse, setHasUnreadResponse] = useState(false);
  const prevMessagesLengthRef = useRef(0);

  const scrollToBottom = () => {
    setUserHasScrolledUp(false);
    setHasUnreadResponse(false);
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    const isScrolledUp = distanceToBottom > 80;
    setShowScrollBottom(isScrolledUp);

    if (isScrolledUp) {
      setUserHasScrolledUp(true);
    } else {
      setUserHasScrolledUp(false);
      setHasUnreadResponse(false);
    }
  };

  useEffect(() => {
    if (!userHasScrolledUp) {
      scrollToBottom();
    } else {
      const isStreamingActive = agentCompletion.isStreaming || (chatSessions.messages.length > 0 &&
        (chatSessions.messages[chatSessions.messages.length - 1].status === "thinking" ||
         chatSessions.messages[chatSessions.messages.length - 1].status === "streaming"));
      if (chatSessions.messages.length > prevMessagesLengthRef.current || isStreamingActive) {
        setHasUnreadResponse(true);
      }
    }
    prevMessagesLengthRef.current = chatSessions.messages.length;
  }, [chatSessions.messages, userHasScrolledUp, agentCompletion.isStreaming]);

  const handlePreviewImage = (url: string, rect: DOMRect) => {
    setZoomThumbnailRect(rect);
    setZoomImage(url);
  };

  // Prevent flash of login screen while checking auth
  if (auth.isAuthChecking) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-[#05050a] [.light_&]:bg-[#DBDAD4]">
      </div>
    );
  }

  if (!auth.isLoggedIn) {
    return (
      <LoginView
        loginEmail={auth.loginEmail}
        setLoginEmail={auth.setLoginEmail}
        loginError={auth.loginError}
        loginLoading={auth.loginLoading}
        onGoogleSuccess={(token: string, email: string, avatarUrl?: string, name?: string) => {
          auth.setLoginEmail(email);
          auth.setIsLoggedIn(true);
          if (avatarUrl) setUserAvatarUrl(avatarUrl);
          if (name) setUserName(name);
        }}
        onAuthSuccess={(token: string, email: string, avatarUrl?: string, name?: string) => {
          auth.setLoginEmail(email);
          auth.setIsLoggedIn(true);
          if (avatarUrl) setUserAvatarUrl(avatarUrl);
          if (name) setUserName(name);
        }}
      />
    );
  }

  // Prevent flash of onboarding screen while loading keys
  if (auth.isLoggedIn && !hasLoadedKeys) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-[#05050a] [.light_&]:bg-[#DBDAD4]">
      </div>
    );
  }

  // Check if user is onboarded (has at least one API key configured)
  const isUserOnboarded = !!openCodeApiKey || !!kiloApiKey;
  if (!isUserOnboarded) {
    return (
      <OnboardingView
        userEmail={auth.loginEmail}
        onComplete={(openCodeKey, kiloKey) => {
          if (openCodeKey) setOpenCodeApiKey(openCodeKey);
          if (kiloKey) setKiloApiKey(kiloKey);
        }}
        onLogout={auth.handleLogout}
      />
    );
  }

  // Merge Word artifacts (real doc_state from MCP tool calls) into session artifacts
  const codeSessionFiles = computeSessionFiles(chatSessions.messages);
  const wordFiles = Array.from((agentCompletion.wordArtifacts || new Map()).entries()).map(([name, content]) => ({
    name,
    type: "Microsoft Word · DOCX",
    versions: [{ version: 1, code: content }],
  }));
  // Word files take priority over stub .docx entries from computeSessionFiles
  const wordFileNames = new Set(wordFiles.map((f) => f.name));
  const sessionArtifacts = [
    ...codeSessionFiles.filter((f) => !wordFileNames.has(f.name)),
    ...wordFiles,
  ];

  let displayedActiveFile = activeFile;
  if (activeFile) {
    const fileData = sessionArtifacts.find((f) => f.name === activeFile.name);
    if (fileData) {
      const selectedVerNum = activeFileVersions[activeFile.name] || fileData.versions.length;
      const verObj =
        fileData.versions.find((v) => v.version === selectedVerNum) ||
        fileData.versions[fileData.versions.length - 1];
      if (verObj) {
        displayedActiveFile = {
          name: activeFile.name,
          code: verObj.code,
        };
      }
    }
  }

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#05050a] [.light_&]:bg-[#DBDAD4]">
      <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
        <defs>
          <clipPath id="vc-body-clip">
            <path d="M 50 10 C 74 10, 90 28, 90 53 C 90 76, 72 90, 50 90 C 28 90, 10 76, 10 53 C 10 28, 26 10, 50 10 Z" />
          </clipPath>
          <linearGradient id="vc-wave-grad-blue" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.96} />
            <stop offset="30%" stopColor="#38bdf8" stopOpacity={0.9} />
            <stop offset="70%" stopColor="#0438c2" stopOpacity={0.95} />
            <stop offset="92%" stopColor="#020938" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#020938" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="vc-angry-red-body-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#f87171" />
            <stop offset="75%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          <linearGradient id="vc-light-body-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="12%" stopColor="#ffffff" />
            <stop offset="68%" stopColor="#338cecff" />
            <stop offset="100%" stopColor="#338cecff" />
          </linearGradient>
        </defs>
      </svg>

      <Sidebar
        isExpanded={sidebarExpanded}
        setIsExpanded={setSidebarExpanded}
        currentSessionId={chatSessions.currentSessionId}
        onSelectSession={handleSelectSession}
        sessionsList={chatSessions.sessionsList}
        onCreateNewChat={handleCreateNewChat}
        onLogout={auth.handleLogout}
        onToggleStar={chatSessions.handleToggleStar}
        onRenameSession={(id, currentName) => {
          setRenameSessionId(id);
          setRenameValue(currentName);
        }}
        onDeleteSession={chatSessions.handleDeleteSession}
        onOpenSettings={() => {
          const email = auth.loginEmail.trim().toLowerCase();
          import("@/lib/secureStorage").then(({ secureLoadKey }) => {
            secureLoadKey(`voxkage_${email}_opencode_api_key`).then((key) => {
              setOpenCodeApiKey(key);
            });
            secureLoadKey(`voxkage_${email}_kilo_api_key`).then((key) => {
              setKiloApiKey(key);
            });
          });
          const savedProxy = localStorage.getItem("voxkage_custom_proxy_url");
          if (savedProxy) {
            setCustomProxyUrl(savedProxy);
          }
          setShowSettingsModal(true);
        }}
        onOpenProfile={() => {
          setUserName(localStorage.getItem("voxkage_user_name") || "");
          setShowProfileModal(true);
        }}
        connectionStatus={chatSessions.connectionStatus}
        onOpenSearch={() => {
          setShowSearchModal(true);
          setSearchSelectedIndex(0);
          setSearchQuery("");
        }}
        onOpenConnect={() => setShowConnectModal(true)}
        isChatActive={isChatActive}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
      />

      {/* === BACKGROUND LAYERS === */}
      <DesignDottedCanvas active={true} isChatActive={isChatActive} />

      <main className="relative flex flex-col flex-grow items-center justify-between w-full h-full max-w-full overflow-hidden bg-transparent transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10">
        <ChatHeader
          isChatActive={isChatActive}
          isExpanded={isExpanded}
          activeFile={activeFile}
          showArtifactsPanel={showArtifactsPanel}
          rightPanelWidth={rightPanelWidth}
          chatTitle={chatSessions.chatTitle}
          currentSessionId={chatSessions.currentSessionId}
          sessionsList={chatSessions.sessionsList}
          handleToggleStar={chatSessions.handleToggleStar}
          setRenameSessionId={setRenameSessionId}
          setRenameValue={setRenameValue}
          setShowArtifactsPanel={setShowArtifactsPanel}
          sessionArtifacts={sessionArtifacts}
          handleDeleteSession={chatSessions.handleDeleteSession}
          onToggleSidebar={() => setSidebarExpanded((prev) => !prev)}
        />

        <div className="relative flex flex-grow w-full h-full overflow-hidden">
          {accessDeniedError ? (
            <div className="flex flex-col flex-grow items-center justify-center bg-[#05050a] text-center p-8 z-10 select-none w-full h-full animate-fadeIn">
              <div className="max-w-md w-full bg-[#0d0d12]/95 border border-zinc-800/80 rounded-2xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-md flex flex-col gap-5">
                <div className="w-12 h-12 rounded-full bg-red-950/20 border border-red-900/40 flex items-center justify-center mx-auto text-red-500">
                  <Info className="w-6 h-6" />
                </div>
                <h3 className="text-zinc-100 text-lg font-bold tracking-tight">Access Denied</h3>
                <p className="text-zinc-400 text-[13px] leading-relaxed">
                  This conversation session does not exist or you do not have permission to view it.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAccessDeniedError(false);
                    window.history.pushState(null, "", "/");
                    chatSessions.setCurrentSessionId(null);
                    chatSessions.setMessages([]);
                    setIsChatActive(false);
                    chatSessions.setChatTitle("Greeting");
                  }}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-medium text-[13px] rounded-xl flex items-center justify-center transition-colors cursor-pointer shadow-[0_0_12px_rgba(37,99,235,0.15)]"
                >
                  Return to Home
                </button>
              </div>
            </div>
          ) : (
            <ChatWorkspace
              sessionId={chatSessions.currentSessionId}
              isChatActive={isChatActive}
              chatContainerRef={chatContainerRef}
              handleScroll={handleScroll}
              isSessionLoading={chatSessions.isSessionLoading}
              messages={chatSessions.messages}
              handlePreviewImage={handlePreviewImage}
              setZoomDocument={setZoomDocument}
              handleUserMessageEdit={agentCompletion.handleUserMessageEdit}
              setActiveFile={setActiveFile}
              scrollToBottom={scrollToBottom}
              activeFileVersions={activeFileVersions}
              setActiveFileVersions={setActiveFileVersions}
              handleAssistantFeedback={agentCompletion.handleAssistantFeedback}
              handleAssistantRetry={agentCompletion.handleAssistantRetry}
              messagesEndRef={messagesEndRef}
              greeting={greeting}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              selectedVariant={selectedVariant}
              setSelectedVariant={setSelectedVariant}
              modelsList={modelsList}
              setMoreModelsModalOpen={setMoreModelsModalOpen}
              isStreaming={chatSessions.messages.length > 0 &&
                (chatSessions.messages[chatSessions.messages.length - 1].status === "thinking" ||
                 chatSessions.messages[chatSessions.messages.length - 1].status === "streaming")}
              handleStopGeneration={agentCompletion.handleStopGeneration}
              comments={comments}
              setComments={setComments}
              contextPercent={chatSessions.contextPercent}
              sessionArtifacts={sessionArtifacts}
              attachments={attachmentsManager.attachments}
              uploadingStates={attachmentsManager.uploadingStates}
              handleUploadAttachment={attachmentsManager.handleUploadAttachment}
              handleRemoveAttachment={attachmentsManager.handleRemoveAttachment}
              editingFile={editingFile}
              setEditingFile={setEditingFile}
              showScrollBottom={showScrollBottom}
              hasUnreadResponse={hasUnreadResponse}
              userHasScrolledUp={userHasScrolledUp}
              handleSendMessage={agentCompletion.handleSendMessage}
              setShowArtifactsPanel={setShowArtifactsPanel}
              setJumpToLine={setJumpToLine}
              onToggleSidebar={() => setSidebarExpanded((prev) => !prev)}
              buildMode={agentCompletion.buildMode}
              setBuildMode={agentCompletion.setBuildMode}
              activeTasks={agentCompletion.activeTasks}
              handleProceedPlan={agentCompletion.handleProceedPlan}
            />
          )}

          {(activeFile || showArtifactsPanel) && !isExpanded && (
            <div
              onPointerDown={handlePointerDown}
              className="w-1 cursor-col-resize h-full bg-zinc-800/80 hover:bg-blue-600/80 transition-colors z-30 select-none flex items-center justify-center relative group"
            >
              <div className="absolute w-[2px] h-8 rounded-full bg-zinc-700 group-hover:bg-blue-500 transition-colors" />
            </div>
          )}

          <RightPanel
            displayedActiveFile={displayedActiveFile}
            showArtifactsPanel={showArtifactsPanel}
            isExpanded={isExpanded}
            rightPanelWidth={rightPanelWidth}
            setActiveFile={setActiveFile}
            setShowArtifactsPanel={setShowArtifactsPanel}
            setIsExpanded={setIsExpanded}
            comments={comments}
            setComments={setComments}
            jumpToLine={jumpToLine}
            setJumpToLine={setJumpToLine}
            sessionArtifacts={sessionArtifacts}
            activeFileVersions={activeFileVersions}
            setActiveFileVersions={setActiveFileVersions}
            setEditingFile={setEditingFile}
          />
        </div>
      </main>

      <OverlayManager
        moreModelsModalOpen={moreModelsModalOpen}
        setMoreModelsModalOpen={setMoreModelsModalOpen}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        modelsList={modelsList}
        handleToggleFavourite={handleToggleFavourite}
        renameSessionId={renameSessionId}
        setRenameSessionId={setRenameSessionId}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        executeRenameSession={chatSessions.executeRenameSession}
        showSettingsModal={showSettingsModal}
        setShowSettingsModal={setShowSettingsModal}
        showProfileModal={showProfileModal}
        setShowProfileModal={setShowProfileModal}
        userName={userName}
        setUserName={setUserName}
        userAvatarUrl={userAvatarUrl}
        openCodeApiKey={openCodeApiKey}
        setOpenCodeApiKey={setOpenCodeApiKey}
        kiloApiKey={kiloApiKey}
        setKiloApiKey={setKiloApiKey}
        customProxyUrl={customProxyUrl}
        setCustomProxyUrl={setCustomProxyUrl}
        handleLogout={auth.handleLogout}
        loginEmail={auth.loginEmail}
        showSearchModal={showSearchModal}
        setShowSearchModal={setShowSearchModal}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sessionsList={chatSessions.sessionsList}
        searchSelectedIndex={searchSelectedIndex}
        setSearchSelectedIndex={setSearchSelectedIndex}
        handleSelectSession={handleSelectSession}
        zoomImage={zoomImage}
        setZoomImage={setZoomImage}
        zoomThumbnailRect={zoomThumbnailRect}
        setZoomThumbnailRect={setZoomThumbnailRect}
        zoomDocument={zoomDocument}
        setZoomDocument={setZoomDocument}
        showConnectModal={showConnectModal}
        setShowConnectModal={setShowConnectModal}
        connectedServers={connectedServers}
        setConnectedServers={setConnectedServers}
        connectingServer={connectingServer}
        setConnectingServer={setConnectingServer}
        getRelativeTime={getRelativeTime}
      />

      <style>{`
        .custom-chat-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-chat-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-chat-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 99px;
        }
        .custom-chat-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.16);
        }
      `}</style>
    </div>
  );
}
