"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Settings2,
  Search,
  ArrowLeft,
  ExternalLink,
  Copy,
  CheckCheck,
  RefreshCw,
} from "lucide-react";
import { getToken, BACKEND_URL } from "@/lib/api";

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedServers: string[];
  onConnectSuccess: (slug: string) => void;
  onDisconnectSuccess: (slug: string) => void;
}

const CONNECTORS = [
  {
    slug: "gmail",
    name: "Gmail",
    tagline: "Draft replies, summarize threads, & search your inbox",
    description:
      "Connect Gmail to VoxKage to quickly find important emails and understand long conversations. VoxKage can search through your messages, read entire email threads to give you context, and help you stay on top of your inbox. Perfect for finding that message you remember sending, catching up on email chains you missed, or preparing for meetings.",
    developer: "Google",
    developerUrl: "https://cloud.google.com",
    connectorUrl: "https://gmailmcp.googleapis.com/mcp/v1",
    category: "Communication",
    tools: [
      "create_draft",
      "get_thread",
      "list_drafts",
      "list_labels",
      "search_threads",
    ],
    links: {
      documentation: "https://developers.google.com/gmail/api/guides",
      support: "https://support.google.com/mail",
      privacy: "https://policies.google.com/privacy",
    },
    iconUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg",
  },
  {
    slug: "google_drive",
    name: "Google Drive",
    tagline: "Search, read, and upload files instantly",
    description:
      "Connect Google Drive to VoxKage to search through your documents, read file contents, upload new files, and analyze your data. VoxKage can find specific documents even when you don't remember the exact name, read and analyze the content of Google Docs, Sheets, Slides, and PDFs, and upload files directly to your Drive. Useful for finding project notes, extracting data from spreadsheets, preparing meeting materials, or organizing files scattered across your Drive.",
    developer: "Google",
    developerUrl: "https://cloud.google.com",
    connectorUrl: "https://drivemcp.googleapis.com/mcp/v1",
    category: "Productivity",
    tools: [
      "create_file",
      "download_file_content",
      "get_file_metadata",
      "get_file_permissions",
      "list_recent_files",
      "read_file_content",
      "search_files",
    ],
    links: {
      documentation: "https://developers.google.com/drive/api/guides",
      support: "https://support.google.com/drive",
      privacy: "https://policies.google.com/privacy",
    },
    iconUrl: "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg",
  },
  {
    slug: "google_calendar",
    name: "Google Calendar",
    tagline: "Manage your schedule and coordinate meetings effortlessly",
    description:
      "Connect Google Calendar to VoxKage to view your schedule, manage events, and coordinate meetings. VoxKage can search your calendar for events, check your availability, find free time slots, create and update events, respond to invitations, and help you prepare for meetings. Useful for understanding what's coming up, scheduling new meetings by finding mutual availability, managing your calendar by creating or updating events, coordinating schedules across multiple people, or preparing for meetings by reviewing attendee lists and details.",
    developer: "Google",
    developerUrl: "https://cloud.google.com",
    connectorUrl: "https://calendarrmcp.googleapis.com/mcp/v1",
    category: "Productivity",
    tools: [
      "create_event",
      "delete_event",
      "find_free_time",
      "get_event",
      "list_calendars",
      "list_events",
      "respond_to_event",
      "update_event"
    ],
    links: {
      documentation: "https://developers.google.com/calendar/api/guides",
      support: "https://support.google.com/calendar",
      privacy: "https://policies.google.com/privacy",
    },
    iconUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg",
  },
  {
    slug: "notion",
    name: "Notion",
    tagline: "Connect your Notion workspace to search, update, and power workflows",
    description:
      "Notion MCP helps you plug tools into your Notion workspace, allowing you to create, edit, search and organize content directly from Claude. Get contextual and relevant assistance from VoxKage, while keeping knowledge organized in Notion.",
    developer: "Notion",
    developerUrl: "https://notion.so",
    connectorUrl: "https://mcp.notion.com/mcp",
    category: "Productivity",
    tools: [
      "search",
      "fetch",
      "create-pages",
      "update-page",
      "move-pages",
      "duplicate-page",
      "create-database",
      "update-database",
      "create-comment",
      "get-comments",
      "get-users",
      "get-self",
      "get-user"
    ],
    links: {
      documentation: "https://developers.notion.com/docs",
      support: "https://www.notion.so/help",
      privacy: "https://www.notion.so/privacy-policy",
    },
    iconUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg",
  }
];

