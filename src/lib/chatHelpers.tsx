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

export interface ImageItem {
  title: string;
  url: string;
}

export const parseImages = (content: string) => {
  if (!content) return { cleanContent: "", images: [] };
  const imagesRegex = /<Images\s+query="([^"]*)"\s+data="([^"]+)"\s*\/>/i;
  const match = content.match(imagesRegex);
  let cleanContent = content.replace(/<Images[\s\S]*/i, '').trim();
  let images: ImageItem[] = [];

  if (match) {
    const rawData = match[2];
    const pairs = rawData.split('||');
    pairs.forEach((p) => {
      const parts = p.split('|');
      if (parts.length >= 2) {
        images.push({ title: parts[0], url: parts[1] });
      }
    });
  }

  return { cleanContent, images };
};

export interface MapPlace {
  name: string;
  lat: number;
  lng: number;
  rating?: number;
  reviews_count?: number;
  description?: string;
  category?: string;
  image_url?: string;
}

export interface MapItem {
  lat: number;
  lng: number;
  label?: string;
  places?: MapPlace[];
}

export interface WeatherItem {
  lat?: number;
  lng?: number;
}

export interface ChartPoint {
  label: string;
  value: number;
  secondary_value?: number;
}

export interface ChartItem {
  type: "line" | "area" | "bar";
  title: string;
  xLabel?: string;
  yLabel?: string;
  data: ChartPoint[];
}

export interface FlowNode {
  id: string;
  label: string;
  description?: string;
  category?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

export interface FlowItem {
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export const parseChartAndFlow = (content: string) => {
  if (!content) return { cleanContent: content, chart: null, flow: null };
  
  let cleanContent = content;
  let chart: ChartItem | null = null;
  let flow: FlowItem | null = null;

  // 1. Match Chart Tag: <Chart ... />
  const chartRegex = /<Chart\s+([^>]*?)\s*\/>/i;
  const chartMatch = cleanContent.match(chartRegex);
  if (chartMatch) {
    const attrString = chartMatch[1];
    const getAttr = (name: string): string => {
      const regex = new RegExp(`${name}="([^"]*)"`, 'i');
      const m = attrString.match(regex);
      return m ? m[1] : "";
    };

    const type = (getAttr("type") || "line") as "line" | "area" | "bar";
    const title = getAttr("title");
    const xLabel = getAttr("xLabel") || undefined;
    const yLabel = getAttr("yLabel") || undefined;
    const rawData = getAttr("data");

    let data: ChartPoint[] = [];
    if (rawData) {
      const items = rawData.split("||");
      items.forEach((item) => {
        const parts = item.split("|");
        if (parts.length >= 2) {
          const label = parts[0];
          const value = parseFloat(parts[1]);
          if (!isNaN(value)) {
            const secVal = parts[2] && parts[2] !== "empty" ? parseFloat(parts[2]) : undefined;
            data.push({
              label,
              value,
              secondary_value: isNaN(secVal as number) ? undefined : secVal
            });
          }
        }
      });
    }

    if (title && data.length > 0) {
      chart = { type, title, xLabel, yLabel, data };
    }
    cleanContent = cleanContent.replace(chartRegex, '').trim();
  }

  // 2. Match Flow Tag: <Flow ... />
  const flowRegex = /<Flow\s+([^>]*?)\s*\/>/i;
  const flowMatch = cleanContent.match(flowRegex);
  if (flowMatch) {
    const attrString = flowMatch[1];
    const getAttr = (name: string): string => {
      const regex = new RegExp(`${name}="([^"]*)"`, 'i');
      const m = attrString.match(regex);
      return m ? m[1] : "";
    };

    const title = getAttr("title");
    const rawNodes = getAttr("nodes");
    const rawEdges = getAttr("edges");

    let nodes: FlowNode[] = [];
    if (rawNodes) {
      const items = rawNodes.split("||");
      items.forEach((item) => {
        const parts = item.split("|");
        if (parts.length >= 2) {
          nodes.push({
            id: parts[0],
            label: parts[1],
            description: parts[2] && parts[2] !== "empty" ? parts[2] : undefined,
            category: parts[3] && parts[3] !== "empty" ? parts[3] : undefined
          });
        }
      });
    }

    let edges: FlowEdge[] = [];
    if (rawEdges) {
      const items = rawEdges.split("||");
      items.forEach((item) => {
        const parts = item.split("|");
        if (parts.length >= 2) {
          edges.push({
            from: parts[0],
            to: parts[1],
            label: parts[2] && parts[2] !== "empty" ? parts[2] : undefined
          });
        }
      });
    }

    if (title && nodes.length > 0) {
      flow = { title, nodes, edges };
    }
    cleanContent = cleanContent.replace(flowRegex, '').trim();
  }

  return { cleanContent, chart, flow };
};

export const parseMapAndWeather = (content: string) => {
  if (!content) return { cleanContent: content, map: null, weather: null };
  
  let cleanContent = content;
  let map: MapItem | null = null;
  let weather: WeatherItem | null = null;

  // 1. Match Map Tag: <Map ... /> with flexible attribute parsing
  const mapRegex = /<Map\s+([^>]*?)\s*\/>/i;
  const mapMatch = cleanContent.match(mapRegex);
  if (mapMatch) {
    const attrString = mapMatch[1];
    const getAttr = (name: string): string => {
      const regex = new RegExp(`${name}="([^"]*)"`, 'i');
      const m = attrString.match(regex);
      return m ? m[1] : "";
    };

    const latVal = parseFloat(getAttr("lat"));
    const lngVal = parseFloat(getAttr("lng"));
    const label = getAttr("label") || undefined;
    const placesRaw = getAttr("places");

    let places: MapPlace[] = [];
    if (placesRaw) {
      const items = placesRaw.split("||");
      items.forEach((item) => {
        const parts = item.split("|");
        if (parts.length >= 3) {
          const name = parts[0];
          const pLat = parseFloat(parts[1]);
          const pLng = parseFloat(parts[2]);
          if (!isNaN(pLat) && !isNaN(pLng)) {
            const rating = parts[3] ? parseFloat(parts[3]) : undefined;
            const reviews_count = parts[4] ? parseInt(parts[4]) : undefined;
            const description = parts[5] || undefined;
            const category = parts[6] || undefined;
            const image_url = (parts[7] && parts[7] !== "empty") ? parts[7] : undefined;

            places.push({
              name,
              lat: pLat,
              lng: pLng,
              rating: isNaN(rating as number) ? undefined : rating,
              reviews_count: isNaN(reviews_count as number) ? undefined : reviews_count,
              description,
              category,
              image_url
            });
          }
        }
      });
    }

    if (!isNaN(latVal) && !isNaN(lngVal)) {
      map = { lat: latVal, lng: lngVal, label, places };
    }
    cleanContent = cleanContent.replace(mapRegex, '').trim();
  }

  // 2. Match Weather Tag: <Weather /> or <Weather lat="[lat]" lng="[lng]" />
  const weatherRegex = /<Weather(?:\s+lat="([^"]+)"\s+lng="([^"]+)")?\s*\/>/i;
  const weatherMatch = cleanContent.match(weatherRegex);
  if (weatherMatch) {
    if (weatherMatch[1] && weatherMatch[2]) {
      const lat = parseFloat(weatherMatch[1]);
      const lng = parseFloat(weatherMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        weather = { lat, lng };
      }
    } else {
      weather = {};
    }
    cleanContent = cleanContent.replace(weatherRegex, '').trim();
  }

  return { cleanContent, map, weather };
};

export const parseMessageContent = (content: string) => {
  const { cleanContent: noSourcesContent, sources } = parseSources(content);
  const { cleanContent: noImagesContent, images } = parseImages(noSourcesContent);
  const { cleanContent: noChartContent, chart, flow } = parseChartAndFlow(noImagesContent);
  const { cleanContent: cleanTextContent, map, weather } = parseMapAndWeather(noChartContent);
  
  let thinkingContent = "";
  let finalContent = cleanTextContent;

  const thinkStartIndex = cleanTextContent.indexOf("<think>");
  const thinkEndIndex = cleanTextContent.indexOf("</think>");

  if (thinkStartIndex !== -1) {
    if (thinkEndIndex !== -1) {
      thinkingContent = cleanTextContent.substring(thinkStartIndex + 7, thinkEndIndex).trim();
      finalContent = (cleanTextContent.substring(0, thinkStartIndex) + cleanTextContent.substring(thinkEndIndex + 8)).trim();
    } else {
      thinkingContent = cleanTextContent.substring(thinkStartIndex + 7).trim();
      finalContent = cleanTextContent.substring(0, thinkStartIndex).trim();
    }
  }

  // Sanitize standalone layout dividers, compact spacing, and normalize double-dashes
  if (finalContent) {
    finalContent = finalContent
      .replace(/^\s*---\s*$/gm, "")
      .replace(/\s*--\s*/g, " – ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  if (thinkingContent) {
    thinkingContent = thinkingContent
      .replace(/^\s*---\s*$/gm, "")
      .replace(/\s*--\s*/g, " – ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return { thinkingContent, finalContent, sources, images, map, weather, chart, flow };
};

export function parseInlineElements(text: string) {
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let tokenKey = 0;

  // Regex matches URLs (http/https, www., and raw domains), bold (**text**), inline code (`code`), standard filenames (file.ext), or function signatures containing ()
  const regex = /(\bhttps?:\/\/[^\s()<>]+(?:\([\w\d]+\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])|\b(?:www\.|(?<!@))[a-zA-Z0-9-]{2,}(?:\.[a-zA-Z0-9-]+)*(?:\.(?:com|in|net|org|co|io|app|edu|gov|xyz|info|biz|uk|us|me|tv|cc|ca|de|fr|jp|au|ru|br))\b(?:\/[^\s()<>`!"'\[\]{};:'".,]*|\.[a-zA-Z0-9]+|\?[a-zA-Z0-9-&=_]+)*|\*\*.*?\*\*|`.*?`|\b[\w\-]+\.(?:py|js|ts|tsx|json|css|html|env|txt|md|yaml|yml|sh|bat)\b|\b\w+[\w\-]*\(\))/gi;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(remaining)) !== null) {
    const matchIndex = match.index;
    const matchStr = match[0];

    if (matchIndex > lastIndex) {
      tokens.push(<React.Fragment key={tokenKey++}>{remaining.substring(lastIndex, matchIndex)}</React.Fragment>);
    }

    // Check if the match is a link (either starts with http/www or matches our domain TLD pattern)
    const isLink = matchStr.match(/^https?:\/\//i) || 
                   matchStr.match(/^www\./i) || 
                   matchStr.match(/^[a-zA-Z0-9-]+\.(?:com|in|net|org|co|io|app|edu|gov|xyz|info|biz|uk|us|me|tv|cc|ca|de|fr|jp|au|ru|br)/i);

    if (isLink) {
      const url = (!matchStr.match(/^https?:\/\//i)) ? `https://${matchStr}` : matchStr;
      tokens.push(
        <a 
          key={tokenKey++} 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-400 hover:text-blue-350 underline font-medium break-all select-text"
        >
          {matchStr}
        </a>
      );
    } else if (matchStr.startsWith("**") && matchStr.endsWith("**")) {
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
        <span key={tokenKey++} className="text-blue-450 font-mono font-medium hover:underline cursor-help">
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
