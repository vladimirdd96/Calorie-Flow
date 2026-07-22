"use client";

import { ArrowLeft, Camera, Info, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { searchOpenFoodFacts } from "@/lib/openfoodfacts";
import { labelAnalysisSchema } from "@/lib/schemas";
import { getSupabase } from "@/lib/supabase";
import type { Food } from "@/lib/types";
import { imageToDataUrl, requestContinuousFocus } from "./captureMedia";

export function LabelReader({ onFood, onClose, initialFiles = [], initialAction }: { onFood: (food: Food, questions: string[]) => void; onClose: () => void; initialFiles?: File[]; initialAction?: "camera" | "photo" }) {
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
