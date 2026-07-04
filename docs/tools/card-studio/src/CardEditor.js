/**
 * CardEditor.js
 * Manages the tabbed editor form: reads/writes card data to/from DOM inputs.
 *
 * Responsibilities:
 *  - Render tab navigation and switch active tab
 *  - Populate form fields from a CardData object
 *  - Read form fields back into a CardData object
 *  - Emit 'editor:changed' on every input so preview can re-render
 *
 * Does NOT do any DOM construction beyond what is already in index.html.
 * Does NOT persist or render SVG — those are handled by other modules.
 */

import { toInt, splitCsv, str, emit } from "./Utilities.js";
import { TEMPLATE_KEYS } from "./Templates.js";

export class CardEditor {
  /**
   * @param {EventTarget}  bus          Event bus for 'editor:changed' events.
   * @param {HTMLElement}  editorEl     The root editor panel element.
   * @param {ImageManager} imageManager The shared ImageManager instance.
   */
  constructor(bus, editorEl, imageManager) {
    this._bus = bus;
    this._root = editorEl;
    this._imgMgr = imageManager;
    this._activeTab = "general";
    this._currentCardId = null;

    this._inputs = this._queryInputs();
    this._populateStaticOptions();
    this._bindEvents();
  }

  // ─── Tab management ────────────────────────────────────────────────────────

