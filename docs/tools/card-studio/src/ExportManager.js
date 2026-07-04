/**
 * ExportManager.js
 * Handles all export operations: SVG, PNG, JPG, Card JSON, Library JSON.
 *
 * Pipeline:
 *   Card JSON → CardRenderer → SVG → (SVG blob or SVG→Canvas→PNG/JPG)
 *
 * The SVG renderer is the single source of truth.
 * HTML preview is NEVER used for exports.
 *
 * Target export dimensions: 825 × 1125 px @ 300 DPI (MakePlayingCards ready)
 */

import { slug, downloadBlob } from "./Utilities.js";
import { buildExportSvg } from "./SvgRenderer.js";
import { CARD_W, CARD_H } from "./CardRenderer.js";
import { libraryToBlob } from "./Storage.js";

// ─── SVG Export ───────────────────────────────────────────────────────────────

/**
 * Export a card as an SVG file.
 * @param {CardData} card
 */
export function exportSvg(card) {
  const svgStr = buildExportSvg(card);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, `${slug(card.name, "card")}.svg`);
}

// ─── Raster export helpers ─────────────────────────────────────────────────────

/**
 * Render a card SVG string to an HTMLCanvasElement.
 * Returns a Promise<HTMLCanvasElement> resolved once the image is drawn.
 *
 * @param {string} svgStr   The SVG markup string (no guides).
 * @returns {Promise<HTMLCanvasElement>}
 */
function svgToCanvas(svgStr) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext("2d");

    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, CARD_W, CARD_H);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG→Canvas conversion failed"));
    };
    img.src = url;
  });
}

/**
 * Export a card as a PNG file.
 * Dimensions are exactly 825 × 1125 px (300 DPI at 2.75 in × 3.75 in).
 * @param {CardData} card
 * @returns {Promise<void>}
 */
export async function exportPng(card) {
  const svgStr = buildExportSvg(card);
  const canvas = await svgToCanvas(svgStr);
  canvas.toBlob(
    (blob) => {
      if (!blob) throw new Error("PNG export failed: canvas.toBlob returned null");
      downloadBlob(blob, `${slug(card.name, "card")}.png`);
    },
    "image/png"
  );
}

/**
 * Export a card as a JPG file at quality 0.95.
 * @param {CardData} card
 * @returns {Promise<void>}
 */
export async function exportJpg(card) {
  const svgStr = buildExportSvg(card);
  const canvas = await svgToCanvas(svgStr);
  canvas.toBlob(
    (blob) => {
      if (!blob) throw new Error("JPG export failed");
      downloadBlob(blob, `${slug(card.name, "card")}.jpg`);
    },
    "image/jpeg",
    0.95
  );
}

// ─── JSON Exports ─────────────────────────────────────────────────────────────

/**
 * Export a single card as a JSON file.
 * @param {CardData} card
 */
export function exportCardJson(card) {
  const blob = new Blob([JSON.stringify(card, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `${slug(card.name, "card")}.json`);
}

/**
 * Export the full library as a JSON file.
 * @param {CardData[]} cards
 */
export function exportLibraryJson(cards) {
  downloadBlob(libraryToBlob(cards), "itw_card_library.json");
}
