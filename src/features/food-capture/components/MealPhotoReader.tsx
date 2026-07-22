"use client";

import { ArrowLeft, Camera, Info, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { mealPhotoAnalysisSchema } from "@/lib/schemas";
import { getSupabase } from "@/lib/supabase";
import type { MealPhotoAnalysis } from "@/lib/types";
import { imageToDataUrl } from "./captureMedia";

export function MealPhotoReader({ onMeal, onClose }: { onMeal: (analysis: MealPhotoAnalysis) => void; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const analyze = async (file?: File) => {
    if (!file) return;
    setError(""); setLoading(true);
    try {
      const image = await imageToDataUrl(file); setPreview(image);
      const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
      const response = await fetch("/api/analyze-meal-photo", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ image }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The meal photo could not be understood.");
      onMeal(mealPhotoAnalysisSchema.parse(body));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The meal photo could not be understood."); }
    finally { setLoading(false); }
  };
  useEffect(() => { inputRef.current?.click(); }, []);
  return <div className="meal-photo-reader">
    <div className="sheet-header"><button className="icon-button ghost" onClick={onClose} aria-label="Back to Coach"><ArrowLeft /></button><div><span className="eyebrow">AI assist</span><h2>Understand a meal photo</h2></div><span /></div>
    <div className={`label-dropzone ${preview ? "has-preview" : ""}`}>{preview ? <img className="meal-photo-preview" src={preview} alt="Photo selected for meal analysis" /> : <><span className="action-icon mint"><Camera /></span><strong>Choose any food photo</strong><small>Meal screenshots, plated food, menus, or recipes all work</small></>}{loading && <span className="analyzing"><i /><strong>Understanding the meal…</strong></span>}</div>
    <input ref={inputRef} className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => void analyze(event.target.files?.[0])} />
    <button className="secondary-button full" type="button" onClick={() => inputRef.current?.click()} disabled={loading}><Upload size={18} />Choose a different photo</button>
    {error && <div className="inline-alert error" role="alert"><Info size={17} /><span>{error}</span></div>}
    <p className="photo-disclaimer">The result is an estimate. You’ll review the meal, amount, and meal type before it is saved.</p>
  </div>;
}
