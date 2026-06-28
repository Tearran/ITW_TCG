# Into the Wild TCG

Into the Wild is a turn-based trading card game (TCG) themed around U.S. national forest biomes, flora, fauna, and environmental events.

## Alpha Scope
- Set: **ALPHA v0.1**
- Card pool: **32 cards**
- Deck size: **32 minimum**
- Starting hand: **5 cards**
- Ecosystem Health: **20**

## Core Terms
- **Habitat**: in-play area (battle area)
- **Canopy**: hand
- **Compost Pile**: discard pile
- **Bio-Energy Pool**: available Water/Flora/Prey resources

## Resource System
Three Bio-Energy types:
- Water
- Flora
- Prey

Bio-Energy sources provide 1 energy of their type per turn while active.

## Turn Structure
1. **Regrowth** (draw + ready + gain energy)
2. **Habitat Development** (play sources and habitat cards)
3. **Interaction** (attack/defend)
4. **Composting** (remove 0 health cards, discard down to 5)

See `RULES.md` for full rules and timing.

## Card Data
- `cards/alpha-32.csv` contains the complete 32-card ALPHA list.

## Versioning
- Initial target release tag: `v0.1.0-alpha`

## Contributing
Use Issues/PRs for:
- balance feedback
- rules wording clarification
- card text consistency

## License
TBD (recommended: CC BY-NC 4.0 for game content).