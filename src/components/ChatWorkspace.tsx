"use client";

import React from "react";
import { ArrowDown, PanelLeft } from "lucide-react";
import UserBubble from "@/components/UserBubble";
import AssistantResponseBubble from "@/components/AssistantResponseBubble";
import PromptInput from "@/components/PromptInput";
// import VoxKageIdleCreature from "@/components/VoxKageIdleCreature"; // ← kept for reference
import VoxKageCreature from "@/components/VoxKageCreature";
import AnimatedHomepageGreeting from "@/components/AnimatedHomepageGreeting";
import { Message } from "@/lib/chatHelpers";
import { Attachment } from "@/components/MessageAttachmentsRow";

interface ChatWorkspaceProps {
  sessionId: string | null;
  isChatActive: boolean;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  isSessionLoading: boolean;
  messages: Message[];
  handlePreviewImage: (url: string, rect: DOMRect) => void;
  setZoomDocument: (doc: Attachment | null) => void;
  handleUserMessageEdit: (messageId: string, newText: string) => Promise<void>;
  setActiveFile: (file: { name: string; code: string } | null) => void;
  scrollToBottom: () => void;
  activeFileVersions: Record<string, number>;
  setActiveFileVersions: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  handleAssistantFeedback: (
    messageId: string,
    feedbackType: "thumbs_up" | "thumbs_down",
    comments?: string
  ) => Promise<void>;
  handleAssistantRetry: (msgId: string) => Promise<void>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  greeting: string;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  selectedVariant: string;
  setSelectedVariant: (variant: string) => void;
  modelsList: any[];
  setMoreModelsModalOpen: (open: boolean) => void;
  isStreaming: boolean;
  handleStopGeneration: () => void;
  comments: any[];
  setComments: React.Dispatch<React.SetStateAction<any[]>>;
  contextPercent: number;
  sessionArtifacts: any[];
  attachments: Attachment[];
  uploadingStates: Record<string, "uploading" | "failed">;
  handleUploadAttachment: (file: File) => Promise<void>;
  handleRemoveAttachment: (filename: string) => void;
  editingFile: string | null;
  setEditingFile: (file: string | null) => void;
  showScrollBottom: boolean;
  handleSendMessage: (text: string) => void;
  setShowArtifactsPanel: (show: boolean) => void;
  setJumpToLine: (line: number | null) => void;
  onToggleSidebar?: () => void;
}

