"use client";

import { ArrowLeft, Camera, Copy, ChevronRight, Database, Info, Mic, Package, Pencil, Plus, ScanLine, Search, Send, ShieldCheck, Sparkles, Upload, WifiOff } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ThemedSelect } from "@/features/shared/ThemedSelect";
import type { AddFoodView } from "@/features/app/types";
import { contextualUnits, formatUnit, gramsFor, localDateKey, round, scaleNutrition, suggestedMealType } from "@/lib/nutrition";
import { findByBarcode, searchOpenFoodFacts } from "@/lib/openfoodfacts";
import { normalizeVoiceFoodQuery } from "@/lib/voice";
import { recentLogDates } from "@/lib/logging";
import { labelAnalysisSchema, mealPhotoAnalysisSchema } from "@/lib/schemas";
import { getSupabase } from "@/lib/supabase";
import type { CoachMealAction, CoachMealChoice, CoachMessage, Food, Meal, MealPhotoAnalysis, MealType, Nutrition, ServingUnit } from "@/lib/types";

type AddView = AddFoodView;

export function hideCalorieValues(content: string) {
  return content.replace(/\b\d[\d,.]*\s*(?:-|–|—)?\s*(?:kcal|calories?)\b/gi, "energy hidden");
}

const mealLabels: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const unitLabels: Record<ServingUnit, string> = {
  serving: "Serving",
  g: "Grams",
  "100g": "100 g",
  package: "Package",
  piece: "Piece",
  tbsp: "Tbsp",
  tsp: "Tsp",
  ml: "ml",
};

function FoodRow({ food, onSelect, hideCalories = false }: { food: Food; onSelect: () => void; hideCalories?: boolean }) {
  const detail = food.brand || (food.source === "custom" ? "Your custom food" : food.source === "seed" ? food.servingLabel || "Reference food" : food.source === "food-data-central" ? "USDA FoodData Central" : food.source === "restaurant" ? "Restaurant menu" : "Saved food");
  return (
    <button className="food-row" onClick={onSelect}>
      <FoodAvatar food={food} />
      <span className="food-copy"><strong>{food.name}</strong><small>{detail}</small></span>
      {!hideCalories && <span className="food-calories"><strong>{Math.round(food.nutrientsPer100.calories)}</strong><small>kcal / 100 g</small></span>}
      <ChevronRight size={18} />
    </button>
  );
}


type WeightPeriod = "week" | "month" | "all";
type InsightsSection = "overview" | "nutrition" | "weight";


function BarcodeScanner({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | undefined>(undefined);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [cameraLive, setCameraLive] = useState(false);

  const cameraError = (caught: unknown) => {
    const name = caught instanceof DOMException ? caught.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") return "Camera access is off for this site. Allow Camera in your iPhone’s Safari or Home Screen app settings, then try again.";
    if (name === "NotFoundError") return "No usable camera was found on this device.";
    if (name === "NotReadableError") return "Your camera is busy in another app. Close that app and try again.";
    return "The camera could not start. You can enter the barcode manually below.";
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support camera scanning. Enter the barcode below.");
      return;
    }
    setStarting(true); setError("");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      }, videoRef.current!, (result) => {
        if (result) {
          controlsRef.current?.stop();
          onResult(result.getText());
        }
      });
      controlsRef.current = controls;
      requestContinuousFocus(videoRef.current?.srcObject);
      setCameraLive(true);
    } catch (caught) {
      setError(cameraError(caught));
    } finally { setStarting(false); }
  };

  useEffect(() => {
    return () => controlsRef.current?.stop();
  }, []);

  return (
    <div className="scanner-view">
      <div className="sheet-header"><button className="icon-button ghost" onClick={onClose} aria-label="Back to add food options"><ArrowLeft /></button><div><span className="eyebrow">Package lookup</span><h2>Scan barcode</h2></div><span /></div>
      <div className={`camera-frame ${cameraLive ? "live" : ""}`}>
        <video ref={videoRef} muted playsInline autoPlay />
        {cameraLive ? <><div className="scan-line" /><div className="scan-corners" /></> : <button className="camera-start" onClick={startCamera} disabled={starting}><Camera size={22} /><strong>{starting ? "Opening camera…" : "Open rear camera"}</strong><small>Point it at the barcode</small></button>}
      </div>
      <p className="camera-hint">{cameraLive ? "Hold the barcode inside the frame" : "You’ll be asked to allow camera access."}</p>
      {error && <div className="inline-alert" role="alert"><WifiOff size={17} />{error}</div>}
      <form className="manual-barcode" onSubmit={(event) => { event.preventDefault(); if (manual.trim()) onResult(manual.trim()); }}><label><span>Or enter the number</span><input value={manual} inputMode="numeric" onChange={(event) => setManual(event.target.value)} placeholder="e.g. 3800123456789" /></label><button className="secondary-button" type="submit">Look up</button></form>
    </div>
  );
}

