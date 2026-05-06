"use client";
import React, { useState, useRef } from "react";

export default function Tooltip({ text, children }) {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  if (!text) return children;

  const show = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.top - 10, left: r.left + r.width / 2 });
    }
  };
  const hide = () => setPos(null);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {pos && (
        <div style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          transform: "translate(-50%, -100%)",
          background: "#1F2937",
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: 400,
          lineHeight: "1.5",
          padding: "8px 12px",
          borderRadius: 8,
          maxWidth: 220,
          width: "max-content",
          whiteSpace: "normal",
          zIndex: 9999,
          pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        }}>
          {text}
        </div>
      )}
    </div>
  );
}
