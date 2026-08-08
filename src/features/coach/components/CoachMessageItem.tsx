"use client";

import { Check, Copy, ListChecks, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CoachMealChoice } from "@/lib/types";
import { groceryItemsFromReply, hideCalorieValues, messageTime } from "../lib/coachFormatting";
import { mealLabels, type DisplayCoachMessage } from "../types";

export function CoachMessageItem({ message, hideCalories, isLast, busy, loggedChoices, onCopy, onRegenerate, onEdit, onLogChoice, onAddGroceries }: {
  message: DisplayCoachMessage;
  hideCalories: boolean;
  isLast: boolean;
  busy: boolean;
  loggedChoices: string[];
  onCopy: (content: string) => Promise<boolean>;
  onRegenerate: () => void;
  onEdit: (message: DisplayCoachMessage) => void;
  onLogChoice: (message: DisplayCoachMessage, choice: CoachMealChoice) => void;
  onAddGroceries: (names: string[]) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", close); };
  }, [menuOpen]);

  const content = hideCalories ? hideCalorieValues(message.content) : message.content;
  const groceries = message.role === "assistant" ? groceryItemsFromReply(content) : [];
  const canRegenerate = message.role === "assistant" && isLast && !busy;
  const canEdit = message.role === "user" && !busy;

  const copy = async () => {
    setMenuOpen(false);
    if (!await onCopy(content)) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return <article className={`coach-message ${message.role}`}>
    <div className="coach-message-head">
      <time dateTime={message.createdAt}>{messageTime(message.createdAt)}</time>
      <div className="coach-message-menu-wrap" ref={menuRef}>
        <button type="button" className="coach-message-menu-trigger" aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Options for this ${message.role === "user" ? "question" : "reply"}`} onClick={() => setMenuOpen((current) => !current)}>
          {copied ? <Check size={15} /> : <MoreHorizontal size={15} />}
        </button>
        {menuOpen && <div className="coach-message-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => void copy()}><Copy size={14} />Copy text</button>
          {canRegenerate && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onRegenerate(); }}><RotateCcw size={14} />Regenerate reply</button>}
          {canEdit && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(message); }}><Pencil size={14} />Edit &amp; resend</button>}
        </div>}
      </div>
    </div>
    {message.imageUrl && <img className="coach-message-image" src={message.imageUrl} alt="Photo shared with Coach" />}
    <p>{content}</p>
    {message.mealAction && <div className="coach-log-confirmation"><Check size={16} aria-hidden="true" /><span>Logged as {mealLabels[message.mealAction.mealType]} · {message.mealAction.loggedDate}</span></div>}
    {message.mealChoices && <div className="coach-meal-choices">
      <strong>Choose where to log it</strong>
      {message.mealChoices.map((choice) => {
        const logged = loggedChoices.includes(`${message.id}:${choice.label}`);
        return <button key={choice.label} type="button" disabled={logged} onClick={() => onLogChoice(message, choice)}>{logged ? "Logged · " : ""}{choice.label}</button>;
      })}
    </div>}
    {groceries.length > 0 && <div className="recipe-grocery-action">
      <strong>Want to cook this?</strong>
      <button type="button" className="add-groceries" onClick={() => onAddGroceries(groceries)}><ListChecks size={15} aria-hidden="true" />Add {groceries.length} {groceries.length === 1 ? "ingredient" : "ingredients"} to a grocery list</button>
    </div>}
    {!!message.sources?.length && <div className="coach-sources">
      <strong>Sources</strong>
      <div>{message.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" title={source.title}>{source.title}</a>)}</div>
    </div>}
  </article>;
}
