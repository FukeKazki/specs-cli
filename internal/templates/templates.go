// Package templates embeds the spec document templates and renders them.
package templates

import (
	"bytes"
	"embed"
	"text/template"
)

//go:embed files/*.md files/*.md.tmpl
var files embed.FS

// FeatureData holds the values substituted into feature templates.
type FeatureData struct {
	Name  string // 識別子に使う名前 (例: user-login)
	Title string // 見出しに使う表示名 (例: User Login)
}

// ScreenData holds the values substituted into the screen template.
type ScreenData struct {
	Feature string // 所属する feature 名
	Num     string // 画面番号 (例: S-001)
	Title   string // 見出しに使う表示名
	Order   int    // 並び順
}

// RequirementData holds the values substituted into the requirement template.
type RequirementData struct {
	Feature  string // 所属する feature 名
	Num      string // 要件番号 (例: R-001)
	Title    string // 見出しに使う表示名
	Order    int    // 並び順
	Priority string // MoSCoW 優先度 (Must / Should / Could / Won't)
}

// Static returns the raw bytes of an embedded static template (init で生成するファイル).
func Static(name string) ([]byte, error) {
	return files.ReadFile("files/" + name)
}

// Render renders the named template with arbitrary data.
func Render(name string, data any) ([]byte, error) {
	raw, err := files.ReadFile("files/" + name)
	if err != nil {
		return nil, err
	}
	tmpl, err := template.New(name).Parse(string(raw))
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
