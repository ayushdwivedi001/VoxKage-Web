"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  ChevronDown,
  Download,
  ChevronRight,
  Clock,
  Check,
  FileText,
  Code,
  Settings,
  Search,
  Globe,
  X,
  MessageSquare,
  ArrowUpRight,
  Square,
  Star,
  Edit3,
  Trash2,
  ArrowDown,
  Folder,
  FolderOpen
} from "lucide-react";
import GradientBackground from "@/components/GradientBackground";
import PromptInput from "@/components/PromptInput";
import Sidebar from "@/components/Sidebar";
import FileListItem from "@/components/FileListItem";
import FileInspectorPanel from "@/components/FileInspectorPanel";
import MoreModelsModal from "@/components/MoreModelsModal";
import UserBubble from "@/components/UserBubble";
import AssistantResponseBubble from "@/components/AssistantResponseBubble";
import ZoomImagePreview from "@/components/ZoomImagePreview";
import ZoomDocumentPreview from "@/components/ZoomDocumentPreview";
import { Attachment } from "@/components/MessageAttachmentsRow";
import { Message, computeSessionFiles } from "@/lib/chatHelpers";
import { getGreeting, extractNameFromEmail } from "@/lib/greetings";
import ConnectModal from "@/components/ConnectModal";
import ConnectingAppModal from "@/components/ConnectingAppModal";

import {
  login,
  fetchSessions,
  createSession,
  fetchSessionMessages,
  deleteSession,
  renameSession,
  toggleSessionStar,
  fetchFavorites,
  saveFavorites,
  fetchSettingsProfile,
  saveSettingsProfile,
  fetchModels,
  getToken,
  clearToken,
  WS_BACKEND_URL,
  BACKEND_URL,
  uploadSessionFile,
  deleteSessionFile,
  adoptDraftFiles,
  prepareSessionPayload,
  executeBackendTools,
  logAssistantResponse,
  editSessionMessage,
  logMessageFeedback
} from "@/lib/api";

const VoxKageIdleCreature = () => {
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
            {/* Merged Creature Path (arms + legs + body - eyes) to prevent subpixel seams */}
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M 2 6 h 12 v 3 h 2 v 2 h -2 v 1 h -2 v 2 h -2 v -2 h -4 v 2 h -2 v -2 h -2 v -1 h -2 v -2 h 2 v -3 z M 4 7 h 2 v 2 h -2 z M 10 7 h 2 v 2 h -2 z"
              fill="#faf9f5"
            />
            {/* Eyelids */}
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
            {/* Merged Creature Path (arms + legs + body - eyes) to prevent subpixel seams */}
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M 2 0 h 12 v 3 h 2 v 2 h -2 v 1 h -2 v 2 h -2 v -2 h -4 v 2 h -2 v -2 h -2 v -1 h -2 v -2 h 2 v -3 z M 4 1 h 2 v 2 h -2 z M 10 1 h 2 v 2 h -2 z"
              fill="currentColor"
            />
            {/* Eyelids */}
            <rect className="idle-eye-l-lid" x="4" y="1" width="2" height="2" fill="currentColor" opacity="0" />
            <rect className="idle-eye-r-lid" x="10" y="1" width="2" height="2" fill="currentColor" opacity="0" />
          </svg>
        </>
      )}
    </div>
  );
};

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: Record<string, TreeNode>;
  fileData?: any;
}

