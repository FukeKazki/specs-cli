package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kazki/specs-cli/internal/templates"
)

// featureFiles maps a generated filename to its embedded template.
var featureFiles = map[string]string{
	"spec.md": "spec.md.tmpl",
	"api.md":  "api.md.tmpl",
}

// runNew dispatches `specs new <subtype> ...`.
func runNew(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: specs new feature <name>")
	}
	switch args[0] {
	case "feature":
		return runNewFeature(args[1:])
	default:
		return fmt.Errorf("unknown new target %q (supported: feature)", args[0])
	}
}

// runNewFeature creates specs/features/<name>/{spec.md,api.md}.
func runNewFeature(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: specs new feature <name>")
	}
	name := args[0]

	root := "specs"
	if _, err := os.Stat(root); err != nil {
		return fmt.Errorf("%s/ が見つかりません。先に `specs init` を実行してください", root)
	}

	dir := filepath.Join(root, "features", name)
	if _, err := os.Stat(dir); err == nil {
		return fmt.Errorf("%s は既に存在します", dir)
	}

	data := templates.FeatureData{
		Name:  name,
		Title: titleize(name),
	}

	for filename, tmpl := range featureFiles {
		content, err := templates.RenderFeature(tmpl, data)
		if err != nil {
			return err
		}
		dst := filepath.Join(dir, filename)
		if err := writeFile(dst, content); err != nil {
			return err
		}
		fmt.Printf("created %s\n", dst)
	}

	return nil
}

// titleize turns "user-login" / "user_login" into "User Login" for headings.
func titleize(name string) string {
	fields := strings.FieldsFunc(name, func(r rune) bool {
		return r == '-' || r == '_' || r == ' '
	})
	for i, w := range fields {
		if w == "" {
			continue
		}
		fields[i] = strings.ToUpper(w[:1]) + w[1:]
	}
	return strings.Join(fields, " ")
}
