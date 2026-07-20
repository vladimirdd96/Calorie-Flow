"use client";

import { useCallback, useEffect, useState } from "react";
import { cloudSyncConfigured, getAuthCallbackUrl, getSupabase, type CloudUser, type SocialAuthProvider } from "@/lib/supabase";

export function useAuth() {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [ready, setReady] = useState(!cloudSyncConfigured);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;

    const loadSession = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          try {
            await supabase.auth.exchangeCodeForSession(code);
          } catch {
            // The code may be stale or already consumed; either way, do not strand it in the URL.
          } finally {
            window.history.replaceState({}, "", "/");
          }
        } else if (params.has("error") || params.has("error_description")) {
          window.history.replaceState({}, "", "/");
        }
        const { data } = await supabase.auth.getSession();
        if (active) setUser(data.session?.user || null);
      } finally {
        if (active) setReady(true);
      }
    };
    void loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) {
        setUser(session?.user || null);
        setPasswordRecovery(event === "PASSWORD_RECOVERY");
        setReady(true);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud sync is not configured yet.");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud sync is not configured yet.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud sync is not configured yet.");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthCallbackUrl() },
    });
    if (error) throw error;
    return { needsEmailConfirmation: !data.session };
  }, []);

  const signInWithProvider = useCallback(async (provider: SocialAuthProvider) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud sync is not configured yet.");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: getAuthCallbackUrl() },
    });
    if (error) throw error;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud sync is not configured yet.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getAuthCallbackUrl() });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud sync is not configured yet.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setPasswordRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return { configured: cloudSyncConfigured, ready, user, passwordRecovery, sendMagicLink, signInWithPassword, signUp, signInWithProvider, requestPasswordReset, updatePassword, signOut };
}
