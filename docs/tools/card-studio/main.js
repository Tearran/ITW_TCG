/**
 * main.js
 * Application bootstrap and top-level event wiring.
 *
 * Instantiates all modules, wires events, and drives the live preview cycle.
 * Loaded as type="module" from index.html.
 */

import { CardLibrary }    from "./src/CardLibrary.js";
import { CardEditor }     from "./src/CardEditor.js";
import { ImageManager }   from "./src/ImageManager.js";
import { buildPreviewSvg } from "./src/SvgRenderer.js";
import {
  exportSvg, exportPng, exportJpg,
  exportCardJson, exportLibraryJson,
} from "./src/ExportManager.js";
import { loadLibraryFromStorage, loadPrefs, savePrefs, parseJsonFile, normalizeCard } from "./src/Storage.js";
import { SAMPLE_CARDS }   from "./src/SampleCards.js";
import { deepClone }      from "./src/Utilities.js";

// ─── Module instances ────────────────────────────────────────────────────────

/** Shared event bus — use document to allow cross-module bubbling. */
const bus = document.createElement("div");
document.body.appendChild(bus);

const library = new CardLibrary(bus);
const imgMgr  = new ImageManager(bus, document.getElementById("artDropZone"));
const editor  = new CardEditor(bus, document.getElementById("editorPanel"), imgMgr);

// ─── Prefs state ──────────────────────────────────────────────────────────────

let prefs = loadPrefs();

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const previewContainer  = document.getElementById("previewContainer");
const previewZoomRange  = document.getElementById("previewZoomRange");
const previewZoomLabel  = document.getElementById("previewZoomLabel");
const printSizeLabel    = document.getElementById("printSizeLabel");
const guideBleedToggle  = document.getElementById("guideBleed");
const guideTrimToggle   = document.getElementById("guideTrim");
const guideSafeToggle   = document.getElementById("guideSafe");

const libraryListEl     = document.getElementById("libraryList");
const searchInput       = document.getElementById("searchInput");
const filterSelect      = document.getElementById("filterTemplate");
const sortSelect        = document.getElementById("sortKey");
const sortDirBtn        = document.getElementById("sortDirBtn");

const btnNew            = document.getElementById("btnNew");
const btnDuplicate      = document.getElementById("btnDuplicate");
const btnDelete         = document.getElementById("btnDelete");
const btnUndo           = document.getElementById("btnUndo");
const btnRedo           = document.getElementById("btnRedo");
const btnExportSvg      = document.getElementById("btnExportSvg");
const btnExportPng      = document.getElementById("btnExportPng");
const btnExportJpg      = document.getElementById("btnExportJpg");
const btnExportCardJson = document.getElementById("btnExportCardJson");
const btnExportLibrary  = document.getElementById("btnExportLibrary");
const loadLibraryInput  = document.getElementById("loadLibraryInput");
const toastEl           = document.getElementById("toast");

// ─── Preview rendering ────────────────────────────────────────────────────────

let _previewDebounceTimer = null;

function schedulePreviewUpdate() {
  clearTimeout(_previewDebounceTimer);
  _previewDebounceTimer = setTimeout(renderPreview, 60);
}

function renderPreview() {
  const card = library.current;
  if (!card) {
    previewContainer.innerHTML = `<p class="preview-empty">No card selected.</p>`;
    return;
  }

  // Merge live editor state into card without persisting yet
  const liveCard = { ...deepClone(card), ...editor.read() };

  const svgStr = buildPreviewSvg(liveCard, {
    bleed: prefs.showBleedGuide,
    trim:  prefs.showTrimGuide,
    safe:  prefs.showSafeGuide,
  });

  // Inject as <img> using a blob URL for correct SVG rendering in browsers
  const blob = new Blob([svgStr], { type: "image/svg+xml" });
  const url  = URL.createObjectURL(blob);
  const zoom = prefs.previewZoom;

  previewContainer.innerHTML = "";
  const img = document.createElement("img");
  img.alt    = `${liveCard.name || "Card"} preview`;
  img.src    = url;
  img.style.width  = `${825 * zoom}px`;
  img.style.height = `${1125 * zoom}px`;
  img.onload = () => URL.revokeObjectURL(url);
  previewContainer.appendChild(img);

  if (printSizeLabel) printSizeLabel.textContent = `825 × 1125 px @ 300 DPI`;
}

