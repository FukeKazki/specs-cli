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

// Static returns the raw bytes of an embedded static template (init で生成するファイル).
func Static(name string) ([]byte, error) {
	return files.ReadFile("files/" + name)
}

// RenderFeature renders a feature template (spec.md.tmpl / api.md.tmpl) with data.
func RenderFeature(name string, data FeatureData) ([]byte, error) {
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
