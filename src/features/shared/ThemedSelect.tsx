"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ThemedSelectOption = { value: string; label: string };

export function ThemedSelect({ value, options, onChange, ariaLabel }: { value: string; options: ThemedSelectOption[]; onChange: (value: string) => void; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, openAbove: false });
  const rootRef = useRef<HTMLDivElement>(null); const menuRef = useRef<HTMLDivElement>(null); const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value) || options[0];
  useEffect(() => { const dismiss = (event: PointerEvent) => { const target = event.target as Node; if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false); }; document.addEventListener("pointerdown", dismiss); return () => document.removeEventListener("pointerdown", dismiss); }, []);
  const positionMenu = useCallback(() => { const trigger = triggerRef.current; if (!trigger) return; const rect = trigger.getBoundingClientRect(); const menuHeight = Math.min(280, options.length * 42 + 12); const openAbove = window.innerHeight - rect.bottom < menuHeight + 12 && rect.top > menuHeight + 12; setMenuPosition({ top: openAbove ? rect.top - menuHeight - 7 : rect.bottom + 7, left: rect.left, width: rect.width, openAbove }); }, [options.length]);
  useEffect(() => { if (!open) return; positionMenu(); window.addEventListener("resize", positionMenu); window.addEventListener("scroll", positionMenu, true); return () => { window.removeEventListener("resize", positionMenu); window.removeEventListener("scroll", positionMenu, true); }; }, [open, positionMenu]);
  const choose = (option: ThemedSelectOption) => { onChange(option.value); setOpen(false); triggerRef.current?.focus(); };
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setHighlightedIndex((current) => event.key === "ArrowDown" ? Math.min(options.length - 1, current + 1) : Math.max(0, current - 1)); } else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (open) choose(options[highlightedIndex]); else setOpen(true); } else if (event.key === "Escape") setOpen(false); else if (event.key === "Home" && open) { event.preventDefault(); setHighlightedIndex(0); } else if (event.key === "End" && open) { event.preventDefault(); setHighlightedIndex(options.length - 1); } };
  const menu = open ? <div ref={menuRef} className={`themed-select-menu${menuPosition.openAbove ? " open-above" : ""}`} role="listbox" aria-label={ariaLabel} style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}>{options.map((option, index) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={`themed-select-option${index === highlightedIndex ? " highlighted" : ""}${option.value === value ? " selected" : ""}`} onMouseEnter={() => setHighlightedIndex(index)} onClick={() => choose(option)}>{option.value === value ? <Check size={16} aria-hidden="true" /> : <span className="themed-select-option-placeholder" aria-hidden="true" />}<span>{option.label}</span></button>)}</div> : null;
  return <div ref={rootRef} className={`themed-select${open ? " open" : ""}`}><button ref={triggerRef} className="themed-select-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={() => { setHighlightedIndex(Math.max(0, options.findIndex((option) => option.value === value))); setOpen((current) => !current); }} onKeyDown={onKeyDown}>{selected?.label}<ChevronDown size={18} aria-hidden="true" /></button>{menu && createPortal(menu, document.body)}</div>;
}
