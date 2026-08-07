"use client";

import { ArrowLeft, Camera, Check, ChevronRight, Copy, Info, Mail, Menu, MessageCircle, MoreHorizontal, ListChecks, Package, Pencil, Plus, RotateCcw, ScanLine, Search, Send, ShieldCheck, Sparkles, Square, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { ClearableInput } from "@/features/shared/ClearableInput";
import { Sheet } from "@/features/shared/Sheet";
import { getSetting, setSetting } from "@/lib/db";
import { deleteCloudCoachChat, getCloudCoachChats, getCloudCoachMessages, saveCloudCoachMessage, saveCloudCoachChat } from "@/lib/cloud";
import { localDateKey, lowestTrackedMacros, resolveDailyTargets, sumNutrition, type LowMacroKey } from "@/lib/nutrition";
import { coachMealActionSchema, coachMealChoiceSchema } from "@/lib/schemas";
import { getSupabase, type CloudUser } from "@/lib/supabase";
import type { CoachChat, CoachMealAction, CoachMealChoice, Meal, Profile } from "@/lib/types";

import { groceryItemsFromReply, hideCalorieValues, titleFromQuestion } from "./lib/coachFormatting";
import { GROCERY_ITEMS_SETTING, isGroceryItem, mealLabels } from "./types";
import type { AddView, ChatTextSize, CoachSection, DisplayCoachMessage, GroceryList } from "./types";
import type { CoachSection as NavigationCoachSection } from "@/features/navigation/types";

export function CoachView({ configured, user, profile, meals, onBack, onOpenAccount, onOpenAdd, onLogCoachMeal, hideCalories, chatTextSize, initialSection }: { configured: boolean; user: CloudUser | null; profile: Profile; meals: Meal[]; onBack: () => void; onOpenAccount: () => void; onOpenAdd: (view: AddView) => void; onLogCoachMeal: (action: CoachMealAction) => Promise<void>; hideCalories: boolean; chatTextSize: ChatTextSize; initialSection?: NavigationCoachSection }) {
  const [messages, setMessages] = useState<DisplayCoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedUserId, setLoadedUserId] = useState("");
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [chats, setChats] = useState<CoachChat[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [draftChat, setDraftChat] = useState<CoachChat | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [section, setSection] = useState<CoachSection>(initialSection || "chat");
  const [groceryLists, setGroceryLists] = useState<GroceryList[]>([]);
  const [activeGroceryListId, setActiveGroceryListId] = useState("");
  const [loadedGroceryKey, setLoadedGroceryKey] = useState("");
  const [groceryDraft, setGroceryDraft] = useState("");
  const [groceryListDraft, setGroceryListDraft] = useState("");
  const [groceryModal, setGroceryModal] = useState<"choose" | "manage" | null>(null);
  const [pendingGroceries, setPendingGroceries] = useState<string[]>([]);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [loggedChoiceLabels, setLoggedChoiceLabels] = useState<string[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const coachImageInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const coachHistoryRef = useRef<HTMLElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!menuChatId && !mobileHistoryOpen) return;
    const dismissMenu = (event: PointerEvent) => {
      if (menuChatId && !coachHistoryRef.current?.contains(event.target as Node)) setMenuChatId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuChatId(null);
      setMobileHistoryOpen(false);
    };
    document.addEventListener("pointerdown", dismissMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", dismissMenu); document.removeEventListener("keydown", closeOnEscape); };
  }, [menuChatId, mobileHistoryOpen]);

  const grocerySettingKey = user ? `${GROCERY_ITEMS_SETTING}:${user.id}` : undefined;
  useEffect(() => {
    let active = true;
    if (!grocerySettingKey) return () => { active = false; };
    getSetting<unknown>(grocerySettingKey)
      .then((stored) => {
        if (!active) return;
        const now = new Date().toISOString();
        const lists = Array.isArray(stored) && stored.every((value) => value && typeof value === "object" && "items" in value)
          ? stored.flatMap((value) => {
            const record = value as Record<string, unknown>;
            if (typeof record.id !== "string" || typeof record.name !== "string" || !Array.isArray(record.items)) return [];
            return [{ id: record.id, name: record.name, items: record.items.filter(isGroceryItem), createdAt: typeof record.createdAt === "string" ? record.createdAt : now, updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : now }];
          })
          : [{ id: crypto.randomUUID(), name: "My groceries", items: Array.isArray(stored) ? stored.filter(isGroceryItem) : [], createdAt: now, updatedAt: now }];
        const available = lists.length ? lists : [{ id: crypto.randomUUID(), name: "My groceries", items: [], createdAt: now, updatedAt: now }];
        setGroceryLists(available); setActiveGroceryListId(available[0].id); setLoadedGroceryKey(grocerySettingKey);
        void setSetting(grocerySettingKey, available);
      })
      .catch(() => {
        if (!active) return;
        const now = new Date().toISOString();
        const fallback = { id: crypto.randomUUID(), name: "My groceries", items: [], createdAt: now, updatedAt: now };
        setGroceryLists([fallback]); setActiveGroceryListId(fallback.id); setLoadedGroceryKey(grocerySettingKey);
      });
    return () => { active = false; };
  }, [grocerySettingKey]);

  useEffect(() => {
    let active = true;
    if (!user) return;
    getCloudCoachChats(user.id).then(async (storedChats) => {
      if (!active) return;
      const available = storedChats;
      let nextDraft: CoachChat | null = null;
      if (!available.length) {
        const now = new Date().toISOString();
        nextDraft = { id: `draft-${crypto.randomUUID()}`, title: "New conversation", createdAt: now, updatedAt: now };
      }
      const chat = available[0] || nextDraft;
      if (!chat) return;
      const stored = await getCloudCoachMessages(user.id, chat.id);
      if (active) { setChats(available); setDraftChat(nextDraft); setActiveChatId(chat.id); setMessages(stored); setLoadedUserId(user.id); }
    }).catch(() => {
      if (active) {
        const now = new Date().toISOString();
        const fallback: CoachChat = { id: `draft-${crypto.randomUUID()}`, title: "New conversation", createdAt: now, updatedAt: now };
        setChats([]); setDraftChat(fallback); setActiveChatId(fallback.id); setMessages([]); setLoadedUserId(user.id);
        setError("Coach history could not be loaded. You can still start a new conversation, or retry loading it.");
      }
    });
    return () => { active = false; };
  }, [historyAttempt, user]);
  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    const refreshActiveChat = async () => {
      if (!active || !activeChatId) return;
      try {
        const stored = await getCloudCoachMessages(user.id, activeChatId);
        if (active) setMessages(stored);
      } catch {
        // Realtime is an enhancement; offline/local behavior remains available.
      }
    };
    const refreshChats = async () => {
      try {
        const storedChats = await getCloudCoachChats(user.id);
        if (!active) return;
        setChats(storedChats);
        if (activeChatId && !activeChatId.startsWith("draft-") && !storedChats.some((chat) => chat.id === activeChatId)) {
          const nextChat = storedChats[0];
          setActiveChatId(nextChat?.id || "");
          setMessages(nextChat ? await getCloudCoachMessages(user.id, nextChat.id) : []);
        }
      } catch {
        // Realtime is an enhancement; offline/local behavior remains available.
      }
    };
    const channel = supabase
      .channel(`coach-sync:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "coach_chats", filter: `user_id=eq.${user.id}` }, () => { void refreshChats(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "coach_messages", filter: `user_id=eq.${user.id}` }, () => { void refreshActiveChat(); })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [activeChatId, user]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  const requestCoachReply = async (content: string, image: string | null | undefined, history: Array<{ role: "user" | "assistant"; content: string }>, signal: AbortSignal) => {
    const session = await getSupabase()?.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) throw new Error("Your session expired. Please sign in again.");
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: content,
        ...(image ? { image } : {}),
        history,
        localDate: localDateKey(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      signal,
    });
    const body: unknown = await response.json();
    const bodyRecord = body && typeof body === "object" ? body as Record<string, unknown> : {};
    if (!response.ok) throw new Error(typeof bodyRecord.error === "string" ? bodyRecord.error : "The Coach is unavailable right now.");
    if (typeof bodyRecord.reply !== "string") throw new Error("The Coach returned an invalid response.");
    const mealActionResult = coachMealActionSchema.safeParse(bodyRecord.mealAction);
    const mealChoices = Array.isArray(bodyRecord.mealChoices) ? bodyRecord.mealChoices.flatMap((choice) => {
      const parsed = coachMealChoiceSchema.safeParse(choice);
      return parsed.success ? [parsed.data] : [];
    }) : [];
    const sources = Array.isArray(bodyRecord.sources) ? bodyRecord.sources.flatMap((source) => {
      if (!source || typeof source !== "object") return [];
      const record = source as Record<string, unknown>;
      return typeof record.title === "string" && typeof record.url === "string" ? [{ title: record.title, url: record.url }] : [];
    }).slice(0, 6) : undefined;
    return { reply: hideCalories ? hideCalorieValues(bodyRecord.reply) : bodyRecord.reply, sources, mealActionResult, mealChoices };
  };
  const send = async (suggestion?: string) => {
    const image = suggestion ? undefined : attachedImage;
    const content = (suggestion ?? draft).trim() || (image ? "Please take a look at this photo." : "");
    if (!content || !user || loading || loadedUserId !== user.id) return;
    if (!activeChatId) return;
    const userMessage: DisplayCoachMessage = { id: crypto.randomUUID(), chatId: activeChatId, role: "user", content, createdAt: new Date().toISOString(), ...(image ? { imageUrl: image } : {}) };
    const history = messages.slice(-12).map(({ role, content: previous }) => ({ role, content: previous }));
    const activeChat = chats.find((chat) => chat.id === activeChatId) || draftChat;
    if (activeChat?.title === "New conversation" && messages.length === 0) {
      const titledChat = { ...activeChat, title: titleFromQuestion(content), updatedAt: userMessage.createdAt };
      setChats((current) => current.some((chat) => chat.id === titledChat.id)
        ? current.map((chat) => chat.id === titledChat.id ? titledChat : chat)
        : [titledChat, ...current]);
      setDraftChat(null);
      try { await saveCloudCoachChat(user.id, titledChat); } catch { setError("Your question was sent, but the chat title could not be saved yet."); }
    }
    setMessages((current) => [...current, userMessage]); setDraft(""); setAttachedImage(null); setError(""); setLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      try { await saveCloudCoachMessage(user.id, userMessage); } catch { setError("This reply will continue, but cloud history is temporarily unavailable."); }
      const result = await requestCoachReply(content, image, history, controller.signal);
      const assistantMessage: DisplayCoachMessage = {
        id: crypto.randomUUID(),
        chatId: activeChatId,
        role: "assistant",
        content: result.reply,
        createdAt: new Date().toISOString(),
        sources: result.sources,
        ...(result.mealActionResult.success ? { mealAction: result.mealActionResult.data } : {}),
        ...(result.mealChoices.length ? { mealChoices: result.mealChoices } : {}),
      };
      setMessages((current) => [...current, assistantMessage]);
      try { await saveCloudCoachMessage(user.id, assistantMessage); } catch { setError("Reply received. Cloud history is temporarily unavailable."); }
      if (result.mealActionResult.success) {
        try { await onLogCoachMeal(result.mealActionResult.data); } catch { setError("The Coach found the meal, but it could not be saved yet. Please try again."); }
      }
    } catch (caught) {
      const aborted = caught instanceof DOMException && caught.name === "AbortError";
      if (image) setAttachedImage(image);
      if (!aborted) setError(caught instanceof Error ? caught.message : "The Coach is unavailable right now.");
    } finally { abortControllerRef.current = null; setLoading(false); }
  };
  const stop = () => { abortControllerRef.current?.abort(); };
  const regenerate = async () => {
    if (!user || loading || loadedUserId !== user.id || !activeChatId) return;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;
    const sourceIndex = messages.slice(0, -1).map((message) => message.role).lastIndexOf("user");
    if (sourceIndex === -1) return;
    const sourceMessage = messages[sourceIndex];
    const history = messages.slice(0, sourceIndex).slice(-12).map(({ role, content }) => ({ role, content }));
    setError(""); setLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const result = await requestCoachReply(sourceMessage.content, sourceMessage.imageUrl, history, controller.signal);
      const replacement: DisplayCoachMessage = {
        id: lastMessage.id,
        chatId: activeChatId,
        role: "assistant",
        content: result.reply,
        createdAt: new Date().toISOString(),
        sources: result.sources,
        ...(result.mealActionResult.success ? { mealAction: result.mealActionResult.data } : {}),
        ...(result.mealChoices.length ? { mealChoices: result.mealChoices } : {}),
      };
      setMessages((current) => current.map((message) => message.id === lastMessage.id ? replacement : message));
      try { await saveCloudCoachMessage(user.id, replacement); } catch { setError("Regenerated reply is shown, but cloud history is temporarily unavailable."); }
    } catch (caught) {
      const aborted = caught instanceof DOMException && caught.name === "AbortError";
      if (!aborted) setError(caught instanceof Error ? caught.message : "The Coach is unavailable right now.");
    } finally { abortControllerRef.current = null; setLoading(false); }
  };
  const copyMessage = async (message: DisplayCoachMessage, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId((current) => current === message.id ? null : current), 1500);
    } catch { setError("Could not copy. Your browser may not allow clipboard access."); }
  };
  const logChoice = async (choice: CoachMealChoice) => {
    if (loggedChoiceLabels.includes(choice.label)) return;
    try {
      await onLogCoachMeal(choice.meal);
      setLoggedChoiceLabels((current) => [...current, choice.label]);
    } catch { setError("The meal could not be saved yet. Please try again."); }
  };
  const switchChat = async (chatId: string) => {
    if (!user || chatId === activeChatId) return;
    setActiveChatId(chatId); setMessages([]);
    try { setMessages(await getCloudCoachMessages(user.id, chatId)); } catch { setError("This conversation could not be loaded."); }
  };
  const newChat = async () => {
    if (!user) return;
    const activeChat = chats.find((chat) => chat.id === activeChatId) || draftChat;
    if (activeChat?.title === "New conversation" && messages.length === 0) {
      setMobileHistoryOpen(false);
      return;
    }
    const now = new Date().toISOString();
    const chat: CoachChat = { id: `draft-${crypto.randomUUID()}`, title: "New conversation", createdAt: now, updatedAt: now };
    setDraftChat(chat); setActiveChatId(chat.id); setMessages([]); setMobileHistoryOpen(false);
  };
  const beginRename = (chat: CoachChat) => {
    setMenuChatId(null);
    setRenamingChatId(chat.id);
    setRenameDraft(chat.title);
  };
  const saveRename = async () => {
    if (!user || !renamingChatId) return;
    const title = renameDraft.trim();
    if (!title) return;
    const chat = chats.find((candidate) => candidate.id === renamingChatId);
    if (!chat) return;
    const renamedChat = { ...chat, title: title.slice(0, 120), updatedAt: new Date().toISOString() };
    setChats((current) => current.map((candidate) => candidate.id === renamedChat.id ? renamedChat : candidate));
    setRenamingChatId(null);
    setMenuChatId(null);
    try { await saveCloudCoachChat(user.id, renamedChat); } catch { setError("The chat was renamed here, but the new name could not be synced yet."); }
  };
  const removeChat = async (chatId = activeChatId) => {
    if (!user || chats.length < 2 || !window.confirm("Delete this conversation? This cannot be undone.")) return;
    await deleteCloudCoachChat(user.id, chatId);
    const remaining = chats.filter((chat) => chat.id !== chatId);
    setChats(remaining); setMenuChatId(null);
    if (chatId === activeChatId) {
      const nextChat = remaining[0];
      setActiveChatId(nextChat.id); setMessages(await getCloudCoachMessages(user.id, nextChat.id));
    }
  };
  const updateGroceryLists = (updater: (current: GroceryList[]) => GroceryList[]) => {
    setGroceryLists((current) => {
      const next = updater(loadedGroceryKey === grocerySettingKey ? current : []);
      if (grocerySettingKey) void setSetting(grocerySettingKey, next);
      return next;
    });
    if (grocerySettingKey) setLoadedGroceryKey(grocerySettingKey);
  };
  const addGroceriesToList = (listId: string, names: string[]) => {
    const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    if (!uniqueNames.length) return;
    updateGroceryLists((current) => current.map((list) => {
      if (list.id !== listId) return list;
      const seen = new Set(list.items.map((item) => item.name.toLocaleLowerCase()));
      return { ...list, items: [...list.items, ...uniqueNames.filter((name) => !seen.has(name.toLocaleLowerCase())).map((name) => ({ id: crypto.randomUUID(), name, checked: false, addedAt: new Date().toISOString() }))], updatedAt: new Date().toISOString() };
    }));
    setActiveGroceryListId(listId);
    setSection("groceries");
  };
  const addGroceries = (names: string[]) => {
    const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    if (!uniqueNames.length) return;
    if (groceryLists.length > 1) { setPendingGroceries(uniqueNames); setGroceryModal("choose"); return; }
    if (groceryLists[0]) addGroceriesToList(groceryLists[0].id, uniqueNames);
  };
  const createGroceryList = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = groceryListDraft.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const list = { id: crypto.randomUUID(), name, items: pendingGroceries.map((item) => ({ id: crypto.randomUUID(), name: item, checked: false, addedAt: now })), createdAt: now, updatedAt: now };
    updateGroceryLists((current) => [...current, list]); setActiveGroceryListId(list.id); setGroceryListDraft(""); setGroceryModal(null);
    setPendingGroceries([]);
  };
  const renameGroceryList = () => {
    const name = groceryListDraft.trim();
    if (!name || !activeGroceryListId) return;
    updateGroceryLists((current) => current.map((list) => list.id === activeGroceryListId ? { ...list, name, updatedAt: new Date().toISOString() } : list)); setGroceryListDraft("");
  };
  const deleteGroceryList = () => {
    if (groceryLists.length < 2 || !activeGroceryListId || !window.confirm("Delete this grocery list and its items?")) return;
    const remaining = groceryLists.filter((list) => list.id !== activeGroceryListId);
    setActiveGroceryListId(remaining[0].id); updateGroceryLists(() => remaining);
  };
  const addGrocery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addGroceries([groceryDraft]);
    setGroceryDraft("");
  };
  const attachCoachImage = async (file?: File) => {
    if (!file) return;
    try {
      setAttachedImage(await imageToDataUrl(file));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That photo could not be attached. Try another image.");
    }
  };

  if (!configured) return (
      <main className="page coach-page"><header className="page-header"><span className="eyebrow">Nutrition only</span><h1>Coach</h1><p>{hideCalories ? "Nutrition guidance using your actual diary." : "Calorie-aware guidance using your actual diary."}</p></header><section className="coach-gate card"><MessageCircle /><h2>Coach setup is waiting</h2><p>Connect the project database to activate private, diary-aware coaching.</p></section></main>
  );
  if (!user) return (
      <main className="page coach-page"><header className="page-header"><span className="eyebrow">Nutrition only</span><h1>Coach</h1><p>{hideCalories ? "Nutrition guidance using your actual diary." : "Calorie-aware guidance using your actual diary."}</p></header><section className="coach-gate card"><MessageCircle /><h2>Sign in for private coaching</h2><p>The Coach reads only the signed-in user’s targets, meals, and saved foods.</p><button type="button" className="primary-button" onClick={onOpenAccount}><Mail size={17} />Open account setup</button></section></main>
  );
  if (loadedUserId !== user.id) return (
    <main className="page coach-page"><header className="page-header"><span className="eyebrow">Your diary, in context</span><h1>Coach</h1></header><section className="coach-gate card"><span className="coach-loader" /><h2>Loading your private Coach…</h2></section></main>
  );

  const todayNutrition = sumNutrition(meals.filter((meal) => (meal.loggedDate || localDateKey(new Date(meal.createdAt))) === localDateKey()).map((meal) => meal.nutrition));
  const todayTargets = resolveDailyTargets(profile, localDateKey());
  const lowMacros = lowestTrackedMacros(todayNutrition, todayTargets, { tolerancePercent: profile.insightsTolerancePercent, includeCalories: !hideCalories, max: 2 });
  const macroLabels: Record<LowMacroKey, string> = { calories: "calories", protein: "protein", carbs: "carbs", fat: "fat", fiber: "fibre" };
  const dynamicStarters = lowMacros.map(({ key, current, target }) => key === "calories"
    ? `I'm at ${Math.round(current)} of ${Math.round(target)} calories today — any easy ideas to round it out?`
    : `What's a good source of ${macroLabels[key]}? I'm at ${Math.round(current)}g of ${Math.round(target)}g today.`);
  const starters = [...dynamicStarters, hideCalories ? "How are my nutrients today?" : "How am I doing today?", "Plan a quick dinner and make a grocery list", "What can I make with chicken and broccoli?"].slice(0, 3);
  const filteredChats = chats.filter((chat) => chat.title.toLocaleLowerCase().includes(chatSearch.trim().toLocaleLowerCase()));
  const activeGroceryList = groceryLists.find((list) => list.id === activeGroceryListId) || groceryLists[0];
  const activeChat = chats.find((chat) => chat.id === activeChatId) || draftChat;
  const accountGroceryItems = loadedGroceryKey === grocerySettingKey ? activeGroceryList?.items || [] : [];
  const remainingGroceries = accountGroceryItems.filter((item) => !item.checked).length;
  return (
    <main className={`page coach-page coach-text-${chatTextSize}`} inert={groceryModal !== null || undefined}>
      <header className="coach-header">
        <div className="coach-header-row">
          <button className="coach-back" type="button" aria-label="Back to Today" onClick={section === "chat" ? onBack : () => setSection("chat")}><ArrowLeft size={16} /></button>
          <span className="eyebrow">Your food companion</span>
          {section === "chat" && <button className="coach-new-chat" type="button" onClick={() => void newChat()} aria-label="New chat"><Plus size={14} />New chat</button>}
          {section === "chat" && <button className="coach-history-trigger" type="button" aria-expanded={mobileHistoryOpen} aria-controls="coach-history-drawer" aria-label="Chat history" onClick={() => setMobileHistoryOpen((open) => !open)}><Menu size={16} /></button>}
        </div>
        <h1>{section === "chat" ? activeChat?.title || "New conversation" : activeGroceryList?.name || "Your groceries"}</h1>
      </header>
      {section === "chat" && mobileHistoryOpen && <button className="coach-mobile-backdrop" type="button" aria-label="Close previous chats" onClick={() => setMobileHistoryOpen(false)} />}
      <div className="coach-layout">
        {section === "chat" && <aside ref={coachHistoryRef} id="coach-history-drawer" className={`coach-history ${mobileHistoryOpen ? "mobile-open" : ""}`} aria-label="Previous chats"><div className="coach-history-heading"><strong>Chats</strong><button className="icon-button ghost" type="button" onClick={() => setMobileHistoryOpen(false)} aria-label="Close previous chats"><X size={16} /></button></div><label className="coach-history-search"><Search size={14} /><input value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Search chats" /></label><button className="coach-grocery-link" type="button" onClick={() => { setSection("groceries"); setMobileHistoryOpen(false); }}><ListChecks size={15} /><span>Groceries</span>{remainingGroceries > 0 && <small>{remainingGroceries}</small>}</button><div className="coach-history-list">{filteredChats.length === 0 && chatSearch.trim() ? <div className="search-empty coach-history-empty"><strong>No chats found</strong><p>Try a different search term.</p></div> : filteredChats.map((chat) => <div className={`coach-history-row ${chat.id === activeChatId ? "active" : ""}`} key={chat.id}>{renamingChatId === chat.id ? <form className="coach-rename-form" onSubmit={(event) => { event.preventDefault(); void saveRename(); }}><input autoFocus value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} maxLength={120} aria-label="Chat name" placeholder="Chat name" /><button type="submit" aria-label="Save chat name"><Check size={14} /></button></form> : <><button className="coach-history-chat" type="button" title={chat.title} onClick={() => { void switchChat(chat.id); setMobileHistoryOpen(false); }}><span>{chat.title}</span><small>{new Date(chat.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></button><span className="coach-history-menu-wrap"><button className="coach-history-menu-trigger" type="button" aria-label={`Chat options for ${chat.title}`} aria-expanded={menuChatId === chat.id} onClick={() => setMenuChatId((current) => current === chat.id ? null : chat.id)}><MoreHorizontal size={17} /></button>{menuChatId === chat.id && <span className="coach-chat-menu" role="menu"><button type="button" role="menuitem" onClick={() => beginRename(chat)}><Pencil size={14} />Rename</button><button type="button" role="menuitem" className="danger" onClick={() => void removeChat(chat.id)}><Trash2 size={14} />Delete</button></span>}</span></>}</div>)}</div></aside>}
        <div className="coach-main">
      {section === "chat" && <>
        <section className="coach-thread" aria-live="polite">
          {messages.length === 0 && <><div className="coach-scope"><ShieldCheck size={15} /><span>{hideCalories ? "Food and nutrition only" : "Food, calories & nutrition only"} · recipes and lists saved only when you choose</span></div><div className="coach-welcome"><span className="coach-orb"><Sparkles /></span><h2>What should we make?</h2><p>Talk through dinner, use up what you have, or log a food by scanning it.</p><div className="coach-starters">{starters.map((starter) => <button key={starter} onClick={() => send(starter)}>{starter}</button>)}</div></div></>}
          {messages.map((message, index) => { const visibleContent = hideCalories ? hideCalorieValues(message.content) : message.content; const groceries = message.role === "assistant" ? groceryItemsFromReply(visibleContent) : []; return <article key={message.id} className={`coach-message ${message.role}`}><span>{message.role === "assistant" ? "Coach" : "You"}<small>{new Date(message.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</small></span>{message.imageUrl && <img className="coach-message-image" src={message.imageUrl} alt="Photo shared with Coach" />}<p>{visibleContent}</p><div className="coach-message-actions"><button type="button" className="coach-message-copy" onClick={() => void copyMessage(message, visibleContent)} aria-label="Copy message">{copiedMessageId === message.id ? <Check size={13} /> : <Copy size={13} />}{copiedMessageId === message.id ? "Copied" : "Copy"}</button>{message.role === "assistant" && index === messages.length - 1 && !loading && <button type="button" className="coach-message-regenerate" onClick={() => void regenerate()}><RotateCcw size={13} />Regenerate</button>}</div>{message.mealAction && <div className="coach-log-confirmation"><Check size={16} /><span>Logged as {mealLabels[message.mealAction.mealType]} · {message.mealAction.loggedDate}</span></div>}{message.mealChoices && <div className="coach-meal-choices"><strong>Choose where to log it</strong>{message.mealChoices.map((choice) => <button key={choice.label} type="button" disabled={loggedChoiceLabels.includes(choice.label)} onClick={() => void logChoice(choice)}>{loggedChoiceLabels.includes(choice.label) ? "Logged · " : ""}{choice.label}</button>)}</div>}{groceries.length > 0 && <div className="recipe-grocery-action"><strong>Want to cook this?</strong><button className="add-groceries" onClick={() => addGroceries(groceries)}><ListChecks size={15} />Add {groceries.length} {groceries.length === 1 ? "ingredient" : "ingredients"} to groceries</button></div>}{!!message.sources?.length && <div className="coach-sources"><strong>Sources</strong>{message.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}</article>; })}
          {loading && <div className="coach-typing" aria-label="Coach is typing"><i /><i /><i /></div>}
          {error && <div className="inline-alert error" role="alert"><Info size={17} /><span>{error}</span><button className="text-button" type="button" onClick={() => { setError(""); setLoadedUserId(""); setHistoryAttempt((value) => value + 1); }}>Retry</button></div>}
          <div ref={endRef} />
        </section>
        <div className="coach-composer-wrap"><div className="coach-log-actions"><button type="button" onClick={() => onOpenAdd("scan")}><ScanLine size={16} />Scan barcode</button><button type="button" onClick={() => onOpenAdd("camera")}><Camera size={16} />Read label</button></div><form className="coach-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>{attachedImage && <div className="coach-attachment"><img src={attachedImage} alt="Photo attached to your message" /><button type="button" onClick={() => setAttachedImage(null)} aria-label="Remove attached photo"><X size={15} /></button></div>}<input ref={coachImageInputRef} className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => { void attachCoachImage(event.target.files?.[0]); event.currentTarget.value = ""; }} /><button className="coach-attach" type="button" aria-label="Attach photo" onClick={() => coachImageInputRef.current?.click()}><Plus /></button><ClearableInput aria-label="Message the nutrition Coach" value={draft} onChange={(event) => setDraft(event.target.value)} onClear={() => setDraft("")} maxLength={6000} placeholder={attachedImage ? "Add a note about this photo…" : "Ask about dinner, recipes, or your food log…"} clearLabel="Clear Coach message" /><button className={loading ? "coach-send coach-stop" : "coach-send"} type={loading ? "button" : "submit"} onClick={loading ? (event) => { event.preventDefault(); stop(); } : undefined} disabled={!loading && !draft.trim() && !attachedImage} aria-label={loading ? "Stop generating" : "Send"}>{loading ? <Square size={14} /> : <Send />}</button></form></div>
      </>}
      {section === "groceries" && <section className="grocery-workspace"><div className="grocery-intro"><span className="coach-orb"><ListChecks /></span><div><h2>{activeGroceryList?.name || "Your groceries"}</h2><p>Keep separate lists for meal plans, weekly shopping, or different stores.</p></div><button className="icon-button ghost" type="button" onClick={() => { setGroceryListDraft(activeGroceryList?.name || ""); setGroceryModal("manage"); }} aria-label="Manage grocery lists"><Pencil size={16} /></button></div><div className="grocery-list-toolbar"><label htmlFor="grocery-list-select">List</label><ThemedSelect ariaLabel="Grocery list" value={activeGroceryListId} onChange={setActiveGroceryListId} options={groceryLists.map((list) => ({ value: list.id, label: list.name }))} /><button type="button" className="secondary-button" onClick={() => { setGroceryListDraft(""); setGroceryModal("manage"); }}><Plus size={15} />New list</button></div><form className="grocery-composer" onSubmit={addGrocery}><ClearableInput value={groceryDraft} onChange={(event) => setGroceryDraft(event.target.value)} onClear={() => setGroceryDraft("")} placeholder="Add an item yourself" maxLength={120} clearLabel="Clear grocery item" /><button type="submit" disabled={!groceryDraft.trim()}>Add</button></form>{accountGroceryItems.length > 0 ? <div className="grocery-list">{accountGroceryItems.map((item) => <div key={item.id} className={item.checked ? "checked" : ""}><button className="grocery-toggle" onClick={() => updateGroceryLists((current) => current.map((list) => list.id === activeGroceryListId ? { ...list, items: list.items.map((candidate) => candidate.id === item.id ? { ...candidate, checked: !candidate.checked } : candidate), updatedAt: new Date().toISOString() } : list))} aria-label={`Mark ${item.name} as ${item.checked ? "needed" : "picked up"}`}>{item.checked && <Check size={14} />}</button><span>{item.name}</span><button className="grocery-remove" onClick={() => updateGroceryLists((current) => current.map((list) => list.id === activeGroceryListId ? { ...list, items: list.items.filter((candidate) => candidate.id !== item.id), updatedAt: new Date().toISOString() } : list))} aria-label={`Remove ${item.name}`}><X size={16} /></button></div>)}</div> : <div className="grocery-empty"><Package size={28} /><strong>Start with a dinner idea</strong><p>Ask Coach for a recipe or meal plan, then add the suggested ingredients here.</p><button className="secondary-button" onClick={() => setSection("chat")}><MessageCircle size={16} />Open Coach</button></div>}{accountGroceryItems.some((item) => item.checked) && <button className="text-button muted clear-picked" onClick={() => updateGroceryLists((current) => current.map((list) => list.id === activeGroceryListId ? { ...list, items: list.items.filter((item) => !item.checked), updatedAt: new Date().toISOString() } : list))}>Clear picked-up items</button>}</section>}
      {groceryModal === "choose" && <Sheet label="Choose a grocery list" onClose={() => { setGroceryModal(null); setPendingGroceries([]); }}><div className="sheet-header"><span /><div><span className="eyebrow">Add ingredients</span><h2>Choose a list</h2></div><span /></div><p className="grocery-modal-copy">Where should {pendingGroceries.length === 1 ? "this" : "these"} {pendingGroceries.length} {pendingGroceries.length === 1 ? "ingredient" : "ingredients"} go?</p><div className="grocery-list-choices">{groceryLists.map((list) => <button key={list.id} type="button" onClick={() => { addGroceriesToList(list.id, pendingGroceries); setPendingGroceries([]); setGroceryModal(null); }}><span><strong>{list.name}</strong><small>{list.items.filter((item) => !item.checked).length} {list.items.filter((item) => !item.checked).length === 1 ? "item" : "items"} still needed</small></span><ChevronRight size={17} /></button>)}</div><button type="button" className="secondary-button full" onClick={() => { setGroceryModal("manage"); setGroceryListDraft(""); }}><Plus size={16} />Create a new list</button></Sheet>}
      {groceryModal === "manage" && <Sheet label="Manage grocery lists" onClose={() => setGroceryModal(null)}><div className="sheet-header"><span /><div><span className="eyebrow">Your lists</span><h2>Manage groceries</h2></div><span /></div><form className="grocery-list-create" onSubmit={createGroceryList}><ClearableInput value={groceryListDraft} onChange={(event) => setGroceryListDraft(event.target.value)} onClear={() => setGroceryListDraft("")} placeholder="New list name" maxLength={60} clearLabel="Clear grocery list name" /><button className="primary-button" type="submit" disabled={!groceryListDraft.trim()}>Create</button></form><div className="grocery-manage-list">{groceryLists.map((list) => <button key={list.id} type="button" className={list.id === activeGroceryListId ? "active" : ""} onClick={() => { setActiveGroceryListId(list.id); setGroceryListDraft(list.name); }}><span>{list.name}<small>{list.items.length} {list.items.length === 1 ? "item" : "items"}</small></span><Check size={16} /></button>)}</div>{activeGroceryList && <div className="grocery-manage-actions"><button className="secondary-button" type="button" onClick={renameGroceryList} disabled={!groceryListDraft.trim()}>Rename selected</button><button className="text-button danger" type="button" onClick={deleteGroceryList} disabled={groceryLists.length < 2}>Delete selected</button></div>}</Sheet>}
        </div>
      </div>
    </main>
  );
}


async function imageToDataUrl(file: File, options: { maxDimension?: number; quality?: number } = {}) {
  const image = await createImageBitmap(file);
  const max = options.maxDimension || 2200;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  context?.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  let quality = options.quality || 0.9;
  let result = canvas.toDataURL("image/jpeg", quality);
  // Keep the request below the server's 10 MB boundary even for a very
  // detailed camera capture. Reducing JPEG quality preserves label pixels
  // better than shrinking the image again.
  while (result.length > 9_500_000 && quality > 0.72) {
    quality -= 0.06;
    result = canvas.toDataURL("image/jpeg", quality);
  }
  return result;
}
