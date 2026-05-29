package main

import (
	"os"

	"github.com/kazki/specs-cli/internal/cmd"
)

func main() {
	os.Exit(cmd.Execute(os.Args[1:]))
}
