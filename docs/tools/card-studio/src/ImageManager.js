/**
 * ImageManager.js
 * Manages local-only image ingestion and artwork state for a card.
 *
 * Supported input methods: file chooser, drag & drop, paste from clipboard.
 * Supported formats: PNG, JPG, WEBP, SVG.
 * No URL loading — everything is local data URLs.
 *
 * Exposes artwork transform state (zoom, pan) and emits 'artwork:changed'
 * on the supplied event bus so the preview can re-render.
 */

import { readFileAsDataURL, clamp, emit } from "./Utilities.js";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.05;

export class ImageManager {
  /**
   * @param {EventTarget} bus          Event bus for 'artwork:changed' events.
   * @param {HTMLElement}  dropZone    Element that accepts drag & drop.
   */
  constructor(bus, dropZone) {
    this._bus = bus;
    this._dropZone = dropZone;

    /** @type {string|null} Base64 data URL of current artwork. */
    this.dataUrl = null;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;

    // Pan drag state
    this._dragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._panStartX = 0;
    this._panStartY = 0;

    this._bindDropZone();
    this._bindPasteListener();
  }

  // ─── Load from file ────────────────────────────────────────────────────────

  /**
   * Load artwork from a File object.
   * @param {File} file
   * @returns {Promise<void>}
   */
  async loadFile(file) {
    if (!this._isAccepted(file.type)) {
      throw new Error(`Unsupported image type: ${file.type}. Use PNG, JPG, WEBP, or SVG.`);
    }
    this.dataUrl = await readFileAsDataURL(file);
    this.reset();
  }

  // ─── Transform controls ───────────────────────────────────────────────────

  /** Zoom in by one step. */
  zoomIn() {
    this.zoom = clamp(parseFloat((this.zoom + ZOOM_STEP).toFixed(3)), ZOOM_MIN, ZOOM_MAX);
    this._emit();
  }

  /** Zoom out by one step. */
  zoomOut() {
    this.zoom = clamp(parseFloat((this.zoom - ZOOM_STEP).toFixed(3)), ZOOM_MIN, ZOOM_MAX);
    this._emit();
  }

  /**
   * Set zoom to an explicit value.
   * @param {number} value
   */
  setZoom(value) {
    this.zoom = clamp(value, ZOOM_MIN, ZOOM_MAX);
    this._emit();
  }

  /** Reset zoom and pan to defaults. */
  reset() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this._emit();
  }

  /** Clear the current artwork entirely. */
  clear() {
    this.dataUrl = null;
    this.reset();
  }

  // ─── Apply to card artwork field ─────────────────────────────────────────

  /**
   * Return the current artwork state object for embedding in a CardData.artwork field.
   * @returns {{ dataUrl: string|null, zoom: number, panX: number, panY: number }}
   */
  toArtworkState() {
    return {
      dataUrl: this.dataUrl,
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
    };
  }

  /**
   * Load artwork state from a CardData.artwork object.
   * @param {{ dataUrl?: string|null, zoom?: number, panX?: number, panY?: number }} artwork
   */
  fromArtworkState(artwork) {
    this.dataUrl = artwork?.dataUrl ?? null;
    this.zoom = artwork?.zoom ?? 1;
    this.panX = artwork?.panX ?? 0;
    this.panY = artwork?.panY ?? 0;
    // No emit — caller controls refresh
  }

  // ─── Pan drag (for preview canvas) ───────────────────────────────────────

  /**
   * Start a pan drag gesture (call on pointerdown).
   * @param {number} clientX
   * @param {number} clientY
   */
  startDrag(clientX, clientY) {
    this._dragging = true;
    this._dragStartX = clientX;
    this._dragStartY = clientY;
    this._panStartX = this.panX;
    this._panStartY = this.panY;
  }

  /**
   * Update pan during drag (call on pointermove).
   * @param {number} clientX
   * @param {number} clientY
   */
  moveDrag(clientX, clientY) {
    if (!this._dragging) return;
    this.panX = this._panStartX + (clientX - this._dragStartX);
    this.panY = this._panStartY + (clientY - this._dragStartY);
    this._emit();
  }

  /** End a pan drag gesture. */
  endDrag() {
    this._dragging = false;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _isAccepted(mimeType) {
    return ACCEPTED_TYPES.includes(mimeType);
  }

  _bindDropZone() {
    if (!this._dropZone) return;

    this._dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      this._dropZone.classList.add("drag-over");
    });

    this._dropZone.addEventListener("dragleave", () => {
      this._dropZone.classList.remove("drag-over");
    });

    this._dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      this._dropZone.classList.remove("drag-over");
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        try {
          await this.loadFile(file);
        } catch (err) {
          emit(this._bus, "artwork:error", { message: err.message });
        }
      }
    });
  }

  _bindPasteListener() {
    document.addEventListener("paste", async (e) => {
      const items = e.clipboardData?.items ?? [];
      for (const item of items) {
        if (item.kind === "file" && this._isAccepted(item.type)) {
          const file = item.getAsFile();
          if (file) {
            try {
              await this.loadFile(file);
            } catch (err) {
              emit(this._bus, "artwork:error", { message: err.message });
            }
          }
          break;
        }
      }
    });
  }

  _emit() {
    emit(this._bus, "artwork:changed", this.toArtworkState());
  }
}
