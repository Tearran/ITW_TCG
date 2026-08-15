# Into the Wild TCG

## Collect the World's Wildlands. Discover Nature's Connections.

**Into the Wild** is a collectible trading card game inspired by the wildlife, plants, habitats, and wildlands of our planet.

Each expansion explores a real landscape, beginning with the **Tonto Basin Ranger District** of **Tonto National Forest** in Arizona, USA. Every card represents a real species, habitat, or natural feature.

## Into the Wild - Living Design Document

> **Status:** Alpha Design Draft
>
> This document is the authoritative source for the current game design.
>
> All mechanics, card structure, deck construction, and design principles are maintained here until the rules stabilize.

---

### Standard Deck

This section defines the structural and architectural model of the standard deck.

Structurally, the standard deck model is **4 suits by 13 ranks**, producing **52 cards**. Suit is part of a card's identity and organization, alongside rank.

The four suits are:

| Suit | Definition |
|------|------------|
| Resources | Materials, food, energy sources, or other resources that can support an ecosystem. |
| Foundations | Physical or ecological structures that form the base of an ecosystem, such as habitat, terrain, shelter, or persistent structures. |
| Organisms | Living things within the ecosystem, including plants, animals, insects, fungi, and other organisms. |
| Dynamics | Events, environmental changes, natural processes, weather, or other conditions that alter the state of the ecosystem. |

A complete deck has one card for every suit/rank combination, for a total of 52 cards.

The shared 52-card architecture can optionally support conventional card games such as poker, rummy, or Go Fish, independently of Into the Wild rules. This does not mean that conventional card-game rules are Into the Wild rules.

---

### Suit Taxonomy Boundaries

Suit is classification and identity only. Suit does not automatically define a gameplay rule, restriction, or ability.

The following mechanics are not defined by suit in this document. Each remains future design work:

- Attacking or challenging
- Blocking
- Targeting
- Challenge immunity
- Adjacency bonuses
- Scoring
- Energy costs
- Card abilities
- Suit-based restrictions

All suit-based mechanics are future design work.

---

#### Legacy Implementation Context

The current implementation stores suit using the `mechanics.suit` field, with the legacy string values `energy`, `support`, `wildlife`, and `event`. These values are documented here as legacy, current-implementation context only.

Neither the `mechanics.suit` field name nor its current stored string values change as a result of this document. This document does not define a mapping, migration, or rename between the four-suit taxonomy (Resources, Foundations, Organisms, Dynamics) and the legacy `mechanics.suit` values. A later issue will decide any mapping or migration.

---

#### Mechanics Required Fields

| Field | Description |
|------|-------------|
| suit | The four-suit taxonomy (Resources, Foundations, Organisms, Dynamics) used for card identity and organization. The currently stored value remains the legacy `mechanics.suit` string (`energy`, `support`, `wildlife`, or `event`). See [Legacy Implementation Context](#legacy-implementation-context). |

---

### Expansions

A card belongs to an **expansion** for the purposes of organization, production, and distribution.

The **master card database** is the complete card pool across all expansions.

Players may combine cards from multiple expansions when building a deck. An expansion does not create a separate game format unless a future rule defines one.

---

### Deck Building Concepts

Into the Wild has two deck-building concepts:

- **Expansion/Production Deck** - a 52-card selection from one expansion or production set.
- **Custom Deck** - any 52-card selection from the master card database, including cards from multiple expansions.

The master card database is the complete card pool. A saved deck JSON file represents one specific 52-card selection.

One deck-builder concept is intended to eventually serve both the Expansion/Production Deck and the Custom Deck.

These are concepts only. This document does not define:

- The master card database schema.
- The deck JSON schema.
- Deck-level metadata.
- The deck-builder implementation.

Schema design and implementation for the items above are future work, tracked in separate issues.

---

## Into the Wild - Keyword Reference

### Suit

The four-suit taxonomy classification of a card, used for card identity and organization.

The four suits are:

- Resources
- Foundations
- Organisms
- Dynamics

Suit is classification and identity only. See [Suit Taxonomy Boundaries](#suit-taxonomy-boundaries) for the mechanics that are not defined by suit.

---

### Type

The four-suit taxonomy classification of a card. See [Suit](#suit).

---

## Into the Wild - effect Style Guide

### Standard Deck Composition

A standard deck contains exactly **52 cards**: 4 suits by 13 ranks.

| Suit | Cards |
|------|------:|
| Resources | 13 |
| Foundations | 13 |
| Organisms | 13 |
| Dynamics | 13 |

Total: **52 cards**

---

### Rank Distribution

Each suit contains exactly one card of every rank, 1 through 13.

| Rank | Resources | Foundations | Organisms | Dynamics |
|-----:|:---------:|:-----------:|:---------:|:--------:|
| 1 | x | x | x | x |
| 2 | x | x | x | x |
| 3 | x | x | x | x |
| 4 | x | x | x | x |
| 5 | x | x | x | x |
| 6 | x | x | x | x |
| 7 | x | x | x | x |
| 8 | x | x | x | x |
| 9 | x | x | x | x |
| 10 | x | x | x | x |
| 11 | x | x | x | x |
| 12 | x | x | x | x |
| 13 | x | x | x | x |

---