export default function ConnectModal({
  isOpen,
  onClose,
  connectedServers,
  onConnectSuccess,
  onDisconnectSuccess,
}: ConnectModalProps) {
  const [view, setView] = useState<"list" | "details">("list");
  const [activeConnector, setActiveConnector] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [connectedDetails, setConnectedDetails] = useState<Record<string, any>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setView("list");
      setSearchQuery("");
      setError(null);
      fetchConnectedDetails();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && view === "list") {
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [isOpen, view]);

  const fetchConnectedDetails = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${BACKEND_URL}/user/settings-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const conns = data.settings_profile?.mcp_connections || {};
        setConnectedDetails(conns);
      }
    } catch {
      /* silent */
    }
  };

  const isConnected = (slug: string) => {
    return connectedServers.includes(slug) || !!connectedDetails[slug];
  };

  const handleConnect = async (connector: any) => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();

      const profRes = await fetch(`${BACKEND_URL}/user/settings-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!profRes.ok) throw new Error("Session expired. Please log in again.");
      const profData = await profRes.json();
      const userId = profData.settings_profile?.user_id || "default_user";

      const redirectUri = window.location.origin + "/oauth/callback";
      const authRes = await fetch(
        `${BACKEND_URL}/auth/oauth/authorize-url?provider=${connector.slug}&user_id=${userId}&redirect_uri=${encodeURIComponent(redirectUri)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!authRes.ok) {
        const errJson = await authRes.json().catch(() => ({}));
        throw new Error(errJson.detail || `Failed to start ${connector.name} OAuth flow.`);
      }
      const { url } = await authRes.json();

      const w = 520, h = 640;
      const left = window.screen.width / 2 - w / 2;
      const top = window.screen.height / 2 - h / 2;
      const popup = window.open(
        url,
        `${connector.slug}_oauth`,
        `width=${w},height=${h},left=${left},top=${top},status=no`
      );
      if (!popup) throw new Error("Popup blocked. Allow popups for this site.");

      const listener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === "OAUTH_SUCCESS" && event.data?.provider === connector.slug) {
          window.removeEventListener("message", listener);
          setLoading(false);
          fetchConnectedDetails();
          onConnectSuccess(connector.slug);
        } else if (event.data?.type === "OAUTH_FAILURE") {
          window.removeEventListener("message", listener);
          setError(event.data.error || "Google sign-in was declined.");
          setLoading(false);
        }
      };
      window.addEventListener("message", listener);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  const handleDisconnect = async (connector: any) => {
    setLoading(true);
    try {
      const token = getToken();
      await fetch(`${BACKEND_URL}/auth/disconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider: connector.slug }),
      });
      setConnectedDetails((prev) => {
        const copy = { ...prev };
        delete copy[connector.slug];
        return copy;
      });
      onDisconnectSuccess(connector.slug);
      setView("list");
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (connector: any) => {
    navigator.clipboard.writeText(connector.connectorUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefreshTools = async (connector: any) => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${BACKEND_URL}/auth/mcp/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider: connector.slug }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Failed to refresh tool schemas.");
      }
      const data = await res.json();
      await fetchConnectedDetails();
      alert(`Successfully refreshed! Discovered ${data.tools_count} tools.`);
    } catch (err: any) {
      setError(err.message || "Failed to refresh tool schemas.");
    } finally {
      setLoading(false);
    }
  };

  const filteredConnectors = CONNECTORS.filter((connector) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      connector.name.toLowerCase().includes(query) ||
      connector.tagline.toLowerCase().includes(query) ||
      connector.category.toLowerCase().includes(query)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[3px] animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal shell */}
      <div
        className="relative flex flex-col overflow-hidden animate-scaleUp font-sans"
        style={{
          width: "min(860px, 96vw)",
          height: "min(700px, 92vh)",
          background: "#1a1a1a",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {/* ─── VIEW: LIST ───────────────────────────────────────────── */}
        {view === "list" && (
          <div className="flex flex-col h-full">
            {/* Top bar */}
            <div
              className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <h2
                className="text-[26px] font-normal leading-tight"
                style={{
                  color: "#f0f0f0",
                  letterSpacing: "-0.02em",
                  fontFamily: "Copernicus, Tiempos, Georgia, serif",
                }}
              >
                Connect Tools with VoxKage
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                style={{ color: "#888" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLElement).style.color = "#ddd";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "#888";
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search bar */}
            <div className="px-6 py-4 flex-shrink-0">
              <div className="relative">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "#666" }}
                />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search connectors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 text-[13.5px] rounded-xl outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    color: "#e0e0e0",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.border = "1px solid rgba(255,255,255,0.18)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.border = "1px solid rgba(255,255,255,0.09)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  }}
                />
              </div>
            </div>

            {/* Server grid */}
            <div className="flex-grow overflow-y-auto px-6 pb-6 custom-chat-scrollbar">
              {filteredConnectors.length > 0 ? (
                <>
                  <p
                    className="text-[11px] font-semibold mb-3 uppercase tracking-widest"
                    style={{ color: "#555" }}
                  >
                    Available
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredConnectors.map((connector) => (
                      <ConnectorCard
                        key={connector.slug}
                        connector={connector}
                        isConnected={isConnected(connector.slug)}
                        loading={loading}
                        onConnectClick={() => handleConnect(connector)}
                        onCardClick={() => {
                          setActiveConnector(connector);
                          setView("details");
                        }}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div
                  className="flex flex-col items-center justify-center h-40 text-[13px]"
                  style={{ color: "#555" }}
                >
                  No connectors match &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── VIEW: DETAILS ────────────────────────────────────────── */}
        {view === "details" && activeConnector && (
          <ConnectorDetailsView
            connector={activeConnector}
            isConnected={isConnected(activeConnector.slug)}
            connectedDetails={connectedDetails[activeConnector.slug]}
            loading={loading}
            error={error}
            copied={copied}
            onBack={() => {
              setView("list");
              setError(null);
            }}
            onClose={onClose}
            onConnect={() => handleConnect(activeConnector)}
            onDisconnect={() => handleDisconnect(activeConnector)}
            onCopy={() => handleCopy(activeConnector)}
            onRefreshTools={() => handleRefreshTools(activeConnector)}
          />
        )}
      </div>
    </div>
  );
}

// ─── CONNECTOR CARD (list view) ───────────────────────────────────────────────
function ConnectorCard({
  connector,
  isConnected,
  loading,
  onConnectClick,
  onCardClick,
}: {
  connector: any;
  isConnected: boolean;
  loading: boolean;
  onConnectClick: () => void;
  onCardClick: () => void;
}) {
  return (
    <div
      onClick={onCardClick}
      className="relative flex flex-col gap-2.5 cursor-pointer select-none transition-all duration-150"
      style={{
        background: "#242424",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "12px",
        padding: "16px",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "#2a2a2a";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.13)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "#242424";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
      }}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <img
            src={connector.iconUrl}
            alt={connector.name}
            className="w-5 h-5 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>

        {/* Name + verified */}
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[14px] font-semibold truncate"
              style={{ color: "#e8e8e8" }}
            >
              {connector.name}
            </span>
            {isConnected && (
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                className="flex-shrink-0"
              >
                <circle cx="6.5" cy="6.5" r="6.5" fill="rgba(100,200,120,0.2)" />
                <path
                  d="M4 6.5l2 2 3-3"
                  stroke="#4ade80"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          {isConnected && (
            <span className="text-[11.5px]" style={{ color: "#555" }}>
              Connected
            </span>
          )}
        </div>

        {/* Action button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isConnected) {
              onCardClick();
            } else {
              onConnectClick();
            }
          }}
          title={isConnected ? "Manage" : "Connect"}
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150 cursor-pointer"
          style={{
            background: isConnected ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: isConnected ? "#888" : "#aaa",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = isConnected
              ? "rgba(255,255,255,0.09)"
              : "rgba(255,255,255,0.12)";
            (e.currentTarget as HTMLElement).style.color = "#e0e0e0";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = isConnected
              ? "rgba(255,255,255,0.04)"
              : "rgba(255,255,255,0.06)";
            (e.currentTarget as HTMLElement).style.color = isConnected ? "#888" : "#aaa";
          }}
        >
          {loading ? (
            <span
              className="animate-spin rounded-full border-[1.5px] border-t-transparent"
              style={{ width: 12, height: 12, borderColor: "#aaa", borderTopColor: "transparent" }}
            />
          ) : isConnected ? (
            <Settings2 className="w-3.5 h-3.5" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Tagline */}
      <p
        className="text-[12.5px] leading-relaxed line-clamp-2"
        style={{ color: "#666" }}
      >
        {connector.tagline}
      </p>
    </div>
  );
}

// ─── CONNECTOR DETAILS VIEW ───────────────────────────────────────────────────
function ConnectorDetailsView({
  connector,
  isConnected,
  connectedDetails,
  loading,
  error,
  copied,
  onBack,
  onClose,
  onConnect,
  onDisconnect,
  onCopy,
  onRefreshTools,
}: {
  connector: any;
  isConnected: boolean;
  connectedDetails: any;
  loading: boolean;
  error: string | null;
  copied: boolean;
  onBack: () => void;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onCopy: () => void;
  onRefreshTools: () => void;
}) {
  // Use dynamically retrieved tool names from connection data if connected, fallback to config
  const displayedTools = connectedDetails?.tools
    ? connectedDetails.tools.map((t: any) => t.name)
    : connector.tools;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] transition-colors cursor-pointer select-none"
          style={{ color: "#777" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#ccc";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#777";
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
          style={{ color: "#777" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
            (e.currentTarget as HTMLElement).style.color = "#ccc";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "#777";
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-grow overflow-y-auto custom-chat-scrollbar"
        style={{ padding: "28px 32px 40px" }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Large icon */}
            <div
              className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <img
                src={connector.iconUrl}
                alt={connector.name}
                className="w-7 h-7 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            {/* Name + subtitle */}
            <div>
              <div className="flex items-center gap-2">
                <h2
                  className="text-[20px] font-bold"
                  style={{ color: "#f0f0f0", letterSpacing: "-0.02em" }}
                >
                  {connector.name}
                </h2>
                {isConnected && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="8" fill="rgba(100,200,120,0.18)" />
                    <path
                      d="M5 8l2.5 2.5 4-4"
                      stroke="#4ade80"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <p className="text-[13px] mt-0.5" style={{ color: "#666" }}>
                {connector.tagline}
              </p>
            </div>
          </div>

          {/* Connect / Disconnect Action */}
          {isConnected ? (
            <button
              disabled={loading}
              onClick={onDisconnect}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-[13px] font-medium cursor-pointer transition-all disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e0e0e0",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.12)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.35)";
                (e.currentTarget as HTMLElement).style.color = "#f87171";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
                (e.currentTarget as HTMLElement).style.color = "#e0e0e0";
              }}
            >
              {loading ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : (
            <button
              disabled={loading}
              onClick={onConnect}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all disabled:opacity-50"
              style={{
                background: "#fff",
                color: "#111",
                border: "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#e8e8e8";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#fff";
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span
                    className="animate-spin rounded-full border-[1.5px]"
                    style={{ width: 12, height: 12, borderColor: "#333", borderTopColor: "transparent" }}
                  />
                  Connecting...
                </span>
              ) : (
                "Connect"
              )}
            </button>
          )}
        </div>

        {/* Description */}
        <p className="text-[14px] leading-[1.7] mb-6" style={{ color: "#c0c0c0" }}>
          {connector.description}
        </p>

        {/* Developer Info */}
        <div className="mb-1.5">
          <span className="text-[13.5px]" style={{ color: "#888" }}>Developed by </span>
          <a
            href={connector.developerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[13.5px] font-medium inline-flex items-center gap-1 transition-colors"
            style={{ color: "#60a5fa" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#93c5fd";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#60a5fa";
            }}
          >
            {connector.developer}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="text-[12px] leading-relaxed mb-7" style={{ color: "#555" }}>
          Only use connectors from developers you trust. VoxKage does not control which tools developers make available and cannot verify that they will work as intended or that they won&apos;t change.
        </p>

        {/* Error banner */}
        {error && (
          <div
            className="mb-5 px-4 py-3 rounded-xl text-[12.5px]"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#f87171",
            }}
          >
            {error}
          </div>
        )}

        {/* Tools */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold" style={{ color: "#e0e0e0" }}>Tools</span>
              <span
                className="text-[12px] font-bold px-1.5 py-0.5 rounded-full min-w-[22px] text-center"
                style={{ background: "#2e2e2e", color: "#bbb", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {displayedTools.length}
              </span>
            </div>
            {isConnected && (
              <button
                onClick={onRefreshTools}
                disabled={loading}
                title="Force refresh tool schemas from server"
                className="text-[12px] text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer select-none disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                Refresh Tools
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {displayedTools.map((tool: string) => (
              <span
                key={tool}
                className="px-3 py-1.5 text-[12.5px] font-mono rounded-full select-none"
                style={{
                  background: "#252525",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#d0d0d0",
                }}
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[15px] font-bold" style={{ color: "#e0e0e0" }}>Categories</span>
            <span
              className="text-[12px] font-bold px-1.5 py-0.5 rounded-full min-w-[22px] text-center"
              style={{ background: "#2e2e2e", color: "#bbb", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              1
            </span>
          </div>
          <span
            className="px-3 py-1.5 text-[12.5px] rounded-full"
            style={{
              background: "#252525",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#d0d0d0",
            }}
          >
            {connector.category}
          </span>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "4px 0 24px" }} />

        {/* Details Section */}
        <div>
          <h3 className="text-[15px] font-bold mb-5" style={{ color: "#e0e0e0" }}>
            Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-10">
            {/* Author */}
            <div>
              <p className="text-[12px] mb-1.5 font-medium" style={{ color: "#555" }}>Author</p>
              <a
                href={connector.developerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13.5px] font-medium transition-colors"
                style={{ color: "#60a5fa" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#93c5fd";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#60a5fa";
                }}
              >
                {connector.developer}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Connector URL */}
            <div>
              <p className="text-[12px] mb-1.5 font-medium" style={{ color: "#555" }}>Connector URL</p>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-mono break-all" style={{ color: "#bbb" }}>
                  {connector.connectorUrl}
                </span>
                <button
                  onClick={onCopy}
                  title="Copy URL"
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: copied ? "#4ade80" : "#888",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                  }}
                >
                  {copied ? (
                    <CheckCheck className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* More Info */}
            <div className="sm:col-span-2">
              <p className="text-[12px] mb-2 font-medium" style={{ color: "#555" }}>More info</p>
              <div className="flex flex-col gap-1.5">
                {[
                  { label: "Documentation", href: connector.links.documentation },
                  { label: "Support", href: connector.links.support },
                  { label: "Privacy Policy", href: connector.links.privacy },
                ].map(({ label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] transition-colors w-fit"
                    style={{ color: "#60a5fa" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "#93c5fd";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "#60a5fa";
                    }}
                  >
                    {label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
