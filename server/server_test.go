package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestServerCreateJoinAndActionValidation(t *testing.T) {
	srv, err := newServer(filepath.Join(".."))
	if err != nil {
		t.Fatal(err)
	}
	handler := srv.routes(filepath.Join(".."))

	req := httptest.NewRequest(http.MethodPost, "/api/rooms", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create got %d", rec.Code)
	}
	var created map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	code := created["roomCode"].(string)
	token0 := created["playerToken"].(string)

	req = httptest.NewRequest(http.MethodPost, "/api/rooms/"+code+"/join", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("join got %d", rec.Code)
	}
	var joined map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &joined); err != nil {
		t.Fatal(err)
	}
	token1 := joined["playerToken"].(string)
	if token0 == token1 {
		t.Fatal("tokens should be unique")
	}

	badBody := `{"version":"v1alpha1","type":"action","action":{"type":"nope"}}`
	req = httptest.NewRequest(http.MethodPost, "/api/rooms/"+code+"/actions", strings.NewReader(badBody))
	req.Header.Set("Authorization", "Bearer "+token0)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid action got %d", rec.Code)
	}
}
