/**
 * Utilities.js
 * Shared pure helper functions. No side-effects, no DOM access.
 * Import (ES module) or load via <script> before other modules.
 */

/** Generate a random UUID (RFC 4122 v4). */
export function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
}

/** Clamp a number within [min, max]. */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Coerce any value to a non-negative integer (default 0). */
export function toInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

/** Return value if truthy string, otherwise fallback. */
export function str(v, fallback = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/**
 * Escape a string for safe inclusion in SVG text nodes and attributes.
 * Handles &, <, >, ", '.
 */
export function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Convert a name/title to a safe filename slug. */
export function slug(text, fallback = "card") {
  const s = String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return s || fallback;
}

/** Split a comma-separated string into a trimmed array, filtering empties. */
export function splitCsv(s) {
  return String(s ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Deep-clone a plain JSON-serialisable object. */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Format ISO timestamp to locale date string. */
export function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso ?? "";
  }
}

/** Download a Blob as a file in the browser. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read a File as a data URL.
 * Returns a Promise<string>.
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Wrap SVG text at approximately `maxChars` per line.
 * Returns an array of line strings.
 */
export function wrapText(text, maxChars) {
  const words = String(text ?? "").split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Emit a custom DOM event on target element.
 * @param {EventTarget} target
 * @param {string} name
 * @param {*} detail
 */
export function emit(target, name, detail) {
  target.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
}
