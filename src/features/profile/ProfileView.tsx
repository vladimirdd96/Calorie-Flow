"use client";

import { BarChart3, ChevronRight, Cloud, Download, FileText, Library, MessageCircle, Pencil, RefreshCw, Ruler, Share2, SlidersHorizontal, Upload, UserRound, Utensils, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { ClearableInput } from "@/features/shared/ClearableInput";
import { NumericInput } from "@/features/shared/NumericInput";
import { Sheet } from "@/features/shared/Sheet";
import type { AppNavigationTarget, ProfileSection as NavigationProfileSection } from "@/features/navigation/types";
import { validateBackup } from "@/lib/db";
import { acceptCloudDiaryShare, getCloudDiaryShares, getSharedDiarySnapshot, inviteCloudDiaryShare, revokeCloudDiaryShare } from "@/lib/cloud";
import { localDateKey } from "@/lib/nutrition";
import { mealsCsv } from "@/lib/reports";
import { type CloudUser } from "@/lib/supabase";
import type { ActivityLevel, DiaryShare, Profile } from "@/lib/types";
import { measurementSystems } from "@/lib/types";
import type { BackupData } from "@/lib/db";

type ProfileSection = NavigationProfileSection;

type SyncState = "local" | "syncing" | "synced" | "offline" | "error";

type ThemeMode = "light" | "dark";

type ChatTextSize = "compact" | "comfortable" | "large";

function accountDisplayName(user: CloudUser | null) {
  const candidates = [user?.user_metadata?.full_name, user?.user_metadata?.name];
  return candidates.find((candidate): candidate is string => typeof candidate === "string" && Boolean(candidate.trim()))?.trim();
}

import { TargetEditor } from "./components/ProfileTargets";
import { NutritionGoalFields } from "./components/NutritionGoalFields";
import { useModalFocus } from "./hooks/useDisclosure";

import { ProfileCustomize } from "./components/ProfileCustomize";

function ProfileSectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="profile-section-label">{children}</h2>;
}

function ProfileLinkRow({ icon, tone, title, detail, onClick }: { icon: React.ReactNode; tone: "mint" | "carbs" | "blue" | "fat"; title: string; detail: string; onClick: () => void }) {
  return <button className="profile-link-row" type="button" onClick={onClick}><span className={`profile-link-icon ${tone}`}>{icon}</span><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={16} /></button>;
}

