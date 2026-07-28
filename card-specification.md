# Into the Wild — Card Specification

## Purpose

This document defines the structure and data format of every card used in *Into the Wild*.

Gameplay rules are defined in **core-game-engine.md**.

This specification defines the fields required to represent a card in JSON.

---

# Card Structure

Every card consists of two sections:

* **Mechanics** — Information used by the game engine.
* **Metadata** — Information presented to the player.

---

## Mechanics

The mechanics section contains all gameplay information.

### Fields

* id
* rank
* type
* subtype
* cost
* abilities

---

## Metadata

The metadata section contains descriptive information about the card.

Metadata does not directly affect gameplay.

### Fields

* name
* scientific_name
* fact
* illustration
* artist
* expansion
* rarity

---

# Mechanics Field Definitions

## id

A unique integer used to identify the card.

The `id` must be unique within the complete card database.

Once assigned, an `id` should never be reused.

Example

```json
"id": 410
```

---

## rank

The card's Printed Rank.

The rank is used by the Core Game Engine to determine the card's Effective Rank during gameplay.

Example

```json
"rank": 7
```

---

## type

Defines the card's primary gameplay type.

Valid values are:

* Energy
* Habitat
* Event

Example

```json
"type": "Habitat"
```

---

## subtype

Defines the card's category within its card type.

Examples include:

### Energy

* Water
* Flora
* Fauna

### Habitat

* Herbivore
* Omnivore
* Carnivore

### Event

* Weather
* Cataclysm
* Invasive Species

Example

```json
"subtype": "Carnivore"
```

---

## cost

Defines the Energy required to play the card.

Every cost contains the three Energy types.

If an Energy type is not required, its value is zero.

Example

```json
"cost": {
    "water": 1,
    "flora": 0,
    "fauna": 2
}
```

---

## abilities

Lists the gameplay effects performed by the card.

Each ability is written as a separate string.

The interpretation of abilities is defined by the Core Game Engine and the Ability Style Guide.

Example

```json
"abilities": [
    "Example ability."
]
```

---

# Metadata Field Definitions

## name

The common name displayed on the card.

Example

```json
"name": "Bobcat"
```

---

## scientific_name

The scientific name displayed on the card.

Scientific names should follow accepted taxonomic conventions when applicable.

Example

```json
"scientific_name": "Lynx rufus"
```

---

## fact

Educational information presented on the card.

Facts do not affect gameplay.

Each fact is stored as a separate string.

Example

```json
"fact": [
    "Bobcats are solitary predators.",
    "They hunt rabbits and rodents."
]
```

---

## illustration

The relative path or filename of the card artwork.

Example

```json
"illustration": "artwork/bobcat.svg"
```

---

## artist

Credits the creator of the illustration.

Example

```json
"artist": "Tearran Studios"
```

---

## expansion

Identifies the expansion in which the card is published.

Examples

* Alpha
* Tonto Basin Ranger District
* Globe Ranger District
* Pleasant Valley Ranger District

Example

```json
"expansion": "Alpha"
```

---

## rarity

Defines the card's rarity within an expansion.

Example values include:

* Common
* Uncommon
* Rare
* Legendary

Example

```json
"rarity": "Rare"
```

---

# Complete Card JSON Example

```json
{
    "mechanics": {
        "id": 0,
        "rank": 7,
        "type": "Habitat",
        "subtype": "Carnivore",
        "cost": {
            "water": 1,
            "flora": 0,
            "fauna": 2
        },
        "abilities": [
            "..."
        ]
    },
    "metadata": {
        "name": "Bobcat",
        "scientific_name": "Lynx rufus",
        "fact": [
            "..."
        ],
        "illustration": "artwork/bobcat.svg",
        "artist": "Tearran Studios",
        "expansion": "Alpha",
        "rarity": "Rare"
    }
}
```

---

# Design Principles

* Mechanics define how a card functions during gameplay.
* Metadata defines how a card is presented to the player.
* Mechanics should remain independent of artwork, educational content, and localization.
* Metadata may change between editions without altering gameplay.
* All cards follow the same JSON structure regardless of card type.
* Every card must contain both a `mechanics` section and a `metadata` section.