const getRelativeTime = (dateString: string) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return "Past week";
    if (diffDays < 30) return "Past month";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch (e) {
    return "";
  }
};

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("ayushdwivedi001@gmail.com");
  const [loginMasterKey, setLoginMasterKey] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectingServer, setConnectingServer] = useState<{ id: string; name: string } | null>(null);
  const [connectedServers, setConnectedServers] = useState<string[]>([]);

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isChatActive, setIsChatActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatTitle, setChatTitle] = useState("Greeting");
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Code inspection split pane states
  const [activeFile, setActiveFile] = useState<{ name: string; code: string } | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(480);
  const [isExpanded, setIsExpanded] = useState(false);

  // New comments and artifacts states
  const [comments, setComments] = useState<Array<{ id: string; fileName: string; line: number; text: string }>>([]);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [jumpToLine, setJumpToLine] = useState<number | null>(null);
  const [showArtifactsPanel, setShowArtifactsPanel] = useState(false);
  const [activeFileVersions, setActiveFileVersions] = useState<{ [name: string]: number }>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const buildFileTree = (files: any[]) => {
    const root: TreeNode = { name: "root", path: "", isFolder: true, children: {} };

    files.forEach((file) => {
      const parts = file.name.split("/");
      let current = root;
      let currentPath = "";

      parts.forEach((part: string, index: number) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLast = index === parts.length - 1;

        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            isFolder: !isLast,
            children: {},
            fileData: isLast ? file : undefined,
          };
        }
        current = current.children[part];
      });
    });

    return root;
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders[node.path] ?? true;
    const hasChildren = Object.keys(node.children).length > 0;

    if (node.isFolder) {
      return (
        <div key={node.path} className="flex flex-col w-full select-none">
          <div
            onClick={() => {
              setExpandedFolders(prev => ({ ...prev, [node.path]: !isExpanded }));
            }}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 cursor-pointer text-[13.5px] font-sans font-medium transition-all duration-150"
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            )}
            <FolderOpen className="w-4 h-4 text-amber-500/80 flex-shrink-0" />
            <span className="truncate">{node.name}</span>
          </div>

          {isExpanded && hasChildren && (
            <div className="flex flex-col w-full">
              {Object.values(node.children)
                .sort((a, b) => (b.isFolder ? 1 : 0) - (a.isFolder ? 1 : 0) || a.name.localeCompare(b.name))
                .map(child => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    } else {
      const file = node.fileData;
      if (!file) return null;
      
      const activeVer = activeFileVersions[file.name] || file.versions.length;
      const verObj = file.versions.find((v: any) => v.version === activeVer) || file.versions[file.versions.length - 1];

      return (
        <div
          key={node.path}
          onClick={() => {
            setActiveFile({ name: file.name, code: verObj.code });
            setShowArtifactsPanel(false);
          }}
          className="flex items-center justify-between group/file-node rounded-lg hover:bg-zinc-800/35 hover:text-white text-zinc-350 cursor-pointer text-[13.5px] font-sans font-normal py-1.5 px-2 transition-all duration-150"
          style={{ paddingLeft: `${depth * 14 + 18}px` }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-grow mr-2">
            <FileText className="w-4 h-4 text-blue-400/80 flex-shrink-0" />
            <span className="truncate">{node.name}</span>
            {file.versions && file.versions.length > 1 && (
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1 py-0.2 rounded font-sans scale-90">
                v{activeVer}
              </span>
            )}
          </div>
          
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const blob = new Blob([verObj.code], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = node.name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="opacity-0 group-hover/file-node:opacity-100 hover:text-blue-400 p-0.5 rounded transition-opacity duration-150 cursor-pointer flex-shrink-0"
            title="Download file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }
  };

  // Caching and UI helper states
  const [messagesCache, setMessagesCache] = useState<{ [sessionId: string]: Message[] }>({});
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showHeaderDropdown, setShowHeaderDropdown] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const [openCodeApiKey, setOpenCodeApiKey] = useState("");
  const [customProxyUrl, setCustomProxyUrl] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("disconnected");

  // User profile
  const [userName, setUserName] = useState("");

  // Dynamic greeting
  const [greeting, setGreeting] = useState("Ready to build, Ayush?");
  const hasVisitedRef = useRef(false);
  
  const telemetryWsRef = useRef<WebSocket | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // File Upload attachments states
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingStates, setUploadingStates] = useState<Record<string, "uploading" | "failed">>({});
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  
  // Image Zoom preview states
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomThumbnailRect, setZoomThumbnailRect] = useState<DOMRect | null>(null);

  // Document Zoom preview state
  const [zoomDocument, setZoomDocument] = useState<Attachment | null>(null);

  const handleUploadAttachment = async (file: File) => {
    // Determine target session or lazy draft session ID
    let targetSessionId = currentSessionId;
    if (!targetSessionId) {
      if (draftSessionId) {
        targetSessionId = draftSessionId;
      } else {
        targetSessionId = `draft-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
        setDraftSessionId(targetSessionId);
      }
    }

    const tempName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${file.name}`;
    setUploadingStates((prev) => ({ ...prev, [tempName]: "uploading" }));
    
    const placeholder: Attachment = {
      filename: tempName,
      original_name: file.name,
      url: "",
      type: file.type,
      size: file.size
    };
    setAttachments((prev) => [...prev, placeholder]);

    try {
      const res = await uploadSessionFile(targetSessionId, file);
      setAttachments((prev) => 
        prev.map((att) => att.filename === tempName ? {
          filename: res.filename,
          original_name: res.original_name,
          url: res.url,
          type: res.type,
          size: res.size,
          num_pages: res.num_pages
        } : att)
      );
      setUploadingStates((prev) => {
        const copy = { ...prev };
        delete copy[tempName];
        return copy;
      });
    } catch (err) {
      console.error("Attachment upload failed:", err);
      setUploadingStates((prev) => ({ ...prev, [tempName]: "failed" }));
      setTimeout(() => {
        setAttachments((prev) => prev.filter((att) => att.filename !== tempName));
        setUploadingStates((prev) => {
          const copy = { ...prev };
          delete copy[tempName];
          return copy;
        });
      }, 3000);
    }
  };

  const handleRemoveAttachment = async (filename: string) => {
    setAttachments((prev) => prev.filter((att) => att.filename !== filename));
    
    const targetSessionId = currentSessionId || draftSessionId;
    if (targetSessionId) {
      try {
        await deleteSessionFile(targetSessionId, filename);
      } catch (err) {
        console.warn("Failed to delete file from backend:", err);
      }
    }
  };

  const handlePreviewImage = (url: string, rect: DOMRect) => {
    setZoomThumbnailRect(rect);
    setZoomImage(url);
  };

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Model Selector global states
  const [selectedModel, setSelectedModel] = useState("DeepSeek V4 Flash");
  const [selectedVariant, setSelectedVariant] = useState("Max");
  const [moreModelsModalOpen, setMoreModelsModalOpen] = useState(false);
  const [modelsList, setModelsList] = useState<any[]>([]);
  const [contextPercent, setContextPercent] = useState(0);

  // Update context percent dynamically based on total message tokens
  useEffect(() => {
    if (messages.length === 0) {
      setContextPercent(0);
      return;
    }
    let totalChars = 30000; // Production-ready system prompt & tools schema baseline
    messages.forEach((msg) => {
      totalChars += (msg.role || "").length;
      totalChars += (msg.content || "").length;
    });
    const estimatedTokens = Math.ceil(totalChars / 4);
    const limit = 1000000; // 1M context window limit
    const pct = Math.min(Math.round((estimatedTokens / limit) * 100), 100);
    setContextPercent(pct);
  }, [messages]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  // Check auth on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      setIsLoggedIn(true);
      loadInitialData();
    }

    const handleUnauthorized = () => {
      setIsLoggedIn(false);
      clearToken();
    };

    window.addEventListener("voxkage_unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("voxkage_unauthorized", handleUnauthorized);
    };
  }, []);

  // Load settings on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOpenCodeApiKey(localStorage.getItem("voxkage_opencode_api_key") || "");
      const savedProxy = localStorage.getItem("voxkage_custom_proxy_url");
      if (savedProxy) {
        setCustomProxyUrl(savedProxy);
      }
      setUserName(localStorage.getItem("voxkage_user_name") || "");
    }
  }, []);

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
        if (data.type === "hud_log") {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            const last = copy[lastIdx];
            if (last && last.role === "assistant") {
              const steps = last.thinkingSteps || [];
              const exists = steps.some(s => s.label === data.content);
              if (!exists) {
                const stepId = `step-${steps.length + 1}`;
                copy[lastIdx] = {
                  ...last,
                  thinkingSteps: [...steps, { id: stepId, label: data.content, status: "pending" }]
                };
              }
            }
            return copy;
          });
        }
        else if (data.type === "tool_success") {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            const last = copy[lastIdx];
            if (last && last.role === "assistant" && last.thinkingSteps) {
              copy[lastIdx] = {
                ...last,
                thinkingSteps: last.thinkingSteps.map(s => {
                  if (s.status === "pending") {
                    return { ...s, status: "success" };
                  }
                  return s;
                })
              };
            }
            return copy;
          });
        }
        else if (data.type === "tool_failed") {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            const last = copy[lastIdx];
            if (last && last.role === "assistant" && last.thinkingSteps) {
              copy[lastIdx] = {
                ...last,
                thinkingSteps: last.thinkingSteps.map(s => {
                  if (s.status === "pending") {
                    return { ...s, status: "failed" };
                  }
                  return s;
                })
              };
            }
            return copy;
          });
        }
        else if (data.type === "rename") {
          setChatTitle(data.name);
          loadInitialData();
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

  // Sync current active session messages with cache
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      setMessagesCache((prev) => {
        if (prev[currentSessionId] === messages) return prev;
        return { ...prev, [currentSessionId]: messages };
      });
    }
  }, [messages, currentSessionId]);

  // Generate a dynamic greeting on mount and when email changes
  useEffect(() => {
    const storedName = localStorage.getItem("voxkage_user_name") || "";
    const name = storedName || (loginEmail ? extractNameFromEmail(loginEmail) : "");
    const now = new Date();
    setGreeting(getGreeting(name, now.getHours(), now.getDay(), false));
  }, [loginEmail, userName]);

  // Refresh greeting when returning after sending a message
  useEffect(() => {
    if (hasVisitedRef.current && !isChatActive) {
      const storedName = localStorage.getItem("voxkage_user_name") || "";
      const name = storedName || (loginEmail ? extractNameFromEmail(loginEmail) : "");
      const now = new Date();
      setGreeting(getGreeting(name, now.getHours(), now.getDay(), true));
    }
  }, [isChatActive, loginEmail, userName]);

  const loadInitialData = async () => {
    try {
      // Load sessions list
      const sess = await fetchSessions();
      setSessionsList(sess);

      // Load favorites
      const favs = await fetchFavorites();
      
      // Load available models
      const apiModels = await fetchModels();
      
      // Build modelsList
      const builtList = apiModels.map((m: string) => {
        let name = m;
        let desc = "OpenCode model";
        if (m === "deepseek-v4-flash-free") {
          name = "DeepSeek V4 Flash";
          desc = "Fastest performance with intelligence";
        } else if (m === "gemini-3.5-flash") {
          name = "Gemini 3.5 Flash";
          desc = "Fastest for quick answers";
        } else if (m === "claude-sonnet-4") {
          name = "Claude 4.6 Sonnet";
          desc = "Most efficient for everyday tasks";
        } else if (m === "mimo-v2.5-free") {
          name = "Mimo 2.5 Free";
          desc = "Multimodal vision understanding model";
        }
        
        return {
          name,
          desc,
          isFavourite: favs.includes(m) || m === "deepseek-v4-flash-free",
          api_key: m
        };
      });
      setModelsList(builtList);
    } catch (e) {
      console.error("Failed to load initial data", e);
    }
  };

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
    if (telemetryWsRef.current) {
      telemetryWsRef.current.close();
      telemetryWsRef.current = null;
    }
    clearToken();
    setIsLoggedIn(false);
    setMessages([]);
    setCurrentSessionId(null);
    setIsChatActive(false);
    setChatTitle("Greeting");
  };

  const loadSessionHistory = async (sessionId: string) => {
    initializeTelemetryWS(sessionId);
    const cached = messagesCache[sessionId];
    if (cached) {
      setMessages(cached);
      setIsChatActive(true);
      setCurrentSessionId(sessionId);
      const sess = sessionsList.find(s => s.id === sessionId);
      if (sess) {
        setChatTitle(sess.name);
      }
      setTimeout(scrollToBottom, 50);
    } else {
      setIsSessionLoading(true);
      setMessages([]);
      setIsChatActive(true);
      setCurrentSessionId(sessionId);
      const sess = sessionsList.find(s => s.id === sessionId);
      if (sess) {
        setChatTitle(sess.name);
      }
    }

    try {
      const { messages: history, contextPercent: loadedPercent } = await fetchSessionMessages(sessionId);
      const mapped = history.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        status: "completed" as const,
        thinkingSteps: []
      }));
      setMessagesCache(prev => ({ ...prev, [sessionId]: mapped }));
      setCurrentSessionId(prevId => {
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

  const cleanupDraft = async (draftId: string) => {
    try {
      await deleteSession(draftId);
    } catch (e) {
      console.warn("Failed to clean up draft uploads:", e);
    }
  };

  const handleSelectSession = (sessionId: string | null) => {
    if (draftSessionId) {
      cleanupDraft(draftSessionId);
      setDraftSessionId(null);
      setAttachments([]);
    }
    if (sessionId) {
      loadSessionHistory(sessionId);
    } else {
      handleCreateNewChat();
    }
  };

  const handleCreateNewChat = () => {
    if (telemetryWsRef.current) {
      telemetryWsRef.current.close();
      telemetryWsRef.current = null;
    }
    if (draftSessionId) {
      cleanupDraft(draftSessionId);
      setDraftSessionId(null);
      setAttachments([]);
    }
    setCurrentSessionId(null);
    setMessages([]);
    setIsChatActive(false);
    setChatTitle("Greeting");
    setContextPercent(0);
    setActiveFile(null);
    setComments([]);
    setJumpToLine(null);
    setShowArtifactsPanel(false);
    setActiveFileVersions({});
    setExpandedFolders({});
  };

  const handleConnectClick = (serverId: string) => {
    const nameMap: Record<string, string> = {
      gdrive: "Google Drive",
      slack: "Slack",
      gcal: "Google Calendar",
      resend: "Resend",
      tableau: "Tableau",
      magicschool: "MagicSchool AI",
      canva: "Canva",
      m365: "Microsoft 365",
      figma: "Figma",
      gmail: "Gmail",
      notion: "Notion",
    };
    setConnectingServer({ id: serverId, name: nameMap[serverId] || serverId });
  };

  const handleConnectionSuccess = () => {
    if (connectingServer) {
      setConnectedServers((prev) => [...prev, connectingServer.id]);
      setConnectingServer(null);
    }
  };

  const handleToggleStar = async (sessionId: string, starred: boolean) => {
    setSessionsList(prev => prev.map(s => s.id === sessionId ? { ...s, is_starred: starred } : s));
    try {
      await toggleSessionStar(sessionId, starred);
    } catch (e) {
      console.error("Failed to toggle star", e);
      setSessionsList(prev => prev.map(s => s.id === sessionId ? { ...s, is_starred: !starred } : s));
    }
  };

  const handleRenameSessionClick = (sessionId: string, currentName: string) => {
    setRenameSessionId(sessionId);
    setRenameValue(currentName);
  };

  const executeRenameSession = async () => {
    if (!renameSessionId || !renameValue.trim()) return;
    const targetId = renameSessionId;
    const newName = renameValue.trim();
    setSessionsList(prev => prev.map(s => s.id === targetId ? { ...s, name: newName } : s));
    if (currentSessionId === targetId) {
      setChatTitle(newName);
    }
    setRenameSessionId(null);
    try {
      await renameSession(targetId, newName);
    } catch (e) {
      console.error("Failed to rename session", e);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setSessionsList(prev => prev.filter(s => s.id !== sessionId));
    setMessagesCache(prev => {
      const copy = { ...prev };
      delete copy[sessionId];
      return copy;
    });
    if (currentSessionId === sessionId) {
      handleCreateNewChat();
    }
    try {
      await deleteSession(sessionId);
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  };

  const handleToggleFavourite = async (modelName: string) => {
    let apiName = modelName;
    if (modelName === "DeepSeek V4 Flash") apiName = "deepseek-v4-flash-free";
    else if (modelName === "Gemini 3.5 Flash") apiName = "gemini-3.5-flash";
    else if (modelName === "Claude 4.6 Sonnet") apiName = "claude-sonnet-4";
    else if (modelName === "Mimo 2.5 Free") apiName = "mimo-v2.5-free";

    const updated = modelsList.map((model) =>
      model.name === modelName
        ? { ...model, isFavourite: !model.isFavourite }
        : model
    );
    setModelsList(updated);

    const favs = updated.filter(m => m.isFavourite).map(m => m.api_key);
    try {
      await saveFavorites(favs);
    } catch (e) {
      console.error("Failed to save favorites to backend", e);
    }
  };

  const modelNameToKey = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes("deepseek")) return "deepseek-flash";
    if (lower.includes("gemini")) return "gemini-flash";
    if (lower.includes("claude") || lower.includes("sonnet")) return "claude-sonnet";
    if (lower.includes("mimo")) return "mimo-free";
    return "deepseek-flash";
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    setShowScrollBottom(distanceToBottom > 300);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;

      const mainEl = document.querySelector("main");
      if (!mainEl) return;

      const rect = mainEl.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const totalWidth = rect.width;
      const newRightWidth = totalWidth - relativeX;

      const minChatWidth = 380;
      const minCodeWidth = 300;

      if (relativeX >= minChatWidth && newRightWidth >= minCodeWidth) {
        setRightPanelWidth(newRightWidth);
      }
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const lastIdx = copy.length - 1;
      const last = copy[lastIdx];
      if (last && last.role === "assistant" && last.status !== "completed") {
        copy[lastIdx] = {
          ...last,
          status: "completed"
        };
      }
      return copy;
    });
  };

  const isStreaming = messages.length > 0 &&
    (messages[messages.length - 1].status === "thinking" ||
     messages[messages.length - 1].status === "streaming");

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    hasVisitedRef.current = true;

    let sessionId = currentSessionId;
    let finalAttachments = [...attachments];
    
    // Check if new transient session
    if (!sessionId) {
      try {
        const words = text.trim().split(" ");
        const defaultName = words.slice(0, 4).join(" ") + (words.length > 4 ? "..." : "");
        const newSess = await createSession(defaultName);
        sessionId = newSess.id;
        setCurrentSessionId(sessionId);
        setChatTitle(defaultName);
        setSessionsList(prev => [newSess, ...prev]);

        // Adopt draft files if they were uploaded
        const activeDraftId = draftSessionId;
        if (activeDraftId) {
          try {
            await adoptDraftFiles(newSess.id, activeDraftId);
            finalAttachments = finalAttachments.map(att => ({
              ...att,
              url: att.url.replace(activeDraftId, newSess.id)
            }));
            setDraftSessionId(null);
          } catch (adoptErr) {
            console.error("Failed to adopt draft files:", adoptErr);
          }
        }
      } catch (e) {
        console.error("Failed to create session on message send", e);
        return;
      }
    }

    let userMsgContent = text;
    if (finalAttachments.length > 0) {
      const xmlParts = ["<attachments>"];
      finalAttachments.forEach((att) => {
        const fn = att.filename.replace(/"/g, "&quot;");
        const on = att.original_name.replace(/"/g, "&quot;");
        const url = att.url.replace(/"/g, "&quot;");
        const tp = att.type.replace(/"/g, "&quot;");
        const sz = String(att.size);
        const pg = att.num_pages ? String(att.num_pages) : "";
        xmlParts.push(`  <attachment filename="${fn}" original_name="${on}" url="${url}" type="${tp}" size="${sz}" num_pages="${pg}" />`);
      });
      xmlParts.push("</attachments>");
      userMsgContent = `${text}\n\n${xmlParts.join("\n")}`;
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMsgContent,
    };

    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      status: "thinking",
      thinkingDuration: 0,
      thinkingStart: Date.now(),
      thinkingSteps: []
    };

    setAttachments([]);
    setComments([]);
    setEditingFile(null);

    setIsChatActive(true);
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    let promptText = text;
    if (editingFile) {
      const currentFiles = computeSessionFiles(messages);
      const matchingFile = currentFiles.find(f => f.name === editingFile);
      if (matchingFile && matchingFile.versions.length > 0) {
        const fileCode = matchingFile.versions[matchingFile.versions.length - 1].code;
        promptText = `[Editing File: ${editingFile}]\nFile Content:\n\`\`\`\n${fileCode}\n\`\`\`\n\nUser Question:\n${text}`;
      }
    }
    if (comments.length > 0) {
      const sessionFiles = computeSessionFiles(messages);
      const commentCtx = comments.map(c => {
        const matchingFile = sessionFiles.find(f => f.name === c.fileName);
        let snippet = "";
        if (matchingFile && matchingFile.versions.length > 0) {
          const code = matchingFile.versions[matchingFile.versions.length - 1].code;
          const lines = code.split("\n");
          const start = Math.max(0, c.line - 11);
          const end = Math.min(lines.length, c.line + 10);
          const snippetLines = lines.slice(start, end).map((l, idx) => `${start + idx + 1}: ${l}`);
          snippet = `\n[Code Snippet around line ${c.line} of ${c.fileName}]:\n\`\`\`\n${snippetLines.join("\n")}\n\`\`\``;
        }
        return `[User Comment on ${c.fileName} at line ${c.line}]: "${c.text}"${snippet}`;
      }).join("\n\n");
      promptText = `${text}\n\n---\nCode Comments Context:\n${commentCtx}`;
    }

    const runClientAgentLoop = async () => {
      let finalAssistantContent = "";
      let activeAssistantMsgId = assistantMsg.id;

      try {
        // 1. Call Backend /prepare
        const prepRes = await prepareSessionPayload(
          sessionId!,
          promptText,
          finalAttachments,
          modelNameToKey(selectedModel),
          selectedVariant
        );
        
        let messagesPayload = prepRes.messages; // system + history + user query
        const modelId = prepRes.model; // e.g. "deepseek-v4-flash-free"
        const tools = prepRes.tools; // schemas
        const variantOverrides = prepRes.variant_overrides; // temperature, max_tokens, etc.

        // Get API Key and Proxy URL
        const openCodeKey = localStorage.getItem("voxkage_opencode_api_key") || "";
        const customProxyUrl = localStorage.getItem("voxkage_custom_proxy_url") || "";

        if (!openCodeKey) {
          throw new Error("OpenCode API Key is missing. Please set it in Settings.");
        }

        // Standard header for API
        let targetUrl = "/api/completions/proxy";
        if (customProxyUrl && customProxyUrl.trim() !== "" && !customProxyUrl.includes("voxkage-proxy.ayushdwivedi001.workers.dev")) {
          targetUrl = `${customProxyUrl.trim()}/zen/v1/chat/completions`;
        }
        
        let loopCount = 0;
        const maxLoop = 12;
        
        // Setup abort controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        while (loopCount < maxLoop) {
          loopCount++;
          
          // Construct the body
          const body: any = {
            model: modelId,
            messages: messagesPayload,
            stream: true,
            ...variantOverrides
          };
          
          const isAgentic = (selectedVariant || "High").toUpperCase() in { "HIGH": 1, "XHIGH": 1, "MAX": 1 };
          if (isAgentic && tools && tools.length > 0) {
            body.tools = tools;
            body.tool_choice = "auto";
          }

          // Trigger stream request
          const res = await fetch(targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openCodeKey}`
            },
            body: JSON.stringify(body),
            signal: controller.signal
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenCode API Error (HTTP ${res.status}): ${errText}`);
          }

          const reader = res.body?.getReader();
          if (!reader) {
            throw new Error("Failed to get response stream reader.");
          }

          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          let currentToolCalls: any[] = [];
          let currentContent = "";

          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
            if (idx !== -1) {
              copy[idx].status = "streaming";
            }
            return copy;
          });

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const cleanLine = line.trim();
              if (!cleanLine) continue;
              if (cleanLine === "data: [DONE]") break;
              
              if (cleanLine.startsWith("data:")) {
                const sseData = cleanLine.substring(5).trim();
                if (!sseData) continue;
                
                if (sseData.startsWith("Error")) {
                  throw new Error(sseData);
                }
                
                try {
                  const parsed = JSON.parse(sseData);
                  const delta = parsed.choices?.[0]?.delta;
                  if (!delta) continue;

                  if (delta.content) {
                    currentContent += delta.content;
                    finalAssistantContent += delta.content;
                    
                    // Update UI in real-time
                    setMessages((prev) => {
                      if (prev.length === 0) return prev;
                      const copy = [...prev];
                      const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
                      if (idx !== -1) {
                        copy[idx].content = finalAssistantContent;
                      }
                      return copy;
                    });
                  }

                  if (delta.tool_calls) {
                    delta.tool_calls.forEach((tc: any) => {
                      const tcIdx = tc.index ?? 0;
                      while (currentToolCalls.length <= tcIdx) {
                        currentToolCalls.push({ id: "", type: "function", function: { name: "", arguments: "" } });
                      }
                      if (tc.id) currentToolCalls[tcIdx].id = tc.id;
                      if (tc.function?.name) currentToolCalls[tcIdx].function.name = tc.function.name;
                      if (tc.function?.arguments) currentToolCalls[tcIdx].function.arguments += tc.function.arguments;
                    });
                  }
                } catch (jsonErr) {
                  // Ignore JSON parse errors for non-JSON SSE lines
                }
              }
            }
          }

          // If there are tool calls, we execute them
          if (currentToolCalls.length > 0) {
            // Update UI with pending tool steps
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
              if (idx !== -1) {
                const steps = copy[idx].thinkingSteps || [];
                const newSteps = [...steps];
                currentToolCalls.forEach((tc) => {
                  const label = tc.function.name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                  newSteps.push({ id: tc.id, label: `Executing tool: ${label}`, status: "pending" });
                });
                copy[idx].thinkingSteps = newSteps;
                copy[idx].status = "thinking";
              }
              return copy;
            });

            // Call backend /execute-tools
            const toolExecRes = await executeBackendTools(sessionId!, currentToolCalls);
            
            // Append assistant message with tool calls to prompt history
            messagesPayload.push({
              role: "assistant",
              content: currentContent || null,
              tool_calls: currentToolCalls
            });

            // Append all tool outputs to prompt history
            toolExecRes.results.forEach((r: any) => {
              messagesPayload.push(r);
            });

            // Update UI tool steps to success/failed
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
              if (idx !== -1) {
                const steps = copy[idx].thinkingSteps || [];
                copy[idx].thinkingSteps = steps.map(s => {
                  const match = toolExecRes.results.find((r: any) => r.tool_call_id === s.id);
                  if (match) {
                    const isError = match.content.startsWith("Error");
                    return { ...s, status: isError ? "failed" : "success" };
                  }
                  return s;
                });
              }
              return copy;
            });

            // If we generated any specialty UI tags (maps, charts, etc) during tool execution, we append them
            const tags = toolExecRes.tags;
            if (tags.map_tag) finalAssistantContent += `\n\n${tags.map_tag}`;
            if (tags.weather_tag) finalAssistantContent += `\n\n${tags.weather_tag}`;
            if (tags.chart_tag) finalAssistantContent += `\n\n${tags.chart_tag}`;
            if (tags.flow_tag) finalAssistantContent += `\n\n${tags.flow_tag}`;
            if (tags.chemistry_tag) finalAssistantContent += `\n\n${tags.chemistry_tag}`;
            if (tags.timeline_tag) finalAssistantContent += `\n\n${tags.timeline_tag}`;
            if (tags.calculator_tag) finalAssistantContent += `\n\n${tags.calculator_tag}`;

            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
              if (idx !== -1) {
                copy[idx].content = finalAssistantContent;
              }
              return copy;
            });

          } else {
            // No tool calls, generation is completed
            break;
          }
        }

        // 4. Log the finalized assistant message to the database
        await logAssistantResponse(sessionId!, finalAssistantContent);

        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const copy = [...prev];
          const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
          if (idx !== -1) {
            copy[idx].status = "completed";
            const elapsed = (Date.now() - (copy[idx].thinkingStart || Date.now())) / 1000;
            copy[idx].thinkingDuration = Math.max(elapsed, 0.1);
          }
          return copy;
        });

      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Completions generation aborted by user.");
          return;
        }
        console.error("Client agent loop failed:", err);
        const errMsg = err.message || String(err);
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const copy = [...prev];
          const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
          if (idx !== -1) {
            copy[idx].content = `[System Error: ${errMsg}]`;
            copy[idx].status = "completed";
            const elapsed = (Date.now() - (copy[idx].thinkingStart || Date.now())) / 1000;
            copy[idx].thinkingDuration = Math.max(elapsed, 0.1);
          }
          return copy;
        });
      } finally {
        abortControllerRef.current = null;
      }
    };

    runClientAgentLoop();
  };

  const resubmitUserMessage = async (userMsgId: string, updatedContent?: string) => {
    const idx = messages.findIndex((m) => m.id === userMsgId);
    if (idx === -1) return;

    const originalUserMsg = messages[idx];
    const newText = updatedContent !== undefined ? updatedContent : originalUserMsg.content;

    try {
      // 1. Call backend edit endpoint to update the DB content and truncate all messages after userMsgId
      let finalContent = newText;
      const attachmentsXmlStart = originalUserMsg.content.indexOf("\n\n<attachments>");
      if (attachmentsXmlStart !== -1) {
        finalContent = `${newText}${originalUserMsg.content.substring(attachmentsXmlStart)}`;
      }

      await editSessionMessage(currentSessionId!, userMsgId, finalContent);

      // 2. Update local state: truncate all messages from idx + 1 onwards
      const truncatedMessages = messages.slice(0, idx + 1);
      
      // Update the content of the user message in local state
      truncatedMessages[idx] = {
        ...originalUserMsg,
        content: finalContent
      };

      // 3. Append a new assistant message at the end
      const newAssistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        status: "thinking",
        thinkingDuration: 0,
        thinkingStart: Date.now(),
        thinkingSteps: []
      };

      setMessages([...truncatedMessages, newAssistantMsg]);

      // 4. Run client agent loop
      const runClientAgentLoop = async () => {
        let finalAssistantContent = "";
        let activeAssistantMsgId = newAssistantMsg.id;

        try {
          // Parse attachments if any
          const finalAttachments: any[] = [];
          if (attachmentsXmlStart !== -1) {
            const xmlBlock = originalUserMsg.content.substring(attachmentsXmlStart);
            const attachmentsRegex = /<attachment filename="([^"]+)" original_name="([^"]+)" url="([^"]+)" type="([^"]+)" size="([^"]+)"(?: num_pages="([^"]+)")? \/>/g;
            let match;
            while ((match = attachmentsRegex.exec(xmlBlock)) !== null) {
              finalAttachments.push({
                filename: match[1],
                original_name: match[2],
                url: match[3],
                type: match[4],
                size: parseInt(match[5], 10),
                num_pages: match[6] ? parseInt(match[6], 10) : undefined
              });
            }
          }

          const prepRes = await prepareSessionPayload(
            currentSessionId!,
            newText,
            finalAttachments,
            modelNameToKey(selectedModel),
            selectedVariant
          );
          
          let messagesPayload = prepRes.messages;
          const modelId = prepRes.model;
          const tools = prepRes.tools;
          const variantOverrides = prepRes.variant_overrides;

          const openCodeKey = localStorage.getItem("voxkage_opencode_api_key") || "";
          const customProxyUrl = localStorage.getItem("voxkage_custom_proxy_url") || "";

          if (!openCodeKey) {
            throw new Error("OpenCode API Key is missing. Please set it in Settings.");
          }

          let targetUrl = "/api/completions/proxy";
          if (customProxyUrl && customProxyUrl.trim() !== "" && !customProxyUrl.includes("voxkage-proxy.ayushdwivedi001.workers.dev")) {
            targetUrl = `${customProxyUrl.trim()}/zen/v1/chat/completions`;
          }
          
          let loopCount = 0;
          const maxLoop = 12;
          const controller = new AbortController();
          abortControllerRef.current = controller;

          while (loopCount < maxLoop) {
            loopCount++;
            
            const body: any = {
              model: modelId,
              messages: messagesPayload,
              stream: true,
              ...variantOverrides
            };
            
            const isAgentic = (selectedVariant || "High").toUpperCase() in { "HIGH": 1, "XHIGH": 1, "MAX": 1 };
            if (isAgentic && tools && tools.length > 0) {
              body.tools = tools;
              body.tool_choice = "auto";
            }

            const res = await fetch(targetUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openCodeKey}`
              },
              body: JSON.stringify(body),
              signal: controller.signal
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`OpenCode API Error (HTTP ${res.status}): ${errText}`);
            }

            const reader = res.body?.getReader();
            if (!reader) {
              throw new Error("Failed to get response stream reader.");
            }

            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let currentToolCalls: any[] = [];
            let currentContent = "";

            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
              if (idx !== -1) {
                copy[idx].status = "streaming";
              }
              return copy;
            });

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const cleanLine = line.trim();
                if (!cleanLine) continue;
                if (cleanLine === "data: [DONE]") break;
                
                if (cleanLine.startsWith("data:")) {
                  const sseData = cleanLine.substring(5).trim();
                  if (!sseData) continue;
                  
                  if (sseData.startsWith("Error")) {
                    throw new Error(sseData);
                  }
                  
                  try {
                    const parsed = JSON.parse(sseData);
                    const delta = parsed.choices?.[0]?.delta;
                    if (!delta) continue;

                    if (delta.content) {
                      currentContent += delta.content;
                      finalAssistantContent += delta.content;
                      
                      setMessages((prev) => {
                        if (prev.length === 0) return prev;
                        const copy = [...prev];
                        const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
                        if (idx !== -1) {
                          copy[idx].content = finalAssistantContent;
                        }
                        return copy;
                      });
                    }

                    if (delta.tool_calls) {
                      delta.tool_calls.forEach((tc: any) => {
                        const tcIdx = tc.index ?? 0;
                        while (currentToolCalls.length <= tcIdx) {
                          currentToolCalls.push({ id: "", type: "function", function: { name: "", arguments: "" } });
                        }
                        if (tc.id) currentToolCalls[tcIdx].id = tc.id;
                        if (tc.function?.name) currentToolCalls[tcIdx].function.name = tc.function.name;
                        if (tc.function?.arguments) currentToolCalls[tcIdx].function.arguments += tc.function.arguments;
                      });
                    }
                  } catch (jsonErr) {}
                }
              }
            }

            if (currentToolCalls.length > 0) {
              setMessages((prev) => {
                if (prev.length === 0) return prev;
                const copy = [...prev];
                const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
                if (idx !== -1) {
                  const steps = copy[idx].thinkingSteps || [];
                  const newSteps = [...steps];
                  currentToolCalls.forEach((tc) => {
                    let label = tc.function.name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                    try {
                      const args = JSON.parse(tc.function.arguments);
                      if (tc.function.name === "web_search" || tc.function.name === "web_search_deep") {
                        label = args.query || label;
                      } else if (tc.function.name === "web_search_parallel") {
                        label = args.queries && args.queries.length > 0 ? args.queries.join(", ") : label;
                      } else if (tc.function.name === "web_fetch" && args.url) {
                        label = `Fetch: ${args.url}`;
                      } else if (tc.function.name === "web_fetch_parallel" && args.urls) {
                        label = `Fetching ${args.urls.length} resources`;
                      }
                    } catch (e) {}
                    newSteps.push({ id: tc.id, label, status: "pending" });
                  });
                  copy[idx].thinkingSteps = newSteps;
                  copy[idx].status = "thinking";
                }
                return copy;
              });

              const toolExecRes = await executeBackendTools(currentSessionId!, currentToolCalls);
              
              messagesPayload.push({
                role: "assistant",
                content: currentContent || null,
                tool_calls: currentToolCalls
              });

              toolExecRes.results.forEach((r: any) => {
                messagesPayload.push(r);
              });

              setMessages((prev) => {
                if (prev.length === 0) return prev;
                const copy = [...prev];
                const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
                if (idx !== -1) {
                  const steps = copy[idx].thinkingSteps || [];
                  copy[idx].thinkingSteps = steps.map(s => {
                    const match = toolExecRes.results.find((r: any) => r.tool_call_id === s.id);
                    if (match) {
                      const isError = match.content.startsWith("Error");
                      let parsedResults = null;
                      try {
                        if (!isError) {
                          parsedResults = JSON.parse(match.content);
                        }
                      } catch (e) {}
                      return { 
                        ...s, 
                        status: isError ? "failed" : "success",
                        resultContent: parsedResults
                      };
                    }
                    return s;
                  });
                }
                return copy;
              });

              const tags = toolExecRes.tags;
              if (tags.map_tag) finalAssistantContent += `\n\n${tags.map_tag}`;
              if (tags.weather_tag) finalAssistantContent += `\n\n${tags.weather_tag}`;
              if (tags.chart_tag) finalAssistantContent += `\n\n${tags.chart_tag}`;
              if (tags.flow_tag) finalAssistantContent += `\n\n${tags.flow_tag}`;
              if (tags.chemistry_tag) finalAssistantContent += `\n\n${tags.chemistry_tag}`;
              if (tags.timeline_tag) finalAssistantContent += `\n\n${tags.timeline_tag}`;
              if (tags.calculator_tag) finalAssistantContent += `\n\n${tags.calculator_tag}`;
              
              if (tags.sources_tag) {
                // Strip previous <Sources /> tags to prevent duplicates
                finalAssistantContent = finalAssistantContent.replace(/<Sources[\s\S]*?\/>/gi, "").trim();
                finalAssistantContent += `\n\n${tags.sources_tag}`;
              }

              setMessages((prev) => {
                if (prev.length === 0) return prev;
                const copy = [...prev];
                const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
                if (idx !== -1) {
                  copy[idx].content = finalAssistantContent;
                }
                return copy;
              });

            } else {
              break;
            }
          }

          await logAssistantResponse(currentSessionId!, finalAssistantContent);

          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
            if (idx !== -1) {
              copy[idx].status = "completed";
              const elapsed = (Date.now() - (copy[idx].thinkingStart || Date.now())) / 1000;
              copy[idx].thinkingDuration = Math.max(elapsed, 0.1);
            }
            return copy;
          });

        } catch (err: any) {
          if (err.name === "AbortError") return;
          console.error("Client agent loop failed:", err);
          const errMsg = err.message || String(err);
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const idx = copy.findIndex(m => m.id === activeAssistantMsgId);
            if (idx !== -1) {
              copy[idx].content = `[System Error: ${errMsg}]`;
              copy[idx].status = "completed";
              const elapsed = (Date.now() - (copy[idx].thinkingStart || Date.now())) / 1000;
              copy[idx].thinkingDuration = Math.max(elapsed, 0.1);
            }
            return copy;
          });
        } finally {
          abortControllerRef.current = null;
        }
      };

      runClientAgentLoop();

    } catch (e) {
      console.error("Failed to edit or retry session:", e);
    }
  };

  const handleUserMessageEdit = async (messageId: string, newText: string) => {
    await resubmitUserMessage(messageId, newText);
  };

  const handleAssistantRetry = async (assistantMsgId: string) => {
    const idx = messages.findIndex((m) => m.id === assistantMsgId);
    if (idx === -1) return;
    const precedingUserMsg = messages[idx - 1];
    if (!precedingUserMsg || precedingUserMsg.role !== "user") return;

    // Immediately show thinking state on the existing assistant bubble
    setMessages((prev) => {
      const copy = [...prev];
      const aIdx = copy.findIndex((m) => m.id === assistantMsgId);
      if (aIdx !== -1) {
        copy[aIdx] = {
          ...copy[aIdx],
          content: "",
          status: "thinking",
          thinkingDuration: 0,
          thinkingStart: Date.now(),
          thinkingSteps: []
        };
      }
      return copy;
    });

    await resubmitUserMessage(precedingUserMsg.id);
  };

  const handleAssistantFeedback = async (messageId: string, feedbackType: "thumbs_up" | "thumbs_down", comments?: string) => {
    try {
      await logMessageFeedback(currentSessionId!, messageId, feedbackType, comments);
    } catch (e) {
      console.error("Failed to log message feedback:", e);
    }
  };

  const json_stringify_safe = (val: any) => {
    try {
      return JSON.stringify(val);
    } catch {
      return "";
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-[#05050a] px-4 select-none">
        <GradientBackground isChatActive={false} />
        
        <div className="w-full max-w-md bg-[#0e0e11] border border-zinc-800/80 rounded-2xl p-8 z-10 shadow-2xl relative">
          <div className="flex flex-col items-center mb-8">
            <h1 className="text-white text-3xl font-light tracking-[0.03em] font-sans mb-2" style={{ fontFamily: "Copernicus, Tiempos, Georgia, serif" }}>
              VoxKage
            </h1>
            <p className="text-zinc-500 text-[13px] font-sans text-center">
              Enter your developer master credentials to authorize access.
            </p>
          </div>
          
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
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

  const sessionArtifacts = computeSessionFiles(messages);

  let displayedActiveFile = activeFile;
  if (activeFile) {
    const fileData = sessionArtifacts.find(f => f.name === activeFile.name);
    if (fileData) {
      const selectedVerNum = activeFileVersions[activeFile.name] || fileData.versions.length;
      const verObj = fileData.versions.find(v => v.version === selectedVerNum) || fileData.versions[fileData.versions.length - 1];
      if (verObj) {
        displayedActiveFile = {
          name: activeFile.name,
          code: verObj.code,
        };
      }
    }
  }

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#05050a]">
      {/* Animated mesh gradient background (prop driven to slide down) */}
      <GradientBackground isChatActive={isChatActive} />

      <Sidebar 
        isExpanded={sidebarExpanded} 
        setIsExpanded={setSidebarExpanded}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        sessionsList={sessionsList}
        onCreateNewChat={handleCreateNewChat}
        onLogout={handleLogout}
        onToggleStar={handleToggleStar}
        onRenameSession={handleRenameSessionClick}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={() => {
          setOpenCodeApiKey(localStorage.getItem("voxkage_opencode_api_key") || "");
          const savedProxy = localStorage.getItem("voxkage_custom_proxy_url");
          if (savedProxy) {
            setCustomProxyUrl(savedProxy);
          }
          setUserName(localStorage.getItem("voxkage_user_name") || "");
          setShowSettingsModal(true);
        }}
        connectionStatus={connectionStatus}
        onOpenSearch={() => {
          setShowSearchModal(true);
          setSearchSelectedIndex(0);
          setSearchQuery("");
        }}
        onOpenConnect={() => setShowConnectModal(true)}
      />

      {/* Main content workspace container */}
      <main
        className="relative flex flex-col flex-grow items-center justify-between overflow-hidden bg-transparent transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10"
        style={{
          height: "100vh",
        }}
      >
        {/* Active Chat Bottom Background Glow (no noise, smooth linear gradient, spans bottom 28% of page) */}
        {isChatActive && (
          <div className="absolute bottom-0 left-0 right-0 h-[28%] z-0 pointer-events-none bg-gradient-to-t from-[#041285]/24 via-[#041285]/06 to-transparent" />
        )}
        {/* === ACTIVE CHAT HEADER (Only visible when chat is active) === */}
        <div
          className={`absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-25 border-b border-transparent transition-all duration-500 select-none ${
            isChatActive
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-4 pointer-events-none"
          } ${isExpanded ? "hidden" : "flex"}`}
          style={{
            right: (activeFile || showArtifactsPanel) ? `${rightPanelWidth}px` : 0,
          }}
        >
          {/* Chat dropdown title */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHeaderDropdown(prev => !prev)}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-white/5 text-zinc-300 hover:text-zinc-100 transition-all duration-200 text-[14.5px] font-medium cursor-pointer"
            >
              <span>{chatTitle}</span>
              <ChevronDown className="w-4 h-4 opacity-75" />
            </button>

            {showHeaderDropdown && (() => {
              const currentSess = sessionsList.find(s => s.id === currentSessionId);
              const isStarred = currentSess?.is_starred || false;
              return (
                <>
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => setShowHeaderDropdown(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-[160px] bg-[#121215] border border-zinc-800 rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-0.5 animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentSessionId) {
                          handleToggleStar(currentSessionId, !isStarred);
                        }
                        setShowHeaderDropdown(false);
                      }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                    >
                      <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-white text-white" : "text-zinc-400"}`} />
                      <span>{isStarred ? "Remove Star" : "Star"}</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderDropdown(false);
                        if (currentSessionId && currentSess) {
                          handleRenameSessionClick(currentSessionId, currentSess.name);
                        }
                      }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors text-left cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Rename</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderDropdown(false);
                        if (currentSessionId) {
                          handleDeleteSession(currentSessionId);
                        }
                      }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-colors text-left cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Delete</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Share & Artifacts Button Container */}
          {!activeFile && !showArtifactsPanel && (
            <div className="flex items-center gap-2">
              {sessionArtifacts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArtifactsPanel(true)}
                  className="flex items-center justify-center w-8 h-8 rounded-xl border border-zinc-800 bg-[#181715] hover:bg-[#252320] text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
                  aria-label="View artifacts"
                >
                  <FileText className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-[#121215]/80 hover:bg-zinc-800/80 text-zinc-300 hover:text-white text-[13.5px] font-medium transition-all duration-200"
              >
                Share
              </button>
            </div>
          )}
        </div>

        {/* === SPLIT SCREEN VIEW WORKSPACE === */}
        <div className="relative flex flex-grow w-full h-full overflow-hidden">
          
          {/* Left Column: Chat Area */}
          <div
            style={{
              width: (activeFile || showArtifactsPanel) && isExpanded ? "0px" : (activeFile || showArtifactsPanel) ? `calc(100% - ${rightPanelWidth}px)` : "100%",
              display: (activeFile || showArtifactsPanel) && isExpanded ? "none" : "flex",
            }}
            className="flex flex-col h-full relative transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
          >
            {/* Scrollable Chat Area */}
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className={`w-full h-full overflow-y-auto custom-chat-scrollbar flex flex-col items-center transition-all duration-500 ease-out ${
                isChatActive ? "opacity-100 block" : "opacity-0 hidden"
              }`}
            >
              <div className="w-full max-w-3xl flex flex-col gap-8 pt-24 pb-[180px] px-4 md:px-6">
                {isSessionLoading ? (
                  <div className="flex flex-col gap-8 w-full animate-pulse select-none">
                    <div className="flex gap-4 items-start w-full">
                      <div className="w-8 h-8 rounded-full bg-zinc-800/40 flex-shrink-0" />
                      <div className="flex flex-col gap-3.5 flex-grow">
                        <div className="h-4 bg-zinc-800/40 rounded-lg w-1/4" />
                        <div className="h-3.5 bg-zinc-800/40 rounded-lg w-3/4" />
                        <div className="h-3.5 bg-zinc-800/40 rounded-lg w-1/2" />
                        <div className="h-3.5 bg-zinc-800/40 rounded-lg w-5/6" />
                      </div>
                    </div>
                    <div className="flex gap-4 items-start justify-end w-full mt-4">
                      <div className="flex flex-col gap-3.5 items-end flex-grow max-w-[70%]">
                        <div className="h-3.5 bg-zinc-800/40 rounded-lg w-3/4" />
                        <div className="h-3.5 bg-zinc-800/40 rounded-lg w-1/2" />
                      </div>
                      <div className="w-8 h-8 rounded-full bg-zinc-800/40 flex-shrink-0" />
                    </div>
                    <div className="flex gap-4 items-start w-full mt-4">
                      <div className="w-8 h-8 rounded-full bg-zinc-800/40 flex-shrink-0" />
                      <div className="flex flex-col gap-3.5 flex-grow">
                        <div className="h-4 bg-zinc-800/40 rounded-lg w-1/5" />
                        <div className="h-3.5 bg-zinc-800/40 rounded-lg w-2/3" />
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="w-full">
                      {msg.role === "user" ? (
                        /* User Bubble (aligned right) */
                        <div className="flex flex-col items-end w-full">
                          <UserBubble 
                            messageId={msg.id}
                            content={msg.content} 
                            onImageClick={handlePreviewImage} 
                            onDocumentClick={setZoomDocument}
                            onEditSave={handleUserMessageEdit}
                          />
                        </div>
                      ) : (
                        /* Assistant Response (aligned left) */
                        <AssistantResponseBubble
                          msg={msg}
                          setActiveFile={setActiveFile}
                          onScrollToBottom={scrollToBottom}
                          messages={messages}
                          activeFileVersions={activeFileVersions}
                          setActiveFileVersions={setActiveFileVersions}
                          onFeedback={handleAssistantFeedback}
                          onRetry={handleAssistantRetry}
                        />
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>


            {!isChatActive && (
              <div className="flex-grow flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-4 pb-32 z-20">
                <VoxKageIdleCreature />
                <h1
                  className="text-white text-2xl sm:text-[34px] md:text-[38px] font-normal tracking-[-0.015em] select-none leading-tight mb-7 text-center font-serif"
                >
                  {greeting}
                </h1>
                <PromptInput
                  onSubmit={handleSendMessage}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  selectedVariant={selectedVariant}
                  setSelectedVariant={setSelectedVariant}
                  modelsList={modelsList}
                  onOpenMoreModels={() => setMoreModelsModalOpen(true)}
                  isStreaming={isStreaming}
                  onStop={handleStopGeneration}
                  comments={comments}
                  contextPercent={contextPercent}
                  onRemoveComment={(id) => setComments(prev => prev.filter(c => c.id !== id))}
                  onClickComment={(fileName, line) => {
                    const matchingFile = sessionArtifacts.find(f => f.name === fileName);
                    if (matchingFile) {
                      setActiveFile({ name: fileName, code: matchingFile.versions[matchingFile.versions.length - 1].code });
                      setJumpToLine(line);
                      setShowArtifactsPanel(false);
                    }
                  }}
                  attachments={attachments}
                  uploadingStates={uploadingStates}
                  onUpload={handleUploadAttachment}
                  onRemoveAttachment={handleRemoveAttachment}
                  onPreviewImage={handlePreviewImage}
                  onPreviewDocument={setZoomDocument}
                  editingFile={editingFile}
                  onRemoveEditingFile={() => setEditingFile(null)}
                />
              </div>
            )}

            {/* Pinned Bottom Input Panel (Only visible when active, sticky at the bottom) */}
            {isChatActive && (
              <div className="absolute bottom-0 left-0 right-0 z-30 pb-5 pt-10 px-4 flex flex-col items-center gap-2.5">
                {/* Content layers */}
                <div className="relative z-10 w-full flex flex-col items-center gap-2.5">
                  {showScrollBottom && (
                    <button
                      type="button"
                      onClick={scrollToBottom}
                      className="flex items-center justify-center w-8 h-8 rounded-full border border-zinc-800 bg-[#16161a] hover:bg-[#202025] text-zinc-400 hover:text-zinc-200 shadow-lg transition-all duration-200 cursor-pointer animate-fadeIn mb-1"
                      aria-label="Scroll to bottom"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  )}
                  <PromptInput
                    onSubmit={handleSendMessage}
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                    selectedVariant={selectedVariant}
                    setSelectedVariant={setSelectedVariant}
                    modelsList={modelsList}
                    onOpenMoreModels={() => setMoreModelsModalOpen(true)}
                    isStreaming={isStreaming}
                    onStop={handleStopGeneration}
                    comments={comments}
                    contextPercent={contextPercent}
                    onRemoveComment={(id) => setComments(prev => prev.filter(c => c.id !== id))}
                    onClickComment={(fileName, line) => {
                      const matchingFile = sessionArtifacts.find(f => f.name === fileName);
                      if (matchingFile) {
                        setActiveFile({ name: fileName, code: matchingFile.versions[matchingFile.versions.length - 1].code });
                        setJumpToLine(line);
                        setShowArtifactsPanel(false);
                      }
                    }}
                    attachments={attachments}
                    uploadingStates={uploadingStates}
                    onUpload={handleUploadAttachment}
                    onRemoveAttachment={handleRemoveAttachment}
                    onPreviewImage={handlePreviewImage}
                    onPreviewDocument={setZoomDocument}
                    editingFile={editingFile}
                    onRemoveEditingFile={() => setEditingFile(null)}
                  />

                  <span className="text-[12px] text-zinc-500 font-sans tracking-wide select-none">
                    VoxKage can make mistakes. Please double check responses.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Draggable Vertical Splitter Handle */}
          {(activeFile || showArtifactsPanel) && !isExpanded && (
            <div
              onPointerDown={handlePointerDown}
              className="w-1 cursor-col-resize h-full bg-zinc-800/80 hover:bg-blue-600/80 transition-colors z-30 select-none flex items-center justify-center relative group"
            >
              <div className="absolute w-[2px] h-8 rounded-full bg-zinc-700 group-hover:bg-blue-500 transition-colors" />
            </div>
          )}

          {displayedActiveFile && (
            <div
              style={{
                width: isExpanded ? "100%" : `${rightPanelWidth}px`,
              }}
              className="h-full flex-shrink-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
            >
              <FileInspectorPanel
                fileName={displayedActiveFile.name}
                code={displayedActiveFile.code}
                onClose={() => {
                  setActiveFile(null);
                  setJumpToLine(null);
                  setIsExpanded(false);
                }}
                onBack={() => {
                  setActiveFile(null);
                  setShowArtifactsPanel(true);
                }}
                isExpanded={isExpanded}
                onToggleExpand={() => setIsExpanded(!isExpanded)}
                comments={comments}
                onAddComment={(line, text) => {
                  setComments(prev => [
                    ...prev,
                    {
                      id: `comment-${Date.now()}`,
                      fileName: displayedActiveFile!.name,
                      line,
                      text
                    }
                  ]);
                }}
                onDeleteComment={(id) => {
                  setComments(prev => prev.filter(c => c.id !== id));
                }}
                jumpToLine={jumpToLine}
                sessionFiles={sessionArtifacts}
                onNavigateFile={(name) => {
                  const matchingFile = sessionArtifacts.find(f => f.name === name);
                  if (matchingFile && matchingFile.versions.length > 0) {
                    setActiveFile({ name, code: matchingFile.versions[matchingFile.versions.length - 1].code });
                  }
                }}
                onEditClick={(name) => {
                  setEditingFile(name);
                }}
              />
            </div>
          )}

          {showArtifactsPanel && !displayedActiveFile && (
            <div
              style={{
                width: isExpanded ? "100%" : `${rightPanelWidth}px`,
              }}
              className="h-full flex-shrink-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden bg-[#0d0d11] border-l border-zinc-800/80 flex flex-col"
            >
              <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-800/80 bg-[#0d0d11] select-none flex-shrink-0">
                <span className="text-[14.5px] font-medium text-zinc-300 font-sans tracking-wide">
                  Artifacts
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowArtifactsPanel(false);
                    setIsExpanded(false);
                  }}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
                  aria-label="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-grow overflow-auto p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-zinc-100 text-[15px] font-medium font-sans">
                    Artifacts created in this session
                  </h3>
                  {sessionArtifacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        sessionArtifacts.forEach((file) => {
                          const activeVer = activeFileVersions[file.name] || file.versions.length;
                          const verObj = file.versions.find((v: any) => v.version === activeVer) || file.versions[file.versions.length - 1];
                          const blob = new Blob([verObj.code], { type: "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = file.name.split("/").pop() || file.name;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        });
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-zinc-800 bg-[#16161a] hover:bg-[#202025] text-zinc-350 hover:text-white text-[12.5px] font-medium transition-all duration-200 cursor-pointer select-none"
                    >
                      Download all
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  {sessionArtifacts.map((file, idx) => {
                    const activeVer = activeFileVersions[file.name] || file.versions.length;
                    const verObj = file.versions.find((v: any) => v.version === activeVer) || file.versions[file.versions.length - 1];
                    return (
                      <FileListItem
                        key={idx}
                        name={file.name}
                        type={file.type}
                        versions={file.versions}
                        activeVersion={activeVer}
                        onSelectVersion={(ver) => {
                          setActiveFileVersions(prev => ({ ...prev, [file.name]: ver }));
                        }}
                        onClick={() => {
                          setActiveFile({ name: file.name, code: verObj.code });
                          setShowArtifactsPanel(false);
                        }}
                        onDownload={() => {
                          const blob = new Blob([verObj.code], { type: "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = file.name.split("/").pop() || file.name;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* More Models Modal */}
      {moreModelsModalOpen && (
        <MoreModelsModal
          selectedModel={selectedModel}
          modelsList={modelsList}
          onSelectModel={setSelectedModel}
          onToggleFavourite={handleToggleFavourite}
          onClose={() => setMoreModelsModalOpen(false)}
        />
      )}

      {/* Rename Session Dialog */}
      {renameSessionId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            onClick={() => setRenameSessionId(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200" 
          />
          <div className="relative w-full max-w-sm bg-[#121216] border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 flex flex-col gap-4 font-sans text-zinc-300 animate-fadeIn">
            <h3 className="text-zinc-100 text-base font-semibold">Rename Chat</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  executeRenameSession();
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRenameSessionId(null)}
                className="px-4 py-2 rounded-xl border border-zinc-800 text-[13.5px] hover:bg-zinc-800/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRenameSession}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_12px_rgba(37,99,235,0.45)] text-white border border-blue-500/30 transition-colors text-[13.5px] font-medium cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Dialog */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            onClick={() => setShowSettingsModal(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200" 
          />
          <div className="relative w-full max-w-md bg-[#121216] border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 flex flex-col gap-4 font-sans text-zinc-300 animate-fadeIn">
            <h3 className="text-zinc-100 text-base font-semibold">VoxKage Settings</h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-zinc-400">Display Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700"
              />
              <span className="text-[11px] text-zinc-500">Shown in greetings and across the interface.</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-zinc-400">OpenCode Zen API Key</label>
              <input
                type="password"
                value={openCodeApiKey}
                onChange={(e) => setOpenCodeApiKey(e.target.value)}
                placeholder="Enter OpenCode API Key"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700"
              />
              <span className="text-[11px] text-zinc-500">Stored locally in your browser. Originates requests directly from your IP.</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-zinc-400">Cloudflare CORS Proxy URL</label>
              <input
                type="text"
                value={customProxyUrl}
                onChange={(e) => setCustomProxyUrl(e.target.value)}
                placeholder="https://voxkage-proxy.yourname.workers.dev"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 text-zinc-200 text-[14.5px] focus:outline-none focus:border-zinc-700"
              />
              <span className="text-[11px] text-zinc-500">Personal proxy to bypass browser CORS headers. Default public workers pool used if empty.</span>
            </div>

            <div className="flex gap-2 justify-between mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSettingsModal(false);
                  handleLogout();
                }}
                className="px-4 py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-950/20 text-[13.5px] font-medium transition-colors cursor-pointer"
              >
                Log Out
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-800 text-[13.5px] hover:bg-zinc-800/80 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("voxkage_opencode_api_key", openCodeApiKey.trim());
                    localStorage.setItem("voxkage_custom_proxy_url", customProxyUrl.trim());
                    localStorage.setItem("voxkage_user_name", userName.trim());
                    setShowSettingsModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_12px_rgba(37,99,235,0.45)] text-white border border-blue-500/30 transition-colors text-[13.5px] font-medium cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (() => {
        const filteredSearchSessions = sessionsList.filter((session) =>
          session.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const handleSearchKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSearchSelectedIndex((prev) =>
              Math.min(prev + 1, filteredSearchSessions.length - 1)
            );
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSearchSelectedIndex((prev) => Math.max(prev - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (filteredSearchSessions[searchSelectedIndex]) {
              handleSelectSession(filteredSearchSessions[searchSelectedIndex].id);
              setShowSearchModal(false);
              setSearchQuery("");
            }
          } else if (e.key === "Escape") {
            setShowSearchModal(false);
            setSearchQuery("");
          }
        };

        return (
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[15vh]">
            <div 
              onClick={() => { setShowSearchModal(false); setSearchQuery(""); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200" 
            />
            <div className="relative w-full max-w-xl bg-[#121216] border border-zinc-800 rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden font-sans text-zinc-300 animate-fadeIn">
              {/* Search Input Box */}
              <div className="relative flex items-center border-b border-zinc-800/80">
                <Search className="absolute left-4 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchSelectedIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search chats and projects"
                  className="w-full bg-transparent h-14 pl-11 pr-11 focus:outline-none text-[14.5px] text-zinc-100 placeholder-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => { setShowSearchModal(false); setSearchQuery(""); }}
                  className="absolute right-4 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-350 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Results List */}
              <div className="flex-grow max-h-[350px] overflow-y-auto p-2 flex flex-col gap-0.5 custom-chat-scrollbar">
                {filteredSearchSessions.map((session, index) => {
                  const isSelected = index === searchSelectedIndex;
                  const relativeTime = getRelativeTime(session.updated_at);
                  
                  return (
                    <div
                      key={session.id}
                      onClick={() => {
                        handleSelectSession(session.id);
                        setShowSearchModal(false);
                        setSearchQuery("");
                      }}
                      onMouseEnter={() => setSearchSelectedIndex(index)}
                      className={`w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl cursor-pointer transition-all duration-150 select-none ${
                        isSelected
                          ? "bg-[#18181c] text-white font-medium border border-zinc-800/50"
                          : "text-zinc-400 hover:text-zinc-100"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-6">
                        <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-white" : "text-zinc-500"}`} />
                        <span className="truncate text-[13.5px]">{session.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isSelected ? (
                          <span className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">Enter</span>
                        ) : (
                          <span className="text-[10.5px] text-zinc-500 font-normal">{relativeTime}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredSearchSessions.length === 0 && (
                  <div className="text-center py-8 text-[13px] text-zinc-500">
                    No matching chats found
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {zoomImage && (
        <ZoomImagePreview
          src={zoomImage}
          thumbnailRect={zoomThumbnailRect}
          onClose={() => {
            setZoomImage(null);
            setZoomThumbnailRect(null);
          }}
        />
      )}

      {zoomDocument && (
        <ZoomDocumentPreview
          file={zoomDocument}
          onClose={() => setZoomDocument(null)}
        />
      )}

      <ConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        connectedServers={connectedServers}
        onConnectClick={handleConnectClick}
        onConfigureClick={(id) => {
          setConnectedServers((prev) => prev.filter((s) => s !== id));
        }}
      />

      {connectingServer && (
        <ConnectingAppModal
          isOpen={!!connectingServer}
          serverId={connectingServer.id}
          serverName={connectingServer.name}
          onCancel={() => setConnectingServer(null)}
          onSuccess={handleConnectionSuccess}
        />
      )}

      {/* CSS custom scrollbar style tag */}
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
