"use client";

import React, { useState, useEffect, useRef } from "react";
import { Copy, Maximize2, Minimize2, Check, X, MessageSquare, Eye, Code, Terminal, RotateCw, ArrowLeft, Sliders } from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-python";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-bash";

// Custom CSS styles to override default Prism Tomorrow theme for an authentic VS Code dark look
const VS_CODE_THEME_CSS = `
  .vscode-code-container .token.comment,
  .vscode-code-container .token.prolog,
  .vscode-code-container .token.doctype,
  .vscode-code-container .token.cdata {
    color: #6a737d;
    font-style: italic;
  }
  .vscode-code-container .token.punctuation {
    color: #e1e4e8;
  }
  .vscode-code-container .token.namespace {
    opacity: .7;
  }
  .vscode-code-container .token.property,
  .vscode-code-container .token.tag,
  .vscode-code-container .token.boolean,
  .vscode-code-container .token.number,
  .vscode-code-container .token.constant,
  .vscode-code-container .token.symbol,
  .vscode-code-container .token.deleted {
    color: #79b8ff;
  }
  .vscode-code-container .token.selector,
  .vscode-code-container .token.attr-name,
  .vscode-code-container .token.string,
  .vscode-code-container .token.char,
  .vscode-code-container .token.builtin,
  .vscode-code-container .token.inserted {
    color: #ffab70;
  }
  .vscode-code-container .token.operator,
  .vscode-code-container .token.entity,
  .vscode-code-container .token.url,
  .vscode-code-container .language-css .token.string,
  .vscode-code-container .style .token.string {
    color: #f97583;
  }
  .vscode-code-container .token.atrule,
  .vscode-code-container .token.attr-value,
  .vscode-code-container .token.keyword {
    color: #f97583;
  }
  .vscode-code-container .token.function,
  .vscode-code-container .token.class-name {
    color: #b392f0;
  }
  .vscode-code-container .token.regex,
  .vscode-code-container .token.important,
  .vscode-code-container .token.variable {
    color: #ffab70;
  }
`;

interface FileInspectorPanelProps {
  fileName: string;
  code: string;
  onClose: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  comments: Array<{ id: string; fileName: string; line: number; text: string }>;
  onAddComment: (line: number, text: string) => void;
  onDeleteComment: (id: string) => void;
  jumpToLine: number | null;
  sessionFiles?: Array<{ name: string; type: string; versions: Array<{ version: number; code: string }> }>;
  onBack?: () => void;
  onNavigateFile?: (fileName: string) => void;
  onEditClick?: (fileName: string) => void;
}

