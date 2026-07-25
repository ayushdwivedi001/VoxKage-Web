import React, { useState } from "react";
import dynamic from "next/dynamic";

const InlineMath = dynamic(() => import("react-katex").then(m => m.InlineMath), {
  ssr: false,
  loading: () => <span className="font-serif animate-pulse">...</span>
});

const BlockMath = dynamic(() => import("react-katex").then(m => m.BlockMath), {
  ssr: false,
  loading: () => <div className="text-zinc-500 py-2 text-center animate-pulse">Loading equation...</div>
});

const CitationPill = ({ source, index }: { source: any; index: number }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  let shortLabel = source.domain || "";
  if (shortLabel.startsWith("www.")) {
    shortLabel = shortLabel.substring(4);
  }
  if (shortLabel) {
    shortLabel = shortLabel.split('.')[0];
    shortLabel = shortLabel.charAt(0).toUpperCase() + shortLabel.slice(1);
  } else {
    shortLabel = `[${index}]`;
  }

  return (
    <span className="relative inline-block mx-0.5 align-middle select-none">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-sans font-medium bg-[#1e293b]/70 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all duration-150 cursor-pointer [.light_&]:bg-[#3d3d3a] [.light_&]:border-[#252523] [.light_&]:text-[#e6dfd8] [.light_&]:hover:bg-[#525250] [.light_&]:hover:text-white"
      >
        {shortLabel} ↗
      </a>
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#0c0c0e] border border-zinc-800 rounded-xl shadow-2xl z-50 text-[12px] text-zinc-300 font-sans leading-normal pointer-events-none animate-fadeIn block text-left [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7] [.light_&]:text-[#141413] [.light_&]:shadow-md">
          <span className="block text-white font-medium mb-1 line-clamp-2 [.light_&]:text-[#141413]">
            {source.title || "Consulted Source"}
          </span>
          <span className="block text-zinc-500 font-mono text-[10px] truncate [.light_&]:text-[#525250]">
            {source.url}
          </span>
        </span>
      )}
    </span>
  );
};

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: Array<{ name: string; type: string; code: string }>;
  status?: "thinking" | "streaming" | "completed";
  thinkingDuration?: number;
  thinkingStart?: number;
  thinkingSteps?: Array<{ id: string; label: string; status: "pending" | "success" | "failed"; resultContent?: any }>;
}

export const applyDiff = (currentCode: string, diffBlock: string): string => {
  const diffRegex = /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g;
  let newCode = currentCode;
  let match;
  let applied = false;
  
  while ((match = diffRegex.exec(diffBlock)) !== null) {
    const searchContent = match[1];
    const replaceContent = match[2];
    
    const normalizedSearch = searchContent.replace(/\r\n/g, "\n");
    const normalizedCode = newCode.replace(/\r\n/g, "\n");
    
    if (normalizedCode.includes(normalizedSearch)) {
      newCode = normalizedCode.replace(normalizedSearch, replaceContent.replace(/\r\n/g, "\n"));
      applied = true;
    } else {
      const trimmedSearch = normalizedSearch.trim();
      const trimmedCode = normalizedCode.trim();
      if (trimmedCode.includes(trimmedSearch)) {
        const idx = normalizedCode.indexOf(trimmedSearch);
        if (idx !== -1) {
          newCode = normalizedCode.substring(0, idx) + replaceContent.replace(/\r\n/g, "\n") + normalizedCode.substring(idx + trimmedSearch.length);
          applied = true;
        }
      }
    }
  }
  
  return applied ? newCode : currentCode;
};

