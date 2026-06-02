# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`specs` is a CLI tool (Go) for managing software specification documents as a tree of Markdown files under a `specs/` directory. It also ships a local Web UI (React/Vite) for browsing and editing those documents. Documentation and comments are written in Japanese.

## Commands

```bash
make build          # full build: builds web/ then embeds it into the Go binary → bin/specs
make web            # cd web && npm install && npm run build (output → internal/server/dist)
make go             # go build -o bin/specs .  (assumes dist/ already exists)
make dev            # cd web && npm run dev  — Vite dev server on :5173, /api proxied to :8787
make clean          # rm -rf bin internal/server/dist web/node_modules

go test ./...       # run Go tests (no test files exist yet)
go vet ./...        # vet
go build -o bin/specs .   # build CLI alone (requires internal/server/dist to exist for embed)
```

Note: the binary is `bin/specs`, **not** `specs`, to avoid colliding with the `specs/` document directory.

### Running the Web UI during development

Two processes: `make dev` (Vite, :5173) for the frontend, plus `./bin/specs serve` (Go API, :8787) in another terminal. Vite proxies `/api` to the Go server. In production a single `bin/specs serve` serves both the embedded UI and the API.

## Architecture

The CLI and Web UI are two front-ends over one shared core, `internal/store`.

- **`main.go` → `internal/cmd`** — CLI entrypoint and command dispatch (`init`, `new feature|screen|term|model`, `serve`, `help`). `cmd.Execute` returns a process exit code. `init` is the only command that does NOT use the store (it scaffolds the directory tree directly from `internal/templates`); all `new`/`serve` commands require `specs/` to already exist (`store.EnsureInitialized`).

- **`internal/store`** — the heart of the system. Reads/writes/lists/creates/deletes/reorders spec documents under `specs/`. Every document is identified by its **slash-separated path relative to `specs/`** (the `ID`, e.g. `features/login/spec.md`). `validateID` guards every ID-taking operation against path traversal and restricts to the managed roots. Metadata (`Spec` struct) is parsed from each file's YAML frontmatter (`type`/`status`/`order`/`priority`/`assignee`/`start`/`due`/`depends_on`) and `Title` from the first H1. `List` sorts by group (product → domain → feature-name) then by a type-based `rank`.

- **`internal/server`** — `Handler(*store.Store)` returns an `http.Handler` exposing a JSON API under `/api/*` and serving the embedded Web UI for all other paths via `//go:embed all:dist`. It is a thin HTTP layer over the store; error mapping to HTTP status codes lives in `writeStoreErr` (ErrNotFound→404, ValidationError/invalid→400).

- **`internal/templates`** — embeds document templates in `files/` (`//go:embed`). `Static` returns raw template bytes (used by `init`); `Render` runs Go `text/template` substitution (used by `new` for feature/screen/term/model).

- **`web/`** — React 19 + Vite + TypeScript SPA. `src/api.ts` mirrors the server's `/api` surface; renders Markdown (`react-markdown` + `remark-gfm`) and Mermaid diagrams. Build output goes to `internal/server/dist` (configured in `vite.config.ts`).

### The `specs/` document model

Managed roots (`managedDirs` in store.go): `product`, `features`, `domain/glossary`, `domain/models`.

- `product/` — `vision.md`, `principles.md` (`type=product`), created by `init`.
- `features/<name>/` — `spec.md` (`type=feature`) + `requirements/R-00n.md` (`type=requirement`) + `screens/S-00n-<slug>.md` (`type=screen`), the latter two ordered by frontmatter `order`. Numbers and `order` are auto-incremented in `CreateRequirement` / `CreateScreen`.
- `domain/glossary/<term>.md` and `domain/models/<model>.md` — one entry per file. Names may contain Japanese (validated by `isSafeEntryName`, which only blocks path separators and leading `.`).

## Conventions specific to this repo

- **`internal/server/dist` is committed to git** (see `.gitignore`) even though it's a build artifact — this is intentional so that `go install github.com/FukeKazki/specs-cli@latest` embeds a working Web UI without needing Node. When the frontend changes, rebuild (`make web`) and commit the regenerated `dist/`.
- All user-facing strings and code comments are in **Japanese**. Match this when editing.
- Name handling: `isSafeName` (feature names) allows only `[A-Za-z0-9._-]`; `isSafeEntryName` (term/model names) allows Japanese. `slugify` strips non-ASCII for screen filenames (uniqueness is guaranteed by the `S-00n` number); `titleize` is rune-aware so Japanese survives.
- `writeFile` (cmd) and the store's create methods refuse to overwrite existing files.
