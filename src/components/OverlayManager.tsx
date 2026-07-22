"use client";

import React, { useState, useEffect } from "react";
import ProfileModal from "@/components/ProfileModal";
import MoreModelsModal from "@/components/MoreModelsModal";
import ZoomImagePreview from "@/components/ZoomImagePreview";
import ZoomDocumentPreview from "@/components/ZoomDocumentPreview";
import ConnectModal from "@/components/ConnectModal";
import ConnectingAppModal from "@/components/ConnectingAppModal";
import RenameSessionModal from "@/components/RenameSessionModal";
import SettingsModal from "@/components/SettingsModal";
import SearchModal from "@/components/SearchModal";
import ScheduleListModal from "@/components/ScheduleListModal";
import { Attachment } from "@/components/MessageAttachmentsRow";
import { clearToolsCache } from "@/hooks/useAgentCompletion";

interface OverlayManagerProps {
  moreModelsModalOpen: boolean;
  setMoreModelsModalOpen: (open: boolean) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  modelsList: any[];
  handleToggleFavourite: (model: string) => void;
  renameSessionId: string | null;
  setRenameSessionId: (id: string | null) => void;
  renameValue: string;
  setRenameValue: (val: string) => void;
  executeRenameSession: (id: string, name: string) => Promise<void>;
  showSettingsModal: boolean;
  setShowSettingsModal: (show: boolean) => void;
  showProfileModal: boolean;
  setShowProfileModal: (show: boolean) => void;
  userName: string;
  setUserName: (val: string) => void;
  userAvatarUrl?: string;
  openCodeApiKey: string;
  setOpenCodeApiKey: (val: string) => void;
  kiloApiKey: string;
  setKiloApiKey: (val: string) => void;
  customProxyUrl: string;
  setCustomProxyUrl: (val: string) => void;
  handleLogout: () => void;
  showSearchModal: boolean;
  setShowSearchModal: (show: boolean) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  sessionsList: any[];
  searchSelectedIndex: number;
  setSearchSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  handleSelectSession: (id: string | null) => void;
  zoomImage: string | null;
  setZoomImage: (val: string | null) => void;
  zoomThumbnailRect: DOMRect | null;
  setZoomThumbnailRect: (rect: DOMRect | null) => void;
  zoomDocument: Attachment | null;
  setZoomDocument: (doc: Attachment | null) => void;
  showConnectModal: boolean;
  setShowConnectModal: (show: boolean) => void;
  connectedServers: string[];
  setConnectedServers: React.Dispatch<React.SetStateAction<string[]>>;
  connectingServer: { id: string; name: string } | null;
  setConnectingServer: (server: { id: string; name: string } | null) => void;
  getRelativeTime: (date: string) => string;
  loginEmail: string;
}

