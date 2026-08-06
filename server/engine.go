package main

import (
	crand "crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"math/rand"
	"sort"
)

type Phase string

const (
	PhaseSetup     Phase = "setup"
	PhaseMulligan  Phase = "mulligan"
	PhaseRefresh   Phase = "refresh"
	PhaseDraw      Phase = "draw"
	PhaseMain      Phase = "main"
	PhaseChallenge Phase = "challenge"
	PhaseEnd       Phase = "end"
	PhaseGameOver  Phase = "gameover"
)

type ZoneCard struct {
	InstanceID string   `json:"instanceId"`
	CardID     int      `json:"cardId"`
	Exhausted  bool     `json:"exhausted"`
	Hosted     []string `json:"hosted,omitempty"`
	Host       string   `json:"host,omitempty"`
}

type PlayerState struct {
	Index            int        `json:"index"`
	Deck             []int      `json:"-"`
	Hand             []string   `json:"hand"`
	Board            []ZoneCard `json:"board"`
	Compost          []int      `json:"compost"`
	EnergyPool       int        `json:"energyPool"`
	MulliganResolved bool       `json:"mulliganResolved"`
	MulliganUsed     bool       `json:"mulliganUsed"`
}

type PendingChoice struct {
	Type            string   `json:"type"`
	PlayerIndex     int      `json:"playerIndex"`
	SourceInstance  string   `json:"sourceInstanceId,omitempty"`
	AllowedInstance []string `json:"allowedInstanceIds,omitempty"`
	Prompt          string   `json:"prompt"`
}

type PendingChallenge struct {
	AttackerPlayer int    `json:"attackerPlayer"`
	Attacker       string `json:"attackerInstanceId"`
	DefenderPlayer int    `json:"defenderPlayer"`
	Defender       string `json:"defenderInstanceId"`
}

type GameState struct {
	Version          string            `json:"version"`
	Phase            Phase             `json:"phase"`
	Round            int               `json:"round"`
	CurrentPlayer    int               `json:"currentPlayer"`
	Winner           *int              `json:"winner,omitempty"`
	LoseReason       string            `json:"loseReason,omitempty"`
	PendingChoice    *PendingChoice    `json:"pendingChoice,omitempty"`
	PendingChallenge *PendingChallenge `json:"pendingChallenge,omitempty"`
	Players          [2]PlayerState    `json:"players"`
	Log              []string          `json:"log"`
	nextInstance     int
}

type Action struct {
	Type             string `json:"type"`
	AttackerInstance string `json:"attackerInstanceId,omitempty"`
	DefenderInstance string `json:"defenderInstanceId,omitempty"`
	SourceInstance   string `json:"sourceInstanceId,omitempty"`
	TargetInstance   string `json:"targetInstanceId,omitempty"`
	Choice           string `json:"choice,omitempty"`
}

type Engine struct {
	cards *CardCatalog
}

func NewEngine(cards *CardCatalog) *Engine { return &Engine{cards: cards} }

func secureSeed() int64 {
	var b [8]byte
	if _, err := crand.Read(b[:]); err != nil {
		panic(err)
	}
	return int64(binary.LittleEndian.Uint64(b[:]))
}

func (e *Engine) NewGame() (*GameState, error) {
	state := &GameState{Version: "v1alpha1", Phase: PhaseMulligan, Round: 1}
	state.CurrentPlayer = 0
	for i := 0; i < 2; i++ {
		deck := e.cards.StandardDeck()
		r := rand.New(rand.NewSource(secureSeed()))
		r.Shuffle(len(deck), func(i, j int) { deck[i], deck[j] = deck[j], deck[i] })
		state.Players[i] = PlayerState{Index: i, Deck: deck}
		if err := e.drawCards(state, i, 7); err != nil {
			return nil, err
		}
	}
	return state, nil
}

func (e *Engine) drawCards(state *GameState, player, count int) error {
	for i := 0; i < count; i++ {
		p := &state.Players[player]
		if len(p.Deck) == 0 {
			winner := 1 - player
			state.Winner = &winner
			state.Phase = PhaseGameOver
			state.LoseReason = fmt.Sprintf("player %d could not draw from an empty deck", player)
			return errors.New(state.LoseReason)
		}
		cardID := p.Deck[0]
		p.Deck = p.Deck[1:]
		p.Hand = append(p.Hand, e.newInstance(state, cardID))
	}
	return nil
}

func (e *Engine) newInstance(state *GameState, cardID int) string {
	state.nextInstance++
	return fmt.Sprintf("c%d_%d", cardID, state.nextInstance)
}

