package filemerge

import (
	"strings"
	"testing"
)

// TestUpsertManagedBlock_insertOnEmpty checks that upserting into empty
// content produces exactly one well-formed block containing the given
// blockContent.
func TestUpsertManagedBlock_insertOnEmpty(t *testing.T) {
	out := UpsertManagedBlock("", "hello world")

	if strings.Count(out, BeginMarker) != 1 {
		t.Fatalf("expected exactly 1 BeginMarker, got %d\noutput: %s", strings.Count(out, BeginMarker), out)
	}
	if strings.Count(out, EndMarker) != 1 {
		t.Fatalf("expected exactly 1 EndMarker, got %d\noutput: %s", strings.Count(out, EndMarker), out)
	}
	if !strings.Contains(out, "hello world") {
		t.Fatalf("expected output to contain blockContent, got: %s", out)
	}
}

// TestUpsertManagedBlock_replaceNotDuplicate checks that upserting over an
// existing well-formed block replaces it in place rather than appending a
// second block, and preserves surrounding user text.
func TestUpsertManagedBlock_replaceNotDuplicate(t *testing.T) {
	existing := "before text\n\n" + BeginMarker + "\nold content\n" + EndMarker + "\n\nafter text"

	out := UpsertManagedBlock(existing, "new content")

	if strings.Count(out, BeginMarker) != 1 {
		t.Fatalf("expected exactly 1 BeginMarker, got %d\noutput: %s", strings.Count(out, BeginMarker), out)
	}
	if strings.Count(out, EndMarker) != 1 {
		t.Fatalf("expected exactly 1 EndMarker, got %d\noutput: %s", strings.Count(out, EndMarker), out)
	}
	if strings.Contains(out, "old content") {
		t.Errorf("old content should have been replaced, got: %s", out)
	}
	if !strings.Contains(out, "new content") {
		t.Errorf("expected new content in output, got: %s", out)
	}
	if !strings.Contains(out, "before text") {
		t.Errorf("surrounding 'before text' was not preserved, got: %s", out)
	}
	if !strings.Contains(out, "after text") {
		t.Errorf("surrounding 'after text' was not preserved, got: %s", out)
	}
}

// TestUpsertManagedBlock_orphanBeginRepair checks that a lone BEGIN marker
// (no matching END) is repaired before the upsert, resulting in exactly one
// well-formed block and preserved user text.
func TestUpsertManagedBlock_orphanBeginRepair(t *testing.T) {
	orphan := "user text\n" + BeginMarker + "\nstray\n"

	out := UpsertManagedBlock(orphan, "fresh content")

	if strings.Count(out, BeginMarker) != 1 {
		t.Fatalf("expected exactly 1 BeginMarker after repair, got %d\noutput: %s", strings.Count(out, BeginMarker), out)
	}
	if strings.Count(out, EndMarker) != 1 {
		t.Fatalf("expected exactly 1 EndMarker after repair, got %d\noutput: %s", strings.Count(out, EndMarker), out)
	}
	if !strings.Contains(out, "user text") {
		t.Errorf("user text was not preserved, got: %s", out)
	}
	if !strings.Contains(out, "fresh content") {
		t.Errorf("expected fresh content in output, got: %s", out)
	}
}

// TestUpsertManagedBlock_orphanEndRepair checks that a lone END marker (no
// matching BEGIN) is repaired before the upsert, resulting in exactly one
// well-formed block and preserved user text.
func TestUpsertManagedBlock_orphanEndRepair(t *testing.T) {
	orphan := "user text\n" + EndMarker + "\nstray\n"

	out := UpsertManagedBlock(orphan, "fresh content")

	if strings.Count(out, BeginMarker) != 1 {
		t.Fatalf("expected exactly 1 BeginMarker after repair, got %d\noutput: %s", strings.Count(out, BeginMarker), out)
	}
	if strings.Count(out, EndMarker) != 1 {
		t.Fatalf("expected exactly 1 EndMarker after repair, got %d\noutput: %s", strings.Count(out, EndMarker), out)
	}
	if !strings.Contains(out, "user text") {
		t.Errorf("user text was not preserved, got: %s", out)
	}
	if !strings.Contains(out, "fresh content") {
		t.Errorf("expected fresh content in output, got: %s", out)
	}
}

