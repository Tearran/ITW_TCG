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

  // Preview
  pvName: document.getElementById("pvName"),
  pvScientificName: document.getElementById("pvScientificName"),
  pvRarity: document.getElementById("pvRarity"),
  pvCostWater: document.getElementById("pvCostWater"),
  pvCostFlora: document.getElementById("pvCostFlora"),
  pvCostFauna: document.getElementById("pvCostFauna"),
  pvCategory: document.getElementById("pvCategory"),
  pvHabitat: document.getElementById("pvHabitat"),
  pvAbility: document.getElementById("pvAbility"),
  pvFact: document.getElementById("pvFact"),
  pvFlavor: document.getElementById("pvFlavor"),
  pvExpansion: document.getElementById("pvExpansion"),
  pvCardNumber: document.getElementById("pvCardNumber"),
  pvArtist: document.getElementById("pvArtist"),
  pvAttack: document.getElementById("pvAttack"),
  pvHealth: document.getElementById("pvHealth"),
  pvDefense: document.getElementById("pvDefense"),
  pvImage: document.getElementById("pvImage"),
  pvImagePlaceholder: document.getElementById("pvImagePlaceholder"),

  // Library
  searchInput: document.getElementById("searchInput"),
  libraryList: document.getElementById("libraryList")
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
  // precedence: local selected file > URL type/value
  if (state.localImageDataUrl) return state.localImageDataUrl;
  if (card.illustration.type === "url" && card.illustration.value) return card.illustration.value;
  return null; // path type shown as placeholder text
}

