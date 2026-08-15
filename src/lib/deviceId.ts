/** Stable per-device identifier used to enforce one account per phone. */
const KEY = "harmic_device_id";

export function getDeviceFingerprint(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      const seed =
        [navigator.userAgent, navigator.language, screen.width, screen.height, screen.colorDepth,
         new Date().getTimezoneOffset()].join("|");
      let hash = 0;
      for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
      id = `${Math.abs(hash).toString(36)}-${crypto.randomUUID()}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
