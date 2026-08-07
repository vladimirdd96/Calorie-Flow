"use client";

import { ArrowLeft, Camera, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ClearableInput } from "@/features/shared/ClearableInput";
import { isValidGtin, normalizeGtin } from "@/lib/gtin";
import { requestContinuousFocus } from "./captureMedia";

/**
 * A single frame can decode to digits that pass ZXing but name the wrong product. Two
 * defences, both cheap: require the same code twice in a row, and check the GTIN check
 * digit before accepting it. Together they turn most misreads into "keep scanning"
 * instead of a confidently wrong food.
 */
const REQUIRED_CONFIRMATIONS = 2;

export function BarcodeScanner({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | undefined>(undefined);
  const pendingRef = useRef<{ code: string; hits: number }>({ code: "", hits: 0 });
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [cameraLive, setCameraLive] = useState(false);
  const [reading, setReading] = useState("");

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
      const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
      // Packaged food only ever carries these symbologies. Narrowing the set stops the
      // decoder from spending frames on QR/Data Matrix and removes a class of misread.
      const hints = new Map<number, unknown>([
        [DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E, BarcodeFormat.ITF, BarcodeFormat.CODE_128,
        ]],
        [DecodeHintType.TRY_HARDER, true],
      ]);
      const reader = new BrowserMultiFormatReader(hints as never);
      const controls = await reader.decodeFromConstraints({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      }, videoRef.current!, (result) => {
        if (!result) return;
        const code = normalizeGtin(result.getText());
        // A code whose check digit does not add up is a misread, not a product.
        if (!isValidGtin(code)) { pendingRef.current = { code: "", hits: 0 }; return; }
        const pending = pendingRef.current;
        pendingRef.current = pending.code === code ? { code, hits: pending.hits + 1 } : { code, hits: 1 };
        setReading(code);
        if (pendingRef.current.hits < REQUIRED_CONFIRMATIONS) return;
        controlsRef.current?.stop();
        onResult(code);
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
      {/* Showing the digits as they lock in lets the user catch a wrong number before
          it becomes a wrong food, which a silent scanner never allows. */}
      <p className="camera-hint">{cameraLive ? reading ? `Reading ${reading}…` : "Hold the barcode inside the frame" : "You’ll be asked to allow camera access."}</p>
      {error && <div className="inline-alert" role="alert"><WifiOff size={17} />{error}</div>}
      {/* A typed code is still looked up when its check digit fails — the user can read
          the package and some short in-store codes are not standard GTINs — but the
          mismatch is worth naming, since a mistyped digit is the usual cause. */}
      <form className="manual-barcode" onSubmit={(event) => {
        event.preventDefault();
        const typed = normalizeGtin(manual);
        if (!typed) { setError("Enter the digits printed under the barcode."); return; }
        if (!isValidGtin(typed)) setError("That number doesn’t match a standard barcode — check it against the package if the lookup finds the wrong food.");
        onResult(typed);
      }}><label><span>Or enter the number</span><ClearableInput value={manual} inputMode="numeric" onChange={(event) => setManual(event.target.value)} onClear={() => setManual("")} placeholder="e.g. 3800123456789" clearLabel="Clear barcode" /></label><button className="secondary-button" type="submit">Look up</button></form>
    </div>
  );
}
