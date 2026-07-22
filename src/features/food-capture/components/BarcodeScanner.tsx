"use client";

import { ArrowLeft, Camera, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ClearableInput } from "@/features/shared/ClearableInput";
import { requestContinuousFocus } from "./captureMedia";

export function BarcodeScanner({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
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
      <form className="manual-barcode" onSubmit={(event) => { event.preventDefault(); if (manual.trim()) onResult(manual.trim()); }}><label><span>Or enter the number</span><ClearableInput value={manual} inputMode="numeric" onChange={(event) => setManual(event.target.value)} onClear={() => setManual("")} placeholder="e.g. 3800123456789" clearLabel="Clear barcode" /></label><button className="secondary-button" type="submit">Look up</button></form>
    </div>
  );
}