function requestContinuousFocus(source: MediaProvider | null | undefined) {
  if (!(source instanceof MediaStream)) return;
  const track = source.getVideoTracks()[0];
  if (!track?.getCapabilities || !track.applyConstraints) return;
  const capabilities = track.getCapabilities() as MediaTrackCapabilities & { focusMode?: string[] };
  if (!capabilities.focusMode?.includes("continuous")) return;
  void track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {
    // Autofocus is optional and unsupported on some browsers/cameras.
  });
}

async function imageToDataUrl(file: File, options: { maxDimension?: number; quality?: number } = {}) {
  const image = await createImageBitmap(file);
  const max = options.maxDimension || 2200;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  context?.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  let quality = options.quality || 0.9;
  let result = canvas.toDataURL("image/jpeg", quality);
  // Keep the request below the server's 10 MB boundary even for a very
  // detailed camera capture. Reducing JPEG quality preserves label pixels
  // better than shrinking the image again.
  while (result.length > 9_500_000 && quality > 0.72) {
    quality -= 0.06;
    result = canvas.toDataURL("image/jpeg", quality);
  }
  return result;
}

function LabelReader({ onFood, onClose, initialFiles = [], initialAction }: { onFood: (food: Food, questions: string[]) => void; onClose: () => void; initialFiles?: File[]; initialAction?: "camera" | "photo" }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initialFilesRef = useRef(initialFiles);
  const initialActionRef = useRef(initialAction);
  const analyzeRef = useRef<(files?: FileList | File[]) => Promise<void>>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cameraLive, setCameraLive] = useState(false);
  const [starting, setStarting] = useState(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    setCameraStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraLive(false);
  };
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!cameraStream || !cameraLive || !video) return;
    video.srcObject = cameraStream;
    void video.play().catch(() => setError("The camera preview could not start. Choose a photo instead."));
    return () => {
      if (video.srcObject === cameraStream) video.srcObject = null;
    };
  }, [cameraLive, cameraStream]);

  const analyzeImages = async (images: string[]) => {
    setError(""); setLoading(true);
    try {
      setPreviews(images);
      const session = await getSupabase()?.auth.getSession();
      const token = session?.data.session?.access_token;
      const response = await fetch("/api/analyze-label", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ images }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The label could not be read.");
      const result = labelAnalysisSchema.parse(body);
      const scannedFood: Food = {
        id: `ai-${crypto.randomUUID()}`,
        name: result.productName || "Scanned label",
        brand: result.brand || undefined,
        barcode: result.barcode || undefined,
        servingGrams: result.servingSizeG || undefined,
        packageGrams: result.packageSizeG || undefined,
        nutrientsPer100: result.per100,
        source: "ai-label",
      };

      // The image reader supplies the nutrition facts; the catalogue can still
      // supply a product thumbnail and cleaner package metadata when the name
      // is recognized, even when no barcode was visible.
      if (result.productName) {
        try {
          const query = [result.brand, result.productName].filter(Boolean).join(" ");
          const match = (await searchOpenFoodFacts(query))[0];
          if (match) {
            onFood({ ...scannedFood, brand: scannedFood.brand || match.brand, imageUrl: match.imageUrl, quantityLabel: match.quantityLabel, barcode: scannedFood.barcode || match.barcode }, result.followUpQuestions);
            return;
          }
        } catch {
          // AI-extracted nutrition remains useful when the optional catalogue is offline.
        }
      }
      onFood(scannedFood, result.followUpQuestions);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The label could not be read.");
    } finally { setLoading(false); }
  };

  const analyze = async (files?: FileList | File[]) => {
    if (!files?.length) return;
    try {
      // Nutrition tables are often tiny on a full package photo. Keep more
      // pixels for the vision model than we do for ordinary meal photos.
      await analyzeImages(await Promise.all(Array.from(files).slice(0, 3).map((file) => imageToDataUrl(file, { maxDimension: 3000, quality: 0.94 }))));
    } catch {
      setError("That photo could not be opened. Try taking a fresh picture of the nutrition table.");
    }
  };
  useEffect(() => { analyzeRef.current = analyze; });

  useEffect(() => {
    const timer = initialFilesRef.current.length ? window.setTimeout(() => { void analyzeRef.current?.(initialFilesRef.current); }, 0) : undefined;
    // The initial files are intentionally consumed once when this reader opens.
    return () => { if (timer) window.clearTimeout(timer); };
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support the camera. Choose a photo instead.");
      return;
    }
    setStarting(true); setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      requestContinuousFocus(stream);
      setCameraStream(stream);
      setCameraLive(true);
    } catch (caught) {
      const name = caught instanceof DOMException ? caught.name : "";
      setError(name === "NotAllowedError" || name === "SecurityError" ? "Camera access is off for this site. Allow Camera in your iPhone’s Safari or Home Screen app settings, then try again." : "The camera could not start. Choose a photo instead.");
    } finally { setStarting(false); }
  }, []);

  useEffect(() => {
    if (initialActionRef.current === "camera") void startCamera();
    else if (initialActionRef.current === "photo") inputRef.current?.click();
  }, [startCamera]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError("The camera is still getting ready. Try again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.9);
    stopCamera();
    await analyzeImages([image]);
  };

  return (
    <div className="label-reader">
      <div className="sheet-header"><button className="icon-button ghost" onClick={onClose} aria-label="Back to add food options"><ArrowLeft /></button><div><span className="eyebrow">AI assist</span><h2>Read nutrition label</h2></div><span /></div>
      {cameraLive ? <div className="label-camera-live"><div className="camera-frame live"><video ref={videoRef} muted playsInline autoPlay /><div className="scan-corners" /></div><button className="primary-button full" onClick={capture} disabled={loading}><Camera size={18} />Capture label</button><button className="text-button camera-cancel" onClick={stopCamera}>Cancel camera</button></div> : <div className={`label-dropzone ${previews.length ? "has-preview" : ""}`}>
        {previews.length ? <div className={`package-previews count-${previews.length}`}>{previews.map((preview) => <img key={preview} src={preview} alt="Selected package detail" />)}</div> : <><span className="action-icon blue"><Camera /></span><strong>Add the package details</strong><small>Label, barcode, and package size work best together</small></>}
        {loading && <span className="analyzing"><i /><strong>Reading the package…</strong></span>}
      </div>}
      {!cameraLive && <div className="label-camera-actions"><button className="primary-button" onClick={startCamera} disabled={starting}><Camera size={18} />{starting ? "Opening camera…" : "Open rear camera"}</button><button className="secondary-button" onClick={() => inputRef.current?.click()}><Upload size={18} />Choose photo</button></div>}
      <input ref={inputRef} className="visually-hidden-file" type="file" accept="image/*" capture="environment" multiple onChange={(event) => analyze(event.target.files || undefined)} />
      {error && <div className="inline-alert error" role="alert"><Info size={17} /><span>{error}</span></div>}
      <div className="label-tips"><strong>For the best result</strong><ul><li>Add up to three details: nutrition table, barcode, and package size.</li><li>One photo is fine when it has everything.</li><li>You’ll confirm the amount and meal before anything is logged.</li></ul></div>
    </div>
  );
}

