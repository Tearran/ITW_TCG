# Into the Wild TCG

## Collect the World's Wildlands. Discover Nature's Connections.

**Into the Wild** is a collectible trading card game inspired by the wildlife, plants, habitats, and wildlands of our planet.

Each expansion explores a real landscape, beginning with the **Tonto Basin Ranger District** of **Tonto National Forest** in Arizona, USA. Every card represents a real species, habitat, or natural feature.

# Into the Wild — Living Design Document

> **Status:** Alpha Design Draft
>
> This document is the authoritative source for the current game design.
>
> All mechanics, card structure, deck construction, and design principles are maintained here until the rules stabilize.

---

# Game Objective

Into the Wild is a strategy card game where players build and maintain ecosystems by managing ecological resources and introducing organisms into play.

A standard game consists of **26 rounds**.

At the end of the final round, players calculate their scores.

The player with the highest score wins.

- If the scores are equal, each tied player draws the top card of their deck.
- A player who cannot draw a card because their deck is empty loses the game.
- Otherwise, the player who drew the card with the higher Printed Rank wins.
- If the drawn cards have the same Printed Rank, repeat this process until one player wins.

---

# Standard Deck

A standard deck contains **52 cards**.

The deck is divided into **four suits** containing **13 cards each**.

| Suit | Represents |
|------|------------|
| Energy | Ecological resources used to sustain life and pay Energy Costs. |
| Flora | Plants and habitat features that remain in play. |
| Fauna | Living organisms that remain in play. |
| Event | Temporary ecological processes that resolve immediately. |

---

# Energy

Energy Cards represent the ecological resources available within an ecosystem.

Mechanically, every Energy Card functions identically.

The illustration, common name, and educational facts identify one example of an ecological resource but do not change the card's gameplay unless a card ability explicitly states otherwise.

Examples include:

- Spring
- Acorns
- Rabbit
- Carrion
- Prickly Pear
- Mesquite Beans
- Fallen Fruit

These examples represent ecological resources rather than a specific object being consumed by a specific organism.

Energy Cards remain in play until removed by a card effect.

Energy Cards become Exhausted when used to pay an Energy Cost.

Energy Cards are Restored during the Refresh Phase.

---

# Flora

Flora Cards represent plants and habitat features that become permanent parts of a player's ecosystem.

Examples include:

- Trees
- Shrubs
- Cacti
- Grasses
- Wildflowers
- Fallen Logs
- Rock Outcroppings
- Wetlands

Flora Cards remain in play until:

- Defeated during a Challenge.
- Removed by an Event.
- Removed by another card effect.

Flora Cards may provide passive abilities, protection, ecological support, or other gameplay effects.

---

# Fauna

Fauna Cards represent living organisms that become permanent members of a player's ecosystem.

Fauna includes all animal life.

Examples include:

- Mammals
- Birds
- Fish
- Reptiles
- Amphibians
- Insects
- Arachnids
- Other animals

Fauna Cards remain in play until:

- Defeated during a Challenge.
- Removed by an Event.
- Removed by another card effect.

---

# Event

Event Cards represent temporary ecological processes.

Examples include:

- Weather
- Fire
- Flood
- Drought
- Disease
- Human Impacts
- Invasive Species
- Seasonal Changes

After resolving, Event Cards are placed into the Compost pile.

Event Cards never remain in play unless another card explicitly states otherwise.

---

# Rank

Every card has a Printed Rank.

Game effects may temporarily modify a card's Effective Rank.

Example

```text
Printed Rank: 8

Exhausted

Effective Rank: 6
```

---

# Effective Rank

Effective Rank is used whenever cards are compared during gameplay.

Unless modified by another card effect:

```text
Effective Rank = Printed Rank
```

An Exhausted card has:

```text
Effective Rank = Printed Rank − 2
```

---

# Exhaustion

Exhaustion represents a card that has already acted during the current round.

An Exhausted card:

- Has an Effective Rank equal to Printed Rank −2.
- Cannot declare another Challenge.
- Cannot pay another Energy Cost if it is an Energy Card.
- Remains Exhausted until Restored.

