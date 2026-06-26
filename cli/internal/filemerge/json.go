// Package filemerge provides format-preserving merge helpers for structured
// config files (JSON/JSONC, TOML). All merges are additive: only the caller's
// key is inserted or replaced; every other key in the target file survives
// unchanged.
//
// Adapted from github.com/Gentleman-Programming/gentle-ai (MIT).
// Original: internal/components/filemerge/json_merge.go
package filemerge

import (
	"encoding/json"
	"fmt"
	"strings"
	"unicode"
)

// MergeResult is returned by MergeJSONObjectsEx and carries the merged bytes
// plus a flag indicating whether the base was malformed.
type MergeResult struct {
	// Data is the merged, indented JSON output.
	Data []byte
	// MalformedBase is true when the base input was not valid JSON (after JSONC
	// comment stripping). The merge succeeded by treating base as {} — callers
	// should warn the user that their existing file was unreadable and has been
	// replaced by a fresh config containing only the overlay keys.
	MalformedBase bool
}

// MergeJSONObjectsEx is like MergeJSONObjects but also reports whether the
// base was malformed via MergeResult.MalformedBase. Prefer this form in
// callers that surface diagnostics to the user.
func MergeJSONObjectsEx(base, overlay []byte) (MergeResult, error) {
	cleanBase := stripJSONC(base)
	cleanOverlay := stripJSONC(overlay)

	var baseMap map[string]any
	malformed := false
	if err := json.Unmarshal(cleanBase, &baseMap); err != nil {
		// Gotcha #2: malformed base → fall back to empty map, but record it.
		baseMap = make(map[string]any)
		malformed = true
	}

	var overlayMap map[string]any
	if err := json.Unmarshal(cleanOverlay, &overlayMap); err != nil {
		return MergeResult{}, fmt.Errorf("filemerge: overlay is not valid JSON: %w", err)
	}

	merged := deepMerge(baseMap, overlayMap)

	out, err := json.MarshalIndent(merged, "", "  ")
	if err != nil {
		return MergeResult{}, fmt.Errorf("filemerge: marshal merged result: %w", err)
	}
	return MergeResult{Data: append(out, '\n'), MalformedBase: malformed}, nil
}

// MergeJSONObjects deep-merges overlay into base and returns the result as
// indented JSON. It supports JSONC input (base and overlay may contain //
// line comments, /* block comments */, and trailing commas).
//
// Merge semantics:
//   - Top-level keys present in overlay are set in the result.
//   - Top-level keys present only in base are preserved unchanged.
//   - When an overlay value is {"__replace__": <val>}, the key's value is
//     replaced with <val> (sentinel for forcing an atomic subtree replace).
//   - Nested objects are deep-merged recursively.
//
// If base is malformed JSON (after comment stripping), the merge falls back
// to treating base as {} — the overlay is still applied and the result is
// returned. This implements gotcha #2: a corrupt user config must never block
// an install. Use MergeJSONObjectsEx when you need to detect and report this
// fallback to the user.
func MergeJSONObjects(base, overlay []byte) ([]byte, error) {
	res, err := MergeJSONObjectsEx(base, overlay)
	if err != nil {
		return nil, err
	}
	return res.Data, nil
}

// deepMerge recursively merges src into dst. src values take precedence, but
// when both dst[k] and src[k] are maps they are merged recursively rather than
// replaced wholesale — unless src[k] is a __replace__ sentinel.
//
// The __replace__ sentinel is consumed (unwrapped) in all cases: whether or
// not the key exists in dst. This ensures idempotency — writing the same
// overlay twice produces the same output because the first write strips the
// sentinel, and the second write would encounter a plain value in dst that
// the sentinel still replaces correctly.
func deepMerge(dst, src map[string]any) map[string]any {
	if dst == nil {
		dst = make(map[string]any)
	}
	for k, sv := range src {
		// __replace__ sentinel: unwrap and force-replace regardless of dst state.
		// This also fires when dst[k] does not exist, preventing the sentinel
		// object from being stored verbatim.
		if sm, ok := sv.(map[string]any); ok {
			if rv, hasSentinel := sm["__replace__"]; hasSentinel {
				dst[k] = rv
				continue
			}
		}

		dv, exists := dst[k]

		// When sv is a map, always recurse (even if dst[k] doesn't exist) so
		// that nested __replace__ sentinels are resolved rather than stored verbatim.
		if sm2, sIsMap := sv.(map[string]any); sIsMap {
			if exists {
				if dm, dIsMap := dv.(map[string]any); dIsMap {
					dst[k] = deepMerge(dm, sm2)
					continue
				}
			}
			// dst[k] doesn't exist or is not a map: recurse into an empty dst
			// so sentinels at any depth are resolved.
			dst[k] = deepMerge(nil, sm2)
			continue
		}

		if !exists {
			dst[k] = sv
			continue
		}

		// Scalar or type mismatch → overlay wins.
		dst[k] = sv
	}
	return dst
}

