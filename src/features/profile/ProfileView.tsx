"use client";

import { BarChart3, Check, ChevronDown, ChevronRight, Download, Cloud, LogOut, Pencil, RotateCcw, Share2, ShieldCheck, Moon, Sun, Upload, Utensils, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import { Sheet } from "@/features/shared/Sheet";
import type { AppTab } from "@/features/navigation/types";
import { validateBackup } from "@/lib/db";
import { acceptCloudDiaryShare, getCloudDiaryShares, getSharedDiarySnapshot, inviteCloudDiaryShare, revokeCloudDiaryShare } from "@/lib/cloud";
import { calculateCalories, calculateMacroTargets, localDateKey, round } from "@/lib/nutrition";
import { isHabitFeatureEnabled, toggleHabitFeature } from "@/lib/habit-settings";
import { mealsCsv } from "@/lib/reports";
import { type CloudUser } from "@/lib/supabase";
import type { ActivityLevel, DietPreset, DiaryShare, GoalMode, Meal, MealType, Nutrition, Profile, Sex, HabitFeature, WeightTrackingStatus, Weekday } from "@/lib/types";
import { habitFeatures, measurementSystems, weightTrackingStatuses } from "@/lib/types";
import type { BackupData } from "@/lib/db";

type ProfileSection = "profile" | "customize";

type SyncState = "local" | "syncing" | "synced" | "offline" | "error";

const themeModes = { light: "light", dark: "dark" } as const;

type ThemeMode = typeof themeModes[keyof typeof themeModes];

const chatTextSizes = { compact: "compact", comfortable: "comfortable", large: "large" } as const;

type ChatTextSize = typeof chatTextSizes[keyof typeof chatTextSizes];

function BrandMark({ large = false }: { large?: boolean }) {
  return <img className={`brand-mark${large ? " large" : ""}`} src="/icon.svg" alt="" aria-hidden="true" />;
}

const kgToLb = (kg: number) => kg * 2.2046226218;

const lbToKg = (lb: number) => lb / 2.2046226218;

const cmToIn = (cm: number) => cm / 2.54;

const inToCm = (inches: number) => inches * 2.54;

const measurementSystemFor = (profile: Profile) => profile.measurementSystem || measurementSystems.metric;

const weightUnitFor = (profile: Profile) => measurementSystemFor(profile) === measurementSystems.imperial ? "lb" : "kg";

function providerAvatarUrl(user: CloudUser | null) {
  const candidate = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
}

function accountDisplayName(user: CloudUser | null) {
  const candidates = [user?.user_metadata?.full_name, user?.user_metadata?.name];
  return candidates.find((candidate): candidate is string => typeof candidate === "string" && Boolean(candidate.trim()))?.trim();
}

function resizeAvatar(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("The image could not be opened."));
      image.onload = () => {
        const size = 256;
        const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("The image could not be prepared."));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", .82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const dietMeta: Record<DietPreset, { label: string; description: string }> = {
  balanced: { label: "Balanced", description: "Flexible everyday split" },
  "high-protein": { label: "High protein", description: "More protein, flexible carbs" },
  keto: { label: "Keto", description: "25 g carbs, higher fat" },
  "high-protein-keto": { label: "Protein keto", description: "30 g carbs, more protein" },
  "low-fat": { label: "Low fat", description: "20% calories from fat" },
  custom: { label: "Custom", description: "Set your own daily split" },
};

type Tab = AppTab;


import { TargetEditor, TargetSummary } from "./components/ProfileTargets";
import { useDismissibleDisclosure, useModalFocus } from "./hooks/useDisclosure";