---

# Restore

During the Refresh Phase:

- Remove the Exhausted state from every card you control unless another card effect states otherwise.

Restoring a card does not change its Printed Rank.

It simply returns the card to its Ready state.

---

# Energy Costs

Cards require Energy to enter play.

Energy Costs represent the ecological effort required to establish or sustain a Flora or Fauna card.

Example

```json
{
    "cost": 2
}
```

To pay an Energy Cost:

1. Choose the required number of Ready Energy Cards.
2. Exhaust those Energy Cards.
3. Play the card.

An Exhausted Energy Card cannot be used to pay another Energy Cost until it has been Restored.

---

# Challenges

Challenges are interactions between permanent ecosystem cards.

Only Ready Flora and Fauna Cards may declare Challenges.

Event Cards may affect any cards described by their abilities.

Energy Cards cannot initiate Challenges.

---

## Declaring a Challenge

1. Choose one Ready Flora or Fauna Card you control as the challenger.
2. Choose one eligible opposing Flora or Fauna Card as the defender.
3. Resolve any abilities that trigger when the Challenge is declared.
4. Compare the Effective Rank of both cards.
5. Resolve the Challenge.
6. If the challenging card remains in play, Exhaust it.

---

## Challenge Resolution

- The card with the higher Effective Rank wins.
- The card with the lower Effective Rank is placed into the Compost pile unless another card effect states otherwise.
- If both cards have the same Effective Rank, both are placed into the Compost pile.

Resolve all triggered abilities before continuing play.

---

# Compost Pile

The Compost pile is the discard pile.

Cards are placed into the Compost pile when they are:

- Defeated.
- Discarded.
- Spent Event Cards.
- Removed by another card effect.

Cards remain in the Compost pile for the duration of the game unless another card effect specifically states otherwise.

Cards are never shuffled back into the deck during a standard game.

---

# Game Setup

1. Each player presents a legal deck.
2. Shuffle your deck.
3. Draw an opening hand of **7 cards**.
4. If your opening hand contains no Energy Cards, you may take one mulligan.
5. Randomly determine the starting player (coin flip, highest card drawn, or another mutually agreed method).
6. Begin Round 1.

---

# Mulligan

If a player's opening hand contains **no Energy Cards**, they may take one mulligan.

To take a mulligan:

1. Reveal the opening hand.
2. Shuffle the entire hand back into the deck.
3. Draw a new opening hand of seven cards.

Only one mulligan may be taken.

---

# Turn Structure

A standard game consists of **26 rounds**.

Each player takes one turn during every round.

Every turn consists of five phases.

---

## Phase 1 — Refresh

Restore every Exhausted card you control unless a card effect states otherwise.

Refreshing a card removes its Exhausted state.

---

## Phase 2 — Draw

Draw one card from your deck.

If a player is required to draw a card and their deck is empty, that player immediately loses the game.

---

## Phase 3 — Main Phase

During your Main Phase you may perform game actions in any order.

These actions include:

- Play one or more Energy Cards.
- Play Flora Cards by paying their Energy Costs.
- Play Fauna Cards by paying their Energy Costs.
- Play Event Cards by paying their Energy Costs.
- Activate abilities.
- Resolve card effects.

A player may perform any number of legal actions during their Main Phase provided all costs and requirements can be paid.

---

## Phase 4 — Challenge Phase

Declare Challenges using eligible Ready Flora or Fauna Cards.

Resolve each Challenge completely before declaring another.

The number of Challenges is limited only by:

- Available Ready cards.
- Card abilities.
- Other game effects.

---

## Phase 5 — End Phase

Resolve all end-of-turn effects.

Play passes to the next player.

---

# End of Round

After every player has completed their turn, the round ends.

Begin the next round.

After Round 26 has been completed, calculate each player's final score.

---

# Scoring

Only cards remaining in play score points.

Cards in the Compost pile score **0** points.

---

## Energy

Ready Energy Cards score their Printed Rank.

