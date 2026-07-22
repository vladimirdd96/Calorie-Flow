"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const focusableSelector = ["button:not([disabled])", "input:not([disabled]):not([type='hidden'])", "select:not([disabled])", "textarea:not([disabled])", "a[href]", "[tabindex]:not([tabindex='-1'])"].join(",");

function useModalFocus(onClose?: () => void) {
  const surfaceRef = useRef<HTMLElement>(null); const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => { const surface = surfaceRef.current; const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; if (!surface) return; const focusable = () => [...surface.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => !element.hidden); window.requestAnimationFrame(() => (surface.querySelector<HTMLElement>("[autofocus]") || focusable()[0] || surface).focus()); const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && closeRef.current) { event.preventDefault(); closeRef.current(); return; } if (event.key !== "Tab") return; const items = focusable(); if (!items.length) { event.preventDefault(); surface.focus(); return; } const first = items[0]; const last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }; document.addEventListener("keydown", onKeyDown); return () => { document.removeEventListener("keydown", onKeyDown); if (previousFocus?.isConnected) previousFocus.focus(); }; }, []);
  return surfaceRef;
}

export function Sheet({ children, onClose, wide = false, label = "Sheet", className = "", showClose = true }: { children: ReactNode; onClose: () => void; wide?: boolean; label?: string; className?: string; showClose?: boolean }) {
  const surfaceRef = useModalFocus(onClose); const [portalReady, setPortalReady] = useState(false); const [dragOffset, setDragOffset] = useState(0); const dragRef = useRef<{ pointerId: number; startY: number } | undefined>(undefined);
  useEffect(() => { const frame = window.requestAnimationFrame(() => setPortalReady(true)); document.body.classList.add("sheet-open"); return () => { window.cancelAnimationFrame(frame); document.body.classList.remove("sheet-open"); }; }, []);
  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => { if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return; const shouldClose = dragOffset > 90; dragRef.current = undefined; if (shouldClose) onClose(); else setDragOffset(0); };
  const overlay = <div className="sheet-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={surfaceRef} className={`sheet ${wide ? "wide" : ""} ${className}`.trim()} style={{ transform: dragOffset ? `translateY(${dragOffset}px)` : undefined, transition: dragOffset ? "none" : "transform .2s ease" }} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}><button className="sheet-handle" type="button" aria-label="Drag down to close" onPointerDown={(event) => { dragRef.current = { pointerId: event.pointerId, startY: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (dragRef.current?.pointerId === event.pointerId) setDragOffset(Math.max(0, event.clientY - dragRef.current.startY)); }} onPointerUp={endDrag} onPointerCancel={endDrag} />{showClose && <button className="sheet-close icon-button ghost" type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>}{children}</section></div>;
  return portalReady && typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
}
