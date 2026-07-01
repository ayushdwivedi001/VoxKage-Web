import React from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: Array<{ name: string; type: string; code: string }>;
  status?: "thinking" | "streaming" | "completed";
  thinkingDuration?: number;
  thinkingStart?: number;
  thinkingSteps?: Array<{ id: string; label: string; status: "pending" | "success" | "failed" }>;
}

export const extractFilesFromContent = (content: string) => {
  const files: Array<{ name: string; type: string; code: string }> = [];
  if (!content) return files;

  const codeBlockRegex = /```(\w*)\n([\s\S]*?)(?:```|$)/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = match[1] || "txt";
    const code = match[2];
    if (!code.trim()) continue;

    // Try to find a filename in the text preceding the code block (within last 150 characters)
    const searchStartIndex = Math.max(0, match.index - 150);
    const precedingText = content.substring(searchStartIndex, match.index);
    
    // Regex to search for a filename
    const fileMatch = precedingText.match(/`?([\w\-]+\.(?:py|js|ts|tsx|json|css|html|env|txt|md|yaml|yml|sh|bat))`?/i);
    let fileName = fileMatch ? fileMatch[1] : "";

    if (!fileName) {
      const ext = lang === "python" ? "py" : lang === "javascript" ? "js" : lang === "typescript" ? "ts" : lang === "html" ? "html" : lang === "css" ? "css" : "txt";
      const index = files.length + 1;
      fileName = `app_${index}.${ext}`;
    }

    if (!files.some(f => f.name === fileName)) {
      let fileType = "Code";
      if (fileName.endsWith(".py")) fileType = "Python";
      else if (fileName.endsWith(".js") || fileName.endsWith(".jsx")) fileType = "JavaScript";
      else if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) fileType = "TypeScript";
      else if (fileName.endsWith(".html")) fileType = "HTML";
      else if (fileName.endsWith(".css")) fileType = "CSS";
      else if (fileName.endsWith(".json")) fileType = "JSON";

      files.push({
        name: fileName,
        type: `${fileType} · ${lang.toUpperCase()}`,
        code: code.trim()
      });
    }
  }

  return files;
};

export const removeCodeBlocks = (text: string) => {
  if (!text) return "";
  return text.replace(/```\w*\n[\s\S]*?(?:```|$)/g, "").trim();
};

export const computeSessionFiles = (messages: Message[]) => {
  const list: Array<{ name: string; type: string; versions: Array<{ version: number; code: string }> }> = [];

  messages.forEach((m) => {
    if (m.role === "assistant") {
      const { finalContent } = parseMessageContent(m.content);
      const extracted = extractFilesFromContent(finalContent);
      extracted.forEach((file) => {
        let existing = list.find((item) => item.name === file.name);
        if (!existing) {
          existing = {
            name: file.name,
            type: file.type,
            versions: [],
          };
          list.push(existing);
        }
        const lastVer = existing.versions[existing.versions.length - 1];
        if (!lastVer || lastVer.code !== file.code) {
          existing.versions.push({
            version: existing.versions.length + 1,
            code: file.code,
          });
        }
      });
    }
  });

  return list;
};

export const parseSources = (content: string) => {
  if (!content) return { cleanContent: "", sources: [] };
  const sourcesRegex = /<Sources\s+data="([^"]+)"\s*\/>/i;
  const match = content.match(sourcesRegex);
  let cleanContent = content.replace(/<Sources[\s\S]*/i, '').trim();
  let sources: { title: string; url: string; domain: string }[] = [];

  if (match) {
    const rawData = match[1];
    const pairs = rawData.split('||');
    pairs.forEach((p) => {
      const parts = p.split('|');
      if (parts.length >= 2) {
        const title = parts[0];
        const url = parts[1];
        let domain = '';
        try {
          const matchDomain = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
          domain = matchDomain ? matchDomain[1] : url;
        } catch {
          domain = url;
        }
        sources.push({ title, url, domain });
      }
    });
  }

  return { cleanContent, sources };
};

export const parseMessageContent = (content: string) => {
  const { cleanContent: noSourcesContent, sources } = parseSources(content);
  
  let thinkingContent = "";
  let finalContent = noSourcesContent;

  const thinkStartIndex = noSourcesContent.indexOf("<think>");
  const thinkEndIndex = noSourcesContent.indexOf("</think>");

  if (thinkStartIndex !== -1) {
    if (thinkEndIndex !== -1) {
      thinkingContent = noSourcesContent.substring(thinkStartIndex + 7, thinkEndIndex).trim();
      finalContent = (noSourcesContent.substring(0, thinkStartIndex) + noSourcesContent.substring(thinkEndIndex + 8)).trim();
    } else {
      thinkingContent = noSourcesContent.substring(thinkStartIndex + 7).trim();
      finalContent = noSourcesContent.substring(0, thinkStartIndex).trim();
    }
  }

  return { thinkingContent, finalContent, sources };
};

