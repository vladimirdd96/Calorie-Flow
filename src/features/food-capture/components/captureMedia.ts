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

/**
 * Shrinks an already-captured data URL down to a stored thumbnail.
 *
 * A package photo the user just took is a better product picture than nothing, and far
 * better than a picture borrowed from a similarly named product. Saved foods cap the
 * image at 400,000 characters (`optionalAvatar`), so the full-resolution capture sent to
 * the label reader cannot be reused directly.
 */
export async function dataUrlToThumbnail(dataUrl: string, maxDimension = 320) {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const image = await createImageBitmap(blob);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    let quality = 0.78;
    let result = canvas.toDataURL("image/jpeg", quality);
    while (result.length > 380_000 && quality > 0.4) {
      quality -= 0.08;
      result = canvas.toDataURL("image/jpeg", quality);
    }
    return result.length <= 380_000 ? result : undefined;
  } catch {
    // A thumbnail is a nicety; never let it block logging the food.
    return undefined;
  }
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