export const extractFilesFromContent = (content: string, userPromptFilenames: string[] = []) => {
  const files: Array<{ name: string; type: string; code: string; isDiff?: boolean }> = [];
  if (!content) return files;

  const codeBlockRegex = /```(\w*)\n([\s\S]*?)(?:```|$)/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = match[1] || "txt";
    const code = match[2];
    if (!code.trim()) continue;

    const ext = lang === "python" ? "py" : 
                lang === "javascript" ? "js" : 
                lang === "typescript" ? "ts" : 
                lang === "html" ? "html" : 
                lang === "css" ? "css" : 
                lang === "tsx" ? "tsx" :
                lang === "jsx" ? "jsx" :
                lang === "json" ? "json" :
                "txt";

    // 1. Try to find a filename in the text preceding the code block (within last 150 characters)
    const searchStartIndex = Math.max(0, match.index - 150);
    const precedingText = content.substring(searchStartIndex, match.index);
    const fileMatch = precedingText.match(/`?(\/?[\w\-]+(?:\/[\w\-]+)*\.(?:py|js|ts|tsx|jsx|json|css|html|env|txt|md|yaml|yml|sh|bat|zip))`?/i);
    let fileName = fileMatch ? fileMatch[1] : "";

    // 2. Try to find a filename comment inside the first 3 lines of the code block itself
    if (!fileName) {
      const lines = code.trim().split("\n").slice(0, 3);
      for (const line of lines) {
        const inlineMatch = line.match(/(?:#|\/\/|\/\*)\s*(\/?[\w\-]+(?:\/[\w\-]+)*\.(?:py|js|ts|tsx|jsx|json|css|html|env|txt|md|yaml|yml|sh|bat|zip))/i);
        if (inlineMatch) {
          fileName = inlineMatch[1];
          break;
        }
      }
    }

    // 3. Try to use any filename from the user prompt of matching extension
    if (!fileName && userPromptFilenames.length > 0) {
      const matchingUserPromptFile = userPromptFilenames.find(f => f.toLowerCase().endsWith(`.${ext}`));
      if (matchingUserPromptFile) {
        fileName = matchingUserPromptFile;
      }
    }

    // 4. Determine file promotion
    const hasExplicitName = !!fileName;
    if (!hasExplicitName) {
      const linesCount = code.split("\n").length;
      const isLargeBlock = linesCount > 35 || code.length > 1500;
      const isCodeLang = ["py", "js", "ts", "tsx", "jsx", "html", "css"].includes(ext);
      
      if (isLargeBlock && isCodeLang) {
        const codeLower = code.toLowerCase();
        if (ext === "py") {
          if (codeLower.includes("telegram") || codeLower.includes("telebot") || codeLower.includes("telethon")) fileName = "telegram_bot.py";
          else if (codeLower.includes("discord")) fileName = "discord_bot.py";
          else if (codeLower.includes("fastapi") || codeLower.includes("flask") || codeLower.includes("django")) fileName = "server.py";
          else if (codeLower.includes("sqlite3") || codeLower.includes("db.") || codeLower.includes("database")) fileName = "database.py";
          else if (codeLower.includes("pygame")) fileName = "game.py";
          else if (codeLower.includes("pandas") || codeLower.includes("plt.") || codeLower.includes("matplotlib")) fileName = "data_analysis.py";
          else fileName = `app_${files.length + 1}.py`;
        } else if (ext === "js" || ext === "ts") {
          if (codeLower.includes("telegram")) fileName = `telegram_bot.${ext}`;
          else if (codeLower.includes("discord")) fileName = `discord_bot.${ext}`;
          else if (codeLower.includes("express") || codeLower.includes("http.createserver")) fileName = `server.${ext}`;
          else fileName = `app_${files.length + 1}.${ext}`;
        } else if (ext === "tsx" || ext === "jsx") {
          fileName = `App.${ext}`;
        } else if (ext === "html") {
          fileName = `index.html`;
        } else if (ext === "css") {
          fileName = `styles.css`;
        } else {
          fileName = `app_${files.length + 1}.txt`;
        }
      } else {
        // Skip rendering as file, keep as inline code block
        continue;
      }
    }

    // Clean leading slash for relative virtual path sync
    if (fileName.startsWith("/")) {
      fileName = fileName.substring(1);
    }

    const isDiff = code.includes("<<<<<<< SEARCH") && code.includes("=======") && code.includes(">>>>>>> REPLACE");
    const existing = files.find(f => f.name === fileName);
    if (existing) {
      existing.code = existing.code + "\n\n" + code.trim();
      existing.isDiff = existing.isDiff || isDiff;
    } else {
      let fileType = "Code";
      if (fileName.endsWith(".py")) fileType = "Python";
      else if (fileName.endsWith(".js") || fileName.endsWith(".jsx")) fileType = "JavaScript";
      else if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) fileType = "TypeScript";
      else if (fileName.endsWith(".html")) fileType = "HTML";
      else if (fileName.endsWith(".css")) fileType = "CSS";
      else if (fileName.endsWith(".json")) fileType = "JSON";
      else if (fileName.endsWith(".zip")) fileType = "ZIP Archive";

      files.push({
        name: fileName,
        type: `${fileType} · ${lang.toUpperCase()}`,
        code: code.trim(),
        isDiff
      });
    }
  }

  // Look for naked/unwrapped SEARCH/REPLACE diff blocks (outside code blocks)
  const diffBlockRegex = /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g;
  let diffMatch;
  while ((diffMatch = diffBlockRegex.exec(content)) !== null) {
    const fullMatchText = diffMatch[0];
    // Check if this diff block was already captured inside a code block
    const alreadyExtracted = files.some(f => f.code.includes(fullMatchText));
    if (alreadyExtracted) continue;

    // Find filename in the text preceding the diff block (within last 150 characters)
    const searchStartIndex = Math.max(0, diffMatch.index - 150);
    const precedingText = content.substring(searchStartIndex, diffMatch.index);
    const fileMatch = precedingText.match(/`?(\/?[\w\-]+(?:\/[\w\-]+)*\.(?:py|js|ts|tsx|jsx|json|css|html|env|txt|md|yaml|yml|sh|bat|zip))`?/i);
    let fileName = fileMatch ? fileMatch[1] : "";

    // Fall back to prompt files if any
    if (!fileName && userPromptFilenames.length > 0) {
      fileName = userPromptFilenames[0];
    }

    if (fileName) {
      if (fileName.startsWith("/")) {
        fileName = fileName.substring(1);
      }

      let fileType = "Code";
      let lang = "txt";
      if (fileName.endsWith(".py")) { fileType = "Python"; lang = "python"; }
      else if (fileName.endsWith(".js")) { fileType = "JavaScript"; lang = "javascript"; }
      else if (fileName.endsWith(".jsx")) { fileType = "JavaScript"; lang = "jsx"; }
      else if (fileName.endsWith(".ts")) { fileType = "TypeScript"; lang = "typescript"; }
      else if (fileName.endsWith(".tsx")) { fileType = "TypeScript"; lang = "tsx"; }
      else if (fileName.endsWith(".html")) { fileType = "HTML"; lang = "html"; }
      else if (fileName.endsWith(".css")) { fileType = "CSS"; lang = "css"; }
      else if (fileName.endsWith(".json")) { fileType = "JSON"; lang = "json"; }

      const existing = files.find(f => f.name === fileName);
      if (existing) {
        existing.code = existing.code + "\n\n" + fullMatchText.trim();
        existing.isDiff = true;
      } else {
        files.push({
          name: fileName,
          type: `${fileType} · ${lang.toUpperCase()}`,
          code: fullMatchText.trim(),
          isDiff: true
        });
      }
    }
  }

  return files;
};