export function parseInlineElements(text: string) {
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let tokenKey = 0;

  const regex = /(\*\*.*?\*\*|`.*?`|\b[\w\-]+\.(?:py|js|ts|tsx|json|css|html|env|txt|md|yaml|yml|sh|bat)\b|\b\w+[\w\-]*\(\))/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(remaining)) !== null) {
    const matchIndex = match.index;
    const matchStr = match[0];

    if (matchIndex > lastIndex) {
      tokens.push(<React.Fragment key={tokenKey++}>{remaining.substring(lastIndex, matchIndex)}</React.Fragment>);
    }

    if (matchStr.startsWith("**") && matchStr.endsWith("**")) {
      const boldText = matchStr.slice(2, -2);
      tokens.push(
        <strong key={tokenKey++} className="font-bold text-zinc-100">
          {boldText}
        </strong>
      );
    } else if (matchStr.startsWith("`") && matchStr.endsWith("`")) {
      const codeText = matchStr.slice(1, -1);
      tokens.push(
        <code key={tokenKey++} className="bg-zinc-850/60 text-zinc-200 border border-zinc-700/50 px-1.5 py-0.5 rounded font-mono text-[13.5px] mx-0.5">
          {codeText}
        </code>
      );
    } else {
      tokens.push(
        <span key={tokenKey++} className="text-blue-400 font-mono font-medium hover:underline cursor-help">
          {matchStr}
        </span>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < remaining.length) {
    tokens.push(<React.Fragment key={tokenKey++}>{remaining.substring(lastIndex)}</React.Fragment>);
  }

  return tokens.length > 0 ? tokens : text;
}

export function renderTable(rows: string[][], key: string) {
  if (rows.length === 0) return null;
  const headers = rows[0];
  const bodyRows = rows.slice(1);

  return (
    <div key={key} className="w-full my-3.5 overflow-x-auto rounded-xl border border-zinc-850 bg-zinc-950/40 custom-scrollbar select-text">
      <table className="w-full text-left border-collapse min-w-[500px]">
        <thead>
          <tr className="border-b border-zinc-800/80 bg-zinc-900/10">
            {headers.map((h, idx) => (
              <th key={idx} className="px-4 py-2.5 text-[13px] font-semibold text-zinc-300 tracking-wide font-sans">
                {parseInlineElements(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-900/60">
          {bodyRows.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-zinc-900/10 transition-colors duration-150">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-2.5 text-[13px] text-zinc-400 font-sans leading-relaxed">
                  {parseInlineElements(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function renderFormattedContent(content: string) {
  if (!content) return null;
  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];

  let inTable = false;
  let tableRows: string[][] = [];
  let tableKey = 0;

  const isTableRow = (line: string) => {
    return line.trim().startsWith("|") && line.trim().endsWith("|");
  };

  const parseRowCells = (line: string) => {
    const parts = line.split("|");
    return parts.slice(1, parts.length - 1).map(c => c.trim());
  };

  const isSeparatorRow = (cells: string[]) => {
    return cells.length > 0 && cells.every(c => c.match(/^:?-+:?$/));
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isTableRow(line)) {
      const cells = parseRowCells(line);
      if (!inTable) {
        const nextLine = lines[i + 1];
        if (nextLine && isTableRow(nextLine)) {
          const nextCells = parseRowCells(nextLine);
          if (isSeparatorRow(nextCells)) {
            inTable = true;
            tableRows = [cells];
            i++; // skip separator
            continue;
          }
        }
      }

      if (inTable) {
        tableRows.push(cells);
        continue;
      }
    }

    if (inTable && (!isTableRow(line) || i === lines.length - 1)) {
      if (isTableRow(line) && i === lines.length - 1) {
        tableRows.push(parseRowCells(line));
      }
      renderedElements.push(renderTable(tableRows, `table-${tableKey++}`));
      inTable = false;
      tableRows = [];
      if (isTableRow(line)) continue;
    }

    if (!isTableRow(line)) {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];
        const headingClass = level === 1 
          ? "text-[22px] font-bold text-zinc-100 mt-4 mb-2 block" 
          : level === 2 
            ? "text-[19px] font-bold text-zinc-100 mt-3.5 mb-1.5 block" 
            : "text-[17px] font-bold text-zinc-100 mt-3 mb-1 block";
        renderedElements.push(
          <span key={`h-${i}`} className={headingClass}>
            {parseInlineElements(headingText)}
          </span>
        );
      } else {
        renderedElements.push(
          <div key={`p-${i}`} className="min-h-[1.5em] mb-1">
            {parseInlineElements(line)}
          </div>
        );
      }
    }
  }

  if (inTable && tableRows.length > 0) {
    renderedElements.push(renderTable(tableRows, `table-${tableKey++}`));
  }

  return renderedElements;
}
