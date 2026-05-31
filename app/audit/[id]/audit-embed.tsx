"use client";

import { useEffect, useRef, useState } from "react";

interface AuditEmbedProps {
  src: string;
}

export function AuditEmbed({ src }: AuditEmbedProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1200);

  useEffect(() => {
    function handle(event: MessageEvent) {
      if (event.source !== ref.current?.contentWindow) return;
      const data = event.data;
      if (data && data.type === "audit-embed-height" && typeof data.height === "number") {
        setHeight(Math.max(800, Math.ceil(data.height)));
      }
    }
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, []);

  return (
    <iframe
      ref={ref}
      src={src}
      title="Audit"
      className="block w-full border-0 bg-cream"
      style={{ height }}
    />
  );
}
