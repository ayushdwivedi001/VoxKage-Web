"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Download, ChevronDown, Check, History, ZoomIn, ZoomOut, ArrowLeft, X, Sliders } from "lucide-react";
import { BACKEND_URL } from "@/lib/api";

interface WordSection {
  heading?: string;
  level?: number;
  body?: string;
  page_break?: boolean;
  table?: {
    headers?: string[];
    rows?: string[][];
  };
}

interface WordDocState {
  version: number;
  doc_id: string;
  title: string;
  author?: string;
  header_text?: string;
  footer_text?: string;
  created_at?: string;
  style?: {
    primary_color?: string;
    secondary_color?: string;
    font_family?: string;
    font_size_body?: number;
    table_header_bg?: string;
    table_header_color?: string;
    table_alternate_bg?: string;
  };
  sections: WordSection[];
}

interface WordDocumentViewerProps {
  fileName: string;
  code: string; // JSON or HTML representation
  onClose: () => void;
  onBack?: () => void;
  onEditRequest?: (fileName: string) => void;
}

// A4 canonical dimensions (px at 96dpi)
const A4_W = 794;
const A4_H = 1123;

export default function WordDocumentViewer({
  fileName,
  code,
  onClose,
  onBack,
  onEditRequest,
}: WordDocumentViewerProps) {
  const [docData, setDocData] = useState<WordDocState | null>(null);
  const [versions, setVersions] = useState<WordDocState[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(100);
  const [showVersionDropdown, setShowVersionDropdown] = useState<boolean>(false);

  // Container width tracking for auto-scale on mobile
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Math.min(window.innerWidth, 900);
    }
    return 360;
  });

  // Touch pinch-to-zoom gesture tracking
  const initialTouchDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(100);

  // Immediate layout measurement on mount & window resize
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 360);
      if (w > 0) setContainerWidth(w);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    window.addEventListener("resize", updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  // Multi-touch pinch zoom handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialTouchDistRef.current = dist;
      initialZoomRef.current = zoomScale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && initialTouchDistRef.current !== null) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = currentDist / initialTouchDistRef.current;
      const newZoom = Math.min(200, Math.max(50, Math.round(initialZoomRef.current * factor)));
      setZoomScale(newZoom);
    }
  };

  const handleTouchEnd = () => {
    initialTouchDistRef.current = null;
  };

  useEffect(() => {
    try {
      if (code.trim().startsWith("{")) {
        const parsed = JSON.parse(code);
        if (parsed.sections) {
          setDocData(parsed);
          setSelectedVersion(parsed.version || 1);
          setVersions([parsed]);
          return;
        }
      }
    } catch (e) {
      console.warn("Could not parse direct JSON word doc, constructing structural state...");
    }

    // Baseline structure if given HTML / Markdown text
    const fallbackState: WordDocState = {
      version: 1,
      doc_id: fileName.replace(/\.[^/.]+$/, ""),
      title: fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
      author: "VoxKage AI",
      header_text: "VoxKage Document",
      footer_text: "Page {page} of {pages}",
      sections: [
        {
          heading: "Document Overview",
          level: 1,
          body: code.replace(/<[^>]*>/g, "")
        }
      ]
    };
    setDocData(fallbackState);
    setSelectedVersion(1);
    setVersions([fallbackState]);
  }, [code, fileName]);

  const activeDoc = versions.find((v) => v.version === selectedVersion) || docData;

  const handleDownloadDocx = async () => {
    if (!activeDoc) return;
    setIsExporting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/mcp/word/export-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeDoc),
      });

      if (!res.ok) throw new Error("Failed to generate .docx file");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeDoc.title.replace(/[^a-zA-Z0-9_\-]/g, "_")}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export .docx error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!activeDoc) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0d0d11] [.light_&]:bg-[#efe9de] text-zinc-400 [.light_&]:text-[#6C6A64]">
        <History className="w-6 h-6 animate-pulse mr-2" />
        <span className="text-sm">Loading Word document...</span>
      </div>
    );
  }

  const primaryColor = activeDoc.style?.primary_color || "#1F497D";
  const secondaryColor = activeDoc.style?.secondary_color || "#4A5568";
  const tableHdrBg = activeDoc.style?.table_header_bg || primaryColor;
  const tableHdrColor = activeDoc.style?.table_header_color || "#FFFFFF";
  const tableAltBg = activeDoc.style?.table_alternate_bg || "#F5F0E8";

  // â”€â”€ Auto-scale calculation â”€â”€
  // Padding: 16px total horizontal padding on small screens (<640px), 48px on desktop
  const isMobile = containerWidth < 640;
  const horizontalPadding = isMobile ? 16 : 48;
  const availableWidth = Math.max(100, containerWidth - horizontalPadding);
  // Natural fit scale ensures the 794px card fits 100% inside the viewport on mobile
  const naturalScale = Math.min(1, availableWidth / A4_W);
  // User zoom scale (multiplied by natural fit scale)
  const finalScale = naturalScale * (zoomScale / 100);

  const scaledW = Math.round(A4_W * finalScale);
  const scaledH = Math.round(A4_H * finalScale);

  return (
    <div className="flex flex-col h-full bg-[#0d0d11] [.light_&]:bg-[#efe9de] border-l border-zinc-800/80 [.light_&]:border-[#e6dfd8] w-full relative z-20 overflow-hidden">

      {/* â”€â”€ Top Header â€” mirrors FileInspectorPanel header exactly â”€â”€ */}
      <div className="flex items-center justify-between px-2.5 sm:px-5 py-2 min-h-[56px] border-b border-zinc-800/80 [.light_&]:border-[#e6dfd8] bg-[#0d0d11] [.light_&]:bg-[#efe9de] select-none flex-shrink-0 gap-1.5 sm:gap-3 w-full max-w-full overflow-hidden">

        {/* Left Side: Back Button + W Icon + Filename + Version Pill + Edit */}
        <div className="min-w-0 flex items-center gap-1 sm:gap-2 flex-shrink overflow-hidden">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 text-zinc-300 [.light_&]:text-[#141413] hover:text-white [.light_&]:hover:text-black bg-zinc-900 [.light_&]:bg-[#e6dfd8] border border-zinc-800 [.light_&]:border-[#d9d2c9] hover:border-zinc-700 rounded-xl cursor-pointer transition-all duration-200 mr-0.5 select-none flex-shrink-0"
              aria-label="Back"
              title="Back to Artifacts"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          <div
            style={{ backgroundColor: primaryColor }}
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center text-white font-bold text-[11px] sm:text-xs shadow-xs flex-shrink-0"
          >
            W
          </div>

          <span
            className="text-[13px] sm:text-[14.5px] font-medium text-zinc-300 [.light_&]:text-[#141413] font-sans tracking-wide truncate max-w-[80px] xs:max-w-[120px] sm:max-w-[200px]"
            title={fileName}
          >
            {activeDoc.title || fileName}
          </span>

          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowVersionDropdown(!showVersionDropdown)}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-zinc-900/60 [.light_&]:bg-[#e6dfd8] border border-zinc-800/50 [.light_&]:border-[#d9d2c9] hover:border-zinc-700 text-zinc-300 [.light_&]:text-[#141413] hover:text-zinc-100 rounded-lg transition-all duration-200 cursor-pointer"
            >
              <History className="w-3 h-3 text-[#CC785C] flex-shrink-0" />
              <span>v{activeDoc.version}</span>
              {versions.length > 1 && <ChevronDown className="w-3 h-3 text-zinc-500 [.light_&]:text-[#6c6a64]" />}
            </button>

            {showVersionDropdown && versions.length > 0 && (
              <div className="absolute left-0 mt-1 w-36 bg-[#0d0d11] [.light_&]:bg-[#faf9f5] border border-zinc-800 [.light_&]:border-[#e6dfd8] rounded-lg shadow-2xl z-50 py-1">
                {versions.map((ver) => (
                  <button
                    key={ver.version}
                    type="button"
                    onClick={() => {
                      setSelectedVersion(ver.version);
                      setShowVersionDropdown(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-zinc-800/60 [.light_&]:hover:bg-[#efe9de] text-zinc-300 [.light_&]:text-[#141413] text-left transition-colors cursor-pointer"
                  >
                    <span>Version {ver.version}</span>
                    {ver.version === activeDoc.version && (
                      <Check className="w-3 h-3 text-[#CC785C]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onEditRequest?.(fileName)}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 bg-[#141416] [.light_&]:bg-[#e6dfd8] border border-zinc-800 [.light_&]:border-[#d9d2c9] hover:border-zinc-700 text-zinc-300 [.light_&]:text-[#141413] hover:text-zinc-100 [.light_&]:hover:text-black text-[12px] font-medium rounded-lg cursor-pointer transition-all duration-200 flex-shrink-0"
            title="Attach Word document context to prompt for editing"
          >
            <Sliders className="w-3.5 h-3.5 text-zinc-400 [.light_&]:text-[#3d3d3a]" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        </div>

        {/* Right Side: Zoom Controls (Visible on Desktop & Mobile) + Download + Close */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="flex items-center gap-0.5 bg-zinc-900/60 [.light_&]:bg-[#e6dfd8] p-0.5 rounded-lg border border-zinc-800/50 [.light_&]:border-[#d9d2c9]">
            <button
              type="button"
              onClick={() => setZoomScale(Math.max(50, zoomScale - 10))}
              className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-200 [.light_&]:hover:text-[#141413] rounded-md transition-all duration-200 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 sm:w-9 text-center font-mono text-[10px] sm:text-[11px] text-zinc-300 [.light_&]:text-[#141413] select-none">
              {zoomScale}%
            </span>
            <button
              type="button"
              onClick={() => setZoomScale(Math.min(180, zoomScale + 10))}
              className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-zinc-400 [.light_&]:text-[#6c6a64] hover:text-zinc-200 [.light_&]:hover:text-[#141413] rounded-md transition-all duration-200 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadDocx}
            disabled={isExporting}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-zinc-800/40 [.light_&]:bg-[#e6dfd8] hover:bg-zinc-800 [.light_&]:hover:bg-[#d9d2c9] text-zinc-300 [.light_&]:text-[#141413] hover:text-white text-[12px] sm:text-[12.5px] font-medium transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Download"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-800/40 [.light_&]:bg-[#e6dfd8] hover:bg-zinc-800 [.light_&]:hover:bg-[#d9d2c9] text-zinc-400 [.light_&]:text-[#141413] hover:text-zinc-200 transition-all duration-200 cursor-pointer"
            aria-label="Close panel"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* â”€â”€ Main A4 Document Workspace Viewport (Multi-Page Stack with Pinch-Zoom Support) â”€â”€ */}
      <div
        ref={scrollContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative flex-1 overflow-y-auto overflow-x-auto custom-chat-scrollbar py-4 sm:py-6 flex flex-col items-center bg-[#1a1a1f] [.light_&]:bg-[#e8e3dc] gap-6 select-none"
        style={{
          paddingLeft: isMobile ? 8 : 24,
          paddingRight: isMobile ? 8 : 24,
          touchAction: "pan-x pan-y",
        }}
      >
        {(() => {
          // â”€â”€ A4 Page Pagination Calculation â”€â”€
          const normalizedSections: WordSection[] = [];
          (activeDoc.sections || []).forEach((sec) => {
            if (sec.body && sec.body.length > 800) {
              const paragraphs = sec.body.split(/\n\n+/).filter((p) => p.trim());
              if (paragraphs.length > 1) {
                paragraphs.forEach((p, pIdx) => {
                  normalizedSections.push({
                    heading: pIdx === 0 ? sec.heading : undefined,
                    level: sec.level,
                    body: p,
                    page_break: pIdx === 0 ? sec.page_break : false,
                    table: pIdx === paragraphs.length - 1 ? sec.table : undefined,
                  });
                });
              } else {
                normalizedSections.push(sec);
              }
            } else {
              normalizedSections.push(sec);
            }
          });

          const pages: Array<{ pageNumber: number; isFirstPage: boolean; sections: WordSection[] }> = [];
          let currentPageSections: WordSection[] = [];
          let currentHeight = 0;
          const page1Budget = 648; // Height allowance for Page 1
          const otherPageBudget = 680; // Height allowance for Page 2+
          let activeBudget = page1Budget;

          const estimateSectionHeight = (sec: WordSection): number => {
            let h = 0;
            if (sec.heading) h += 40;
            if (sec.body) {
              const lines = sec.body.split("\n").filter((l) => l.trim().length > 0);
              lines.forEach((line) => {
                const estLineCount = Math.max(1, Math.ceil(line.length / 95));
                h += estLineCount * 18 + 4;
              });
            }
            if (sec.table) {
              const rowCount = (sec.table.headers ? 1 : 0) + (sec.table.rows?.length || 0);
              h += 30 + rowCount * 24 + 12;
            }
            return Math.max(h, 20);
          };

          normalizedSections.forEach((sec) => {
            const secH = estimateSectionHeight(sec);
            const forcePageBreak = Boolean(sec.page_break) && currentPageSections.length > 0;

            if (!forcePageBreak && (currentHeight + secH <= activeBudget || currentPageSections.length === 0)) {
              currentPageSections.push(sec);
              currentHeight += secH;
            } else {
              pages.push({
                pageNumber: pages.length + 1,
                isFirstPage: pages.length === 0,
                sections: currentPageSections,
              });
              currentPageSections = [sec];
              currentHeight = secH;
              activeBudget = otherPageBudget;
            }
          });

          if (currentPageSections.length > 0) {
            pages.push({
              pageNumber: pages.length + 1,
              isFirstPage: pages.length === 0,
              sections: currentPageSections,
            });
          }

          const totalPages = pages.length;

          return pages.map((page, pIdx) => {
            const footerTextFormatted = (activeDoc.footer_text || "Page {page} of {pages}")
              .replace("{page}", String(page.pageNumber))
              .replace("{pages}", String(totalPages));

            return (
              // Outer wrapper: sized to scaledW and scaledH â€” centers nicely
              <div
                key={pIdx}
                style={{
                  width: scaledW,
                  height: scaledH,
                  position: "relative",
                  flexShrink: 0,
                  margin: "0 auto",
                }}
              >
                {/* Inner A4 card â€” fixed 794Ã—1123px, scaled smoothly via CSS transform */}
                <div
                  style={{
                    width: A4_W,
                    height: A4_H,
                    transform: `scale(${finalScale})`,
                    transformOrigin: "top left",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    overflow: "hidden",
                  }}
                  className="bg-white text-[#141413] shadow-2xl border border-[#E6DFD8] rounded-sm p-8 sm:p-10 flex flex-col justify-between select-text"
                >
                  {/* Top Header Area (matches MS Word â€” right-aligned header_text ONLY) */}
                  <div>
                    <div className="flex justify-end items-center pb-3 mb-6 border-b border-[#E6DFD8] text-xs text-[#6C6A64] font-medium tracking-wide">
                      <span className="truncate max-w-[80%] text-right text-[#6C6A64]">
                        {activeDoc.header_text || "VoxKage Document"}
                      </span>
                    </div>

                    {/* Page 1 Document Title Banner */}
                    {page.isFirstPage && (
                      <div className="mb-6">
                        <h1
                          style={{ color: primaryColor }}
                          className="text-3xl font-serif font-bold tracking-tight mb-1.5"
                        >
                          {activeDoc.title}
                        </h1>
                        <p className="text-xs text-[#6C6A64] pb-3 border-b border-[#EBE6DF]">
                          Version {activeDoc.version} â€¢ Authored by {activeDoc.author || "VoxKage AI"}
                        </p>
                      </div>
                    )}

                    {/* Page Sections */}
                    <div className="space-y-5">
                      {page.sections.map((sec, sIdx) => (
                        <div key={sIdx} className="space-y-2.5">
                          {sec.heading && (
                            <h2
                              style={{
                                color: sec.level === 1 ? primaryColor : secondaryColor,
                                borderColor: sec.level === 1 ? `${primaryColor}33` : "#EBE6DF"
                              }}
                              className={`font-serif font-semibold ${
                                sec.level === 2
                                  ? "text-xl border-b pb-1"
                                  : sec.level === 3
                                  ? "text-lg"
                                  : "text-2xl border-b pb-1"
                              }`}
                            >
                              {sec.heading}
                            </h2>
                          )}

                          {sec.body && (
                            <div className="text-sm leading-relaxed text-[#3D3D3A] whitespace-pre-wrap font-sans">
                              {sec.body}
                            </div>
                          )}

                          {/* Styled Table */}
                          {sec.table && (
                            <div className="my-3 overflow-x-auto rounded-md border border-[#E6DFD8]">
                              <table className="w-full text-left border-collapse text-xs">
                                {sec.table.headers && sec.table.headers.length > 0 && (
                                  <thead>
                                    <tr
                                      style={{ backgroundColor: tableHdrBg, color: tableHdrColor }}
                                      className="font-semibold"
                                    >
                                      {sec.table.headers.map((hdr, hIdx) => (
                                        <th key={hIdx} className="px-3 py-2 border-r border-white/20 last:border-r-0">
                                          {hdr}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                )}
                                <tbody>
                                  {sec.table.rows?.map((row, rIdx) => (
                                    <tr
                                      key={rIdx}
                                      style={{ backgroundColor: rIdx % 2 === 0 ? "#FFFFFF" : tableAltBg }}
                                    >
                                      {row.map((cell, cIdx) => (
                                        <td
                                          key={cIdx}
                                          className="px-3 py-2 border-t border-[#E6DFD8] border-r border-[#E6DFD8] last:border-r-0 text-[#3D3D3A]"
                                        >
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Footer Area (matches MS Word centered layout) */}
                  <div className="pt-4 mt-8 border-t border-[#E6DFD8] flex justify-center items-center text-xs text-[#6C6A64]">
                    <span className="font-mono font-medium text-[#3D3D3A]">
                      {footerTextFormatted}
                    </span>
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

