"use client";

import React, { useEffect, useState, useRef } from "react";

// Existing Components
import GradientBackground from "@/components/GradientBackground";
import Sidebar from "@/components/Sidebar";

// Extracted Components
import LoginView from "@/components/LoginView";
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
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectingServer, setConnectingServer] = useState<{ id: string; name: string } | null>(null);
  const [connectedServers, setConnectedServers] = useState<string[]>([]);

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isChatActive, setIsChatActive] = useState(false);

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
    if (!auth.isLoggedIn) return;
    try {
      const sess = await fetchSessions();
      chatSessions.setSessionsList(sess);

      const boot = await fetchBootPayload();
      
      setConnectedServers(boot.mcp_connections || []);
      
      let initialModels = mapModelsList(boot.models || [], boot.favorites || []);
      const { secureLoadKey } = await import("@/lib/secureStorage");
      const kKey = await secureLoadKey("voxkage_kilo_api_key");
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

      import("@/lib/secureStorage").then(({ secureLoadKey }) => {
        secureLoadKey("voxkage_opencode_api_key").then((key) => {
          setOpenCodeApiKey(key);
        });
        secureLoadKey("voxkage_kilo_api_key").then((key) => {
          setKiloApiKey(key);
        });
      });
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

  // Dynamically load Kilo Code models when kiloApiKey updates
  useEffect(() => {
    if (!kiloApiKey || !auth.isLoggedIn) return;
    import("@/lib/api").then(({ fetchKiloModels }) => {
      fetchKiloModels(kiloApiKey).then((kiloModels) => {
        if (kiloModels && kiloModels.length > 0) {
          setModelsList((prev) => {
            const nonKilo = prev.filter((m) => m.provider !== "kilo");
            const kiloFormatted = kiloModels.map((km: any) => ({
              name: km.name,
              desc: km.desc,
              api_key: km.api_key || km.name,
              provider: "kilo",
              isFavourite: false,
              requiresUpgrade: km.requiresUpgrade,
            }));
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

    const favs = updated.filter((m) => m.isFavourite).map((m) => m.api_key);
    try {
      await saveFavorites(favs);
    } catch (e) {
      console.error("Failed to save favorites to backend", e);
    }
  };

  const scrollToBottom = () => {
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
    setShowScrollBottom(distanceToBottom > 300);
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatSessions.messages]);

  const handlePreviewImage = (url: string, rect: DOMRect) => {
    setZoomThumbnailRect(rect);
    setZoomImage(url);
  };

  // Prevent flash of login screen while checking auth
  if (auth.isAuthChecking) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-[#05050a]">
        <GradientBackground isChatActive={false} />
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
          auth.setIsLoggedIn(true);
          if (avatarUrl) setUserAvatarUrl(avatarUrl);
          if (name) setUserName(name);
        }}
        onAuthSuccess={(token: string, email: string, avatarUrl?: string, name?: string) => {
          auth.setIsLoggedIn(true);
          if (avatarUrl) setUserAvatarUrl(avatarUrl);
          if (name) setUserName(name);
        }}
      />
    );
  }

  const sessionArtifacts = computeSessionFiles(chatSessions.messages);

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
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#05050a]">
      <GradientBackground isChatActive={isChatActive} />

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
          import("@/lib/secureStorage").then(({ secureLoadKey }) => {
            secureLoadKey("voxkage_opencode_api_key").then((key) => {
              setOpenCodeApiKey(key);
            });
            secureLoadKey("voxkage_kilo_api_key").then((key) => {
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
      <GradientBackground isChatActive={false} isDesignMode={true} />
      <DesignDottedCanvas active={true} isChatActive={isChatActive} />

      <main
        className="relative flex flex-col flex-grow items-center justify-between overflow-hidden bg-transparent transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10"
        style={{
          height: "100vh",
        }}
      >
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
            handleSendMessage={agentCompletion.handleSendMessage}
            setShowArtifactsPanel={setShowArtifactsPanel}
            setJumpToLine={setJumpToLine}
            onToggleSidebar={() => setSidebarExpanded((prev) => !prev)}
          />

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
