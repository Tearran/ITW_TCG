package main

import (
	"context"
	crand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type apiError struct {
	Error apiErrorBody `json:"error"`
}

type apiErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type Room struct {
	Code        string
	Tokens      [2]string
	Connected   [2]bool
	LastEventID int
	Streams     map[int][]chan serverEvent
	UpdatedAt   time.Time
	State       *GameState
	mu          sync.Mutex
}

type serverEvent struct {
	ID   int
	Name string
	Data any
}

type roomManager struct {
	cards *CardCatalog
	mu    sync.Mutex
	rooms map[string]*Room
}

func newRoomManager(cards *CardCatalog) *roomManager {
	return &roomManager{cards: cards, rooms: make(map[string]*Room)}
}

func (m *roomManager) createRoom() (*Room, int, string, error) {
	state, err := NewEngine(m.cards).NewGame()
	if err != nil {
		return nil, 0, "", err
	}
	room := &Room{Code: randomCode(4), Streams: make(map[int][]chan serverEvent), UpdatedAt: time.Now(), State: state}
	room.Tokens[0] = randomToken(16)
	m.mu.Lock()
	defer m.mu.Unlock()
	for {
		if _, exists := m.rooms[room.Code]; !exists {
			break
		}
		room.Code = randomCode(4)
	}
	m.rooms[room.Code] = room
	return room, 0, room.Tokens[0], nil
}

func (m *roomManager) get(code string) (*Room, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	room, ok := m.rooms[strings.ToUpper(code)]
	return room, ok
}

func randomBytes(n int) []byte {
	b := make([]byte, n)
	if _, err := crand.Read(b); err != nil {
		panic(err)
	}
	return b
}

func randomCode(n int) string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	raw := randomBytes(n)
	out := make([]byte, n)
	for i := range out {
		out[i] = alphabet[int(raw[i])%len(alphabet)]
	}
	return string(out)
}

func randomToken(n int) string { return hex.EncodeToString(randomBytes(n)) }

type server struct{ rooms *roomManager }

func newServer(root string) (*server, error) {
	cards, err := LoadCatalog(root)
	if err != nil {
		return nil, err
	}
	return &server{rooms: newRoomManager(cards)}, nil
}

func (s *server) routes(staticRoot string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/api/rooms", s.handleRooms)
	mux.HandleFunc("/api/rooms/", s.handleRoomSubpaths)
	mux.Handle("/", http.FileServer(http.Dir(staticRoot)))
	return withBodyLimit(mux, 1<<20)
}

func withBodyLimit(next http.Handler, limit int64) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, limit)
		next.ServeHTTP(w, r)
	})
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *server) handleRooms(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAPIError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
		return
	}
	room, playerIndex, token, err := s.rooms.createRoom()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "create_failed", "could not create room")
		return
	}
	room.mu.Lock()
	room.Connected[playerIndex] = true
	room.mu.Unlock()
	writeJSON(w, http.StatusCreated, map[string]any{"type": "roomCreated", "version": "v1alpha1", "roomCode": room.Code, "playerIndex": playerIndex, "playerToken": token})
}

func (s *server) handleRoomSubpaths(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/rooms/")
	parts := strings.Split(path, "/")
	if len(parts) < 2 {
		writeAPIError(w, http.StatusNotFound, "not_found", "unknown path")
		return
	}
	code := strings.ToUpper(parts[0])
	room, ok := s.rooms.get(code)
	if !ok {
		writeAPIError(w, http.StatusNotFound, "room_not_found", "room not found")
		return
	}
	switch parts[1] {
	case "join":
		s.handleJoin(w, r, room)
	case "events":
		s.handleEvents(w, r, room)
	case "actions":
		s.handleActions(w, r, room)
	case "leave":
		s.handleLeave(w, r, room)
	default:
		writeAPIError(w, http.StatusNotFound, "not_found", "unknown path")
	}
}