// ─── Library list rendering ───────────────────────────────────────────────────

function renderLibraryList() {
  const view = library.filteredView();
  libraryListEl.innerHTML = "";

  // Update card count badge
  const libCount = document.getElementById("libCount");
  if (libCount) libCount.textContent = `${library.cards.length} card${library.cards.length !== 1 ? "s" : ""}`;

  if (!view.length) {
    libraryListEl.innerHTML = `<li class="lib-empty">No cards found.</li>`;
    return;
  }

  view.forEach(({ card, originalIndex }) => {
    const li = document.createElement("li");
    li.className = "lib-item";
    if (originalIndex === library.currentIndex) li.classList.add("active");
    li.dataset.index = originalIndex;

    li.innerHTML = `
      <span class="lib-name">${escHtml(card.name || "(unnamed)")}</span>
      <span class="lib-meta">${escHtml(card.template)} · ${escHtml(card.rarity)}</span>`;

    li.addEventListener("click", () => {
      // Persist current edits before switching
      commitCurrentEdits();
      library.select(originalIndex);
    });
    libraryListEl.appendChild(li);
  });

  // Update undo/redo buttons
  if (btnUndo) btnUndo.disabled = !library.canUndo;
  if (btnRedo) btnRedo.disabled = !library.canRedo;
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Commit editor changes back to library ───────────────────────────────────

function commitCurrentEdits() {
  const card = library.current;
  if (!card) return;
  const updated = { ...deepClone(card), ...editor.read() };
  library.updateCard(updated);
}

// ─── Guide toggles ────────────────────────────────────────────────────────────

function syncGuideToggles() {
  if (guideBleedToggle) guideBleedToggle.checked = prefs.showBleedGuide;
  if (guideTrimToggle)  guideTrimToggle.checked  = prefs.showTrimGuide;
  if (guideSafeToggle)  guideSafeToggle.checked  = prefs.showSafeGuide;
}

// ─── Preview zoom ─────────────────────────────────────────────────────────────

function syncZoomUI() {
  if (previewZoomRange) previewZoomRange.value = prefs.previewZoom;
  if (previewZoomLabel) previewZoomLabel.textContent = `${Math.round(prefs.previewZoom * 100)}%`;
}

// ─── Toast notifications ──────────────────────────────────────────────────────

let _toastTimer = null;
function showToast(message, type = "info") {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className   = `toast toast--${type} toast--visible`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toastEl.classList.remove("toast--visible"), 3000);
}

// ─── Event handlers ───────────────────────────────────────────────────────────