// TestUpsertManagedBlock_endBeforeBegin locks the documented behavior for a
// corrupted/reversed block: when an END marker appears before a BEGIN
// marker, repairOrphanMarkers treats the content as corrupted and strips
// BOTH markers (no panic, no error), so the subsequent upsert produces one
// clean, well-formed block appended at the end.
func TestUpsertManagedBlock_endBeforeBegin(t *testing.T) {
	corrupted := EndMarker + "\nstuff\n" + BeginMarker

	out := UpsertManagedBlock(corrupted, "fresh content")

	if strings.Count(out, BeginMarker) != 1 {
		t.Fatalf("expected exactly 1 BeginMarker after corruption repair, got %d\noutput: %s", strings.Count(out, BeginMarker), out)
	}
	if strings.Count(out, EndMarker) != 1 {
		t.Fatalf("expected exactly 1 EndMarker after corruption repair, got %d\noutput: %s", strings.Count(out, EndMarker), out)
	}
	if !strings.Contains(out, "stuff") {
		t.Errorf("surrounding 'stuff' was not preserved, got: %s", out)
	}
	if !strings.Contains(out, "fresh content") {
		t.Errorf("expected fresh content in output, got: %s", out)
	}
}

// TestRemoveManagedBlock_removesBlockPreserveSurrounding checks that removing
// an existing well-formed block deletes it entirely while preserving
// surrounding user text, without leaving a double blank line.
func TestRemoveManagedBlock_removesBlockPreserveSurrounding(t *testing.T) {
	content := "before text\n\n" + BeginMarker + "\nmanaged content\n" + EndMarker + "\n\nafter text"

	out := RemoveManagedBlock(content)

	if strings.Contains(out, BeginMarker) || strings.Contains(out, EndMarker) {
		t.Fatalf("expected markers to be gone, got: %s", out)
	}
	if strings.Contains(out, "managed content") {
		t.Errorf("managed content should have been removed, got: %s", out)
	}
	if !strings.Contains(out, "before text") {
		t.Errorf("surrounding 'before text' was not preserved, got: %s", out)
	}
	if !strings.Contains(out, "after text") {
		t.Errorf("surrounding 'after text' was not preserved, got: %s", out)
	}
	if strings.Contains(out, "\n\n\n") {
		t.Errorf("expected no leftover double blank line, got: %s", out)
	}
}

// TestRemoveManagedBlock_noOp checks that removing from content with no
// markers at all returns the content unchanged.
func TestRemoveManagedBlock_noOp(t *testing.T) {
	input := "just some plain user text\nwith multiple lines\n"

	out := RemoveManagedBlock(input)

	if out != input {
		t.Errorf("expected no-op, input and output differ.\ninput:  %q\noutput: %q", input, out)
	}
}

// TestBlockHash_stabilityAndDifference checks that BlockHash is
// deterministic for identical input and differs for different input.
func TestBlockHash_stabilityAndDifference(t *testing.T) {
	h1 := BlockHash("some content")
	h2 := BlockHash("some content")
	if h1 != h2 {
		t.Errorf("expected identical hash for identical input, got %q vs %q", h1, h2)
	}

	h3 := BlockHash("different content")
	if h1 == h3 {
		t.Errorf("expected different hash for different input, both were %q", h1)
	}
}

// TestUpsertManagedBlock_idempotent checks that upserting the same
// blockContent twice in a row yields byte-for-byte identical output.
func TestUpsertManagedBlock_idempotent(t *testing.T) {
	base := "some user text\n"

	out1 := UpsertManagedBlock(base, "stable content")
	out2 := UpsertManagedBlock(out1, "stable content")

	if out1 != out2 {
		t.Errorf("expected idempotent upsert, outputs differ.\nfirst:  %q\nsecond: %q", out1, out2)
	}
	if strings.Count(out2, BeginMarker) != 1 {
		t.Errorf("expected exactly 1 BeginMarker after idempotent upsert, got %d", strings.Count(out2, BeginMarker))
	}
}
