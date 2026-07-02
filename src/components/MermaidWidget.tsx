import React, { useEffect, useState, useRef } from "react";

interface MermaidWidgetProps {
  chart: string;
  isExpanded?: boolean;
}

export default function MermaidWidget({ chart, isExpanded = false }: MermaidWidgetProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`mermaid-${Math.floor(Math.random() * 100000)}`);

  useEffect(() => {
    let active = true;

    async function renderDiagram() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          themeVariables: {
            background: "#0c0c0e",
            primaryColor: "#27272a",
            primaryTextColor: "#d4d4d8",
            lineColor: "#cc785c",
            secondaryColor: "#18181b",
            tertiaryColor: "#18181b",
            fontSize: "12px",
            fontFamily: "monospace"
          }
        });

        // Safe rendering
        const { svg: renderedSvg } = await mermaid.render(idRef.current, chart.trim());
        if (active) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: any) {
        console.error("Mermaid error:", err);
        if (active) {
          setError("Failed to parse diagram notation.");
        }
      }
    }

    renderDiagram();

    return () => {
      active = false;
    };
  }, [chart]);

  return (
    <div className={`w-full mx-auto bg-[#0c0c0e]/95 border border-zinc-850/60 rounded-2xl p-4.5 flex flex-col gap-3 shadow-2xl select-none transition-all duration-300 ${
      isExpanded ? "max-w-[1000px] my-0 p-6 md:p-8" : "max-w-[620px] my-3"
    }`}>
      <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
        <span className="text-[10px] font-mono tracking-wider uppercase text-blue-400 font-medium">CS Topology / Diagram</span>
      </div>

      <div className={`w-full overflow-auto flex justify-center bg-zinc-950/40 rounded-xl border border-zinc-900 custom-scrollbar relative transition-all duration-300 ${
        isExpanded ? "min-h-[500px] max-h-[70vh] p-6" : "min-h-[100px] py-2"
      }`}>
        {error ? (
          <div className="text-[12px] text-red-400 font-mono flex items-center justify-center p-4">
            {error}
          </div>
        ) : svg ? (
          <div
            ref={containerRef}
            className="w-full flex justify-center text-zinc-300 font-mono select-text"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="text-[12px] text-zinc-500 font-mono animate-pulse flex items-center justify-center p-4">
            Compiling topology chart...
          </div>
        )}
      </div>
    </div>
  );
}
