/**
 * Storage.js
 * Handles persistence: LocalStorage auto-save/load + JSON file I/O.
 */

import { deepClone } from "./Utilities.js";

const LS_KEY = "itw_card_studio_library";
const LS_PREFS_KEY = "itw_card_studio_prefs";

/**
 * Persist the full card library array to LocalStorage.
 * @param {CardData[]} cards
 */
export function saveLibraryToStorage(cards) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cards));
  } catch (err) {
    console.warn("[Storage] Failed to save library:", err.message);
  }
}

/**
 * Load the card library from LocalStorage.
 * Returns an empty array if nothing is stored or data is corrupt.
 * @returns {CardData[]}
 */
export function loadLibraryFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Persist user preferences (guide visibility, zoom, active column widths, etc.)
 * @param {object} prefs
 */
export function savePrefs(prefs) {
  try {
    localStorage.setItem(LS_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage might be full or unavailable; silently skip.
  }
}

/**
 * Load user preferences.
 * Returns a default prefs object if nothing stored.
 * @returns {object}
 */
export function loadPrefs() {
  try {
    const raw = localStorage.getItem(LS_PREFS_KEY);
    if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) };
  } catch {
    // Fall through to defaults.
  }
  return defaultPrefs();
}

function defaultPrefs() {
  return {
    showBleedGuide: false,
    showTrimGuide: true,
    showSafeGuide: true,
    previewZoom: 0.4,
    lastActiveTab: "general",
  };
}

/**
 * Serialise a card library to a JSON Blob ready for download.
 * @param {CardData[]} cards
 * @returns {Blob}
 */
export function libraryToBlob(cards) {
  return new Blob([JSON.stringify(cards, null, 2)], {
    type: "application/json",
  });
}

/**
 * Parse a JSON file (File object) and resolve to the parsed value.
 * @param {File} file
 * @returns {Promise<*>}
 */
export function parseJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result));
      } catch {
        reject(new Error(`Invalid JSON in file: ${file.name}`));
      }
    };
    reader.onerror = () => reject(new Error(`Could not read file: ${file.name}`));
    reader.readAsText(file);
  });
}

/**
 * Normalise raw card JSON (possibly old format) into the current CardData schema.
 * Fills missing fields with defaults so every card always has a consistent shape.
 * @param {object} raw
 * @returns {CardData}
 */
export function normalizeCard(raw) {
  const r = raw ?? {};
  return {
    id: r.id ?? crypto.randomUUID(),
    name: r.name ?? "",
    scientificName: r.scientificName ?? "",
    rarity: r.rarity ?? "Common",
    template: r.template ?? "organism",
    category: r.category ?? "",
    habitat: r.habitat ?? "",
    expansion: r.expansion ?? "ITW-A",
    cardNumber: r.cardNumber ?? "",
    artist: r.artist ?? "",
    copyright: r.copyright ?? "© Into the Wild TCG",
    cost: {
      water: r.cost?.water ?? 0,
      flora: r.cost?.flora ?? 0,
      fauna: r.cost?.fauna ?? 0,
    },
    stats: {
      attack: r.stats?.attack ?? 0,
      health: r.stats?.health ?? 0,
      defense: r.stats?.defense ?? 0,
    },
    text: {
      ability: r.text?.ability ?? "",
      fact: r.text?.fact ?? "",
      flavor: r.text?.flavor ?? "",
    },
    artwork: {
      dataUrl: r.artwork?.dataUrl ?? null,
      zoom: r.artwork?.zoom ?? 1,
      panX: r.artwork?.panX ?? 0,
      panY: r.artwork?.panY ?? 0,
    },
    tags: Array.isArray(r.tags) ? r.tags : [],
    keywords: Array.isArray(r.keywords) ? r.keywords : [],
    notes: r.notes ?? "",
    createdAt: r.createdAt ?? new Date().toISOString(),
    updatedAt: r.updatedAt ?? new Date().toISOString(),
  };
}
