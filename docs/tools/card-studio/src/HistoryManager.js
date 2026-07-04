/**
 * HistoryManager.js
 * Generic undo/redo stack that stores deep snapshots of any serialisable state.
 *
 * Usage:
 *   const history = new HistoryManager(50); // max 50 snapshots
 *   history.push(deepClone(state));
 *   const prev = history.undo();
 *   const next = history.redo();
 */

import { deepClone } from "./Utilities.js";

export class HistoryManager {
  /**
   * @param {number} limit  Maximum number of undo states stored (default 50).
   */
  constructor(limit = 50) {
    /** @type {any[]} */
    this._past = [];
    /** @type {any[]} */
    this._future = [];
    this._limit = limit;
  }

  /** Push a new snapshot onto the undo stack. Clears the redo stack. */
  push(snapshot) {
    this._past.push(deepClone(snapshot));
    if (this._past.length > this._limit) {
      this._past.shift();
    }
    this._future = [];
  }

  /**
   * Undo: revert to the previous snapshot.
   * Requires the caller to supply the *current* snapshot so it can be put on the redo stack.
   *
   * @param {any} current  The caller's current state (before undoing).
   * @returns {any|null}   The restored snapshot, or null if nothing to undo.
   */
  undo(current) {
    if (!this.canUndo()) return null;
    this._future.push(deepClone(current));
    return deepClone(this._past.pop());
  }

  /**
   * Redo: re-apply an undone snapshot.
   * Requires the caller to supply the *current* snapshot so it can be put back on the undo stack.
   *
   * @param {any} current  The caller's current state (before redoing).
   * @returns {any|null}   The restored snapshot, or null if nothing to redo.
   */
  redo(current) {
    if (!this.canRedo()) return null;
    this._past.push(deepClone(current));
    return deepClone(this._future.pop());
  }

  /** @returns {boolean} */
  canUndo() {
    return this._past.length > 0;
  }

  /** @returns {boolean} */
  canRedo() {
    return this._future.length > 0;
  }

  /** Wipe all history. */
  clear() {
    this._past = [];
    this._future = [];
  }

  /** Serialise for persistence (e.g. localStorage). */
  toJSON() {
    return { past: this._past, future: this._future };
  }

  /** Restore from a previously serialised object. */
  fromJSON(obj) {
    this._past = Array.isArray(obj?.past) ? obj.past : [];
    this._future = Array.isArray(obj?.future) ? obj.future : [];
  }
}