function MealPhotoReader({ onMeal, onClose }: { onMeal: (analysis: MealPhotoAnalysis) => void; onClose: () => void }) {
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

function ManualFood({ initialBarcode, notice, onSave, onClose, hideCalories }: { initialBarcode?: string; notice?: string; onSave: (food: Food) => void; onClose: () => void; hideCalories: boolean }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState(initialBarcode || "");
  const [servingGrams, setServingGrams] = useState(100);
  const [nutrition, setNutrition] = useState<Nutrition>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 });
  const [error, setError] = useState("");
  const updateNutrition = (key: keyof Nutrition, value: string) => setNutrition((current) => ({ ...current, [key]: Number(value) }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const calories = hideCalories ? round(nutrition.protein * 4 + nutrition.carbs * 4 + nutrition.fat * 9, 0) : nutrition.calories;
    const values = [nutrition.protein, nutrition.carbs, nutrition.fat, nutrition.fiber, nutrition.sugar, calories, servingGrams];
    if (!name.trim() || values.some((value) => !Number.isFinite(value) || value < 0) || servingGrams <= 0) {
      setError("Add a food name and use zero or positive nutrition values with a serving above zero.");
      return;
    }
    setError("");
    onSave({ id: `custom-${crypto.randomUUID()}`, name: name.trim(), brand: brand.trim() || undefined, barcode: barcode.trim() || undefined, servingGrams, nutrientsPer100: { ...nutrition, calories }, source: "custom" });
  };
  return (
    <form className="sheet-form manual-food-form" onSubmit={submit}>
      <div className="sheet-header"><button type="button" className="icon-button ghost" onClick={onClose} aria-label="Back to add food options"><ArrowLeft /></button><div><span className="eyebrow">Full control</span><h2>Custom food</h2></div><span /></div>
      {notice && <div className="inline-alert" role="status"><Info size={17} /><span>{notice}</span></div>}
      <div className="form-grid two"><label className="span-two"><span>Food name</span><input autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Homemade meatballs" /></label><label><span>Brand <small>optional</small></span><input maxLength={120} value={brand} onChange={(event) => setBrand(event.target.value)} /></label><label><span>Barcode <small>optional</small></span><input inputMode="numeric" maxLength={80} value={barcode} onChange={(event) => setBarcode(event.target.value)} /></label></div>
      <div className="nutrition-entry"><div className="entry-heading"><div><strong>Nutrition per 100 g</strong><small>{hideCalories ? "Energy is calculated quietly from macros" : "Copy the package values"}</small></div><Package size={20} /></div><div className="form-grid three">{!hideCalories && <label><span>Calories</span><input required min="0" type="number" inputMode="decimal" value={nutrition.calories} onChange={(event) => updateNutrition("calories", event.target.value)} /></label>}<label><span>Protein</span><input min="0" type="number" inputMode="decimal" step="0.1" value={nutrition.protein} onChange={(event) => updateNutrition("protein", event.target.value)} /></label><label><span>Carbs</span><input min="0" type="number" inputMode="decimal" step="0.1" value={nutrition.carbs} onChange={(event) => updateNutrition("carbs", event.target.value)} /></label><label><span>Fat</span><input min="0" type="number" inputMode="decimal" step="0.1" value={nutrition.fat} onChange={(event) => updateNutrition("fat", event.target.value)} /></label><label><span>Fibre</span><input min="0" type="number" inputMode="decimal" step="0.1" value={nutrition.fiber} onChange={(event) => updateNutrition("fiber", event.target.value)} /></label><label><span>Sugar</span><input min="0" type="number" inputMode="decimal" step="0.1" value={nutrition.sugar} onChange={(event) => updateNutrition("sugar", event.target.value)} /></label></div></div>
      <label><span>Default serving weight</span><div className="input-suffix"><input required type="number" inputMode="decimal" min="0.1" step="0.1" value={servingGrams} onChange={(event) => setServingGrams(Number(event.target.value))} /><span>g</span></div></label>
      {error && <div className="inline-alert error" role="alert"><Info size={17} /><span>{error}</span></div>}
      <button className="primary-button full" type="submit">Continue to amount<ChevronRight size={18} /></button>
    </form>
  );
}

