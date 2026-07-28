# Into the Wild — Core Game Engine

## Game Objective

Into the Wild is a strategy card game where players build and maintain ecosystems by managing ecological resources and introducing organisms into play.

A standard game lasts **26 rounds**.

At the end of the final round, players calculate their scores. The player with the highest score wins. If both players have the same score, the game ends in a tie.

---

# Card Types

Every card belongs to one of three card types.

| Card Type | Purpose                                                                 |
| --------- | ----------------------------------------------------------------------- |
| Energy    | Produces ecological resources used to pay Energy Costs.                 |
| Habitat   | Represents permanent organisms or habitat features within an ecosystem. |
| Event     | Represents temporary ecological effects that resolve immediately.       |

---

# Energy

Three Energy types exist.

* Water Energy
* Flora Energy
* Fauna Energy

Energy Cards are exhausted to pay Energy Costs.

Energy Cards refresh during the Refresh Phase.

Energy Cards remain in play unless removed by a card effect.

---

# Habitat Cards

Habitat Cards represent permanent organisms or habitat features.

Habitat Cards remain in play until:

* Defeated during a Challenge.
* Removed by an Event.
* Removed by another card effect.

---

# Event Cards

Event Cards are temporary effects.

After resolving, Event Cards are placed into the Compost pile.

Event Cards never remain in play unless another card specifically states otherwise.

---

# Rank

Every card has a Printed Rank.

Printed Rank never changes.

Some game effects modify a card's Effective Rank.

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

Exhaustion represents a card that has already acted.

An Exhausted card:

* Has Effective Rank equal to Printed Rank −2.
* Cannot declare another Challenge.
* Remains Exhausted until refreshed.

---

# Restore

During the Refresh Phase:

* All Exhausted Energy Cards become Ready.
* All Exhausted Habitat Cards become Ready.

Refreshing removes the Exhausted state.

---

# Energy Costs

Cards with an Energy Cost require matching Energy Cards to be exhausted before they may be played.

Example

```json
"cost": {
    "water": 1,
    "flora": 1,
    "fauna": 1
}
```

Only matching Energy types may be used to pay a cost.

---

# Challenges

Challenges are interactions between Habitat Cards.

Only Ready Habitat Cards may declare Challenges.

Habitat Cards may challenge opposing Habitat Cards.

Event Cards may affect any cards described by their abilities.

Energy Cards cannot initiate Challenges.

---

## Declaring a Challenge

1. Choose one Ready Habitat Card you control as the challenger.
2. Choose one eligible opposing Habitat Card as the defender.
3. Resolve any abilities that trigger when the Challenge is declared.
4. Compare the Effective Rank of both Habitat Cards.
5. Resolve the outcome of the Challenge.
6. If the challenging Habitat Card remains in play, Exhaust it.

---

## Challenge Resolution

* The Habitat Card with the higher Effective Rank wins.
* The Habitat Card with the lower Effective Rank is placed into the Compost pile unless another card effect states otherwise.
* If both Habitat Cards have the same Effective Rank, both are placed into the Compost pile.

Resolve all triggered abilities before continuing play.

---

# Compost Pile

The Compost pile is the discard pile.

Cards are placed into the Compost pile when they are:

* Defeated.
* Discarded.
* Spent Event Cards.
* Removed by another card effect.

Cards in the Compost pile remain there for the duration of the game unless another card effect specifically states otherwise.

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

---

## Phase 1 — Draw

Draw one card from your deck.

If a player is required to draw a card and their deck is empty, that player immediately loses the game.

---

## Phase 2 — Main Phase

During your Main Phase, you may perform game actions in any order.

These actions include:

- Play Energy Cards.
- Play Habitat Cards by paying their Energy Costs.
- Play Event Cards by paying their Energy Costs.
- Activate card abilities.
- Resolve card effects.

A player may perform any number of actions during their Main Phase, provided all costs, requirements, and card abilities allow them.

---

## Phase 3 — Challenge Phase

Declare Challenges using eligible Ready Habitat Cards.

Resolve each Challenge completely before declaring another.

The number of Challenges is limited only by:

* Available Ready Habitat Cards.
* Available Energy.
* Card abilities.
* Other game effects.

---

## Phase 4 — End Phase

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

## Energy Cards

Ready Energy Cards score their Printed Rank.

Exhausted Energy Cards score:

```text
Printed Rank −1
```

---

## Habitat Cards

Ready Habitat Cards score their Printed Rank.

Exhausted Habitat Cards score:

```text
Printed Rank −1
```

---

## Event Cards

Event Cards do not score points.

After resolving, they are placed into the Compost pile.

---

# Victory

After scoring all cards remaining in play:

* The player with the highest total score wins.
* Equal scores result in a tie game.
