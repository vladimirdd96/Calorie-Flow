"use client";

import { AlertCircle, ChevronRight, Eye, EyeOff, LockKeyhole, MailCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { SocialAuthProvider } from "@/lib/supabase";

type AuthMode = "sign-in" | "register" | "forgot-password" | "update-password";

function GoogleIcon() {
  return <svg className="provider-mark google" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.92a5.05 5.05 0 0 1-2.18 3.31v2.78h3.57c2.08-1.92 3.28-4.74 3.28-8.12Z" /><path fill="#34A853" d="M12 21.72c2.64 0 4.85-.87 6.47-2.36l-3.57-2.78c-.99.66-2.26 1.06-3.65 1.06-2.81 0-5.19-1.9-6.04-4.45H4.53v2.87A9.77 9.77 0 0 0 12 21.72Z" /><path fill="#FBBC05" d="M5.96 13.22A5.87 5.87 0 0 1 5.63 12c0-.42.07-.82.2-1.21V7.92H2.15A9.77 9.77 0 0 0 2.15 16l3.81-2.78Z" /><path fill="#EA4335" d="M12 6.33c1.52 0 2.89.52 3.97 1.55l2.98-2.98C16.84 2.93 14.64 2 12 2a9.77 9.77 0 0 0-7.47 3.64l3.3 2.57c.85-2.01 3.23-3.45 6.04-3.45Z" /></svg>;
}

export function AuthGateway({ configured, onSignIn, onSignUp, onSignInWithProvider, onRequestPasswordReset, onUpdatePassword, passwordRecovery }: { configured: boolean; onSignIn: (email: string, password: string) => Promise<void>; onSignUp: (email: string, password: string, name: string) => Promise<{ needsEmailConfirmation: boolean }>; onSignInWithProvider: (provider: SocialAuthProvider) => Promise<void>; onRequestPasswordReset: (email: string) => Promise<void>; onUpdatePassword: (password: string) => Promise<void>; passwordRecovery: boolean }) {
  const [mode, setMode] = useState<AuthMode>(passwordRecovery ? "update-password" : "sign-in");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const isRegistering = mode === "register";
  const isPasswordReset = mode === "forgot-password" || mode === "update-password";
  const isUpdatingPassword = mode === "update-password";

  const selectMode = (nextMode: "sign-in" | "register") => {
    setMode(nextMode);
    setNotice("");
    setConfirmationEmail("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!configured) return;
    if (isRegistering && !name.trim()) return setNotice("Enter your name.");
    if (mode !== "forgot-password" && password.length < 8) return setNotice("Password must be at least 8 characters.");
    if ((isRegistering || isUpdatingPassword) && password !== confirmPassword) return setNotice("Passwords don't match.");
    setBusy(true);
    setNotice("");
    try {
      if (mode === "forgot-password") {
        await onRequestPasswordReset(email.trim());
        setConfirmationEmail(email.trim());
      } else if (isUpdatingPassword) {
        await onUpdatePassword(password);
        setNotice("Your password is updated. You can continue to your diary.");
      } else if (isRegistering) {
        const { needsEmailConfirmation } = await onSignUp(email.trim(), password, name.trim());
        if (needsEmailConfirmation) setConfirmationEmail(email.trim());
      } else {
        await onSignIn(email.trim(), password);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "We couldn't complete that request.");
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setNotice("");
    try {
      await onSignInWithProvider("google");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Google sign-in could not start.");
      setBusy(false);
    }
  };

  const headline = mode === "forgot-password" ? "Reset password" : isUpdatingPassword ? "Choose a new password" : isRegistering ? "Create your account" : "Welcome back";
  const subhead = mode === "forgot-password" ? "We'll email you a link." : isUpdatingPassword ? "Secure your diary with a new password." : isRegistering ? "Track meals, macros and progress in one place." : "Log in to keep your streak going.";

  return (
    <main className="auth-page">
      <section className="auth-shell" aria-labelledby="auth-title">
        <header className="auth-heading">
          <span className="auth-mark" aria-hidden="true">CF</span>
          <h1 id="auth-title">{headline}</h1>
          <p>{subhead}</p>
        </header>

        {!isUpdatingPassword && <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === "sign-in"} className={mode === "sign-in" ? "active" : ""} onClick={() => selectMode("sign-in")}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => selectMode("register")}>Sign up</button>
        </div>}

        <div className="auth-card">
          {!configured ? <p className="auth-unavailable"><LockKeyhole size={16} />Account sign-in is unavailable until this deployment is connected to Supabase.</p> : confirmationEmail ? <div className="auth-confirmation"><span><MailCheck /></span><strong>Check your inbox</strong><p>{mode === "forgot-password" ? "We sent a password reset link" : "We sent a confirmation link"} to {confirmationEmail}. {mode === "register" && "Verify to finish creating your account."}</p></div> : <>
            {notice && <p className="auth-alert" role="alert"><AlertCircle size={15} /><span>{notice}</span></p>}
            {mode === "forgot-password" && <p className="auth-reset-copy">Enter your email and we&apos;ll send a reset link.</p>}
            <form className="auth-form" onSubmit={submit}>
              {isRegistering && <label><span>Name</span><input type="text" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Jamie Ortiz" /></label>}
              {!isUpdatingPassword && <label><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>}
              {mode !== "forgot-password" && <label><span>{isUpdatingPassword ? "New password" : "Password"}</span><span className="auth-password"><input type={passwordVisible ? "text" : "password"} autoComplete={isRegistering || isUpdatingPassword ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegistering ? "At least 8 characters" : "Your password"} /><button type="button" aria-label="Toggle password visibility" onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}</button></span></label>}
              {isRegistering && <p className="auth-password-hint">Use at least 8 characters.</p>}
              {(isRegistering || isUpdatingPassword) && <label><span>Confirm password</span><input type={passwordVisible ? "text" : "password"} autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password" /></label>}
              {mode === "sign-in" && <button className="auth-forgot" type="button" onClick={() => { setMode("forgot-password"); setNotice(""); }}>Forgot password?</button>}
              <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : isRegistering ? "Create account" : isUpdatingPassword ? "Save new password" : mode === "forgot-password" ? "Send reset link" : "Sign in"}<ChevronRight size={16} /></button>
            </form>
            {!isPasswordReset && <><div className="account-divider"><span>or continue with</span></div><button className="auth-google" type="button" disabled={busy} onClick={signInWithGoogle}><GoogleIcon />Continue with Google</button></>}
            {isPasswordReset && <button className="auth-back" type="button" onClick={() => { setMode("sign-in"); setNotice(""); }}>Back to sign in</button>}
          </>}
        </div>

        {!isPasswordReset && !confirmationEmail && <p className="auth-switch">{isRegistering ? "Already have an account?" : "New here?"} <button type="button" onClick={() => selectMode(isRegistering ? "sign-in" : "register")}>{isRegistering ? "Sign in" : "Create one"}</button></p>}
        <p className="auth-legal">By continuing you agree to Calorie Flow&apos;s Terms and Privacy Policy.</p>
      </section>
    </main>
  );
}
