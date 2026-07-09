"use strict";

/* =========================
   Constants / Defaults
========================= */
const DEFAULT_CATEGORIES = [
  "Water Resource",
  "Flora Resource",
  "Fauna Resource",
  "Herbivore",
  "Omnivore",
  "Predator",
  "Apex Predator",
  "Plant",
  "Environmental Instance",
  "Weather",
  "Cataclysm",
  "Landmark",
  "Terrain"
];

const DEFAULT_CARD = {
  id: crypto.randomUUID ? crypto.randomUUID() : `card_${Date.now()}`,
  name: "Greater Roadrunner",
  scientificName: "Geococcyx californianus",
  cardNumber: "001/180",
  expansion: "ITW-Base",
  rarity: "Common",
  category: "Predator",
  habitat: "Sonoran Desert",
  artist: "",
  illustration: {
    type: "path",   // path | url | local
    value: "images/greater_roadrunner.png"
  },
  cost: { water: 1, flora: 0, fauna: 1 },
  stats: { attack: 3, health: 2, defense: 0 },
  text: {
    ability: "Deals double damage to Lizard organisms.",
    fact: "Can reach speeds of approximately 20 mph.",
    flavor: ""
  },
  tags: [],
  keywords: [],
  notes: "",
  template: "organism",
  version: 1
};

/* =========================
   App State
========================= */
const state = {
  cards: [structuredClone(DEFAULT_CARD)],
  currentIndex: 0,
  localImageDataUrl: null,
  categories: [...DEFAULT_CATEGORIES]
};

/* =========================
   DOM Refs
========================= */
const el = {
  form: document.getElementById("cardForm"),

  // General
  name: document.getElementById("name"),
  scientificName: document.getElementById("scientificName"),
  cardNumber: document.getElementById("cardNumber"),
  expansion: document.getElementById("expansion"),
  rarity: document.getElementById("rarity"),
  category: document.getElementById("category"),
  customCategory: document.getElementById("customCategory"),
  habitat: document.getElementById("habitat"),
  artist: document.getElementById("artist"),

  // Illustration
  illustrationType: document.getElementById("illustrationType"),
  illustrationValue: document.getElementById("illustrationValue"),
  illustrationFile: document.getElementById("illustrationFile"),

  // Cost
  costWater: document.getElementById("costWater"),
  costFlora: document.getElementById("costFlora"),
  costFauna: document.getElementById("costFauna"),

  // Stats
  attack: document.getElementById("attack"),
  health: document.getElementById("health"),
  defense: document.getElementById("defense"),

  // Text
  ability: document.getElementById("ability"),
  fact: document.getElementById("fact"),
  flavor: document.getElementById("flavor"),

  // Optional
  tags: document.getElementById("tags"),
  keywords: document.getElementById("keywords"),
  notes: document.getElementById("notes"),
  template: document.getElementById("template"),

  // Actions
  newCardBtn: document.getElementById("newCardBtn"),
  duplicateCardBtn: document.getElementById("duplicateCardBtn"),
  deleteCardBtn: document.getElementById("deleteCardBtn"),
  saveCurrentJsonBtn: document.getElementById("saveCurrentJsonBtn"),
  saveLibraryJsonBtn: document.getElementById("saveLibraryJsonBtn"),
  loadJsonInput: document.getElementById("loadJsonInput"),
  exportSvgBtn: document.getElementById("exportSvgBtn"),
  exportPngBtn: document.getElementById("exportPngBtn"),
  printBtn: document.getElementById("printBtn"),

  // Library
  searchInput: document.getElementById("searchInput"),
  libraryList: document.getElementById("libraryList"),

  // Preview stage
  cardStage: document.getElementById("cardStage")
};

