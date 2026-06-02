package cmd

import (
	"fmt"
	"path/filepath"

	"github.com/FukeKazki/specs-cli/internal/store"
)

// runNew dispatches `specs new <subtype> ...`.
func runNew(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: specs new feature <name> | specs new screen <feature> <name>")
	}
	switch args[0] {
	case "feature":
		return runNewFeature(args[1:])
	case "screen":
		return runNewScreen(args[1:])
	case "requirement":
		return runNewRequirement(args[1:])
	case "term":
		return runNewDomain(args[1:], "term", func(st *store.Store, name string) (string, error) { return st.CreateTerm(name) })
	case "model":
		return runNewDomain(args[1:], "model", func(st *store.Store, name string) (string, error) { return st.CreateModel(name) })
	default:
		return fmt.Errorf("unknown new target %q (supported: feature, screen, requirement, term, model)", args[0])
	}
}

// runNewDomain creates a domain entry (term / model).
func runNewDomain(args []string, kind string, create func(*store.Store, string) (string, error)) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: specs new %s <name>", kind)
	}
	st := store.New(".")
	if err := st.EnsureInitialized(); err != nil {
		return err
	}
	id, err := create(st, args[0])
	if err != nil {
		return err
	}
	fmt.Printf("created %s\n", filepath.Join(store.Root, filepath.FromSlash(id)))
	return nil
}

// runNewFeature creates specs/features/<name>/{spec.md,api.md}.
func runNewFeature(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: specs new feature <name>")
	}
	st := store.New(".")
	if err := st.EnsureInitialized(); err != nil {
		return err
	}
	created, err := st.CreateFeature(args[0])
	if err != nil {
		return err
	}
	for _, id := range created {
		fmt.Printf("created %s\n", filepath.Join(store.Root, filepath.FromSlash(id)))
	}
	return nil
}

// runNewScreen creates specs/features/<feature>/screens/S-00n-<name>.md.
func runNewScreen(args []string) error {
	if len(args) != 2 {
		return fmt.Errorf("usage: specs new screen <feature> <name>")
	}
	st := store.New(".")
	if err := st.EnsureInitialized(); err != nil {
		return err
	}
	id, err := st.CreateScreen(args[0], args[1])
	if err != nil {
		return err
	}
	fmt.Printf("created %s\n", filepath.Join(store.Root, filepath.FromSlash(id)))
	return nil
}

// runNewRequirement creates specs/features/<feature>/requirements/R-00n.md.
func runNewRequirement(args []string) error {
	if len(args) != 2 {
		return fmt.Errorf("usage: specs new requirement <feature> <title>")
	}
	st := store.New(".")
	if err := st.EnsureInitialized(); err != nil {
		return err
	}
	id, err := st.CreateRequirement(args[0], args[1])
	if err != nil {
		return err
	}
	fmt.Printf("created %s\n", filepath.Join(store.Root, filepath.FromSlash(id)))
	return nil
}