export function PortionSheet({ food, questions, initialMealType, onLog, onClose, hideCalories }: { food: Food; questions?: string[]; initialMealType?: MealType; onLog: (meal: Meal, food: Food) => void; onClose: () => void; hideCalories: boolean }) {
  const units = contextualUnits(food);
  const initialUnit: ServingUnit = food.packageGrams ? "package" : food.servingGrams ? "serving" : "g";
  const [unit, setUnit] = useState<ServingUnit>(initialUnit);
  const [amount, setAmount] = useState(initialUnit === "g" ? 100 : 1);
  const [mealType, setMealType] = useState<MealType>(() => initialMealType || suggestedMealType());
  const [loggedDate, setLoggedDate] = useState(localDateKey());
  const [additionalDatesOpen, setAdditionalDatesOpen] = useState(false);
  const [loggedDates, setLoggedDates] = useState<string[]>([localDateKey()]);
  const grams = gramsFor(food, amount, unit);
  const nutrition = scaleNutrition(food.nutrientsPer100, grams);
  const log = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(grams) || grams <= 0) return;
    const dates = additionalDatesOpen ? loggedDates : [loggedDate];
    dates.forEach((date) => onLog({
      id: crypto.randomUUID(), foodId: food.id, name: food.name, brand: food.brand, mealType, amount, unit, grams, nutrition,
      createdAt: new Date().toISOString(), loggedDate: date, source: food.source, estimated: food.source === "ai-label" || !food.verified,
    }, { ...food, lastUsedAt: new Date().toISOString() }));
  };
  return (
    <form className="portion-sheet" onSubmit={log}>
      <div className="sheet-header"><button type="button" className="icon-button ghost" onClick={onClose} aria-label="Back to food selection"><ArrowLeft /></button><div><span className="eyebrow">Confirm amount</span><h2>Log food</h2></div><span /></div>
      <div className="selected-food"><FoodAvatar food={food} /><div><strong>{food.name}</strong><span>{food.brand || food.quantityLabel || "Nutrition per 100 g"}</span></div>{!hideCalories && <div className="selected-calories"><strong>{nutrition.calories}</strong><small>kcal</small></div>}</div>
      {!!questions?.length && <div className="follow-up"><Sparkles size={18} /><div><strong>One detail still matters</strong>{questions.map((question) => <p key={question}>{question}</p>)}<small>Use grams below if the package or serving amount is unknown.</small></div></div>}
      <div className="amount-control"><button type="button" aria-label="Decrease amount" onClick={() => setAmount(Math.max(unit === "g" ? 1 : 0.25, round(amount - (unit === "g" || unit === "ml" ? 10 : 0.5), 2)))}>−</button><label><input required aria-label="Amount" type="number" inputMode="decimal" min="0.01" step="any" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><span>{formatUnit(unit, amount)}</span></label><button type="button" aria-label="Increase amount" onClick={() => setAmount(round(amount + (unit === "g" || unit === "ml" ? 10 : 0.5), 2))}>+</button></div>
      <div className="unit-scroll" role="group" aria-label="Serving unit">{units.map((option) => <button type="button" key={option} aria-pressed={unit === option} className={unit === option ? "active" : ""} onClick={() => { setUnit(option); setAmount(option === "g" || option === "ml" ? 100 : 1); }}>{unitLabels[option]}</button>)}</div>
      {(unit === "tbsp" || unit === "tsp" || unit === "ml") && <p className="estimate-note"><Info size={14} /> Volume-to-weight conversion is approximate unless the food provides it.</p>}
      <div className="nutrition-preview"><div><span>Protein</span><strong>{nutrition.protein} g</strong></div><div><span>Carbs</span><strong>{nutrition.carbs} g</strong></div><div><span>Fat</span><strong>{nutrition.fat} g</strong></div><div><span>Fibre</span><strong>{nutrition.fiber} g</strong></div></div>
      <div className="portion-action-area">
        <div className="field-block"><span id="meal-type-label">Add to</span><div className="segmented four" role="group" aria-labelledby="meal-type-label">{(Object.keys(mealLabels) as MealType[]).map((type) => <button type="button" key={type} aria-pressed={mealType === type} className={mealType === type ? "active" : ""} onClick={() => setMealType(type)}>{mealLabels[type]}</button>)}</div></div>
      <label className="meal-date-field"><span>Meal date <small>Usually today</small></span><input type="date" value={loggedDate} max={localDateKey()} onChange={(event) => setLoggedDate(event.target.value || localDateKey())} /></label>
      <div className="multi-date-log"><button type="button" className="text-button" aria-expanded={additionalDatesOpen} onClick={() => setAdditionalDatesOpen((open) => !open)}>{additionalDatesOpen ? "Log one day instead" : "Log this on multiple days"}</button>{additionalDatesOpen && <div className="multi-date-options" role="group" aria-label="Days to log this food">{recentLogDates().map((date) => <button type="button" key={date} className={loggedDates.includes(date) ? "active" : ""} aria-pressed={loggedDates.includes(date)} onClick={() => setLoggedDates((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date])}>{dayLabel(date)}</button>)}</div>}</div>
      <div className="portion-submit"><button className="primary-button full" type="submit" disabled={additionalDatesOpen && loggedDates.length === 0}><Plus size={18} />{hideCalories ? "Log food" : `Log ${nutrition.calories} kcal`}</button><p className="form-footnote">{grams} g total · {food.source === "open-food-facts" ? "Open Food Facts" : food.source === "food-data-central" ? "USDA FoodData Central" : food.source === "restaurant" ? "Restaurant menu nutrition" : food.source === "ai-label" ? "AI-extracted—check the package" : food.source === "custom" ? "Your custom food" : "Generic reference value"}</p></div>
      </div>
    </form>
  );
}