import { AppearancePreferences, CarbDisplayPreference, DailyTargetPreferences, DisplayPreferences, FeatureVisibilityPreferences, MealTargetPreferences, MeasurementPreferences, WeightTrackingPreference } from "./components/ProfilePreferences";
function ProfileIdentity({ profile, user, onSave }: { profile: Profile; user: CloudUser | null; onSave: (profile: Profile) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name || accountDisplayName(user) || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [notice, setNotice] = useState("");
  const fallbackAvatar = providerAvatarUrl(user);
  const visibleAvatar = avatarUrl || fallbackAvatar;
  const initials = (name.trim() || user?.email?.split("@")[0] || "You").slice(0, 1).toUpperCase();

  const save = () => {
    onSave({ ...profile, name: name.trim(), avatarUrl });
    setEditing(false);
    setNotice("Profile saved");
  };
  const cancel = () => {
    setName(profile.name || accountDisplayName(user) || "");
    setAvatarUrl(profile.avatarUrl);
    setEditing(false);
    setNotice("");
  };
  const edit = () => {
    setNotice("");
    setEditing(true);
  };
  const chooseAvatar = async (file?: File) => {
    if (!file) return;
    try {
      const nextAvatar = await resizeAvatar(file);
      setAvatarUrl(nextAvatar);
      setNotice("");
    } catch {
      setNotice("That image could not be used. Try another photo.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const removeCustomAvatar = () => {
    setAvatarUrl(undefined);
    setNotice("");
  };

  return (
    <section className="profile-identity" aria-labelledby="profile-identity-heading">
      <div className="section-heading">
        <div><span className="eyebrow">About you</span><h2 id="profile-identity-heading">Profile</h2></div>
        {!editing && <button className="icon-button ghost profile-edit-button" type="button" onClick={edit} aria-label="Edit profile"><Pencil size={17} /></button>}
      </div>
      {editing ? <>
        <div className="profile-identity-editor">
          <button className="avatar-picker" type="button" onClick={() => fileRef.current?.click()} aria-label="Choose a profile photo">
            {visibleAvatar ? <img src={visibleAvatar} alt="" /> : <span>{initials}</span>}
            <i><Upload size={14} /></i>
          </button>
          <div className="profile-identity-fields">
            <label><span>Display name</span><input autoFocus value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
            <small>{user ? "Your account photo is used by default. Upload a different one whenever you like." : "Add a name and photo so this diary feels like yours."}</small>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void chooseAvatar(event.target.files?.[0])} />
        <div className="profile-identity-actions">
          <button className="secondary-button" type="button" onClick={cancel}>Cancel</button>
          <button className="primary-button" type="button" onClick={save}>Save profile</button>
          {avatarUrl && <button className="text-button muted" type="button" onClick={removeCustomAvatar}>Use default photo</button>}
        </div>
      </> : <div className="profile-identity-summary">
        <div className="profile-avatar" aria-hidden="true">{visibleAvatar ? <img src={visibleAvatar} alt="" /> : <span>{initials}</span>}</div>
        <div><span className="profile-identity-label">Display name</span><strong>{name || "Add your name"}</strong><small>{user ? "Your account photo is used by default." : "Add a name and photo so this diary feels like yours."}</small></div>
      </div>}
      {notice && <p className="account-notice" role="status">{notice}</p>}
    </section>
  );
}

function AccountCard({
  user,
  syncState,
  onSignOut,
}: {
  user: CloudUser | null;
  syncState: SyncState;
  onSignOut: () => Promise<void>;
}) {
  const statusText: Record<SyncState, string> = {
    local: "Saved on this device",
    syncing: "Syncing changes…",
    synced: "Up to date across devices",
    offline: "Saved offline · will retry",
    error: "Sync needs attention",
  };
  return (
    <section className="account-section">
      <div className="section-heading"><div><span className="eyebrow">Private account</span><h2>Account & sync</h2></div></div>
      <div className="account-card card">
        {user ? (
          <>
            <div className="account-user"><span><Cloud size={20} /></span><div><strong>{user.email || "Signed-in account"}</strong><small>{statusText[syncState]}</small></div></div>
            <button className="secondary-button" onClick={onSignOut}><LogOut size={17} />Sign out</button>
          </>
        ) : <div className="account-message"><Cloud /><div><strong>Account required</strong><p>Sign in to keep your diary private and available across devices.</p></div></div>}
      </div>
    </section>
  );
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
        <label><span>Invite by email</span><input type="email" autoComplete="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="friend@example.com" required /></label>
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
  weightTracking,
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
  weightTracking?: WeightTrackingStatus;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const [editingTargets, setEditingTargets] = useState(false);
  const [profileSection, setProfileSection] = useState<ProfileSection>("profile");
  const targetDisclosureRef = useDismissibleDisclosure<HTMLDivElement>(editingTargets, () => setEditingTargets(false));
  const [dataToolsOpen, setDataToolsOpen] = useState(false);
  const dataToolsRef = useDismissibleDisclosure<HTMLDetailsElement>(dataToolsOpen, () => setDataToolsOpen(false));
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [backupNotice, setBackupNotice] = useState("");
  const [exporting, setExporting] = useState(false);
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
      if (restoreMode === "replace" && !window.confirm("Replace your current diary, foods, and targets with this backup? This cannot be undone.")) return;
      await onImport(data, restoreMode);
      setBackupNotice(restoreMode === "replace" ? "Backup replaced your current data." : "Backup merged with your current data.");
    } catch {
      setBackupNotice("That file isn’t a valid Calorie Flow backup.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };
  return (
    <main className="page">
      <header className="page-header"><span className="eyebrow">Your account</span><h1>{profileSection === "profile" ? "Your profile" : "Make it yours"}</h1><p>{profileSection === "profile" ? "Keep your identity, targets, and private data in one place." : "Tune the parts of Calorie Flow that should work your way."}</p></header>
      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        <button id="profile-tab" type="button" role="tab" aria-selected={profileSection === "profile"} aria-controls="profile-panel" className={profileSection === "profile" ? "active" : ""} onClick={() => setProfileSection("profile")}>Profile</button>
        <button id="customize-tab" type="button" role="tab" aria-selected={profileSection === "customize"} aria-controls="customize-panel" className={profileSection === "customize" ? "active" : ""} onClick={() => setProfileSection("customize")}>Customize</button>
      </div>
      {profileSection === "profile" ? <div id="profile-panel" role="tabpanel" aria-labelledby="profile-tab" tabIndex={0}>
        <ProfileIdentity key={`${profile.name}:${profile.avatarUrl || ""}`} profile={profile} user={user} onSave={onSave} />
        <div ref={targetDisclosureRef}>
          <TargetSummary profile={profile} expanded={editingTargets} onEdit={() => setEditingTargets((open) => !open)} />
          {editingTargets && <div id="target-editor"><TargetEditor profile={profile} onSave={(next) => { onSave(next); setEditingTargets(false); }} onCancel={() => setEditingTargets(false)} /></div>}
        </div>
        <section className="onboarding-restart" aria-labelledby="onboarding-restart-heading">
          <div><span className="eyebrow">Want a fresh start?</span><h2 id="onboarding-restart-heading">Run setup again</h2><p>Revisit your goals, activity, and nutrition style. Your diary stays safely in place.</p></div>
          <button className="secondary-button" type="button" onClick={onRestartOnboarding}><RotateCcw size={16} />Run setup again</button>
        </section>
        <AccountCard user={user} syncState={syncState} onSignOut={onSignOut} />
        <DiarySharing user={user} />
      </div> : <div id="customize-panel" role="tabpanel" aria-labelledby="customize-tab" tabIndex={0}>
        <section className="customize-intro" aria-labelledby="customize-heading"><div><span className="eyebrow">Your preferences</span><h2 id="customize-heading">A calmer tracker, your way</h2><p>These choices only change how Calorie Flow feels and what it shows. Your diary stays private on this device.</p></div></section>
        <MeasurementPreferences profile={profile} onChange={(measurementSystem) => onSave({ ...profile, measurementSystem })} />
        <DisplayPreferences hideCalories={profile.hideCalories} onChange={(hideCalories) => onSave({ ...profile, hideCalories })} chatTextSize={chatTextSize} onChatTextSizeChange={onChatTextSizeChange} />
        <FeatureVisibilityPreferences profile={profile} onSave={onSave} />
        <CarbDisplayPreference profile={profile} onSave={onSave} />
        <DailyTargetPreferences profile={profile} onSave={onSave} />
        <MealTargetPreferences profile={profile} onSave={onSave} />
        <WeightTrackingPreference status={weightTracking} onChange={(next) => onSave({ ...profile, weightTracking: next })} />
        <AppearancePreferences theme={theme} onChange={onThemeChange} />
      </div>}
      <details ref={dataToolsRef} className="data-tools" open={dataToolsOpen} onToggle={(event) => setDataToolsOpen(event.currentTarget.open)}>
        <summary>
          <ShieldCheck size={17} aria-hidden="true" />
          <span className="data-tools-copy"><strong>Data & privacy</strong><small>Export or restore your information</small></span>
          <ChevronDown className="data-tools-chevron" size={17} aria-hidden="true" />
        </summary>
        <div className="card tool-list">
          <button onClick={download} disabled={exporting}><Download size={19} /><span><strong>{exporting ? "Preparing archive…" : "Export your data"}</strong><small>Diary, foods, targets, and coach history</small></span><ChevronRight size={17} /></button>
          <button onClick={downloadCsv} disabled={exporting}><Download size={19} /><span><strong>{exporting ? "Preparing report…" : "Download meal report"}</strong><small>Meal-level CSV for spreadsheets or printing</small></span><ChevronRight size={17} /></button>
          <div className="restore-tools">
            <div className="restore-mode" role="radiogroup" aria-label="Restore mode">
              <label><input type="radio" name="restore-mode" checked={restoreMode === "merge"} onChange={() => setRestoreMode("merge")} />Merge with current data</label>
              <label><input type="radio" name="restore-mode" checked={restoreMode === "replace"} onChange={() => setRestoreMode("replace")} />Replace current data</label>
            </div>
            <button onClick={() => importRef.current?.click()}><Upload size={19} /><span><strong>Restore a backup</strong><small>Import a Calorie Flow JSON archive</small></span><ChevronRight size={17} /></button>
          </div>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={(event) => upload(event.target.files?.[0])} />
        </div>
        {backupNotice && <p className="backup-notice" role="status">{backupNotice}</p>}
      </details>
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
