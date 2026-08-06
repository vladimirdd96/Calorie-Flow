"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** The backdrop scrolls for most sheets and the surface itself for full-height shells, so drag gating reads whichever moved. */
const scrollOffset = (surface: HTMLElement) => Math.max(surface.scrollTop, surface.parentElement?.scrollTop ?? 0);

const focusableSelector =["button:not([disabled])", "input:not([disabled]):not([type='hidden'])", "select:not([disabled])", "textarea:not([disabled])", "a[href]", "[tabindex]:not([tabindex='-1'])"].join(",");

function useModalFocus(onClose?: () => void) {
  const surfaceRef = useRef<HTMLElement>(null); const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => { const surface = surfaceRef.current; const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; if (!surface) return; const focusable = () => [...surface.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => !element.hidden); window.requestAnimationFrame(() => (surface.querySelector<HTMLElement>("[autofocus]") || focusable()[0] || surface).focus()); const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && closeRef.current) { event.preventDefault(); closeRef.current(); return; } if (event.key !== "Tab") return; const items = focusable(); if (!items.length) { event.preventDefault(); surface.focus(); return; } const first = items[0]; const last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }; document.addEventListener("keydown", onKeyDown); return () => { document.removeEventListener("keydown", onKeyDown); if (previousFocus?.isConnected) previousFocus.focus(); }; }, []);
  return surfaceRef;
}

export function Sheet({ children, onClose, wide = false, label = "Sheet", className = "", showClose = true }: { children: ReactNode; onClose: () => void; wide?: boolean; label?: string; className?: string; showClose?: boolean }) {
  const surfaceRef = useModalFocus(onClose); const [portalReady, setPortalReady] = useState(false); const dragRef = useRef<{ pointerId: number | "touch"; startY: number; offset: number; active: boolean } | undefined>(undefined); const [dragOffset, setDragOffset] = useState(0); const closeRef = useRef(onClose); const backdropPressRef = useRef(false);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => { const frame = window.requestAnimationFrame(() => setPortalReady(true)); document.body.classList.add("sheet-open"); return () => { window.cancelAnimationFrame(frame); document.body.classList.remove("sheet-open"); }; }, []);
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const isInteractive = (target: EventTarget | null) => target instanceof Element && target.closest("button:not(.sheet-handle), select, textarea, a, [contenteditable='true']");
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || scrollOffset(surface) > 0 || isInteractive(event.target)) return;
      dragRef.current = { pointerId: "touch", startY: event.touches[0].clientY, offset: 0, active: false };
    };
    const onTouchMove = (event: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== "touch" || event.touches.length !== 1) return;
      const offset = Math.max(0, event.touches[0].clientY - drag.startY);
      if (!drag.active && event.touches[0].clientY < drag.startY - 8) { dragRef.current = undefined; return; }
      if (!drag.active && offset < 8) return;
      drag.active = true;
      event.preventDefault();
      drag.offset = offset;
      setDragOffset(offset);
    };
    const endTouch = () => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== "touch") return;
      const shouldClose = drag.active && drag.offset >= 90;
      dragRef.current = undefined;
      if (shouldClose) closeRef.current();
      else setDragOffset(0);
    };
    surface.addEventListener("touchstart", onTouchStart, { passive: true });
    surface.addEventListener("touchmove", onTouchMove, { passive: false });
    surface.addEventListener("touchend", endTouch);
    surface.addEventListener("touchcancel", endTouch);
    return () => { surface.removeEventListener("touchstart", onTouchStart); surface.removeEventListener("touchmove", onTouchMove); surface.removeEventListener("touchend", endTouch); surface.removeEventListener("touchcancel", endTouch); };
  }, [portalReady, surfaceRef]);
  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target;
    const startedOnHandle = target instanceof Element && target.closest(".sheet-handle");
    if (!event.isPrimary || event.pointerType === "touch" || (event.pointerType !== "pen" && !startedOnHandle)) return;
    if (target instanceof Element && target.closest("button:not(.sheet-handle), select, textarea, a, [contenteditable='true']")) return;
    if (scrollOffset(event.currentTarget) > 0) return;
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY, offset: 0, active: false };
  };
  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const offset = Math.max(0, event.clientY - drag.startY);
    if (!drag.active && offset < 8) return;
    if (!drag.active) {
      drag.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    drag.offset = offset;
    setDragOffset(offset);
  };
  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const shouldClose = drag.active && drag.offset >= 90;
    if (drag.active) event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = undefined;
    if (shouldClose) onClose();
    else setDragOffset(0);
  };
  const overlay = <div
    className="sheet-backdrop"
    onPointerDown={(event) => { const backdrop = event.currentTarget; backdropPressRef.current = event.target === backdrop && event.clientX - backdrop.getBoundingClientRect().left < backdrop.clientWidth; }}
    onClick={(event) => { if (event.target === event.currentTarget && backdropPressRef.current) onClose(); }}
  ><section ref={surfaceRef} className={`sheet ${wide ? "wide" : ""} ${className}`.trim()} style={{ transform: dragOffset ? `translateY(${dragOffset}px)` : undefined, transition: dragOffset ? "none" : "transform .2s ease" }} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><button className="sheet-handle" type="button" aria-label="Drag down to close" />{showClose && <button className="sheet-close icon-button ghost" type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>}{children}</section></div>;
  return portalReady && typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
}