func (s *server) handleJoin(w http.ResponseWriter, r *http.Request, room *Room) {
	if r.Method != http.MethodPost {
		writeAPIError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	if room.Tokens[1] != "" {
		writeAPIError(w, http.StatusConflict, "room_full", "room is full")
		return
	}
	room.Tokens[1] = randomToken(16)
	room.Connected[1] = true
	room.UpdatedAt = time.Now()
	s.publishLocked(room, -1, "roomUpdated", map[string]any{"version": "v1alpha1"})
	writeJSON(w, http.StatusOK, map[string]any{"type": "roomJoined", "version": "v1alpha1", "roomCode": room.Code, "playerIndex": 1, "playerToken": room.Tokens[1]})
}

func (s *server) authenticate(r *http.Request, room *Room) (int, error) {
	auth := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	if auth == "" {
		return -1, errors.New("missing bearer token")
	}
	for i, token := range room.Tokens {
		if token != "" && auth == token {
			return i, nil
		}
	}
	return -1, errors.New("invalid bearer token")
}

func (s *server) handleEvents(w http.ResponseWriter, r *http.Request, room *Room) {
	if r.Method != http.MethodGet {
		writeAPIError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
		return
	}
	player, err := s.authenticate(r, room)
	if err != nil {
		writeAPIError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeAPIError(w, http.StatusInternalServerError, "streaming_unsupported", "streaming unsupported")
		return
	}
	ch := make(chan serverEvent, 8)
	room.mu.Lock()
	room.Streams[player] = append(room.Streams[player], ch)
	snapshot := s.publicStateLocked(room, player)
	lastEventID := r.Header.Get("Last-Event-ID")
	room.LastEventID++
	initialID := room.LastEventID
	room.mu.Unlock()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	fmt.Fprintf(w, ": keepalive\n\n")
	if lastEventID == "" {
		writeSSE(w, serverEvent{ID: initialID, Name: "state", Data: snapshot})
	} else {
		writeSSE(w, serverEvent{ID: initialID, Name: "state", Data: snapshot})
	}
	flusher.Flush()

	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()
	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			room.mu.Lock()
			streams := room.Streams[player]
			for i, stream := range streams {
				if stream == ch {
					room.Streams[player] = append(streams[:i], streams[i+1:]...)
					break
				}
			}
			room.mu.Unlock()
			return
		case event := <-ch:
			writeSSE(w, event)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprintf(w, ": keepalive\n\n")
			flusher.Flush()
		}
	}
}

func (s *server) publicStateLocked(room *Room, player int) map[string]any {
	scores := NewEngine(s.rooms.cards).Scores(room.State)
	players := make([]map[string]any, 2)
	for i := range room.State.Players {
		p := room.State.Players[i]
		board := make([]map[string]any, 0, len(p.Board))
		for _, card := range p.Board {
			board = append(board, map[string]any{
				"instanceId": card.InstanceID,
				"card":       s.rooms.cards.MustCard(card.CardID),
				"exhausted":  card.Exhausted,
				"hosted":     append([]string(nil), card.Hosted...),
				"host":       card.Host,
			})
		}
		handCount := len(p.Hand)
		handCards := []any(nil)
		if i == player {
			handCards = make([]any, 0, len(p.Hand))
			for _, inst := range p.Hand {
				id, _ := NewEngine(s.rooms.cards).cardIDFromInstance(inst)
				handCards = append(handCards, map[string]any{"instanceId": inst, "card": s.rooms.cards.MustCard(id)})
			}
		}
		players[i] = map[string]any{
			"index":            i,
			"mulliganResolved": p.MulliganResolved,
			"mulliganUsed":     p.MulliganUsed,
			"handCount":        handCount,
			"hand":             handCards,
			"board":            board,
			"compostCount":     len(p.Compost),
			"score":            scores[i],
			"energyPool":       p.EnergyPool,
		}
	}
	return map[string]any{
		"type":             "state",
		"version":          room.State.Version,
		"roomCode":         room.Code,
		"phase":            room.State.Phase,
		"round":            room.State.Round,
		"currentPlayer":    room.State.CurrentPlayer,
		"winner":           room.State.Winner,
		"loseReason":       room.State.LoseReason,
		"pendingChoice":    room.State.PendingChoice,
		"pendingChallenge": room.State.PendingChallenge,
		"players":          players,
		"log":              append([]string(nil), room.State.Log...),
		"connection": map[string]any{
			"self": room.Connected[player],
			"peer": room.Connected[1-player],
		},
	}
}

