"use client";

import React from "react";
import MoreModelsModal from "@/components/MoreModelsModal";
import ZoomImagePreview from "@/components/ZoomImagePreview";
import ZoomDocumentPreview from "@/components/ZoomDocumentPreview";
import ConnectModal from "@/components/ConnectModal";
import ConnectingAppModal from "@/components/ConnectingAppModal";
import RenameSessionModal from "@/components/RenameSessionModal";
import SettingsModal from "@/components/SettingsModal";
import SearchModal from "@/components/SearchModal";
import { Attachment } from "@/components/MessageAttachmentsRow";
import ScheduleListModal from "@/components/ScheduleListModal";

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
  userName: string;
  setUserName: (val: string) => void;
  openCodeApiKey: string;
  setOpenCodeApiKey: (val: string) => void;
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
  userName,
  setUserName,
  openCodeApiKey,
  setOpenCodeApiKey,
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
}: OverlayManagerProps) {
  const [schedulesModalOpen, setSchedulesModalOpen] = React.useState(false);

  React.useEffect(() => {
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

      {showSettingsModal && (
        <SettingsModal
          userName={userName}
          setUserName={setUserName}
          openCodeApiKey={openCodeApiKey}
          setOpenCodeApiKey={setOpenCodeApiKey}
          customProxyUrl={customProxyUrl}
          setCustomProxyUrl={setCustomProxyUrl}
          onClose={() => setShowSettingsModal(false)}
          onSave={() => {
            localStorage.setItem("voxkage_opencode_api_key", openCodeApiKey.trim());
            localStorage.setItem("voxkage_custom_proxy_url", customProxyUrl.trim());
            localStorage.setItem("voxkage_user_name", userName.trim());
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
        }}
        onDisconnectSuccess={(id) => {
          setConnectedServers((prev) => prev.filter((s) => s !== id));
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
