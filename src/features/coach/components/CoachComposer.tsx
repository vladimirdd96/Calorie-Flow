"use client";

import { Camera, ImagePlus, Plus, ScanLine, Send, Square, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { AddView } from "../types";

const MAX_ROWS_HEIGHT = 148;

/**
 * One input bar. Everything that hands the Coach a photo — attach, scan a
 * barcode, read a label — lives behind the single plus menu instead of a
 * separate row of buttons competing with the message field.
 */
export function CoachComposer({ draft, onDraftChange, attachedImage, onAttachFile, onRemoveAttachment, loading, onSend, onStop, onOpenAdd }: {
  draft: string;
  onDraftChange: (value: string) => void;
  attachedImage: string | null;
  onAttachFile: (file?: File) => void;
  onRemoveAttachment: () => void;
  loading: boolean;
  onSend: () => void;
  onStop: () => void;
  onOpenAdd: (view: AddView) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_ROWS_HEIGHT)}px`;
  }, [draft]);

  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", close); };
  }, [menuOpen]);

  const submit = (event: FormEvent) => { event.preventDefault(); if (!loading) onSend(); };
  const canSend = Boolean(draft.trim() || attachedImage);

  return <div className="coach-composer-wrap">
    <form className="coach-composer" onSubmit={submit}>
      {attachedImage && <div className="coach-attachment">
        <img src={attachedImage} alt="Photo attached to your message" />
        <button type="button" onClick={onRemoveAttachment} aria-label="Remove attached photo"><X size={15} /></button>
      </div>}
      <input ref={fileRef} className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => { onAttachFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      <div className="coach-attach-wrap" ref={menuRef}>
        <button type="button" className="coach-attach" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Add a photo or scan" onClick={() => setMenuOpen((current) => !current)}><Plus aria-hidden="true" /></button>
        {menuOpen && <div className="coach-attach-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}><ImagePlus size={16} />Attach a photo</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenAdd("scan"); }}><ScanLine size={16} />Scan a barcode</button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenAdd("camera"); }}><Camera size={16} />Read a label</button>
        </div>}
      </div>
      <textarea
        ref={textareaRef}
        className="coach-input"
        rows={1}
        value={draft}
        maxLength={6000}
        aria-label="Message the nutrition Coach"
        placeholder={attachedImage ? "Add a note about this photo…" : "Ask about food, recipes or your log…"}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!loading && canSend) onSend(); } }}
      />
      <button
        type={loading ? "button" : "submit"}
        className={loading ? "coach-send coach-stop" : "coach-send"}
        onClick={loading ? onStop : undefined}
        disabled={!loading && !canSend}
        aria-label={loading ? "Stop generating" : "Send message"}
      >{loading ? <Square size={14} /> : <Send aria-hidden="true" />}</button>
    </form>
  </div>;
}
