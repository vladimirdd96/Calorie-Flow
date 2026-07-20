"use client";

import { useCallback, useEffect, useState } from "react";
import { cloudSyncConfigured, getSupabase, type CloudUser, type SocialAuthProvider } from "@/lib/supabase";

export function useAuth() {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [ready, setReady] = useState(!cloudSyncConfigured);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setUser(data.session?.user || null);
        setReady(true);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user || null);
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
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
  }, []);

  const signInWithProvider = useCallback(async (provider: SocialAuthProvider) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cloud sync is not configured yet.");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return { configured: cloudSyncConfigured, ready, user, sendMagicLink, signInWithProvider, signOut };
}