export const removeCodeBlocks = (text: string) => {
  if (!text) return "";
  return text.replace(/```\w*\n[\s\S]*?(?:```|$)/g, "").trim();
};

export const removeFileCodeBlocks = (content: string, extractedFiles: Array<{ name: string; code: string }>) => {
  if (!content) return "";
  const codeBlockRegex = /(```\w*\n[\s\S]*?(?:```|$))/g;
  let clean = content.replace(codeBlockRegex, (match) => {
    const blockMatch = match.match(/```\w*\n([\s\S]*?)(?:```|$)/);
    const code = blockMatch ? blockMatch[1].trim() : "";
    const isExtracted = extractedFiles.some(f => f.code.trim() === code);
    if (isExtracted) {
      return "";
    }
    return match;
  }).trim();

  // Strip naked diff blocks that were extracted
  extractedFiles.forEach(f => {
    if (f.code.includes("<<<<<<< SEARCH")) {
      const normalizedCode = f.code.trim();
      if (clean.includes(normalizedCode)) {
        clean = clean.replace(normalizedCode, "");
      } else {
        // Fallback for slight whitespace or CR/LF changes
        const regexStr = normalizedCode.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+');
        try {
          const rx = new RegExp(regexStr, 'g');
          clean = clean.replace(rx, "");
        } catch (_) {}
      }
    }
  });

  return clean.trim();
};

export const computeSessionFiles = (messages: Message[]) => {
  const list: Array<{ name: string; type: string; versions: Array<{ version: number; code: string }> }> = [];

  messages.forEach((m, idx) => {
    if (m.role === "assistant") {
      const { finalContent } = parseMessageContent(m.content);
      
      // Look for files mentioned in the preceding user message
      let userPromptFilenames: string[] = [];
      if (idx > 0) {
        const prevMsg = messages[idx - 1];
        if (prevMsg && prevMsg.role === "user") {
          userPromptFilenames = prevMsg.content.match(/\/?[\w\-]+(?:\/[\w\-]+)*\.(?:py|js|ts|tsx|jsx|json|css|html|env|txt|md|yaml|yml|sh|bat|zip)/gi) || [];
        }
      }

      const extracted = extractFilesFromContent(finalContent, userPromptFilenames);
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
        let codeToPush = file.code;
        
        if (file.isDiff) {
          const currentCode = lastVer ? lastVer.code : "";
          codeToPush = applyDiff(currentCode, file.code);
        }
        
        if (!lastVer || lastVer.code !== codeToPush) {
          existing.versions.push({
            version: existing.versions.length + 1,
            code: codeToPush,
          });
        }
      });
    }
  });

  return list;
};
export interface SourceItem {
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}

export const parseSources = (content: string) => {
  if (!content) return { cleanContent: "", sources: [] };
  const sourcesRegex = /<Sources\s+data="([^"]+)"\s*\/>/gi;
  let match;
  let sources: SourceItem[] = [];
  
  while ((match = sourcesRegex.exec(content)) !== null) {
    const rawData = match[1];
    const pairs = rawData.split('||');
    pairs.forEach((p) => {
      const parts = p.split('|');
      if (parts.length >= 2) {
        const title = parts[0];
        const url = parts[1];
        const snippet = parts[2] && parts[2] !== "empty" ? parts[2] : undefined;
        let domain = '';
        try {
          const matchDomain = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
          domain = matchDomain ? matchDomain[1] : url;
        } catch {
          domain = url;
        }
        if (!sources.some(s => s.url === url)) {
          sources.push({ title, url, domain, snippet });
        }
      }
    });
  }

  const cleanContent = content.replace(/<Sources\s+data="[^"]+"\s*\/>/gi, '').trim();
  return { cleanContent, sources };
};

export interface ImageItem {
  title: string;
  url: string;
}

export interface ImageGalleryInfo {
  query: string;
}

export const parseImageGallery = (content: string) => {
  if (!content) return { cleanContent: "", imageGalleryQuery: null };
  const galleryRegex = /<ImageGallery\s+query="([^"]*)"\s*\/>/gi;
  let match;
  let query: string | null = null;
  
  while ((match = galleryRegex.exec(content)) !== null) {
    query = match[1];
  }

  const cleanContent = content.replace(/<ImageGallery\s+query="[^"]*"\s*\/>/gi, '').trim();
  return { cleanContent, imageGalleryQuery: query };
};

