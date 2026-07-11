"use client";

import React from "react";
import { Message, computeSessionFiles } from "@/lib/chatHelpers";
import { Attachment } from "@/components/MessageAttachmentsRow";
import {
  createSession,
  adoptDraftFiles,
  prepareSessionPayload,
  executeBackendTools,
  logAssistantResponse,
  editSessionMessage,
  logMessageFeedback,
} from "@/lib/api";

interface UseAgentCompletionProps {
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  draftSessionId: string | null;
  setDraftSessionId: (id: string | null) => void;
  messages: Message[];
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  attachments: Attachment[];
  setAttachments: (attachments: Attachment[]) => void;
  comments: any[];
  setComments: (comments: any[] | ((prev: any[]) => any[])) => void;
  editingFile: string | null;
  setEditingFile: (file: string | null) => void;
  setIsChatActive: (active: boolean) => void;
  setChatTitle: (title: string) => void;
  setSessionsList: (sessions: any[] | ((prev: any[]) => any[])) => void;
  selectedModel: string;
  selectedVariant: string;
  activeFileVersions: Record<string, number>;
  setActiveFileVersions: (
    versions: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)
  ) => void;
  setActiveFile: (file: { name: string; code: string } | null) => void;
  hasVisitedRef: React.MutableRefObject<boolean>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  sessionArtifacts: any[];
  setShowArtifactsPanel: (show: boolean) => void;
  setJumpToLine: (line: number | null) => void;
}

