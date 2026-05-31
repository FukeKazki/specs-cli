package main

import (
	"os"

	"github.com/FukeKazki/specs-cli/internal/cmd"
)

func main() {
	os.Exit(cmd.Execute(os.Args[1:]))
}
