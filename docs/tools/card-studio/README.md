# Into the Wild Card Studio

**Offline, print-ready trading card design tool for Into the Wild TCG.**

> Run locally by opening `index.html`. No server, no npm, no build step.

---

## Quick Start

1. Open `docs/tools/card-studio/index.html` in any modern browser.
2. Sample cards are pre-loaded on first launch.
3. Select a card in the left panel, edit it in the centre, and see the live preview on the right.
4. Use the **Export** buttons to download SVG, PNG, JPG, or JSON.

---

## Print Specifications

| Zone         | Size (px)     | Notes                          |
|:-------------|:--------------|:-------------------------------|
| **Bleed**    | 825 × 1125    | Full export canvas (MPC ready) |
| **Trim**     | 750 × 1050    | Final cut line                 |
| **Safe area**| 675 × 975     | Keep all critical content here |

All exported PNGs and JPGs are exactly **825 × 1125 px** and can be uploaded directly to [MakePlayingCards](https://www.makeplayingcards.com/) without resizing.

Guide overlays (Bleed / Trim / Safe) are visible in the live preview only — they are **never** included in exported files.

---

## Data Model

Every card is a plain JSON object:

```json
{
  "id": "uuid",
  "name": "Saguaro",
  "scientificName": "Carnegiea gigantea",
  "rarity": "Uncommon",
  "template": "organism",
  "category": "Flora — Succulent",
  "habitat": "Sonoran Desert",
  "expansion": "ITW-A",
  "cardNumber": "027",
  "artist": "ITW Studio",
  "copyright": "© Into the Wild TCG",
  "cost":  { "water": 2, "flora": 1, "fauna": 0 },
  "stats": { "attack": 0, "health": 5, "defense": 1 },
  "text":  { "ability": "...", "fact": "...", "flavor": "..." },
  "artwork": { "dataUrl": null, "zoom": 1, "panX": 0, "panY": 0 },
  "tags": ["flora", "cactus"],
  "keywords": ["Thorns"],
  "notes": "Internal note (not printed)",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

---

## Templates

| Key         | Purpose                         |
|:------------|:--------------------------------|
| `organism`  | Creatures — Flora, Fauna, Fungi |
| `resource`  | Bio-Energy sources              |
| `weather`   | Seasonal / storm events         |
| `landmark`  | Named locations                 |
| `cataclysm` | Large-scale disaster events     |
| `biome`     | Habitat zone modifiers          |

Templates are registered in `src/SvgRenderer.js → TEMPLATE_REGISTRY`. Adding a new template requires only adding one entry to that object — no changes to renderer logic.

---

## Module Responsibilities

| File                  | Responsibility                                                          |
|:----------------------|:------------------------------------------------------------------------|
| `src/Utilities.js`    | Pure helpers: uuid, clamp, escapeXml, wrapText, downloadBlob, etc.     |
| `src/Storage.js`      | LocalStorage read/write, JSON file I/O, card schema normalisation       |
| `src/HistoryManager.js` | Generic undo/redo stack using deep snapshots                          |
| `src/CardLibrary.js`  | In-memory card CRUD, search, sort, filter, persistence, history         |
| `src/CardRenderer.js` | Component-based SVG renderer (one function per card section)           |
| `src/SvgRenderer.js`  | Template registry, guide overlay, export vs. preview SVG build         |
| `src/ExportManager.js`| SVG/PNG/JPG/JSON file downloads; SVG→Canvas raster pipeline            |
| `src/ImageManager.js` | Image ingestion (file/drag/paste), zoom/pan state, artwork transforms  |
| `src/CardEditor.js`   | Tabbed editor form ↔ card data synchronisation                         |
| `src/SampleCards.js`  | Starter card data (one per template)                                   |
| `main.js`             | App bootstrap, event wiring, preview rendering loop                    |
| `index.html`          | Three-column app shell (library / editor / preview)                    |
| `styles.css`          | Desktop-first dark-theme UI stylesheet                                 |

---

## Rendering Pipeline

```
Card JSON
   ↓
CardRenderer.js   (component-based SVG sections)
   ↓
SVG string (export)  ←── SvgRenderer.buildExportSvg()
   ↓                                ↓
Guide overlay added            No guides
(preview only)
   ↓
<img src="blob:…">         SVG file download
                           SVG → Canvas → PNG/JPG download
```

The SVG renderer is the **single source of truth**. The HTML preview is never exported.

---

## Image System

- **Supported formats:** PNG, JPG, WEBP, SVG
- **Input methods:** File chooser · Drag & drop · Paste from clipboard
- **No URL loading** — all imagery stays local
- **Controls:** Zoom in/out (5% steps, 10%–500%), Pan (via transform offsets), Reset

Image data is stored as a base64 data URL inside the card JSON so the entire library can be serialised to a single JSON file.

---

## Keyboard Shortcuts

| Shortcut      | Action            |
|:--------------|:------------------|
| `Ctrl/⌘ Z`   | Undo              |
| `Ctrl/⌘ Y`   | Redo              |
| `Ctrl/⌘ ⇧ Z` | Redo (alternate)  |
| `Ctrl/⌘ S`   | Commit + auto-save|

---

## Exports

| Format        | File             | Notes                                       |
|:--------------|:-----------------|:--------------------------------------------|
| SVG           | `<name>.svg`     | Vector, infinitely scalable                 |
| PNG           | `<name>.png`     | 825×1125 px, MakePlayingCards ready          |
| JPG           | `<name>.jpg`     | 825×1125 px, quality 0.95                   |
| Card JSON     | `<name>.json`    | Single card data object                     |
| Library JSON  | `itw_card_library.json` | Full card array                    |

PDF export and print sheets are architecturally supported (SVG→Canvas base exists) but not yet implemented.

---

## Persistence

- The full library is **auto-saved to LocalStorage** after every change.
- Use **Save Library** to download a JSON backup.
- Use **Load Library** to restore from a JSON file (replaces current library after confirmation).

---

## GitHub Pages

The studio is deployed as a static sub-path of the docs site:

```
https://tearran.github.io/ITW_TCG/tools/card-studio/
```

All asset paths are relative so no path configuration is needed.
