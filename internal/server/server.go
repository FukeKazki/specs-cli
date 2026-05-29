// Package server provides the local Web UI and JSON API for managing specs.
package server

import (
	"embed"
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"strings"

	"github.com/kazki/specs-cli/internal/store"
)

// dist は Vite (web/) のビルド成果物。`cd web && npm run build` で生成される。
//
//go:embed all:dist
var distFS embed.FS

// Handler は Web UI と /api/* を提供する http.Handler を返す。
func Handler(st *store.Store) http.Handler {
	mux := http.NewServeMux()

	// 静的ファイル (Vite ビルド成果物)
	sub, _ := fs.Sub(distFS, "dist")
	mux.Handle("GET /", http.FileServer(http.FS(sub)))

	mux.HandleFunc("GET /api/specs", func(w http.ResponseWriter, r *http.Request) {
		specs, err := st.List()
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"specs": specs})
	})

	mux.HandleFunc("GET /api/specs/{id...}", func(w http.ResponseWriter, r *http.Request) {
		sp, content, err := st.Get(r.PathValue("id"))
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"spec": sp, "content": content})
	})

	mux.HandleFunc("PUT /api/specs/{id...}", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := st.Update(r.PathValue("id"), body.Content); err != nil {
			writeStoreErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})

	mux.HandleFunc("DELETE /api/specs/{id...}", func(w http.ResponseWriter, r *http.Request) {
		if err := st.Delete(r.PathValue("id")); err != nil {
			writeStoreErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})

	mux.HandleFunc("POST /api/features", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		created, err := st.CreateFeature(body.Name)
		if err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"created": created})
	})

	mux.HandleFunc("POST /api/features/{feature}/screens", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		id, err := st.CreateScreen(r.PathValue("feature"), body.Name)
		if err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"created": id})
	})

	mux.HandleFunc("POST /api/domain/terms", func(w http.ResponseWriter, r *http.Request) {
		createDomain(w, r, st.CreateTerm)
	})

	mux.HandleFunc("POST /api/domain/models", func(w http.ResponseWriter, r *http.Request) {
		createDomain(w, r, st.CreateModel)
	})

	mux.HandleFunc("PUT /api/features/{feature}/screens/order", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Order []string `json:"order"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := st.ReorderScreens(r.PathValue("feature"), body.Order); err != nil {
			writeStoreErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})

	return mux
}

// createDomain は {name} を受け取り create 関数 (CreateTerm/CreateModel) を呼ぶ共通処理。
func createDomain(w http.ResponseWriter, r *http.Request, create func(string) (string, error)) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	id, err := create(body.Name)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"created": id})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, err error) {
	writeJSON(w, code, map[string]any{"error": err.Error()})
}

func writeStoreErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeErr(w, http.StatusNotFound, err)
	case strings.Contains(err.Error(), "invalid"):
		writeErr(w, http.StatusBadRequest, err)
	default:
		writeErr(w, http.StatusInternalServerError, err)
	}
}