export default function OverlayManager({
  moreModelsModalOpen,
  setMoreModelsModalOpen,
  selectedModel,
  setSelectedModel,
  modelsList,
  handleToggleFavourite,
  renameSessionId,
  setRenameSessionId,
  renameValue,
  setRenameValue,
  executeRenameSession,
  showSettingsModal,
  setShowSettingsModal,
  showProfileModal,
  setShowProfileModal,
  userName,
  setUserName,
  userAvatarUrl,
  openCodeApiKey,
  setOpenCodeApiKey,
  kiloApiKey,
  setKiloApiKey,
  customProxyUrl,
  setCustomProxyUrl,
  handleLogout,
  showSearchModal,
  setShowSearchModal,
  searchQuery,
  setSearchQuery,
  sessionsList,
  searchSelectedIndex,
  setSearchSelectedIndex,
  handleSelectSession,
  zoomImage,
  setZoomImage,
  zoomThumbnailRect,
  setZoomThumbnailRect,
  zoomDocument,
  setZoomDocument,
  showConnectModal,
  setShowConnectModal,
  connectedServers,
  setConnectedServers,
  connectingServer,
  setConnectingServer,
  getRelativeTime,
  loginEmail,
}: OverlayManagerProps) {
  const [schedulesModalOpen, setSchedulesModalOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setSchedulesModalOpen(true);
    window.addEventListener("open-schedules-modal", handleOpen);
    return () => {
      window.removeEventListener("open-schedules-modal", handleOpen);
    };
  }, []);
  return (
    <>
      {moreModelsModalOpen && (
        <MoreModelsModal
          selectedModel={selectedModel}
          modelsList={modelsList}
          hasKiloProvider={!!kiloApiKey}
          onSelectModel={setSelectedModel}
          onToggleFavourite={handleToggleFavourite}
          onClose={() => setMoreModelsModalOpen(false)}
        />
      )}

      {renameSessionId && (
        <RenameSessionModal
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onClose={() => setRenameSessionId(null)}
          onSave={async () => {
            await executeRenameSession(renameSessionId, renameValue);
            setRenameSessionId(null);
          }}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          userName={userName}
          setUserName={setUserName}
          userAvatarUrl={userAvatarUrl}
          onClose={() => {
            setUserName(localStorage.getItem("voxkage_user_name") || "");
            setShowProfileModal(false);
          }}
          onSave={() => {
            localStorage.setItem("voxkage_user_name", userName.trim());
            setShowProfileModal(false);
          }}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          openCodeApiKey={openCodeApiKey}
          setOpenCodeApiKey={setOpenCodeApiKey}
          kiloApiKey={kiloApiKey}
          setKiloApiKey={setKiloApiKey}
          customProxyUrl={customProxyUrl}
          setCustomProxyUrl={setCustomProxyUrl}
          onClose={() => {
            const email = loginEmail.trim().toLowerCase();
            import("@/lib/secureStorage").then(({ secureLoadKey }) => {
              secureLoadKey(`voxkage_${email}_opencode_api_key`).then((key) => {
                setOpenCodeApiKey(key);
              });
              secureLoadKey(`voxkage_${email}_kilo_api_key`).then((key) => {
                setKiloApiKey(key);
              });
            });
            setCustomProxyUrl(localStorage.getItem("voxkage_custom_proxy_url") || "");
            setShowSettingsModal(false);
          }}
          onSave={() => {
            const email = loginEmail.trim().toLowerCase();
            import("@/lib/secureStorage").then(({ secureSaveKey }) => {
              secureSaveKey(`voxkage_${email}_opencode_api_key`, openCodeApiKey.trim());
              secureSaveKey(`voxkage_${email}_kilo_api_key`, kiloApiKey.trim());
            });
            localStorage.setItem("voxkage_custom_proxy_url", customProxyUrl.trim());
            clearToolsCache();
            setShowSettingsModal(false);
          }}
          onLogout={handleLogout}
        />
      )}

      {showSearchModal && (
        <SearchModal
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sessionsList={sessionsList}
          searchSelectedIndex={searchSelectedIndex}
          setSearchSelectedIndex={setSearchSelectedIndex}
          onSelectSession={handleSelectSession}
          onClose={() => {
            setShowSearchModal(false);
            setSearchQuery("");
          }}
          getRelativeTime={getRelativeTime}
        />
      )}

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
        <ZoomDocumentPreview file={zoomDocument} onClose={() => setZoomDocument(null)} />
      )}

      <ConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        connectedServers={connectedServers}
        onConnectSuccess={(id) => {
          setConnectedServers((prev) => {
            if (prev.includes(id)) return prev;
            return [...prev, id];
          });
          clearToolsCache();
        }}
        onDisconnectSuccess={(id) => {
          setConnectedServers((prev) => prev.filter((s) => s !== id));
          clearToolsCache();
        }}
      />

      {connectingServer && (
        <ConnectingAppModal
          isOpen={!!connectingServer}
          serverId={connectingServer.id}
          serverName={connectingServer.name}
          onCancel={() => setConnectingServer(null)}
          onSuccess={() => {
            if (connectingServer) {
              setConnectedServers((prev) => [...prev, connectingServer.id]);
              setConnectingServer(null);
              clearToolsCache();
            }
          }}
        />
      )}

      <ScheduleListModal
        isOpen={schedulesModalOpen}
        onClose={() => setSchedulesModalOpen(false)}
      />
    </>
  );
}
