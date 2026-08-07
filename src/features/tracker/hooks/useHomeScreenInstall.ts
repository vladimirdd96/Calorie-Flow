"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSetting, setSetting } from "@/lib/db";

const HOME_SCREEN_PROMPT_SETTING = "homeScreenPromptCompleted";

type InstallPlatform = "ios" | "android";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isStandaloneDisplay = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIosDevice = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
const isAndroidDevice = () => /Android/i.test(navigator.userAgent);

/** Owns the browser-specific path for installing the diary as a Home Screen app. */
export function useHomeScreenInstall(ready: boolean) {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | undefined>(undefined);
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);

  const showIfNeeded = useCallback((nextPlatform: InstallPlatform) => {
    void getSetting<boolean>(HOME_SCREEN_PROMPT_SETTING).then((completed) => {
      if (!completed && !isStandaloneDisplay()) setPlatform(nextPlatform);
    }).catch(() => {
      if (!isStandaloneDisplay()) setPlatform(nextPlatform);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (isStandaloneDisplay()) {
      void setSetting(HOME_SCREEN_PROMPT_SETTING, true);
      return;
    }
    if (isIosDevice()) showIfNeeded("ios");
    if (isAndroidDevice() && deferredPrompt.current) showIfNeeded("android");
  }, [ready, showIfNeeded]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      if (ready && isAndroidDevice()) showIfNeeded("android");
    };
    const onInstalled = () => {
      deferredPrompt.current = undefined;
      setPlatform(null);
      void setSetting(HOME_SCREEN_PROMPT_SETTING, true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [ready, showIfNeeded]);

  const dismiss = useCallback(() => {
    setPlatform(null);
    void setSetting(HOME_SCREEN_PROMPT_SETTING, true);
  }, []);

  const install = useCallback(async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt.current = undefined;
      dismiss();
    }
  }, [dismiss]);

  return { platform, dismiss, install };
}
