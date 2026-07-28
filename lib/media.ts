const COVER_KEY_PATTERN = /^covers\/\d{4}\/\d{2}\/[0-9a-f-]+\.(?:jpg|png|webp)$/i;

export function safeCoverKey(value: unknown) {
  const key = String(value ?? "").trim();
  return !key || !COVER_KEY_PATTERN.test(key) ? "" : key;
}

export function mediaUrl(key: string) {
  const safeKey = safeCoverKey(key);
  return safeKey ? `/media/${safeKey.split("/").map(encodeURIComponent).join("/")}` : "";
}
