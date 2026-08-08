"use client";

import { ArrowLeft, Mail, Menu, MessageCircle } from "lucide-react";
import { useState } from "react";
import { ChooseGroceryListSheet, type GroceryListsApi } from "@/features/groceries";
import { localDateKey, lowestTrackedMacros, resolveDailyTargets, sumNutrition, type LowMacroKey } from "@/lib/nutrition";
import type { CloudUser } from "@/lib/supabase";
import type { CoachMealAction, Meal, Profile } from "@/lib/types";

import { CoachComposer } from "./components/CoachComposer";
import { CoachHistorySidebar } from "./components/CoachHistorySidebar";
import { CoachThread } from "./components/CoachThread";
import { useCoachChats } from "./hooks/useCoachChats";
import { imageToDataUrl } from "./lib/coachApi";
import { coachErrorKinds, type AddView, type ChatTextSize, type DisplayCoachMessage } from "./types";

const macroLabels: Record<LowMacroKey, string> = { calories: "calories", protein: "protein", carbs: "carbs", fat: "fat", fiber: "fibre" };

function CoachGate({ hideCalories, children }: { hideCalories: boolean; children: React.ReactNode }) {
  return <main className="page coach-page">
    <header className="page-header"><span className="eyebrow">Nutrition only</span><h1>Coach</h1><p>{hideCalories ? "Nutrition guidance using your actual diary." : "Calorie-aware guidance using your actual diary."}</p></header>
    <section className="coach-gate card">{children}</section>
  </main>;
}

