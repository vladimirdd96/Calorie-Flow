const MAX_FOOD_IMAGE_DATA_URL_LENGTH = 360_000;
const IMAGE_DIMENSIONS = [1024, 896, 768, 640];
const IMAGE_QUALITIES = [0.78, 0.68, 0.58, 0.48];

/** Read and resize a private food photo so it is safe for local and cloud JSON storage. */
export async function readFoodImage(file: File) {
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
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) throw new Error("The image could not be opened.");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The image could not be prepared.");
  for (const maxDimension of IMAGE_DIMENSIONS) {
    const scale = Math.min(1, maxDimension / longestSide);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of IMAGE_QUALITIES) {
      const encoded = canvas.toDataURL("image/jpeg", quality);
      if (encoded.length <= MAX_FOOD_IMAGE_DATA_URL_LENGTH) return encoded;
    }
  }
  throw new Error("That photo could not be added. Try another photo.");
}
