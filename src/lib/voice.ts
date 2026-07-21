export function normalizeVoiceFoodQuery(transcript: string) {
  return transcript.trim().replace(/\s+/g, " ").slice(0, 100);
}