func (s *server) handleActions(w http.ResponseWriter, r *http.Request, room *Room) {
	if r.Method != http.MethodPost {
		writeAPIError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
		return
	}
	player, err := s.authenticate(r, room)
	if err != nil {
		writeAPIError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}
	var envelope struct {
		Version string `json:"version"`
		Type    string `json:"type"`
		Action  Action `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&envelope); err != nil {
		writeAPIError(w, http.StatusBadRequest, "bad_json", "malformed request body")
		return
	}
	if envelope.Version != "v1alpha1" || envelope.Type != "action" {
		writeAPIError(w, http.StatusBadRequest, "bad_request", "unknown message type or version")
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	room.UpdatedAt = time.Now()
	if err := NewEngine(s.rooms.cards).Apply(room.State, player, envelope.Action); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_action", err.Error())
		return
	}
	s.publishLocked(room, -1, "roomUpdated", map[string]any{"version": "v1alpha1"})
	writeJSON(w, http.StatusOK, map[string]any{"type": "actionAccepted", "version": "v1alpha1"})
}

func (s *server) publishLocked(room *Room, player int, name string, data any) {
	targets := []int{0, 1}
	if player >= 0 {
		targets = []int{player}
	}
	for _, idx := range targets {
		snapshot := s.publicStateLocked(room, idx)
		room.LastEventID++
		event := serverEvent{ID: room.LastEventID, Name: name, Data: snapshot}
		for _, ch := range room.Streams[idx] {
			select {
			case ch <- event:
			default:
			}
		}
	}
}

func (s *server) handleLeave(w http.ResponseWriter, r *http.Request, room *Room) {
	if r.Method != http.MethodPost {
		writeAPIError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
		return
	}
	player, err := s.authenticate(r, room)
	if err != nil {
		writeAPIError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}
	room.mu.Lock()
	room.Connected[player] = false
	room.UpdatedAt = time.Now()
	s.publishLocked(room, -1, "roomUpdated", map[string]any{"version": "v1alpha1"})
	room.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"type": "left", "version": "v1alpha1"})
}

func writeSSE(w http.ResponseWriter, event serverEvent) {
	payload, _ := json.Marshal(event.Data)
	fmt.Fprintf(w, "id: %d\n", event.ID)
	fmt.Fprintf(w, "event: %s\n", event.Name)
	fmt.Fprintf(w, "data: %s\n\n", payload)
}

func writeAPIError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, apiError{Error: apiErrorBody{Code: code, Message: message}})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func cleanupLoop(ctx context.Context, mgr *roomManager) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			mgr.mu.Lock()
			for code, room := range mgr.rooms {
				room.mu.Lock()
				expired := time.Since(room.UpdatedAt) > 2*time.Hour && !room.Connected[0] && !room.Connected[1]
				room.mu.Unlock()
				if expired {
					delete(mgr.rooms, code)
				}
			}
			mgr.mu.Unlock()
		}
	}
}

func main() {
	repoRoot := filepath.Clean(filepath.Join(".."))
	srv, err := newServer(repoRoot)
	if err != nil {
		log.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go cleanupLoop(ctx, srv.rooms)
	log.Println("listening on :8080")
	if err := http.ListenAndServe(":8080", srv.routes(repoRoot)); err != nil {
		log.Fatal(err)
	}
}