export default function FileInspectorPanel({
  fileName,
  code,
  onClose,
  isExpanded,
  onToggleExpand,
  comments,
  onAddComment,
  onDeleteComment,
  jumpToLine,
  sessionFiles = [],
  onBack,
  onNavigateFile,
  onEditClick,
}: FileInspectorPanelProps) {
  const [copied, setCopied] = useState(false);
  const [activeCommentLine, setActiveCommentLine] = useState<number | null>(null);
  const [commentInputText, setCommentInputText] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Playground & Sandboxing States
  const [mode, setMode] = useState<"code" | "preview">("code");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<Array<{ type: "info" | "log" | "warn" | "error"; text: string; time: string }>>([]);
  const [consoleHeight, setConsoleHeight] = useState(180);
  const [reloadKey, setReloadKey] = useState(0);

  const [isResizing, setIsResizing] = useState(false);
  const [consoleCopied, setConsoleCopied] = useState(false);

  const isResizingRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const handleResizeStart = (e: React.PointerEvent) => {
    isResizingRef.current = true;
    setIsResizing(true);
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  };

  // Check if file is previewable (only JSX/TSX, HTML, CSS, JS)
  const canPreview = /\.(html|css|js|jsx|tsx)$/i.test(fileName);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text", err);
    }
  };

  const getLanguage = (fname: string) => {
    const ext = fname.split(".").pop()?.toLowerCase();
    if (ext === "py") return "python";
    if (ext === "js" || ext === "jsx") return "javascript";
    if (ext === "ts" || ext === "tsx") return "typescript";
    if (ext === "html" || ext === "xml" || ext === "svg") return "markup";
    if (ext === "css") return "css";
    if (ext === "sh" || ext === "bash") return "bash";
    return "clike";
  };

  const lang = getLanguage(fileName);
  const grammar = Prism.languages[lang] || Prism.languages.clike;
  const lines = code.split("\n");

  const highlightedLines = lines.map((line) => {
    try {
      const content = line === "" ? " " : line;
      return Prism.highlight(content, grammar, lang);
    } catch {
      return line;
    }
  });

  // Handle jump line scroll
  useEffect(() => {
    if (jumpToLine && containerRef.current && mode === "code") {
      const lineEl = containerRef.current.querySelector(`[data-line="${jumpToLine}"]`);
      if (lineEl) {
        lineEl.scrollIntoView({ behavior: "smooth", block: "center" });
        lineEl.classList.add("bg-blue-950/40");
        const timer = setTimeout(() => {
          lineEl.classList.remove("bg-blue-950/40");
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [jumpToLine, mode]);

  // Capture Iframe Logs
  useEffect(() => {
    const handleLogMessage = (e: MessageEvent) => {
      if (e.data) {
        if (e.data.type === "PREVIEW_LOG") {
          const logTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setConsoleLogs((prev) => [
            ...prev,
            { type: e.data.logType, text: e.data.data, time: logTime },
          ]);
        } else if (e.data.type === "PREVIEW_NAVIGATE" && onNavigateFile) {
          onNavigateFile(e.data.fileName);
        }
      }
    };
    window.addEventListener("message", handleLogMessage);
    return () => window.removeEventListener("message", handleLogMessage);
  }, [onNavigateFile]);

  // Auto-scroll logs terminal
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs, consoleOpen]);

  // Handle resizing terminal console
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isResizingRef.current) return;
      const panelEl = document.getElementById("file-inspector-panel");
      if (panelEl) {
        const rect = panelEl.getBoundingClientRect();
        const newHeight = rect.bottom - e.clientY;
        if (newHeight > 60 && newHeight < rect.height - 80) {
          setConsoleHeight(newHeight);
        }
      }
    };

    const handlePointerUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const handleCopyConsole = async () => {
    try {
      const logsText = consoleLogs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.text}`).join("\n");
      await navigator.clipboard.writeText(logsText);
      setConsoleCopied(true);
      setTimeout(() => setConsoleCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy console logs", err);
    }
  };

  const handleCommitComment = (lineNum: number) => {
    if (!commentInputText.trim()) return;
    onAddComment(lineNum, commentInputText.trim());
    setCommentInputText("");
    setActiveCommentLine(null);
  };

  // Compile Dynamic Multi-File HTML Document URL
  const generatePreviewSrcDoc = () => {
    const virtualFilesMap: Record<string, { content: string }> = {};
    
    // Add all files from current session workspace
    sessionFiles.forEach((sf) => {
      if (sf.versions && sf.versions.length > 0) {
        virtualFilesMap[sf.name] = { content: sf.versions[sf.versions.length - 1].code };
      }
    });

    // Overwrite/Inject the active changes in progress
    virtualFilesMap[fileName] = { content: code };

    const filesJson = JSON.stringify(virtualFilesMap).replace(/<\/script>/gi, "<\\/script>");

    const isHtml = fileName.toLowerCase().endsWith(".html");

    // If it's a standalone HTML file, we use its content as the base document
    // otherwise we use a default mount target document.
    let baseHtmlTemplate = "";
    if (isHtml) {
      baseHtmlTemplate = code;
    } else {
      // Find any HTML file in session to use as base, or fall back to default
      const sessionHtml = Object.keys(virtualFilesMap).find(k => k.toLowerCase().endsWith(".html"));
      if (sessionHtml) {
        baseHtmlTemplate = virtualFilesMap[sessionHtml].content;
      } else {
        baseHtmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VoxKage Sandbox Preview</title>
</head>
<body class="bg-zinc-950 text-zinc-100 min-h-screen">
  <div id="root"></div>
</body>
</html>
        `;
      }
    }

    // Now, we inject our console routing, CDN links, and virtual compiler right inside the base HTML template
    // We insert it right before the closing </head> tag, or at the start of the body/head.
    const consoleAndCompilerScript = `
  <!-- Load Babel Standalone CDN -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <!-- Load Tailwind Play CDN for premium responsive layouts -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            canvas: "#faf9f5",
            ink: "#141413",
            primary: "#cc785c",
            hairline: "#e6dfd8",
            primaryActive: "#a9583e"
          }
        }
      }
    }
  </script>
  <!-- Import Map -->
  <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.2.0?dev",
        "react-dom": "https://esm.sh/react-dom@18.2.0?dev",
        "react-dom/client": "https://esm.sh/react-dom@18.2.0/client?dev",
        "lucide-react": "https://esm.sh/lucide-react@0.400.0"
      }
    }
  </script>
  <script>
    // Console log routing hook
    const sendLog = (type, data) => {
      window.parent.postMessage({ type: "PREVIEW_LOG", logType: type, data }, "*");
    };

    const _log = console.log;
    const _error = console.error;
    const _warn = console.warn;

    console.log = (...args) => {
      sendLog("log", args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" "));
      _log.apply(console, args);
    };
    console.error = (...args) => {
      sendLog("error", args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" "));
      _error.apply(console, args);
    };
    console.warn = (...args) => {
      sendLog("warn", args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" "));
      _warn.apply(console, args);
    };

    window.onerror = (message, source, lineno, colno, error) => {
      const errStr = message + " at line " + lineno + ":" + colno;
      sendLog("error", errStr);

      const root = document.getElementById("root") || document.body;
      if (root) {
        root.innerHTML = \`
          <div style="background-color: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); padding: 1.25rem; border-radius: 8px; font-family: monospace; color: #f87171; margin: 1rem; max-width: 100%;">
            <div style="font-weight: bold; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.25rem;">⚠️</span> Runtime Error
            </div>
            <pre style="white-space: pre-wrap; margin: 0; font-size: 0.85rem; line-height: 1.5;">\${message}\\n\\nStack:\\n\${error ? error.stack : 'No stack trace available'}</pre>
          </div>
        \`;
      }
      return true;
    };

    // Intercept clicks on anchor links to prevent breaking parent container routing
    document.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (link) {
        const href = link.getAttribute("href");
        if (href) {
          // 1. Same-page hash anchor routing
          if (href.startsWith("#") || href.startsWith("/#") || href.includes("#")) {
            e.preventDefault();
            const parts = href.split("#");
            const targetId = parts[parts.length - 1];
            if (targetId) {
              const targetEl = document.getElementById(targetId) || document.querySelector('[name="' + targetId + '"]');
              if (targetEl) {
                targetEl.scrollIntoView({ behavior: "smooth" });
                return;
              }
            }
          }
          
          // 2. Relative page routing or localhost page routing
          const isRelative = !href.includes("://");
          const isSameHost = href.includes(window.location.host);
          if (isRelative || isSameHost) {
            e.preventDefault();
            sendLog("info", "[Navigation Intercepted] Prevented redirect to: " + href);
            
            const cleanPath = href.split("#")[0].split("?")[0];
            const resolvedPath = resolvePath("${fileName}", cleanPath);
            const fileKey = Object.keys(files).find(k => k.toLowerCase() === resolvedPath.toLowerCase());
            if (fileKey) {
              sendLog("info", "Loading page: " + fileKey);
              window.parent.postMessage({ type: "PREVIEW_NAVIGATE", fileName: fileKey }, "*");
            }
          }
        }
      }
    });
  </script>

  <script type="module">
    const files = ${filesJson};
    
    sendLog("info", "Compiling virtual file workspace...");
    
    const blobUrls = {};

    const resolvePath = (base, relative) => {
      const baseParts = base.split('/').slice(0, -1);
      const relativeParts = relative.split('/');
      for (const part of relativeParts) {
        if (part === '..') baseParts.pop();
        else if (part !== '.' && part !== '') baseParts.push(part);
      }
      return baseParts.join('/');
    };

    const compileModule = (path) => {
      if (blobUrls[path]) return blobUrls[path];
      
      const fileKey = Object.keys(files).find(k => 
        k.toLowerCase() === path.toLowerCase() || 
        k.toLowerCase() === (path + '.tsx').toLowerCase() || 
        k.toLowerCase() === (path + '.ts').toLowerCase() || 
        k.toLowerCase() === (path + '.jsx').toLowerCase() || 
        k.toLowerCase() === (path + '.js').toLowerCase() ||
        k.toLowerCase() === (path + '.css').toLowerCase()
      );
      
      const file = files[fileKey];
      if (!file) {
        throw new Error("Module not found: " + path);
      }
      
      let blobCode = "";

      if (fileKey.toLowerCase().endsWith(".css")) {
        const escapedCss = file.content
          .split('\\\\').join('\\\\\\\\')
          .split("'").join("\\\\'")
          .split('\\n').join('\\\\n')
          .split('\\r').join('\\\\r');
        blobCode = "const style = document.createElement('style'); style.textContent = '" + escapedCss + "'; document.head.appendChild(style); export default {};";
      } else {
        let transpiled = "";
        try {
          transpiled = Babel.transform(file.content, {
            presets: [
              ["typescript", { allExtensions: true, isTSX: true }],
              "react"
            ],
            filename: path
          }).code;
        } catch (err) {
          sendLog("error", "Transpile Error in " + path + ": " + err.message);
          throw err;
        }
        
        // Resolve relative modules in generated code to dynamic Blobs
        blobCode = transpiled.replace(/(from\\s+['"])(\\.\\.?\\/[^'"]+)(['"])/g, (match, p1, p2, p3) => {
          const resolvedPath = resolvePath(path, p2);
          const resolvedBlob = compileModule(resolvedPath);
          return p1 + resolvedBlob + p3;
        });
      }
      
      const blob = new Blob([blobCode], { type: "application/javascript" });
      const blobUrl = URL.createObjectURL(blob);
      blobUrls[path] = blobUrl;
      return blobUrl;
    };

    try {
      // 1. Transpile all JS modules
      Object.keys(files).forEach(path => {
        if (path.endsWith('.js') || path.endsWith('.jsx') || path.endsWith('.ts') || path.endsWith('.tsx')) {
          compileModule(path);
        }
      });

      // 2. Intercept relative scripts in base HTML
      document.querySelectorAll("script").forEach(script => {
        const src = script.getAttribute("src");
        if (src && (src.startsWith(".") || !src.includes("://"))) {
          const resolvedPath = resolvePath("${fileName}", src);
          const blobUrl = blobUrls[resolvedPath];
          if (blobUrl) {
            const newScript = document.createElement("script");
            newScript.type = "module";
            newScript.src = blobUrl;
            script.parentNode.replaceChild(newScript, script);
          }
        }
      });

      // 3. Intercept relative styles in base HTML
      document.querySelectorAll("link[rel='stylesheet']").forEach(link => {
        const href = link.getAttribute("href");
        if (href && (href.startsWith(".") || !href.includes("://"))) {
          const resolvedPath = resolvePath("${fileName}", href);
          const fileKey = Object.keys(files).find(k => k.toLowerCase() === resolvedPath.toLowerCase());
          if (fileKey && files[fileKey]) {
            const style = document.createElement("style");
            style.textContent = files[fileKey].content;
            link.parentNode.replaceChild(style, link);
          }
        }
      });
      
      // 4. Resolve React Component Mount if active file is a React file and no script is mounting it
      const isReactActive = ${!isHtml};
      if (isReactActive) {
        let entryKey = Object.keys(blobUrls).find(k => {
          const lk = k.toLowerCase();
          return lk === 'app.tsx' || lk === 'app.jsx' || lk === 'index.tsx' || lk === 'index.jsx' || lk === 'index.js' ||
                 lk.endsWith('/app.tsx') || lk.endsWith('/app.jsx') || lk.endsWith('/index.tsx') || lk.endsWith('/index.jsx') || lk.endsWith('/index.js');
        });
        
        if (!entryKey && (fileName.endsWith('.jsx') || fileName.endsWith('.tsx') || fileName.endsWith('.js') || fileName.endsWith('.ts'))) {
          entryKey = Object.keys(blobUrls).find(k => k.toLowerCase() === fileName.toLowerCase());
        }
        
        if (entryKey) {
          sendLog("info", "Mounting entry component: " + entryKey);
          const entryUrl = blobUrls[entryKey];
          const entryScript = document.createElement("script");
          entryScript.type = "module";
          entryScript.textContent = \`
            import React from 'react';
            import ReactDOM from 'react-dom/client';
            import App from '\\\${entryUrl}';
            
            const rootEl = document.getElementById('root');
            if (rootEl) {
              const root = ReactDOM.createRoot(rootEl);
              root.render(React.createElement(App));
            }
          \`;
          document.body.appendChild(entryScript);
          sendLog("info", "Sandbox build complete. Live hot-reload active.");
        } else {
          sendLog("error", "No mountable React entry file (.tsx, .jsx, .html) found in project.");
        }
      }
    } catch (err) {
      sendLog("error", "Build Failed: " + err.message);
    }
  </script>
    `;

    // Inject console and compiler script inside the head of baseHtmlTemplate
    let finalHtml = baseHtmlTemplate;
    if (finalHtml.includes("</head>")) {
      finalHtml = finalHtml.replace("</head>", consoleAndCompilerScript + "</head>");
    } else if (finalHtml.includes("<head>")) {
      finalHtml = finalHtml.replace("<head>", "<head>" + consoleAndCompilerScript);
    } else {
      finalHtml = consoleAndCompilerScript + finalHtml;
    }

    return finalHtml;
  };

  const srcDoc = generatePreviewSrcDoc();

  return (
    <div 
      id="file-inspector-panel"
      className="flex flex-col h-full bg-[#0d0d11] border-l border-zinc-800/80 w-full relative z-20 overflow-hidden"
    >
      <style>{VS_CODE_THEME_CSS}</style>

      {/* Top Header Panel */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-zinc-800/80 bg-[#0d0d11] select-none flex-shrink-0 gap-4">
        {/* Left Side: Filename & Preview Mode Toggles */}
        <div className="min-w-0 flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center w-8 h-8 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl cursor-pointer transition-all duration-200 mr-1 select-none flex-shrink-0"
              aria-label="Back"
              title="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[14.5px] font-medium text-zinc-300 font-sans tracking-wide truncate max-w-[150px]" title={fileName}>
            {fileName}
          </span>
          
          {canPreview && (
            <div className="flex items-center bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-800/50">
              <button
                type="button"
                onClick={() => setMode("code")}
                className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-205 cursor-pointer ${
                  mode === "code" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Code view"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("preview");
                  setConsoleLogs([{ type: "info", text: "Initializing virtual sandbox...", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]);
                }}
                className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-205 cursor-pointer ${
                  mode === "preview" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Live preview"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Dark theme Edit button */}
          <button
            type="button"
            onClick={() => onEditClick?.(fileName)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#141416] border border-zinc-800 hover:border-zinc-700 text-zinc-350 hover:text-zinc-100 text-[12px] font-medium rounded-lg cursor-pointer transition-all duration-200"
            title="Attach file context to prompt box for inline editing"
          >
            <Sliders className="w-3.5 h-3.5 text-zinc-450" />
            <span>Edit</span>
          </button>
        </div>

        {/* Right Side: Header Controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {mode === "code" ? (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[12.5px] font-medium transition-all duration-200 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReloadKey(prev => prev + 1)}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
                title="Reload preview"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setConsoleOpen(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-all duration-200 cursor-pointer ${
                  consoleOpen ? "bg-zinc-850 border border-zinc-750 text-white" : "bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Console</span>
              </button>
            </div>
          )}

          {/* Expand/Collapse Toggle Button */}
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
            aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Close Panel Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all duration-200 cursor-pointer"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Panel Content (Code or Preview) */}
      <div className="flex-grow flex flex-col min-h-0 relative">
        {mode === "code" ? (
          /* Code Display Area */
          <div 
            ref={containerRef}
            className="flex-grow overflow-auto p-4 custom-vscode-scrollbar bg-[#0f0f13] vscode-code-container"
          >
            <div className="w-full flex flex-col font-mono text-[13.5px] leading-[22px]">
              {highlightedLines.map((htmlCode, index) => {
                const lineNum = index + 1;
                const lineComments = comments.filter(c => c.fileName === fileName && c.line === lineNum);
                
                return (
                  <div 
                    key={index} 
                    data-line={lineNum}
                    className="flex flex-col w-full border-l-2 border-transparent transition-all duration-300"
                  >
                    <div className="flex items-start min-w-0 w-full hover:bg-white/5 transition-colors group relative py-0.5">
                      {/* Hover comment trigger button */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCommentLine(activeCommentLine === lineNum ? null : lineNum);
                          setCommentInputText("");
                        }}
                        className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#1b2a47] border border-blue-500/50 flex items-center justify-center text-blue-400 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer z-10 hover:scale-105"
                        title={`Add suggestion to line ${lineNum}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>

                      {/* Line Numbers Column */}
                      <div className="text-zinc-650 text-right select-none w-9 pr-3 border-r border-zinc-800/60 mr-3 flex-shrink-0 font-light select-none">
                        {lineNum}
                      </div>

                      {/* Code Column */}
                      <pre
                        className="flex-grow select-text overflow-visible font-mono text-zinc-300"
                        style={{
                          background: "none",
                          margin: 0,
                          padding: 0,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                        }}
                        dangerouslySetInnerHTML={{ __html: htmlCode }}
                      />
                    </div>

                    {/* Inline Comment Input Area */}
                    {activeCommentLine === lineNum && (
                      <div className="pl-[54px] pr-4 py-2.5 bg-[#08080a] border-y border-zinc-800/40 flex items-center gap-2 animate-fadeIn w-full">
                        <input
                          type="text"
                          value={commentInputText}
                          onChange={(e) => setCommentInputText(e.target.value)}
                          placeholder="Add your comment"
                          className="flex-grow h-8 bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-zinc-200 text-[12.5px] focus:outline-none focus:border-blue-500/60 font-sans"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleCommitComment(lineNum);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleCommitComment(lineNum)}
                          className="h-8 px-3.5 bg-blue-600 hover:bg-blue-500 text-white font-sans font-medium text-[12px] rounded-lg transition-colors cursor-pointer"
                        >
                          Enter
                        </button>
                      </div>
                    )}

                    {/* Render inline comments */}
                    {lineComments.map((c) => (
                      <div 
                        key={c.id} 
                        className="pl-[54px] pr-4 py-1.5 bg-[#09090c]/85 border-b border-zinc-900/60 flex items-start justify-between gap-4 group/item"
                      >
                        <span className="text-[12px] text-zinc-400 font-sans leading-relaxed">
                          {c.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeleteComment(c.id)}
                          className="text-zinc-650 hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100 cursor-pointer"
                          aria-label="Delete comment"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Preview Iframe Viewport Area */
          <div className="flex-grow bg-zinc-950 relative h-full w-full">
            {isResizing && <div className="absolute inset-0 bg-transparent z-50 pointer-events-auto cursor-ns-resize" />}
            <iframe
              key={reloadKey}
              srcDoc={srcDoc}
              className="w-full h-full border-0 bg-zinc-950"
              sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
              title="Live preview sandbox"
            />
          </div>
        )}

        {/* Resizable bottom terminal log console */}
        {mode === "preview" && consoleOpen && (
          <div 
            style={{ height: `${consoleHeight}px` }}
            className="flex flex-col bg-[#07070a] border-t border-zinc-800/80 w-full absolute bottom-0 left-0 right-0 z-30 select-none"
          >
            {/* Console Drag Resizer Bar */}
            <div 
              onPointerDown={handleResizeStart}
              className="h-1.5 w-full cursor-ns-resize bg-zinc-800 hover:bg-blue-600 transition-colors flex items-center justify-center"
              title="Drag to resize terminal panel"
            >
              <div className="w-8 h-[2px] rounded-full bg-zinc-700 hover:bg-blue-400" />
            </div>

            {/* Console Header Bar */}
            <div className="flex items-center justify-between px-4 h-9 border-b border-zinc-850 bg-[#07070a] flex-shrink-0">
              <span className="text-[11.5px] font-semibold text-zinc-450 tracking-wider uppercase font-sans">
                Console Messages
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyConsole}
                  className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 cursor-pointer flex items-center gap-1 select-none font-sans"
                >
                  {consoleCopied ? "Copied!" : "Copy logs"}
                </button>
                <button
                  type="button"
                  onClick={() => setConsoleLogs([])}
                  className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 cursor-pointer select-none font-sans"
                >
                  Clear logs
                </button>
                <button
                  type="button"
                  onClick={() => setConsoleOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Console Logs List */}
            <div className="flex-grow overflow-auto p-3.5 font-mono text-[11.5px] leading-[18px] bg-zinc-950 custom-vscode-scrollbar select-text selection:bg-zinc-850 select-text">
              {consoleLogs.length === 0 ? (
                <div className="text-zinc-600 italic">No output logs capture generated.</div>
              ) : (
                consoleLogs.map((log, idx) => {
                  let colorClass = "text-zinc-300";
                  if (log.type === "error") colorClass = "text-red-400 bg-red-950/20 px-1 rounded border border-red-900/10";
                  else if (log.type === "warn") colorClass = "text-yellow-400";
                  else if (log.type === "info") colorClass = "text-blue-400";
                  return (
                    <div key={idx} className={`flex items-start gap-3 py-0.5 border-b border-zinc-900/30 ${colorClass}`}>
                      <span className="text-zinc-500 flex-shrink-0 select-none">{log.time}</span>
                      <span className="whitespace-pre-wrap word-break">{log.text}</span>
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* VS Code Scrollbar style overrides */}
      <style>{`
        .custom-vscode-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-vscode-scrollbar::-webkit-scrollbar-track {
          background: #0f0f13;
        }
        .custom-vscode-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }
        .custom-vscode-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.16);
        }
      `}</style>
    </div>
  );
}
