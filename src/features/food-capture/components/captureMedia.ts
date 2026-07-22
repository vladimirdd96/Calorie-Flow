"use client";

export function requestContinuousFocus(source: MediaProvider | null | undefined) {
  if (!(source instanceof MediaStream)) return;
  const track = source.getVideoTracks()[0];
  if (!track?.getCapabilities || !track.applyConstraints) return;
  const capabilities = track.getCapabilities() as MediaTrackCapabilities & { focusMode?: string[] };
  if (!capabilities.focusMode?.includes("continuous")) return;
  void track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {
    // Autofocus is optional and unsupported on some browsers/cameras.
  });
}

export async function imageToDataUrl(file: File, options: { maxDimension?: number; quality?: number } = {}) {
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
