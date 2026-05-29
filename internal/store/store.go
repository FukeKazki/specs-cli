// Package store reads and writes spec documents under the specs/ tree.
//
// 仕様書 (spec) は specs/features/<feature>/ 配下の md を指す (glossary 参照)。
//   - spec.md  : feature 本体 (Overview / Users / Scope / Requirements)
//   - api.md   : API 仕様
//   - screens/ : 1 画面 1 ファイル (type: screen, 並び順は frontmatter の order)
//
// それらを一覧・詳細・作成・更新・削除・並び替えする操作を提供する。
package store

import (
	"bufio"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"unicode"

	"github.com/kazki/specs-cli/internal/openapi"
	"github.com/kazki/specs-cli/internal/templates"
)

// Root は specs ディレクトリ。
const Root = "specs"

// ErrNotFound は対象の仕様書が存在しないときに返す。
var ErrNotFound = errors.New("spec not found")

// ValidationError は保存内容の検証 (OpenAPI スキーマ等) に失敗したことを表す。
type ValidationError struct{ err error }

func (e *ValidationError) Error() string { return e.err.Error() }
func (e *ValidationError) Unwrap() error { return e.err }

// isSpecFile は管理対象の仕様書ファイルか判定する (.md / .yaml)。
func isSpecFile(name string) bool {
	return strings.HasSuffix(name, ".md") || strings.HasSuffix(name, ".yaml")
}

// Spec は 1 つの仕様書ファイルを表す (domain model: Spec)。
type Spec struct {
	ID      string `json:"id"`      // specs/ からの相対パス。一意キー
	Feature string `json:"feature"` // 所属する feature 名
	File    string `json:"file"`    // ファイル名 (spec.md / api.md / S-001-xxx.md)
	Type    string `json:"type"`    // frontmatter の type (feature / api / screen)
	Title   string `json:"title"`   // 先頭 H1 見出し
	Status  string `json:"status"`  // frontmatter の status
	Order   int    `json:"order"`   // frontmatter の order (screen の並び順)
}

// Store は specs ツリーへのアクセサ。dir は specs ディレクトリの親 (通常 ".")。
type Store struct {
	dir string
}

// New は指定ディレクトリ配下の specs/ を扱う Store を返す。
func New(dir string) *Store {
	return &Store{dir: dir}
}

// EnsureInitialized は specs/ が存在しなければエラーを返す。
func (s *Store) EnsureInitialized() error {
	if _, err := os.Stat(filepath.Join(s.dir, Root)); err != nil {
		return fmt.Errorf("%s/ が見つかりません。先に `specs init` を実行してください", Root)
	}
	return nil
}

// managedDirs は管理対象の仕様書ルート (specs/ からの相対パス)。
//   - features         : feature 配下の spec.md / api.md / screens
//   - domain/glossary  : ユビキタス言語 (term)
//   - domain/models    : モデル (model)
var managedDirs = []string{"features", "domain/glossary", "domain/models"}

// List は管理対象の全仕様書を返す。
// 並びは domain → feature 名昇順、各グループ内は種別ランク → order → ファイル名。
func (s *Store) List() ([]Spec, error) {
	var specs []Spec
	for _, dir := range managedDirs {
		root := filepath.Join(s.dir, Root, dir)
		err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				if os.IsNotExist(err) {
					return nil
				}
				return err
			}
			if d.IsDir() || !isSpecFile(d.Name()) {
				return nil
			}
			rel, err := filepath.Rel(filepath.Join(s.dir, Root), path)
			if err != nil {
				return err
			}
			sp, err := s.read(filepath.ToSlash(rel))
			if err != nil {
				return err
			}
			specs = append(specs, sp)
			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	sortSpecs(specs)
	return specs, nil
}

// Get は仕様書のメタ情報と本文を返す。
func (s *Store) Get(id string) (Spec, string, error) {
	if err := validateID(id); err != nil {
		return Spec{}, "", err
	}
	if !s.exists(id) {
		return Spec{}, "", ErrNotFound
	}
	sp, err := s.read(id)
	if err != nil {
		return Spec{}, "", err
	}
	content, err := os.ReadFile(s.abs(id))
	if err != nil {
		return Spec{}, "", err
	}
	return sp, string(content), nil
}

// Update は既存仕様書の本文を上書きする。
// api.yaml は保存前に OpenAPI スキーマ検証を行い、不正なら ValidationError を返す。
func (s *Store) Update(id, content string) error {
	if err := validateID(id); err != nil {
		return err
	}
	if !s.exists(id) {
		return ErrNotFound
	}
	if strings.HasSuffix(id, ".yaml") {
		if err := openapi.Validate([]byte(content)); err != nil {
			return &ValidationError{err: err}
		}
	}
	return os.WriteFile(s.abs(id), []byte(content), 0o644)
}

