// Package cmd implements the specs CLI commands.
package cmd

import (
	"fmt"
	"os"
	"path/filepath"
)

const usage = `specs — 仕様書を管理する CLI ツール

Usage:
  specs init                  specs/ ディレクトリとテンプレートを生成する
  specs new feature <name>    features/<name>/ に spec.md / api.md を生成する
  specs new screen <feature> <name>  feature に画面 (screens/S-00n.md) を追加する
  specs new term <name>       domain/glossary/ にユビキタス言語を追加する
  specs new model <name>      domain/models/ にモデル (mermaid) を追加する
  specs serve [--addr host:port]  仕様書管理 Web UI を起動する
  specs help                  このヘルプを表示する
`

// Execute is the CLI entrypoint. It returns a process exit code.
func Execute(args []string) int {
	if len(args) == 0 {
		fmt.Print(usage)
		return 0
	}

	var err error
	switch args[0] {
	case "init":
		err = runInit(args[1:])
	case "new":
		err = runNew(args[1:])
	case "serve":
		err = runServe(args[1:])
	case "help", "-h", "--help":
		fmt.Print(usage)
		return 0
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n%s", args[0], usage)
		return 2
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return 1
	}
	return 0
}

// writeFile writes content to path, creating parent directories as needed.
// It refuses to overwrite an existing file.
func writeFile(path string, content []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	if _, err := os.Stat(path); err == nil {
		return fmt.Errorf("%s は既に存在します", path)
	}
	return os.WriteFile(path, content, 0o644)
}