func (e *Engine) cardIDFromInstance(instance string) (int, bool) {
	var id, seq int
	if _, err := fmt.Sscanf(instance, "c%d_%d", &id, &seq); err != nil {
		return 0, false
	}
	_, ok := e.cards.cards[id]
	return id, ok
}

func (e *Engine) Apply(state *GameState, player int, action Action) error {
	if state.Phase == PhaseGameOver {
		return errors.New("game is over")
	}
	if state.PendingChallenge != nil && action.Type != "resolveChallenge" {
		return errors.New("challenge must resolve before other actions")
	}
	if state.PendingChoice != nil && action.Type != "chooseHostedWildlife" && action.Type != "mulliganDecision" {
		return errors.New("pending choice must resolve first")
	}
	switch action.Type {
	case "mulliganDecision":
		return e.applyMulligan(state, player, action.Choice)
	case "advancePhase":
		return e.advancePhase(state, player)
	case "playCard":
		return e.playCard(state, player, action.SourceInstance)
	case "declareChallenge":
		return e.declareChallenge(state, player, action.AttackerInstance, action.DefenderInstance)
	case "resolveChallenge":
		return e.resolveChallenge(state)
	case "chooseHostedWildlife":
		return e.chooseHostedWildlife(state, player, action.SourceInstance, action.TargetInstance)
	default:
		return fmt.Errorf("unknown action type %q", action.Type)
	}
}

func (e *Engine) applyMulligan(state *GameState, player int, choice string) error {
	if state.Phase != PhaseMulligan {
		return errors.New("not in mulligan phase")
	}
	p := &state.Players[player]
	if p.MulliganResolved {
		return errors.New("mulligan already resolved")
	}
	switch choice {
	case "keep":
		p.MulliganResolved = true
	case "mulligan":
		if p.MulliganUsed {
			return errors.New("second mulligan rejected")
		}
		p.MulliganUsed = true
		p.MulliganResolved = true
		for _, inst := range p.Hand {
			id, _ := e.cardIDFromInstance(inst)
			p.Deck = append(p.Deck, id)
		}
		p.Hand = nil
		r := rand.New(rand.NewSource(secureSeed()))
		r.Shuffle(len(p.Deck), func(i, j int) { p.Deck[i], p.Deck[j] = p.Deck[j], p.Deck[i] })
		if err := e.drawCards(state, player, 7); err != nil {
			return err
		}
	default:
		return errors.New("invalid mulligan decision")
	}
	if state.Players[0].MulliganResolved && state.Players[1].MulliganResolved {
		state.Phase = PhaseRefresh
		state.CurrentPlayer = 0
	}
	return nil
}

func (e *Engine) advancePhase(state *GameState, player int) error {
	if state.Phase == PhaseMulligan {
		return errors.New("play blocked until both decisions resolve")
	}
	if player != state.CurrentPlayer {
		return errors.New("not current player")
	}
	switch state.Phase {
	case PhaseRefresh:
		energy := 0
		for i := range state.Players[player].Board {
			state.Players[player].Board[i].Exhausted = false
			def := e.cards.MustCard(state.Players[player].Board[i].CardID)
			if hasEffect(def, "Generate 1 Energy per turn.") {
				energy++
			}
		}
		state.Players[player].EnergyPool = energy
		state.Phase = PhaseDraw
		return nil
	case PhaseDraw:
		if err := e.drawCards(state, player, 1); err != nil {
			return nil
		}
		state.Phase = PhaseMain
		return nil
	case PhaseMain:
		state.Phase = PhaseChallenge
		return nil
	case PhaseChallenge:
		state.Phase = PhaseEnd
		return nil
	case PhaseEnd:
		if player == 0 {
			state.CurrentPlayer = 1
			state.Phase = PhaseRefresh
			return nil
		}
		if state.Players[0].HandCount() == 0 || state.Players[1].HandCount() == 0 {
			return e.endGame(state)
		}
		state.Round++
		state.CurrentPlayer = 0
		state.Phase = PhaseRefresh
		return nil
	default:
		return fmt.Errorf("cannot advance phase from %s", state.Phase)
	}
}

func (p *PlayerState) HandCount() int { return len(p.Hand) }