// Delete は仕様書ファイルを削除する。親ディレクトリが空になれば削除する。
func (s *Store) Delete(id string) error {
	if err := validateID(id); err != nil {
		return err
	}
	if !s.exists(id) {
		return ErrNotFound
	}
	if err := os.Remove(s.abs(id)); err != nil {
		return err
	}
	// 管理ルート (features, domain/glossary, domain/models) 配下で空になった
	// 中間ディレクトリ (screens/, feature/) を掃除する。管理ルート自体は残す。
	stop := s.managedRoot(id)
	if stop == "" {
		return nil
	}
	dir := filepath.Dir(s.abs(id))
	for dir != stop {
		if remaining, _ := os.ReadDir(dir); len(remaining) != 0 {
			break
		}
		if err := os.Remove(dir); err != nil {
			break
		}
		dir = filepath.Dir(dir)
	}
	return nil
}

// managedRoot は id が属する管理ルートの絶対パスを返す (該当なしは "")。
func (s *Store) managedRoot(id string) string {
	for _, dir := range managedDirs {
		if strings.HasPrefix(id, dir+"/") {
			return filepath.Join(s.dir, Root, filepath.FromSlash(dir))
		}
	}
	return ""
}

// CreateFeature は新しい feature を作成し spec.md / api.md を生成する。
func (s *Store) CreateFeature(name string) ([]string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("feature 名を入力してください")
	}
	if !isSafeName(name) {
		return nil, errors.New("feature 名に使えるのは英数字 . _ - のみです")
	}

	dir := filepath.Join(s.dir, Root, "features", name)
	if _, err := os.Stat(dir); err == nil {
		return nil, fmt.Errorf("feature %q は既に存在します", name)
	}

	data := templates.FeatureData{Name: name, Title: titleize(name)}
	templateFiles := map[string]string{"spec.md": "spec.md.tmpl", "api.yaml": "api.yaml.tmpl"}

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}

	var created []string
	for filename, tmpl := range templateFiles {
		content, err := templates.Render(tmpl, data)
		if err != nil {
			return nil, err
		}
		if err := os.WriteFile(filepath.Join(dir, filename), content, 0o644); err != nil {
			return nil, err
		}
		created = append(created, filepath.ToSlash(filepath.Join("features", name, filename)))
	}
	sort.Strings(created)
	return created, nil
}

// CreateTerm は domain/glossary 配下にユビキタス言語を 1 件生成する。生成した ID を返す。
func (s *Store) CreateTerm(name string) (string, error) {
	return s.createDomainEntry("glossary", "term.md.tmpl", name, "用語名")
}

// CreateModel は domain/models 配下にモデルを 1 件生成する。生成した ID を返す。
func (s *Store) CreateModel(name string) (string, error) {
	return s.createDomainEntry("models", "model.md.tmpl", name, "モデル名")
}

// createDomainEntry は domain/<sub>/<name>.md をテンプレートから生成する共通処理。
func (s *Store) createDomainEntry(sub, tmpl, name, label string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", fmt.Errorf("%sを入力してください", label)
	}
	if !isSafeEntryName(name) {
		return "", fmt.Errorf("%sに / \\ や . で始まる名前は使えません", label)
	}

	dir := filepath.Join(s.dir, Root, "domain", sub)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	dst := filepath.Join(dir, name+".md")
	if _, err := os.Stat(dst); err == nil {
		return "", fmt.Errorf("%q は既に存在します", name)
	}

	content, err := templates.Render(tmpl, templates.FeatureData{Name: name, Title: titleize(name)})
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(dst, content, 0o644); err != nil {
		return "", err
	}
	return filepath.ToSlash(filepath.Join("domain", sub, name+".md")), nil
}

// CreateScreen は feature 配下に新しい画面ファイルを生成する。
// 画面番号 (S-00n) と order は既存画面の次の値を採番する。生成した ID を返す。
func (s *Store) CreateScreen(feature, name string) (string, error) {
	feature = strings.TrimSpace(feature)
	name = strings.TrimSpace(name)
	if name == "" {
		return "", errors.New("画面名を入力してください")
	}
	featureDir := filepath.Join(s.dir, Root, "features", feature)
	if info, err := os.Stat(featureDir); err != nil || !info.IsDir() {
		return "", fmt.Errorf("feature %q が見つかりません", feature)
	}

	existing, err := s.screensOf(feature)
	if err != nil {
		return "", err
	}
	nextNum, nextOrder := 1, 1
	for _, sc := range existing {
		if n := screenNumber(sc.File); n >= nextNum {
			nextNum = n + 1
		}
		if sc.Order >= nextOrder {
			nextOrder = sc.Order + 1
		}
	}

	num := fmt.Sprintf("S-%03d", nextNum)
	slug := slugify(name)
	filename := num
	if slug != "" {
		filename += "-" + slug
	}
	filename += ".md"

	data := templates.ScreenData{Feature: feature, Num: num, Title: titleize(name), Order: nextOrder}
	content, err := templates.Render("screen.md.tmpl", data)
	if err != nil {
		return "", err
	}

	screensDir := filepath.Join(featureDir, "screens")
	if err := os.MkdirAll(screensDir, 0o755); err != nil {
		return "", err
	}
	dst := filepath.Join(screensDir, filename)
	if _, err := os.Stat(dst); err == nil {
		return "", fmt.Errorf("%s は既に存在します", filename)
	}
	if err := os.WriteFile(dst, content, 0o644); err != nil {
		return "", err
	}
	return filepath.ToSlash(filepath.Join("features", feature, "screens", filename)), nil
}

