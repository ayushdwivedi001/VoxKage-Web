import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

interface ZoomPreviewProps {
  src: string;
  thumbnailRect: DOMRect | null;
  onClose: () => void;
}

export default function ZoomImagePreview({ src, thumbnailRect, onClose }: ZoomPreviewProps) {
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "fixed",
    top: thumbnailRect?.top ?? "50%",
    left: thumbnailRect?.left ?? "50%",
    width: thumbnailRect?.width ?? "100px",
    height: thumbnailRect?.height ?? "100px",
    transform: thumbnailRect ? "none" : "translate(-50%, -50%) scale(0.8)",
    opacity: thumbnailRect ? 1 : 0,
    zIndex: 9999,
    borderRadius: "12px",
    overflow: "hidden",
    objectFit: "contain",
  });

  const [overlayOpacity, setOverlayOpacity] = useState(0);

  useEffect(() => {
    // Smooth FLIP zoom transition to center of viewport
    const timer = setTimeout(() => {
      setStyle({
        position: "fixed",
        top: "50%",
        left: "50%",
        width: "min(90vw, 1000px)",
        height: "min(80vh, 700px)",
        transform: "translate(-50%, -50%)",
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        zIndex: 9999,
        borderRadius: "16px",
        overflow: "hidden",
        objectFit: "contain",
        opacity: 1,
      });
      setOverlayOpacity(0.85);
    }, 20);

    return () => clearTimeout(timer);
  }, [thumbnailRect]);

  const handleClose = () => {
    // Animate coordinates back to the thumbnail container bounds
    if (thumbnailRect) {
      setStyle({
        position: "fixed",
        top: thumbnailRect.top,
        left: thumbnailRect.left,
        width: thumbnailRect.width,
        height: thumbnailRect.height,
        transform: "none",
        transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        zIndex: 9999,
        borderRadius: "12px",
        overflow: "hidden",
        objectFit: "contain",
        opacity: 0.3,
      });
    } else {
      setStyle((prev) => ({
        ...prev,
        transform: "translate(-50%, -50%) scale(0.8)",
        opacity: 0,
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }));
    }
    setOverlayOpacity(0);
    setTimeout(onClose, 360);
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center select-none">
      {/* Dimmed Background Overlay */}
      <div 
        className="absolute inset-0 bg-[#070709] transition-opacity duration-300 cursor-pointer"
        style={{ opacity: overlayOpacity }}
        onClick={handleClose}
      />
      
      {/* Zoomed Target Image element */}
      <img 
        src={src} 
        alt="Enlarged screenshot preview" 
        style={style}
        className="shadow-2xl border border-zinc-800/80 bg-zinc-950/60"
      />
      
      {/* Top Right Close button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-[10000] flex items-center justify-center w-11 h-11 rounded-full bg-[#121215]/80 hover:bg-[#18181c] border border-zinc-800 text-zinc-400 hover:text-zinc-150 transition-all duration-200 cursor-pointer active:scale-95"
        aria-label="Close image preview"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
