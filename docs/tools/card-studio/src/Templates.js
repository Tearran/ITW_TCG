/**
 * Templates.js
 * Template registry for card types.
 * Isolated from CardRenderer and SvgRenderer to prevent circular imports.
 *
 * Adding a new template: add one entry here. No renderer code changes needed.
 */

/**
 * @typedef {object} TemplateConfig
 * @property {string}          label           Display name for type line
 * @property {string}          bgColor         Background fill color
 * @property {[string,string]} [bgGradient]    Optional [top, bottom] gradient stops
 * @property {string}          borderColor     Card border stroke
 * @property {string}          headerColor     Header band fill
 * @property {string}          headerTextColor Header text color
 * @property {string}          subTextColor    Subtle text (scientific name)
 * @property {string}          artBg           Art frame placeholder background
 * @property {string}          typeBg          Type line band fill
 * @property {string}          typeTextColor   Type line text color
 * @property {string}          rulesBg         Rules box fill
 * @property {string}          rulesLabelColor Label text in rules box
 * @property {string}          rulesTextColor  Body text in rules box
 * @property {string}          flavorColor     Flavor text color
 * @property {string}          footerColor     Footer text color
 */

/** @type {Record<string, TemplateConfig>} */
export const TEMPLATE_REGISTRY = {
  organism: {
    label: "Organism",
    bgColor: "#1A2E1A",
    bgGradient: ["#213521", "#111D11"],
    borderColor: "#4A7C59",
    headerColor: "#2D5A3D",
    headerTextColor: "#E8F5E9",
    subTextColor: "#A5C8A9",
    artBg: "#0E1A0E",
    typeBg: "#1E3A25",
    typeTextColor: "#81C784",
    rulesBg: "#162616",
    rulesLabelColor: "#66BB6A",
    rulesTextColor: "#C8E6C9",
    flavorColor: "#7CB580",
    footerColor: "#5A8A64",
  },
  resource: {
    label: "Resource",
    bgColor: "#0D1B2A",
    bgGradient: ["#132232", "#0A1520"],
    borderColor: "#3B82F6",
    headerColor: "#1E3A5F",
    headerTextColor: "#DBEAFE",
    subTextColor: "#93C5FD",
    artBg: "#0A1929",
    typeBg: "#1B3558",
    typeTextColor: "#60A5FA",
    rulesBg: "#101E30",
    rulesLabelColor: "#3B82F6",
    rulesTextColor: "#BFDBFE",
    flavorColor: "#60A5FA",
    footerColor: "#3B6EA8",
  },
  weather: {
    label: "Weather",
    bgColor: "#1A1A2E",
    bgGradient: ["#222236", "#111122"],
    borderColor: "#818CF8",
    headerColor: "#312E81",
    headerTextColor: "#E0E7FF",
    subTextColor: "#A5B4FC",
    artBg: "#13132A",
    typeBg: "#2D2A70",
    typeTextColor: "#A5B4FC",
    rulesBg: "#161630",
    rulesLabelColor: "#818CF8",
    rulesTextColor: "#C7D2FE",
    flavorColor: "#818CF8",
    footerColor: "#5A5AA0",
  },
  landmark: {
    label: "Landmark",
    bgColor: "#2A1A0A",
    bgGradient: ["#3B2410", "#1C1008"],
    borderColor: "#D97706",
    headerColor: "#78350F",
    headerTextColor: "#FEF3C7",
    subTextColor: "#FCD34D",
    artBg: "#1A0E00",
    typeBg: "#6B3A0A",
    typeTextColor: "#FDE68A",
    rulesBg: "#221508",
    rulesLabelColor: "#F59E0B",
    rulesTextColor: "#FEF3C7",
    flavorColor: "#F59E0B",
    footerColor: "#9A7040",
  },
  cataclysm: {
    label: "Cataclysm",
    bgColor: "#2A0A0A",
    bgGradient: ["#3B1010", "#1A0808"],
    borderColor: "#EF4444",
    headerColor: "#7F1D1D",
    headerTextColor: "#FEE2E2",
    subTextColor: "#FCA5A5",
    artBg: "#1A0000",
    typeBg: "#6B1A1A",
    typeTextColor: "#FCA5A5",
    rulesBg: "#220808",
    rulesLabelColor: "#EF4444",
    rulesTextColor: "#FEE2E2",
    flavorColor: "#F87171",
    footerColor: "#9A4040",
  },
  biome: {
    label: "Biome",
    bgColor: "#0A2A1A",
    bgGradient: ["#0E3522", "#071A11"],
    borderColor: "#34D399",
    headerColor: "#065F46",
    headerTextColor: "#ECFDF5",
    subTextColor: "#6EE7B7",
    artBg: "#042A18",
    typeBg: "#064E3B",
    typeTextColor: "#6EE7B7",
    rulesBg: "#052018",
    rulesLabelColor: "#34D399",
    rulesTextColor: "#D1FAE5",
    flavorColor: "#34D399",
    footerColor: "#2A7A5A",
  },
};

/** Ordered list of template keys for UI dropdowns. */
export const TEMPLATE_KEYS = Object.keys(TEMPLATE_REGISTRY);