export default function useAgentCompletion({
  currentSessionId,
  setCurrentSessionId,
  draftSessionId,
  setDraftSessionId,
  messages,
  setMessages,
  attachments,
  setAttachments,
  comments,
  setComments,
  editingFile,
  setEditingFile,
  setIsChatActive,
  setChatTitle,
  setSessionsList,
  selectedModel,
  selectedVariant,
  activeFileVersions,
  setActiveFileVersions,
  setActiveFile,
  hasVisitedRef,
  abortControllerRef,
  sessionArtifacts,
  setShowArtifactsPanel,
  setJumpToLine,
}: UseAgentCompletionProps) {
  const modelNameToKey = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes("deepseek")) return "deepseek-flash";
    if (lower.includes("gemini")) return "gemini-flash";
    if (lower.includes("claude") || lower.includes("sonnet")) return "claude-sonnet";
    if (lower.includes("mimo")) return "mimo-free";
    return "deepseek-flash";
  };

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
          status: "completed",
        };
      }
      return copy;
    });
  };

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
        setSessionsList((prev) => [newSess, ...prev]);

        // Adopt draft files if they were uploaded
        const activeDraftId = draftSessionId;
        if (activeDraftId) {
          try {
            await adoptDraftFiles(newSess.id, activeDraftId);
            finalAttachments = finalAttachments.map((att) => ({
              ...att,
              url: att.url.replace(activeDraftId, newSess.id),
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
        xmlParts.push(
          `  <attachment filename="${fn}" original_name="${on}" url="${url}" type="${tp}" size="${sz}" num_pages="${pg}" />`
        );
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
      thinkingSteps: [],
    };

    setAttachments([]);
    setComments([]);
    setEditingFile(null);

    setIsChatActive(true);
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    let promptText = text;
    if (editingFile) {
      const currentFiles = computeSessionFiles(messages);
      const matchingFile = currentFiles.find((f) => f.name === editingFile);
      if (matchingFile && matchingFile.versions.length > 0) {
        const fileCode = matchingFile.versions[matchingFile.versions.length - 1].code;
        promptText = `[Editing File: ${editingFile}]\nFile Content:\n\`\`\`\n${fileCode}\n\`\`\`\n\nUser Question:\n${text}`;
      }
    }
    if (comments.length > 0) {
      const sessionFiles = computeSessionFiles(messages);
      const commentCtx = comments
        .map((c) => {
          const matchingFile = sessionFiles.find((f) => f.name === c.fileName);
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
        })
        .join("\n\n");
      promptText = `${text}\n\n---\nCode Comments Context:\n${commentCtx}`;
    }

    const runClientAgentLoop = async () => {
      let finalAssistantContent = "";
      let activeAssistantMsgId = assistantMsg.id;

      try {
        const prepRes = await prepareSessionPayload(
          sessionId!,
          promptText,
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
        if (
          customProxyUrl &&
          customProxyUrl.trim() !== "" &&
          !customProxyUrl.includes("voxkage-proxy.ayushdwivedi001.workers.dev")
        ) {
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
            ...variantOverrides,
          };

          const isAgentic =
            (selectedVariant || "High").toUpperCase() in { HIGH: 1, XHIGH: 1, MAX: 1 };
          if (isAgentic && tools && tools.length > 0) {
            body.tools = tools;
            body.tool_choice = "auto";
          }

          const res = await fetch(targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openCodeKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
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
            const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
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
                      const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
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
                        currentToolCalls.push({
                          id: "",
                          type: "function",
                          function: { name: "", arguments: "" },
                        });
                      }
                      if (tc.id) currentToolCalls[tcIdx].id = tc.id;
                      if (tc.function?.name) currentToolCalls[tcIdx].function.name = tc.function.name;
                      if (tc.function?.arguments)
                        currentToolCalls[tcIdx].function.arguments += tc.function.arguments;
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
              const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
              if (idx !== -1) {
                const steps = copy[idx].thinkingSteps || [];
                const newSteps = [...steps];
                currentToolCalls.forEach((tc) => {
                  const label = tc.function.name
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c: string) => c.toUpperCase());
                  newSteps.push({
                    id: tc.id,
                    label: `Executing tool: ${label}`,
                    status: "pending",
                  });
                });
                copy[idx].thinkingSteps = newSteps;
                copy[idx].status = "thinking";
              }
              return copy;
            });

            const toolExecRes = await executeBackendTools(sessionId!, currentToolCalls);

            messagesPayload.push({
              role: "assistant",
              content: currentContent || null,
              tool_calls: currentToolCalls,
            });

            toolExecRes.results.forEach((r: any) => {
              messagesPayload.push(r);
            });

            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
              if (idx !== -1) {
                const steps = copy[idx].thinkingSteps || [];
                copy[idx].thinkingSteps = steps.map((s) => {
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
              const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
              if (idx !== -1) {
                copy[idx].content = finalAssistantContent;
              }
              return copy;
            });
          } else {
            break;
          }
        }

        await logAssistantResponse(sessionId!, finalAssistantContent);

        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const copy = [...prev];
          const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
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
          const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
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
      let finalContent = newText;
      const attachmentsXmlStart = originalUserMsg.content.indexOf("\n\n<attachments>");
      if (attachmentsXmlStart !== -1) {
        finalContent = `${newText}${originalUserMsg.content.substring(attachmentsXmlStart)}`;
      }

      await editSessionMessage(currentSessionId!, userMsgId, finalContent);

      const truncatedMessages = messages.slice(0, idx + 1);
      truncatedMessages[idx] = {
        ...originalUserMsg,
        content: finalContent,
      };

      const newAssistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        status: "thinking",
        thinkingDuration: 0,
        thinkingStart: Date.now(),
        thinkingSteps: [],
      };

      setMessages([...truncatedMessages, newAssistantMsg]);

      const runClientAgentLoop = async () => {
        let finalAssistantContent = "";
        let activeAssistantMsgId = newAssistantMsg.id;

        try {
          const finalAttachments: any[] = [];
          if (attachmentsXmlStart !== -1) {
            const xmlBlock = originalUserMsg.content.substring(attachmentsXmlStart);
            const attachmentsRegex =
              /<attachment filename="([^"]+)" original_name="([^"]+)" url="([^"]+)" type="([^"]+)" size="([^"]+)"(?: num_pages="([^"]+)")? \/>/g;
            let match;
            while ((match = attachmentsRegex.exec(xmlBlock)) !== null) {
              finalAttachments.push({
                filename: match[1],
                original_name: match[2],
                url: match[3],
                type: match[4],
                size: parseInt(match[5], 10),
                num_pages: match[6] ? parseInt(match[6], 10) : undefined,
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
          if (
            customProxyUrl &&
            customProxyUrl.trim() !== "" &&
            !customProxyUrl.includes("voxkage-proxy.ayushdwivedi001.workers.dev")
          ) {
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
              ...variantOverrides,
            };

            const isAgentic =
              (selectedVariant || "High").toUpperCase() in { HIGH: 1, XHIGH: 1, MAX: 1 };
            if (isAgentic && tools && tools.length > 0) {
              body.tools = tools;
              body.tool_choice = "auto";
            }

            const res = await fetch(targetUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openCodeKey}`,
              },
              body: JSON.stringify(body),
              signal: controller.signal,
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
              const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
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
                        const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
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
                          currentToolCalls.push({
                            id: "",
                            type: "function",
                            function: { name: "", arguments: "" },
                          });
                        }
                        if (tc.id) currentToolCalls[tcIdx].id = tc.id;
                        if (tc.function?.name) currentToolCalls[tcIdx].function.name = tc.function.name;
                        if (tc.function?.arguments)
                          currentToolCalls[tcIdx].function.arguments += tc.function.arguments;
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
                const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
                if (idx !== -1) {
                  const steps = copy[idx].thinkingSteps || [];
                  const newSteps = [...steps];
                  currentToolCalls.forEach((tc) => {
                    let label = tc.function.name
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c: string) => c.toUpperCase());
                    try {
                      const args = JSON.parse(tc.function.arguments);
                      if (tc.function.name === "web_search" || tc.function.name === "web_search_deep") {
                        label = args.query || label;
                      } else if (tc.function.name === "web_search_parallel") {
                        label =
                          args.queries && args.queries.length > 0 ? args.queries.join(", ") : label;
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
                tool_calls: currentToolCalls,
              });

              toolExecRes.results.forEach((r: any) => {
                messagesPayload.push(r);
              });

              setMessages((prev) => {
                if (prev.length === 0) return prev;
                const copy = [...prev];
                const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
                if (idx !== -1) {
                  const steps = copy[idx].thinkingSteps || [];
                  copy[idx].thinkingSteps = steps.map((s) => {
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
                        status: isError ? ("failed" as const) : ("success" as const),
                        resultContent: parsedResults,
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
                finalAssistantContent = finalAssistantContent
                  .replace(/<Sources[\s\S]*?\/>/gi, "")
                  .trim();
                finalAssistantContent += `\n\n${tags.sources_tag}`;
              }

              setMessages((prev) => {
                if (prev.length === 0) return prev;
                const copy = [...prev];
                const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
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
            const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
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
            const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
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
          thinkingSteps: [],
        };
      }
      return copy;
    });

    await resubmitUserMessage(precedingUserMsg.id);
  };

  const handleAssistantFeedback = async (
    messageId: string,
    feedbackType: "thumbs_up" | "thumbs_down",
    commentsValue?: string
  ) => {
    try {
      await logMessageFeedback(currentSessionId!, messageId, feedbackType, commentsValue);
    } catch (e) {
      console.error("Failed to log message feedback:", e);
    }
  };

  return {
    handleStopGeneration,
    handleSendMessage,
    resubmitUserMessage,
    handleUserMessageEdit,
    handleAssistantRetry,
    handleAssistantFeedback,
  };
}
