package cmd

import (
	"flag"
	"fmt"
	"net"
	"net/http"

	"github.com/FukeKazki/specs-cli/internal/server"
	"github.com/FukeKazki/specs-cli/internal/store"
)

// runServe starts the local Web UI for managing specs.
func runServe(args []string) error {
	fs := flag.NewFlagSet("serve", flag.ContinueOnError)
	addr := fs.String("addr", "127.0.0.1:8787", "listen address")
	if err := fs.Parse(args); err != nil {
		return err
	}

	st := store.New(".")
	if err := st.EnsureInitialized(); err != nil {
		return err
	}

	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		return err
	}

	fmt.Printf("specs Web UI: http://%s\n", ln.Addr())
	fmt.Println("stop: Ctrl+C")
	return http.Serve(ln, server.Handler(st))
}
