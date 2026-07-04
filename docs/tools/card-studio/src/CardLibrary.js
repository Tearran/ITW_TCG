/**
 * CardLibrary.js
 * In-memory card library with CRUD, search, sort, filter and persistence hooks.
 * Fires custom DOM events on the supplied event bus (EventTarget) so the UI
 * can react without being coupled to this module.
 *
 * Events emitted:
 *   library:changed  { detail: { cards, currentIndex } }
 */

import { uuid, deepClone, str } from "./Utilities.js";
import { HistoryManager } from "./HistoryManager.js";
import { normalizeCard, saveLibraryToStorage } from "./Storage.js";

export class CardLibrary {
  /**
   * @param {EventTarget} bus  The event bus (typically `document` or a custom EventTarget).
   */
  constructor(bus) {
    this._bus = bus;
    /** @type {CardData[]} */
    this._cards = [];
    this._currentIndex = 0;
    this._history = new HistoryManager(100);
    this._searchQuery = "";
    this._filterTemplate = "";
    this._sortKey = "name"; // "name" | "rarity" | "template" | "updatedAt" | "cardNumber"
    this._sortDir = "asc";
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  /** Full unsorted/unfiltered card array. */
  get cards() {
    return this._cards;
  }

  /** Currently selected card (never null if library has at least one card). */
  get current() {
    return this._cards[this._currentIndex] ?? null;
  }

  get currentIndex() {
    return this._currentIndex;
  }

  get canUndo() {
    return this._history.canUndo();
  }

  get canRedo() {
    return this._history.canRedo();
  }

  get sortKey() {
    return this._sortKey;
  }

  // ─── Initialise ───────────────────────────────────────────────────────────

  /**
   * Load an array of raw card objects (from storage or JSON file).
   * Replaces the current library without pushing to history.
   * @param {object[]} rawCards
   */
  load(rawCards) {
    this._cards = rawCards.map(normalizeCard);
    this._currentIndex = this._cards.length ? 0 : -1;
    this._history.clear();
    this._persist();
    this._emit();
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  /** Select the card at the given absolute index in `this._cards`. */
  select(index) {
    if (index < 0 || index >= this._cards.length) return;
    this._currentIndex = index;
    this._emit();
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  /** Create a blank card, append to library, and select it. */
  newCard() {
    this._snapshot();
    const card = normalizeCard({ id: uuid(), createdAt: new Date().toISOString() });
    this._cards.push(card);
    this._currentIndex = this._cards.length - 1;
    this._persist();
    this._emit();
    return card;
  }

  /**
   * Duplicate the currently selected card.
   * @returns {CardData} The new duplicate.
   */
  duplicate() {
    if (!this.current) return null;
    this._snapshot();
    const dupe = deepClone(this.current);
    dupe.id = uuid();
    dupe.name = `${dupe.name} (copy)`;
    dupe.createdAt = new Date().toISOString();
    dupe.updatedAt = new Date().toISOString();
    this._cards.splice(this._currentIndex + 1, 0, dupe);
    this._currentIndex = this._currentIndex + 1;
    this._persist();
    this._emit();
    return dupe;
  }

  /** Delete the currently selected card. */
  deleteCurrent() {
    if (!this.current) return;
    this._snapshot();
    this._cards.splice(this._currentIndex, 1);
    this._currentIndex = Math.min(this._currentIndex, this._cards.length - 1);
    if (this._currentIndex < 0) this._currentIndex = 0;
    this._persist();
    this._emit();
  }

  /**
   * Apply a partial update to a card by id.
   * Pass in the full updated card object; this replaces the stored entry.
   * @param {CardData} updated
   */
  updateCard(updated) {
    const idx = this._cards.findIndex((c) => c.id === updated.id);
    if (idx === -1) return;
    this._snapshot();
    this._cards[idx] = { ...updated, updatedAt: new Date().toISOString() };
    this._currentIndex = idx;
    this._persist();
    this._emit();
  }

  // ─── History ──────────────────────────────────────────────────────────────

  undo() {
    const snapshot = this._history.undo({ cards: this._cards, index: this._currentIndex });
    if (!snapshot) return;
    this._cards = snapshot.cards;
    this._currentIndex = snapshot.index;
    this._persist();
    this._emit();
  }

  redo() {
    const snapshot = this._history.redo({ cards: this._cards, index: this._currentIndex });
    if (!snapshot) return;
    this._cards = snapshot.cards;
    this._currentIndex = snapshot.index;
    this._persist();
    this._emit();
  }

  // ─── Search / Sort / Filter ───────────────────────────────────────────────

  setSearch(query) {
    this._searchQuery = str(query).toLowerCase();
    this._emit();
  }

  setFilter(template) {
    this._filterTemplate = str(template).toLowerCase();
    this._emit();
  }

  setSort(key, dir = "asc") {
    this._sortKey = key;
    this._sortDir = dir;
    this._emit();
  }

  /**
   * Returns the filtered + sorted view of the library.
   * @returns {{ card: CardData, originalIndex: number }[]}
   */
  filteredView() {
    let items = this._cards.map((card, originalIndex) => ({ card, originalIndex }));

    // Filter by template
    if (this._filterTemplate) {
      items = items.filter(({ card }) =>
        card.template.toLowerCase() === this._filterTemplate
      );
    }

    // Filter by search query
    if (this._searchQuery) {
      const q = this._searchQuery;
      items = items.filter(({ card }) =>
        [card.name, card.scientificName, card.category, card.habitat,
          card.expansion, card.rarity, card.template, ...(card.tags ?? [])]
          .some((v) => String(v ?? "").toLowerCase().includes(q))
      );
    }

    // Sort
    const key = this._sortKey;
    const dir = this._sortDir === "desc" ? -1 : 1;
    items.sort(({ card: a }, { card: b }) => {
      const va = String(a[key] ?? "").toLowerCase();
      const vb = String(b[key] ?? "").toLowerCase();
      return va < vb ? -dir : va > vb ? dir : 0;
    });

    return items;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _snapshot() {
    this._history.push({ cards: deepClone(this._cards), index: this._currentIndex });
  }

  _persist() {
    saveLibraryToStorage(this._cards);
  }

  _emit() {
    this._bus.dispatchEvent(
      new CustomEvent("library:changed", {
        bubbles: true,
        detail: { cards: this._cards, currentIndex: this._currentIndex },
      })
    );
  }
}
