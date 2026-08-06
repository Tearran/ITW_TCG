package main

import (
	"path/filepath"
	"testing"
)

func testEngine(t *testing.T) *Engine {
	t.Helper()
	cards, err := LoadCatalog(filepath.Join(".."))
	if err != nil {
		t.Fatal(err)
	}
	return NewEngine(cards)
}

func newTestState(t *testing.T) *GameState {
	t.Helper()
	state, err := testEngine(t).NewGame()
	if err != nil {
		t.Fatal(err)
	}
	return state
}

func setPlayerHand(state *GameState, player int, cardIDs ...int) {
	state.Players[player].Hand = nil
	for _, id := range cardIDs {
		state.nextInstance++
		state.Players[player].Hand = append(state.Players[player].Hand, instance(id, state.nextInstance))
	}
}

func instance(id, seq int) string { return "c" + itoa(id) + "_" + itoa(seq) }
func itoa(v int) string           { return fmtInt(v) }
func fmtInt(v int) string {
	if v == 0 {
		return "0"
	}
	neg := v < 0
	if neg {
		v = -v
	}
	var b [20]byte
	i := len(b)
	for v > 0 {
		i--
		b[i] = byte('0' + (v % 10))
		v /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

func addBoardCard(state *GameState, player, cardID int, exhausted bool) string {
	state.nextInstance++
	inst := instance(cardID, state.nextInstance)
	state.Players[player].Board = append(state.Players[player].Board, ZoneCard{InstanceID: inst, CardID: cardID, Exhausted: exhausted})
	return inst
}

func TestMulligans(t *testing.T) {
	e := testEngine(t)
	t.Run("both keep", func(t *testing.T) {
		s := newTestState(t)
		if err := e.Apply(s, 0, Action{Type: "mulliganDecision", Choice: "keep"}); err != nil {
			t.Fatal(err)
		}
		if s.Phase != PhaseMulligan {
			t.Fatal("should wait for both decisions")
		}
		if err := e.Apply(s, 1, Action{Type: "mulliganDecision", Choice: "keep"}); err != nil {
			t.Fatal(err)
		}
		if s.Phase != PhaseRefresh {
			t.Fatal("should start round after both resolved")
		}
	})
	t.Run("only player 0 mulligans", func(t *testing.T) {
		s := newTestState(t)
		first := append([]string(nil), s.Players[0].Hand...)
		if err := e.Apply(s, 0, Action{Type: "mulliganDecision", Choice: "mulligan"}); err != nil {
			t.Fatal(err)
		}
		if len(s.Players[0].Hand) != 7 {
			t.Fatal("expected seven new cards")
		}
		same := 0
		for i := range s.Players[0].Hand {
			if s.Players[0].Hand[i] == first[i] {
				same++
			}
		}
		if same == 7 {
			t.Fatal("expected new instances after mulligan")
		}
		if err := e.Apply(s, 1, Action{Type: "mulliganDecision", Choice: "keep"}); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("only player 1 mulligans", func(t *testing.T) {
		s := newTestState(t)
		if err := e.Apply(s, 0, Action{Type: "mulliganDecision", Choice: "keep"}); err != nil {
			t.Fatal(err)
		}
		if err := e.Apply(s, 1, Action{Type: "mulliganDecision", Choice: "mulligan"}); err != nil {
			t.Fatal(err)
		}
		if !s.Players[1].MulliganUsed {
			t.Fatal("player 1 should mark mulligan used")
		}
	})
	t.Run("both mulligan", func(t *testing.T) {
		s := newTestState(t)
		if err := e.Apply(s, 0, Action{Type: "mulliganDecision", Choice: "mulligan"}); err != nil {
			t.Fatal(err)
		}
		if err := e.Apply(s, 1, Action{Type: "mulliganDecision", Choice: "mulligan"}); err != nil {
			t.Fatal(err)
		}
		if s.Phase != PhaseRefresh {
			t.Fatal("expected round start")
		}
	})
	t.Run("second mulligan rejected", func(t *testing.T) {
		s := newTestState(t)
		if err := e.Apply(s, 0, Action{Type: "mulliganDecision", Choice: "mulligan"}); err != nil {
			t.Fatal(err)
		}
		if err := e.Apply(s, 0, Action{Type: "mulliganDecision", Choice: "mulligan"}); err == nil {
			t.Fatal("expected rejection")
		}
	})
	t.Run("play blocked until both decisions resolve", func(t *testing.T) {
		s := newTestState(t)
		if err := e.Apply(s, 0, Action{Type: "mulliganDecision", Choice: "keep"}); err != nil {
			t.Fatal(err)
		}
		if err := e.Apply(s, 0, Action{Type: "advancePhase"}); err == nil {
			t.Fatal("expected phase block")
		}
	})
}

func TestChallenges(t *testing.T) {
	e := testEngine(t)
	mkState := func() *GameState {
		s := newTestState(t)
		s.Phase = PhaseChallenge
		s.CurrentPlayer = 0
		s.Players[0].Board = nil
		s.Players[1].Board = nil
		return s
	}
	t.Run("invalid attacker types", func(t *testing.T) {
		s := mkState()
		attacker := addBoardCard(s, 0, 1, false)
		defender := addBoardCard(s, 1, 106, false)
		if err := e.Apply(s, 0, Action{Type: "declareChallenge", AttackerInstance: attacker, DefenderInstance: defender}); err == nil {
			t.Fatal("expected rejection")
		}
	})
	t.Run("invalid target types", func(t *testing.T) {
		s := mkState()
		attacker := addBoardCard(s, 0, 106, false)
		defender := addBoardCard(s, 1, 1, false)
		if err := e.Apply(s, 0, Action{Type: "declareChallenge", AttackerInstance: attacker, DefenderInstance: defender}); err == nil {
			t.Fatal("expected rejection")
		}
	})
	t.Run("wrong owner", func(t *testing.T) {
		s := mkState()
		attacker := addBoardCard(s, 1, 106, false)
		defender := addBoardCard(s, 0, 211, false)
		if err := e.Apply(s, 0, Action{Type: "declareChallenge", AttackerInstance: attacker, DefenderInstance: defender}); err == nil {
			t.Fatal("expected rejection")
		}
	})
	t.Run("wrong phase", func(t *testing.T) {
		s := mkState()
		s.Phase = PhaseMain
		attacker := addBoardCard(s, 0, 106, false)
		defender := addBoardCard(s, 1, 211, false)
		if err := e.Apply(s, 0, Action{Type: "declareChallenge", AttackerInstance: attacker, DefenderInstance: defender}); err == nil {
			t.Fatal("expected rejection")
		}
	})
	t.Run("exhausted attacker", func(t *testing.T) {
		s := mkState()
		attacker := addBoardCard(s, 0, 106, true)
		defender := addBoardCard(s, 1, 211, false)
		if err := e.Apply(s, 0, Action{Type: "declareChallenge", AttackerInstance: attacker, DefenderInstance: defender}); err == nil {
			t.Fatal("expected rejection")
		}
	})
	t.Run("higher lower and equal outcomes", func(t *testing.T) {
		s := mkState()
		a1 := addBoardCard(s, 0, 208, false)
		d1 := addBoardCard(s, 1, 211, false)
		if err := e.Apply(s, 0, Action{Type: "declareChallenge", AttackerInstance: a1, DefenderInstance: d1}); err != nil {
			t.Fatal(err)
		}
		if s.PendingChallenge == nil {
			t.Fatal("pending challenge expected")
		}
		if err := e.Apply(s, 0, Action{Type: "resolveChallenge"}); err != nil {
			t.Fatal(err)
		}
		if _, _, ok := findBoardCard(&s.Players[0], a1); !ok {
			t.Fatal("attacker should survive")
		}
		if _, _, ok := findBoardCard(&s.Players[1], d1); ok {
			t.Fatal("defender should compost")
		}

		s = mkState()
		a2 := addBoardCard(s, 0, 106, false)
		d2 := addBoardCard(s, 1, 203, false)
		if err := e.Apply(s, 0, Action{Type: "declareChallenge", AttackerInstance: a2, DefenderInstance: d2}); err != nil {
			t.Fatal(err)
		}
		if err := e.Apply(s, 0, Action{Type: "resolveChallenge"}); err != nil {
			t.Fatal(err)
		}
		if _, _, ok := findBoardCard(&s.Players[0], a2); ok {
			t.Fatal("attacker should compost")
		}
		if _, _, ok := findBoardCard(&s.Players[1], d2); !ok {
			t.Fatal("defender should survive")
		}

		s = mkState()
		a3 := addBoardCard(s, 0, 211, false)
		d3 := addBoardCard(s, 1, 211, false)
		if err := e.Apply(s, 0, Action{Type: "declareChallenge", AttackerInstance: a3, DefenderInstance: d3}); err != nil {
			t.Fatal(err)
		}
		if err := e.Apply(s, 0, Action{Type: "resolveChallenge"}); err != nil {
			t.Fatal(err)
		}
		if _, _, ok := findBoardCard(&s.Players[0], a3); ok {
			t.Fatal("equal rank attacker should compost")
		}
		if _, _, ok := findBoardCard(&s.Players[1], d3); ok {
			t.Fatal("equal rank defender should compost")
		}
	})
	t.Run("challenge completion blocks then clears", func(t *testing.T) {
		s := mkState()
		a := addBoardCard(s, 0, 106, false)
		d := addBoardCard(s, 1, 211, false)
		if err := e.Apply(s, 0, Action{Type: "declareChallenge", AttackerInstance: a, DefenderInstance: d}); err != nil {
			t.Fatal(err)
		}
		if err := e.Apply(s, 0, Action{Type: "advancePhase"}); err == nil {
			t.Fatal("expected block during pending challenge")
		}
		if err := e.Apply(s, 0, Action{Type: "resolveChallenge"}); err != nil {
			t.Fatal(err)
		}
		if s.PendingChallenge != nil {
			t.Fatal("pending challenge should clear")
		}
	})
}

func TestSupportHostingAndScoring(t *testing.T) {
	e := testEngine(t)
	t.Run("move to host and plus two effective rank", func(t *testing.T) {
		s := newTestState(t)
		s.Phase = PhaseMain
		s.CurrentPlayer = 0
		s.Players[0].Board = nil
		s.Players[0].EnergyPool = 2
		wildlife := addBoardCard(s, 0, 211, false)
		supportInst := instance(107, 999)
		s.Players[0].Hand = []string{supportInst}
		if err := e.Apply(s, 0, Action{Type: "playCard", SourceInstance: supportInst}); err != nil {
			t.Fatal(err)
		}
		if s.PendingChoice == nil {
			t.Fatal("expected pending host choice")
		}
		if err := e.Apply(s, 0, Action{Type: "chooseHostedWildlife", SourceInstance: supportInst, TargetInstance: wildlife}); err != nil {
			t.Fatal(err)
		}
		wc, _, _ := findBoardCard(&s.Players[0], wildlife)
		if wc.Host != supportInst {
			t.Fatal("wildlife should be hosted")
		}
		if got := e.effectiveRank(s, 0, wc); got != 6 {
			t.Fatalf("expected +2 rank bonus, got %d", got)
		}
		if e.cards.MustCard(211).Rank != 4 {
			t.Fatal("printed rank must remain unchanged")
		}
	})
	t.Run("no target behavior", func(t *testing.T) {
		s := newTestState(t)
		s.Phase = PhaseMain
		s.CurrentPlayer = 0
		s.Players[0].Board = nil
		s.Players[0].EnergyPool = 2
		supportInst := instance(107, 1000)
		s.Players[0].Hand = []string{supportInst}
		if err := e.Apply(s, 0, Action{Type: "playCard", SourceInstance: supportInst}); err != nil {
			t.Fatal(err)
		}
		if s.PendingChoice != nil {
			t.Fatal("no wildlife should mean no pending choice")
		}
	})
	t.Run("support removal handling", func(t *testing.T) {
		s := newTestState(t)
		s.Players[0].Board = nil
		support := addBoardCard(s, 0, 107, false)
		wildlife := addBoardCard(s, 0, 211, false)
		sc, _, _ := findBoardCard(&s.Players[0], support)
		wc, wi, _ := findBoardCard(&s.Players[0], wildlife)
		sc.Hosted = []string{wildlife}
		wc.Host = support
		e.moveBoardCardToCompost(s, 0, 0)
		if s.Players[0].Board[wi-1].Host != "" {
			t.Fatal("hosted wildlife should detach when support leaves play")
		}
	})
	t.Run("scores printed rank and hand penalty", func(t *testing.T) {
		s := newTestState(t)
		s.Players[0].Board = nil
		s.Players[0].Hand = nil
		addBoardCard(s, 0, 1, true)
		addBoardCard(s, 0, 107, true)
		addBoardCard(s, 0, 211, true)
		setPlayerHand(s, 0, 4)
		scores := e.Scores(s)
		if scores[0] != (1+5+4)-2 {
			t.Fatalf("unexpected score %d", scores[0])
		}
	})
}

func TestRoundEndEmptyHandEndsGame(t *testing.T) {
	e := testEngine(t)
	s := newTestState(t)
	s.Phase = PhaseEnd
	s.CurrentPlayer = 1
	s.Players[0].Hand = nil
	setPlayerHand(s, 1, 4)
	if err := e.Apply(s, 1, Action{Type: "advancePhase"}); err != nil {
		t.Fatal(err)
	}
	if s.Phase != PhaseGameOver {
		t.Fatal("expected game over after round with empty hand")
	}
}