function DailyTargetsSheet({ profile, onSave, onClose }: { profile: Profile; onSave: (profile: Profile) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(profile);
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const macroCalories = Math.round(draft.proteinTarget * 4 + draft.carbsTarget * 4 + draft.fatTarget * 9);
  return <form className="profile-compact-sheet" onSubmit={(event) => { event.preventDefault(); onSave(draft); onClose(); }}>
    <div className="compact-sheet-header"><h2>Daily targets</h2><button type="button" className="icon-button ghost" aria-label="Close" onClick={onClose}><X size={17} /></button></div>
    <div className="profile-target-fields">{(["calorieTarget", "proteinTarget", "carbsTarget", "fatTarget"] as const).map((key) => <label key={key} className={key}><span>{key === "calorieTarget" ? "Calories" : `${key.replace("Target", "")[0].toUpperCase()}${key.replace("Target", "").slice(1)} (g)`}</span><NumericInput min="0" value={draft[key]} onChange={(event) => update(key, Math.max(0, Number(event.target.value)))} /></label>)}</div>
    <p>Macros add up to <strong>{macroCalories} kcal</strong> against a {draft.calorieTarget} kcal target.</p>
    <details className="nutrition-goals-advanced">
      <summary><span><strong>More nutrition goals</strong><small>Sugar, saturated fat, sodium and potassium.</small></span><ChevronRight size={16} /></summary>
      <NutritionGoalFields profile={draft} onChange={(key, value) => update(key, value)} />
    </details>
    <button className="primary-button full" type="submit">Save targets</button>
  </form>;
}

function BodyActivitySheet({ profile, onSave, onClose }: { profile: Profile; onSave: (profile: Profile) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(profile);
  return <form className="profile-compact-sheet" onSubmit={(event) => { event.preventDefault(); onSave(draft); onClose(); }}>
    <div className="compact-sheet-header"><h2>Body &amp; activity</h2><button type="button" className="icon-button ghost" aria-label="Close" onClick={onClose}><X size={17} /></button></div>
    <p>These only feed the target suggestion. Change them any time and we&apos;ll recalculate.</p>
    <div className="profile-body-fields">
      <label><span>Age</span><NumericInput min="16" max="100" value={draft.age} onChange={(event) => setDraft({ ...draft, age: Number(event.target.value) })} /></label>
      <label><span>Height (cm)</span><NumericInput min="120" max="230" value={draft.heightCm} onChange={(event) => setDraft({ ...draft, heightCm: Number(event.target.value) })} /></label>
      <label><span>Weight (kg)</span><NumericInput min="35" max="300" step=".1" value={draft.weightKg} onChange={(event) => setDraft({ ...draft, weightKg: Number(event.target.value) })} /></label>
    </div>
    <label><span>Activity level</span><ThemedSelect ariaLabel="Activity level" value={draft.activity} onChange={(value) => setDraft({ ...draft, activity: value as ActivityLevel })} options={[{ value: "sedentary", label: "Mostly sitting · desk work" }, { value: "light", label: "Lightly active · 1–2 sessions" }, { value: "moderate", label: "Moderately active · 3–4 sessions" }, { value: "active", label: "Very active · 5+ sessions" }, { value: "very-active", label: "Physical work or daily training" }]} /></label>
    <button className="primary-button full" type="submit">Save</button>
  </form>;
}
function DiarySharing({ user }: { user: CloudUser | null }) {
  const [shares, setShares] = useState<DiaryShare[]>([]);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(Boolean(user));
  const [sending, setSending] = useState(false);
  const [activeShare, setActiveShare] = useState<DiaryShare | null>(null);
  const [sharedDiary, setSharedDiary] = useState<Awaited<ReturnType<typeof getSharedDiarySnapshot>> | null>(null);

  const loadShares = useCallback(async () => {
    if (!user) { setShares([]); setLoading(false); return; }
    setLoading(true);
    try {
      setShares(await getCloudDiaryShares());
    } catch {
      setNotice("Couldn’t load diary sharing. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void loadShares(); });
    return () => window.cancelAnimationFrame(frame);
  }, [loadShares]);

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSending(true); setNotice("");
    try {
      const share = await inviteCloudDiaryShare(user.id, user.email, recipientEmail);
      setShares((current) => [share, ...current]);
      setRecipientEmail("");
      setNotice(`Invitation ready for ${share.recipientEmail}. They’ll need to sign in with that address to accept it.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn’t create that invitation.");
    } finally {
      setSending(false);
    }
  };

  const accept = async (share: DiaryShare) => {
    setNotice("");
    try {
      const accepted = await acceptCloudDiaryShare(share.id);
      setShares((current) => current.map((item) => item.id === accepted.id ? accepted : item));
      setNotice("You can now view this shared diary. It stays read-only.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn’t accept that invitation.");
    }
  };

  const revoke = async (share: DiaryShare) => {
    if (!user) return;
    setNotice("");
    try {
      await revokeCloudDiaryShare(user.id, share.id);
      setShares((current) => current.map((item) => item.id === share.id ? { ...item, status: "revoked", recipientId: undefined, revokedAt: new Date().toISOString() } : item));
      setNotice("Access revoked. That diary is no longer visible to them.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn’t revoke this share.");
    }
  };

  const openSharedDiary = async (share: DiaryShare) => {
    setActiveShare(share); setSharedDiary(null); setNotice("");
    try {
      setSharedDiary(await getSharedDiarySnapshot(share));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn’t open this shared diary.");
      setActiveShare(null);
    }
  };

  const sent = shares.filter((share) => share.ownerId === user?.id);
  const received = shares.filter((share) => share.ownerId !== user?.id);
  const recentMeals = sharedDiary?.meals
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 12) || [];

  return <section className="sharing-section" aria-labelledby="diary-sharing-heading">
    <div className="section-heading"><div><span className="eyebrow">Private accountability</span><h2 id="diary-sharing-heading">Share a read-only diary</h2></div></div>
    <div className="sharing-card card">
      <div className="sharing-intro"><span className="sharing-icon"><Share2 size={19} /></span><div><strong>Invite people you trust</strong><p>Only the invited email can accept. They can see meals and saved foods, never your targets, profile, Coach, or edit controls.</p></div></div>
      {user ? <form className="sharing-invite" onSubmit={invite}>
        <label><span>Invite by email</span><ClearableInput type="email" autoComplete="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} onClear={() => setRecipientEmail("")} placeholder="friend@example.com" required clearLabel="Clear invite email" /></label>
        <button className="secondary-button" type="submit" disabled={sending}>{sending ? "Sending…" : "Create invitation"}</button>
      </form> : <p className="sharing-signed-out">Sign in to create or receive a private diary invitation.</p>}
      {notice && <p className="sharing-notice" role="status">{notice}</p>}
      {user && <div className="sharing-lists">
        <div><span className="sharing-list-label">Sent invitations</span>{loading ? <p className="sharing-empty">Loading invitations…</p> : sent.length ? <div className="sharing-list">{sent.map((share) => <div key={share.id} className="sharing-row"><div><strong>{share.recipientEmail}</strong><small>{share.status === "accepted" ? "Viewing your diary" : share.status === "pending" ? "Waiting to accept" : "Access revoked"}</small></div>{share.status !== "revoked" && <button className="text-button danger-hover" type="button" onClick={() => void revoke(share)}>Revoke</button>}</div>)}</div> : <p className="sharing-empty">No invitations sent.</p>}</div>
        <div><span className="sharing-list-label">Shared with you</span>{loading ? <p className="sharing-empty">Loading invitations…</p> : received.length ? <div className="sharing-list">{received.map((share) => <div key={share.id} className="sharing-row"><div><strong>Private diary</strong><small>{share.status === "pending" ? `Invitation for ${share.recipientEmail}` : share.status === "accepted" ? "Read-only access" : "Access revoked"}</small></div>{share.status === "pending" ? <button className="secondary-button compact" type="button" onClick={() => void accept(share)}>Accept</button> : share.status === "accepted" ? <button className="secondary-button compact" type="button" onClick={() => void openSharedDiary(share)}>View diary</button> : null}</div>)}</div> : <p className="sharing-empty">No one has shared a diary with you.</p>}</div>
      </div>}
    </div>
    {activeShare && <Sheet label="Shared diary" onClose={() => { setActiveShare(null); setSharedDiary(null); }}>
      <div className="shared-diary-sheet"><div className="sheet-header"><div><span className="eyebrow">Read-only diary</span><h2>Shared meals</h2></div><span /></div>{sharedDiary ? <><p>Recent entries shared privately with you. You cannot edit, copy over, or expose this diary to anyone else.</p>{recentMeals.length ? <div className="card shared-meal-list">{recentMeals.map((meal) => <div key={meal.id}><div><strong>{meal.name}</strong><small>{meal.mealType} · {new Date(meal.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></div><span>{meal.nutrition.protein.toFixed(0)} g protein</span></div>)}</div> : <p className="sharing-empty">There are no meals in this diary yet.</p>}</> : <p className="sharing-empty">Opening shared diary…</p>}</div>
    </Sheet>}
  </section>;
}

export function ProfileView({
  profile,
  onSave,
  onRestartOnboarding,
  onExport,
  onImport,
  user,
  syncState,
  onSignOut,
  theme,
  onThemeChange,
  chatTextSize,
  onChatTextSizeChange,
  onNavigate,
  initialSection,
}: {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onRestartOnboarding: () => void;
  onExport: () => Promise<BackupData>;
  onImport: (data: BackupData, mode: "merge" | "replace") => Promise<void>;
  user: CloudUser | null;
  syncState: SyncState;
  onSignOut: () => Promise<void>;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  chatTextSize: ChatTextSize;
  onChatTextSizeChange: (size: ChatTextSize) => void;
  onNavigate: (target: AppNavigationTarget) => void;
  initialSection?: ProfileSection;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const [editingTargets, setEditingTargets] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [profileSection, setProfileSection] = useState<ProfileSection>(initialSection || "profile");
  const [backupNotice, setBackupNotice] = useState("");
  const [, setExporting] = useState(false);
  const downloadCsv = async () => {
    setExporting(true); setBackupNotice("");
    try {
      const data = await onExport();
      const url = URL.createObjectURL(new Blob([mealsCsv(data.meals)], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `calorie-flow-meals-${localDateKey()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setBackupNotice("Your meal report was downloaded as CSV.");
    } catch {
      setBackupNotice("Couldn’t prepare the meal report. Check your connection and try again.");
    } finally { setExporting(false); }
  };
  const download = async () => {
    setExporting(true); setBackupNotice("");
    try {
      const data = await onExport();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `calorie-flow-${localDateKey()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setBackupNotice("Your data archive was downloaded.");
    } catch {
      setBackupNotice("Couldn’t prepare a complete archive. Check your connection and try again.");
    } finally {
      setExporting(false);
    }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      const data = validateBackup(JSON.parse(await file.text()));
      await onImport(data, "merge");
      setBackupNotice("Backup merged with your current data.");
    } catch {
      setBackupNotice("That file isn’t a valid Calorie Flow backup.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };
  return (
    <main className="page profile-page">
      <header className="profile-handoff-header"><div className="profile-handoff-avatar">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : (profile.name || accountDisplayName(user) || "You").slice(0, 1).toUpperCase()}</div><div><span>Profile</span><h1>{profile.name || accountDisplayName(user) || "Your profile"}</h1></div></header>
      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        <button id="profile-tab" type="button" role="tab" aria-selected={profileSection === "profile"} aria-controls="profile-panel" className={profileSection === "profile" ? "active" : ""} onClick={() => setProfileSection("profile")}><UserRound size={15} />Profile</button>
        <button id="customize-tab" type="button" role="tab" aria-selected={profileSection === "customize"} aria-controls="customize-panel" className={profileSection === "customize" ? "active" : ""} onClick={() => setProfileSection("customize")}><SlidersHorizontal size={15} />Customize</button>
      </div>
      {profileSection === "profile" ? <div id="profile-panel" role="tabpanel" aria-labelledby="profile-tab" tabIndex={0}>
        <ProfileSectionLabel>Daily targets</ProfileSectionLabel>
        <section className="profile-target-card"><div><span><small>kcal</small><strong>{profile.calorieTarget}</strong></span><span><small>Protein</small><strong>{profile.proteinTarget}g</strong></span><span><small>Carbs</small><strong>{profile.carbsTarget}g</strong></span><span><small>Fat</small><strong>{profile.fatTarget}g</strong></span></div><button type="button" onClick={() => setEditingTargets(true)}><Pencil size={15} />Edit targets</button></section>
        <ProfileLinkRow icon={<Ruler />} tone="blue" title="Body & activity" detail={`${profile.age} yrs · ${profile.heightCm} cm · ${profile.activity} activity`} onClick={() => setEditingBody(true)} />
        <ProfileSectionLabel>Elsewhere in the app</ProfileSectionLabel>
        <div className="profile-link-stack"><ProfileLinkRow icon={<BarChart3 />} tone="carbs" title="Weight history" detail="Weigh-ins and trend live in Insights" onClick={() => onNavigate({ tab: "insights", section: "weight" })} /><ProfileLinkRow icon={<Library />} tone="carbs" title="Your foods" detail="Everything you've saved or logged" onClick={() => onNavigate({ tab: "search" })} /><ProfileLinkRow icon={<MessageCircle />} tone="blue" title="Coach" detail="Chat about meals, recipes and your log" onClick={() => onNavigate({ tab: "coach", section: "chat" })} /></div>
        <ProfileSectionLabel>Account &amp; sync</ProfileSectionLabel>
        <section className="profile-account-card"><div><span className="profile-link-icon mint"><Cloud /></span><span><strong>{user ? "Synced to your account" : "Saved on this device"}</strong><small>{user ? syncState === "synced" ? "Up to date across devices" : "Syncing your latest changes" : "Sign in to sync across devices"}</small></span><button type="button" onClick={() => void onSignOut()}>{user ? "Sign out" : "Local"}</button></div><button type="button" className="profile-share-row" onClick={() => setSharingOpen(true)}><span className="profile-link-icon carbs"><Share2 /></span><span><strong>Share a read-only diary</strong><small>Invite someone you trust</small></span><ChevronRight size={16} /></button></section>
        <ProfileSectionLabel>Your data</ProfileSectionLabel>
        <section className="profile-data-card">
          <button type="button" onClick={onRestartOnboarding}><RefreshCw /><span><strong>Redo setup</strong><small>Walk through onboarding again</small></span><ChevronRight /></button>
          <button type="button" onClick={() => void downloadCsv()}><FileText /><span><strong>Meal report (CSV)</strong><small>Every logged meal as a spreadsheet</small></span><ChevronRight /></button>
          <button type="button" onClick={() => void download()}><Download /><span><strong>Export everything (JSON)</strong><small>Foods, recipes, diary and settings</small></span><ChevronRight /></button>
          <button type="button" onClick={() => importRef.current?.click()}><Upload /><span><strong>Restore from a backup</strong><small>Merge with what&apos;s on this device</small></span><ChevronRight /></button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={(event) => upload(event.target.files?.[0])} />
        </section>
        {backupNotice && <p className="backup-notice" role="status">{backupNotice}</p>}
      </div> : <div id="customize-panel" role="tabpanel" aria-labelledby="customize-tab" tabIndex={0}><ProfileCustomize profile={profile} onSave={onSave} theme={theme} onThemeChange={onThemeChange} chatTextSize={chatTextSize} onChatTextSizeChange={onChatTextSizeChange} /></div>}
      {editingTargets && <Sheet label="Daily targets" onClose={() => setEditingTargets(false)} showClose={false}><DailyTargetsSheet profile={profile} onSave={onSave} onClose={() => setEditingTargets(false)} /></Sheet>}
      {editingBody && <Sheet label="Body and activity" onClose={() => setEditingBody(false)} showClose={false}><BodyActivitySheet profile={profile} onSave={onSave} onClose={() => setEditingBody(false)} /></Sheet>}
      {sharingOpen && <Sheet label="Share a read-only diary" onClose={() => setSharingOpen(false)} wide><DiarySharing user={user} /></Sheet>}
    </main>
  );
}

export function OnboardingDialog({ profile, onSave, onCancel }: { profile: Profile; onSave: (profile: Profile) => void; onCancel?: () => void }) {
  const surfaceRef = useModalFocus();
  return (
    <div className="onboarding-overlay">
      <section ref={surfaceRef} className="onboarding-card" role="dialog" aria-modal="true" aria-label="Set up nutrition targets" tabIndex={-1}>
        {onCancel && <button className="onboarding-close icon-button ghost" type="button" aria-label="Cancel setup" onClick={onCancel}><X size={18} /></button>}
        <TargetEditor profile={profile} onSave={onSave} onboarding />
      </section>
    </div>
  );
}

export function WeightTrackingPrompt({ onEnable, onDisable, onDefer }: { onEnable: () => void; onDisable: () => void; onDefer: () => void }) {
  return (
    <Sheet label="Weight tracking" wide onClose={onDefer}>
      <div className="weight-prompt">
        <span className="action-icon mint"><BarChart3 /></span>
        <span className="eyebrow">Optional progress log</span>
        <h2>Want to track your weight?</h2>
        <p>Log daily kilograms and see weekly or monthly averages in Insights. Your entries stay private on this device unless you choose account sync.</p>
        <div className="weight-prompt-actions"><button className="primary-button" type="button" onClick={onEnable}>Yes, track my weight<ChevronRight size={17} /></button><button className="secondary-button" type="button" onClick={onDefer}>Not now</button><button className="text-button muted" type="button" onClick={onDisable}>No, don’t track my weight</button></div>
      </div>
    </Sheet>
  );
}

export function MeasurementPreferencePrompt({ profile, onSave }: { profile: Profile; onSave: (profile: Profile) => void }) {
  return (
    <Sheet label="Measurement preferences" wide showClose={false} onClose={() => undefined}>
      <div className="weight-prompt">
        <span className="action-icon blue"><Utensils /></span>
        <span className="eyebrow">One last preference</span>
        <h2>Which measurements feel natural?</h2>
        <p>Choose how Calorie Flow should show your height and body weight. Calculations stay accurate behind the scenes.</p>
        <div className="weight-prompt-actions">
          <button className="primary-button" type="button" onClick={() => onSave({ ...profile, measurementSystem: measurementSystems.metric })}>Metric (cm, kg)<ChevronRight size={17} /></button>
          <button className="secondary-button" type="button" onClick={() => onSave({ ...profile, measurementSystem: measurementSystems.imperial })}>US customary (in, lb)<ChevronRight size={17} /></button>
        </div>
      </div>
    </Sheet>
  );
}