function renderPreview() {
  const card = currentCard();

  setText(el.pvName, card.name || "Card Name");
  setText(el.pvScientificName, card.scientificName || "");
  setText(el.pvRarity, card.rarity || "Common");

  setText(el.pvCostWater, String(card.cost.water));
  setText(el.pvCostFlora, String(card.cost.flora));
  setText(el.pvCostFauna, String(card.cost.fauna));

  setText(el.pvCategory, card.category || "");
  setText(el.pvHabitat, card.habitat || "");

  setText(el.pvAbility, card.text.ability || "");
  setText(el.pvFact, card.text.fact || "");
  setText(el.pvFlavor, card.text.flavor || "");

  setText(el.pvExpansion, card.expansion || "");
  setText(el.pvCardNumber, card.cardNumber || "");
  setText(el.pvArtist, `Artist: ${card.artist || ""}`);

  setText(el.pvAttack, String(card.stats.attack));
  setText(el.pvHealth, String(card.stats.health));
  setText(el.pvDefense, String(card.stats.defense));

  const imageSrc = resolvePreviewImage(card);
  if (imageSrc) {
    el.pvImage.src = imageSrc;
    el.pvImage.style.display = "block";
    el.pvImagePlaceholder.style.display = "none";
  } else {
    el.pvImage.removeAttribute("src");
    el.pvImage.style.display = "none";
    el.pvImagePlaceholder.style.display = "grid";
    if (card.illustration.value) {
      el.pvImagePlaceholder.textContent = `Illustration reference: ${card.illustration.value}`;
    } else {
      el.pvImagePlaceholder.textContent = "No image loaded";
    }
  }
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
  const W = 630;
  const H = 880;
  const imageSrc = resolvePreviewImage(card);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="63mm" height="88mm" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="b1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4A5D4E"/>
      <stop offset="100%" stop-color="#2C3B30"/>
    </linearGradient>
    <linearGradient id="b2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FDFBF7"/>
      <stop offset="100%" stop-color="#EAE3D2"/>
    </linearGradient>
  </defs>

  <rect x="10" y="10" width="610" height="860" rx="24" fill="url(#b1)"/>
  <rect x="24" y="24" width="582" height="832" rx="16" fill="url(#b2)"/>

  <rect x="38" y="38" width="554" height="58" rx="10" fill="#fff" stroke="#8C7A6B" />
  <text x="52" y="73" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#2C3B30">${escapeXml(card.name || "Card Name")}</text>

  <circle cx="500" cy="67" r="16" fill="#4A90E2" stroke="#fff" stroke-width="2"/><text x="500" y="73" text-anchor="middle" font-family="Arial" font-size="14" fill="#fff">${card.cost.water}</text>
  <circle cx="536" cy="67" r="16" fill="#57B26A" stroke="#fff" stroke-width="2"/><text x="536" y="73" text-anchor="middle" font-family="Arial" font-size="14" fill="#fff">${card.cost.flora}</text>
  <circle cx="572" cy="67" r="16" fill="#B07A42" stroke="#fff" stroke-width="2"/><text x="572" y="73" text-anchor="middle" font-family="Arial" font-size="14" fill="#fff">${card.cost.fauna}</text>

  <text x="40" y="118" font-family="Arial,sans-serif" font-size="16" font-style="italic" fill="#5C5146">${escapeXml(card.scientificName || "")}</text>
  <text x="590" y="118" text-anchor="end" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#5C5146">${escapeXml(card.rarity || "")}</text>

  <rect x="38" y="130" width="554" height="330" rx="10" fill="#E2ECE9" stroke="#8C7A6B"/>
  ${
    imageSrc
      ? `<image href="${imageSrc}" x="48" y="140" width="534" height="310" preserveAspectRatio="xMidYMid slice" />`
      : `<rect x="48" y="140" width="534" height="310" fill="#D3E4DF" stroke="#A3BCB6" stroke-dasharray="6,6" />
         <text x="315" y="300" text-anchor="middle" font-family="Arial" font-size="18" fill="#6f857d">No image</text>`
  }

  <rect x="38" y="474" width="554" height="38" rx="8" fill="#fff" stroke="#8C7A6B"/>
  <text x="52" y="499" font-family="Arial" font-size="16" font-style="italic" font-weight="700" fill="#5C5146">${escapeXml(card.category || "")}</text>
  <text x="578" y="499" text-anchor="end" font-family="Arial" font-size="16" font-style="italic" font-weight="700" fill="#5C5146">${escapeXml(card.habitat || "")}</text>

  <rect x="38" y="526" width="554" height="230" rx="10" fill="#fff" stroke="#8C7A6B"/>
  <text x="52" y="554" font-family="Arial" font-size="16" font-weight="700" fill="#2C3B30">Ability</text>
  <foreignObject x="52" y="560" width="526" height="76"><div xmlns="http://www.w3.org/1999/xhtml" style="font:14px Arial;color:#333;line-height:1.25">${escapeXml(card.text.ability || "")}</div></foreignObject>

  <text x="52" y="654" font-family="Arial" font-size="16" font-weight="700" fill="#2C3B30">Fact</text>
  <foreignObject x="52" y="660" width="526" height="44"><div xmlns="http://www.w3.org/1999/xhtml" style="font:14px Arial;color:#333;line-height:1.25">${escapeXml(card.text.fact || "")}</div></foreignObject>

  <foreignObject x="52" y="706" width="526" height="40"><div xmlns="http://www.w3.org/1999/xhtml" style="font:italic 13px Arial;color:#6E655F;line-height:1.2">${escapeXml(card.text.flavor || "")}</div></foreignObject>

  <text x="42" y="818" font-family="Arial" font-size="12" font-weight="700" fill="#6b7280">${escapeXml(card.expansion || "")}</text>
  <text x="42" y="838" font-family="Arial" font-size="12" font-weight="700" fill="#6b7280">${escapeXml(card.cardNumber || "")}</text>
  <text x="220" y="828" font-family="Arial" font-size="12" fill="#6b7280">Artist: ${escapeXml(card.artist || "")}</text>

  <rect x="470" y="796" width="122" height="48" rx="10" fill="#4A5D4E" stroke="#fff"/>
  <text x="500" y="825" text-anchor="middle" font-family="Arial" font-size="14" fill="#fff">A ${card.stats.attack}</text>
  <text x="531" y="825" text-anchor="middle" font-family="Arial" font-size="14" fill="#fff">H ${card.stats.health}</text>
  <text x="562" y="825" text-anchor="middle" font-family="Arial" font-size="14" fill="#fff">D ${card.stats.defense}</text>
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
    canvas.width = 630;
    canvas.height = 880;
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
