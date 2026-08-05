package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

type rawCard struct {
	Mechanics struct {
		ID      int      `json:"id"`
		Rank    int      `json:"rank"`
		Suit    string   `json:"suit"`
		Cost    int      `json:"cost"`
		Effects []string `json:"effects"`
	} `json:"mechanics"`
	Metadata struct {
		Name string `json:"name"`
	} `json:"metadata"`
}

type CardDef struct {
	ID      int      `json:"id"`
	Name    string   `json:"name"`
	Suit    string   `json:"suit"`
	Rank    int      `json:"rank"`
	Cost    int      `json:"cost"`
	Effects []string `json:"effects"`
}

type CardCatalog struct {
	cards map[int]CardDef
	deck  []int
}

func LoadCatalog(root string) (*CardCatalog, error) {
	files := []string{"energy.json", "support.json", "wildlife.json", "events.json"}
	cards := make(map[int]CardDef)
	deck := make([]int, 0, 52)
	for _, name := range files {
		path := filepath.Join(root, name)
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", path, err)
		}
		var raw []rawCard
		if err := json.Unmarshal(data, &raw); err != nil {
			return nil, fmt.Errorf("parse %s: %w", path, err)
		}
		for _, entry := range raw {
			def := CardDef{
				ID:      entry.Mechanics.ID,
				Name:    entry.Metadata.Name,
				Suit:    entry.Mechanics.Suit,
				Rank:    entry.Mechanics.Rank,
				Cost:    entry.Mechanics.Cost,
				Effects: append([]string(nil), entry.Mechanics.Effects...),
			}
			cards[def.ID] = def
			deck = append(deck, def.ID)
		}
	}
	sort.Ints(deck)
	return &CardCatalog{cards: cards, deck: deck}, nil
}

func (c *CardCatalog) MustCard(id int) CardDef {
	card, ok := c.cards[id]
	if !ok {
		panic(fmt.Sprintf("unknown card id %d", id))
	}
	return card
}

func (c *CardCatalog) StandardDeck() []int {
	return append([]int(nil), c.deck...)
}