  /**
   * Switch the active editor tab.
   * @param {"general"|"artwork"|"gameplay"|"text"|"metadata"} tabName
   */
  switchTab(tabName) {
    this._activeTab = tabName;
    this._root.querySelectorAll(".editor-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    this._root.querySelectorAll(".editor-tab-content").forEach((pane) => {
      pane.hidden = pane.dataset.tab !== tabName;
    });
  }

  // ─── Populate form from card ───────────────────────────────────────────────

  /**
   * Populate all editor fields from a CardData object.
   * @param {CardData} card
   */
  load(card) {
    this._currentCardId = card.id;
    const f = this._inputs;

    // General
    f.name.value          = card.name ?? "";
    f.scientificName.value= card.scientificName ?? "";
    f.rarity.value        = card.rarity ?? "Common";
    f.template.value      = card.template ?? "organism";
    f.category.value      = card.category ?? "";
    f.habitat.value       = card.habitat ?? "";

    // Gameplay
    f.costWater.value  = card.cost?.water ?? 0;
    f.costFlora.value  = card.cost?.flora ?? 0;
    f.costFauna.value  = card.cost?.fauna ?? 0;
    f.attack.value     = card.stats?.attack ?? 0;
    f.health.value     = card.stats?.health ?? 0;
    f.defense.value    = card.stats?.defense ?? 0;

    // Text
    f.ability.value = card.text?.ability ?? "";
    f.fact.value    = card.text?.fact ?? "";
    f.flavor.value  = card.text?.flavor ?? "";

    // Metadata
    f.expansion.value   = card.expansion ?? "";
    f.cardNumber.value  = card.cardNumber ?? "";
    f.artist.value      = card.artist ?? "";
    f.copyright.value   = card.copyright ?? "© Into the Wild TCG";
    f.tags.value        = (card.tags ?? []).join(", ");
    f.keywords.value    = (card.keywords ?? []).join(", ");
    f.notes.value       = card.notes ?? "";

    // Artwork
    this._imgMgr.fromArtworkState(card.artwork);
    this._updateArtworkDisplay();
  }

  // ─── Read form into card delta ─────────────────────────────────────────────

  /**
   * Read all editor fields and return a partial card update object.
   * Caller should merge this into the canonical card and call library.updateCard().
   * @returns {Partial<CardData>}
   */
  read() {
    const f = this._inputs;
    return {
      id:             this._currentCardId,
      name:           f.name.value.trim(),
      scientificName: f.scientificName.value.trim(),
      rarity:         f.rarity.value,
      template:       f.template.value,
      category:       f.category.value.trim(),
      habitat:        f.habitat.value.trim(),
      cost: {
        water: toInt(f.costWater.value),
        flora: toInt(f.costFlora.value),
        fauna: toInt(f.costFauna.value),
      },
      stats: {
        attack:  toInt(f.attack.value),
        health:  toInt(f.health.value),
        defense: toInt(f.defense.value),
      },
      text: {
        ability: f.ability.value.trim(),
        fact:    f.fact.value.trim(),
        flavor:  f.flavor.value.trim(),
      },
      expansion:  f.expansion.value.trim(),
      cardNumber: f.cardNumber.value.trim(),
      artist:     f.artist.value.trim(),
      copyright:  f.copyright.value.trim(),
      tags:       splitCsv(f.tags.value),
      keywords:   splitCsv(f.keywords.value),
      notes:      f.notes.value.trim(),
      artwork:    this._imgMgr.toArtworkState(),
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _queryInputs() {
    const q = (id) => this._root.querySelector(`#${id}`) ??
                      document.getElementById(id);
    return {
      name:           q("edName"),
      scientificName: q("edScientificName"),
      rarity:         q("edRarity"),
      template:       q("edTemplate"),
      category:       q("edCategory"),
      habitat:        q("edHabitat"),
      costWater:      q("edCostWater"),
      costFlora:      q("edCostFlora"),
      costFauna:      q("edCostFauna"),
      attack:         q("edAttack"),
      health:         q("edHealth"),
      defense:        q("edDefense"),
      ability:        q("edAbility"),
      fact:           q("edFact"),
      flavor:         q("edFlavor"),
      expansion:      q("edExpansion"),
      cardNumber:     q("edCardNumber"),
      artist:         q("edArtist"),
      copyright:      q("edCopyright"),
      tags:           q("edTags"),
      keywords:       q("edKeywords"),
      notes:          q("edNotes"),
      artFile:        q("edArtFile"),
      artDropZone:    q("artDropZone"),
      artZoomIn:      q("artZoomIn"),
      artZoomOut:     q("artZoomOut"),
      artReset:       q("artReset"),
      artClear:       q("artClear"),
      artZoomDisplay: q("artZoomDisplay"),
      artThumb:       q("artThumb"),
    };
  }

  _populateStaticOptions() {
    // Populate template select
    const tplSel = this._inputs.template;
    if (tplSel && tplSel.options.length === 0) {
      TEMPLATE_KEYS.forEach((key) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = key.charAt(0).toUpperCase() + key.slice(1);
        tplSel.appendChild(opt);
      });
    }
  }

  _bindEvents() {
    // Tab buttons
    this._root.querySelectorAll(".editor-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.switchTab(btn.dataset.tab));
    });

    // All text/number/select inputs trigger editor:changed
    const inputIds = Object.keys(this._inputs).filter(
      (k) => !["artFile", "artDropZone", "artZoomIn", "artZoomOut",
                "artReset", "artClear", "artZoomDisplay", "artThumb"].includes(k)
    );
    for (const key of inputIds) {
      this._inputs[key]?.addEventListener("input", () =>
        emit(this._bus, "editor:changed", null)
      );
    }

    // Artwork file chooser
    this._inputs.artFile?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await this._imgMgr.loadFile(file);
        this._updateArtworkDisplay();
        emit(this._bus, "editor:changed", null);
      } catch (err) {
        emit(this._bus, "artwork:error", { message: err.message });
      }
      e.target.value = "";
    });

    // Zoom controls
    this._inputs.artZoomIn?.addEventListener("click", () => {
      this._imgMgr.zoomIn();
      this._updateArtworkDisplay();
      emit(this._bus, "editor:changed", null);
    });
    this._inputs.artZoomOut?.addEventListener("click", () => {
      this._imgMgr.zoomOut();
      this._updateArtworkDisplay();
      emit(this._bus, "editor:changed", null);
    });
    this._inputs.artReset?.addEventListener("click", () => {
      this._imgMgr.reset();
      this._updateArtworkDisplay();
      emit(this._bus, "editor:changed", null);
    });
    this._inputs.artClear?.addEventListener("click", () => {
      this._imgMgr.clear();
      this._updateArtworkDisplay();
      emit(this._bus, "editor:changed", null);
    });

    // artwork:changed from drag/drop or paste
    this._bus.addEventListener("artwork:changed", () => {
      this._updateArtworkDisplay();
      emit(this._bus, "editor:changed", null);
    });

    // artwork:error
    this._bus.addEventListener("artwork:error", (e) => {
      alert(`Image error: ${e.detail?.message ?? "Unknown error"}`);
    });
  }

  _updateArtworkDisplay() {
    const { artZoomDisplay, artThumb } = this._inputs;
    if (artZoomDisplay) {
      artZoomDisplay.textContent = `${Math.round(this._imgMgr.zoom * 100)}%`;
    }
    if (artThumb) {
      if (this._imgMgr.dataUrl) {
        artThumb.src = this._imgMgr.dataUrl;
        artThumb.hidden = false;
      } else {
        artThumb.src = "";
        artThumb.hidden = true;
      }
    }
  }
}