export const parseImages = (content: string) => {
  if (!content) return { cleanContent: "", images: [] };
  const imagesRegex = /<Images\s+query="([^"]*)"\s+data="([^"]+)"\s*\/>/gi;
  let match;
  let images: ImageItem[] = [];
  
  while ((match = imagesRegex.exec(content)) !== null) {
    const rawData = match[2];
    const pairs = rawData.split('||');
    pairs.forEach((p) => {
      const parts = p.split('|');
      if (parts.length >= 2) {
        images.push({ title: parts[0], url: parts[1] });
      }
    });
  }

  const cleanContent = content.replace(/<Images\s+query="[^"]*"\s+data="[^"]+"\s*\/>/gi, '').trim();
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

export interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  category?: string;
}

export interface TimelineItem {
  title: string;
  events: TimelineEvent[];
}

export interface FunctionPlotItem {
  formula: string;
  minX?: number;
  maxX?: number;
}

export const parseScienceAndHistory = (content: string) => {
  if (!content) return { cleanContent: content, timeline: null, plot: null };
  
  let cleanContent = content;
  let timeline: TimelineItem | null = null;
  let plot: FunctionPlotItem | null = null;

  // 2. Timeline Tag: <Timeline ... /> or <render_timeline ... />
  const timelineRegex = /<(?:Timeline|render_timeline)\s+([^>]*?)\s*\/>/i;
  const timelineMatch = cleanContent.match(timelineRegex);
  if (timelineMatch) {
    const attrString = timelineMatch[1];
    const getAttr = (name: string): string => {
      const regex = new RegExp(`${name}="([^"]*)"`, 'i');
      const m = attrString.match(regex);
      return m ? m[1] : "";
    };
    const title = getAttr("title");
    const rawEvents = getAttr("events");
    let events: TimelineEvent[] = [];
    if (rawEvents) {
      const items = rawEvents.split("||");
      items.forEach(ev => {
        const parts = ev.split("|");
        if (parts.length >= 2) {
          events.push({
            date: parts[0],
            title: parts[1],
            description: parts[2] && parts[2] !== "empty" ? parts[2] : undefined,
            category: parts[3] && parts[3] !== "empty" ? parts[3] : undefined
          });
        }
      });
    }
    if (title && events.length > 0) {
      timeline = { title, events };
    }
    cleanContent = cleanContent.replace(timelineRegex, '').trim();
  }

  // 4. FunctionPlot Tag: <FunctionPlot formula="..." minX="..." maxX="..." />
  const plotRegex = /<FunctionPlot\s+([^>]*?)\s*\/>/i;
  const plotMatch = cleanContent.match(plotRegex);
  if (plotMatch) {
    const attrString = plotMatch[1];
    const getAttr = (name: string): string => {
      const regex = new RegExp(`${name}="([^"]*)"`, 'i');
      const m = attrString.match(regex);
      return m ? m[1] : "";
    };
    plot = {
      formula: getAttr("formula") || "x",
      minX: getAttr("minX") ? parseFloat(getAttr("minX")) : undefined,
      maxX: getAttr("maxX") ? parseFloat(getAttr("maxX")) : undefined
    };
    cleanContent = cleanContent.replace(plotRegex, '').trim();
  }

  return { cleanContent, timeline, plot };
};

export const parseChart = (content: string) => {
  if (!content) return { cleanContent: content, chart: null };
  
  let cleanContent = content;
  let chart: ChartItem | null = null;

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

  return { cleanContent, chart };
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

export const parseMcpWidgets = (content: string) => {
  if (!content) return { cleanContent: content, canva: null, gmail: null, calendar: null };
  
  let cleanContent = content;
  let canva: any = null;
  let gmail: any = null;
  let calendar: any = null;

  // 1. Canva Preview Tag: <CanvaPreview designId="..." name="..." embedUrl="..." />
  const canvaRegex = /<CanvaPreview\s+([^>]*?)\s*\/>/i;
  const canvaMatch = cleanContent.match(canvaRegex);
  if (canvaMatch) {
    const attrString = canvaMatch[1];
    const getAttr = (name: string): string => {
      const regex = new RegExp(`${name}="([^"]*)"`, 'i');
      const m = attrString.match(regex);
      return m ? m[1] : "";
    };
    canva = {
      designId: getAttr("designId"),
      name: getAttr("name"),
      embedUrl: getAttr("embedUrl")
    };
    cleanContent = cleanContent.replace(canvaRegex, '').trim();
  }

  // 2. Gmail List Tag: <GmailList emails="..." />
  const gmailRegex = /<GmailList\s+([^>]*?)\s*\/>/i;
  const gmailMatch = cleanContent.match(gmailRegex);
  if (gmailMatch) {
    const attrString = gmailMatch[1];
    const getAttr = (name: string): string => {
      const regex = new RegExp(`${name}="([^"]*)"`, 'i');
      const m = attrString.match(regex);
      return m ? m[1] : "";
    };
    const rawEmails = getAttr("emails");
    let emails: any[] = [];
    if (rawEmails) {
      const items = rawEmails.split("||");
      items.forEach((item, idx) => {
        const parts = item.split("|");
        if (parts.length >= 3) {
          emails.push({
            id: `gmail-msg-${idx}`,
            from: parts[0],
            subject: parts[1],
            snippet: parts[2],
            date: parts[3] || ""
          });
        }
      });
    }
    if (emails.length > 0) {
      gmail = { emails };
    } else {
      gmail = { emails: [] };
    }
    cleanContent = cleanContent.replace(gmailRegex, '').trim();
  }

  // 3. Calendar Timeline Tag: <CalendarTimeline events="..." />
  const calendarRegex = /<CalendarTimeline\s+([^>]*?)\s*\/>/i;
  const calendarMatch = cleanContent.match(calendarRegex);
  if (calendarMatch) {
    const attrString = calendarMatch[1];
    const getAttr = (name: string): string => {
      const regex = new RegExp(`${name}="([^"]*)"`, 'i');
      const m = attrString.match(regex);
      return m ? m[1] : "";
    };
    const rawEvents = getAttr("events");
    let events: any[] = [];
    if (rawEvents) {
      const items = rawEvents.split("||");
      items.forEach((item, idx) => {
        const parts = item.split("|");
        if (parts.length >= 2) {
          events.push({
            id: `cal-evt-${idx}`,
            title: parts[0],
            time: parts[1],
            location: parts[2] || ""
          });
        }
      });
    }
    if (events.length > 0) {
      calendar = { events };
    } else {
      calendar = { events: [] };
    }
    cleanContent = cleanContent.replace(calendarRegex, '').trim();
  }

  return { cleanContent, canva, gmail, calendar };
};

export interface ScheduleSetupItem {
  timings: string;
  interval: number;
  cron: string;
  instruction: string;
  suggested_name: string;
  estimated_loops: number;
}

export const parseScheduleSetup = (content: string) => {
  if (!content) return { cleanContent: content, scheduleSetup: null };
  
  let cleanContent = content;
  let scheduleSetup: ScheduleSetupItem | null = null;
  
  const regex = /<ScheduleSetup\s+([^>]*?)\s*\/>/i;
  const match = cleanContent.match(regex);
  if (match) {
    const attrString = match[1];
    const getAttr = (name: string): string => {
      const r = new RegExp(`${name}="([^"]*)"`, 'i');
      const m = attrString.match(r);
      return m ? m[1] : "";
    };
    
    scheduleSetup = {
      timings: getAttr("timings"),
      interval: parseInt(getAttr("interval")) || 24,
      cron: getAttr("cron"),
      instruction: getAttr("instruction"),
      suggested_name: getAttr("suggested_name") || "Schedule Job",
      estimated_loops: parseInt(getAttr("estimated_loops")) || 5
    };
    
    cleanContent = cleanContent.replace(regex, "").trim();
  }
  
  return { cleanContent, scheduleSetup };
};

export const parseMessageContent = (content: string) => {
  const { cleanContent: noSourcesContent, sources } = parseSources(content);
  const { cleanContent: noGalleryContent, imageGalleryQuery } = parseImageGallery(noSourcesContent);
  const { cleanContent: noImagesContent, images } = parseImages(noGalleryContent);
  const { cleanContent: noChartContent, chart } = parseChart(noImagesContent);
  const { cleanContent: noScienceContent, timeline, plot } = parseScienceAndHistory(noChartContent);
  const { cleanContent: noMapContent, map, weather } = parseMapAndWeather(noScienceContent);
  const { cleanContent: cleanTextContent, canva, gmail, calendar } = parseMcpWidgets(noMapContent);
  const { cleanContent: finalCleanContent, scheduleSetup } = parseScheduleSetup(cleanTextContent);
  
  let thinkingContent = "";
  let finalContent = finalCleanContent;

  const thinkStartIndex = finalCleanContent.indexOf("<think>");
  const thinkEndIndex = finalCleanContent.indexOf("</think>");

  if (thinkStartIndex !== -1) {
    if (thinkEndIndex !== -1) {
      thinkingContent = cleanTextContent.substring(thinkStartIndex + 7, thinkEndIndex).trim();
      finalContent = (cleanTextContent.substring(0, thinkStartIndex) + cleanTextContent.substring(thinkEndIndex + 8)).trim();
    } else {
      thinkingContent = cleanTextContent.substring(thinkStartIndex + 7).trim();
      finalContent = cleanTextContent.substring(0, thinkStartIndex).trim();
    }
  }

  if (finalContent) {
    finalContent = finalContent
      .replace(/^\s*---\s*$/gm, "")
      .replace(/(?<!-)\s*--(?!>|[a-zA-Z0-9])\s*(?!-)/g, " – ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  if (thinkingContent) {
    thinkingContent = thinkingContent
      .replace(/^\s*---\s*$/gm, "")
      .replace(/(?<!-)\s*--(?!>|[a-zA-Z0-9])\s*(?!-)/g, " – ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return { thinkingContent, finalContent, sources, imageGalleryQuery, images, map, weather, chart, timeline, plot, canva, gmail, calendar, scheduleSetup };
};

export function parseInlineElements(text: string, sources: any[] = []) {
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let tokenKey = 0;

  // Regex matches LaTeX inline equations ($...$ or \(...\)), URLs, bold, inline code, filenames, function signatures, or bracketed citations [1] / [ESPN] optionally followed by parenthesized URLs
  const regex = /(\$(?!\s)[^$]+?(?<!\s)\$|\\\(.*?\\\)|(\bhttps?:\/\/[^\s()<>]+(?:\([\w\d]+\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])|\b(?:www\.|(?<!@))[a-zA-Z0-9-]{2,}(?:\.[a-zA-Z0-9-]+)*(?:\.(?:com|in|net|org|co|io|app|edu|gov|xyz|info|biz|uk|us|me|tv|cc|ca|de|fr|jp|au|ru|br))\b(?:\/[^\s()<>`!"'\[\]{};:'".,]*|\.[a-zA-Z0-9]+|\?[a-zA-Z0-9-&=_]+)*|\*\*.*?\*\*|`.*?`|\b[\w\-]+\.(?:py|js|ts|tsx|json|css|html|env|txt|md|yaml|yml|sh|bat)\b|\b\w+[\w\-]*\(\)|\[\d+\]|\[[^\]]+\]\s*\(https?:\/\/[^\s)]+\)|\[[a-zA-Z0-9\s.\-&\u2197↗\ufe0f]{2,}\]))/gi;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(remaining)) !== null) {
    const matchIndex = match.index;
    const matchStr = match[0];

    if (matchIndex > lastIndex) {
      tokens.push(<React.Fragment key={tokenKey++}>{remaining.substring(lastIndex, matchIndex)}</React.Fragment>);
    }

    if (matchStr.startsWith("$") && matchStr.endsWith("$")) {
      const mathText = matchStr.slice(1, -1);
      tokens.push(<InlineMath key={tokenKey++} math={mathText} errorColor="#d4d4d8" />);
    } else if (matchStr.startsWith("\\(") && matchStr.endsWith("\\)")) {
      const mathText = matchStr.slice(2, -2);
      tokens.push(<InlineMath key={tokenKey++} math={mathText} errorColor="#d4d4d8" />);
    } else if (matchStr.startsWith("[") && matchStr.endsWith(")")) {
      // Handle standard [Label](URL) markdown links
      const closingBracketIndex = matchStr.indexOf("]");
      const cleanLabel = matchStr.slice(1, closingBracketIndex).replace(/[\u2197↗]\u200e?\ufe0f?/g, "").trim();
      const openParenIndex = matchStr.indexOf("(", closingBracketIndex);
      const targetUrl = matchStr.slice(openParenIndex + 1, -1).trim();

      tokens.push(
        <a
          key={tokenKey++}
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-500 [.light_&]:text-sky-600 hover:underline font-medium break-all select-text"
        >
          {cleanLabel || targetUrl}
        </a>
      );
    } else if (matchStr.startsWith("[") && matchStr.endsWith("]")) {
      tokens.push(<React.Fragment key={tokenKey++}>{matchStr}</React.Fragment>);
    } else {
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
          <strong key={tokenKey++} className="font-bold text-zinc-100 [.light_&]:text-[#141413]">
            {boldText}
          </strong>
        );
      } else if (matchStr.startsWith("`") && matchStr.endsWith("`")) {
        const codeText = matchStr.slice(1, -1);
        tokens.push(
          <code key={tokenKey++} className="bg-zinc-850/60 text-zinc-200 border border-zinc-700/50 [.light_&]:bg-[#efe9de] [.light_&]:text-[#141413] [.light_&]:border-[#c3c2b7] px-1.5 py-0.5 rounded font-mono text-[13.5px] mx-0.5">
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
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < remaining.length) {
    tokens.push(<React.Fragment key={tokenKey++}>{remaining.substring(lastIndex)}</React.Fragment>);
  }

  return tokens.length > 0 ? tokens : text;
}

export function renderTable(rows: string[][], key: string, sources: any[] = []) {
  if (rows.length === 0) return null;
  const headers = rows[0];
  const bodyRows = rows.slice(1);

  return (
    <div key={key} className="w-full my-3.5 overflow-x-auto rounded-xl border border-zinc-850 bg-zinc-950/40 custom-scrollbar select-text vk-table-container [.light_&]:bg-[#efe9de] [.light_&]:border-[#c3c2b7]">
      <table className="w-full text-left border-collapse min-w-[500px]">
        <thead>
          <tr className="border-b border-zinc-800/80 bg-zinc-900/10 [.light_&]:border-[#c3c2b7] [.light_&]:bg-black/5">
            {headers.map((h, idx) => (
              <th key={idx} className="px-4 py-2.5 text-[13px] font-semibold text-zinc-300 [.light_&]:text-[#141413] tracking-wide font-sans">
                {parseInlineElements(h, sources)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-900/60 [.light_&]:divide-[#c3c2b7]">
          {bodyRows.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-zinc-900/10 [.light_&]:hover:bg-black/5 transition-colors duration-150">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-2.5 text-[13px] text-zinc-400 [.light_&]:text-[#141413] font-sans leading-relaxed">
                  {parseInlineElements(cell, sources)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CodeSnippetBlock = ({ code, language }: { code: string; language: string }) => {
  const [copied, setCopied] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  React.useEffect(() => {
    const check = () => setIsLightMode(document.documentElement.classList.contains("light"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code snippet", err);
    }
  };

  // Syntax highlight using Prism-like token patterns
  const highlight = (src: string, lang: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    const lines = src.split("\n");

    const DARK = {
      keyword: "#c792ea",
      string: "#c3e88d",
      number: "#f78c6c",
      comment: "#546e7a",
      function: "#82aaff",
      className: "#ffcb6b",
      operator: "#89ddff",
      punctuation: "#89ddff",
      builtin: "#80cbc4",
      decorator: "#f07178",
      tag: "#f07178",
      attr: "#c792ea",
      plain: "#d4d4d4",
    };

    const LIGHT = {
      keyword: "#7c3aed",
      string: "#16a34a",
      number: "#d97706",
      comment: "#6b7280",
      function: "#2563eb",
      className: "#b45309",
      operator: "#0891b2",
      punctuation: "#374151",
      builtin: "#0f766e",
      decorator: "#dc2626",
      tag: "#b91c1c",
      attr: "#7c3aed",
      plain: "#1f2937",
    };

    const C = isLightMode ? LIGHT : DARK;

    const pyKeywords = /\b(import|from|as|def|class|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|try|except|finally|with|yield|lambda|pass|break|continue|raise|del|global|nonlocal|assert|async|await)\b/g;
    const jsKeywords = /\b(import|export|from|as|default|const|let|var|function|class|return|if|else|for|while|in|of|do|new|delete|typeof|instanceof|void|this|super|extends|implements|interface|type|enum|switch|case|break|continue|throw|try|catch|finally|async|await|yield|null|undefined|true|false|static|public|private|protected|abstract|readonly)\b/g;
    const generalKeywords = /\b(import|export|return|if|else|for|while|do|class|function|const|let|var|new|delete|try|catch|finally|null|true|false|async|await)\b/g;
    const strDoubleQ = /"(?:[^"\\]|\\.)*"/g;
    const strSingleQ = /'(?:[^'\\]|\\.)*'/g;
    const strBacktick = /`(?:[^`\\]|\\.)*`/g;
    const numbers = /\b(\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/g;
    const comments = /(\/\/.*|#.*|\/\*[\s\S]*?\*\/)/g;
    const funcDef = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;
    const decorator = /@([a-zA-Z_][a-zA-Z0-9_.]*)/g;

    const isLow = lang.toLowerCase();
    const keywords = isLow === "python" || isLow === "py" ? pyKeywords
      : (isLow === "javascript" || isLow === "js" || isLow === "typescript" || isLow === "ts" || isLow === "jsx" || isLow === "tsx") ? jsKeywords
      : generalKeywords;

    lines.forEach((line, lineIdx) => {
      if (lineIdx > 0) nodes.push("\n");

      // Tokenize this line
      const tokens: Array<{ start: number; end: number; type: string }> = [];

      const addMatches = (re: RegExp, type: string) => {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line)) !== null) {
          tokens.push({ start: m.index, end: m.index + m[0].length, type });
        }
      };

      addMatches(comments, "comment");
      addMatches(strDoubleQ, "string");
      addMatches(strSingleQ, "string");
      addMatches(strBacktick, "string");
      addMatches(numbers, "number");
      addMatches(decorator, "decorator");
      addMatches(funcDef, "function");
      addMatches(new RegExp(keywords.source, "g"), "keyword");

      // Sort tokens by start, remove overlaps
      tokens.sort((a, b) => a.start - b.start);
      const filtered: typeof tokens = [];
      let cursor = 0;
      for (const tok of tokens) {
        if (tok.start >= cursor) {
          filtered.push(tok);
          cursor = tok.end;
        }
      }

      // Build spans
      let pos = 0;
      filtered.forEach((tok, ti) => {
        if (tok.start > pos) {
          nodes.push(<span key={`${lineIdx}-plain-${ti}`} style={{ color: C.plain }}>{line.slice(pos, tok.start)}</span>);
        }
        const colorMap: Record<string, string> = {
          keyword: C.keyword,
          string: C.string,
          number: C.number,
          comment: C.comment,
          function: C.function,
          decorator: C.decorator,
        };
        nodes.push(
          <span key={`${lineIdx}-tok-${ti}`} style={{ color: colorMap[tok.type] || C.plain }}>
            {line.slice(tok.start, tok.end)}
          </span>
        );
        pos = tok.end;
      });

      if (pos < line.length) {
        nodes.push(<span key={`${lineIdx}-tail`} style={{ color: C.plain }}>{line.slice(pos)}</span>);
      }
    });

    return nodes;
  };

  const highlighted = highlight(code, language);

  return (
    <div className={`my-4 border rounded-xl overflow-hidden shadow-lg select-text font-mono w-full max-w-[100%] transition-colors duration-200 ${
      isLightMode ? "border-[#c3c2b7] bg-[#f0ede6]" : "border-zinc-800 bg-[#121215]"
    }`}>
      {/* Header bar */}
      <div className={`flex justify-between items-center px-4 py-2 border-b select-none transition-colors duration-200 ${
        isLightMode ? "bg-[#e8e3d9] border-[#c3c2b7] text-[#6c6a64]" : "bg-[#18181b] border-zinc-850 text-zinc-400"
      }`}>
        <span className="text-[11.5px] font-sans font-medium uppercase tracking-wider">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-sans font-medium transition-colors cursor-pointer ${
            isLightMode
              ? "bg-[#d9d3c7] hover:bg-[#c5beb2] text-[#3d3d3a] hover:text-[#141413]"
              : "bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 hover:text-white"
          }`}
        >
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code body */}
      <pre className={`p-4 overflow-x-auto text-[13px] leading-relaxed scrollbar-thin transition-colors duration-200 ${
        isLightMode ? "bg-[#f5f0e8] text-[#1f2937]" : "bg-[#0f0f12] text-zinc-300"
      }`}>
        <code>{highlighted}</code>
      </pre>
    </div>
  );
};

export function renderFormattedContent(content: string, sources: any[] = []) {
  if (!content) return null;
  
  // Pre-process and auto-correct unbalanced single-line $$ blocks
  const rawLines = content.split("\n");
  const lines = rawLines.map(line => {
    const trimmed = line.trim();
    if (trimmed.endsWith("$$") && !trimmed.startsWith("$$")) {
      return "$$" + line;
    }
    if (trimmed.startsWith("$$") && !trimmed.endsWith("$$")) {
      if (trimmed.length > 2 && !trimmed.substring(2).includes("$$")) {
        return line + "$$";
      }
    }
    return line;
  });

  const renderedElements: React.ReactNode[] = [];

  let inTable = false;
  let tableRows: string[][] = [];
  let tableKey = 0;

  let inBlockMath = false;
  let blockMathContent = "";

  let inCodeBlock = false;
  let codeBlockContent = "";
  let codeBlockLang = "";
  let codeBlockKey = 0;

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

    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        renderedElements.push(
          <CodeSnippetBlock 
            key={`code-${codeBlockKey++}`} 
            code={codeBlockContent} 
            language={codeBlockLang} 
          />
        );
        inCodeBlock = false;
        codeBlockContent = "";
        codeBlockLang = "";
      } else {
        const langMatch = line.trim().match(/^```(\w*)/);
        codeBlockLang = langMatch ? langMatch[1] : "";
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += (codeBlockContent ? "\n" : "") + line;
      continue;
    }

    if (line.trim() === "") {
      renderedElements.push(<div key={`space-${i}`} className="h-1.5" />);
      continue;
    }

    // Check for single-line block math ($$ equation $$)
    const trimmedLine = line.trim();
    const isSingleLineBlock = trimmedLine.startsWith("$$") && trimmedLine.endsWith("$$") && trimmedLine.length > 4;
    if (isSingleLineBlock) {
      const math = trimmedLine.slice(2, -2);
      renderedElements.push(
        <div key={`blockmath-${i}`} className="w-full overflow-x-auto flex justify-center py-2 select-text">
          <BlockMath math={math} errorColor="#d4d4d8" />
        </div>
      );
      continue;
    }

    if (line.trim().startsWith("$$") || line.trim().startsWith("\\[") || line.trim().startsWith("\\]")) {
      if (inBlockMath) {
        renderedElements.push(
          <div key={`blockmath-${i}`} className="w-full overflow-x-auto flex justify-center py-2 select-text">
            <BlockMath math={blockMathContent} errorColor="#d4d4d8" />
          </div>
        );
        blockMathContent = "";
        inBlockMath = false;
      } else {
        inBlockMath = true;
        const remaining = line.replace(/^\$\$/, "").replace(/^\\\[/, "").replace(/^\\\]/, "");
        if (remaining.trim()) {
          blockMathContent = remaining;
        }
      }
      continue;
    }

    if (inBlockMath) {
      blockMathContent += (blockMathContent ? "\n" : "") + line;
      continue;
    }

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
      renderedElements.push(renderTable(tableRows, `table-${tableKey++}`, sources));
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
          ? "text-[22px] font-bold text-zinc-100 [.light_&]:text-[#141413] vk-heading-1 mt-4 mb-2 block" 
          : level === 2 
            ? "text-[19px] font-bold text-zinc-100 [.light_&]:text-[#141413] vk-heading-2 mt-3.5 mb-1.5 block" 
            : "text-[17px] font-bold text-zinc-100 [.light_&]:text-[#141413] vk-heading-3 mt-3 mb-1 block";
        renderedElements.push(
          <span key={`h-${i}`} className={headingClass}>
            {parseInlineElements(headingText, sources)}
          </span>
        );
      } else {
        const bulletMatch = line.match(/^(\s*)[-*•]\s+(.*)$/);
        if (bulletMatch) {
          const indentLength = bulletMatch[1].length;
          const bulletText = bulletMatch[2];
          const mlClass = indentLength >= 4 ? "ml-6" : indentLength >= 2 ? "ml-3" : "ml-0";
          renderedElements.push(
            <div key={`bullet-${i}`} className={`flex items-start gap-2.5 my-1.5 leading-relaxed select-text ${mlClass}`}>
              <span className="inline-flex items-center justify-center w-3.5 mt-[9.6px] flex-shrink-0 select-none">
                <span className="w-[6.5px] h-[6.5px] rounded-full border-[1.5px] border-zinc-300 [.light_&]:border-[#141413] inline-block" />
              </span>
              <div className="flex-grow">
                {parseInlineElements(bulletText, sources)}
              </div>
            </div>
          );
        } else {
          renderedElements.push(
            <div key={`p-${i}`} className="min-h-[1.5em] mb-1">
              {parseInlineElements(line, sources)}
            </div>
          );
        }
      }
    }
  }

  if (inCodeBlock && codeBlockContent.trim()) {
    renderedElements.push(
      <CodeSnippetBlock 
        key={`code-${codeBlockKey++}`} 
        code={codeBlockContent} 
        language={codeBlockLang} 
      />
    );
  }

  if (inTable && tableRows.length > 0) {
    renderedElements.push(renderTable(tableRows, `table-${tableKey++}`, sources));
  }

  if (inBlockMath && blockMathContent.trim()) {
    renderedElements.push(
      <div key="blockmath-end" className="w-full overflow-x-auto flex justify-center py-2 select-text">
        <BlockMath math={blockMathContent} errorColor="#d4d4d8" />
      </div>
    );
  }

  return renderedElements;
}