/* =========================
   Utility
========================= */
function n(v) {
  const x = Number.parseInt(v, 10);
  return Number.isNaN(x) || x < 0 ? 0 : x;
}
function txt(v, fallback = "") {
  return v === null || v === undefined ? fallback : String(v);
}
function escapeXml(str) {
  return txt(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function slug(v, fallback = "card") {
  return txt(v, fallback)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;
}
function setText(node, value) {
  if (node) node.textContent = value;
}
function splitCsv(value) {
  return txt(value)
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}
function normalizeCard(raw) {
  const card = structuredClone(DEFAULT_CARD);

  card.id = txt(raw.id, card.id);
  card.name = txt(raw.name, "");
  card.scientificName = txt(raw.scientificName, "");
  card.cardNumber = txt(raw.cardNumber, "");
  card.expansion = txt(raw.expansion, "");
  card.rarity = txt(raw.rarity, "Common");
  card.category = txt(raw.category, "Predator");
  card.habitat = txt(raw.habitat, "");
  card.artist = txt(raw.artist, "");

  card.illustration = {
    type: txt(raw.illustration?.type, "path"),
    value: txt(raw.illustration?.value, "")
  };

  card.cost = {
    water: n(raw.cost?.water),
    flora: n(raw.cost?.flora),
    fauna: n(raw.cost?.fauna)
  };

  card.stats = {
    attack: n(raw.stats?.attack),
    health: n(raw.stats?.health),
    defense: n(raw.stats?.defense)
  };

  card.text = {
    ability: txt(raw.text?.ability, ""),
    fact: txt(raw.text?.fact, ""),
    flavor: txt(raw.text?.flavor, "")
  };

  card.tags = Array.isArray(raw.tags) ? raw.tags.map(x => txt(x)).filter(Boolean) : [];
  card.keywords = Array.isArray(raw.keywords) ? raw.keywords.map(x => txt(x)).filter(Boolean) : [];
  card.notes = txt(raw.notes, "");
  card.template = txt(raw.template, "organism");
  card.version = Number.isFinite(raw.version) ? raw.version : 1;

  return card;
}
function currentCard() {
  return state.cards[state.currentIndex];
}
function wrapText(str, maxChars, maxLines) {
  const words = txt(str).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (!word) continue;
    if (!current) {
      current = word;
    } else if ((current + " " + word).length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      if (lines.length >= maxLines) { current = ""; break; }
      current = word;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  while (lines.length < maxLines) lines.push("");
  return lines;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =========================
   Categories
========================= */
function renderCategoryOptions() {
  const current = currentCard()?.category || "";
  el.category.innerHTML = "";

  state.categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    el.category.appendChild(opt);
  });

  // ensure current card category exists in list
  if (current && !state.categories.includes(current)) {
    state.categories.push(current);
    const opt = document.createElement("option");
    opt.value = current;
    opt.textContent = current;
    el.category.appendChild(opt);
  }

  el.category.value = current || state.categories[0];
}

/* =========================
   Form <-> State
========================= */
function populateFormFromCard(card) {
  el.name.value = card.name;
  el.scientificName.value = card.scientificName;
  el.cardNumber.value = card.cardNumber;
  el.expansion.value = card.expansion;
  el.rarity.value = card.rarity;
  el.habitat.value = card.habitat;
  el.artist.value = card.artist;

  renderCategoryOptions();
  el.customCategory.value = "";

  el.illustrationType.value = card.illustration.type;
  el.illustrationValue.value = card.illustration.value;
  el.illustrationFile.value = "";

  el.costWater.value = card.cost.water;
  el.costFlora.value = card.cost.flora;
  el.costFauna.value = card.cost.fauna;

  el.attack.value = card.stats.attack;
  el.health.value = card.stats.health;
  el.defense.value = card.stats.defense;

  el.ability.value = card.text.ability;
  el.fact.value = card.text.fact;
  el.flavor.value = card.text.flavor;

  el.tags.value = card.tags.join(", ");
  el.keywords.value = card.keywords.join(", ");
  el.notes.value = card.notes;
  el.template.value = card.template;
}

function readCardFromForm() {
  const card = currentCard();

  const customCategory = txt(el.customCategory.value).trim();
  const selectedCategory = txt(el.category.value).trim();
  const finalCategory = customCategory || selectedCategory || "Predator";

  if (customCategory && !state.categories.includes(customCategory)) {
    state.categories.push(customCategory);
    renderCategoryOptions();
    el.category.value = customCategory;
  }

  card.name = txt(el.name.value);
  card.scientificName = txt(el.scientificName.value);
  card.cardNumber = txt(el.cardNumber.value);
  card.expansion = txt(el.expansion.value);
  card.rarity = txt(el.rarity.value);
  card.category = finalCategory;
  card.habitat = txt(el.habitat.value);
  card.artist = txt(el.artist.value);

  card.illustration.type = txt(el.illustrationType.value, "path");
  card.illustration.value = txt(el.illustrationValue.value);

  card.cost.water = n(el.costWater.value);
  card.cost.flora = n(el.costFlora.value);
  card.cost.fauna = n(el.costFauna.value);

  card.stats.attack = n(el.attack.value);
  card.stats.health = n(el.health.value);
  card.stats.defense = n(el.defense.value);

  card.text.ability = txt(el.ability.value);
  card.text.fact = txt(el.fact.value);
  card.text.flavor = txt(el.flavor.value);

  card.tags = splitCsv(el.tags.value);
  card.keywords = splitCsv(el.keywords.value);
  card.notes = txt(el.notes.value);
  card.template = txt(el.template.value, "organism");
}

/* =========================
   Preview
========================= */
function resolvePreviewImage(card) {
  if (state.localImageDataUrl) return state.localImageDataUrl;
  if (card.illustration.type === "url" && card.illustration.value) return card.illustration.value;
  return null;
}

function renderPreview() {
  const card = currentCard();
  el.cardStage.innerHTML = buildCardSvg(card);
}

/* =========================
   Library + Search
========================= */
function librarySearchPredicate(card, query) {
  const q = query.toLowerCase();
  const bag = [
    card.name,
    card.scientificName,
    card.habitat,
    card.category,
    card.expansion,
    card.rarity,
    ...(card.tags || [])
  ].join(" ").toLowerCase();

  return bag.includes(q);
}

function renderLibraryList() {
  const query = txt(el.searchInput.value).trim().toLowerCase();
  el.libraryList.innerHTML = "";

  state.cards.forEach((card, index) => {
    if (query && !librarySearchPredicate(card, query)) return;

    const li = document.createElement("li");
    li.className = "library-item" + (index === state.currentIndex ? " active" : "");
    li.dataset.index = String(index);

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = card.name || "(Untitled Card)";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${card.category || "Category"} | ${card.rarity || "Rarity"} | ${card.cardNumber || "-"}`;

    li.appendChild(title);
    li.appendChild(meta);

    li.addEventListener("click", () => {
      state.currentIndex = index;
      state.localImageDataUrl = null;
      populateFormFromCard(currentCard());
      renderPreview();
      renderLibraryList();
    });

    el.libraryList.appendChild(li);
  });
}

/* =========================
   Card Ops
========================= */
function createNewCard() {
  const fresh = structuredClone(DEFAULT_CARD);
  fresh.id = crypto.randomUUID ? crypto.randomUUID() : `card_${Date.now()}`;
  fresh.name = "";
  fresh.scientificName = "";
  fresh.cardNumber = "";
  fresh.expansion = "";
  fresh.habitat = "";
  fresh.artist = "";
  fresh.illustration = { type: "path", value: "" };
  fresh.cost = { water: 0, flora: 0, fauna: 0 };
  fresh.stats = { attack: 0, health: 0, defense: 0 };
  fresh.text = { ability: "", fact: "", flavor: "" };
  fresh.tags = [];
  fresh.keywords = [];
  fresh.notes = "";

  state.cards.push(fresh);
  state.currentIndex = state.cards.length - 1;
  state.localImageDataUrl = null;
  populateFormFromCard(fresh);
  renderPreview();
  renderLibraryList();
}

function duplicateCurrentCard() {
  const source = currentCard();
  const copy = structuredClone(source);
  copy.id = crypto.randomUUID ? crypto.randomUUID() : `card_${Date.now()}`;
  copy.name = source.name ? `${source.name} (Copy)` : "(Copy)";
  state.cards.push(copy);
  state.currentIndex = state.cards.length - 1;
  state.localImageDataUrl = null;
  populateFormFromCard(copy);
  renderPreview();
  renderLibraryList();
}

function deleteCurrentCard() {
  if (state.cards.length <= 1) {
    alert("At least one card must remain.");
    return;
  }
  state.cards.splice(state.currentIndex, 1);
  state.currentIndex = Math.max(0, state.currentIndex - 1);
  state.localImageDataUrl = null;
  populateFormFromCard(currentCard());
  renderPreview();
  renderLibraryList();
}

/* =========================
   JSON IO
========================= */
function saveCurrentCardJson() {
  readCardFromForm();
  const blob = new Blob([JSON.stringify(currentCard(), null, 2)], { type: "application/json" });
  const filename = `${slug(currentCard().name, "card")}.json`;
  downloadBlob(blob, filename);
}

function saveLibraryJson() {
  readCardFromForm();
  const blob = new Blob([JSON.stringify(state.cards, null, 2)], { type: "application/json" });
  downloadBlob(blob, "itw_card_library.json");
}

function loadJsonFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const readers = files.map(file => new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve({ name: file.name, text: String(fr.result) });
    fr.onerror = () => resolve({ name: file.name, text: null });
    fr.readAsText(file, "utf-8");
  }));

  Promise.all(readers).then(results => {
    let imported = [];

    for (const r of results) {
      if (!r.text) continue;
      try {
        const parsed = JSON.parse(r.text);

        if (Array.isArray(parsed)) {
          imported.push(...parsed.map(normalizeCard));
        } else if (parsed && typeof parsed === "object") {
          imported.push(normalizeCard(parsed));
        }
      } catch {
        console.warn(`Invalid JSON skipped: ${r.name}`);
      }
    }

    if (!imported.length) {
      alert("No valid card JSON found.");
      return;
    }

    state.cards.push(...imported);
    state.currentIndex = state.cards.length - imported.length;
    state.localImageDataUrl = null;

    populateFormFromCard(currentCard());
    renderPreview();
    renderLibraryList();
  });
}

/* =========================
   SVG + PNG Export
========================= */
function buildCardSvg(card) {
  const imageSrc = resolvePreviewImage(card);

  // Split fact into up to 3 wrapped lines (~60 chars each at the template's font size)
  const factLines = wrapText(card.text.fact, 60, 3);

  // Split ability into up to 3 lines (one bullet per line; user can use Enter to separate)
  const rawAbilityLines = txt(card.text.ability).split(/\n/).filter(l => l.trim());
  const abilityLines = rawAbilityLines.slice(0, 3);
  while (abilityLines.length < 3) abilityLines.push("");

  const clipDef = imageSrc
    ? `<clipPath id="artClip"><rect x="49.098" y="100.04" width="351.81" height="205.38" rx="6" ry="6"/></clipPath>`
    : "";
  const imageEl = imageSrc
    ? `<image href="${imageSrc}" x="49.098" y="100.04" width="351.81" height="205.38" preserveAspectRatio="xMidYMid slice" clip-path="url(#artClip)"/>`
    : "";

  return `<svg width="2.75in" height="3.75in" version="1.1" viewBox="0 0 450.01 613.65" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="boxGradient" x1="20.069" x2="221.37" y1="601.82" y2="803.11" gradientTransform="matrix(1.6568 0 0 .60359 0 2.7648e-6)" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff" stop-opacity=".9" offset="0"/>
      <stop stop-color="#F5F5F5" stop-opacity=".9" offset="1"/>
    </linearGradient>
    ${clipDef}
  </defs>
  <rect x="24.489" y="24.421" width="401.03" height="564.81" rx="22" ry="22" fill="#2d3a2e" stroke="#1b241c" stroke-width="8"/>
  <rect x="38.161" y="38.424" width="373.69" height="536.8" rx="14" ry="14" fill="#f4f1ea" stroke="#8c7a6b" stroke-width="3"/>
  <rect x="49.098" y="348.37" width="351.81" height="185.57" rx="8" ry="8" fill="url(#boxGradient)" stroke="#8c7a6b" stroke-width="1.5"/>
  <g id="resources" transform="matrix(.91143 0 0 .93356 19.932 19.753)" stroke-width="1.0841">
    <rect transform="matrix(1.0972 0 0 1.0712 -21.869 -21.159)" x="49.098" y="49.627" width="351.81" height="39.21" rx="6" ry="6" fill="#1b241c"/>
    <text transform="matrix(1.0841 0 0 1.0841 -21.869 -21.159)" x="62.604591" y="73.018456" fill="#f4f1ea" font-family="monospace" font-size="16.604px" font-weight="bold">${escapeXml(card.name || "Card Name")}</text>
    <circle cx="330" cy="53" r="11" fill="#228b22"/>
    <text x="330" y="57" text-anchor="middle" font-family="Arial" font-size="10px" fill="#fff">${card.cost.flora}</text>
    <circle cx="362" cy="53" r="11" fill="#4169e1"/>
    <text x="362" y="57" text-anchor="middle" font-family="Arial" font-size="10px" fill="#fff">${card.cost.water}</text>
    <circle cx="394" cy="53" r="11" fill="#8b0000"/>
    <text x="394" y="57" text-anchor="middle" font-family="Arial" font-size="10px" fill="#fff">${card.cost.fauna}</text>
  </g>
  <rect id="card-art" x="49.098" y="100.04" width="351.81" height="205.38" rx="6" ry="6" fill="#d0c9bc" stroke="#1b241c" stroke-width="2"/>
  ${imageEl}
  <g fill="#fff">
    <rect x="49.098" y="316.63" width="351.81" height="22.406" rx="4" ry="4" fill="#8c7a6b"/>
    <text id="card-type" transform="scale(.98807 1.0121)" x="58.914871" y="327.60928" font-size="11.069px">Type: ${escapeXml(card.category || "")}</text>
    <text id="card-habitat" transform="scale(.98807 1.0121)" x="232.33182" y="327.60928" font-size="11.069px">Habitat: ${escapeXml(card.habitat || "")}</text>
  </g>
  <text id="scientific-name" transform="scale(.98807 1.0121)" x="58.914871" y="361.73923" font-size="11.069px" font-style="italic" fill="#333">${escapeXml(card.scientificName || "")}</text>
  <g>
    <text transform="scale(.98807 1.0121)" x="58.914871" y="385.72241" font-size="10.147px" font-weight="bold" fill="#333">Factual Note</text>
    <text id="fact" transform="scale(.98807 1.0121)" x="58.914871" y="402.32617" font-size="9.2243px" fill="#333"><tspan x="58.914871" y="402.32617">${escapeXml(factLines[0])}</tspan><tspan x="58.914871" y="413.85654">${escapeXml(factLines[1])}</tspan><tspan x="58.914871" y="425.38693">${escapeXml(factLines[2])}</tspan></text>
    <line x1="49.098" x2="400.91" y1="374.51" y2="374.51" stroke="#c0c0c0"/>
  </g>
  <g font-size="9.2243px" fill="#333">
    <line x1="49.098" x2="400.91" y1="439.86" y2="439.86" stroke="#c0c0c0"/>
    <text transform="scale(.98807 1.0121)" x="58.914871" y="451.21497" font-size="10.147px" font-weight="bold">Abilities</text>
    <text transform="scale(.98807 1.0121)" x="64.449455" y="467.81873">• ${escapeXml(abilityLines[0])}</text>
    <text transform="scale(.98807 1.0121)" x="64.449455" y="482.57761">• ${escapeXml(abilityLines[1])}</text>
    <text transform="scale(.98807 1.0121)" x="64.449455" y="497.33652">• ${escapeXml(abilityLines[2])}</text>
  </g>
  <text id="footer" transform="scale(.98806 1.0121)" x="58.915627" y="547.34991" font-size="8.302px" fill="#555">${escapeXml(card.expansion || "")} • ${escapeXml(card.cardNumber || "")} • ${escapeXml(card.artist || "")}</text>
  <!-- Combat Stats Bubble (ATK | HP — defense is stored in JSON but the template has two slots) -->
  <g transform="translate(324.33 536.81)">
    <rect width="76" height="32" rx="8" ry="8" fill="#4a5d4e" stroke="#fff" stroke-width="1.5"/>
    <text x="20" y="21" fill="#ffffff" font-family="Arial" font-size="15px" font-weight="bold" text-anchor="middle">${card.stats.attack}</text>
    <line x1="38" x2="38" y1="6" y2="26" stroke="#fff" stroke-opacity=".5"/>
    <text x="56" y="21" fill="#ffd3b6" font-family="Arial" font-size="15px" font-weight="bold" text-anchor="middle">${card.stats.health}</text>
  </g>
</svg>`.trim();
}

function exportSvg() {
  readCardFromForm();
  const card = currentCard();
  const svg = buildCardSvg(card);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, `${slug(card.name, "card")}.svg`);
}

function exportPng() {
  readCardFromForm();
  const card = currentCard();
  const svg = buildCardSvg(card);
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 450;
    canvas.height = 614;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((pngBlob) => {
      if (pngBlob) {
        downloadBlob(pngBlob, `${slug(card.name, "card")}.png`);
      }
      URL.revokeObjectURL(svgUrl);
    }, "image/png");
  };
  img.onerror = () => {
    URL.revokeObjectURL(svgUrl);
    alert("PNG export failed (likely cross-origin image restriction from URL image).");
  };
  img.src = svgUrl;
}

/* =========================
   Events
========================= */
function onFormInput(e) {
  readCardFromForm();

  // if user edits reference/type manually, clear selected local file preview
  if (e.target.id === "illustrationValue" || e.target.id === "illustrationType") {
    state.localImageDataUrl = null;
    el.illustrationFile.value = "";
  }

  renderPreview();
  renderLibraryList();
}

function bindEvents() {
  el.form.addEventListener("input", onFormInput);

  el.illustrationFile.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      state.localImageDataUrl = null;
      renderPreview();
      return;
    }

    const fr = new FileReader();
    fr.onload = () => {
      state.localImageDataUrl = String(fr.result);
      el.illustrationType.value = "local";
      if (!el.illustrationValue.value) {
        el.illustrationValue.value = file.name;
      }
      readCardFromForm();
      renderPreview();
      renderLibraryList();
    };
    fr.readAsDataURL(file);
  });

  el.newCardBtn.addEventListener("click", createNewCard);
  el.duplicateCardBtn.addEventListener("click", duplicateCurrentCard);
  el.deleteCardBtn.addEventListener("click", deleteCurrentCard);

  el.saveCurrentJsonBtn.addEventListener("click", saveCurrentCardJson);
  el.saveLibraryJsonBtn.addEventListener("click", saveLibraryJson);

  el.loadJsonInput.addEventListener("change", (e) => {
    loadJsonFiles(e.target.files);
    e.target.value = "";
  });

  el.exportSvgBtn.addEventListener("click", exportSvg);
  el.exportPngBtn.addEventListener("click", exportPng);
  el.printBtn.addEventListener("click", () => window.print());

  el.searchInput.addEventListener("input", renderLibraryList);
}

/* =========================
   Init
========================= */
function init() {
  renderCategoryOptions();
  populateFormFromCard(currentCard());
  renderPreview();
  renderLibraryList();
  bindEvents();
}

init();
