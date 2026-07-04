/**
 * SampleCards.js
 * Starter card data — one sample card per template.
 * Used to pre-populate the library on first launch.
 */

export const SAMPLE_CARDS = [
  // ── Organism ────────────────────────────────────────────────────────────────
  {
    id: "sample-organism-001",
    name: "Saguaro",
    scientificName: "Carnegiea gigantea",
    rarity: "Uncommon",
    template: "organism",
    category: "Flora — Succulent",
    habitat: "Sonoran Desert",
    expansion: "ITW-A",
    cardNumber: "027",
    artist: "ITW Studio",
    copyright: "© Into the Wild TCG",
    cost: { water: 2, flora: 1, fauna: 0 },
    stats: { attack: 0, health: 5, defense: 1 },
    text: {
      ability: "Thorns: When attacked, deal 1 damage to attacker.",
      fact: "The saguaro can store over 200 gallons of water after a single rainfall and live for over 150 years.",
      flavor: "A sentinel of the desert — slow to grow, impossible to ignore.",
    },
    artwork: { dataUrl: null, zoom: 1, panX: 0, panY: 0 },
    tags: ["flora", "plant", "cactus", "desert"],
    keywords: ["Thorns"],
    notes: "Keystone species of the Sonoran Desert.",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },

  // ── Resource ─────────────────────────────────────────────────────────────────
  {
    id: "sample-resource-001",
    name: "Theodore Roosevelt Lake",
    scientificName: "",
    rarity: "Unique",
    template: "resource",
    category: "Bio-Energy — Water (Reservoir)",
    habitat: "Tonto National Forest",
    expansion: "ITW-A",
    cardNumber: "003",
    artist: "ITW Studio",
    copyright: "© Into the Wild TCG",
    cost: { water: 0, flora: 0, fauna: 0 },
    stats: { attack: 0, health: 0, defense: 0 },
    text: {
      ability:
        "Provides 1 Water Bio-Energy per turn. At the start of your turn, gain +1 temporary Water this turn.",
      fact: "Created by the damming of the Salt River, Roosevelt Lake is the largest body of water in Arizona covering 19,600 acres at capacity.",
      flavor: "Still waters run deep — and sustain the desert for miles around.",
    },
    artwork: { dataUrl: null, zoom: 1, panX: 0, panY: 0 },
    tags: ["water", "resource", "reservoir", "landmark"],
    keywords: [],
    notes: "Unique card — only one copy allowed per deck.",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },

  // ── Weather ─────────────────────────────────────────────────────────────────
  {
    id: "sample-weather-001",
    name: "Monsoon Thunderstorm",
    scientificName: "",
    rarity: "Rare",
    template: "weather",
    category: "Weather — Seasonal Storm",
    habitat: "Tonto National Forest",
    expansion: "ITW-A",
    cardNumber: "029",
    artist: "ITW Studio",
    copyright: "© Into the Wild TCG",
    cost: { water: 2, flora: 0, fauna: 0 },
    stats: { attack: 0, health: 0, defense: 0 },
    text: {
      ability: "Deal 4 damage to one target creature or player.",
      fact: "Arizona's North American monsoon season runs July–September, delivering over half the region's annual precipitation in intense bursts.",
      flavor: "The desert waits all year for this moment.",
    },
    artwork: { dataUrl: null, zoom: 1, panX: 0, panY: 0 },
    tags: ["weather", "storm", "water", "seasonal"],
    keywords: [],
    notes: "Instance — place in discard after resolving.",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },

  // ── Landmark ─────────────────────────────────────────────────────────────────
  {
    id: "sample-landmark-001",
    name: "Tonto National Forest",
    scientificName: "",
    rarity: "Rare",
    template: "landmark",
    category: "Landmark — National Forest",
    habitat: "Central Arizona",
    expansion: "ITW-A",
    cardNumber: "LM-001",
    artist: "ITW Studio",
    copyright: "© Into the Wild TCG",
    cost: { water: 1, flora: 2, fauna: 1 },
    stats: { attack: 0, health: 8, defense: 2 },
    text: {
      ability:
        "While in play, all friendly Organism cards gain +1 Health. Flora Bio-Energy sources you control produce +1 additional Flora.",
      fact: "At nearly 3 million acres, Tonto National Forest is the sixth-largest national forest in the United States.",
      flavor: "Where desert meets mountain, and every creature finds its niche.",
    },
    artwork: { dataUrl: null, zoom: 1, panX: 0, panY: 0 },
    tags: ["landmark", "forest", "habitat", "national-forest"],
    keywords: [],
    notes: "Zone card — stays in play.",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },

  // ── Cataclysm ────────────────────────────────────────────────────────────────
  {
    id: "sample-cataclysm-001",
    name: "Tonto Forest Fire",
    scientificName: "",
    rarity: "Rare",
    template: "cataclysm",
    category: "Cataclysm — Wildfire Event",
    habitat: "Tonto National Forest",
    expansion: "ITW-A",
    cardNumber: "031",
    artist: "ITW Studio",
    copyright: "© Into the Wild TCG",
    cost: { water: 0, flora: 3, fauna: 3 },
    stats: { attack: 0, health: 0, defense: 0 },
    text: {
      ability:
        "Deal 3 damage to all creatures in the Habitat and to both players. Flora Bio-Energy sources in play are composted at end of round.",
      fact: "Wildfires are a natural part of Arizona's ecology, clearing old growth and allowing nutrient cycling, but their frequency has increased with drought and human activity.",
      flavor: "The land remembers every fire — and rises from the ash.",
    },
    artwork: { dataUrl: null, zoom: 1, panX: 0, panY: 0 },
    tags: ["cataclysm", "fire", "wildfire", "event"],
    keywords: ["Cataclysm"],
    notes: "High-cost / high-impact board wipe.",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },

  // ── Biome ────────────────────────────────────────────────────────────────────
  {
    id: "sample-biome-001",
    name: "Sonoran Desert",
    scientificName: "",
    rarity: "Uncommon",
    template: "biome",
    category: "Biome — Hot Desert",
    habitat: "Southwest North America",
    expansion: "ITW-A",
    cardNumber: "BM-001",
    artist: "ITW Studio",
    copyright: "© Into the Wild TCG",
    cost: { water: 0, flora: 0, fauna: 0 },
    stats: { attack: 0, health: 6, defense: 0 },
    text: {
      ability:
        "Passive: Cactus-subtype Flora cards you control have +1 Health. Water Bio-Energy sources you control cannot be destroyed by Weather effects.",
      fact: "The Sonoran Desert is the hottest desert in North America and the most biologically diverse desert in the world, home to over 2,000 plant species.",
      flavor: "Heat, silence, and a thousand life forms perfectly tuned to survive.",
    },
    artwork: { dataUrl: null, zoom: 1, panX: 0, panY: 0 },
    tags: ["biome", "desert", "sonoran", "habitat"],
    keywords: [],
    notes: "Zone modifier card — affects all cards in play.",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
];