// ReorderScreens は feature 配下の画面の order を、与えられた ID 順に振り直す。
// 各ファイルの frontmatter の order 行のみを書き換える。
func (s *Store) ReorderScreens(feature string, ids []string) error {
	prefix := "features/" + feature + "/screens/"
	for i, id := range ids {
		if err := validateID(id); err != nil {
			return err
		}
		if !strings.HasPrefix(id, prefix) {
			return fmt.Errorf("%s は feature %q の画面ではありません", id, feature)
		}
		if !s.exists(id) {
			return ErrNotFound
		}
		if err := s.setOrder(id, i+1); err != nil {
			return err
		}
	}
	return nil
}

// --- internal helpers ---

func (s *Store) abs(id string) string {
	return filepath.Join(s.dir, Root, filepath.FromSlash(id))
}

func (s *Store) exists(id string) bool {
	info, err := os.Stat(s.abs(id))
	return err == nil && !info.IsDir()
}

func (s *Store) screensOf(feature string) ([]Spec, error) {
	dir := filepath.Join(s.dir, Root, "features", feature, "screens")
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var out []Spec
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		id := filepath.ToSlash(filepath.Join("features", feature, "screens", e.Name()))
		sp, err := s.read(id)
		if err != nil {
			return nil, err
		}
		out = append(out, sp)
	}
	return out, nil
}

// read はファイルから Spec メタを構築する。
// Markdown は frontmatter と H1 から、OpenAPI (.yaml) は info.title から取得する。
func (s *Store) read(id string) (Spec, error) {
	if strings.HasSuffix(id, ".yaml") {
		return s.readOpenAPI(id)
	}
	sp := Spec{ID: id, Feature: featureOf(id), File: filepath.Base(id)}
	f, err := os.Open(s.abs(id))
	if err != nil {
		return sp, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	inFrontmatter := false
	frontmatterDone := false
	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		if !frontmatterDone {
			if trimmed == "---" {
				if inFrontmatter {
					frontmatterDone = true
				} else {
					inFrontmatter = true
				}
				continue
			}
			if inFrontmatter {
				if k, v, ok := splitKV(trimmed); ok {
					switch k {
					case "type":
						sp.Type = v
					case "status":
						sp.Status = v
					case "order":
						sp.Order, _ = strconv.Atoi(v)
					}
				}
				continue
			}
		}

		if sp.Title == "" && strings.HasPrefix(trimmed, "# ") {
			sp.Title = strings.TrimSpace(strings.TrimPrefix(trimmed, "# "))
		}
	}
	if err := scanner.Err(); err != nil {
		return sp, err
	}
	if sp.Title == "" {
		sp.Title = sp.File
	}
	return sp, nil
}

// readOpenAPI は api.yaml のメタを構築する (type=api, title=info.title)。
func (s *Store) readOpenAPI(id string) (Spec, error) {
	sp := Spec{ID: id, Feature: featureOf(id), File: filepath.Base(id), Type: "api"}
	data, err := os.ReadFile(s.abs(id))
	if err != nil {
		return sp, err
	}
	if t := openapi.Title(data); t != "" {
		sp.Title = t
	} else {
		sp.Title = sp.File
	}
	return sp, nil
}

// setOrder は frontmatter の order 行だけを書き換える (本文は保持)。
func (s *Store) setOrder(id string, order int) error {
	raw, err := os.ReadFile(s.abs(id))
	if err != nil {
		return err
	}
	lines := strings.Split(string(raw), "\n")
	start, end := -1, -1
	for i, l := range lines {
		if strings.TrimSpace(l) == "---" {
			if start == -1 {
				start = i
			} else {
				end = i
				break
			}
		}
	}
	newLine := "order: " + strconv.Itoa(order)
	if start == 0 && end > 0 {
		replaced := false
		for i := start + 1; i < end; i++ {
			if k, _, ok := splitKV(strings.TrimSpace(lines[i])); ok && k == "order" {
				lines[i] = newLine
				replaced = true
				break
			}
		}
		if !replaced {
			// order 行が無ければ frontmatter 末尾に追加する。
			lines = append(lines[:end], append([]string{newLine}, lines[end:]...)...)
		}
	} else {
		// frontmatter が無い場合は付与する。
		header := []string{"---", newLine, "---", ""}
		lines = append(header, lines...)
	}
	return os.WriteFile(s.abs(id), []byte(strings.Join(lines, "\n")), 0o644)
}