export default function ChatWorkspace({
  sessionId,
  isChatActive,
  chatContainerRef,
  handleScroll,
  isSessionLoading,
  messages,
  handlePreviewImage,
  setZoomDocument,
  handleUserMessageEdit,
  setActiveFile,
  scrollToBottom,
  activeFileVersions,
  setActiveFileVersions,
  handleAssistantFeedback,
  handleAssistantRetry,
  messagesEndRef,
  greeting,
  selectedModel,
  setSelectedModel,
  selectedVariant,
  setSelectedVariant,
  modelsList,
  setMoreModelsModalOpen,
  isStreaming,
  handleStopGeneration,
  comments,
  setComments,
  contextPercent,
  sessionArtifacts,
  attachments,
  uploadingStates,
  handleUploadAttachment,
  handleRemoveAttachment,
  editingFile,
  setEditingFile,
  showScrollBottom,
  handleSendMessage,
  setShowArtifactsPanel,
  setJumpToLine,
  onToggleSidebar,
}: ChatWorkspaceProps) {
  const [isLightMode, setIsLightMode] = React.useState(false);

  React.useEffect(() => {
    const checkTheme = () => {
      const isL = document.documentElement.classList.contains("light");
      setIsLightMode(isL);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
      }}
      className="flex flex-col h-full relative transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
    >
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className={`w-full h-full overflow-y-auto custom-chat-scrollbar flex flex-col items-center transition-all duration-500 ease-out ${
          isChatActive ? "opacity-100 block" : "opacity-0 hidden"
        }`}
      >
        <div className="w-full max-w-3xl flex flex-col gap-8 pt-24 pb-[260px] md:pb-[280px] px-4 md:px-6">
          {isSessionLoading ? (
            <div className="flex flex-col gap-8 w-full animate-pulse select-none">
              <div className="flex gap-4 items-start w-full">
                <div className="w-8 h-8 rounded-full bg-zinc-800/40 flex-shrink-0" />
                <div className="flex flex-col gap-3.5 flex-grow">
                  <div className="h-4 bg-zinc-800/40 rounded-lg w-1/4" />
                  <div className="h-3.5 bg-zinc-800/40 rounded-lg w-3/4" />
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="w-full">
                {msg.role === "user" ? (
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
                  <AssistantResponseBubble
                    sessionId={sessionId}
                    msg={msg}
                    setActiveFile={setActiveFile}
                    onScrollToBottom={scrollToBottom}
                    messages={messages}
                    activeFileVersions={activeFileVersions}
                    setActiveFileVersions={setActiveFileVersions}
                    onFeedback={handleAssistantFeedback}
                    onRetry={handleAssistantRetry}
                    onSendPrompt={handleSendMessage}
                  />
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Mobile Sidebar Toggle — always visible on mobile homepage, not gated by isChatActive */}
      {!isChatActive && messages.length === 0 && onToggleSidebar && (
        <button
          id="mobile-sidebar-toggle-homepage"
          type="button"
          onClick={onToggleSidebar}
          className={`md:hidden fixed top-4 left-4 z-50 flex items-center justify-center w-9 h-9 rounded-xl active:scale-95 cursor-pointer transition-all duration-200 ${
            isLightMode 
              ? "bg-[#3d3d3a] border border-[#252523] text-[#e6dfd8] shadow-sm" 
              : "bg-white/5 border border-white/10 text-zinc-300 hover:text-white"
          }`}
          aria-label="Open sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      )}

      {/* Unstarted Homepage Container */}
      {!isChatActive && messages.length === 0 && (
        <>
          {/* ── DESKTOP LAYOUT (md+): exact original — centered column with inline prompt box ── */}
          <div className="hidden md:flex flex-grow flex-col items-center justify-center w-full max-w-3xl mx-auto px-4 z-20 pb-32 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]">
            <div className="overflow-hidden flex flex-col items-center mb-7">
              <VoxKageCreature />
              <AnimatedHomepageGreeting greeting={greeting} />
            </div>
            <div className="w-full flex flex-col items-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]">
              <PromptInput
                isSession={false}
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
                onRemoveComment={(id) => setComments((prev) => prev.filter((c) => c.id !== id))}
                onClickComment={(fileName, line) => {
                  const matchingFile = sessionArtifacts.find((f) => f.name === fileName);
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
          </div>

          {/* ── MOBILE LAYOUT (<md): creature+greeting centered in available viewport above prompt bar ── */}
          <div className="md:hidden flex flex-col items-center justify-center w-full h-full pb-36 px-4 z-20 pointer-events-none select-none">
            <div className="flex flex-col items-center pointer-events-auto">
              <VoxKageCreature />
              <AnimatedHomepageGreeting greeting={greeting} />
            </div>
          </div>

          {/* Mobile-only: Prompt box fixed to bottom edge with safe-area padding */}
          <div className={`md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-gradient-to-t ${
            isLightMode 
              ? "from-[#DBDAD4] via-[#DBDAD4]/90 to-transparent" 
              : "from-[#05050a] via-[#05050a]/90 to-transparent"
          }`}>
            <PromptInput
              isSession={false}
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
              onRemoveComment={(id) => setComments((prev) => prev.filter((c) => c.id !== id))}
              onClickComment={(fileName, line) => {
                const matchingFile = sessionArtifacts.find((f) => f.name === fileName);
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
        </>
      )}

      {/* Active Normal Chat Session Container */}
      {isChatActive && (
        <div className={`fixed md:absolute bottom-0 left-0 right-0 z-30 pt-4 md:pt-10 px-3 md:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-5 flex flex-col items-center gap-1.5 md:gap-2.5 pointer-events-none bg-gradient-to-t ${
          isLightMode 
            ? "from-[#DBDAD4] via-[#DBDAD4]/95 to-transparent" 
            : "from-[#05050a] via-[#05050a]/95 to-transparent"
        }`}>
          <div className="relative z-10 w-full flex flex-col items-center gap-1.5 md:gap-2.5">
            {showScrollBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-zinc-800 bg-[#16161a] hover:bg-[#202025] text-zinc-400 hover:text-zinc-200 shadow-lg transition-all duration-200 cursor-pointer animate-fadeIn mb-1 pointer-events-auto"
                aria-label="Scroll to bottom"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            )}
            <div className="w-full flex justify-center pointer-events-auto">
              <PromptInput
                isSession={true}
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
                onRemoveComment={(id) => setComments((prev) => prev.filter((c) => c.id !== id))}
                onClickComment={(fileName, line) => {
                  const matchingFile = sessionArtifacts.find((f) => f.name === fileName);
                  if (matchingFile) {
                    setActiveFile({
                      name: fileName,
                      code: matchingFile.versions[matchingFile.versions.length - 1].code,
                    });
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
            <span className="text-[11.5px] md:text-[12px] text-zinc-300 [.light_&]:text-[#6c6a64] font-sans tracking-wide select-none pointer-events-auto text-center px-2">
              VoxKage can make mistakes. Please double check responses.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