Exhausted Energy Cards score:

```text
Printed Rank −1
```

---

## Flora

Ready Flora Cards score their Printed Rank.

Exhausted Flora Cards score:

```text
Printed Rank −1
```

---

## Fauna

Ready Fauna Cards score their Printed Rank.

Exhausted Fauna Cards score:

```text
Printed Rank −1
```

---

## Events

Event Cards never score points.

After resolving, they are placed into the Compost pile.

---

# Victory

After scoring every card remaining in play:

- The player with the highest total score wins.
- If the scores are equal, each tied player draws the top card of their deck.
- A player who cannot draw a card because their deck is empty loses the game.
- Otherwise, the player who drew the card with the higher Printed Rank wins.
- If the drawn cards have the same Printed Rank, repeat this process until one player wins.

---

# Card Structure

Every card consists of two independent sections:

1. **Mechanics** — Information used by the game engine.
2. **Metadata** — Information presented to the player.

---

# Mechanics

The mechanics section contains all gameplay information.

## Required Fields

| Field | Description |
|------|-------------|
| id | Unique card identifier. |
| rank | Printed Rank used during gameplay. |
| suit | Energy, Flora, Fauna, or Event. |
| cost | Energy required to play the card. |
| abilities | Gameplay effects performed by the card. |

---

## Mechanics Example

```json
{
    "mechanics": {
        "id": 410,
        "rank": 4,
        "suit": "Fauna",
        "cost": 2,
        "abilities": [
            "Example ability."
        ]
    }
}
```

---

# Metadata

Metadata has no effect on gameplay.

Metadata exists for presentation, artwork, educational content, and identification.

## Required Fields

| Field | Description |
|------|-------------|
| name | Common name displayed on the card. |
| scientific_name | Scientific name. |
| fact | Educational facts. |
| illustration | Artwork filename or asset reference. |
| artist | Illustration credit. |
| expansion | Expansion name. |
| rarity | Card rarity. |

---

## Metadata Example

```json
{
    "metadata": {
        "name": "Bobcat",
        "scientific_name": "Lynx rufus",
        "fact": [
            "Bobcats occur throughout much of North America.",
            "They hunt rabbits, rodents, birds, and reptiles."
        ],
        "illustration": "artwork/bobcat.svg",
        "artist": "Tearran Studios",
        "expansion": "Alpha",
        "rarity": "Rare"
    }
}
```

---

## Complete Card Example

```json
{
    "mechanics": {
        "id": 410,
        "rank": 4,
        "suit": "Fauna",
        "cost": 2,
        "abilities": [
            "Example ability."
        ]
    },
    "metadata": {
        "name": "Bobcat",
        "scientific_name": "Lynx rufus",
        "fact": [
            "Example fact."
        ],
        "illustration": "artwork/bobcat.svg",
        "artist": "Tearran Studios",
        "expansion": "Alpha",
        "rarity": "Rare"
    }
}
```

---

# Design Philosophy

Every card should represent a real ecological relationship.

Gameplay should emerge from ecological interactions rather than abstract fantasy mechanics.

Cards are designed around real organisms, habitats, ecological resources, and natural processes.

---

# Card Design Principles

When designing a new card:

- It should represent something that exists in nature.
- Mechanics should reflect observable ecological behavior whenever possible.
- Educational content should remain scientifically accurate.
- Gameplay should remain simple and consistent.

---

# Rank Guidelines

Rank represents a card's relative ecological influence within the game.

Higher Rank generally indicates:

- Greater ecological importance.
- Greater gameplay impact.
- Higher Energy Cost.
- More complex abilities.

Ranks should increase gradually throughout an expansion.

---

## Low Rank

Typical characteristics:

- Common species.
- Small organisms.
- Simple habitat features.
- Few abilities.
- Low Energy Cost.

---

## Medium Rank

Typical characteristics:

- Larger organisms.
- Specialized ecological roles.
- Multiple abilities.
- Moderate Energy Cost.

---

## High Rank

Typical characteristics:

- Apex organisms.
- Keystone species.
- Major habitat features.
- Powerful abilities.
- High Energy Cost.

---

# Energy Design

Energy represents ecological resources available within an ecosystem.

Energy Cards do **not** represent a specific item being consumed.

Instead, the artwork and educational content illustrate examples of ecological resources.

Examples may include:

- Water sources
- Seeds
- Fruit
- Carrion
- Small animals
- Insects
- Other natural biomass

Mechanically, every Energy Card functions the same unless another card ability explicitly states otherwise.

---

# Flora Design

Flora Cards represent plants and habitat features that remain within the ecosystem.

Examples include:

- Trees
- Shrubs
- Cacti
- Meadows
- Fallen Logs
- Wetlands
- Rock Shelters

Flora cards generally provide:

- Shelter
- Protection
- Passive abilities
- Ecological support
- Long-term ecosystem benefits

---

# Fauna Design

Fauna Cards represent living organisms.

Examples include:

- Mammals
- Birds
- Fish
- Amphibians
- Reptiles
- Insects
- Arachnids

Fauna cards generally:

- Challenge opposing cards.
- Interact with Flora.
- Interact with Events.
- Possess most active abilities.

---

# Event Design

Event Cards represent temporary ecological processes.

Examples include:

- Weather
- Wildfire
- Flood
- Drought
- Disease
- Human impacts
- Invasive species
- Seasonal changes

Event Cards should create temporary changes rather than permanent board states.

---

# Ability Design

Abilities should represent real ecological behavior whenever practical.

Examples include:

- Camouflage
- Burrowing
- Migration
- Pollination
- Seed dispersal
- Pack hunting
- Scavenging
- Nesting
- Hibernation
- Symbiosis

Avoid abstract or fantasy abilities unless an expansion intentionally introduces them.

---

# Educational Content

Educational content exists independently from gameplay.

Facts should:

- Be scientifically accurate.
- Be easy to understand.
- Teach something interesting.
- Never explain game mechanics.

---

# Artwork

Artwork should accurately represent the subject.

Illustrations should prioritize:

- Correct anatomy.
- Correct coloration when color is used.
- Characteristic behavior.
- Recognizable habitat.
- Scientifically recognizable features.

Artistic style may vary, but biological accuracy should remain a priority.

---

# Expansion Design

Each expansion represents a geographic region or ecosystem.

Examples include:

- National Forest
- Ranger District
- Watershed
- Desert
- Mountain Range
- Prairie
- Wetland
- Island Ecosystem

Cards within an expansion should naturally occur within the represented region whenever possible.

---

# Balance Principles

When designing cards:

- Rank should reflect ecological importance.
- Energy Cost should reflect ecological effort.
- Abilities should reinforce ecological identity.
- No single card should dominate without meaningful cost or counterplay.

---

# Consistency

When multiple cards represent the same organism:

- Scientific accuracy should remain consistent.
- Educational facts should not contradict previous printings.
- Artwork may vary.
- Mechanics may change to represent:

  - Different habitats
  - Different life stages
  - Seasonal behavior
  - Regional variation

---

# Design Goals

Every new card should strive to:

- Represent a real organism, habitat, ecological resource, or natural process.
- Teach something about the natural world.
- Remain scientifically grounded.
- Be mechanically clear.
- Fit naturally within its expansion.
- Contribute meaningful gameplay decisions.

---

# Standard Deck Composition

A standard deck contains **52 cards**.

Each suit contains **13 cards**.

| Suit | Cards | Represents |
|------|------:|------------|
| Energy | 13 | Ecological resources used to sustain life and pay Energy Costs. |
| Flora | 13 | Plants and habitat features that remain in play. |
| Fauna | 13 | Living organisms that remain in play. |
| Event | 13 | Temporary ecological processes. |

---

# Future Development

The following areas remain open for future refinement:

- Ability keyword library.
- Expansion guidelines.
- AI behavior.
- Solo play.
- Cooperative play.
- Tournament formats.
- Educational scenarios.
- Additional deck formats.

