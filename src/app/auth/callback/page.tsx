"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export default function AuthCallback() {
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const complete = async () => {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("error_description") || params.get("error");
      const code = params.get("code");
      const supabase = getSupabase();

      if (authError) {
        window.history.replaceState({}, "", "/");
        if (active) setError(authError.replace(/\+/g, " "));
        return;
      }
      if (!supabase || !code) {
        window.location.replace("/");
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        window.history.replaceState({}, "", "/");
        if (active) setError("This sign-in link has expired or has already been used. Please try again.");
        return;
      }
      window.history.replaceState({}, "", "/");
      window.location.replace("/");
    };

    void complete();
    return () => { active = false; };
  }, []);

  return (
    <main className="app-loading" role="status" aria-live="polite">
      <span className="brand-mark large" aria-hidden="true">C</span>
      <p>{error || "Completing secure sign-in…"}</p>
      {error && <Link className="text-button" href="/">Back to Calorie Flow</Link>}
    </main>
  );
}