export function CoachView({ configured, user, profile, meals, groceries, onBack, onOpenAccount, onOpenAdd, onOpenGroceries, onLogCoachMeal, hideCalories, chatTextSize }: {
  configured: boolean;
  user: CloudUser | null;
  profile: Profile;
  meals: Meal[];
  groceries: GroceryListsApi;
  onBack: () => void;
  onOpenAccount: () => void;
  onOpenAdd: (view: AddView) => void;
  onOpenGroceries: () => void;
  onLogCoachMeal: (action: CoachMealAction) => Promise<void>;
  hideCalories: boolean;
  chatTextSize: ChatTextSize;
}) {
  const coach = useCoachChats(user, onLogCoachMeal);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingGroceries, setPendingGroceries] = useState<string[]>([]);

  if (!configured) return <CoachGate hideCalories={hideCalories}><MessageCircle /><h2>Coach setup is waiting</h2><p>Connect the project database to activate private, diary-aware coaching.</p></CoachGate>;
  if (!user) return <CoachGate hideCalories={hideCalories}>
    <MessageCircle /><h2>Sign in for private coaching</h2><p>The Coach reads only the signed-in user’s targets, meals, and saved foods.</p>
    <button type="button" className="primary-button" onClick={onOpenAccount}><Mail size={17} />Open account setup</button>
  </CoachGate>;
  if (!coach.ready) return <main className="page coach-page">
    <header className="page-header"><span className="eyebrow">Your diary, in context</span><h1>Coach</h1></header>
    <section className="coach-gate card"><span className="coach-loader" /><h2>Loading your private Coach…</h2></section>
  </main>;

  const todayNutrition = sumNutrition(meals.filter((meal) => (meal.loggedDate || localDateKey(new Date(meal.createdAt))) === localDateKey()).map((meal) => meal.nutrition));
  const todayTargets = resolveDailyTargets(profile, localDateKey());
  const lowMacros = lowestTrackedMacros(todayNutrition, todayTargets, { tolerancePercent: profile.insightsTolerancePercent, includeCalories: !hideCalories, max: 2 });
  const dynamicStarters = lowMacros.map(({ key, current, target }) => key === "calories"
    ? `I'm at ${Math.round(current)} of ${Math.round(target)} calories today — any easy ideas to round it out?`
    : `What's a good source of ${macroLabels[key]}? I'm at ${Math.round(current)}g of ${Math.round(target)}g today.`);
  const starters = [...dynamicStarters, hideCalories ? "How are my nutrients today?" : "How am I doing today?", "Plan a quick dinner and make a grocery list", "What can I make with chicken and broccoli?"].slice(0, 3);

  const copyMessage = async (content: string) => {
    try { await navigator.clipboard.writeText(content); return true; }
    catch { coach.reportError({ kind: coachErrorKinds.notice, message: "Could not copy. Your browser may not allow clipboard access." }); return false; }
  };
  const attachImage = async (file?: File) => {
    if (!file) return;
    try { coach.setAttachedImage(await imageToDataUrl(file)); coach.dismissError(); }
    catch (caught) { coach.reportError({ kind: coachErrorKinds.notice, message: caught instanceof Error ? caught.message : "That photo could not be attached. Try another image." }); }
  };
  /** One list goes straight there; several ask first. Either way the user lands on the list they filled. */
  const addGroceries = (names: string[]) => {
    if (groceries.lists.length > 1) { setPendingGroceries(names); return; }
    const list = groceries.lists[0];
    if (!list) return;
    groceries.addItems(list.id, names);
    onOpenGroceries();
  };
  const editMessage = (message: DisplayCoachMessage) => { void coach.editAndResend(message); };

  return <main className={`page coach-page coach-text-${chatTextSize}`} inert={pendingGroceries.length > 0 || undefined}>
    <header className="coach-header">
      <div className="coach-header-row">
        <button className="coach-back" type="button" aria-label="Back to Today" onClick={onBack}><ArrowLeft size={16} /></button>
        <h1>{coach.activeChat?.title || "New conversation"}</h1>
        <button className="coach-history-trigger" type="button" aria-expanded={historyOpen} aria-controls="coach-history-drawer" aria-label="Your conversations" onClick={() => setHistoryOpen((open) => !open)}><Menu size={16} /></button>
      </div>
    </header>

    {historyOpen && <button className="coach-mobile-backdrop" type="button" aria-label="Close conversations" onClick={() => setHistoryOpen(false)} />}

    <div className="coach-layout">
      <CoachHistorySidebar
        chats={coach.chats}
        activeChatId={coach.activeChatId}
        open={historyOpen}
        remainingGroceries={groceries.remainingCount}
        onClose={() => setHistoryOpen(false)}
        onSelect={(chatId) => void coach.switchChat(chatId)}
        onNewChat={() => { coach.newChat(); setHistoryOpen(false); }}
        onRename={(chatId, title) => void coach.renameChat(chatId, title)}
        onDelete={(chatId) => void coach.deleteChat(chatId)}
        onOpenGroceries={() => { setHistoryOpen(false); onOpenGroceries(); }}
      />
      <div className="coach-main">
        <CoachThread
          messages={coach.messages}
          starters={starters}
          hideCalories={hideCalories}
          loading={coach.loading}
          error={coach.error}
          loggedChoices={coach.loggedChoices}
          onSend={(starter) => void coach.send(starter)}
          onCopy={copyMessage}
          onRegenerate={() => void coach.regenerate()}
          onEdit={editMessage}
          onLogChoice={(message, choice) => void coach.logChoice(message, choice)}
          onAddGroceries={addGroceries}
          onRetryError={() => void coach.retryError()}
          onDismissError={coach.dismissError}
        />
        <CoachComposer
          draft={coach.draft}
          onDraftChange={coach.setDraft}
          attachedImage={coach.attachedImage}
          onAttachFile={(file) => void attachImage(file)}
          onRemoveAttachment={() => coach.setAttachedImage(null)}
          loading={coach.loading}
          onSend={() => void coach.send()}
          onStop={coach.stop}
          onOpenAdd={onOpenAdd}
        />
      </div>
    </div>

    {pendingGroceries.length > 0 && <ChooseGroceryListSheet
      api={groceries}
      items={pendingGroceries}
      onClose={() => setPendingGroceries([])}
      onChosen={() => { setPendingGroceries([]); onOpenGroceries(); }}
    />}
  </main>;
}