---

# Revision History

**Alpha Draft**

This document serves as the living design document for *Into the Wild*.

As the game mechanics stabilize, this document may later be separated into:

- Core Game Engine
- Card Specification
- Card Design Guide
- Ability Style Guide
- Keyword Reference
- Expansion Guide
- Tournament Rules
- Player Rulebook

# Into the Wild — Keyword Reference

## Purpose

This document defines the official gameplay terminology used throughout *Into the Wild*.

All cards, rules, and future expansions should use these keywords consistently.

---

# Ability

The gameplay text printed on a card.

Abilities define what a card does and how it interacts with the game.

---

# Challenge

An interaction initiated by a Ready Flora/Fauna Card against an eligible opposing Flora/Fauna Card.

Challenges are resolved using Effective Rank unless modified by another card effect.

---

# Compost

The discard pile.

Cards placed into the Compost pile are removed from play.

Cards remain in the Compost pile unless another card effect specifically states otherwise.

---

# Cost

The required Energy that must be paid before a card may be played.

---

# Defeat

When a Flora/Fauna Card loses a Challenge and is placed into the Compost pile.

---

# Discard

To move a card from a player's hand to the Compost pile.

---

# Draw

To take the top card of your deck and place it into your hand.

---

# Effective Rank

The value used whenever a card's Rank is compared during gameplay.

Effective Rank may differ from Printed Rank due to gameplay effects.

---

# Energy

A gameplay resource used to pay the Energy Cost of cards.

---

# Energy Cost

The amount of Energy required to play a card.

---

# Event

A temporary card that resolves its abilities before being placed into the Compost pile.

---

# Exhaust

To rotate or otherwise mark a Ready card as having been used.

An Exhausted card:

* Cannot declare another Challenge.
* Has an Effective Rank reduced by 2.
* Remains Exhausted until refreshed.

---

# Expansion

A published collection of cards representing a geographic region or ecosystem.


---

# Metadata

Information that identifies or describes a card but has no direct effect on gameplay.

Examples include:

* Name
* Scientific Name
* Facts
* Artwork
* Artist
* Expansion
* Rarity

---

# Mechanics

The gameplay information that determines how a card functions.

Examples include:

* Rank
* Type
* Subtype
* Energy Cost
* Abilities

---

# Mulligan

A one-time replacement of an opening hand that contains no Energy Cards.

---

# Opponent

Any player other than yourself.

---

# Pay

To exhaust the required Energy Cards needed to satisfy a card's Energy Cost.

Paid Energy Cards remain in play unless a card effect says otherwise.

---

# Permanent

A card that remains in play after being played.

Energy Cards and Habitat Cards are permanent cards unless removed.

---

# Play

To place a card from your hand into play after paying its Energy Cost.

Event Cards resolve immediately after being played.

---

# Rank

The Rank printed on a card.

---

# Ready

The normal state of a card.

A Ready card is not Exhausted.

---

# Restore

To remove the Exhausted state from a card.

Refreshing does not otherwise change a card.

---

# Remove

To move a card from play to another game zone as directed by a card effect.

Unless otherwise stated, removed cards are placed into the Compost pile.

---

# Resolve

To carry out a card's abilities completely before continuing gameplay.

---

# Round

A complete cycle in which every player takes one turn.

A standard game lasts 26 rounds.

---

# Score

The total value of a player's cards remaining in play at the end of the game.

Scoring is determined by the Core Game Engine.

---

# Trigger

A condition that causes an ability to resolve automatically.

Example:

```text
When this card enters play...
```

---

# Turn

A single player's opportunity to perform game actions.

Each turn consists of the phases defined in the Core Game Engine.

---

# Type

The primary gameplay classification of a card.

Types are:

* Energy
* Habitat
* Event

---

#  Energy

Energy representing available biomass.

---

# Win

A player wins by satisfying the victory conditions defined by the Core Game Engine or the selected game format.

---

# Into the Wild — Ability Style Guide

## Purpose

This document defines the writing style and formatting conventions used for card abilities.

