"use client";

import { useState, useRef, useEffect } from "react";

export default function usePanelResizer(initialWidth = 480) {
  const [rightPanelWidth, setRightPanelWidth] = useState(initialWidth);
  const isDraggingRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;

      const mainEl = document.querySelector("main");
      if (!mainEl) return;

      const rect = mainEl.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const totalWidth = rect.width;
      const newRightWidth = totalWidth - relativeX;

      const minChatWidth = 380;
      const minCodeWidth = 300;

      if (relativeX >= minChatWidth && newRightWidth >= minCodeWidth) {
        setRightPanelWidth(newRightWidth);
      }
    };

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
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

  return {
    rightPanelWidth,
    setRightPanelWidth,
    handlePointerDown,
  };
}
