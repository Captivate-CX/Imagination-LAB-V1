"use client";

import { useEffect, useRef } from "react";

export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
      <button ref={closeRef} type="button" className="lightbox-close" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