Gameplay rules are defined in **core-game-engine.md**.

Card structure is defined in **card-specification.md**.

This guide ensures that all abilities are written consistently and interpreted the same way by players.

---

# Design Principles

Abilities should be:

- Clear
- Concise
- Unambiguous
- Self-contained

Avoid unnecessary flavor text inside abilities.

Flavor belongs in the card's facts, not its mechanics.

---

# Writing Style

Write abilities using imperative language.

Good examples:

```text
Draw 1 card.
```

```text
Exhaust this card.
```

```text
Refresh 1 Energy.
```

Avoid conversational wording.

Avoid describing why something happens.

Describe only what happens.

---

# One Effect Per Line

Each bullet should describe one effect.

Good

```text
- Draw 1 card.
- Exhaust this card.
```

Avoid

```text
Draw 1 card and Exhaust this card.
```

unless both actions always happen together.

---

# Targeting

Always identify the target.

Examples

```text
One fauna you control
```

```text
One opposing flora
```

```text
All Energy cards
```

```text
Each player
```

Avoid vague wording like

```text
a card
```

---

# Timing

When an ability has timing, state it first.

Examples

```text
When played:
```

```text
When this card enters play:
```

```text
When challenged:
```

```text
At the start of your turn:
```

```text
At the end of the round:
```

---

# Numbers

Always use numerals.

Good

```text
Draw 2 cards.
```

Not

```text
Draw two cards.
```

---

# Card References

Refer to cards by their type.

Examples

```text
Energy Card
```

```text
Flora Card
```

```text
Fauna Card
```

```text
Event Card
```

Do not reference artwork or flavor text.

---

# Rank References


```text
Rank
```

when the distinction matters.

---

# Common Keywords

Examples include:

```text
Play
```

```text
Exhaust
```

```text
Refresh
```

```text
Challenge
```

```text
Discard
```

```text
Compost
```

```text
Draw
```

```text
Restore
```

```text
Remove
```

```text
Pay
```

Use these terms consistently throughout the game.

---

# Ability Examples

## Activated

```text
Exhaust this card:
Draw 1 card.
```

---

## Triggered

```text
When this card enters play:

Refresh 1 Energy.
```

---

## Passive

```text
Adjacent Herbivores have +1 Effective Rank.
```

---

## Event

```text
Remove 1 opposing Habitat Card with Printed Rank 3 or less.
```

---

### Standard Deck Composition

A standard deck contains exactly **52 cards**.

The deck is organized into four card categories, each containing one card of every Printed Rank from 1 through 13.

| Category | Cards |
|----------|------:|
| Energy | 13 |
| Flora | 13 |
| Fauna | 13 |
| Event | 13 |

Total: **52 cards**

---

### Rank Distribution

Each category contains exactly one card of every Printed Rank.

| Printed Rank | Energy | Flora | Fauna | Event |
|-------------:|:------:|:-----:|:-----:|:-----:|
| 1 | ✓ | ✓ | ✓ | ✓ |
| 2 | ✓ | ✓ | ✓ | ✓ |
| 3 | ✓ | ✓ | ✓ | ✓ |
| 4 | ✓ | ✓ | ✓ | ✓ |
| 5 | ✓ | ✓ | ✓ | ✓ |
| 6 | ✓ | ✓ | ✓ | ✓ |
| 7 | ✓ | ✓ | ✓ | ✓ |
| 8 | ✓ | ✓ | ✓ | ✓ |
| 9 | ✓ | ✓ | ✓ | ✓ |
| 10 | ✓ | ✓ | ✓ | ✓ |
| 11 | ✓ | ✓ | ✓ | ✓ |
| 12 | ✓ | ✓ | ✓ | ✓ |
| 13 | ✓ | ✓ | ✓ | ✓ |

---

# Standard Format

A legal Standard deck contains:

- One Energy card of each Printed Rank.
- One Flora card of each Printed Rank.
- One Fauna card of each Printed Rank.
- One Event card of each Printed Rank.

No duplicate cards are permitted.

