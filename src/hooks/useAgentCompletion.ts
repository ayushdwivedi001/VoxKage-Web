"use client";

import React from "react";
import { Message, computeSessionFiles } from "@/lib/chatHelpers";
import { Attachment } from "@/components/MessageAttachmentsRow";
import { getStoredBuildMode, setStoredBuildMode } from "@/lib/buildModeStore";
import {
  createSession,
  adoptDraftFiles,
  prepareSessionPayload,
  executeBackendTools,
  logAssistantResponse,
  editSessionMessage,
  logMessageFeedback,
  compactSession,
  BACKEND_URL,
} from "@/lib/api";

// Session-level tool definitions cache to avoid re-fetching on every message
export const sessionToolsCache: Record<string, any[]> = {};
export let cachedSoulContext = "";
export let cachedMcpInfo = "";

export function clearToolsCache() {
  for (const k in sessionToolsCache) {
    delete sessionToolsCache[k];
  }
  cachedSoulContext = "";
  cachedMcpInfo = "";
  console.log("[Tools Cache] Cleared all session cached tools.");
}

function formatToolCallLabel(tc: any): string {
  const name = tc.function?.name || "";
  const argsStr = tc.function?.arguments || "{}";
  let args: any = {};
  try {
    args = JSON.parse(argsStr);
  } catch (e) {}

  if (name === "web_search" || name === "web_search_deep") {
    return `Search: '${args.query || ""}'`;
  } else if (name === "web_fetch") {
    return `Fetch URL: ${args.url || ""}`;
  } else if (name === "web_search_parallel") {
    return `Parallel Search: ${args.queries && args.queries.length > 0 ? args.queries.join(", ") : ""}`;
  } else if (name === "web_fetch_parallel") {
    return `Parallel Fetch: ${args.urls && args.urls.length > 0 ? args.urls.length + " resources" : ""}`;
  } else if (name === "show_map") {
    return `Show Map: '${args.label || "Coordinate Location"}'`;
  } else if (name === "get_weather") {
    const loc = args.latitude !== undefined ? `${args.latitude}, ${args.longitude}` : "Current Geolocation";
    return `Get Weather: '${loc}'`;
  } else if (name === "get_images") {
    return `Search Images: '${args.query || ""}'`;
  } else if (name === "laptop_command") {
    return `Laptop Cmd: ${args.command || ""}`;
  } else if (name === "open_application") {
    return `Open App: ${args.app_name || ""}`;
  } else if (name === "close_application") {
    return `Close App: ${args.app_name || ""}`;
  } else if (name === "remember_user") {
    return `Remember Fact: ${args.key || ""}`;
  } else if (name === "recall_user") {
    return "Recall Fact";
  } else if (name === "forget_user") {
    return `Forget Fact: ${args.key || ""}`;
  } else if (name === "query_rag") {
    return `RAG Query: '${args.query || ""}'`;
  } else if (name === "list_indexed_documents") {
    return "List RAG Docs";
  } else if (name === "delete_indexed_document") {
    return "Delete RAG Doc";
  } else if (name === "index_document") {
    return `Indexing ${args.original_name || args.filename || ""}...`;
  } else if (name.includes("__")) {
    const parts = name.split("__");
    const provider = parts[0];
    const mcpTool = parts.slice(1).join("__");
    const formattedProvider = provider.charAt(0).toUpperCase() + provider.slice(1);
    const formattedTool = mcpTool.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    return `[${formattedProvider} MCP] ${formattedTool}`;
  } else {
    return name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  }
}

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
  loginEmail: string;
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
  loginEmail,
}: UseAgentCompletionProps) {
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [buildMode, _setBuildModeState] = React.useState<"Work" | "Plan">(getStoredBuildMode);
  // Ref mirrors buildMode state so streaming closures always read the live value (no stale closure)
  const buildModeRef = React.useRef<"Work" | "Plan">(buildMode);

  React.useEffect(() => {
    buildModeRef.current = buildMode;
  }, [buildMode]);

  // Listen for global build mode changes (e.g. from dropdowns across unmounted/remounted UI)
  React.useEffect(() => {
    const handleGlobalChange = (e: any) => {
      const mode = e.detail || getStoredBuildMode();
      buildModeRef.current = mode;
      _setBuildModeState(mode);
    };
    window.addEventListener("voxkage_build_mode_change", handleGlobalChange);
    return () => window.removeEventListener("voxkage_build_mode_change", handleGlobalChange);
  }, []);

  const setBuildMode = React.useCallback((mode: "Work" | "Plan") => {
    buildModeRef.current = mode;
    _setBuildModeState(mode);
    setStoredBuildMode(mode);
    try {
      const token = localStorage.getItem("voxkage_jwt_token");
      const apiBase = BACKEND_URL;
      if (token) {
        fetch(`${apiBase}/user/settings-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ build_mode: mode })
        }).catch((err) => console.error("Failed to sync build_mode:", err));
      }
    } catch (err) {
      console.warn("build_mode sync error:", err);
    }
  }, []);
  const [activeTasks, setActiveTasks] = React.useState<any[]>([]);
  // Store real Word doc_state objects keyed by filename (e.g. "doc.docx" -> JSON string)
  const [wordArtifacts, setWordArtifacts] = React.useState<Map<string, string>>(new Map());

  const resolveModelInfo = (name: string): { modelId: string; provider: "kilo" | "opencode"; originalName: string } => {
    const clean = (name || "").trim();
    if (!clean) return { modelId: "deepseek-v4-flash-free", provider: "opencode", originalName: "DeepSeek V4 Flash" };

    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("voxkage_cached_models");
        if (cached) {
          const list = JSON.parse(cached);
          const match = list.find((m: any) => m.name === clean || m.api_key === clean);
          if (match) {
            const isK = match.provider === "kilo" || (match.api_key && match.api_key.includes("/"));
            return {
              modelId: match.api_key || match.name,
              provider: isK ? "kilo" : "opencode",
              originalName: clean,
            };
          }
        }
      } catch (e) {}
    }

    const lower = clean.toLowerCase();
    if (clean.includes("/") || lower.includes("kilo")) {
      return { modelId: clean, provider: "kilo", originalName: clean };
    }
    if (lower.includes("gemini")) return { modelId: "gemini-3.5-flash", provider: "opencode", originalName: clean };
    if (lower.includes("claude") || lower.includes("sonnet")) return { modelId: "claude-sonnet-4", provider: "opencode", originalName: clean };
    if (lower.includes("mimo")) return { modelId: "mimo-v2.5-free", provider: "opencode", originalName: clean };
    if (lower.includes("deepseek")) return { modelId: "deepseek-v4-flash-free", provider: "opencode", originalName: clean };

    return { modelId: clean, provider: "opencode", originalName: clean };
  };

  const getFallbackModel = (targetProvider: "kilo" | "opencode", currentModel: string): string => {
    const lower = (currentModel || "").toLowerCase();
    if (targetProvider === "kilo") {
      if (lower.includes("gemini")) return "google/gemini-2.0-flash";
      if (lower.includes("claude") || lower.includes("sonnet")) return "anthropic/claude-3.5-sonnet";
      if (lower.includes("mimo")) return "xiaomi/mimo-v2.5";
      return "deepseek/deepseek-chat";
    } else {
      if (lower.includes("gemini")) return "gemini-3.5-flash";
      if (lower.includes("claude") || lower.includes("sonnet")) return "claude-sonnet-4";
      if (lower.includes("mimo")) return "mimo-v2.5-free";
      return "deepseek-v4-flash-free";
    }
  };

  const modelNameToKey = (name: string): string => {
    return resolveModelInfo(name).modelId;
  };

  const handleStopGeneration = () => {
    setIsStreaming(false);
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
    setIsStreaming(true);
    hasVisitedRef.current = true;

    // BULLETPROOF: If the PromptInput tagged this as [PLAN MODE], force-sync the ref
    // so the streaming closure & backend payload always see the correct mode,
    // regardless of React state batching timing.
    if (text.startsWith("[PLAN MODE]")) {
      buildModeRef.current = "Plan";
      _setBuildModeState("Plan");
    }

    let sessionId = currentSessionId;
    let finalAttachments = [...attachments];

    // Build the user message content
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
      thinkingSteps: text.trim() === "/compact" ? [{ id: "step-compact-1", label: "Compacting session context...", status: "pending" }] : [],
    };

    // Transition UI instantly to chat screen
    setAttachments([]);
    setComments([]);
    setEditingFile(null);
    setIsChatActive(true);
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    // Handle /compact slash command interceptor directly
    if (text.trim() === "/compact") {
      const runCompaction = async (actualSessionId: string) => {
        try {
          const compRes = await compactSession(actualSessionId, modelNameToKey(selectedModel));
          setMessages((prev) => {
            const copy = [...prev];
            const idx = copy.findIndex((m) => m.id === assistantMsg.id);
            if (idx !== -1) {
              copy[idx].content = compRes.full_message || `\n[Chat history has been successfully compacted.]\n\n**Compaction Summary Brief:**\n${compRes.summary}\n`;
              copy[idx].status = "completed";
              copy[idx].thinkingSteps = [
                { id: "step-compact-1", label: "Compacting session context...", status: "success" }
              ];
              copy[idx].thinkingDuration = 1.2;
            }
            return copy;
          });
        } catch (compactErr: any) {
          console.error("Compaction failed:", compactErr);
          setMessages((prev) => {
            const copy = [...prev];
            const idx = copy.findIndex((m) => m.id === assistantMsg.id);
            if (idx !== -1) {
              copy[idx].content = `[Compaction Error: ${compactErr.message || "Failed to compact session history"}]`;
              copy[idx].status = "completed";
              copy[idx].thinkingSteps = [
                { id: "step-compact-1", label: "Compacting session context...", status: "failed" }
              ];
            }
            return copy;
          });
        }
      };

      if (!sessionId) {
        try {
          const newSess = await createSession("/compact");
          setCurrentSessionId(newSess.id);
          setChatTitle("/compact");
          setSessionsList((prev) => [newSess, ...prev]);
          runCompaction(newSess.id);
        } catch (err: any) {
          console.error("Failed to create session for compaction:", err);
        }
      } else {
        runCompaction(sessionId);
      }
      return;
    }

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

    // Now, run the actual request flow:
    const startAgentLoop = async (actualSessionId: string, finalAtts: any[]) => {
      let finalAssistantContent = "";
      let activeAssistantMsgId = assistantMsg.id;

      try {
        if (
          actualSessionId &&
          (!sessionToolsCache[actualSessionId] || sessionToolsCache[actualSessionId].length === 0) &&
          sessionToolsCache["__boot_tools__"] &&
          sessionToolsCache["__boot_tools__"].length > 0
        ) {
          sessionToolsCache[actualSessionId] = sessionToolsCache["__boot_tools__"];
        }

        const hasToolsCached = !!(actualSessionId && sessionToolsCache[actualSessionId] && sessionToolsCache[actualSessionId].length > 0);

        const initialInfo = resolveModelInfo(selectedModel);

        const prepRes = await prepareSessionPayload(
          actualSessionId,
          promptText,
          finalAtts,
          initialInfo.modelId,
          selectedVariant,
          hasToolsCached,
          buildModeRef.current === "Plan"
        );

        let messagesPayload = prepRes.messages;
        let activeModelId = prepRes.model || initialInfo.modelId;
        const variantOverrides = prepRes.variant_overrides;

        let tools = prepRes.tools;
        if (hasToolsCached) {
          tools = sessionToolsCache[actualSessionId];
        } else if (prepRes.tools) {
          sessionToolsCache[actualSessionId] = prepRes.tools;
        }

        const { secureLoadKey } = await import("@/lib/secureStorage");
        const emailKey = loginEmail.trim().toLowerCase();
        const opencodeKey = await secureLoadKey(`voxkage_${emailKey}_opencode_api_key`);
        const kiloKey = await secureLoadKey(`voxkage_${emailKey}_kilo_api_key`);

        let activeProvider: "kilo" | "opencode" = initialInfo.provider;
        let activeKey = activeProvider === "kilo" ? (kiloKey || opencodeKey) : (opencodeKey || kiloKey);

        if (!activeKey) {
          throw new Error("No API Key found. Please configure your OpenCode or Kilo API key in Settings.");
        }

        if (activeProvider === "kilo" && !kiloKey && opencodeKey) {
          activeProvider = "opencode";
          activeModelId = getFallbackModel("opencode", activeModelId);
        } else if (activeProvider === "opencode" && !opencodeKey && kiloKey) {
          activeProvider = "kilo";
          activeModelId = getFallbackModel("kilo", activeModelId);
        }

        const customProxyUrl = localStorage.getItem("voxkage_custom_proxy_url") || "";
        let targetUrl = "/api/completions/proxy";
        if (customProxyUrl && customProxyUrl.trim() !== "" && activeProvider === "opencode") {
          targetUrl = `${customProxyUrl.trim()}/zen/v1/chat/completions`;
        }

        let loopCount = 0;
        const maxLoop = 12;
        const accumulatedCreatedFiles: Record<string, string> = {};
        const controller = new AbortController();
        abortControllerRef.current = controller;
        let hasSwitchedProviderOnRateLimit = false;

        while (loopCount < maxLoop) {
          loopCount++;

          const body: any = {
            model: activeModelId,
            messages: messagesPayload,
            stream: true,
            ...variantOverrides,
          };

          const isAgentic = (selectedVariant || "High").toUpperCase() in { HIGH: 1, XHIGH: 1, MAX: 1 };
          if (isAgentic && tools && tools.length > 0) {
            body.tools = tools;
            body.tool_choice = "auto";
          }

          let res: Response | null = null;
          let lastFetchError: any = null;

          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              res = await fetch(targetUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${activeKey}`,
                  "x-provider": activeProvider,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
              });

              if (res.ok) {
                lastFetchError = null;
                break;
              } else {
                const status = res.status;
                const errText = await res.text();

                // Check for 429 rate limit to trigger seamless fallback
                const isRateLimit = status === 429 || errText.includes("429") || errText.includes("Rate limit") || errText.includes("FreeUsageLimitError");
                if (isRateLimit && !hasSwitchedProviderOnRateLimit) {
                  if (activeProvider === "opencode" && kiloKey) {
                    console.warn(`[Fallback] OpenCode rate limit (HTTP ${status}), switching to Kilo...`);
                    hasSwitchedProviderOnRateLimit = true;
                    activeProvider = "kilo";
                    activeKey = kiloKey;
                    activeModelId = getFallbackModel("kilo", activeModelId);
                    targetUrl = "/api/completions/proxy";
                    body.model = activeModelId;
                    continue;
                  } else if (activeProvider === "kilo" && opencodeKey) {
                    console.warn(`[Fallback] Kilo rate limit (HTTP ${status}), switching to OpenCode...`);
                    hasSwitchedProviderOnRateLimit = true;
                    activeProvider = "opencode";
                    activeKey = opencodeKey;
                    activeModelId = getFallbackModel("opencode", activeModelId);
                    targetUrl = "/api/completions/proxy";
                    body.model = activeModelId;
                    continue;
                  }
                }

                lastFetchError = new Error(`Provider Error (HTTP ${status}): ${errText}`);
                console.warn(`Fetch attempt ${attempt} failed with status ${status}. Retrying...`);
              }
            } catch (fetchErr: any) {
              if (targetUrl !== "/api/completions/proxy") {
                console.warn("Custom proxy failed to fetch, trying local proxy fallback...");
                targetUrl = "/api/completions/proxy";
                attempt--; // retry fallback immediately
                continue;
              }
              lastFetchError = fetchErr;
              console.warn(`Fetch attempt ${attempt} threw exception. Retrying...`, fetchErr);
            }
            if (attempt < 3) {
              // Wait 2 seconds before next retry
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }

          if (lastFetchError || !res) {
            throw lastFetchError || new Error("Failed to get response after 3 attempts.");
          }

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Provider Error (HTTP ${res.status}): ${errText}`);
          }

          const reader = res.body?.getReader();
          if (!reader) throw new Error("Response body is not readable.");

          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          let currentContent = "";
          let currentReasoning = "";
          let currentToolCalls: any[] = [];
          let streamRateLimitHit = false;

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

                // Detect error payloads inside 200 SSE responses from proxy
                if (sseData.startsWith("Error") || sseData.includes('"error"')) {
                  try {
                    const parsedErr = JSON.parse(sseData.startsWith("Error") ? sseData.substring(sseData.indexOf("{")) : sseData);
                    const isRateLimit = parsedErr.error?.status === 429 || 
                      (parsedErr.error?.message && (parsedErr.error.message.includes("429") || parsedErr.error.message.includes("Rate limit") || parsedErr.error.message.includes("FreeUsageLimitError")));

                    if (isRateLimit && !hasSwitchedProviderOnRateLimit) {
                      if (activeProvider === "opencode" && kiloKey) {
                        console.warn("[Stream] OpenCode rate limit detected, switching to Kilo...");
                        hasSwitchedProviderOnRateLimit = true;
                        activeProvider = "kilo";
                        activeKey = kiloKey;
                        activeModelId = getFallbackModel("kilo", activeModelId);
                        targetUrl = "/api/completions/proxy";
                        streamRateLimitHit = true;
                        break;
                      } else if (activeProvider === "kilo" && opencodeKey) {
                        console.warn("[Stream] Kilo rate limit detected, switching to OpenCode...");
                        hasSwitchedProviderOnRateLimit = true;
                        activeProvider = "opencode";
                        activeKey = opencodeKey;
                        activeModelId = getFallbackModel("opencode", activeModelId);
                        targetUrl = "/api/completions/proxy";
                        streamRateLimitHit = true;
                        break;
                      }
                    }

                    const errMsg = parsedErr.error?.message || parsedErr.message || sseData;
                    throw new Error(`Provider Error: ${typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg)}`);
                  } catch (e: any) {
                    if (e.message?.startsWith("Provider Error:")) throw e;
                  }
                }

                try {
                  const dataJson = JSON.parse(sseData);
                  const choice = dataJson.choices?.[0];
                  if (!choice) continue;

                  const delta = choice.delta;

                  // Capture reasoning / thinking stream tokens
                  const reasoningPiece = delta?.reasoning_content || delta?.reasoning || delta?.thought || "";
                  if (reasoningPiece) {
                    currentReasoning += reasoningPiece;
                  }

                  if (delta?.content) {
                    currentContent += delta.content;
                    finalAssistantContent += delta.content;
                    setMessages((prev) => {
                      if (prev.length === 0) return prev;
                      const copy = [...prev];
                      const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
                      if (idx !== -1) {
                        const precedingUserMsg = copy[idx - 1];
                        const isPlanModeMessage = buildModeRef.current === "Plan" || 
                          (precedingUserMsg && precedingUserMsg.content && (precedingUserMsg.content.includes("[PLAN MODE]") || precedingUserMsg.content.includes("/plan")));

                        // Enforce mode check: ALWAYS render plan card if user is in Plan mode!
                        if (isPlanModeMessage) {
                          copy[idx].type = "plan";
                          const planMatch = finalAssistantContent.match(/<plan(?:\s+title=["']([^"']+)["'])?>([\s\S]*)/i);
                          if (planMatch) {
                            copy[idx].planTitle = planMatch[1] || "Implementation Plan";
                            copy[idx].content = planMatch[2].replace(/<\/plan>/g, "").trim();
                          } else {
                            // LLM omitted literal <plan> tags — extract first line/heading as title
                            const firstLine = finalAssistantContent.trim().split("\n")[0] || "";
                            const headingMatch = firstLine.match(/^(?:#+\s*|\*\*\s*)([^\*\n#]+)/);
                            copy[idx].planTitle = headingMatch ? headingMatch[1].trim() : "Implementation Plan";
                            copy[idx].content = finalAssistantContent.trim();
                          }
                        } else if (buildModeRef.current === "Work") {
                          // Work Mode: strip any accidental <plan> tags
                          let cleanContent = finalAssistantContent
                            .replace(/<plan(?:\s+title=["'][^"']+["'])?>/gi, "")
                            .replace(/<\/plan>/gi, "");
                          
                          // Check if Work mode response contains <task_list> tags to mount TaskListWidget
                          if (finalAssistantContent.includes("<task_list>")) {
                            const taskMatch = finalAssistantContent.match(/<task_list>([\s\S]*?)<\/task_list>/i);
                            if (taskMatch) {
                              const lines = taskMatch[1].split("\n");
                              const parsedTasks: any[] = [];
                              lines.forEach((line, tIdx) => {
                                const trimmed = line.trim();
                                if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]") || trimmed.startsWith("- [/]")) {
                                  const isDone = trimmed.startsWith("- [x]");
                                  const isInProg = trimmed.startsWith("- [/]");
                                  const taskText = trimmed.replace(/^-\s*\[[ x/\]]\s*/i, "").trim();
                                  if (taskText) {
                                    parsedTasks.push({
                                      id: `task-${tIdx}-${Date.now()}`,
                                      text: taskText,
                                      status: isDone ? "completed" : isInProg ? "in_progress" : tIdx === 0 ? "in_progress" : "pending",
                                    });
                                  }
                                }
                              });
                              if (parsedTasks.length > 0) {
                                setActiveTasks(parsedTasks);
                              }
                              // Hide raw <task_list> XML tag from response bubble text
                              cleanContent = cleanContent.replace(/<task_list>[\s\S]*?<\/task_list>/gi, "").trim();
                            }
                          }

                          copy[idx].content = cleanContent;
                        }
                        copy[idx].status = "streaming";
                      }
                      return copy;
                    });
                  }

                  if (delta?.tool_calls) {
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
            if (streamRateLimitHit) break;
          }

          if (streamRateLimitHit) {
            // Rate limit triggered during SSE stream; retry outer loop with switched provider
            continue;
          }

          // Fallback: If no content was streamed but model produced reasoning or stopped, ensure response is not empty
          if (!finalAssistantContent.trim() && currentReasoning.trim() && currentToolCalls.length === 0) {
            finalAssistantContent = currentReasoning.trim();
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

          if (currentToolCalls.length > 0) {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const copy = [...prev];
              const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
              if (idx !== -1) {
                const steps = copy[idx].thinkingSteps || [];
                const newSteps = [...steps];
                currentToolCalls.forEach((tc) => {
                  newSteps.push({
                    id: tc.id,
                    label: formatToolCallLabel(tc),
                    status: "pending",
                  });
                });
                copy[idx].thinkingSteps = newSteps;
                copy[idx].status = "thinking";
              }
              return copy;
            });

            const toolExecRes = await executeBackendTools(actualSessionId, currentToolCalls);

            // Advance active task list progress in real-time as tools complete
            setActiveTasks((prevTasks) => {
              if (!prevTasks || prevTasks.length === 0) return prevTasks;
              const inProgIdx = prevTasks.findIndex((t) => t.status === "in_progress");
              if (inProgIdx !== -1) {
                const copy = [...prevTasks];
                copy[inProgIdx] = { ...copy[inProgIdx], status: "completed" };
                if (inProgIdx + 1 < copy.length) {
                  copy[inProgIdx + 1] = { ...copy[inProgIdx + 1], status: "in_progress" };
                }
                if (copy.every((t) => t.status === "completed")) {
                  setTimeout(() => setActiveTasks([]), 2000);
                }
                return copy;
              }
              return prevTasks;
            });

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
            if (tags.timeline_tag) finalAssistantContent += `\n\n${tags.timeline_tag}`;
            if (tags.sources_tag) {
              finalAssistantContent = finalAssistantContent
                .replace(/<Sources[\s\S]*?\/>/gi, "")
                .trim();
              finalAssistantContent += `\n\n${tags.sources_tag}`;
            }

            // Inject created code files as fenced blocks so extractFilesFromContent picks them up
            const createdFiles = toolExecRes.created_files;
            if (createdFiles && typeof createdFiles === "object") {
              Object.assign(accumulatedCreatedFiles, createdFiles);
              for (const [fname, fcode] of Object.entries(createdFiles)) {
                if (!fname || !fcode) continue;
                const ext = fname.includes(".") ? fname.split(".").pop()!.toLowerCase() : "txt";
                const langTag = ext === "html" ? "html" : ext === "css" ? "css" : ext === "py" ? "python" : ["js","jsx"].includes(ext) ? "javascript" : ["ts","tsx"].includes(ext) ? "typescript" : ext;
                // Only inject if not already present in content
                if (!finalAssistantContent.includes(`\`\`\`${langTag} ${fname}`)) {
                  finalAssistantContent += `\n\n\`\`\`${langTag} ${fname}\n${fcode}\n\`\`\``;
                }
              }
            }

            // Extract Word artifacts from tool results so preview shows real content
            // Also embed as fenced block in finalAssistantContent so it persists to Supabase (mirrors code file persistence)
            toolExecRes.results.forEach((r: any) => {
              try {
                const parsed = JSON.parse(r.content || "{}");
                if (parsed.artifact && parsed.artifact.type === "word" && parsed.artifact.name && parsed.artifact.content) {
                  const artName = parsed.artifact.name as string;
                  const artContent = parsed.artifact.content as string;
                  // 1. Update live RAM preview
                  setWordArtifacts((prev) => {
                    const next = new Map(prev);
                    next.set(artName, artContent);
                    return next;
                  });
                  // 2. Embed as fenced block so logAssistantResponse saves it to Supabase
                  const wordBlock = `\n\n\`\`\`word ${artName}\n${artContent}\n\`\`\``;
                  if (!finalAssistantContent.includes(`\`\`\`word ${artName}`)) {
                    finalAssistantContent += wordBlock;
                  } else {
                    // Replace existing block with latest content
                    finalAssistantContent = finalAssistantContent.replace(
                      new RegExp(`\`\`\`word ${artName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?\`\`\``, "g"),
                      `\`\`\`word ${artName}\n${artContent}\n\`\`\``
                    );
                  }
                }
              } catch (_) {}
            });

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

        logAssistantResponse(actualSessionId, finalAssistantContent, accumulatedCreatedFiles).catch((err) =>
          console.error("Failed to log assistant response:", err)
        );

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
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const copy = [...prev];
          const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
          if (idx !== -1) {
            copy[idx].content = `[System Error: ${err.message}]`;
            copy[idx].status = "completed";
          }
          return copy;
        });
      } finally {
        abortControllerRef.current = null;
      }
    };

    // Database session creation wrapper (if needed)
    if (!sessionId) {
      try {
        const words = text.trim().split(" ");
        const defaultName = words.slice(0, 4).join(" ") + (words.length > 4 ? "..." : "");
        
        // Start session creation in the background
        createSession(defaultName).then(async (newSess) => {
          const realSessionId = newSess.id;
          setCurrentSessionId(realSessionId);
          setChatTitle(defaultName);
          setSessionsList((prev) => [newSess, ...prev]);

          // Adopt draft files if they were uploaded
          const activeDraftId = draftSessionId;
          if (activeDraftId) {
            try {
              await adoptDraftFiles(realSessionId, activeDraftId);
              finalAttachments = finalAttachments.map((att) => ({
                ...att,
                url: att.url.replace(activeDraftId, realSessionId),
              }));
              setDraftSessionId(null);
            } catch (adoptErr) {
              console.error("Failed to adopt draft files:", adoptErr);
            }
          }

          // Start loop
          startAgentLoop(realSessionId, finalAttachments);
        }).catch((e) => {
          console.error("Failed to create session on message send", e);
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const idx = copy.findIndex((m) => m.id === assistantMsg.id);
            if (idx !== -1) {
              copy[idx].content = `[System Error: Failed to create database session]`;
              copy[idx].status = "completed";
            }
            return copy;
          });
        });
      } catch (e) {
        console.error("Outer session creation failure:", e);
      }
    } else {
      // Session already exists, run immediately
      startAgentLoop(sessionId, finalAttachments);
    }
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

          if (
            currentSessionId &&
            (!sessionToolsCache[currentSessionId] || sessionToolsCache[currentSessionId].length === 0) &&
            sessionToolsCache["__boot_tools__"] &&
            sessionToolsCache["__boot_tools__"].length > 0
          ) {
            sessionToolsCache[currentSessionId] = sessionToolsCache["__boot_tools__"];
          }

          const hasToolsCached = !!(currentSessionId && sessionToolsCache[currentSessionId] && sessionToolsCache[currentSessionId].length > 0);

          const initialInfo = resolveModelInfo(selectedModel);

          const prepRes = await prepareSessionPayload(
            currentSessionId!,
            newText,
            finalAttachments,
            initialInfo.modelId,
            selectedVariant,
            hasToolsCached
          );

          let messagesPayload = prepRes.messages;
          let activeModelId = prepRes.model || initialInfo.modelId;
          const variantOverrides = prepRes.variant_overrides;

          let tools = prepRes.tools;
          if (hasToolsCached) {
            tools = sessionToolsCache[currentSessionId!];
          } else if (prepRes.tools) {
            sessionToolsCache[currentSessionId!] = prepRes.tools;
          }

          const { secureLoadKey } = await import("@/lib/secureStorage");
          const emailKey = loginEmail.trim().toLowerCase();
          const opencodeKey = await secureLoadKey(`voxkage_${emailKey}_opencode_api_key`);
          const kiloKey = await secureLoadKey(`voxkage_${emailKey}_kilo_api_key`);

          let activeProvider: "kilo" | "opencode" = initialInfo.provider;
          let activeKey = activeProvider === "kilo" ? (kiloKey || opencodeKey) : (opencodeKey || kiloKey);

          if (!activeKey) {
            throw new Error("No API Key found. Please configure your OpenCode or Kilo API key in Settings.");
          }

          if (activeProvider === "kilo" && !kiloKey && opencodeKey) {
            activeProvider = "opencode";
            activeModelId = getFallbackModel("opencode", activeModelId);
          } else if (activeProvider === "opencode" && !opencodeKey && kiloKey) {
            activeProvider = "kilo";
            activeModelId = getFallbackModel("kilo", activeModelId);
          }

          const customProxyUrl = localStorage.getItem("voxkage_custom_proxy_url") || "";
          let targetUrl = "/api/completions/proxy";
          if (customProxyUrl && customProxyUrl.trim() !== "" && activeProvider === "opencode") {
            targetUrl = `${customProxyUrl.trim()}/zen/v1/chat/completions`;
          }

          let loopCount = 0;
          const maxLoop = 12;
          const accumulatedCreatedFiles: Record<string, string> = {};
          const controller = new AbortController();
          abortControllerRef.current = controller;
          let hasSwitchedProviderOnRateLimit = false;

          while (loopCount < maxLoop) {
            loopCount++;

            const body: any = {
              model: activeModelId,
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

            let res: Response | null = null;
            let lastFetchError: any = null;

            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                res = await fetch(targetUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${activeKey}`,
                    "x-provider": activeProvider,
                  },
                  body: JSON.stringify(body),
                  signal: controller.signal,
                });

                if (res.ok) {
                  lastFetchError = null;
                  break;
                } else {
                  const status = res.status;
                  const errText = await res.text();

                  const isRateLimit = status === 429 || errText.includes("429") || errText.includes("Rate limit") || errText.includes("FreeUsageLimitError");
                  if (isRateLimit && !hasSwitchedProviderOnRateLimit) {
                    if (activeProvider === "opencode" && kiloKey) {
                      console.warn(`[Fallback] OpenCode rate limit (HTTP ${status}), switching to Kilo...`);
                      hasSwitchedProviderOnRateLimit = true;
                      activeProvider = "kilo";
                      activeKey = kiloKey;
                      activeModelId = getFallbackModel("kilo", activeModelId);
                      targetUrl = "/api/completions/proxy";
                      body.model = activeModelId;
                      continue;
                    } else if (activeProvider === "kilo" && opencodeKey) {
                      console.warn(`[Fallback] Kilo rate limit (HTTP ${status}), switching to OpenCode...`);
                      hasSwitchedProviderOnRateLimit = true;
                      activeProvider = "opencode";
                      activeKey = opencodeKey;
                      activeModelId = getFallbackModel("opencode", activeModelId);
                      targetUrl = "/api/completions/proxy";
                      body.model = activeModelId;
                      continue;
                    }
                  }

                  lastFetchError = new Error(`Provider Error (HTTP ${status}): ${errText}`);
                  console.warn(`Completion loop fetch attempt ${attempt} failed with status ${status}. Retrying...`);
                }
              } catch (fetchErr: any) {
                if (targetUrl !== "/api/completions/proxy") {
                  console.warn("Custom proxy failed to fetch, trying local proxy fallback...");
                  targetUrl = "/api/completions/proxy";
                  attempt--; // retry fallback immediately
                  continue;
                }
                lastFetchError = fetchErr;
                console.warn(`Completion loop fetch attempt ${attempt} threw exception. Retrying...`, fetchErr);
              }
              if (attempt < 3) {
                // Wait 2 seconds before next retry
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }
            }

            if (lastFetchError || !res) {
              throw lastFetchError || new Error("Failed to get response after 3 attempts.");
            }

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Provider Error (HTTP ${res.status}): ${errText}`);
            }

            const reader = res.body?.getReader();
            if (!reader) {
              throw new Error("Failed to get response stream reader.");
            }

            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let currentToolCalls: any[] = [];
            let currentContent = "";
            let currentReasoning = "";
            let streamRateLimitHit = false;

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

                  // Detect error payloads inside 200 SSE responses from proxy
                  if (sseData.startsWith("Error") || sseData.includes('"error"')) {
                    try {
                      const parsedErr = JSON.parse(sseData.startsWith("Error") ? sseData.substring(sseData.indexOf("{")) : sseData);
                      const isRateLimit = parsedErr.error?.status === 429 || 
                        (parsedErr.error?.message && (parsedErr.error.message.includes("429") || parsedErr.error.message.includes("Rate limit") || parsedErr.error.message.includes("FreeUsageLimitError")));

                      if (isRateLimit && !hasSwitchedProviderOnRateLimit) {
                        if (activeProvider === "opencode" && kiloKey) {
                          console.warn("[Stream] OpenCode rate limit detected, switching to Kilo...");
                          hasSwitchedProviderOnRateLimit = true;
                          activeProvider = "kilo";
                          activeKey = kiloKey;
                          activeModelId = getFallbackModel("kilo", activeModelId);
                          targetUrl = "/api/completions/proxy";
                          streamRateLimitHit = true;
                          break;
                        } else if (activeProvider === "kilo" && opencodeKey) {
                          console.warn("[Stream] Kilo rate limit detected, switching to OpenCode...");
                          hasSwitchedProviderOnRateLimit = true;
                          activeProvider = "opencode";
                          activeKey = opencodeKey;
                          activeModelId = getFallbackModel("opencode", activeModelId);
                          targetUrl = "/api/completions/proxy";
                          streamRateLimitHit = true;
                          break;
                        }
                      }

                      const errMsg = parsedErr.error?.message || parsedErr.message || sseData;
                      throw new Error(`Provider Error: ${typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg)}`);
                    } catch (e: any) {
                      if (e.message?.startsWith("Provider Error:")) throw e;
                    }
                  }

                  try {
                    const parsed = JSON.parse(sseData);
                    const delta = parsed.choices?.[0]?.delta;
                    if (!delta) continue;

                    // Capture reasoning / thinking stream tokens
                    const reasoningPiece = delta?.reasoning_content || delta?.reasoning || delta?.thought || "";
                    if (reasoningPiece) {
                      currentReasoning += reasoningPiece;
                    }

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
              if (streamRateLimitHit) break;
            }

            if (streamRateLimitHit) {
              // Rate limit triggered during SSE stream; retry outer loop with switched provider
              continue;
            }

            // Fallback: If no content was streamed but model produced reasoning or stopped, ensure response is not empty
            if (!finalAssistantContent.trim() && currentReasoning.trim() && currentToolCalls.length === 0) {
              finalAssistantContent = currentReasoning.trim();
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

            if (currentToolCalls.length > 0) {
              setMessages((prev) => {
                if (prev.length === 0) return prev;
                const copy = [...prev];
                const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
                if (idx !== -1) {
                  const steps = copy[idx].thinkingSteps || [];
                  const newSteps = [...steps];
                   currentToolCalls.forEach((tc) => {
                     newSteps.push({
                       id: tc.id,
                       label: formatToolCallLabel(tc),
                       status: "pending",
                     });
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

              // Inject created code files as fenced blocks so extractFilesFromContent picks them up
              const createdFiles = toolExecRes.created_files;
              if (createdFiles && typeof createdFiles === "object") {
                Object.assign(accumulatedCreatedFiles, createdFiles);
                for (const [fname, fcode] of Object.entries(createdFiles)) {
                  if (!fname || !fcode) continue;
                  const ext = fname.includes(".") ? fname.split(".").pop()!.toLowerCase() : "txt";
                  const langTag = ext === "html" ? "html" : ext === "css" ? "css" : ext === "py" ? "python" : ["js","jsx"].includes(ext) ? "javascript" : ["ts","tsx"].includes(ext) ? "typescript" : ext;
                  if (!finalAssistantContent.includes(`\`\`\`${langTag} ${fname}`)) {
                    finalAssistantContent += `\n\n\`\`\`${langTag} ${fname}\n${fcode}\n\`\`\``;
                  }
                }
              }

              // Extract Word artifacts from tool results in resubmit path
              // Also embed as fenced block in finalAssistantContent so it persists to Supabase (mirrors code file persistence)
              toolExecRes.results.forEach((r: any) => {
                try {
                  const parsed = JSON.parse(r.content || "{}");
                  if (parsed.artifact && parsed.artifact.type === "word" && parsed.artifact.name && parsed.artifact.content) {
                    const artName = parsed.artifact.name as string;
                    const artContent = parsed.artifact.content as string;
                    // 1. Update live RAM preview
                    setWordArtifacts((prev) => {
                      const next = new Map(prev);
                      next.set(artName, artContent);
                      return next;
                    });
                    // 2. Embed as fenced block so logAssistantResponse saves it to Supabase
                    const wordBlock = `\n\n\`\`\`word ${artName}\n${artContent}\n\`\`\``;
                    if (!finalAssistantContent.includes(`\`\`\`word ${artName}`)) {
                      finalAssistantContent += wordBlock;
                    } else {
                      // Replace existing block with latest content
                      finalAssistantContent = finalAssistantContent.replace(
                        new RegExp(`\`\`\`word ${artName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?\`\`\``, "g"),
                        `\`\`\`word ${artName}\n${artContent}\n\`\`\``
                      );
                    }
                  }
                } catch (_) {}
              });

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

          logAssistantResponse(currentSessionId!, finalAssistantContent, accumulatedCreatedFiles).catch((err) =>
            console.error("Failed to log assistant response:", err)
          );

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
          let errMsg = err.message || String(err);
          if (errMsg.includes("<!DOCTYPE html>") || errMsg.includes("<html")) {
            errMsg = "FastAPI backend is restarting on Hugging Face. Please wait a few seconds and try again.";
          }
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const copy = [...prev];
            const idx = copy.findIndex((m) => m.id === activeAssistantMsgId);
            if (idx !== -1) {
              copy[idx].content = `[System Notification: ${errMsg}]`;
              copy[idx].status = "completed";
              const elapsed = (Date.now() - (copy[idx].thinkingStart || Date.now())) / 1000;
              copy[idx].thinkingDuration = Math.max(elapsed, 0.1);
            }
            return copy;
          });
        } finally {
          abortControllerRef.current = null;
          setIsStreaming(false);
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

  const handleProceedPlan = async (planTitle: string, comments: string[], rawTasks?: any[]) => {
    setBuildMode("Work");

    if (rawTasks && rawTasks.length > 0) {
      const initialTasks = rawTasks.map((t, idx) => ({
        id: `task-${idx}-${Date.now()}`,
        text: typeof t === "string" ? t : t.text || t.title || `Task ${idx + 1}`,
        status: idx === 0 ? ("in_progress" as const) : ("pending" as const),
      }));
      setActiveTasks(initialTasks);
    }

    let proceedMsg = `[PROCEED: ${planTitle}]`;
    if (comments && comments.length > 0) {
      const commentBlock = comments.map((c, i) => `${i + 1}. ${c}`).join("\n");
      proceedMsg += `\n\nUser comments on the plan:\n${commentBlock}`;
    }

    await handleSendMessage(proceedMsg);
  };

  return {
    isStreaming,
    wordArtifacts,
    buildMode,
    setBuildMode,
    activeTasks,
    setActiveTasks,
    handleProceedPlan,
    handleStopGeneration,
    handleSendMessage,
    resubmitUserMessage,
    handleUserMessageEdit,
    handleAssistantRetry,
    handleAssistantFeedback,
  };
}
