"use client";
/* eslint-disable @next/next/no-img-element -- the captured meal photo is a local data URL. */

import { ArrowLeft, Camera, Images, Info, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { mealPhotoAnalysisSchema } from "@/lib/schemas";
import { getSupabase } from "@/lib/supabase";
import type { Meal, MealPhotoAnalysis, MealTimeBoundaries, MealType } from "@/lib/types";
import { imageToDataUrl, requestContinuousFocus } from "./captureMedia";
import { MealPhotoReview } from "./MealPhotoReview";

type Phase =
  | { step: "capture" }
  | { step: "analyzing"; image: string; hint: string }
  | { step: "review"; image: string; analysis: MealPhotoAnalysis }
  | { step: "failed"; image: string; hint: string; error: string };

const analyzingMessages = ["Looking at the plate…", "Separating the foods…", "Estimating portions…", "Adding up the macros…"];

function cameraError(caught: unknown) {
  const name = caught instanceof DOMException ? caught.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access is off for this site. Allow Camera in your browser settings, or choose a photo from your library instead.";
  if (name === "NotFoundError") return "No usable camera was found. Choose a photo from your library instead.";
  if (name === "NotReadableError") return "Your camera is busy in another app. Close that app, or choose a photo from your library.";
  return "The camera could not start. Choose a photo from your library instead.";
}

export function MealPhotoReader({ initialMealType, initialLoggedDate, hideCalories, mealTimeBoundaries, onLogMeal, onClose }: {
  initialMealType?: MealType;
  initialLoggedDate: string;
  hideCalories: boolean;
  mealTimeBoundaries?: MealTimeBoundaries;
  onLogMeal: (meal: Meal) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ step: "capture" });
  const [cameraLive, setCameraLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    setCameraLive(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setStarting(false); setError("This browser cannot open the camera. Choose a photo from your library instead."); return; }
    setStarting(true); setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        requestContinuousFocus(stream);
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraLive(true);
    } catch (caught) {
      setError(cameraError(caught));
    } finally { setStarting(false); }
  }, []);

  // The camera opens on a tap rather than on mount: mobile browsers gate getUserMedia
  // behind a user gesture, and the permission prompt is far less alarming when the user
  // just asked for it. The stream is released whenever this sheet goes away.
  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (phase.step !== "analyzing") return;
    const timer = window.setInterval(() => setTick((current) => current + 1), 2200);
    return () => window.clearInterval(timer);
  }, [phase.step]);

  const analyze = useCallback(async (image: string, hint: string) => {
    stopCamera();
    setPhase({ step: "analyzing", image, hint });
    setTick(0);
    try {
      const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
      const response = await fetch("/api/analyze-meal-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ image, ...(hint ? { hint } : {}) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The meal photo could not be understood.");
      setPhase({ step: "review", image, analysis: mealPhotoAnalysisSchema.parse(body) });
    } catch (caught) {
      setPhase({ step: "failed", image, hint, error: caught instanceof Error ? caught.message : "The meal photo could not be understood." });
    }
  }, [stopCamera]);

  const shoot = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    await analyze(canvas.toDataURL("image/jpeg", 0.9), "");
  };

  const chooseFile = async (file?: File) => {
    if (!file) return;
    try { await analyze(await imageToDataUrl(file), ""); }
    catch { setError("That photo could not be read. Try another one."); }
  };

  if (phase.step === "review") return <MealPhotoReview
    analysis={phase.analysis}
    image={phase.image}
    hideCalories={hideCalories}
    initialMealType={initialMealType}
    initialLoggedDate={initialLoggedDate}
    mealTimeBoundaries={mealTimeBoundaries}
    onRetake={() => setPhase({ step: "capture" })}
    onReanalyze={(hint) => void analyze(phase.image, hint)}
    onLogMeal={onLogMeal}
    onClose={onClose}
  />;

  return <div className="meal-photo-reader">
    <div className="sheet-header">
      <button type="button" className="icon-button ghost" onClick={onClose} aria-label="Back to add food options"><ArrowLeft /></button>
      <div><span className="eyebrow">Meal photo</span><h2>Snap what you are eating</h2></div>
      <span />
    </div>

    {phase.step === "capture" ? <>
      <div className={`meal-photo-stage ${cameraLive ? "live" : ""}`}>
        <video ref={videoRef} playsInline muted autoPlay aria-label="Camera preview of your meal" />
        {!cameraLive && <button type="button" className="meal-photo-stage-fallback" onClick={() => void startCamera()} disabled={starting}>
          <span className="action-icon mint"><Camera /></span>
          <strong>{starting ? "Opening camera…" : "Open the camera"}</strong>
          <small>{starting ? "Point it at the whole plate" : "Or pick a photo you already took"}</small>
        </button>}
        {cameraLive && <p className="meal-photo-guide">Fit the whole plate in frame — cutlery or a hand nearby sharpens the portion estimate.</p>}
      </div>
      <div className="meal-photo-capture-actions">
        <button type="button" className="meal-photo-library" onClick={() => fileInputRef.current?.click()}><Images size={18} /><span>Library</span></button>
        <button type="button" className="meal-photo-shutter" onClick={() => void shoot()} disabled={!cameraLive} aria-label="Take a photo of this meal"><i /></button>
        {/* The stage itself is the "open camera" target, so this slot only earns its place
            once a start has actually failed and the user needs a second attempt. */}
        {error && !cameraLive ? <button type="button" className="meal-photo-library" onClick={() => void startCamera()} disabled={starting}><RefreshCw size={18} /><span>Retry</span></button> : <span />}
      </div>
    </> : <div className={`meal-photo-stage analyzing ${phase.step === "failed" ? "has-error" : ""}`}>
      <img src={phase.image} alt="The meal photo being estimated" />
      {phase.step === "analyzing" && <span className="analyzing"><i /><strong>{analyzingMessages[tick % analyzingMessages.length]}</strong></span>}
    </div>}

    {phase.step === "failed" && <>
      <div className="inline-alert error" role="alert"><Info size={17} /><span>{phase.error}</span></div>
      <div className="meal-photo-retry-actions">
        <button type="button" className="primary-button full" onClick={() => void analyze(phase.image, phase.hint)}><Sparkles size={17} />Try this photo again</button>
        <button type="button" className="secondary-button full" onClick={() => setPhase({ step: "capture" })}><Camera size={17} />Take another photo</button>
      </div>
    </>}

    <input ref={fileInputRef} className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }} />
    {error && phase.step === "capture" && <div className="inline-alert" role="alert"><Info size={17} /><span>{error}</span></div>}
    <p className="photo-disclaimer">Photo estimates are approximate. You review every food, portion, and meal before anything is saved, and the photo stays on your device.</p>
  </div>;
}