function bindEvents() {
  // Library events
  bus.addEventListener("library:changed", () => {
    const card = library.current;
    if (card) editor.load(card);
    renderLibraryList();
    schedulePreviewUpdate();
  });

  // Editor input → live preview
  bus.addEventListener("editor:changed", () => {
    schedulePreviewUpdate();
  });

  // Search / filter / sort
  searchInput?.addEventListener("input", () => {
    library.setSearch(searchInput.value);
  });
  filterSelect?.addEventListener("change", () => {
    library.setFilter(filterSelect.value);
  });
  sortSelect?.addEventListener("change", () => {
    library.setSort(sortSelect.value, library._sortDir);
  });

  let _sortDir = "asc";
  sortDirBtn?.addEventListener("click", () => {
    _sortDir = _sortDir === "asc" ? "desc" : "asc";
    sortDirBtn.textContent = _sortDir === "asc" ? "↑ ASC" : "↓ DESC";
    library.setSort(library.sortKey, _sortDir);
  });

  // Card CRUD
  btnNew?.addEventListener("click", () => {
    commitCurrentEdits();
    library.newCard();
    editor.switchTab("general");
    showToast("New card created.", "success");
  });
  btnDuplicate?.addEventListener("click", () => {
    commitCurrentEdits();
    library.duplicate();
    showToast("Card duplicated.", "success");
  });
  btnDelete?.addEventListener("click", () => {
    if (!library.current) return;
    const name = library.current.name || "this card";
    if (!confirm(`Delete "${name}"?`)) return;
    library.deleteCurrent();
    showToast("Card deleted.", "info");
  });
  btnUndo?.addEventListener("click", () => {
    library.undo();
    showToast("Undo.", "info");
  });
  btnRedo?.addEventListener("click", () => {
    library.redo();
    showToast("Redo.", "info");
  });

  // Exports
  btnExportSvg?.addEventListener("click", () => {
    commitCurrentEdits();
    const card = library.current;
    if (!card) return;
    try { exportSvg(card); showToast("SVG exported.", "success"); }
    catch (e) { showToast(`SVG export failed: ${e.message}`, "error"); }
  });

  btnExportPng?.addEventListener("click", async () => {
    commitCurrentEdits();
    const card = library.current;
    if (!card) return;
    btnExportPng.disabled = true;
    try {
      await exportPng(card);
      showToast("PNG exported.", "success");
    } catch (e) {
      showToast(`PNG export failed: ${e.message}`, "error");
    } finally {
      btnExportPng.disabled = false;
    }
  });

  btnExportJpg?.addEventListener("click", async () => {
    commitCurrentEdits();
    const card = library.current;
    if (!card) return;
    btnExportJpg.disabled = true;
    try {
      await exportJpg(card);
      showToast("JPG exported.", "success");
    } catch (e) {
      showToast(`JPG export failed: ${e.message}`, "error");
    } finally {
      btnExportJpg.disabled = false;
    }
  });

  btnExportCardJson?.addEventListener("click", () => {
    commitCurrentEdits();
    const card = library.current;
    if (!card) return;
    exportCardJson(card);
    showToast("Card JSON exported.", "success");
  });

  btnExportLibrary?.addEventListener("click", () => {
    commitCurrentEdits();
    exportLibraryJson(library.cards);
    showToast(`Library (${library.cards.length} cards) exported.`, "success");
  });

  // Load library JSON
  loadLibraryInput?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const allCards = [];
    for (const file of files) {
      try {
        const data = await parseJsonFile(file);
        const incoming = Array.isArray(data) ? data : [data];
        allCards.push(...incoming.map(normalizeCard));
      } catch (err) {
        showToast(`Failed to load ${file.name}: ${err.message}`, "error");
      }
    }
    if (allCards.length) {
      if (library.cards.length > 0) {
        if (!confirm(`Replace current library (${library.cards.length} cards) with loaded data?`)) return;
      }
      library.load(allCards);
      showToast(`Loaded ${allCards.length} card(s).`, "success");
    }
    e.target.value = "";
  });

  // Guide toggles
  guideBleedToggle?.addEventListener("change", () => {
    prefs.showBleedGuide = guideBleedToggle.checked;
    savePrefs(prefs);
    schedulePreviewUpdate();
  });
  guideTrimToggle?.addEventListener("change", () => {
    prefs.showTrimGuide = guideTrimToggle.checked;
    savePrefs(prefs);
    schedulePreviewUpdate();
  });
  guideSafeToggle?.addEventListener("change", () => {
    prefs.showSafeGuide = guideSafeToggle.checked;
    savePrefs(prefs);
    schedulePreviewUpdate();
  });

  // Preview zoom
  previewZoomRange?.addEventListener("input", () => {
    prefs.previewZoom = parseFloat(previewZoomRange.value);
    savePrefs(prefs);
    syncZoomUI();
    schedulePreviewUpdate();
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      if (e.key === "z") { e.preventDefault(); library.undo(); }
      if (e.key === "y") { e.preventDefault(); library.redo(); }
      if (e.key === "s") {
        e.preventDefault();
        commitCurrentEdits();
        showToast("Auto-saved to library.", "success");
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Z") {
      e.preventDefault();
      library.redo();
    }
  });

  // Auto-save on blur / visibility change
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") commitCurrentEdits();
  });
}

// ─── Init ──────────────────────────────────────────────────────────────────────

function init() {
  // Restore prefs
  syncGuideToggles();
  syncZoomUI();

  // Load library from LocalStorage, or use sample cards
  const stored = loadLibraryFromStorage();
  if (stored.length > 0) {
    library.load(stored);
  } else {
    library.load(SAMPLE_CARDS);
  }

  // Populate filter select with template options
  if (filterSelect) {
    const allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = "All templates";
    filterSelect.appendChild(allOpt);
    ["organism", "resource", "weather", "landmark", "cataclysm", "biome"].forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      filterSelect.appendChild(opt);
    });
  }

  bindEvents();
  renderLibraryList();
  if (library.current) editor.load(library.current);
  schedulePreviewUpdate();

  console.info("[ITW Card Studio] Ready.");
}

init();
