"use client";

import { Info, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CoachMealChoice } from "@/lib/types";
import { CoachMessageItem } from "./CoachMessageItem";
import { dayLabel } from "../lib/coachFormatting";
import { coachErrorKinds, type CoachError, type DisplayCoachMessage } from "../types";

export function CoachThread({ messages, starters, hideCalories, loading, error, loggedChoices, onSend, onCopy, onRegenerate, onEdit, onLogChoice, onAddGroceries, onRetryError, onDismissError }: {
  messages: DisplayCoachMessage[];
  starters: string[];
  hideCalories: boolean;
  loading: boolean;
  error: CoachError | null;
  loggedChoices: string[];
  onSend: (starter: string) => void;
  onCopy: (content: string) => Promise<boolean>;
  onRegenerate: () => void;
  onEdit: (message: DisplayCoachMessage) => void;
  onLogChoice: (message: DisplayCoachMessage, choice: CoachMealChoice) => void;
  onAddGroceries: (names: string[]) => void;
  onRetryError: () => void;
  onDismissError: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  const latest = messages[messages.length - 1];
  const recoverable = error?.kind === coachErrorKinds.history || error?.kind === coachErrorKinds.reply;

  return <section className="coach-thread" tabIndex={0} aria-label="Conversation with Coach">
    {messages.length === 0 && <>
      <div className="coach-scope"><ShieldCheck size={15} aria-hidden="true" /><span>{hideCalories ? "Food and nutrition only" : "Food, calories & nutrition only"} · recipes and lists saved only when you choose</span></div>
      <div className="coach-welcome">
        <span className="coach-orb"><Sparkles aria-hidden="true" /></span>
        <h2>What should we make?</h2>
        <p>Talk through dinner, use up what you have, or log a food by scanning it.</p>
        <div className="coach-starters">{starters.map((starter) => <button key={starter} type="button" onClick={() => onSend(starter)}>{starter}</button>)}</div>
      </div>
    </>}

    {messages.map((message, index) => {
      const previous = messages[index - 1];
      const startsDay = !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
      return <div key={message.id} className="coach-thread-entry">
        {startsDay && <div className="coach-day-divider"><span>{dayLabel(message.createdAt)}</span></div>}
        <CoachMessageItem
          message={message}
          hideCalories={hideCalories}
          isLast={message.id === latest?.id}
          busy={loading}
          loggedChoices={loggedChoices}
          onCopy={onCopy}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
          onLogChoice={onLogChoice}
          onAddGroceries={onAddGroceries}
        />
      </div>;
    })}

    {/* Only the newest turn is announced, so a screen reader is not re-read the whole thread. */}
    <div className="coach-live-region" aria-live="polite" aria-atomic="true">
      {loading ? "Coach is writing a reply." : latest?.role === "assistant" ? latest.content : ""}
    </div>

    {loading && <div className="coach-typing" aria-hidden="true"><i /><i /><i /></div>}

    {error && <div className="inline-alert error" role="alert">
      <Info size={17} aria-hidden="true" />
      <span>{error.message}</span>
      {recoverable && <button className="text-button" type="button" onClick={onRetryError}>{error.kind === coachErrorKinds.history ? "Reload" : "Try again"}</button>}
      <button className="icon-button ghost" type="button" onClick={onDismissError} aria-label="Dismiss message"><X size={15} /></button>
    </div>}

    <div ref={endRef} />
  </section>;
}
