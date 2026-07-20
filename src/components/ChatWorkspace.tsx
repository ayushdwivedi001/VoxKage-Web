"use client";

import React from "react";
import { ArrowDown } from "lucide-react";
import UserBubble from "@/components/UserBubble";
import AssistantResponseBubble from "@/components/AssistantResponseBubble";
import PromptInput from "@/components/PromptInput";
// import VoxKageIdleCreature from "@/components/VoxKageIdleCreature"; // ← kept for reference
import VoxKageCreature from "@/components/VoxKageCreature";
import DesignPoeticSubtitle from "@/components/DesignPoeticSubtitle";
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
  isDesignMode?: boolean;
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
  isDesignMode = false,
}: ChatWorkspaceProps) {
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
        <div className="w-full max-w-3xl flex flex-col gap-8 pt-24 pb-[180px] px-4 md:px-6">
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
                  />
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {!isChatActive && (
        <div className={`flex-grow flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-4 pb-32 z-20 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isDesignMode ? "pt-12 sm:pt-20" : ""
        }`}>
          <div
            className={`w-full grid transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isDesignMode
                ? "grid-rows-[0fr] opacity-0 mb-0 pointer-events-none"
                : "grid-rows-[1fr] opacity-100 mb-7 pointer-events-auto"
            }`}
          >
            <div className="overflow-hidden flex flex-col items-center">
              <VoxKageCreature />
              <h1 className="text-white text-2xl sm:text-[34px] md:text-[38px] font-normal tracking-[-0.015em] select-none leading-tight text-center font-serif mt-2">
                {greeting}
              </h1>
            </div>
          </div>

          <div className="w-full flex flex-col items-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]">
            <PromptInput
              isSession={false}
              isDesignMode={isDesignMode}
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
            <DesignPoeticSubtitle isDesignMode={isDesignMode} />
          </div>
        </div>
      )}

      {isChatActive && (
        <div className="absolute bottom-0 left-0 right-0 z-30 pb-5 pt-10 px-4 flex flex-col items-center gap-2.5 pointer-events-none">
          <div className="relative z-10 w-full flex flex-col items-center gap-2.5">
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
            <span className="text-[12px] text-zinc-300 font-sans tracking-wide select-none pointer-events-auto">
              VoxKage can make mistakes. Please double check responses.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
