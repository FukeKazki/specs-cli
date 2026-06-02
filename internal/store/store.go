// Package store reads and writes spec documents under the specs/ tree.
//
// 仕様書 (spec) は specs/features/<feature>/ 配下の md を指す (glossary 参照)。
//   - spec.md       : feature 本体 (Overview / Users / Scope)
//   - requirements/ : 1 要件 1 ファイル (type: requirement)
//   - screens/      : 1 画面 1 ファイル (type: screen, 並び順は frontmatter の order)
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
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/FukeKazki/specs-cli/internal/templates"
)

// Root は specs ディレクトリ。
const Root = "specs"

// ErrNotFound は対象の仕様書が存在しないときに返す。
var ErrNotFound = errors.New("spec not found")

// ValidationError は保存内容の検証 (日付・依存などのメタ検証) に失敗したことを表す。
type ValidationError struct{ err error }

func (e *ValidationError) Error() string { return e.err.Error() }
func (e *ValidationError) Unwrap() error { return e.err }

// isSpecFile は管理対象の仕様書ファイルか判定する (.md)。
func isSpecFile(name string) bool {
	return strings.HasSuffix(name, ".md")
}

// Spec は 1 つの仕様書ファイルを表す (domain model: Spec)。
type Spec struct {
	ID      string `json:"id"`      // specs/ からの相対パス。一意キー
	Feature string `json:"feature"` // 所属する feature 名
	File    string `json:"file"`    // ファイル名 (spec.md / R-001.md / S-001-xxx.md)
	Type    string `json:"type"`    // frontmatter の type (feature / requirement / screen)
	Title   string `json:"title"`   // 先頭 H1 見出し
	Status  string `json:"status"`  // frontmatter の status
	Order   int    `json:"order"`   // frontmatter の order (screen / requirement の並び順)

	Priority string `json:"priority,omitempty"` // MoSCoW 優先度 (requirement)

	// 進捗管理 (project-management feature) の任意メタ。frontmatter を唯一の正とする。
	Assignee  string   `json:"assignee,omitempty"`  // 担当者
	Start     string   `json:"start,omitempty"`     // 開始日 (YYYY-MM-DD)
	Due       string   `json:"due,omitempty"`       // 期限日 (YYYY-MM-DD)
	DependsOn []string `json:"dependsOn,omitempty"` // 依存する仕様の id (specs/ 相対パス)
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
//   - product          : ビジョン / プリンシパル (vision.md / principles.md, type=product)
//   - features         : feature 配下の spec.md / requirements / screens
//   - domain/glossary  : ユビキタス言語 (term)
//   - domain/models    : モデル (model)
var managedDirs = []string{"product", "features", "domain/glossary", "domain/models"}

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
func (s *Store) Update(id, content string) error {
	if err := validateID(id); err != nil {
		return err
	}
	if !s.exists(id) {
		return ErrNotFound
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

// CreateFeature は新しい feature を作成し spec.md を生成する。
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
	templateFiles := map[string]string{"spec.md": "spec.md.tmpl"}

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
		if n := numFromFile(sc.File, "S-"); n >= nextNum {
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

// CreateRequirement は feature 配下に新しい要件ファイル (R-00n.md) を生成する。
// 要件番号 (R-00n) と order は既存要件の次の値を採番する。生成した ID を返す。
func (s *Store) CreateRequirement(feature, title string) (string, error) {
	feature = strings.TrimSpace(feature)
	title = strings.TrimSpace(title)
	if title == "" {
		return "", errors.New("要件名を入力してください")
	}
	featureDir := filepath.Join(s.dir, Root, "features", feature)
	if info, err := os.Stat(featureDir); err != nil || !info.IsDir() {
		return "", fmt.Errorf("feature %q が見つかりません", feature)
	}

	existing, err := s.requirementsOf(feature)
	if err != nil {
		return "", err
	}
	nextNum, nextOrder := 1, 1
	for _, rq := range existing {
		if n := numFromFile(rq.File, "R-"); n >= nextNum {
			nextNum = n + 1
		}
		if rq.Order >= nextOrder {
			nextOrder = rq.Order + 1
		}
	}

	num := fmt.Sprintf("R-%03d", nextNum)
	data := templates.RequirementData{Feature: feature, Num: num, Title: titleize(title), Order: nextOrder, Priority: "Must"}
	content, err := templates.Render("requirement.md.tmpl", data)
	if err != nil {
		return "", err
	}

	dir := filepath.Join(featureDir, "requirements")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	dst := filepath.Join(dir, num+".md")
	if _, err := os.Stat(dst); err == nil {
		return "", fmt.Errorf("%s は既に存在します", num)
	}
	if err := os.WriteFile(dst, content, 0o644); err != nil {
		return "", err
	}
	return filepath.ToSlash(filepath.Join("features", feature, "requirements", num+".md")), nil
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
	return s.subSpecsOf(feature, "screens")
}

func (s *Store) requirementsOf(feature string) ([]Spec, error) {
	return s.subSpecsOf(feature, "requirements")
}

// subSpecsOf は features/<feature>/<sub>/ 配下の .md を読み込んで返す (screens / requirements 共通)。
func (s *Store) subSpecsOf(feature, sub string) ([]Spec, error) {
	dir := filepath.Join(s.dir, Root, "features", feature, sub)
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
		id := filepath.ToSlash(filepath.Join("features", feature, sub, e.Name()))
		sp, err := s.read(id)
		if err != nil {
			return nil, err
		}
		out = append(out, sp)
	}
	return out, nil
}

// read はファイルから Spec メタを構築する (frontmatter と H1 から)。
func (s *Store) read(id string) (Spec, error) {
	sp := Spec{ID: id, Feature: featureOf(id), File: filepath.Base(id)}
	f, err := os.Open(s.abs(id))
	if err != nil {
		return sp, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	inFrontmatter := false
	frontmatterDone := false
	curListKey := "" // 直近に開いた YAML リストキー (depends_on のみ対象)
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
				// リスト項目 ("- item") は直近のリストキーに属する。
				if curListKey != "" && strings.HasPrefix(trimmed, "- ") {
					item := strings.TrimSpace(strings.TrimPrefix(trimmed, "- "))
					if curListKey == "depends_on" && item != "" {
						sp.DependsOn = append(sp.DependsOn, item)
					}
					continue
				}
				if k, v, ok := splitKV(trimmed); ok {
					curListKey = ""
					switch k {
					case "type":
						sp.Type = v
					case "status":
						sp.Status = v
					case "order":
						sp.Order, _ = strconv.Atoi(v)
					case "assignee":
						sp.Assignee = v
					case "start":
						sp.Start = v
					case "due":
						sp.Due = v
					case "priority":
						sp.Priority = v
					case "depends_on":
						if v == "" {
							curListKey = "depends_on" // 続くブロック形式の "- item" を拾う
						} else {
							sp.DependsOn = parseInlineList(v)
						}
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

// Meta は進捗メタ (status / 担当 / 期間 / 依存) の部分更新指定。
// scalar フィールドは nil=変更しない / ""=キー削除 / 値=設定。
// DependsOn は nil=変更しない / 空=キー削除 / 値=ブロック形式で書き込み。
type Meta struct {
	Status    *string
	Assignee  *string
	Start     *string
	Due       *string
	DependsOn *[]string
}

// SetMeta は仕様ファイルの frontmatter の進捗メタを部分更新する。
// 本文・未知キー・既存のキー順は保持する (setOrder と同じ in-place 方式)。
func (s *Store) SetMeta(id string, m Meta) error {
	if err := validateID(id); err != nil {
		return err
	}
	if !s.exists(id) {
		return ErrNotFound
	}

	// 既存値を読み、未指定フィールドを補完したうえで日付の整合を検証する。
	cur, err := s.read(id)
	if err != nil {
		return err
	}
	start, due := cur.Start, cur.Due
	if m.Start != nil {
		start = strings.TrimSpace(*m.Start)
	}
	if m.Due != nil {
		due = strings.TrimSpace(*m.Due)
	}
	if err := validDate(start); err != nil {
		return &ValidationError{err: err}
	}
	if err := validDate(due); err != nil {
		return &ValidationError{err: err}
	}
	if start != "" && due != "" && start > due {
		return &ValidationError{err: errors.New("start は due 以前の日付にしてください")}
	}
	if m.DependsOn != nil {
		for _, dep := range *m.DependsOn {
			if err := validateID(dep); err != nil {
				return &ValidationError{err: fmt.Errorf("depends_on の id が不正です: %s", dep)}
			}
		}
	}

	raw, err := os.ReadFile(s.abs(id))
	if err != nil {
		return err
	}
	lines := strings.Split(string(raw), "\n")

	// frontmatter フェンスを特定。無ければ先頭に空の frontmatter を合成する。
	fmStart, fmEnd := frontmatterBounds(lines)
	if fmStart != 0 || fmEnd <= 0 {
		lines = append([]string{"---", "---", ""}, lines...)
		fmStart, fmEnd = 0, 1
	}

	if m.Status != nil {
		lines, fmEnd = setScalarLine(lines, fmStart, fmEnd, "status", strings.TrimSpace(*m.Status))
	}
	if m.Assignee != nil {
		lines, fmEnd = setScalarLine(lines, fmStart, fmEnd, "assignee", strings.TrimSpace(*m.Assignee))
	}
	if m.Start != nil {
		lines, fmEnd = setScalarLine(lines, fmStart, fmEnd, "start", start)
	}
	if m.Due != nil {
		lines, fmEnd = setScalarLine(lines, fmStart, fmEnd, "due", due)
	}
	if m.DependsOn != nil {
		lines, fmEnd = setListBlock(lines, fmStart, fmEnd, "depends_on", *m.DependsOn)
	}

	return os.WriteFile(s.abs(id), []byte(strings.Join(lines, "\n")), 0o644)
}

// frontmatterBounds は frontmatter の開始・終了フェンス行の index を返す。
// 終了が見つからなければ end は -1。
func frontmatterBounds(lines []string) (start, end int) {
	start, end = -1, -1
	for i, l := range lines {
		if strings.TrimSpace(l) == "---" {
			if start == -1 {
				start = i
			} else {
				return start, i
			}
		}
	}
	return start, -1
}

// setScalarLine は frontmatter 内の scalar キーを設定する。
// value=="" は該当行を削除、既存行があれば置換、無ければ末尾 (fmEnd 直前) に挿入する。
// 変化後の fmEnd を返す。
func setScalarLine(lines []string, fmStart, fmEnd int, key, value string) ([]string, int) {
	idx := -1
	for i := fmStart + 1; i < fmEnd; i++ {
		if k, _, ok := splitKV(strings.TrimSpace(lines[i])); ok && k == key {
			idx = i
			break
		}
	}
	if value == "" {
		if idx >= 0 {
			lines = append(lines[:idx], lines[idx+1:]...)
			fmEnd--
		}
		return lines, fmEnd
	}
	newLine := key + ": " + value
	if idx >= 0 {
		lines[idx] = newLine
		return lines, fmEnd
	}
	lines = append(lines[:fmEnd], append([]string{newLine}, lines[fmEnd:]...)...)
	return lines, fmEnd + 1
}

// setListBlock は frontmatter 内の YAML リストキーを設定する。
// 既存ブロック ("key:" + 続く "- " 行、またはインライン "key: [..]") を削除し、
// items が非空なら 2 スペースインデントのブロックを末尾に挿入する。変化後の fmEnd を返す。
func setListBlock(lines []string, fmStart, fmEnd int, key string, items []string) ([]string, int) {
	idx := -1
	for i := fmStart + 1; i < fmEnd; i++ {
		if k, _, ok := splitKV(strings.TrimSpace(lines[i])); ok && k == key {
			idx = i
			break
		}
	}
	if idx >= 0 {
		del := 1
		for j := idx + 1; j < fmEnd; j++ {
			if strings.HasPrefix(strings.TrimSpace(lines[j]), "- ") {
				del++
			} else {
				break
			}
		}
		lines = append(lines[:idx], lines[idx+del:]...)
		fmEnd -= del
	}
	if len(items) == 0 {
		return lines, fmEnd
	}
	block := []string{key + ":"}
	for _, it := range items {
		block = append(block, "  - "+it)
	}
	lines = append(lines[:fmEnd], append(block, lines[fmEnd:]...)...)
	return lines, fmEnd + len(block)
}

var dateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// validDate は空または YYYY-MM-DD 形式の実在日付かを検証する。
func validDate(s string) error {
	if s == "" {
		return nil
	}
	if !dateRe.MatchString(s) {
		return fmt.Errorf("日付は YYYY-MM-DD 形式で入力してください: %q", s)
	}
	if _, err := time.Parse("2006-01-02", s); err != nil {
		return fmt.Errorf("日付が不正です: %q", s)
	}
	return nil
}

// parseInlineList は "[a, b]" / "a, b" 形式のインラインリストを要素配列へ変換する。
func parseInlineList(v string) []string {
	v = strings.TrimSpace(v)
	if strings.HasPrefix(v, "[") && strings.HasSuffix(v, "]") {
		v = v[1 : len(v)-1]
	}
	var out []string
	for _, p := range strings.Split(v, ",") {
		p = strings.Trim(strings.TrimSpace(p), "\"'")
		if p != "" {
			out = append(out, p)
		}
	}
	return out
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

// groupKey は表示グループのキー。product → domain → feature 名昇順の順に並ぶ。
func groupKey(s Spec) string {
	switch {
	case strings.HasPrefix(s.ID, "product/"):
		return "0"
	case strings.HasPrefix(s.ID, "domain/"):
		return "1"
	default:
		return "2" + s.Feature
	}
}

// rank はグループ内の表示順を type で決める。
// domain: term → model。feature: feature(spec.md) → requirement → screen → その他。
func rank(s Spec) int {
	switch s.Type {
	case "term", "feature":
		return 0
	case "model":
		return 1
	case "requirement":
		return 2
	case "screen":
		return 3
	default:
		return 4
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

// numFromFile は接頭辞付きファイル名 ("S-001-foo.md" / "R-001.md") から番号を取り出す。
// 取れなければ 0。
func numFromFile(file, prefix string) int {
	m := strings.TrimPrefix(file, prefix)
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