func (e *Engine) playCard(state *GameState, player int, instance string) error {
	if state.Phase != PhaseMain {
		return errors.New("can only play cards in main phase")
	}
	if player != state.CurrentPlayer {
		return errors.New("not current player")
	}
	idx := indexOf(state.Players[player].Hand, instance)
	if idx < 0 {
		return errors.New("card not in hand")
	}
	cardID, _ := e.cardIDFromInstance(instance)
	def := e.cards.MustCard(cardID)
	if def.Suit != "energy" && def.Cost > 0 {
		if state.Players[player].EnergyPool < def.Cost {
			return fmt.Errorf("not enough energy: need %d, have %d", def.Cost, state.Players[player].EnergyPool)
		}
		state.Players[player].EnergyPool -= def.Cost
	}
	state.Players[player].Hand = removeString(state.Players[player].Hand, idx)
	if def.Suit == "event" {
		state.Players[player].Compost = append(state.Players[player].Compost, cardID)
		return nil
	}
	state.Players[player].Board = append(state.Players[player].Board, ZoneCard{InstanceID: instance, CardID: cardID})
	if hasEffect(def, "Move 1 Wildlife to this card.") {
		allowed := e.legalHostTargets(state, player, instance)
		if len(allowed) > 0 {
			state.PendingChoice = &PendingChoice{Type: "moveWildlifeToSupport", PlayerIndex: player, SourceInstance: instance, AllowedInstance: allowed, Prompt: "Select 1 Wildlife to host."}
		} else {
			state.Log = append(state.Log, def.Name+": no legal Wildlife to host.")
		}
	}
	return nil
}

func (e *Engine) legalHostTargets(state *GameState, player int, supportInstance string) []string {
	var allowed []string
	for _, card := range state.Players[player].Board {
		def := e.cards.MustCard(card.CardID)
		if def.Suit == "wildlife" && card.InstanceID != supportInstance {
			allowed = append(allowed, card.InstanceID)
		}
	}
	sort.Strings(allowed)
	return allowed
}

func (e *Engine) chooseHostedWildlife(state *GameState, player int, source, target string) error {
	choice := state.PendingChoice
	if choice == nil || choice.Type != "moveWildlifeToSupport" {
		return errors.New("no hosted wildlife choice pending")
	}
	if choice.PlayerIndex != player || choice.SourceInstance != source {
		return errors.New("invalid choice owner")
	}
	if indexOf(choice.AllowedInstance, target) < 0 {
		return errors.New("invalid hosted wildlife target")
	}
	supportCard, _, ok := findBoardCard(&state.Players[player], source)
	if !ok {
		return errors.New("support card not found")
	}
	wildlifeCard, wildlifeIndex, ok := findBoardCard(&state.Players[player], target)
	if !ok {
		return errors.New("wildlife card not found")
	}
	if wildlifeCard.Host != "" {
		prevSupport, _, ok := findBoardCard(&state.Players[player], wildlifeCard.Host)
		if ok {
			prevSupport.Hosted = removeStringValue(prevSupport.Hosted, wildlifeCard.InstanceID)
		}
	}
	state.Players[player].Board[wildlifeIndex].Host = supportCard.InstanceID
	if indexOf(supportCard.Hosted, wildlifeCard.InstanceID) < 0 {
		supportCard.Hosted = append(supportCard.Hosted, wildlifeCard.InstanceID)
		sort.Strings(supportCard.Hosted)
	}
	state.PendingChoice = nil
	return nil
}

func (e *Engine) declareChallenge(state *GameState, player int, attackerInstance, defenderInstance string) error {
	if state.Phase != PhaseChallenge {
		return errors.New("wrong phase for challenge")
	}
	if player != state.CurrentPlayer {
		return errors.New("attacker must belong to active player")
	}
	attacker, _, ok := findBoardCard(&state.Players[player], attackerInstance)
	if !ok {
		return errors.New("attacker not found")
	}
	defender, _, ok := findBoardCard(&state.Players[1-player], defenderInstance)
	if !ok {
		return errors.New("defender must belong to the opponent")
	}
	attackerDef := e.cards.MustCard(attacker.CardID)
	defenderDef := e.cards.MustCard(defender.CardID)
	if attackerDef.Suit != "support" && attackerDef.Suit != "wildlife" {
		return errors.New("invalid attacker type")
	}
	if defenderDef.Suit != "support" && defenderDef.Suit != "wildlife" {
		return errors.New("invalid target type")
	}
	if attacker.Exhausted {
		return errors.New("exhausted attacker")
	}
	effect := fmt.Sprintf("Challenge 1 opposing %s.", titleSuit(defenderDef.Suit))
	if !hasEffect(attackerDef, effect) {
		return errors.New("attacker does not permit that target type")
	}
	state.PendingChallenge = &PendingChallenge{AttackerPlayer: player, Attacker: attackerInstance, DefenderPlayer: 1 - player, Defender: defenderInstance}
	return nil
}

func titleSuit(s string) string {
	switch s {
	case "support":
		return "Support"
	case "wildlife":
		return "Wildlife"
	default:
		return s
	}
}

