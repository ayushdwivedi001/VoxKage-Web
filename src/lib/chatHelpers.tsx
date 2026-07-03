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
        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-sans font-medium bg-[#1e293b]/70 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all duration-150 cursor-pointer"
      >
        {shortLabel} ↗
      </a>
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#0c0c0e] border border-zinc-800 rounded-xl shadow-2xl z-50 text-[12px] text-zinc-300 font-sans leading-normal pointer-events-none animate-fadeIn block text-left">
          <span className="block text-white font-medium mb-1 line-clamp-2">
            {source.title || "Consulted Source"}
          </span>
          <span className="block text-zinc-500 font-mono text-[10px] truncate">
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

export interface ChemistryItem {
  compound: string;
  formula: string;
  weight: string;
  smiles: string;
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

export interface CalculatorItem {
  type: "loan" | "compound" | "tax";
  title: string;
}

export interface FunctionPlotItem {
  formula: string;
  minX?: number;
  maxX?: number;
}

export const parseScienceAndHistory = (content: string) => {
  if (!content) return { cleanContent: content, chemistry: null, timeline: null, calculator: null, plot: null };
  
  let cleanContent = content;
  let chemistry: ChemistryItem | null = null;
  let timeline: TimelineItem | null = null;
  let calculator: CalculatorItem | null = null;
  let plot: FunctionPlotItem | null = null;

  // 1. Chemistry Tag: <Chemistry compound="..." formula="..." weight="..." smiles="..." />
  const chemRegex = /<Chemistry\s+([^>]*?)\s*\/>/i;
  const chemMatch = cleanContent.match(chemRegex);
  if (chemMatch) {
    const attrString = chemMatch[1];
    const getAttr = (name: string): string => {
      const regex = new RegExp(`${name}="([^"]*)"`, 'i');
      const m = attrString.match(regex);
      return m ? m[1] : "";
    };
    chemistry = {
      compound: getAttr("compound"),
      formula: getAttr("formula"),
      weight: getAttr("weight"),
      smiles: getAttr("smiles")
    };
    cleanContent = cleanContent.replace(chemRegex, '').trim();
  }

  // 2. Timeline Tag: <Timeline title="..." events="..." />
  const timelineRegex = /<Timeline\s+([^>]*?)\s*\/>/i;
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

  // 3. Calculator Tag: <Calculator type="..." title="..." />
  const calcRegex = /<Calculator\s+([^>]*?)\s*\/>/i;
  const calcMatch = cleanContent.match(calcRegex);
  if (calcMatch) {
    const attrString = calcMatch[1];
    const getAttr = (name: string): string => {
      const regex = new RegExp(`${name}="([^"]*)"`, 'i');
      const m = attrString.match(regex);
      return m ? m[1] : "";
    };
    calculator = {
      type: (getAttr("type") || "loan") as "loan" | "compound" | "tax",
      title: getAttr("title")
    };
    cleanContent = cleanContent.replace(calcRegex, '').trim();
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

  return { cleanContent, chemistry, timeline, calculator, plot };
};

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
  const { cleanContent: noScienceContent, chemistry, timeline, calculator, plot } = parseScienceAndHistory(noChartContent);
  const { cleanContent: cleanTextContent, map, weather } = parseMapAndWeather(noScienceContent);
  
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

  return { thinkingContent, finalContent, sources, images, map, weather, chart, flow, chemistry, timeline, calculator, plot };
};

export function parseInlineElements(text: string, sources: any[] = []) {
  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let tokenKey = 0;

  // Regex matches LaTeX inline equations ($...$ or \(...\)), URLs, bold, inline code, filenames, function signatures, or bracketed citations [1] / [ESPN]
  const regex = /(\$(?!\s)[^$]+?(?<!\s)\$|\\\(.*?\\\)|(\bhttps?:\/\/[^\s()<>]+(?:\([\w\d]+\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])|\b(?:www\.|(?<!@))[a-zA-Z0-9-]{2,}(?:\.[a-zA-Z0-9-]+)*(?:\.(?:com|in|net|org|co|io|app|edu|gov|xyz|info|biz|uk|us|me|tv|cc|ca|de|fr|jp|au|ru|br))\b(?:\/[^\s()<>`!"'\[\]{};:'".,]*|\.[a-zA-Z0-9]+|\?[a-zA-Z0-9-&=_]+)*|\*\*.*?\*\*|`.*?`|\b[\w\-]+\.(?:py|js|ts|tsx|json|css|html|env|txt|md|yaml|yml|sh|bat)\b|\b\w+[\w\-]*\(\)|\[\d+\]|\[[a-zA-Z0-9\s.\-&]{2,}(?: ↗)?\]))/gi;
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
    } else if (matchStr.startsWith("[") && matchStr.endsWith("]")) {
      const cleanLabel = matchStr.slice(1, -1).replace(/ ↗$/, "").trim();
      const numIdx = parseInt(cleanLabel);
      let matchedSource = null;

      if (!isNaN(numIdx) && sources && sources[numIdx - 1]) {
        matchedSource = sources[numIdx - 1];
      } else if (sources && sources.length > 0) {
        matchedSource = sources.find(s => {
          const dom = (s.domain || "").toLowerCase();
          const tit = (s.title || "").toLowerCase();
          const lbl = cleanLabel.toLowerCase();
          return dom.includes(lbl) || lbl.includes(dom.replace("www.", "")) || tit.includes(lbl);
        });
      }

      if (matchedSource) {
        const sourceIndex = sources.indexOf(matchedSource) + 1;
        tokens.push(
          <CitationPill source={matchedSource} index={sourceIndex} key={tokenKey++} />
        );
      } else {
        tokens.push(<React.Fragment key={tokenKey++}>{matchStr}</React.Fragment>);
      }
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
    <div key={key} className="w-full my-3.5 overflow-x-auto rounded-xl border border-zinc-850 bg-zinc-950/40 custom-scrollbar select-text">
      <table className="w-full text-left border-collapse min-w-[500px]">
        <thead>
          <tr className="border-b border-zinc-800/80 bg-zinc-900/10">
            {headers.map((h, idx) => (
              <th key={idx} className="px-4 py-2.5 text-[13px] font-semibold text-zinc-300 tracking-wide font-sans">
                {parseInlineElements(h, sources)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-900/60">
          {bodyRows.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-zinc-900/10 transition-colors duration-150">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-2.5 text-[13px] text-zinc-400 font-sans leading-relaxed">
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
          ? "text-[22px] font-bold text-zinc-100 mt-4 mb-2 block" 
          : level === 2 
            ? "text-[19px] font-bold text-zinc-100 mt-3.5 mb-1.5 block" 
            : "text-[17px] font-bold text-zinc-100 mt-3 mb-1 block";
        renderedElements.push(
          <span key={`h-${i}`} className={headingClass}>
            {parseInlineElements(headingText, sources)}
          </span>
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
