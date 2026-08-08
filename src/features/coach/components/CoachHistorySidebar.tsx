"use client";

import { Check, ListChecks, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/features/shared/Sheet";
import type { CoachChat } from "@/lib/types";

const focusableSelector = ["button:not([disabled])", "input:not([disabled])", "a[href]", "[tabindex]:not([tabindex='-1'])"].join(",");

/** Traps Tab inside the drawer while it overlays the conversation, and restores focus on close. */
function useDrawerFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const surface = ref.current;
    if (!surface) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const items = () => [...surface.querySelectorAll<HTMLElement>(focusableSelector)];
    window.requestAnimationFrame(() => items()[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = items();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); if (previous?.isConnected) previous.focus(); };
  }, [onClose, open]);
  return ref;
}

export function CoachHistorySidebar({ chats, activeChatId, open, remainingGroceries, onClose, onSelect, onNewChat, onRename, onDelete, onOpenGroceries }: {
  chats: CoachChat[];
  activeChatId: string;
  open: boolean;
  remainingGroceries: number;
  onClose: () => void;
  onSelect: (chatId: string) => void;
  onNewChat: () => void;
  onRename: (chatId: string, title: string) => void;
  onDelete: (chatId: string) => void;
  onOpenGroceries: () => void;
}) {
  const [search, setSearch] = useState("");
  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleting, setDeleting] = useState<CoachChat | null>(null);
  const drawerRef = useDrawerFocus(open, onClose);

  useEffect(() => {
    if (!menuChatId) return;
    const dismiss = (event: PointerEvent) => { if (!drawerRef.current?.contains(event.target as Node)) setMenuChatId(null); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [drawerRef, menuChatId]);

  const term = search.trim().toLocaleLowerCase();
  const filtered = chats.filter((chat) => chat.title.toLocaleLowerCase().includes(term));

  return <aside ref={drawerRef} id="coach-history-drawer" className={`coach-history ${open ? "mobile-open" : ""}`} aria-label="Your conversations">
    <div className="coach-history-heading">
      <strong>Chats</strong>
      <button className="icon-button ghost coach-history-close" type="button" onClick={onClose} aria-label="Close conversations"><X size={16} /></button>
    </div>
    <button className="coach-new-chat" type="button" onClick={onNewChat}><Plus size={15} aria-hidden="true" />New chat</button>
    <label className="coach-history-search">
      <Search size={14} aria-hidden="true" />
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" aria-label="Search your conversations" />
    </label>
    <button className="coach-grocery-link" type="button" onClick={onOpenGroceries}>
      <ListChecks size={15} aria-hidden="true" /><span>Grocery lists</span>{remainingGroceries > 0 && <small>{remainingGroceries}</small>}
    </button>

    <div className="coach-history-list">
      {filtered.length === 0 && term ? <div className="search-empty coach-history-empty"><strong>No chats found</strong><p>Try a different search term.</p></div>
        : filtered.map((chat) => <div className={`coach-history-row ${chat.id === activeChatId ? "active" : ""}`} key={chat.id}>
          {renamingChatId === chat.id ? <form className="coach-rename-form" onSubmit={(event) => { event.preventDefault(); onRename(chat.id, renameDraft); setRenamingChatId(null); }}>
            <input autoFocus value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} maxLength={120} aria-label="Chat name" placeholder="Chat name" />
            <button type="submit" aria-label="Save chat name"><Check size={14} /></button>
          </form> : <>
            <button className="coach-history-chat" type="button" title={chat.title} onClick={() => { onSelect(chat.id); onClose(); }}>
              <span>{chat.title}</span>
              <small>{new Date(chat.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
            </button>
            <span className="coach-history-menu-wrap">
              <button className="coach-history-menu-trigger" type="button" aria-label={`Options for ${chat.title}`} aria-haspopup="menu" aria-expanded={menuChatId === chat.id} onClick={() => setMenuChatId((current) => current === chat.id ? null : chat.id)}><MoreHorizontal size={17} /></button>
              {menuChatId === chat.id && <span className="coach-chat-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenuChatId(null); setRenamingChatId(chat.id); setRenameDraft(chat.title); }}><Pencil size={14} />Rename</button>
                <button type="button" role="menuitem" className="danger" onClick={() => { setMenuChatId(null); setDeleting(chat); }}><Trash2 size={14} />Delete</button>
              </span>}
            </span>
          </>}
        </div>)}
    </div>

    {deleting && <Sheet label={`Delete ${deleting.title}`} onClose={() => setDeleting(null)}>
      <div className="sheet-header"><span /><div><span className="eyebrow">Conversation</span><h2>Delete this chat?</h2></div><span /></div>
      <p><strong>{deleting.title}</strong> and its messages will be removed from every device signed in to your account. This cannot be undone.</p>
      <div className="sheet-actions">
        <button type="button" className="secondary-button" onClick={() => setDeleting(null)}>Keep chat</button>
        <button type="button" className="primary-button danger-button" onClick={() => { onDelete(deleting.id); setDeleting(null); }}><Trash2 size={17} />Delete chat</button>
      </div>
    </Sheet>}
  </aside>;
}