// RemoveJSONKey removes a top-level key (or nested key under parentKey) from a
// JSON (or JSONC) object and returns the cleaned JSON bytes.
//
// When parentKey is empty, keyName is removed from the root object.
// When parentKey is non-empty, keyName is removed from root[parentKey].
// All other keys at every level are preserved unchanged.
//
// If the file is empty or malformed, an empty {}+newline is returned.
// If the key does not exist the input (minus any JSONC syntax) is returned.
func RemoveJSONKey(src []byte, parentKey, keyName string) ([]byte, error) {
	clean := stripJSONC(src)
	var root map[string]any
	if err := json.Unmarshal(clean, &root); err != nil {
		// Malformed — return empty object rather than aborting.
		return []byte("{}\n"), nil
	}
	if parentKey == "" {
		delete(root, keyName)
	} else {
		if child, ok := root[parentKey].(map[string]any); ok {
			delete(child, keyName)
			root[parentKey] = child
		}
	}
	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("filemerge: RemoveJSONKey marshal: %w", err)
	}
	return append(out, '\n'), nil
}

// stripJSONC removes JavaScript-style comments and trailing commas from JSON
// input so that the result can be parsed by Go's standard json.Unmarshal.
//
// Supported:
//   - // line comments
//   - /* ... */ block comments
//   - trailing commas before } or ]
//
// This is a hand-rolled state machine that operates on bytes, which avoids
// any external JSONC parser dependency.
func stripJSONC(src []byte) []byte {
	s := string(src)
	var b strings.Builder
	b.Grow(len(s))

	i := 0
	inString := false
	for i < len(s) {
		ch := s[i]

		if inString {
			b.WriteByte(ch)
			if ch == '\\' && i+1 < len(s) {
				// Escaped character inside string — write the next byte verbatim.
				i++
				b.WriteByte(s[i])
			} else if ch == '"' {
				inString = false
			}
			i++
			continue
		}

		// Outside a string: check for comment starts.
		if ch == '/' && i+1 < len(s) {
			next := s[i+1]
			if next == '/' {
				// Line comment: skip to end of line.
				for i < len(s) && s[i] != '\n' {
					i++
				}
				continue
			}
			if next == '*' {
				// Block comment: skip to closing */.
				i += 2
				for i < len(s) {
					if s[i] == '*' && i+1 < len(s) && s[i+1] == '/' {
						i += 2
						break
					}
					i++
				}
				continue
			}
		}

		if ch == '"' {
			inString = true
		}
		b.WriteByte(ch)
		i++
	}

	// Remove trailing commas before } or ] (second pass on the result string).
	return removeTrailingCommas([]byte(b.String()))
}

// removeTrailingCommas removes trailing commas that appear immediately before
// a closing } or ] with optional whitespace in between. This handles the
// common JSONC pattern of leaving a trailing comma after the last element.
func removeTrailingCommas(src []byte) []byte {
	s := string(src)
	var b strings.Builder
	b.Grow(len(s))

	i := 0
	for i < len(s) {
		ch := s[i]
		if ch == ',' {
			// Look ahead past whitespace for } or ].
			j := i + 1
			for j < len(s) && unicode.IsSpace(rune(s[j])) {
				j++
			}
			if j < len(s) && (s[j] == '}' || s[j] == ']') {
				// Trailing comma — skip it.
				i++
				continue
			}
		}
		b.WriteByte(ch)
		i++
	}
	return []byte(b.String())
}
