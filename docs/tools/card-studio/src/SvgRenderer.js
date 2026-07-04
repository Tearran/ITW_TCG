/**
 * SvgRenderer.js
 * Owns the SVG build pipeline for both preview (with guide overlays) and export.
 *
 * Guide overlays are rendered only for live preview — they are NEVER included
 * in any exported SVG/PNG/JPG.
 *
 * Card canvas: 825 × 1125 px (bleed)
 * Trim:        750 × 1050 px  (origin 37.5, 37.5)
 * Safe:        675 ×  975 px  (origin 75, 75)
 */

import { renderCard, CARD_W, CARD_H } from "./CardRenderer.js";
export { TEMPLATE_REGISTRY, TEMPLATE_KEYS } from "./Templates.js";

// ─── Guide constants ──────────────────────────────────────────────────────────

const TRIM_X = 37.5;
const TRIM_Y = 37.5;
const TRIM_W = 750;
const TRIM_H = 1050;
const SAFE_X = 75;
const SAFE_Y = 75;
const SAFE_W = 675;
const SAFE_H = 975;

// ─── Guide overlay renderer ───────────────────────────────────────────────────

/**
 * Build the SVG guide overlay string.
 * This is appended to preview SVG only — never to exported SVG.
 *
 * @param {{ bleed: boolean, trim: boolean, safe: boolean }} opts
 * @returns {string}
 */
function buildGuideOverlay({ bleed, trim, safe }) {
  let g = `<g id="guide-overlay" pointer-events="none">`;

  if (bleed) {
    // Bleed edge = full card boundary
    g += `
    <rect x="1" y="1" width="${CARD_W - 2}" height="${CARD_H - 2}"
          fill="none" stroke="#FF6B6B" stroke-width="1.5"
          stroke-dasharray="8 4" opacity="0.9"/>
    <text x="6" y="16" font-family="Arial,sans-serif" font-size="11"
          fill="#FF6B6B" opacity="0.9">BLEED 825×1125</text>`;
  }

  if (trim) {
    g += `
    <rect x="${TRIM_X}" y="${TRIM_Y}" width="${TRIM_W}" height="${TRIM_H}"
          fill="none" stroke="#FBBF24" stroke-width="1.5"
          stroke-dasharray="6 3" opacity="0.9"/>
    <text x="${TRIM_X + 4}" y="${TRIM_Y + 14}" font-family="Arial,sans-serif"
          font-size="11" fill="#FBBF24" opacity="0.9">TRIM 750×1050</text>`;
  }

  if (safe) {
    g += `
    <rect x="${SAFE_X}" y="${SAFE_Y}" width="${SAFE_W}" height="${SAFE_H}"
          fill="none" stroke="#34D399" stroke-width="1.5"
          stroke-dasharray="4 4" opacity="0.9"/>
    <text x="${SAFE_X + 4}" y="${SAFE_Y + 14}" font-family="Arial,sans-serif"
          font-size="11" fill="#34D399" opacity="0.9">SAFE 675×975</text>`;
  }

  g += `</g>`;
  return g;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Produce an SVG string suitable for EXPORT (no guides).
 * @param {CardData} card
 * @returns {string}
 */
export function buildExportSvg(card) {
  return renderCard(card);
}

/**
 * Produce an SVG string suitable for PREVIEW (includes optional guide overlays).
 * @param {CardData} card
 * @param {{ bleed?: boolean, trim?: boolean, safe?: boolean }} guideOptions
 * @returns {string}
 */
export function buildPreviewSvg(card, guideOptions = {}) {
  const base = renderCard(card);
  const hasGuides = guideOptions.bleed || guideOptions.trim || guideOptions.safe;
  if (!hasGuides) return base;

  // Insert guide overlay just before closing </svg>
  const closeTag = "</svg>";
  const insertAt = base.lastIndexOf(closeTag);
  if (insertAt === -1) return base;

  const overlay = buildGuideOverlay({
    bleed: !!guideOptions.bleed,
    trim: !!guideOptions.trim,
    safe: !!guideOptions.safe,
  });

  return base.slice(0, insertAt) + "\n" + overlay + "\n" + closeTag;
}