function QuickMacroSheet({ onLog, onClose, hideCalories }: { onLog: (meal: Meal, food: Food) => void; onClose: () => void; hideCalories: boolean }) {
  const [name, setName] = useState("Quick macros"); const [mealType, setMealType] = useState<MealType>(suggestedMealType()); const [date, setDate] = useState(localDateKey()); const [values, setValues] = useState({ protein: "0", carbs: "0", fat: "0", fiber: "0", sugar: "0" });
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const nutrients = { protein: Number(values.protein), carbs: Number(values.carbs), fat: Number(values.fat), fiber: Number(values.fiber), sugar: Number(values.sugar) }; if (!name.trim() || Object.values(nutrients).some((value) => !Number.isFinite(value) || value < 0)) return; const nutrition: Nutrition = { ...nutrients, calories: round(nutrients.protein * 4 + nutrients.carbs * 4 + nutrients.fat * 9, 0) }; const food: Food = { id: `quick-${crypto.randomUUID()}`, name: name.trim(), servingGrams: 100, nutrientsPer100: nutrition, source: "custom" }; onLog({ id: crypto.randomUUID(), foodId: food.id, name: food.name, mealType, amount: 1, unit: "serving", grams: 100, nutrition, createdAt: new Date().toISOString(), loggedDate: date, source: "custom" }, food); };
  return <form className="sheet-form" onSubmit={submit}><div className="sheet-header"><button type="button" className="icon-button ghost" onClick={onClose} aria-label="Back to add food options"><ArrowLeft /></button><div><span className="eyebrow">Fast entry</span><h2>Quick macros</h2></div><span /></div><label><span>Name</span><input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label><div className="form-grid three">{(["protein", "carbs", "fat", "fiber", "sugar"] as const).map((key) => <label key={key}><span>{key === "fiber" ? "Fibre" : key[0].toUpperCase() + key.slice(1)} g</span><input type="number" min="0" step="0.1" value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>{!hideCalories && <p className="form-footnote">Calories are calculated from the macros you enter.</p>}<div className="form-grid two"><label><span>Meal</span><ThemedSelect ariaLabel="Quick macro meal" value={mealType} onChange={(value) => setMealType(value as MealType)} options={(Object.keys(mealLabels) as MealType[]).map((type) => ({ value: type, label: mealLabels[type] }))} /></label><label><span>Date</span><input type="date" max={localDateKey()} value={date} onChange={(event) => setDate(event.target.value)} /></label></div><button className="primary-button full" type="submit"><Plus size={18} />Log macros</button></form>;
}

export function AddFoodSheet({ foods, initialView = "start", initialMealType, onLog, onMealPhoto, onSaveFood, hideCalories }: { foods: Food[]; initialView?: AddView; initialMealType?: MealType; onLog: (meal: Meal, food: Food) => void; onMealPhoto: (analysis: MealPhotoAnalysis) => void; onSaveFood: (food: Food) => Promise<void>; hideCalories: boolean }) {
  const [view, setView] = useState<AddView>(initialView);
  const [selected, setSelected] = useState<Food>();
  const [questions, setQuestions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [intakeError, setIntakeError] = useState("");
  const [manualNotice, setManualNotice] = useState("");
  const [unknownBarcode, setUnknownBarcode] = useState("");
  const [intakeDraft, setIntakeDraft] = useState("");
  const [coachReply, setCoachReply] = useState("");
  const [askingCoach, setAskingCoach] = useState(false);
  const [listening, setListening] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const searchRequestRef = useRef(0);
  const recent = [...foods].filter((food) => food.lastUsedAt).sort((a, b) => (b.lastUsedAt || "").localeCompare(a.lastUsedAt || "")).slice(0, 6);
  const changeView = (nextView: AddView) => {
    if (view === "search" && nextView !== "search") {
      searchRequestRef.current += 1;
      setLoading(false);
      setSearchError("");
    }
    if (nextView !== "start") setIntakeError("");
    if (nextView !== "manual" && nextView !== "barcode-not-found") {
      setUnknownBarcode("");
      setManualNotice("");
    }
    setView(nextView);
  };
  const pick = (food: Food, followUps: string[] = []) => { setSearchError(""); setSelected(food); setQuestions(followUps); };
  const runSearch = useCallback(async (value: string) => {
    const requestId = ++searchRequestRef.current;
    const normalized = value.trim().toLowerCase();
    if (!normalized) { setResults([]); setSearchError(""); setLoading(false); return; }
    const local = foods.filter((food) => `${food.name} ${food.brand || ""} ${food.barcode || ""}`.toLowerCase().includes(normalized)).slice(0, 10);
    setResults(local); setLoading(true); setSearchError("");
    if (normalized.length < 2) { setLoading(false); return; }
    try {
      const remote = await searchOpenFoodFacts(value.trim());
      if (requestId !== searchRequestRef.current) return;
      const localIds = new Set(local.map((food) => food.id));
      setResults([...local, ...remote.filter((food) => !localIds.has(food.id))].slice(0, 25));
    } catch {
      if (requestId === searchRequestRef.current && !local.length) setSearchError("Online food search is unavailable. You can still add a custom food.");
    } finally {
      if (requestId === searchRequestRef.current) setLoading(false);
    }
  }, [foods]);
  const search = async (event?: FormEvent) => { event?.preventDefault(); await runSearch(query); };
  useEffect(() => {
    if (view !== "search") return;
    const timer = window.setTimeout(() => { void runSearch(query); }, 700);
    return () => window.clearTimeout(timer);
  }, [query, runSearch, view]);
  const sendIntake = async (event: FormEvent) => {
    event.preventDefault();
    const message = intakeDraft.trim();
    if (!message || askingCoach) return;
    const soundsConversational = /\b(i|my|me|how|what|can|should|help|ate|eaten|bite|bites|slice|slices|calorie|protein|macro|portion)\b|[?]/i.test(message);
    setCoachReply(""); setIntakeError("");
    if (!soundsConversational) {
      setQuery(message); changeView("search"); await runSearch(message);
      return;
    }
    setAskingCoach(true);
    try {
      const session = await getSupabase()?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Sign in to ask the Coach about your log.");
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message, history: [], localDate: localDateKey(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const body: unknown = await response.json();
      const bodyRecord = body && typeof body === "object" ? body as Record<string, unknown> : {};
      if (!response.ok) throw new Error(typeof bodyRecord.error === "string" ? bodyRecord.error : "The Coach is unavailable right now.");
      if (typeof bodyRecord.reply !== "string") throw new Error("The Coach returned an invalid response.");
      setCoachReply(hideCalories ? hideCalorieValues(bodyRecord.reply) : bodyRecord.reply);
    } catch (caught) {
      setIntakeError(caught instanceof Error ? caught.message : "The Coach is unavailable right now.");
    } finally { setAskingCoach(false); }
  };
  const startVoiceSearch = () => {
    type VoiceResult = { 0?: { transcript?: string } };
    type VoiceRecognition = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; onresult?: (event: { results: { [index: number]: VoiceResult } }) => void; onerror?: () => void; onend?: () => void };
    type VoiceRecognitionConstructor = new () => VoiceRecognition;
    const browser = window as unknown as { SpeechRecognition?: VoiceRecognitionConstructor; webkitSpeechRecognition?: VoiceRecognitionConstructor };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) { setIntakeError("Voice logging is not available in this browser. Type a food name instead."); return; }
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US"; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const phrase = normalizeVoiceFoodQuery(event.results[0]?.[0]?.transcript || "");
      if (!phrase) { setIntakeError("I didn’t catch a food name. Try again or type it instead."); return; }
      setIntakeDraft(phrase); setQuery(phrase); changeView("search"); void runSearch(phrase);
    };
    recognition.onerror = () => setIntakeError("Voice logging stopped before a food name was captured. Try again or type it instead.");
    recognition.onend = () => setListening(false);
    setListening(true); setIntakeError(""); recognition.start();
  };
  const addImages = (files?: FileList | File[]) => {
    if (!files?.length) return;
    setPendingImages(Array.from(files).slice(0, 3));
    changeView("label");
  };
  const saveAndPick = async (food: Food, followUps: string[] = []) => {
    await onSaveFood(food);
    pick(food, followUps);
  };
  const barcode = async (code: string, fallback?: Food, followUps: string[] = [], persistFallback = false) => {
    setLoading(true); setManualNotice("");
    const cached = foods.find((food) => food.barcode === code);
    if (cached) {
      if (persistFallback && fallback) await saveAndPick(fallback, followUps);
      else pick(cached, followUps);
      setLoading(false);
      return;
    }
    try {
      const food = await findByBarcode(code);
      if (food) {
        if (persistFallback && fallback) await saveAndPick(fallback, followUps);
        else pick(food, followUps);
      } else if (fallback) {
        if (persistFallback) await saveAndPick(fallback, followUps);
        else pick(fallback, followUps);
      } else { setUnknownBarcode(code); setManualNotice("No product matched this barcode. You can scan its nutrition label or add the food by hand."); changeView("barcode-not-found"); }
    } catch {
      if (fallback) {
        if (persistFallback) await saveAndPick(fallback, followUps);
        else pick(fallback, followUps);
      } else { setUnknownBarcode(code); setManualNotice("We couldn’t look up this barcode right now. You can scan its nutrition label or add the food by hand."); changeView("barcode-not-found"); }
    }
    finally { setLoading(false); }
  };
  const handleLabelFood = async (food: Food, followUps: string[]) => {
    const labeledFood = food.barcode || !unknownBarcode ? food : { ...food, barcode: unknownBarcode };
    if (labeledFood.barcode) await barcode(labeledFood.barcode, labeledFood, followUps, true);
    else await saveAndPick(labeledFood, followUps);
  };
  if (selected) return <PortionSheet food={selected} questions={questions} initialMealType={initialMealType} hideCalories={hideCalories} onLog={onLog} onClose={() => setSelected(undefined)} />;
  if (view === "scan") return <>{loading && <div className="global-loader"><i />Looking up product…</div>}<BarcodeScanner onResult={barcode} onClose={() => changeView("start")} /></>;
  if (view === "camera") return <LabelReader initialFiles={pendingImages} initialAction="camera" onFood={(food, followUps) => { void handleLabelFood(food, followUps); }} onClose={() => { setPendingImages([]); changeView("start"); }} />;
  if (view === "photo") return <MealPhotoReader onMeal={onMealPhoto} onClose={() => changeView("start")} />;
  if (view === "label") return <LabelReader initialFiles={pendingImages} onFood={(food, followUps) => { void handleLabelFood(food, followUps); }} onClose={() => { setPendingImages([]); changeView("start"); }} />;
  if (view === "manual") return <ManualFood initialBarcode={unknownBarcode} notice={manualNotice} hideCalories={hideCalories} onSave={(food) => void saveAndPick(food)} onClose={() => changeView("start")} />;
  if (view === "quick") return <QuickMacroSheet hideCalories={hideCalories} onLog={onLog} onClose={() => changeView("start")} />;
  if (view === "barcode-not-found") return <div className="barcode-not-found"><div className="sheet-header"><button className="icon-button ghost" onClick={() => changeView("scan")} aria-label="Back to barcode scanner"><ArrowLeft /></button><div><span className="eyebrow">Barcode not found</span><h2>Let’s add this food</h2></div><span /></div><div className="barcode-not-found-copy"><span className="action-icon amber"><Package /></span><div><strong>No saved product matched {unknownBarcode}</strong><p>Use the package label to check the nutrition, or enter it yourself. We’ll save it for next time.</p></div></div><div className="barcode-not-found-actions"><button className="primary-button full" type="button" onClick={() => { setPendingImages([]); changeView("label"); }}><Camera size={18} />Scan nutrition label</button><button className="secondary-button full" type="button" onClick={() => changeView("manual")}><Pencil size={18} />Add by hand</button></div></div>;
  if (view === "search") return (
    <div>
      <div className="sheet-header"><button className="icon-button ghost" onClick={() => changeView("start")} aria-label="Back to add food options"><ArrowLeft /></button><div><span className="eyebrow">Food database</span><h2>Search</h2></div><span /></div>
      <form className="sheet-search" onSubmit={search}><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Food, brand or barcode" /><button type="submit">Search now</button></form>
      {loading && <div className="search-status" role="status"><i />Searching local and packaged foods…</div>}
      {searchError && <div className="inline-alert" role="alert"><WifiOff size={17} />{searchError}</div>}
      <div className="food-list sheet-food-list">{results.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div>
      {!loading && query && results.length === 0 && <div className="search-empty"><Database /><strong>No match yet</strong><p>Add it as a custom food and it will be ready next time.</p><button className="secondary-button" onClick={() => changeView("manual")}>Add custom food</button></div>}
      {!query && <div className="quick-list"><span className="eyebrow">Try something simple</span>{foods.slice(0, 6).map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div>}
      <div className="data-credit"><Database size={15} /><span>Product results by Open Food Facts · ODbL</span></div>
    </div>
  );
  return (
    <div className="coach-intake" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addImages(event.dataTransfer.files); }}>
      <div className="sheet-header"><span /><div><span className="eyebrow">Log with Coach</span><h2>Add food or get help</h2></div><span /></div>
      <div className="intake-actions"><button onClick={() => changeView("scan")}><ScanLine size={17} />Barcode</button><button onClick={() => { setPendingImages([]); changeView("camera"); }}><Camera size={17} />Take photo</button><button onClick={() => imageInputRef.current?.click()}><Upload size={17} />Add photos</button><button type="button" onClick={startVoiceSearch} disabled={listening}><Mic size={17} />{listening ? "Listening…" : "Voice"}</button><button type="button" onClick={() => changeView("quick")}><Plus size={17} />Quick macros</button></div>
      <input ref={imageInputRef} className="visually-hidden-file" type="file" accept="image/*" capture="environment" multiple onChange={(event) => addImages(event.target.files || undefined)} />
      <label className="intake-input-label" htmlFor="coach-intake">Search a food or ask Coach</label>
      <form className="intake-composer" onSubmit={sendIntake}><input id="coach-intake" autoFocus value={intakeDraft} onChange={(event) => setIntakeDraft(event.target.value)} placeholder="Food or question" /><button type="submit" disabled={!intakeDraft.trim() || askingCoach} aria-label="Send to Coach">{askingCoach ? <span className="coach-loader" /> : <Send />}</button></form>
      {coachReply && <div className="intake-reply"><span>Coach</span><p>{coachReply}</p><button className="text-button" onClick={() => { setQuery(intakeDraft); changeView("search"); void runSearch(intakeDraft); }}><Search size={16} />Find a food to log</button></div>}
      {intakeError && <div className="inline-alert error" role="alert"><Info size={17} />{intakeError}</div>}
      {!!recent.length && <div className="quick-list"><span className="eyebrow">Recent · one tap</span>{recent.map((food) => <FoodRow key={food.id} food={food} hideCalories={hideCalories} onSelect={() => pick(food)} />)}</div>}
      <button className="text-button intake-manual" onClick={() => changeView("manual")}><Pencil size={16} />Add custom food</button>
      <div className="simple-note"><ShieldCheck size={17} /><span>Barcode and saved-food search work directly. Package photos are sent to AI only after you add them.</span></div>
    </div>
  );
}

type DisplayCoachMessage = CoachMessage & { imageUrl?: string; sources?: Array<{ title: string; url: string }>; mealAction?: CoachMealAction; mealChoices?: CoachMealChoice[] };


function dayLabel(dateKey: string) {
  const today = localDateKey();
  if (dateKey === today) return "Today";
  const date = new Date(`${dateKey}T12:00:00`);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === localDateKey(yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function changeDate(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

function FoodAvatar({ food, name }: { food?: Food; name?: string }) {
  if (food?.imageUrl) return <img className="food-avatar" src={food.imageUrl} alt="" />;
  return <div className="food-avatar fallback">{(name || food?.name || "F").slice(0, 1).toUpperCase()}</div>;
}

async function readMealImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 8_000_000) throw new Error("That image is too large. Choose one under 8 MB.");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The image could not be read."));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("The image could not be opened."));
    element.src = source;
  });
  const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  const resized = canvas.toDataURL("image/jpeg", 0.82);
  if (resized.length > 400_000) throw new Error("That image is still too large after resizing. Choose a simpler photo.");
  return resized;
}