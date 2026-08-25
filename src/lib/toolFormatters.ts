/**
 * Utility for formatting and parsing tool calls and MCP server operations into clean,
 * professional human-readable labels and structured metadata for interactive UI logs.
 */

export interface FormattedToolStep {
  id: string;
  label: string;
  shortLabel: string;
  status: "pending" | "success" | "failed";
  type: "thought" | "search" | "fetch" | "mcp" | "code" | "system" | "tool";
  provider?: string;
  toolName?: string;
  args: Record<string, any>;
  items?: Array<{
    title?: string;
    url?: string;
    query?: string;
    domain?: string;
    snippet?: string;
  }>;
  resultContent?: any;
}

export function extractDomain(url?: string): string {
  if (!url) return "";
  try {
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/:]+)/i);
    return match ? match[1] : url;
  } catch {
    return url;
  }
}

export function getFaviconUrl(domain: string): string {
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
}

export function formatToolStep(tc: any): FormattedToolStep {
  const rawName = tc.function?.name || tc.name || "";
  const argsStr = tc.function?.arguments || (typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments || {}));
  let args: Record<string, any> = {};
  try {
    args = typeof argsStr === "string" ? JSON.parse(argsStr) : argsStr || {};
  } catch {
    args = {};
  }

  const stepId = tc.id || `tc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanName = rawName.toLowerCase();

  // ── 1. Web Search & Parallel Searches ──────────────────────────────────
  if (cleanName === "web_search" || cleanName === "web_search_deep" || cleanName === "search_web") {
    const query = args.query || args.q || "";
    const shortQuery = query.length > 50 ? query.substring(0, 47) + "..." : query;
    return {
      id: stepId,
      label: query ? `Searching web for "${shortQuery}"` : "Searching the web",
      shortLabel: "Searching web...",
      status: "pending",
      type: "search",
      provider: "Web Search",
      toolName: rawName,
      args,
      items: query ? [{ query }] : [],
    };
  }

  if (cleanName === "web_search_parallel" || cleanName === "parallel_web_search") {
    const queries: string[] = Array.isArray(args.queries) ? args.queries : [];
    const count = queries.length;
    return {
      id: stepId,
      label: count > 0 ? `Searching web (${count} queries)` : "Performing parallel web searches",
      shortLabel: count > 0 ? `Searching web (${count} queries)...` : "Searching web...",
      status: "pending",
      type: "search",
      provider: "Web Search",
      toolName: rawName,
      args,
      items: queries.map((q) => ({ query: q })),
    };
  }

  // ── 2. Web Fetch & Parallel Fetch ──────────────────────────────────────
  if (cleanName === "web_fetch" || cleanName === "fetch_url") {
    const url = args.url || "";
    const domain = extractDomain(url);
    return {
      id: stepId,
      label: domain ? `Reading page: ${domain}` : "Fetching web resource",
      shortLabel: domain ? `Reading ${domain}...` : "Reading page...",
      status: "pending",
      type: "fetch",
      provider: "Web Fetch",
      toolName: rawName,
      args,
      items: url ? [{ url, domain, title: domain }] : [],
    };
  }

  if (cleanName === "web_fetch_parallel" || cleanName === "parallel_web_fetch") {
    const urls: string[] = Array.isArray(args.urls) ? args.urls : [];
    const count = urls.length;
    return {
      id: stepId,
      label: count > 0 ? `Fetching ${count} web pages in parallel` : "Fetching web pages",
      shortLabel: count > 0 ? `Fetching ${count} pages...` : "Fetching pages...",
      status: "pending",
      type: "fetch",
      provider: "Web Fetch",
      toolName: rawName,
      args,
      items: urls.map((u) => ({ url: u, domain: extractDomain(u), title: extractDomain(u) })),
    };
  }

  // ── 3. Gmail / Email MCP ───────────────────────────────────────────────
  if (cleanName.includes("gmail") || cleanName.includes("email")) {
    if (cleanName.includes("send")) {
      const recipient = args.to || args.recipient || "";
      return {
        id: stepId,
        label: recipient ? `Drafting & sending email to ${recipient}` : "Sending email via Gmail",
        shortLabel: "Sending email via Gmail...",
        status: "pending",
        type: "mcp",
        provider: "Gmail",
        toolName: rawName,
        args,
      };
    }
    if (cleanName.includes("draft") || cleanName.includes("save_draft")) {
      return {
        id: stepId,
        label: "Saving email draft in Gmail",
        shortLabel: "Saving email draft...",
        status: "pending",
        type: "mcp",
        provider: "Gmail",
        toolName: rawName,
        args,
      };
    }
    if (cleanName.includes("check") || cleanName.includes("inbox") || cleanName.includes("list")) {
      return {
        id: stepId,
        label: "Checking Gmail inbox",
        shortLabel: "Checking Gmail...",
        status: "pending",
        type: "mcp",
        provider: "Gmail",
        toolName: rawName,
        args,
      };
    }
    if (cleanName.includes("read")) {
      return {
        id: stepId,
        label: "Reading email message in Gmail",
        shortLabel: "Reading email...",
        status: "pending",
        type: "mcp",
        provider: "Gmail",
        toolName: rawName,
        args,
      };
    }
    return {
      id: stepId,
      label: "Using Gmail MCP tool",
      shortLabel: "Using Gmail...",
      status: "pending",
      type: "mcp",
      provider: "Gmail",
      toolName: rawName,
      args,
    };
  }

  // ── 4. Google Drive MCP ───────────────────────────────────────────────
  if (cleanName.includes("google_drive") || cleanName.includes("drive")) {
    if (cleanName.includes("search") || cleanName.includes("find")) {
      const q = args.query || args.name || "";
      return {
        id: stepId,
        label: q ? `Searching Google Drive for "${q}"` : "Searching files in Google Drive",
        shortLabel: "Searching Google Drive...",
        status: "pending",
        type: "mcp",
        provider: "Google Drive",
        toolName: rawName,
        args,
      };
    }
    if (cleanName.includes("read") || cleanName.includes("get")) {
      return {
        id: stepId,
        label: "Reading document from Google Drive",
        shortLabel: "Accessing Google Drive...",
        status: "pending",
        type: "mcp",
        provider: "Google Drive",
        toolName: rawName,
        args,
      };
    }
    if (cleanName.includes("upload") || cleanName.includes("create")) {
      return {
        id: stepId,
        label: "Uploading document to Google Drive",
        shortLabel: "Uploading to Google Drive...",
        status: "pending",
        type: "mcp",
        provider: "Google Drive",
        toolName: rawName,
        args,
      };
    }
    return {
      id: stepId,
      label: "Using Google Drive tool",
      shortLabel: "Using Google Drive...",
      status: "pending",
      type: "mcp",
      provider: "Google Drive",
      toolName: rawName,
      args,
    };
  }

  // ── 5. Google Calendar MCP ─────────────────────────────────────────────
  if (cleanName.includes("google_calendar") || cleanName.includes("calendar")) {
    if (cleanName.includes("list") || cleanName.includes("check") || cleanName.includes("events")) {
      return {
        id: stepId,
        label: "Checking Google Calendar events",
        shortLabel: "Checking Calendar...",
        status: "pending",
        type: "mcp",
        provider: "Google Calendar",
        toolName: rawName,
        args,
      };
    }
    if (cleanName.includes("create") || cleanName.includes("add") || cleanName.includes("schedule")) {
      const title = args.title || args.summary || args.name || "";
      return {
        id: stepId,
        label: title ? `Scheduling event in Google Calendar: "${title}"` : "Scheduling event in Google Calendar",
        shortLabel: "Scheduling calendar event...",
        status: "pending",
        type: "mcp",
        provider: "Google Calendar",
        toolName: rawName,
        args,
      };
    }
    return {
      id: stepId,
      label: "Using Google Calendar tool",
      shortLabel: "Using Calendar...",
      status: "pending",
      type: "mcp",
      provider: "Google Calendar",
      toolName: rawName,
      args,
    };
  }

  // ── 6. Microsoft Word MCP ──────────────────────────────────────────────
  if (cleanName.includes("word") || cleanName.includes("docx")) {
    const filename = args.filename || args.title || "document.docx";
    return {
      id: stepId,
      label: `Formatting document in Word (${filename})`,
      shortLabel: `Writing Word document...`,
      status: "pending",
      type: "mcp",
      provider: "Microsoft Word",
      toolName: rawName,
      args,
    };
  }

  // ── 7. RAG & Knowledge Retrieval ───────────────────────────────────────
  if (cleanName === "query_rag") {
    const q = args.query || "";
    return {
      id: stepId,
      label: q ? `Querying semantic RAG memory for "${q}"` : "Querying RAG index",
      shortLabel: "Querying RAG index...",
      status: "pending",
      type: "mcp",
      provider: "RAG Memory",
      toolName: rawName,
      args,
    };
  }

  if (cleanName === "index_document" || cleanName === "index_directory") {
    const doc = args.original_name || args.filename || args.path || "workspace";
    return {
      id: stepId,
      label: `Indexing document into semantic RAG (${doc})`,
      shortLabel: `Indexing ${doc}...`,
      status: "pending",
      type: "mcp",
      provider: "RAG Memory",
      toolName: rawName,
      args,
    };
  }

  // ── 8. System & OS Control ─────────────────────────────────────────────
  if (cleanName === "run_shell_command" || cleanName === "system_control" || cleanName === "laptop_command") {
    const cmd = args.command || args.cmd || "";
    const shortCmd = cmd.length > 40 ? cmd.substring(0, 37) + "..." : cmd;
    return {
      id: stepId,
      label: cmd ? `Executing system shell: ${shortCmd}` : "Executing shell command",
      shortLabel: "Executing shell command...",
      status: "pending",
      type: "system",
      provider: "OS Control",
      toolName: rawName,
      args,
    };
  }

  if (cleanName === "get_system_info" || cleanName === "health_check" || cleanName === "get_system_uptime") {
    return {
      id: stepId,
      label: "Inspecting system hardware telemetry",
      shortLabel: "Checking system telemetry...",
      status: "pending",
      type: "system",
      provider: "OS Control",
      toolName: rawName,
      args,
    };
  }

  if (cleanName === "open_application" || cleanName === "launch_app") {
    const app = args.app_name || args.application || "";
    return {
      id: stepId,
      label: app ? `Launching application: ${app}` : "Launching application",
      shortLabel: app ? `Opening ${app}...` : "Opening application...",
      status: "pending",
      type: "system",
      provider: "OS Control",
      toolName: rawName,
      args,
    };
  }

  // ── 9. Visual & Media Widgets ──────────────────────────────────────────
  if (cleanName === "show_map") {
    const loc = args.label || "coordinates";
    return {
      id: stepId,
      label: `Rendering interactive map for ${loc}`,
      shortLabel: "Rendering map...",
      status: "pending",
      type: "tool",
      toolName: rawName,
      args,
    };
  }

  if (cleanName === "get_weather") {
    return {
      id: stepId,
      label: "Fetching real-time weather conditions",
      shortLabel: "Fetching weather...",
      status: "pending",
      type: "tool",
      toolName: rawName,
      args,
    };
  }

  if (cleanName === "get_images") {
    const q = args.query || "";
    return {
      id: stepId,
      label: q ? `Searching image gallery for "${q}"` : "Searching image gallery",
      shortLabel: "Searching images...",
      status: "pending",
      type: "tool",
      toolName: rawName,
      args,
    };
  }

  // ── 10. Memory & Soul System ───────────────────────────────────────────
  if (cleanName === "remember_user" || cleanName === "log_problem") {
    const key = args.key || args.problem || "";
    return {
      id: stepId,
      label: key ? `Indexing memory fact: ${key}` : "Saving memory fact",
      shortLabel: "Saving memory...",
      status: "pending",
      type: "mcp",
      provider: "Soul Memory",
      toolName: rawName,
      args,
    };
  }

  if (cleanName === "recall_user" || cleanName === "list_memory") {
    return {
      id: stepId,
      label: "Recalling user context & memories",
      shortLabel: "Recalling memories...",
      status: "pending",
      type: "mcp",
      provider: "Soul Memory",
      toolName: rawName,
      args,
    };
  }

  // ── 11. Generic Provider__Tool Handling ────────────────────────────────
  if (rawName.includes("__")) {
    const parts = rawName.split("__");
    const providerRaw = parts[0];
    const toolRaw = parts.slice(1).join("__");
    const providerName = providerRaw.charAt(0).toUpperCase() + providerRaw.slice(1).replace(/[-_]/g, " ");
    const toolFormatted = toolRaw.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

    return {
      id: stepId,
      label: `Using ${providerName} ${toolFormatted} tool`,
      shortLabel: `Running ${providerName}...`,
      status: "pending",
      type: "mcp",
      provider: providerName,
      toolName: rawName,
      args,
    };
  }

  // ── 12. Standard Fallback ──────────────────────────────────────────────
  const formatted = rawName.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  return {
    id: stepId,
    label: `Running ${formatted}`,
    shortLabel: `${formatted}...`,
    status: "pending",
    type: "tool",
    toolName: rawName,
    args,
  };
}