// sortSpecs はグループ昇順 (domain が先) → グループ内ランク → order → ファイル名で安定ソートする。
func sortSpecs(specs []Spec) {
	sort.SliceStable(specs, func(i, j int) bool {
		a, b := specs[i], specs[j]
		ga, gb := groupKey(a), groupKey(b)
		if ga != gb {
			return ga < gb
		}
		ra, rb := rank(a), rank(b)
		if ra != rb {
			return ra < rb
		}
		if a.Order != b.Order {
			return a.Order < b.Order
		}
		return a.File < b.File
	})
}

// groupKey は表示グループのキー。domain は空文字で feature より先に並ぶ。
func groupKey(s Spec) string {
	if strings.HasPrefix(s.ID, "domain/") {
		return ""
	}
	return s.Feature
}

// rank はグループ内の表示順を type で決める。
// domain: term → model。feature: feature(spec.md) → api(api.yaml) → screen → その他。
func rank(s Spec) int {
	switch s.Type {
	case "term", "feature":
		return 0
	case "model", "api":
		return 1
	case "screen":
		return 2
	default:
		return 3
	}
}

func featureOf(id string) string {
	parts := strings.Split(id, "/")
	if len(parts) >= 2 && parts[0] == "features" {
		return parts[1]
	}
	return ""
}

func splitKV(line string) (key, value string, ok bool) {
	idx := strings.Index(line, ":")
	if idx < 0 {
		return "", "", false
	}
	return strings.TrimSpace(line[:idx]), strings.TrimSpace(line[idx+1:]), true
}

// screenNumber は "S-001-foo.md" から 1 を取り出す。取れなければ 0。
func screenNumber(file string) int {
	m := strings.TrimPrefix(file, "S-")
	if m == file {
		return 0
	}
	digits := ""
	for _, r := range m {
		if r < '0' || r > '9' {
			break
		}
		digits += string(r)
	}
	n, _ := strconv.Atoi(digits)
	return n
}

// validateID はパストラバーサルや不正な ID を弾く。
func validateID(id string) error {
	if id == "" {
		return errors.New("id is empty")
	}
	clean := filepath.ToSlash(filepath.Clean(id))
	if clean != id || strings.HasPrefix(clean, "/") || strings.Contains(clean, "..") {
		return errors.New("invalid id")
	}
	if !isSpecFile(clean) {
		return errors.New("invalid id")
	}
	for _, dir := range managedDirs {
		if strings.HasPrefix(clean, dir+"/") {
			return nil
		}
	}
	return errors.New("invalid id")
}

// isSafeEntryName は domain エントリ名 (用語・モデル名) を検証する。
// 日本語を許すため文字種は限定せず、パス区切りや . 始まりのみ弾く。
func isSafeEntryName(name string) bool {
	if name == "" || name == "." || name == ".." || strings.HasPrefix(name, ".") {
		return false
	}
	return !strings.ContainsAny(name, "/\\\x00")
}

func isSafeName(name string) bool {
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
		case r == '.' || r == '_' || r == '-':
		default:
			return false
		}
	}
	return true
}

// titleize turns "user-login" into "User Login".
// rune 単位で扱うため日本語などマルチバイト文字でも破損しない。
func titleize(name string) string {
	fields := strings.FieldsFunc(name, func(r rune) bool {
		return r == '-' || r == '_' || r == ' '
	})
	for i, w := range fields {
		runes := []rune(w)
		if len(runes) == 0 {
			continue
		}
		runes[0] = unicode.ToUpper(runes[0])
		fields[i] = string(runes)
	}
	return strings.Join(fields, " ")
}

// slugify turns "ログイン Screen" / "Login Form" into a filename-safe kebab slug.
func slugify(name string) string {
	var b strings.Builder
	prevDash := false
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			prevDash = false
		case r >= 'A' && r <= 'Z':
			b.WriteRune(r + ('a' - 'A'))
			prevDash = false
		case r == ' ' || r == '-' || r == '_':
			if !prevDash && b.Len() > 0 {
				b.WriteByte('-')
				prevDash = true
			}
		default:
			// 日本語など英数字以外はスキップ (番号 S-00n で一意性は担保される)
		}
	}
	return strings.Trim(b.String(), "-")
}