func (e *Engine) resolveChallenge(state *GameState) error {
	pending := state.PendingChallenge
	if pending == nil {
		return errors.New("no pending challenge")
	}
	attacker, _, ok := findBoardCard(&state.Players[pending.AttackerPlayer], pending.Attacker)
	if !ok {
		return errors.New("attacker missing")
	}
	defender, _, ok := findBoardCard(&state.Players[pending.DefenderPlayer], pending.Defender)
	if !ok {
		return errors.New("defender missing")
	}
	attackRank := e.effectiveRank(state, pending.AttackerPlayer, attacker)
	defendRank := e.effectiveRank(state, pending.DefenderPlayer, defender)
	attackerSurvives := attackRank > defendRank
	defenderSurvives := defendRank > attackRank
	attackerLoses := attackRank <= defendRank
	defenderLoses := defendRank <= attackRank
	if attackerLoses {
		if _, idx, ok := findBoardCard(&state.Players[pending.AttackerPlayer], pending.Attacker); ok {
			e.moveBoardCardToCompost(state, pending.AttackerPlayer, idx)
		}
	}
	if defenderLoses {
		if _, idx, ok := findBoardCard(&state.Players[pending.DefenderPlayer], pending.Defender); ok {
			e.moveBoardCardToCompost(state, pending.DefenderPlayer, idx)
		}
	}
	if attackerSurvives {
		if card, _, ok := findBoardCard(&state.Players[pending.AttackerPlayer], pending.Attacker); ok {
			card.Exhausted = true
		}
	}
	_ = defenderSurvives
	state.PendingChallenge = nil
	return nil
}

func (e *Engine) effectiveRank(state *GameState, player int, card *ZoneCard) int {
	def := e.cards.MustCard(card.CardID)
	rank := def.Rank
	if card.Exhausted {
		rank -= 2
	}
	if card.Host != "" {
		if support, _, ok := findBoardCard(&state.Players[player], card.Host); ok {
			hostDef := e.cards.MustCard(support.CardID)
			if hasEffect(hostDef, "Hosted Wildlife gains +2 Rank.") {
				rank += 2
			}
		}
	}
	return rank
}

func (e *Engine) moveBoardCardToCompost(state *GameState, player, index int) {
	card := state.Players[player].Board[index]
	for _, hosted := range append([]string(nil), card.Hosted...) {
		if hostedCard, hostedIndex, ok := findBoardCard(&state.Players[player], hosted); ok {
			state.Players[player].Board[hostedIndex].Host = ""
			_ = hostedCard
		}
	}
	if card.Host != "" {
		if host, _, ok := findBoardCard(&state.Players[player], card.Host); ok {
			host.Hosted = removeStringValue(host.Hosted, card.InstanceID)
		}
	}
	state.Players[player].Compost = append(state.Players[player].Compost, card.CardID)
	state.Players[player].Board = append(state.Players[player].Board[:index], state.Players[player].Board[index+1:]...)
}

func (e *Engine) endGame(state *GameState) error {
	state.Phase = PhaseGameOver
	scores := e.Scores(state)
	if scores[0] > scores[1] {
		winner := 0
		state.Winner = &winner
	} else if scores[1] > scores[0] {
		winner := 1
		state.Winner = &winner
	}
	return nil
}

func (e *Engine) Scores(state *GameState) [2]int {
	var scores [2]int
	for i := range state.Players {
		for _, card := range state.Players[i].Board {
			def := e.cards.MustCard(card.CardID)
			if def.Suit == "energy" || def.Suit == "support" || def.Suit == "wildlife" {
				scores[i] += def.Rank
			}
		}
		for _, inst := range state.Players[i].Hand {
			id, _ := e.cardIDFromInstance(inst)
			def := e.cards.MustCard(id)
			scores[i] -= def.Rank
		}
	}
	return scores
}

func findBoardCard(player *PlayerState, instance string) (*ZoneCard, int, bool) {
	for i := range player.Board {
		if player.Board[i].InstanceID == instance {
			return &player.Board[i], i, true
		}
	}
	return nil, -1, false
}

func hasEffect(def CardDef, effect string) bool {
	for _, item := range def.Effects {
		if item == effect {
			return true
		}
	}
	return false
}

func indexOf(items []string, value string) int {
	for i, item := range items {
		if item == value {
			return i
		}
	}
	return -1
}

func removeString(items []string, index int) []string {
	return append(items[:index], items[index+1:]...)
}

func removeStringValue(items []string, value string) []string {
	idx := indexOf(items, value)
	if idx < 0 {
		return items
	}
	return removeString(items, idx)
}
