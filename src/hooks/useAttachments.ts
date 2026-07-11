"use client";

import { useState } from "react";
import { Attachment } from "@/components/MessageAttachmentsRow";
import { uploadSessionFile, deleteSessionFile } from "@/lib/api";

interface UseAttachmentsProps {
  currentSessionId: string | null;
  draftSessionId: string | null;
  setDraftSessionId: (id: string | null) => void;
}

export default function useAttachments({
  currentSessionId,
  draftSessionId,
  setDraftSessionId,
}: UseAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingStates, setUploadingStates] = useState<Record<string, "uploading" | "failed">>({});

  const handleUploadAttachment = async (file: File) => {
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
      size: file.size,
    };
    setAttachments((prev) => [...prev, placeholder]);

    try {
      const res = await uploadSessionFile(targetSessionId, file);
      setAttachments((prev) =>
        prev.map((att) =>
          att.filename === tempName
            ? {
                filename: res.filename,
                original_name: res.original_name,
                url: res.url,
                type: res.type,
                size: res.size,
                num_pages: res.num_pages,
              }
            : att
        )
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

  return {
    attachments,
    setAttachments,
    uploadingStates,
    setUploadingStates,
    handleUploadAttachment,
    handleRemoveAttachment,
  };
}
