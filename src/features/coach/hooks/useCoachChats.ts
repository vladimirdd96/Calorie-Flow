"use client";

import { useEffect, useRef, useState } from "react";
import { deleteCloudCoachChat, deleteCloudCoachMessages, getCloudCoachChats, getCloudCoachMessages, saveCloudCoachChat, saveCloudCoachMessage } from "@/lib/cloud";
import { getSupabase, type CloudUser } from "@/lib/supabase";
import type { CoachChat, CoachMealAction, CoachMealChoice } from "@/lib/types";
import { requestCoachReply } from "../lib/coachApi";
import { titleFromQuestion } from "../lib/coachFormatting";
import { coachErrorKinds, type CoachError, type DisplayCoachMessage } from "../types";

const NEW_CONVERSATION = "New conversation";
const isDraft = (chatId: string) => chatId.startsWith("draft-");
const draftChatFor = () => {
  const createdAt = new Date().toISOString();
  return { id: `draft-${crypto.randomUUID()}`, title: NEW_CONVERSATION, createdAt, updatedAt: createdAt };
};

/** Owns one account's Coach conversations: their history, the active thread, and every turn taken in it. */
export function useCoachChats(user: CloudUser | null, onLogCoachMeal: (action: CoachMealAction) => Promise<void>) {
  const [chats, setChats] = useState<CoachChat[]>([]);
  const [draftChat, setDraftChat] = useState<CoachChat | null>(null);
  const [activeChatId, setActiveChatId] = useState("");
  const [messages, setMessages] = useState<DisplayCoachMessage[]>([]);
  const [loadedUserId, setLoadedUserId] = useState("");
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CoachError | null>(null);
  const [draft, setDraft] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [loggedChoices, setLoggedChoices] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const lastAskRef = useRef<{ content: string; image?: string } | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) return;
    getCloudCoachChats(user.id).then(async (storedChats) => {
      if (!active) return;
      const nextDraft = storedChats.length ? null : draftChatFor();
      const chat = storedChats[0] || nextDraft;
      if (!chat) return;
      const stored = chat === nextDraft ? [] : await getCloudCoachMessages(user.id, chat.id);
      if (!active) return;
      setChats(storedChats); setDraftChat(nextDraft); setActiveChatId(chat.id); setMessages(stored); setLoadedUserId(user.id);
    }).catch(() => {
      if (!active) return;
      const fallback = draftChatFor();
      setChats([]); setDraftChat(fallback); setActiveChatId(fallback.id); setMessages([]); setLoadedUserId(user.id);
      setError({ kind: coachErrorKinds.history, message: "Your past conversations could not be loaded. You can still start a new one." });
    });
    return () => { active = false; };
  }, [historyAttempt, user]);

  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    const refreshActiveChat = async () => {
      if (!active || !activeChatId || isDraft(activeChatId)) return;
      try {
        const stored = await getCloudCoachMessages(user.id, activeChatId);
        if (active) setMessages(stored);
      } catch { /* Realtime is an enhancement; the local thread stays usable. */ }
    };
    const refreshChats = async () => {
      try {
        const storedChats = await getCloudCoachChats(user.id);
        if (!active) return;
        setChats(storedChats);
        if (activeChatId && !isDraft(activeChatId) && !storedChats.some((chat) => chat.id === activeChatId)) {
          const nextChat = storedChats[0];
          setActiveChatId(nextChat?.id || "");
          setMessages(nextChat ? await getCloudCoachMessages(user.id, nextChat.id) : []);
        }
      } catch { /* Realtime is an enhancement; the local thread stays usable. */ }
    };
    const channel = supabase.channel(`coach-sync:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "coach_chats", filter: `user_id=eq.${user.id}` }, () => { void refreshChats(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "coach_messages", filter: `user_id=eq.${user.id}` }, () => { void refreshActiveChat(); })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [activeChatId, user]);

  const ready = Boolean(user) && loadedUserId === user?.id;
  const visibleChats = draftChat ? [draftChat, ...chats] : chats;
  const activeChat = visibleChats.find((chat) => chat.id === activeChatId);

  /** Everything that belongs to one conversation and must not follow the user into another. */
  const resetConversationState = () => { setDraft(""); setAttachedImage(null); setLoggedChoices([]); setError(null); lastAskRef.current = null; };

  const ask = async (chatId: string, content: string, image: string | null | undefined, history: DisplayCoachMessage[], replaceId?: string) => {
    lastAskRef.current = { content, ...(image ? { image } : {}) };
    setError(null); setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await requestCoachReply(content, image, history.slice(-12).map(({ role, content: previous }) => ({ role, content: previous })), controller.signal);
      const assistantMessage: DisplayCoachMessage = {
        id: replaceId || crypto.randomUUID(),
        chatId,
        role: "assistant",
        content: result.reply,
        createdAt: new Date().toISOString(),
        sources: result.sources,
        ...(result.mealActionResult.success ? { mealAction: result.mealActionResult.data } : {}),
        ...(result.mealChoices.length ? { mealChoices: result.mealChoices } : {}),
      };
      setMessages((current) => replaceId ? current.map((message) => message.id === replaceId ? assistantMessage : message) : [...current, assistantMessage]);
      if (user) {
        try { await saveCloudCoachMessage(user.id, assistantMessage); }
        catch { setError({ kind: coachErrorKinds.sync, message: "Reply received, but saving it to your account will retry later." }); }
      }
      if (result.mealActionResult.success) {
        try { await onLogCoachMeal(result.mealActionResult.data); }
        catch { setError({ kind: coachErrorKinds.sync, message: "The Coach found the meal, but it could not be added to your diary." }); }
      }
      return true;
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError({ kind: coachErrorKinds.reply, message: caught instanceof Error ? caught.message : "The Coach is unavailable right now." });
      }
      return false;
    } finally { abortRef.current = null; setLoading(false); }
  };

  const send = async (suggestion?: string) => {
    const image = suggestion ? undefined : attachedImage;
    const content = (suggestion ?? draft).trim() || (image ? "Please take a look at this photo." : "");
    if (!content || !user || !ready || loading || !activeChatId) return;
    const userMessage: DisplayCoachMessage = { id: crypto.randomUUID(), chatId: activeChatId, role: "user", content, createdAt: new Date().toISOString(), ...(image ? { imageUrl: image } : {}) };
    const history = messages;
    if (activeChat?.title === NEW_CONVERSATION && !messages.length) {
      const titledChat = { ...activeChat, title: titleFromQuestion(content), updatedAt: userMessage.createdAt };
      setChats((current) => current.some((chat) => chat.id === titledChat.id) ? current.map((chat) => chat.id === titledChat.id ? titledChat : chat) : [titledChat, ...current]);
      setDraftChat(null);
      try { await saveCloudCoachChat(user.id, titledChat); }
      catch { setError({ kind: coachErrorKinds.sync, message: "Your question was sent, but naming this conversation will retry later." }); }
    }
    setMessages((current) => [...current, userMessage]);
    setDraft(""); setAttachedImage(null);
    try { await saveCloudCoachMessage(user.id, userMessage); }
    catch { setError({ kind: coachErrorKinds.sync, message: "This reply will continue, but saving to your account will retry later." }); }
    const sent = await ask(activeChatId, content, image, history);
    if (!sent && image) setAttachedImage(image);
  };

  const regenerate = async () => {
    if (!user || !ready || loading || !activeChatId) return;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;
    const sourceIndex = messages.slice(0, -1).map((message) => message.role).lastIndexOf("user");
    if (sourceIndex === -1) return;
    const source = messages[sourceIndex];
    await ask(activeChatId, source.content, source.imageUrl, messages.slice(0, sourceIndex), lastMessage.id);
  };

  /** Rewinds the thread to just before a question so the edited version replaces it instead of stacking. */
  const editAndResend = async (message: DisplayCoachMessage) => {
    if (!user || loading || message.role !== "user") return;
    const index = messages.findIndex((candidate) => candidate.id === message.id);
    if (index === -1) return;
    const removed = messages.slice(index);
    setMessages(messages.slice(0, index));
    setDraft(message.content);
    setAttachedImage(message.imageUrl || null);
    if (!isDraft(message.chatId)) {
      try { await deleteCloudCoachMessages(user.id, message.chatId, removed.map((item) => item.id)); }
      catch { setError({ kind: coachErrorKinds.sync, message: "The edited question is ready, but removing the old one from your account will retry later." }); }
    }
  };

  const switchChat = async (chatId: string) => {
    if (!user || chatId === activeChatId) return;
    setActiveChatId(chatId);
    setMessages([]);
    resetConversationState();
    if (isDraft(chatId)) return;
    try { setMessages(await getCloudCoachMessages(user.id, chatId)); }
    catch { setError({ kind: coachErrorKinds.history, message: "This conversation could not be loaded." }); }
  };

  const newChat = () => {
    if (!user) return;
    if (activeChat?.title === NEW_CONVERSATION && !messages.length) return;
    const chat = draftChatFor();
    setDraftChat(chat); setActiveChatId(chat.id); setMessages([]);
    resetConversationState();
  };

  const renameChat = async (chatId: string, title: string) => {
    const trimmed = title.trim();
    if (!user || !trimmed) return;
    if (isDraft(chatId)) { setDraftChat((current) => current && current.id === chatId ? { ...current, title: trimmed.slice(0, 120) } : current); return; }
    const chat = chats.find((candidate) => candidate.id === chatId);
    if (!chat) return;
    const renamed = { ...chat, title: trimmed.slice(0, 120), updatedAt: new Date().toISOString() };
    setChats((current) => current.map((candidate) => candidate.id === renamed.id ? renamed : candidate));
    try { await saveCloudCoachChat(user.id, renamed); }
    catch { setError({ kind: coachErrorKinds.sync, message: "Renamed here, but the new name will sync later." }); }
  };

  const deleteChat = async (chatId: string) => {
    if (!user) return;
    const remaining = chats.filter((chat) => chat.id !== chatId);
    if (!isDraft(chatId)) {
      try { await deleteCloudCoachChat(user.id, chatId); }
      catch { setError({ kind: coachErrorKinds.sync, message: "That conversation could not be deleted. Please try again." }); return; }
    }
    setChats(remaining);
    if (chatId !== activeChatId) { if (isDraft(chatId)) setDraftChat(null); return; }
    resetConversationState();
    const nextChat = remaining[0];
    if (nextChat) { setDraftChat(null); setActiveChatId(nextChat.id); setMessages(await getCloudCoachMessages(user.id, nextChat.id).catch(() => [])); return; }
    const fallback = draftChatFor();
    setDraftChat(fallback); setActiveChatId(fallback.id); setMessages([]);
  };

  const logChoice = async (message: DisplayCoachMessage, choice: CoachMealChoice) => {
    const key = `${message.id}:${choice.label}`;
    if (loggedChoices.includes(key)) return;
    try {
      await onLogCoachMeal(choice.meal);
      setLoggedChoices((current) => [...current, key]);
    } catch { setError({ kind: coachErrorKinds.sync, message: "That meal could not be added to your diary. Please try again." }); }
  };

  /** Recovery depends on what failed: reload the history, re-ask the question, or just clear the notice. */
  const retryError = async () => {
    const current = error;
    setError(null);
    if (current?.kind === coachErrorKinds.history) { setLoadedUserId(""); setHistoryAttempt((value) => value + 1); return; }
    const request = lastAskRef.current;
    if (current?.kind !== coachErrorKinds.reply || !request || !activeChatId) return;
    const sourceIndex = messages.map((message) => message.role).lastIndexOf("user");
    await ask(activeChatId, request.content, request.image, sourceIndex === -1 ? [] : messages.slice(0, sourceIndex));
  };

  return {
    ready,
    chats: visibleChats,
    activeChat,
    activeChatId,
    messages,
    loading,
    error,
    draft,
    setDraft,
    attachedImage,
    setAttachedImage,
    loggedChoices,
    send,
    stop: () => abortRef.current?.abort(),
    regenerate,
    editAndResend,
    switchChat,
    newChat,
    renameChat,
    deleteChat,
    logChoice,
    dismissError: () => setError(null),
    retryError,
    reportError: setError,
  };
}
